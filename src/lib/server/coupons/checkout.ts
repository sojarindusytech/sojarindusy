import "server-only";
import { evaluateCoupon, type CouponRules } from "@/lib/coupons/engine";
import { toCouponRules, toCustomerContext } from "@/lib/coupons/mapping";
import { couponMessage } from "@/lib/coupons/messages";
import { COUPON_CODE_PATTERN } from "@/lib/coupons/schema";
import { getCouponCheckoutContext } from "@/lib/server/rpc";
import { isCouponEntryLocked, recordFailedCouponAttempt } from "@/lib/server/coupons/rate-limit";
import type { PricedCart } from "@/lib/server/checkout/cart";

export type ResolvedCoupon =
  | {
      ok: true;
      coupon: CouponRules;
      discount: number;
      eligibleSubtotal: number;
      /** Per cart line (same order as cart.lines): whether the coupon applies to it. */
      eligibleLines: boolean[];
    }
  | { ok: false; code: string; message: string };

/** Trims and upper-cases what the customer typed; null when it can't be a code. */
export function normalizeCouponCode(raw: string | null | undefined): string | null {
  const code = (raw ?? "").trim().toUpperCase();
  return COUPON_CODE_PATTERN.test(code) ? code : null;
}

/**
 * Decides whether `rawCode` applies to this customer's priced cart, and the
 * discount. Used by both "Apply" (preview) and order placement, so the
 * customer sees exactly the discount the order will get.
 */
export async function resolveCoupon(params: {
  userId: string;
  rawCode: string;
  cart: PricedCart;
  now?: Date;
}): Promise<ResolvedCoupon> {
  const { userId, rawCode, cart } = params;
  const fail = (code: string, message = couponMessage(code)): ResolvedCoupon => ({ ok: false, code, message });

  if (!rawCode?.trim()) return fail("COUPON_CODE_REQUIRED");
  if (await isCouponEntryLocked(userId)) return fail("COUPON_RATE_LIMITED");

  const code = normalizeCouponCode(rawCode);
  if (!code) {
    await recordFailedCouponAttempt(userId, rawCode);
    return fail("COUPON_INVALID");
  }

  const { data: context, error } = await getCouponCheckoutContext(code, userId);
  if (error) return fail("COUPON_UNAVAILABLE", "Coupons are unavailable right now. Please try again shortly.");
  if (!context) {
    await recordFailedCouponAttempt(userId, code);
    return fail("COUPON_INVALID");
  }

  const coupon = toCouponRules(context.coupon);
  const customerContext = toCustomerContext(context);
  if (!customerContext.customerAllowed) {
    // Same answer as an unknown code: a private coupon is never confirmed to exist.
    await recordFailedCouponAttempt(userId, code);
  }

  const result = evaluateCoupon({
    coupon,
    context: customerContext,
    lines: cart.lines.map((l) => ({ productId: l.productId, categoryIds: l.categoryIds, lineTotal: l.lineTotal })),
    now: params.now ?? new Date(),
  });

  if (!result.ok) return fail(result.rejection.code, couponMessage(result.rejection.code, result.rejection));
  return {
    ok: true,
    coupon,
    discount: result.discount,
    eligibleSubtotal: result.eligibleSubtotal,
    eligibleLines: result.eligibleLines,
  };
}
