/**
 * Auto purchase-order reorder decision.
 *
 * Pure and dependency-free so it can be unit-tested without a database;
 * `checkAndGeneratePurchaseOrder` wraps it with the Supabase reads/writes.
 */

export interface ReorderInput {
  /** Current stock on hand for the SKU variant. */
  currentStock: number;
  /** Minimum SKU Quantity: the target level to restock up to. */
  minQuantity: number;
  /** Trigger Quantity: fire at or below this. 0 disables auto-ordering. */
  triggerQuantity: number;
}

export type ReorderDecision =
  | { shouldOrder: true; orderQuantity: number }
  | { shouldOrder: false; reason: string; misconfigured?: boolean };

export function evaluateReorder({
  currentStock,
  minQuantity,
  triggerQuantity,
}: ReorderInput): ReorderDecision {
  const target = Number(minQuantity) || 0;
  const trigger = Number(triggerQuantity) || 0;

  if (trigger <= 0) {
    return { shouldOrder: false, reason: "Auto-ordering disabled (trigger quantity is 0)" };
  }

  if (currentStock > trigger) {
    return { shouldOrder: false, reason: "Stock is above the trigger quantity" };
  }

  // Subtraction would yield zero or negative. Skip rather than clamp to 1: a
  // bogus 1-unit PO is a real manufacturing job, and the caller's dedup check
  // would then block the correct PO until someone marks the bogus one received.
  if (target <= trigger) {
    return {
      shouldOrder: false,
      misconfigured: true,
      reason: `Misconfigured: Minimum SKU Quantity (${target}) must exceed Trigger Quantity (${trigger})`,
    };
  }

  return { shouldOrder: true, orderQuantity: target - trigger };
}
