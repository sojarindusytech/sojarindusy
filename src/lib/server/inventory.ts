import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type { InventoryMovementType } from "@/types/database.types";

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
 * Appends a movement to the stock ledger (inventory_logs).
 *
 * Used by catalogue imports and SKU edits. Order placement, cancellations,
 * returns, manual adjustments and PO receipts log their movements inside
 * their own database transaction instead (see src/lib/server/rpc.ts).
 *
 * Server-only: as an exported Server Action this was a public endpoint that
 * let anyone write fake entries into the stock ledger.
 */
export async function recordStockMovement(params: RecordMovementParams): Promise<boolean> {
  try {
    const { error } = await createAdminClient()
      .from("inventory_logs" as never)
      .insert({
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
      console.warn("Failed to record inventory log:", error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.warn("Exception recording inventory log:", err);
    return false;
  }
}
