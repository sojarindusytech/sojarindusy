"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/auth-guard";
import { PurchaseOrder, PurchaseOrderStatus } from "@/types/database.types";
import { recordStockMovement } from "@/actions/inventory";
import { createNotification } from "@/actions/notification";
import { evaluateReorder } from "@/lib/reorder";
import { revalidatePath } from "next/cache";

/**
 * Next PO number from the DB counter (Sales Settings: prefix / FY / next number).
 * Auto POs must never be lost over numbering, so if the counter is unavailable
 * (e.g. migration not applied) fall back to the old random number and log it.
 */
async function allocatePoNumber(adminDb: ReturnType<typeof createAdminClient>): Promise<string> {
  const { data, error } = await (adminDb as any).rpc("next_po_number");
  if (!error && data) return data as string;
  console.error("[allocatePoNumber] next_po_number failed, using fallback number:", error);
  return `PO-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
}

/**
 * Checks an SKU variant's stock against its trigger_quantity threshold.
 *
 * Fires when currentStock <= trigger_quantity, ordering enough to restock up to
 * min_quantity: order_quantity = min_quantity - trigger_quantity.
 * A trigger_quantity of 0 means auto-ordering is disabled for that SKU.
 * Skipped entirely if an active order (Placed / Dispatched) already exists.
 */
export async function checkAndGeneratePurchaseOrder(
  variantId: string,
  currentStock: number
): Promise<{ created: boolean; order?: PurchaseOrder; reason?: string }> {
  try {
    const adminDb = createAdminClient();

    // 1. Fetch variant and product metadata
    const { data: variantData, error: variantErr } = await (adminDb
      .from("product_variants") as any)
      .select("id, sku, min_quantity, trigger_quantity, specifications, product_id, products(id, title)")
      .eq("id", variantId)
      .single();

    if (variantErr || !variantData) {
      return { created: false, reason: "Variant not found" };
    }

    const targetQty = Number(variantData.min_quantity) || 0;      // restock-up-to level
    const triggerQty = Number(variantData.trigger_quantity) || 0;  // reorder threshold

    const decision = evaluateReorder({
      currentStock,
      minQuantity: targetQty,
      triggerQuantity: triggerQty,
    });

    if (!decision.shouldOrder) {
      if (decision.misconfigured) {
        console.warn(
          `[checkAndGeneratePurchaseOrder] SKU ${variantData.sku}: ${decision.reason}`
        );
      }
      return { created: false, reason: decision.reason };
    }

    // 2. Deduplication check: check if an active (un-received) PO already exists for this variant
    const { data: activeOrders, error: activeErr } = await (adminDb
      .from("purchase_orders") as any)
      .select("id, order_number, status")
      .eq("variant_id", variantId)
      .in("status", ["Placed", "Dispatched / In Transit"])
      .limit(1);

    if (activeErr) {
      console.error("[checkAndGeneratePurchaseOrder] Error checking active orders:", activeErr);
    }

    if (activeOrders && activeOrders.length > 0) {
      return {
        created: false,
        reason: `Active order ${activeOrders[0].order_number} already in progress (${activeOrders[0].status})`,
      };
    }

    // 3. Order quantity, decided above (guaranteed >= 1)
    const orderQuantity = decision.orderQuantity;
    const orderNumber = await allocatePoNumber(adminDb);

    const newPO = {
      order_number: orderNumber,
      variant_id: variantData.id,
      product_id: variantData.product_id,
      sku_code: variantData.sku,
      product_title: variantData.products?.title || "Tooling Product",
      min_quantity: targetQty,
      trigger_quantity: triggerQty,
      actual_quantity: currentStock,
      order_quantity: orderQuantity,
      specifications: variantData.specifications || {},
      status: "Placed",
      placed_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const { data: createdData, error: insertErr } = await (adminDb
      .from("purchase_orders") as any)
      .insert(newPO)
      .select("*")
      .single();

    if (insertErr) {
      console.error("[checkAndGeneratePurchaseOrder] Failed to insert auto PO:", insertErr);
      return { created: false, reason: insertErr.message };
    }

    // Send notifications to Admin and Manufacturer
    try {
      await createNotification({
        role: "admin",
        title: "Low Stock: Auto PO Placed",
        message: `PO #${orderNumber} automatically created for ${variantData.sku} (${orderQuantity} units).`,
        type: "purchase_order",
        link: "/admin/purchase-orders",
        metadata: { order_number: orderNumber, sku: variantData.sku, quantity: orderQuantity },
      });

      await createNotification({
        role: "manufacturer",
        title: "New Production Order",
        message: `New PO #${orderNumber} placed: ${orderQuantity} units of ${newPO.product_title} (${variantData.sku}).`,
        type: "purchase_order",
        link: "/manufacturer",
        metadata: { order_number: orderNumber, sku: variantData.sku, quantity: orderQuantity },
      });
    } catch (notifErr) {
      console.warn("[checkAndGeneratePurchaseOrder] Notification dispatch error:", notifErr);
    }

    revalidatePath("/admin/purchase-orders");
    revalidatePath("/manufacturer");
    revalidatePath("/admin/products");

    return { created: true, order: createdData as PurchaseOrder };
  } catch (err: any) {
    console.error("[checkAndGeneratePurchaseOrder] Exception:", err);
    return { created: false, reason: err.message };
  }
}

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
  try {
    await requireAdmin();
    const adminDb = createAdminClient();

    const quantity = Math.floor(Number(payload.quantity));
    if (!Number.isFinite(quantity) || quantity < 1) return { success: false, error: "Quantity must be at least 1." };

    const manualNumber = payload.manualNumber?.trim() || null;
    if (manualNumber && manualNumber.length > 50) return { success: false, error: "PO number is too long." };

    const { data: variantData, error: variantErr } = await (adminDb.from("product_variants") as any)
      .select("id, sku, min_quantity, trigger_quantity, stock_quantity, specifications, product_id, products(id, title)")
      .eq("id", payload.variantId)
      .single();
    if (variantErr || !variantData) return { success: false, error: "SKU not found." };

    let orderNumber: string;
    if (manualNumber) {
      const { data: dup } = await (adminDb.from("purchase_orders") as any)
        .select("id")
        .eq("order_number", manualNumber)
        .maybeSingle();
      if (dup) return { success: false, error: `PO number "${manualNumber}" already exists.` };
      orderNumber = manualNumber;
    } else {
      orderNumber = await allocatePoNumber(adminDb);
    }

    const now = new Date().toISOString();
    const { data: created, error: insertErr } = await (adminDb.from("purchase_orders") as any)
      .insert({
        order_number: orderNumber,
        variant_id: variantData.id,
        product_id: variantData.product_id,
        sku_code: variantData.sku,
        product_title: variantData.products?.title || "Tooling Product",
        min_quantity: Number(variantData.min_quantity) || 0,
        trigger_quantity: Number(variantData.trigger_quantity) || 0,
        actual_quantity: Number(variantData.stock_quantity) || 0,
        order_quantity: quantity,
        specifications: variantData.specifications || {},
        notes: payload.notes?.trim() || null,
        status: "Placed",
        placed_at: now,
        created_at: now,
        updated_at: now,
      })
      .select("*")
      .single();

    if (insertErr) {
      if (insertErr.code === "23505") return { success: false, error: `PO number "${orderNumber}" already exists.` };
      console.error("[createManualPurchaseOrder] insert failed:", insertErr);
      return { success: false, error: insertErr.message };
    }

    try {
      const meta = { order_number: orderNumber, sku: variantData.sku, quantity };
      await createNotification({
        role: "manufacturer",
        title: "New Production Order",
        message: `New PO #${orderNumber} placed: ${quantity} units of ${variantData.products?.title || "product"} (${variantData.sku}).`,
        type: "purchase_order",
        link: "/manufacturer",
        metadata: meta,
      });
    } catch (notifErr) {
      console.warn("[createManualPurchaseOrder] Notification dispatch error:", notifErr);
    }

    revalidatePath("/admin/purchase-orders");
    revalidatePath("/manufacturer");
    return { success: true, order: created as PurchaseOrder };
  } catch (err) {
    console.error("[createManualPurchaseOrder] Exception:", err);
    return { success: false, error: err instanceof Error ? err.message : "Failed to create purchase order." };
  }
}

/**
 * Fetch list of purchase orders with optional filtering for Active vs Past
 */
export async function getPurchaseOrders(params?: {
  isPast?: boolean;
  status?: PurchaseOrderStatus;
  search?: string;
}): Promise<PurchaseOrder[]> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return [];
    }

    const adminDb = createAdminClient();
    let query = (adminDb.from("purchase_orders") as any)
      .select(`
        *,
        product:products(id, title, slug),
        variant:product_variants(id, sku, diameter, flute_length, overall_length, shank_diameter, stock_quantity, min_quantity, trigger_quantity, min_order_quantity)
      `)
      .order("created_at", { ascending: false });

    if (params?.isPast === true) {
      query = query.eq("status", "Received");
    } else if (params?.isPast === false) {
      query = query.in("status", ["Placed", "Dispatched / In Transit"]);
    } else if (params?.status) {
      query = query.eq("status", params.status);
    }

    const { data, error } = await query;
    if (error) {
      console.error("[getPurchaseOrders] Query error:", error);
      return [];
    }

    let orders = (data || []) as PurchaseOrder[];

    if (params?.search && params.search.trim()) {
      const term = params.search.toLowerCase().trim();
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
 * Update Purchase Order status.
 * Marking as 'Received' automatically increments SKU stock and records in inventory_logs.
 */
export async function updatePurchaseOrderStatus(
  orderId: string,
  newStatus: PurchaseOrderStatus,
  notes?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    await requireAdmin();
    const adminDb = createAdminClient();

    // 1. Fetch existing PO
    const { data: existingOrderData, error: fetchErr } = await (adminDb
      .from("purchase_orders") as any)
      .select("*")
      .eq("id", orderId)
      .single();

    if (fetchErr || !existingOrderData) {
      return { success: false, error: "Purchase order not found." };
    }

    const existingPO = existingOrderData as PurchaseOrder;

    const updates: any = {
      status: newStatus,
      updated_at: new Date().toISOString(),
    };

    if (notes !== undefined) {
      updates.notes = notes;
    }

    if (newStatus === "Dispatched / In Transit" && !existingPO.dispatched_at) {
      updates.dispatched_at = new Date().toISOString();
    }

    // 2. If transitioning to 'Received', credit SKU stock and write inventory audit log
    if (newStatus === "Received" && existingPO.status !== "Received") {
      updates.received_at = new Date().toISOString();

      // Fetch current stock
      const { data: variantData, error: varFetchErr } = await (adminDb
        .from("product_variants") as any)
        .select("id, sku, stock_quantity, product_id, products(id, title)")
        .eq("id", existingPO.variant_id)
        .single();

      if (!varFetchErr && variantData) {
        const currentStock = Number(variantData.stock_quantity) || 0;
        const newStock = currentStock + existingPO.order_quantity;

        // Update SKU stock
        const { error: stockUpdErr } = await (adminDb
          .from("product_variants") as any)
          .update({
            stock_quantity: newStock,
            updated_at: new Date().toISOString(),
          })
          .eq("id", existingPO.variant_id);

        if (stockUpdErr) {
          return { success: false, error: `Failed to increment stock: ${stockUpdErr.message}` };
        }

        // Record stock movement
        await recordStockMovement({
          variantId: existingPO.variant_id,
          productId: existingPO.product_id,
          skuCode: existingPO.sku_code,
          productTitle: existingPO.product_title,
          movementType: "RESTOCK",
          quantityDelta: existingPO.order_quantity,
          balanceBefore: currentStock,
          balanceAfter: newStock,
          referenceId: existingPO.order_number,
          notes: notes ? `Auto PO Receipt: ${notes}` : `Auto Purchase Order ${existingPO.order_number} received from Manufacturer`,
        });
      }
    }

    // 3. Update the purchase order record
    const { error: updateErr } = await (adminDb
      .from("purchase_orders") as any)
      .update(updates)
      .eq("id", orderId);

    if (updateErr) {
      return { success: false, error: updateErr.message };
    }

    // Send notifications on status change
    try {
      if (newStatus === "Received") {
        await createNotification({
          role: "admin",
          title: "PO Restocked & Received",
          message: `PO #${existingPO.order_number} received. ${existingPO.order_quantity} units credited into SKU ${existingPO.sku_code} stock.`,
          type: "inventory",
          link: "/admin/purchase-orders",
          metadata: { order_number: existingPO.order_number, quantity: existingPO.order_quantity },
        });

        await createNotification({
          role: "manufacturer",
          title: "PO Received by Sojar",
          message: `Sojar Indusy has verified and received delivery of PO #${existingPO.order_number}.`,
          type: "purchase_order",
          link: "/manufacturer",
          metadata: { order_number: existingPO.order_number },
        });
      } else if (newStatus === "Dispatched / In Transit") {
        await createNotification({
          role: "admin",
          title: "PO In Transit",
          message: `PO #${existingPO.order_number} marked Dispatched / In Transit.`,
          type: "purchase_order",
          link: "/admin/purchase-orders",
          metadata: { order_number: existingPO.order_number },
        });
      }
    } catch (notifErr) {
      console.warn("[updatePurchaseOrderStatus] Notification dispatch error:", notifErr);
    }

    revalidatePath("/admin/purchase-orders");
    revalidatePath("/manufacturer");
    revalidatePath("/admin/products");

    return { success: true };
  } catch (err: any) {
    console.error("[updatePurchaseOrderStatus] Exception:", err);
    return { success: false, error: err.message || "Failed to update order status." };
  }
}
