import { describe, expect, it } from "vitest";
import {
  calculateDiscount,
  evaluateCoupon,
  type CouponCartLine,
  type CouponCustomerContext,
  type CouponRules,
} from "../engine";

const NOW = new Date("2026-10-15T12:00:00+05:30");

const rules = (over: Partial<CouponRules> = {}): CouponRules => ({
  id: "c1",
  code: "SAVE10",
  description: null,
  discountType: "percent",
  discountValue: 10,
  maxDiscount: null,
  minOrderValue: 0,
  validFrom: new Date("2026-10-01T00:00:00+05:30"),
  validUntil: new Date("2026-10-31T23:59:59.999+05:30"),
  maxTotalUses: null,
  maxUsesPerCustomer: null,
  firstOrderOnly: false,
  canCombine: false,
  appliesTo: "all",
  customerScope: "all",
  isActive: true,
  isArchived: false,
  version: 1,
  ...over,
});

const context = (over: Partial<CouponCustomerContext> = {}): CouponCustomerContext => ({
  totalUses: 0,
  customerUses: 0,
  customerAllowed: true,
  hasPriorOrders: false,
  productIds: [],
  categoryIds: [],
  ...over,
});

const lines: CouponCartLine[] = [
  { productId: "drill", categoryIds: ["twist-drills"], lineTotal: 2000 },
  { productId: "mill", categoryIds: ["end-mills"], lineTotal: 1000 },
];

const run = (r: Partial<CouponRules> = {}, c: Partial<CouponCustomerContext> = {}, l = lines, now = NOW) =>
  evaluateCoupon({ coupon: rules(r), context: context(c), lines: l, now });

const rejectionCode = (result: ReturnType<typeof run>) => (result.ok ? null : result.rejection.code);

describe("evaluateCoupon", () => {
  it("applies a percentage to the whole cart", () => {
    expect(run()).toEqual({ ok: true, discount: 300, eligibleSubtotal: 3000, cartSubtotal: 3000, eligibleLines: [true, true] });
  });

  it("caps a percentage with the maximum discount", () => {
    expect(run({ maxDiscount: 250 })).toMatchObject({ ok: true, discount: 250 });
  });

  it("never discounts a fixed amount beyond the eligible amount", () => {
    expect(run({ discountType: "fixed", discountValue: 500 })).toMatchObject({ discount: 500 });
    expect(run({ discountType: "fixed", discountValue: 5000 })).toMatchObject({ discount: 3000 });
  });

  describe("validity", () => {
    it("is valid on its first and last day (IST, inclusive)", () => {
      expect(run({}, {}, lines, new Date("2026-10-01T00:00:00+05:30")).ok).toBe(true);
      expect(run({}, {}, lines, new Date("2026-10-31T23:59:59+05:30")).ok).toBe(true);
    });

    it("is not started before its start, expired after its end", () => {
      expect(rejectionCode(run({}, {}, lines, new Date("2026-09-30T23:59:59+05:30")))).toBe("COUPON_NOT_STARTED");
      expect(rejectionCode(run({}, {}, lines, new Date("2026-11-01T00:00:00+05:30")))).toBe("COUPON_EXPIRED");
    });

    it("treats a missing end date as open-ended", () => {
      expect(run({ validUntil: null }, {}, lines, new Date("2030-01-01")).ok).toBe(true);
    });

    it("rejects disabled, archived and not-for-this-customer coupons as invalid", () => {
      expect(rejectionCode(run({ isActive: false }))).toBe("COUPON_INVALID");
      expect(rejectionCode(run({ isArchived: true }))).toBe("COUPON_INVALID");
      expect(rejectionCode(run({ customerScope: "selected" }, { customerAllowed: false }))).toBe("COUPON_INVALID");
    });
  });

  describe("usage limits", () => {
    it("supports unlimited, multiple and one-time use", () => {
      expect(run({ maxTotalUses: null, maxUsesPerCustomer: null }, { totalUses: 999, customerUses: 99 }).ok).toBe(true);
      expect(run({ maxUsesPerCustomer: 3 }, { customerUses: 2 }).ok).toBe(true);
      expect(rejectionCode(run({ maxUsesPerCustomer: 3 }, { customerUses: 3 }))).toBe("COUPON_CUSTOMER_LIMIT_REACHED");
      expect(rejectionCode(run({ maxUsesPerCustomer: 1 }, { customerUses: 1 }))).toBe("COUPON_CUSTOMER_LIMIT_REACHED");
    });

    it("enforces the total limit", () => {
      expect(run({ maxTotalUses: 5 }, { totalUses: 4 }).ok).toBe(true);
      expect(rejectionCode(run({ maxTotalUses: 5 }, { totalUses: 5 }))).toBe("COUPON_LIMIT_REACHED");
    });

    it("enforces first order only", () => {
      expect(run({ firstOrderOnly: true }).ok).toBe(true);
      expect(rejectionCode(run({ firstOrderOnly: true }, { hasPriorOrders: true }))).toBe("COUPON_FIRST_ORDER_ONLY");
    });
  });

  describe("minimum order", () => {
    it("is met exactly at the minimum", () => {
      expect(run({ minOrderValue: 3000 }).ok).toBe(true);
    });

    it("reports how much more is needed", () => {
      const result = run({ minOrderValue: 4200 });
      expect(result).toEqual({
        ok: false,
        rejection: { code: "COUPON_MIN_ORDER_NOT_MET", minOrderValue: 4200, shortfall: 1200 },
      });
    });
  });

  describe("eligible items", () => {
    it("discounts only the chosen products", () => {
      expect(run({ appliesTo: "products" }, { productIds: ["mill"] })).toMatchObject({
        discount: 100,
        eligibleSubtotal: 1000,
        eligibleLines: [false, true],
      });
    });

    it("discounts only items in the chosen categories (sub-categories expanded by the database)", () => {
      expect(run({ appliesTo: "categories" }, { categoryIds: ["drills", "twist-drills"] })).toMatchObject({
        discount: 200,
        eligibleSubtotal: 2000,
      });
    });

    it("rejects a cart with no eligible items", () => {
      expect(rejectionCode(run({ appliesTo: "products" }, { productIds: ["other"] }))).toBe("COUPON_NOT_APPLICABLE");
      expect(rejectionCode(run({}, {}, []))).toBe("COUPON_NOT_APPLICABLE");
    });

    it("checks the minimum on the whole cart, not just eligible items", () => {
      expect(run({ appliesTo: "products", minOrderValue: 2500 }, { productIds: ["mill"] }).ok).toBe(true);
    });
  });
});

describe("calculateDiscount", () => {
  it("rounds a percentage down to the paisa", () => {
    // 12.5% of 333.33 = 41.66625 -> 41.66 (never above the database's rounded bound)
    expect(calculateDiscount({ discountType: "percent", discountValue: 12.5, maxDiscount: null }, 333.33)).toBe(41.66);
    expect(calculateDiscount({ discountType: "percent", discountValue: 10, maxDiscount: null }, 1234.5)).toBe(123.45);
  });

  it("returns 0 for an empty eligible amount", () => {
    expect(calculateDiscount({ discountType: "fixed", discountValue: 100, maxDiscount: null }, 0)).toBe(0);
  });
});
