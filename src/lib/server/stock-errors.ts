import "server-only";
import type { DbAppError } from "@/lib/server/db-error";

const num = (v: unknown): number => (typeof v === "number" ? v : Number(v) || 0);

/**
 * Customer-/admin-facing text for the stock errors raised by the 20261017
 * functions, or null when the error is not a stock error.
 */
export function stockErrorMessage(error: DbAppError): string | null {
  const d = error.detail;
  if (error.code === "INSUFFICIENT_STOCK") {
    const sku = String(d.sku ?? "this SKU");
    const available = num(d.available ?? d.on_hand);
    return `Not enough stock for ${sku}: ${num(d.required)} needed, ${available} available (short by ${num(d.short)}). Receive the purchase order or adjust stock first.`;
  }
  if (error.code === "BELOW_RESERVED") {
    return `${String(d.sku ?? "This SKU")} has ${num(d.reserved)} units reserved for open orders, so stock cannot be set below that.`;
  }
  return null;
}

/** Readable list for the pre-check result of check_invoice_stock. */
export function shortageMessage(short: { sku: string; required: number; available: number }[]): string {
  const parts = short.map((s) => `${s.sku} (need ${s.required}, available ${s.available})`);
  return `Not enough stock for ${parts.join(", ")}. Receive stock first, or reduce the quantity.`;
}
