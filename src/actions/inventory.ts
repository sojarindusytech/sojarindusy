"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { InventoryLog, InventoryMovementType } from "@/types/database.types";
import { revalidatePath } from "next/cache";

export interface RecordMovementParams {
  variantId?: string | null;
  productId?: string | null;
  skuCode: string;
  productTitle: string;
  movementType: InventoryMovementType;
  quantityDelta: number;
  balanceBefore: number;
  balanceAfter: number;
  referenceId?: string | null;
  notes?: string | null;
  createdBy?: string | null;
}

/**
 * Record an immutable inventory movement in the stock ledger
 */
export async function recordStockMovement(params: RecordMovementParams): Promise<boolean> {
  const supabase = createAdminClient();

  try {
    const { error } = await supabase.from("inventory_logs").insert({
      variant_id: params.variantId || null,
      product_id: params.productId || null,
      sku_code: params.skuCode,
      product_title: params.productTitle,
      movement_type: params.movementType,
      quantity_delta: params.quantityDelta,
      balance_before: params.balanceBefore,
      balance_after: params.balanceAfter,
      reference_id: params.referenceId || null,
      notes: params.notes || null,
      created_by: params.createdBy || null,
    } as never);

    if (error) {
      console.warn("Failed to record inventory log (table might not exist yet):", error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.warn("Exception recording inventory log:", err);
    return false;
  }
}

/**
 * Fetch all stock audit logs for a specific SKU variant
 */
export async function fetchVariantStockLogs(variantId: string): Promise<InventoryLog[]> {
  const supabase = createAdminClient();

  try {
    const { data, error } = await supabase
      .from("inventory_logs")
      .select("*")
      .eq("variant_id", variantId)
      .order("created_at", { ascending: false });

    if (error) {
      console.warn("Error fetching variant stock logs:", error.message);
      return [];
    }
    return (data || []) as unknown as InventoryLog[];
  } catch (err) {
    console.error("Exception fetching variant stock logs:", err);
    return [];
  }
}

/**
 * Fetch global stock ledger logs (with optional pagination)
 */
export async function fetchGlobalInventoryLogs(limit = 100): Promise<InventoryLog[]> {
  const supabase = createAdminClient();

  try {
    const { data, error } = await supabase
      .from("inventory_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) {
      console.warn("Error fetching global inventory logs:", error.message);
      return [];
    }
    return (data || []) as unknown as InventoryLog[];
  } catch (err) {
    console.error("Exception fetching global inventory logs:", err);
    return [];
  }
}

export interface AdjustStockParams {
  variantId: string;
  mode: "ADD" | "SUBTRACT" | "SET";
  quantity: number;
  reason: string;
  referenceId?: string;
  notes?: string;
}

/**
 * Adjust stock manually for a single SKU variant with reason & reference
 */
export async function adjustVariantStock(
  params: AdjustStockParams
): Promise<{ success?: boolean; error?: string; updatedStock?: number }> {
  const supabase = createAdminClient();

  try {
    // 1. Fetch current variant and product title
    const { data: variantData, error: fetchErr } = await supabase
      .from("product_variants")
      .select("id, sku, stock_quantity, product_id, products(id, title)")
      .eq("id", params.variantId)
      .single();

    const variant = variantData as any;
    if (fetchErr || !variant) {
      return { error: "SKU variant not found." };
    }

    const currentStock = Number(variant.stock_quantity) || 0;
    const qty = Math.max(0, Number(params.quantity) || 0);

    let targetStock = currentStock;
    if (params.mode === "ADD") {
      targetStock = currentStock + qty;
    } else if (params.mode === "SUBTRACT") {
      targetStock = Math.max(0, currentStock - qty);
    } else if (params.mode === "SET") {
      targetStock = qty;
    }

    const delta = targetStock - currentStock;

    if (delta === 0) {
      return { success: true, updatedStock: currentStock };
    }

    // 2. Update stock quantity
    const { error: updateErr } = await supabase
      .from("product_variants")
      .update({
        stock_quantity: targetStock,
        updated_at: new Date().toISOString(),
      } as never)
      .eq("id", params.variantId);

    if (updateErr) {
      return { error: updateErr.message || "Failed to update stock." };
    }

    // 3. Record in inventory_logs
    const productTitle = variant.products?.title || "Product";
    const movementReason = params.notes
      ? `${params.reason}: ${params.notes.trim()}`
      : params.reason;

    await recordStockMovement({
      variantId: variant.id,
      productId: variant.product_id,
      skuCode: variant.sku,
      productTitle,
      movementType: "MANUAL_ADJUSTMENT",
      quantityDelta: delta,
      balanceBefore: currentStock,
      balanceAfter: targetStock,
      referenceId: params.referenceId?.trim() || null,
      notes: movementReason,
    });

    revalidatePath("/admin/products");
    return { success: true, updatedStock: targetStock };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to adjust stock." };
  }
}
