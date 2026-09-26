"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin, requireApprovedCustomer, guardOrError } from "@/lib/auth-guard";
import { Order, OrderItem, CustomerOrderDetails, Profile } from "@/types/database.types";
import { OrderStatus, ORDER_STATUSES, ORDER_STATUS_CONFIG } from "@/lib/constants";
import { recordStockMovement } from "@/actions/inventory";
import { checkAndGeneratePurchaseOrder } from "@/actions/purchase-order";
import { createNotification } from "@/actions/notification";
import { revalidatePath } from "next/cache";

export interface CreateOrderPayload {
  items: Array<{
    variantId?: string;
    name: string;
    sku: string;
    quantity: number;
    unit_price: number;
    specifications?: Record<string, any>;
  }>;
  shippingAddress: string;
  notes?: string;
}

/**
 * 1. Customer Order Placement Action
 */
export async function createCustomerOrder(
  payload: CreateOrderPayload
): Promise<{ success: boolean; orderId?: string; orderNumber?: string; error?: string }> {
  const supabase = await createClient();

  // 1. Authenticate and confirm the account is approved. Approval is enforced
  // here as well as in the dashboard layout, because this action is a public
  // endpoint that a pending account could call directly.
  const guard = await guardOrError(requireApprovedCustomer);
  if (!guard.ctx) {
    return { success: false, error: "Your account must be approved before placing an order." };
  }
  const user = { id: guard.ctx.userId, email: guard.ctx.email };

  if (!payload.items || payload.items.length === 0) {
    return { success: false, error: "Your order cart is empty." };
  }

  // 2. Fetch customer profile for snapshotting customer details
  const { data: profileData } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  const profile = profileData as Profile | null;

  const customerDetails: CustomerOrderDetails = {
    company_name: profile?.company_name || user.email?.split("@")[0] || "Registered Enterprise",
    contact_name: profile ? `${profile.title || "Mr"} ${profile.first_name} ${profile.last_name}` : "Purchasing Agent",
    mobile: profile?.mobile || "-",
    email: user.email || "",
    gstin: profile?.gstin || null,
    city: profile?.city || "Industrial Area",
    state: profile?.state || "Maharashtra",
    pincode: profile?.pincode || "400001",
  };

  // 3. Compute Financials
  let subtotal = 0;
  const orderItems: OrderItem[] = payload.items.map((item, idx) => {
    const itemTotal = item.quantity * item.unit_price;
    subtotal += itemTotal;
    return {
      id: item.variantId || `item-${idx + 1}`,
      name: item.name,
      sku: item.sku,
      quantity: item.quantity,
      unit_price: item.unit_price,
      total_price: itemTotal,
      specifications: item.specifications,
    };
  });

  const gstAmount = Math.round(subtotal * 0.18 * 100) / 100; // 18% standard GST
  const totalAmount = Math.round((subtotal + gstAmount) * 100) / 100;

  // 4. Generate unique serial Order Number
  const year = new Date().getFullYear();
  const randomSuffix = Math.floor(1000 + Math.random() * 9000);
  const orderNumber = `ORD-${year}-${randomSuffix}`;

  const newOrder = {
    user_id: user.id,
    order_number: orderNumber,
    status: ORDER_STATUSES.PENDING,
    subtotal,
    gst_amount: gstAmount,
    total_amount: totalAmount,
    items: orderItems,
    shipping_address: payload.shippingAddress || profile?.company_address || "Factory Delivery Address",
    customer_details: customerDetails,
    notes: payload.notes || null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const { data: insertedOrderData, error: orderError } = await (supabase
    .from("orders") as any)
    .insert(newOrder)
    .select("id, order_number")
    .single();

  if (orderError) {
    console.error("Error creating order:", orderError);
    return { success: false, error: `Failed to create order: ${orderError.message}` };
  }

  const insertedOrder = insertedOrderData as { id: string; order_number: string };

  // 5. Reserve / Deduct Stock from Inventory with Audit Movement
  const adminClient = createAdminClient();
  for (const item of payload.items) {
    if (item.variantId) {
      try {
        const { data: currentVariantData } = await (adminClient
          .from("product_variants") as any)
          .select("stock_quantity")
          .eq("id", item.variantId)
          .single();

        const currentVariant = currentVariantData as { stock_quantity: number } | null;

        if (currentVariant) {
          const oldStock = currentVariant.stock_quantity || 0;
          const newStock = Math.max(0, oldStock - item.quantity);

          await (adminClient
            .from("product_variants") as any)
            .update({ stock_quantity: newStock })
            .eq("id", item.variantId);

          await recordStockMovement({
            variantId: item.variantId,
            skuCode: item.sku,
            productTitle: item.name,
            movementType: "ORDER_RESERVATION",
            quantityDelta: -item.quantity,
            balanceBefore: oldStock,
            balanceAfter: newStock,
            referenceId: orderNumber,
            notes: `Auto-reserved for ${customerDetails.company_name}`,
          });

          // Check if stock dropped below min_quantity and auto-generate Purchase Order
          try {
            await checkAndGeneratePurchaseOrder(item.variantId, newStock);
          } catch (poErr) {
            console.warn(`[createOrder] Notice auto PO check for ${item.variantId}:`, poErr);
          }
        }
      } catch (stockErr) {
        console.warn(`Notice updating variant ${item.variantId} stock:`, stockErr);
      }
    }
  }

  // Send notifications for order creation
  try {
    // Notify Admin
    await createNotification({
      role: "admin",
      title: "New Customer Order",
      message: `Order #${orderNumber} placed by ${customerDetails.company_name} (₹${totalAmount.toLocaleString("en-IN")}).`,
      type: "order",
      link: "/admin/orders",
      metadata: { order_id: insertedOrder.id, order_number: orderNumber, total: totalAmount },
    });

    // Notify Customer
    await createNotification({
      userId: user.id,
      title: "Order Placed Successfully",
      message: `Your order #${orderNumber} for ₹${totalAmount.toLocaleString("en-IN")} has been received and is being processed.`,
      type: "order",
      link: "/dashboard/orders",
      metadata: { order_id: insertedOrder.id, order_number: orderNumber },
    });
  } catch (notifErr) {
    console.warn("[createCustomerOrder] Notification error:", notifErr);
  }

  revalidatePath("/dashboard");
  revalidatePath("/admin/orders");
  revalidatePath("/admin/dashboard");

  return {
    success: true,
    orderId: insertedOrder.id,
    orderNumber: insertedOrder.order_number,
  };
}

/**
 * 2. Admin Manual Order Lifecycle & Tracking Update Action
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
  const adminClient = createAdminClient();

  try {
    // 1. Fetch current order
    const { data: existingOrderData, error: fetchError } = await (adminClient
      .from("orders") as any)
      .select("*")
      .eq("id", orderId)
      .single();

    const existingOrder = existingOrderData as Order | null;

    if (fetchError || !existingOrder) {
      return { success: false, error: "Order not found." };
    }

    const updates: any = {
      status: newStatus,
      updated_at: new Date().toISOString(),
    };

    if (tracking?.courier_partner !== undefined) {
      updates.courier_partner = tracking.courier_partner || null;
    }
    if (tracking?.awb_number !== undefined) {
      updates.awb_number = tracking.awb_number || null;
    }
    if (tracking?.tracking_url !== undefined) {
      updates.tracking_url = tracking.tracking_url || null;
    }
    if (tracking?.notes !== undefined) {
      updates.notes = tracking.notes || null;
    }
    if (tracking?.return_reason !== undefined) {
      updates.return_reason = tracking.return_reason || null;
    }

    // Set timestamps on milestones & auto-generate official GST Tax Invoice on delivery
    if (newStatus === ORDER_STATUSES.SHIPPED && !existingOrder.dispatched_at) {
      updates.dispatched_at = new Date().toISOString();
    }
    if (newStatus === ORDER_STATUSES.DELIVERED) {
      if (!existingOrder.delivered_at) {
        updates.delivered_at = new Date().toISOString();
      }
      if (!existingOrder.invoice_number) {
        const orderSuffix = existingOrder.order_number?.replace("ORD-", "") || `${Math.floor(1000 + Math.random() * 9000)}`;
        updates.invoice_number = `INV-${orderSuffix}`;
      }
    }

    // If returned, record return timestamp, reason, and restore stock into inventory
    if (newStatus === ORDER_STATUSES.RETURNED && existingOrder.status !== ORDER_STATUSES.RETURNED) {
      updates.returned_at = new Date().toISOString();
      if (!updates.return_reason && tracking?.notes) {
        updates.return_reason = tracking.notes;
      }

      const items: OrderItem[] = Array.isArray(existingOrder.items) ? existingOrder.items : [];
      for (const item of items) {
        if (item.id && !item.id.startsWith("item-")) {
          try {
            const { data: currentVariantData } = await (adminClient
              .from("product_variants") as any)
              .select("stock_quantity")
              .eq("id", item.id)
              .single();

            const currentVariant = currentVariantData as { stock_quantity: number } | null;

            if (currentVariant) {
              const oldStock = currentVariant.stock_quantity || 0;
              const newStock = oldStock + item.quantity;

              await (adminClient
                .from("product_variants") as any)
                .update({ stock_quantity: newStock })
                .eq("id", item.id);

              await recordStockMovement({
                variantId: item.id,
                skuCode: item.sku || "SKU",
                productTitle: item.name || "Tooling Item",
                movementType: "RETURN_RESTOCK",
                quantityDelta: item.quantity,
                balanceBefore: oldStock,
                balanceAfter: newStock,
                referenceId: existingOrder.order_number,
                notes: `Customer return restocked: ${updates.return_reason || "Goods returned to warehouse"}`,
              });
            }
          } catch (returnErr) {
            console.warn("Notice restoring stock on return:", returnErr);
          }
        }
      }
    }

    // If cancelled from an active status, restore stock
    if (newStatus === ORDER_STATUSES.CANCELLED && existingOrder.status !== ORDER_STATUSES.CANCELLED) {
      const items: OrderItem[] = Array.isArray(existingOrder.items) ? existingOrder.items : [];
      for (const item of items) {
        if (item.id && !item.id.startsWith("item-")) {
          try {
            const { data: currentVariantData } = await (adminClient
              .from("product_variants") as any)
              .select("stock_quantity")
              .eq("id", item.id)
              .single();

            const currentVariant = currentVariantData as { stock_quantity: number } | null;

            if (currentVariant) {
              const oldStock = currentVariant.stock_quantity || 0;
              const newStock = oldStock + item.quantity;

              await (adminClient
                .from("product_variants") as any)
                .update({ stock_quantity: newStock })
                .eq("id", item.id);

              await recordStockMovement({
                variantId: item.id,
                skuCode: item.sku || "SKU",
                productTitle: item.name || "Tooling Item",
                movementType: "RETURN_RESTOCK",
                quantityDelta: item.quantity,
                balanceBefore: oldStock,
                balanceAfter: newStock,
                referenceId: existingOrder.order_number,
                notes: "Restocked after order cancellation",
              });
            }
          } catch (restoreErr) {
            console.warn("Notice restoring stock on cancellation:", restoreErr);
          }
        }
      }
    }

    const { error: updateError } = await (adminClient
      .from("orders") as any)
      .update(updates)
      .eq("id", orderId);

    if (updateError) {
      return { success: false, error: updateError.message };
    }

    // Notify customer about order status update with friendly messages
    try {
      if (existingOrder.user_id) {
        let notifTitle = `Order Status: ${ORDER_STATUS_CONFIG[newStatus]?.label || newStatus}`;
        let notifMsg = `Order #${existingOrder.order_number} status has been updated to "${ORDER_STATUS_CONFIG[newStatus]?.label || newStatus}".`;

        if (newStatus === ORDER_STATUSES.SHIPPED) {
          notifTitle = "Order Dispatched";
          notifMsg = `Your order #${existingOrder.order_number} has been dispatched.${updates.courier_partner ? ` Transporter: ${updates.courier_partner}` : ""}`;
        } else if (newStatus === ORDER_STATUSES.DELIVERED) {
          notifTitle = "Order Delivered";
          notifMsg = `Your order #${existingOrder.order_number} has been successfully delivered. Tax Invoice: ${updates.invoice_number || existingOrder.invoice_number || "Available in Dashboard"}.`;
        } else if (newStatus === ORDER_STATUSES.RETURNED) {
          notifTitle = "Order Return Processed";
          notifMsg = `Return for order #${existingOrder.order_number} has been verified and restocked into warehouse inventory.`;
        }

        await createNotification({
          userId: existingOrder.user_id,
          title: notifTitle,
          message: notifMsg,
          type: "order",
          link: "/dashboard/orders",
          metadata: { order_id: orderId, order_number: existingOrder.order_number, status: newStatus },
        });
      }
    } catch (notifErr) {
      console.warn("[updateOrderStatus] Notification dispatch error:", notifErr);
    }

    revalidatePath("/dashboard");
    revalidatePath("/dashboard/invoices");
    revalidatePath("/dashboard/orders");
    revalidatePath("/admin/orders");
    revalidatePath("/admin/order-returns");
    revalidatePath("/admin/dispatch");
    revalidatePath("/admin/dashboard");

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || "Failed to update order status." };
  }
}

/**
 * 3. Fetch Master Orders List for Admin
 */
export async function fetchAdminOrdersList(): Promise<Order[]> {
  await requireAdmin();
  const adminClient = createAdminClient();

  try {
    const { data: orders, error } = await (adminClient
      .from("orders") as any)
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

    const { data: orders, error } = await (supabase
      .from("orders") as any)
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
  const supabase = await createClient();

  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { success: false, error: "Please log in to submit a return request." };
    }

    if (!reason || !reason.trim()) {
      return { success: false, error: "Please provide a reason for the return request." };
    }

    const adminClient = createAdminClient();
    const { data: orderData, error: fetchErr } = await (adminClient
      .from("orders") as any)
      .select("*")
      .eq("id", orderId)
      .single();

    const order = orderData as Order | null;
    if (fetchErr || !order) {
      return { success: false, error: "Order not found." };
    }

    if (order.user_id !== user.id) {
      return { success: false, error: "Unauthorized." };
    }

    if (order.status !== ORDER_STATUSES.DELIVERED && order.status !== ORDER_STATUSES.SHIPPED) {
      return { success: false, error: "Only dispatched or delivered orders can be requested for return." };
    }

    // Record return request in return_reason & notes
    const formattedReason = `Return Requested: ${reason.trim()} (Submitted on ${new Date().toLocaleDateString("en-IN")})`;
    const updatedNotes = order.notes ? `${order.notes}\n${formattedReason}` : formattedReason;

    const { error: updateErr } = await (adminClient
      .from("orders") as any)
      .update({
        return_reason: reason.trim(),
        notes: updatedNotes,
        updated_at: new Date().toISOString(),
      })
      .eq("id", orderId);

    if (updateErr) {
      return { success: false, error: updateErr.message };
    }

    // Notify Admin
    try {
      await createNotification({
        role: "admin",
        title: "Order Return Requested",
        message: `Return requested for Order #${order.order_number} by ${order.customer_details?.company_name || "Customer"}: "${reason.trim()}"`,
        type: "order",
        link: "/admin/orders",
        metadata: { order_id: orderId, order_number: order.order_number, reason: reason.trim() },
      });

      // Confirm to customer
      await createNotification({
        userId: user.id,
        title: "Return Request Received",
        message: `Your return request for Order #${order.order_number} has been logged. Our logistics team will review it shortly.`,
        type: "order",
        link: "/dashboard/orders",
        metadata: { order_id: orderId, order_number: order.order_number },
      });
    } catch (notifErr) {
      console.warn("Notification error during return request:", notifErr);
    }

    revalidatePath("/dashboard/orders");
    revalidatePath("/admin/orders");

    return { success: true };
  } catch (err: any) {
    console.error("requestCustomerOrderReturn exception:", err);
    return { success: false, error: err.message || "Failed to process return request." };
  }
}
