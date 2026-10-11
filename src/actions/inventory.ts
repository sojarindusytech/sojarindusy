"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/auth-guard";
import { adjustVariantStock as adjustVariantStockRpc } from "@/lib/server/rpc";
import { checkAndGeneratePurchaseOrder } from "@/lib/server/purchase-orders";
import { InventoryLog } from "@/types/database.types";
import { revalidatePath } from "next/cache";

// Writing to the stock ledger is server-only: see src/lib/server/inventory.ts.

/**
 * Fetch all stock audit logs for a specific SKU variant
 */
export async function fetchVariantStockLogs(variantId: string): Promise<InventoryLog[]> {
  await requireAdmin();
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
  await requireAdmin();
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
 * Adjust stock manually for a single SKU variant with reason & reference.
 *
 * The read, the change and the ledger entry happen in one locked database
 * step, so two admins adjusting the same SKU at once cannot overwrite each
 * other's change.
 */
export async function adjustVariantStock(
  params: AdjustStockParams
): Promise<{ success?: boolean; error?: string; updatedStock?: number }> {
  const { userId } = await requireAdmin();

  const quantity = Math.floor(Number(params.quantity));
  if (!Number.isFinite(quantity) || quantity < 0) {
    return { error: "Quantity must be zero or a positive whole number." };
  }

  const notes = params.notes?.trim() ? `${params.reason}: ${params.notes.trim()}` : params.reason;

  const { data, error } = await adjustVariantStockRpc({
    variantId: params.variantId,
    mode: params.mode,
    quantity,
    movementType: "MANUAL_ADJUSTMENT",
    reference: params.referenceId?.trim() || null,
    notes,
    actorId: userId,
  });

  if (error) {
    if (error.code === "VARIANT_NOT_FOUND") return { error: "SKU variant not found." };
    return { error: "Failed to update stock. Please try again." };
  }

  if (data.balance_after !== data.balance_before) {
    // Auto-generate a Purchase Order if stock fell to or below trigger_quantity.
    await checkAndGeneratePurchaseOrder(data.variant_id, data.balance_after);
  }

  revalidatePath("/admin/products");
  return { success: true, updatedStock: data.balance_after };
}
