"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin, requireApprovedCustomer, requireUser, guardOrError } from "@/lib/auth-guard";
import { Order } from "@/types/database.types";
import { OrderStatus, ORDER_STATUSES, ORDER_STATUS_CONFIG } from "@/lib/constants";
import { placeCustomerOrder } from "@/lib/server/checkout/place-order";
import type { PriceChange } from "@/lib/server/checkout/cart";
import { transitionOrderStatus, renameOrder } from "@/lib/server/rpc";
import { createNotification, notifyAll } from "@/lib/server/notifications";
import { createInvoiceFromOrder } from "@/actions/invoice";
import { stockErrorMessage } from "@/lib/server/stock-errors";
import { needsEwayBill, EWAY_BILL_THRESHOLD } from "@/lib/invoice";
import { revalidatePath } from "next/cache";

export interface CreateOrderPayload {
  items: Array<{
    variantId: string;
    quantity: number;
    /** The price shown to the customer; checked against the catalogue, never charged as-is. */
    unit_price: number;
    specifications?: Record<string, unknown>;
  }>;
  shippingAddress: string;
  notes?: string;
  /** One per checkout attempt (crypto.randomUUID()); a retried submit returns the same order. */
  idempotencyKey: string;
  /** Optional coupon; re-checked on the server, never trusted from the browser. */
  couponCode?: string | null;
}

export interface CreateOrderResult {
  success: boolean;
  orderId?: string;
  orderNumber?: string;
  error?: string;
  /** Machine-readable reason when success is false. */
  code?: string;
  /** When code is PRICE_CHANGED: the current prices, to refresh the cart with. */
  priceChanges?: PriceChange[];
}

/**
 * 1. Customer Order Placement Action
 */
export async function createCustomerOrder(payload: CreateOrderPayload): Promise<CreateOrderResult> {
  // Approval is enforced here as well as in the dashboard layout, because this
  // action is a public endpoint that a pending account could call directly.
  const guard = await guardOrError(requireApprovedCustomer);
  if (!guard.ctx) {
    return { success: false, code: "ACCOUNT_NOT_APPROVED", error: "Your account must be approved before placing an order." };
  }

  try {
    const outcome = await placeCustomerOrder({
      user: { id: guard.ctx.userId, email: guard.ctx.email },
      items: (payload.items || []).map((i) => ({
        variantId: i.variantId,
        quantity: i.quantity,
        unitPrice: i.unit_price,
        specifications: i.specifications,
      })),
      shippingAddress: payload.shippingAddress,
      notes: payload.notes,
      idempotencyKey: payload.idempotencyKey,
      couponCode: payload.couponCode ?? null,
    });

    if (!outcome.ok) {
      return { success: false, code: outcome.code, error: outcome.message, priceChanges: outcome.priceChanges };
    }

    revalidatePath("/dashboard");
    revalidatePath("/admin/orders");
    revalidatePath("/admin/dashboard");
    revalidatePath("/admin/coupons");
    return { success: true, orderId: outcome.orderId, orderNumber: outcome.orderNumber };
  } catch (err) {
    console.error("[createCustomerOrder] Unexpected error:", err);
    return { success: false, code: "UNEXPECTED", error: "We couldn't place your order. Please try again in a moment." };
  }
}

const TRANSITION_ERRORS: Record<string, string> = {
  ORDER_NOT_FOUND: "Order not found.",
  INVALID_STATUS: "Unknown order status.",
};

function transitionErrorMessage(code: string, detail: Record<string, unknown>): string {
  const label = (s: unknown) => ORDER_STATUS_CONFIG[s as OrderStatus]?.label ?? String(s);
  if (code === "ORDER_CLOSED") {
    return `This order is already ${label(detail.status)} and can no longer change status.`;
  }
  if (code === "INVALID_TRANSITION") {
    return `An order cannot move from ${label(detail.from)} to ${label(detail.to)}.`;
  }
  if (code === "INSUFFICIENT_STOCK") {
    // Shipping takes the goods out of stock; refused when they are not on the shelf.
    const msg = stockErrorMessage({ code, detail, raw: code });
    return msg ? `Cannot ship this order. ${msg}` : "Cannot ship this order: not enough stock.";
  }
  return TRANSITION_ERRORS[code] ?? "Failed to update order status.";
}

/**
 * 2. Admin Manual Order Lifecycle & Tracking Update Action
 *
 * The status rules, timestamps, stock movement and coupon release all happen in one
 * locked database step (transition_order_status), so a double click or two
 * admins acting at once cannot move stock twice:
 *   shipped (or delivered, if shipping was skipped)  the goods leave stock; refused with
 *       INSUFFICIENT_STOCK when they are not on the shelf
 *   cancelled   the reservation is released     returned   the units come back on hand
 * The GST tax invoice is then raised from the order at the same moment it ships (one per
 * order). The customer is shown it once the order is delivered.
 */
export async function updateOrderStatus(
  orderId: string,
  newStatus: OrderStatus,
  tracking?: {
    courier_partner?: string;
    awb_number?: string;
    tracking_url?: string;
    notes?: string;
    return_reason?: string;
  }
): Promise<{ success: boolean; error?: string }> {
  const guard = await guardOrError(requireAdmin);
  if (!guard.ctx) return { success: false, error: guard.error };

  // Only send the fields the caller actually provided: absent keys are left unchanged.
  const changes = Object.fromEntries(
    Object.entries(tracking ?? {}).filter(([, v]) => v !== undefined)
  ) as Record<string, string>;

  const { data, error } = await transitionOrderStatus(orderId, newStatus, changes, guard.ctx.userId);
  if (error) {
    return { success: false, error: transitionErrorMessage(error.code, error.detail) };
  }

  let invoiceNumber = data.invoice_number;
  const justRaised = !invoiceNumber && (data.status === ORDER_STATUSES.SHIPPED || data.status === ORDER_STATUSES.DELIVERED);
  if (justRaised) {
    const raised = await raiseOrderInvoice(orderId, data.order_number);
    invoiceNumber = raised?.number ?? null;
    if (raised) await notifyAdminInvoiceRaised(data.order_number, raised.number, raised.total);
  }

  if (data.previous_status !== data.status || data.status === ORDER_STATUSES.SHIPPED) {
    await notifyCustomerOfStatus({ ...data, invoice_number: invoiceNumber });
  }

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/invoices");
  revalidatePath("/dashboard/orders");
  revalidatePath("/admin/orders");
  revalidatePath("/admin/order-returns");
  revalidatePath("/admin/dashboard");
  revalidatePath("/admin/coupons");
  revalidatePath("/admin/invoices");

  return { success: true };
}

const RENAME_ERRORS: Record<string, string> = {
  DUPLICATE_ORDER_NUMBER: "That order number is already used by another order.",
  INVALID_ORDER_NUMBER: "Use letters, numbers and / - _ . only (up to 50 characters).",
  ORDER_NOT_FOUND: "Order not found.",
  ADMIN_REQUIRED: "Administrator access required.",
};

/**
 * Gives an order a typed number (new orders are numbered automatically from Sales Settings).
 * The counter is untouched. The invoice raised for the order carries the order number as its
 * "PO number", so that snapshot is kept in step when it still matches; failing to do so (for
 * example the invoice has a credit note) never undoes the rename.
 */
export async function renameOrderNumber(
  orderId: string,
  newNumber: string
): Promise<{ success: true; orderNumber: string } | { success: false; error: string }> {
  const guard = await guardOrError(requireAdmin);
  if (!guard.ctx) return { success: false, error: guard.error };

  const { data, error } = await renameOrder(orderId, newNumber, guard.ctx.userId);
  if (error) {
    return { success: false, error: RENAME_ERRORS[error.code] ?? "Could not change the order number. Please try again." };
  }

  if (data.changed) {
    const { error: invErr } = await createAdminClient()
      .from("invoices" as never)
      .update({ po_number: data.order_number } as never)
      .eq("order_id", orderId)
      .eq("po_number", data.previous);
    if (invErr) console.warn(`[renameOrderNumber] Invoice PO number not updated for ${data.previous}:`, invErr.message);
  }

  for (const path of ["/admin/orders", "/admin/order-returns", "/admin/invoices", "/dashboard", "/dashboard/orders"]) {
    revalidatePath(path);
  }
  return { success: true, orderNumber: data.order_number };
}

/**
 * Raises the tax invoice for an order that has shipped and records its number on the
 * order. Shipping must never fail because invoicing did (the goods have already left
 * stock): on error the order keeps no invoice number, so saving it as Shipped or
 * Delivered again retries. createInvoiceFromOrder is idempotent (one invoice per order).
 */
async function raiseOrderInvoice(orderId: string, orderNumber: string): Promise<{ number: string; total: number } | null> {
  const result = await createInvoiceFromOrder(orderId);
  if (!result.success) {
    console.error(`[updateOrderStatus] Invoice for order ${orderNumber} failed: ${result.error}`);
    return null;
  }
  const invoiceNumber = result.invoice.invoice_number;
  const { error } = await createAdminClient()
    .from("orders")
    .update({ invoice_number: invoiceNumber } as never)
    .eq("id", orderId)
    .is("invoice_number", null);
  if (error) console.error(`[updateOrderStatus] Could not record invoice ${invoiceNumber} on ${orderNumber}:`, error.message);
  return { number: invoiceNumber, total: Number(result.invoice.total_amount) };
}

async function notifyAdminInvoiceRaised(orderNumber: string, invoiceNumber: string, total: number) {
  await notifyAll([
    {
      role: "admin",
      title: "Invoice generated",
      message:
        `Invoice ${invoiceNumber} was raised for order #${orderNumber}. The customer sees it once the order is delivered.` +
        (needsEwayBill(total) ? ` It is above ₹${EWAY_BILL_THRESHOLD.toLocaleString("en-IN")}: create an E-Way Bill for this consignment on the government portal.` : ""),
      type: "order",
      link: "/admin/invoices",
      metadata: { order_number: orderNumber, invoice_number: invoiceNumber },
    },
  ]);
}

async function notifyCustomerOfStatus(order: {
  order_id: string;
  order_number: string;
  user_id: string;
  status: OrderStatus;
  invoice_number: string | null;
  courier_partner: string | null;
}) {
  const label = ORDER_STATUS_CONFIG[order.status]?.label || order.status;
  let title = `Order Status: ${label}`;
  let message = `Order #${order.order_number} status has been updated to "${label}".`;

  if (order.status === ORDER_STATUSES.SHIPPED) {
    title = "Order Dispatched";
    message = `Your order #${order.order_number} has been dispatched.${order.courier_partner ? ` Transporter: ${order.courier_partner}` : ""} Your tax invoice will be available here once it is delivered.`;
  } else if (order.status === ORDER_STATUSES.DELIVERED) {
    title = "Order Delivered";
    message = `Your order #${order.order_number} has been successfully delivered. Tax Invoice: ${order.invoice_number || "Available in Dashboard"}.`;
  } else if (order.status === ORDER_STATUSES.RETURNED) {
    title = "Order Return Processed";
    message = `Return for order #${order.order_number} has been verified and restocked into warehouse inventory.`;
  }

  await notifyAll([
    {
      userId: order.user_id,
      title,
      message,
      type: "order",
      link: "/dashboard/orders",
      metadata: { order_id: order.order_id, order_number: order.order_number, status: order.status },
    },
  ]);
}

/**
 * 3. Fetch Master Orders List for Admin
 */
export async function fetchAdminOrdersList(): Promise<Order[]> {
  await requireAdmin();
  try {
    const { data: orders, error } = await createAdminClient()
      .from("orders")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.warn("Notice fetching admin orders:", error.message);
      return [];
    }
    return (orders as Order[]) || [];
  } catch (err) {
    console.error("fetchAdminOrdersList exception:", err);
    return [];
  }
}

/**
 * 4. Fetch Live Orders for Authenticated Customer
 */
export async function fetchCustomerOrdersList(): Promise<Order[]> {
  const supabase = await createClient();

  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return [];

    // Session client: row-level security limits this to the customer's own orders.
    const { data: orders, error } = await supabase
      .from("orders")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (error) {
      console.warn("Notice fetching customer orders:", error.message);
      return [];
    }
    return (orders as Order[]) || [];
  } catch (err) {
    console.error("fetchCustomerOrdersList exception:", err);
    return [];
  }
}

/**
 * 5. Customer Self-Service Return Request
 */
export async function requestCustomerOrderReturn(
  orderId: string,
  reason: string
): Promise<{ success: boolean; error?: string }> {
  const guard = await guardOrError(requireUser);
  if (!guard.ctx) return { success: false, error: "Please log in to submit a return request." };
  const userId = guard.ctx.userId;

  const trimmedReason = reason?.trim() ?? "";
  if (!trimmedReason) {
    return { success: false, error: "Please provide a reason for the return request." };
  }
  if (trimmedReason.length > 1000) {
    return { success: false, error: "Please keep the reason under 1000 characters." };
  }

  try {
    const adminClient = createAdminClient();
    const { data: orderData, error: fetchErr } = await adminClient
      .from("orders")
      .select("*")
      .eq("id", orderId)
      .single();

    const order = orderData as Order | null;
    // Same message for "not yours" and "does not exist": no probing other orders.
    if (fetchErr || !order || order.user_id !== userId) {
      return { success: false, error: "Order not found." };
    }

    if (order.status !== ORDER_STATUSES.DELIVERED && order.status !== ORDER_STATUSES.SHIPPED) {
      return { success: false, error: "Only dispatched or delivered orders can be requested for return." };
    }
    if (order.return_reason) {
      return { success: false, error: "A return has already been requested for this order." };
    }

    const formattedReason = `Return Requested: ${trimmedReason} (Submitted on ${new Date().toLocaleDateString("en-IN")})`;
    const updatedNotes = order.notes ? `${order.notes}\n${formattedReason}` : formattedReason;

    const { error: updateErr } = await adminClient
      .from("orders")
      .update({
        return_reason: trimmedReason,
        notes: updatedNotes,
        updated_at: new Date().toISOString(),
      } as never)
      .eq("id", orderId)
      .eq("user_id", userId);

    if (updateErr) {
      return { success: false, error: "Could not submit the return request. Please try again." };
    }

    await notifyAll([
      {
        role: "admin",
        title: "Order Return Requested",
        message: `Return requested for Order #${order.order_number} by ${order.customer_details?.company_name || "Customer"}: "${trimmedReason}"`,
        type: "order",
        link: "/admin/orders",
        metadata: { order_id: orderId, order_number: order.order_number, reason: trimmedReason },
      },
    ]);
    await createNotification({
      userId,
      title: "Return Request Received",
      message: `Your return request for Order #${order.order_number} has been logged. Our logistics team will review it shortly.`,
      type: "order",
      link: "/dashboard/orders",
      metadata: { order_id: orderId, order_number: order.order_number },
    });

    revalidatePath("/dashboard/orders");
    revalidatePath("/admin/orders");
    return { success: true };
  } catch (err) {
    console.error("requestCustomerOrderReturn exception:", err);
    return { success: false, error: "Failed to process return request." };
  }
}
