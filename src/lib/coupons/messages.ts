import { formatInr } from "@/lib/pricing";
import { formatIstDate } from "@/lib/coupons/dates";
import type { CouponRejection } from "@/lib/coupons/engine";

/**
 * What the customer reads when a coupon can't be used. Codes come from the
 * coupon engine (on Apply) or from place_order() (when the order is placed).
 */
const STATIC_MESSAGES: Record<string, string> = {
  COUPON_INVALID: "This coupon code isn't valid.",
  COUPON_NOT_STARTED: "This coupon isn't active yet.",
  COUPON_EXPIRED: "This coupon has expired.",
  COUPON_LIMIT_REACHED: "This coupon has reached its usage limit.",
  COUPON_CUSTOMER_LIMIT_REACHED: "You've already used this coupon the maximum number of times.",
  COUPON_FIRST_ORDER_ONLY: "This coupon is only valid on your first order.",
  COUPON_MIN_ORDER_NOT_MET: "Your order is below this coupon's minimum value.",
  COUPON_NOT_APPLICABLE: "This coupon doesn't apply to the items in your cart.",
  COUPON_CHANGED: "This coupon was just updated. Please check the new discount and place your order again.",
  COUPON_RATE_LIMITED: "Too many coupon attempts. Please try again in 15 minutes.",
  COUPON_CODE_REQUIRED: "Please enter a coupon code.",
};

export function couponMessage(code: string, rejection?: Partial<CouponRejection>): string {
  if (code === "COUPON_NOT_STARTED" && rejection?.validFrom) {
    return `This coupon starts on ${formatIstDate(rejection.validFrom)}.`;
  }
  if (code === "COUPON_EXPIRED" && rejection?.validUntil) {
    return `This coupon expired on ${formatIstDate(rejection.validUntil)}.`;
  }
  if (code === "COUPON_MIN_ORDER_NOT_MET" && rejection?.shortfall && rejection.minOrderValue) {
    return `Add ${formatInr(rejection.shortfall)} more to use this coupon (minimum order ${formatInr(rejection.minOrderValue)} before GST).`;
  }
  return STATIC_MESSAGES[code] ?? STATIC_MESSAGES.COUPON_INVALID;
}

export function isCouponErrorCode(code: string | undefined): boolean {
  return !!code && code.startsWith("COUPON_");
}
