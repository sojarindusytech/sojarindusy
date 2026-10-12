/**
 * Coupon rules: decides whether a coupon applies to a cart and how much it
 * takes off. Pure and dependency-free, so it is unit-tested directly and safe
 * to import anywhere.
 *
 * The database function place_order() re-checks the parts that can change
 * between "Apply" and "Place order" (limits, dates, active flag) under a row
 * lock, and caps the discount; this module is the single place the discount
 * itself is calculated.
 */
import { roundMoney } from "@/lib/pricing";
import type { CouponAppliesTo, CouponCustomerScope, CouponDiscountType } from "@/types/database.types";

export interface CouponRules {
  id: string;
  code: string;
  description: string | null;
  discountType: CouponDiscountType;
  /** Percent (0-100] or rupees. */
  discountValue: number;
  /** Cap for percentage coupons, in rupees. null = no cap. */
  maxDiscount: number | null;
  /** Cart subtotal (before GST) needed to use the coupon. */
  minOrderValue: number;
  validFrom: Date;
  validUntil: Date | null;
  maxTotalUses: number | null;
  maxUsesPerCustomer: number | null;
  firstOrderOnly: boolean;
  canCombine: boolean;
  appliesTo: CouponAppliesTo;
  customerScope: CouponCustomerScope;
  isActive: boolean;
  isArchived: boolean;
  version: number;
}

/** Usage and eligibility facts about this coupon for this customer. */
export interface CouponCustomerContext {
  /** Uses that count against the total limit (placed, not cancelled). */
  totalUses: number;
  /** This customer's uses that count against the per-customer limit. */
  customerUses: number;
  /** False when the coupon is limited to selected customers and this one is not listed. */
  customerAllowed: boolean;
  /** The customer has an earlier order that was not cancelled. */
  hasPriorOrders: boolean;
  /** Products the coupon is limited to (appliesTo = "products"). */
  productIds: string[];
  /** Categories the coupon is limited to, sub-categories included (appliesTo = "categories"). */
  categoryIds: string[];
}

export interface CouponCartLine {
  productId: string;
  categoryIds: string[];
  /** quantity x unit price, before GST. */
  lineTotal: number;
}

export type CouponRejectionCode =
  | "COUPON_INVALID"
  | "COUPON_NOT_STARTED"
  | "COUPON_EXPIRED"
  | "COUPON_LIMIT_REACHED"
  | "COUPON_CUSTOMER_LIMIT_REACHED"
  | "COUPON_FIRST_ORDER_ONLY"
  | "COUPON_MIN_ORDER_NOT_MET"
  | "COUPON_NOT_APPLICABLE";

export interface CouponRejection {
  code: CouponRejectionCode;
  /** Values the message needs: dates, amounts. */
  validFrom?: Date;
  validUntil?: Date;
  /** Rupees still needed to reach the minimum order value. */
  shortfall?: number;
  minOrderValue?: number;
}

export type CouponEvaluation =
  | {
      ok: true;
      discount: number;
      /** The part of the cart the coupon applies to. */
      eligibleSubtotal: number;
      cartSubtotal: number;
      /** Per input line: does the coupon apply to it? */
      eligibleLines: boolean[];
    }
  | { ok: false; rejection: CouponRejection };

export function evaluateCoupon(args: {
  coupon: CouponRules;
  context: CouponCustomerContext;
  lines: CouponCartLine[];
  now: Date;
}): CouponEvaluation {
  const { coupon, context, lines, now } = args;
  const reject = (rejection: CouponRejection): CouponEvaluation => ({ ok: false, rejection });

  // 1. Exists for this customer. A private coupon is reported as invalid, not
  //    as "not for you", so its existence is not revealed.
  if (!coupon.isActive || coupon.isArchived || !context.customerAllowed) {
    return reject({ code: "COUPON_INVALID" });
  }

  // 2. Validity window.
  if (now < coupon.validFrom) return reject({ code: "COUPON_NOT_STARTED", validFrom: coupon.validFrom });
  if (coupon.validUntil && now > coupon.validUntil) {
    return reject({ code: "COUPON_EXPIRED", validUntil: coupon.validUntil });
  }

  // 3. Usage limits (null = unlimited).
  if (coupon.maxTotalUses !== null && context.totalUses >= coupon.maxTotalUses) {
    return reject({ code: "COUPON_LIMIT_REACHED" });
  }
  if (coupon.maxUsesPerCustomer !== null && context.customerUses >= coupon.maxUsesPerCustomer) {
    return reject({ code: "COUPON_CUSTOMER_LIMIT_REACHED" });
  }
  if (coupon.firstOrderOnly && context.hasPriorOrders) {
    return reject({ code: "COUPON_FIRST_ORDER_ONLY" });
  }

  // 4. Minimum order, on the whole cart before GST.
  const cartSubtotal = roundMoney(lines.reduce((sum, l) => sum + l.lineTotal, 0));
  if (cartSubtotal < coupon.minOrderValue) {
    return reject({
      code: "COUPON_MIN_ORDER_NOT_MET",
      minOrderValue: coupon.minOrderValue,
      shortfall: roundMoney(coupon.minOrderValue - cartSubtotal),
    });
  }

  // 5. Which lines it applies to.
  const eligibleLines = lines.map((l) => isLineEligible(coupon.appliesTo, context, l));
  const eligibleSubtotal = roundMoney(
    lines.filter((_, i) => eligibleLines[i]).reduce((sum, l) => sum + l.lineTotal, 0)
  );
  if (eligibleSubtotal <= 0) return reject({ code: "COUPON_NOT_APPLICABLE" });

  // 6. The discount.
  const discount = calculateDiscount(coupon, eligibleSubtotal);
  if (discount <= 0) return reject({ code: "COUPON_NOT_APPLICABLE" });

  return { ok: true, discount, eligibleSubtotal, cartSubtotal, eligibleLines };
}

function isLineEligible(appliesTo: CouponAppliesTo, context: CouponCustomerContext, line: CouponCartLine): boolean {
  switch (appliesTo) {
    case "all":
      return true;
    case "products":
      return context.productIds.includes(line.productId);
    case "categories":
      return line.categoryIds.some((id) => context.categoryIds.includes(id));
  }
}

/**
 * Percentage: share of the eligible amount, capped by maxDiscount, rounded
 * DOWN to the paisa so it never exceeds what the database allows.
 * Fixed: the amount, but never more than the eligible amount.
 */
export function calculateDiscount(
  coupon: Pick<CouponRules, "discountType" | "discountValue" | "maxDiscount">,
  eligibleSubtotal: number
): number {
  if (eligibleSubtotal <= 0 || coupon.discountValue <= 0) return 0;

  let discount: number;
  if (coupon.discountType === "percent") {
    const eligiblePaise = Math.round(eligibleSubtotal * 100);
    discount = Math.floor((eligiblePaise * coupon.discountValue) / 100 + 1e-9) / 100;
  } else {
    discount = coupon.discountValue;
  }

  if (coupon.maxDiscount !== null && coupon.maxDiscount > 0) discount = Math.min(discount, coupon.maxDiscount);
  return roundMoney(Math.min(discount, eligibleSubtotal));
}
