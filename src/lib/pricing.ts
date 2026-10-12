/**
 * Order money rules, shared by the cart (browser) and the server.
 *
 * The database function place_order() computes the stored totals; these
 * helpers produce the same numbers for display before the order is placed.
 */

/** Standard GST on industrial tooling. */
export const GST_RATE = 0.18;

/** Rounds to paise, half away from zero (matches Postgres round(numeric, 2)). */
export function roundMoney(value: number): number {
  const sign = value < 0 ? -1 : 1;
  return (sign * Math.round((Math.abs(value) + Number.EPSILON) * 100)) / 100;
}

export interface OrderTotals {
  subtotal: number;
  discount: number;
  /** subtotal - discount: the amount GST is charged on. */
  taxable: number;
  gst: number;
  total: number;
}

/** A discount is taken off the subtotal before GST, as on an Indian tax invoice. */
export function computeOrderTotals(subtotal: number, discount = 0): OrderTotals {
  const safeSubtotal = roundMoney(Math.max(0, subtotal));
  const safeDiscount = roundMoney(Math.min(Math.max(0, discount), safeSubtotal));
  const taxable = roundMoney(safeSubtotal - safeDiscount);
  const gst = roundMoney(taxable * GST_RATE);
  return {
    subtotal: safeSubtotal,
    discount: safeDiscount,
    taxable,
    gst,
    total: roundMoney(taxable + gst),
  };
}

const inr = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", minimumFractionDigits: 2 });

/** ₹1,23,456.00 */
export function formatInr(value: number): string {
  return inr.format(value);
}
