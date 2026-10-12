import "server-only";
import type { OrderTotals } from "@/lib/pricing";
import { gstModeOf, type GstMode } from "@/lib/order-pricing";
import { loadPricedCart, type CartLineInput, type PriceChange } from "@/lib/server/checkout/cart";
import { loadCustomerState, loadOrderTaxBasis, priceCart } from "@/lib/server/checkout/pricing";
import { resolveCoupon } from "@/lib/server/coupons/checkout";

export interface CheckoutPreview {
  /** Totals from current catalogue prices and GST rules, with the coupon applied when valid. */
  totals: OrderTotals;
  /** How the GST line is labelled: CGST + SGST, IGST, or none (GST billing off). */
  gstMode: GstMode;
  coupon: {
    code: string;
    description: string | null;
    discountType: "percent" | "fixed";
    discountValue: number;
    discount: number;
    eligibleSubtotal: number;
  } | null;
  /** Set when a code was given but cannot be used. */
  couponError: { code: string; message: string } | null;
  priceChanges: PriceChange[];
  unavailable: string[];
}

/** The most lines a preview or an order may have. */
export const MAX_CHECKOUT_LINES = 200;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Keeps well-formed lines from a browser-supplied cart. */
export function sanitizePreviewItems(
  items: { variantId: string; quantity: number; unitPrice: number }[] | null | undefined
): CartLineInput[] {
  return (items ?? [])
    .filter(
      (i) =>
        typeof i?.variantId === "string" &&
        UUID_PATTERN.test(i.variantId) &&
        Number.isInteger(i.quantity) &&
        i.quantity > 0 &&
        i.quantity <= 100_000
    )
    .map((i) => ({ variantId: i.variantId, quantity: i.quantity, unitPrice: Number(i.unitPrice) || 0 }));
}

/**
 * What the order would cost right now, priced exactly as place_order will
 * store it. Read-only: nothing is reserved or counted, so the coupon is
 * checked again (under a lock) when the order is placed.
 *
 * Throws when Sales Settings can't be read (the tax can't be worked out).
 */
export async function previewCheckout(params: {
  userId: string;
  items: CartLineInput[];
  couponCode?: string | null;
}): Promise<CheckoutPreview> {
  const [cart, customerState] = await Promise.all([loadPricedCart(params.items), loadCustomerState(params.userId)]);
  const basis = await loadOrderTaxBasis(customerState);
  if (!basis) throw new Error("Sales settings are unavailable; cannot work out GST.");

  const withoutCoupon = priceCart(cart, basis, null);
  const preview: CheckoutPreview = {
    totals: withoutCoupon.totals,
    gstMode: gstModeOf(withoutCoupon.tax) ?? "cgst_sgst",
    coupon: null,
    couponError: null,
    priceChanges: cart.priceChanges,
    unavailable: cart.unavailable,
  };

  if (!params.couponCode?.trim()) return preview;

  const resolved = await resolveCoupon({ userId: params.userId, rawCode: params.couponCode, cart });
  if (!resolved.ok) {
    preview.couponError = { code: resolved.code, message: resolved.message };
    return preview;
  }

  const priced = priceCart(cart, basis, resolved);
  preview.totals = priced.totals;
  preview.coupon = {
    code: resolved.coupon.code,
    description: resolved.coupon.description,
    discountType: resolved.coupon.discountType,
    discountValue: resolved.coupon.discountValue,
    discount: priced.totals.discount,
    eligibleSubtotal: resolved.eligibleSubtotal,
  };
  return preview;
}
