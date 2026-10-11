"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { guardOrError, requireAdmin, requireAdminOrManufacturer } from "@/lib/auth-guard";
import { receivePurchaseOrder } from "@/lib/server/rpc";
import { allocatePoNumber } from "@/lib/server/purchase-orders";
import { notifyAll } from "@/lib/server/notifications";
import { PurchaseOrder, PurchaseOrderStatus } from "@/types/database.types";
import { revalidatePath } from "next/cache";

// Auto-generating purchase orders is server-only: see src/lib/server/purchase-orders.ts.

const OPEN_STATUSES: PurchaseOrderStatus[] = ["Placed", "Dispatched / In Transit"];

/**
 * Place a purchase order by hand (not triggered by low stock). The PO number is
 * the next one from Sales Settings unless `manualNumber` is given, in which case
 * it is checked for duplicates and does not move the counter.
 */
export async function createManualPurchaseOrder(payload: {
  variantId: string;
  quantity: number;
  notes?: string | null;
  manualNumber?: string | null;
}): Promise<{ success: boolean; error?: string; order?: PurchaseOrder }> {
  const guard = await guardOrError(requireAdmin);
  if (!guard.ctx) return { success: false, error: guard.error };

  try {
    const adminDb = createAdminClient();

    const quantity = Math.floor(Number(payload.quantity));
    if (!Number.isFinite(quantity) || quantity < 1) return { success: false, error: "Quantity must be at least 1." };
    if (quantity > 10_000_000) return { success: false, error: "Quantity is too large." };

    const manualNumber = payload.manualNumber?.trim() || null;
    if (manualNumber && manualNumber.length > 50) return { success: false, error: "PO number is too long." };
    if ((payload.notes?.length ?? 0) > 2000) return { success: false, error: "Notes are too long." };

    const { data: variantData, error: variantErr } = await adminDb
      .from("product_variants")
      .select("id, sku, min_quantity, trigger_quantity, stock_quantity, specifications, product_id, products(id, title)")
      .eq("id", payload.variantId)
      .single();
    if (variantErr || !variantData) return { success: false, error: "SKU not found." };
    const variant = variantData as unknown as {
      id: string;
      sku: string;
      min_quantity: number | null;
      trigger_quantity: number | null;
      stock_quantity: number | null;
      specifications: Record<string, unknown> | null;
      product_id: string;
      products: { id: string; title: string } | null;
    };

    let orderNumber: string;
    if (manualNumber) {
      const { data: dup } = await adminDb
        .from("purchase_orders" as never)
        .select("id")
        .eq("order_number", manualNumber)
        .maybeSingle();
      if (dup) return { success: false, error: `PO number "${manualNumber}" already exists.` };
      orderNumber = manualNumber;
    } else {
      const allocated = await allocatePoNumber();
      if (!allocated) return { success: false, error: "Could not number the purchase order. Please try again." };
      orderNumber = allocated;
    }

    const productTitle = variant.products?.title || "Tooling Product";
    const { data: created, error: insertErr } = await adminDb
      .from("purchase_orders" as never)
      .insert({
        order_number: orderNumber,
        variant_id: variant.id,
        product_id: variant.product_id,
        sku_code: variant.sku,
        product_title: productTitle,
        min_quantity: Number(variant.min_quantity) || 0,
        trigger_quantity: Number(variant.trigger_quantity) || 0,
        actual_quantity: Number(variant.stock_quantity) || 0,
        order_quantity: quantity,
        specifications: variant.specifications || {},
        notes: payload.notes?.trim() || null,
        status: "Placed",
        is_auto: false,
      } as never)
      .select("*")
      .single();

    if (insertErr) {
      if (insertErr.code === "23505") return { success: false, error: `PO number "${orderNumber}" already exists.` };
      console.error("[createManualPurchaseOrder] insert failed:", insertErr.message);
      return { success: false, error: "Could not create the purchase order." };
    }

    await notifyAll([
      {
        role: "manufacturer",
        title: "New Production Order",
        message: `New PO #${orderNumber} placed: ${quantity} units of ${productTitle} (${variant.sku}).`,
        type: "purchase_order",
        link: "/manufacturer",
        metadata: { order_number: orderNumber, sku: variant.sku, quantity },
      },
    ]);

    revalidatePath("/admin/purchase-orders");
    revalidatePath("/manufacturer");
    return { success: true, order: created as unknown as PurchaseOrder };
  } catch (err) {
    console.error("[createManualPurchaseOrder] Exception:", err);
    return { success: false, error: "Failed to create purchase order." };
  }
}

/**
 * Fetch purchase orders, optionally only open (isPast=false) or received (isPast=true).
 * Visible to administrators and the manufacturer only.
 */
export async function getPurchaseOrders(params?: {
  isPast?: boolean;
  status?: PurchaseOrderStatus;
  search?: string;
}): Promise<PurchaseOrder[]> {
  const guard = await guardOrError(requireAdminOrManufacturer);
  if (!guard.ctx) return [];

  try {
    let query = createAdminClient()
      .from("purchase_orders" as never)
      .select(`
        *,
        product:products(id, title, slug),
        variant:product_variants(id, sku, diameter, flute_length, overall_length, shank_diameter, stock_quantity, min_quantity, trigger_quantity, min_order_quantity)
      `)
      .order("created_at", { ascending: false });

    if (params?.isPast === true) {
      query = query.eq("status", "Received");
    } else if (params?.isPast === false) {
      query = query.in("status", OPEN_STATUSES);
    } else if (params?.status) {
      query = query.eq("status", params.status);
    }

    const { data, error } = await query;
    if (error) {
      console.error("[getPurchaseOrders] Query error:", error.message);
      return [];
    }

    let orders = (data || []) as unknown as PurchaseOrder[];

    const term = params?.search?.toLowerCase().trim();
    if (term) {
      orders = orders.filter(
        (o) =>
          o.order_number?.toLowerCase().includes(term) ||
          o.sku_code?.toLowerCase().includes(term) ||
          o.product_title?.toLowerCase().includes(term)
      );
    }

    return orders;
  } catch (err) {
    console.error("[getPurchaseOrders] Exception:", err);
    return [];
  }
}

/**
 * Update a purchase order's status.
 *   Placed -> Dispatched / In Transit -> Received
 * Marking it Received credits the SKU's stock exactly once, inside one locked
 * database step, even if two admins click at the same time.
 */
export async function updatePurchaseOrderStatus(
  orderId: string,
  newStatus: PurchaseOrderStatus,
  notes?: string
): Promise<{ success: boolean; error?: string }> {
  const guard = await guardOrError(requireAdmin);
  if (!guard.ctx) return { success: false, error: guard.error };
  const actorId = guard.ctx.userId;

  try {
    if (newStatus === "Received") {
      const { data, error } = await receivePurchaseOrder(orderId, notes?.trim() || null, actorId);
      if (error) {
        return {
          success: false,
          error: error.code === "PO_NOT_FOUND" ? "Purchase order not found." : "Could not receive the purchase order.",
        };
      }
      if (data.already_received) {
        return { success: false, error: `PO ${data.order_number} was already received.` };
      }

      await notifyAll([
        {
          role: "admin",
          title: "PO Restocked & Received",
          message: `PO #${data.order_number} received. ${data.quantity} units credited into SKU ${data.sku} stock.`,
          type: "inventory",
          link: "/admin/purchase-orders",
          metadata: { order_number: data.order_number, quantity: data.quantity },
        },
        {
          role: "manufacturer",
          title: "PO Received by Sojar",
          message: `Sojar Indusy has verified and received delivery of PO #${data.order_number}.`,
          type: "purchase_order",
          link: "/manufacturer",
          metadata: { order_number: data.order_number },
        },
      ]);
    } else if (newStatus === "Dispatched / In Transit") {
      const now = new Date().toISOString();
      const { data, error } = await createAdminClient()
        .from("purchase_orders" as never)
        .update({
          status: newStatus,
          dispatched_at: now,
          updated_at: now,
          ...(notes !== undefined ? { notes } : {}),
        } as never)
        .eq("id", orderId)
        .eq("status", "Placed") // only from Placed: never re-open a received PO
        .select("order_number");

      if (error) return { success: false, error: "Could not update the purchase order." };
      const rows = (data || []) as unknown as { order_number: string }[];
      if (rows.length === 0) {
        return { success: false, error: "Only a placed purchase order can be marked dispatched." };
      }

      await notifyAll([
        {
          role: "admin",
          title: "PO In Transit",
          message: `PO #${rows[0].order_number} marked Dispatched / In Transit.`,
          type: "purchase_order",
          link: "/admin/purchase-orders",
          metadata: { order_number: rows[0].order_number },
        },
      ]);
    } else {
      return { success: false, error: "A purchase order cannot be moved back to Placed." };
    }

    revalidatePath("/admin/purchase-orders");
    revalidatePath("/manufacturer");
    revalidatePath("/admin/products");
    return { success: true };
  } catch (err) {
    console.error("[updatePurchaseOrderStatus] Exception:", err);
    return { success: false, error: "Failed to update order status." };
  }
}
