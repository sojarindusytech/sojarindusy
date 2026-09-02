"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { Order, OrderItem, CustomerOrderDetails, Profile } from "@/types/database.types";
import { OrderStatus, ORDER_STATUSES } from "@/lib/constants";
import { recordStockMovement } from "@/actions/inventory";
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

  // 1. Get authenticated user
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: "Please log in to place an industrial purchase order." };
  }

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
        }
      } catch (stockErr) {
        console.warn(`Notice updating variant ${item.variantId} stock:`, stockErr);
      }
    }
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

    revalidatePath("/dashboard");
    revalidatePath("/dashboard/invoices");
    revalidatePath("/dashboard/orders");
    revalidatePath("/admin/orders");
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
