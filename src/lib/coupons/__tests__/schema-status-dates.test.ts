import { describe, expect, it } from "vitest";
import { couponFormSchema, fieldErrors, generateCouponCode, COUPON_CODE_PATTERN, type CouponFormInput } from "../schema";
import { getCouponStatus } from "../status";
import { istDayEnd, istDayStart, toIstDateInput } from "../dates";
import { toCouponFormValues, toSaveCouponPayload } from "../mapping";
import type { Coupon } from "@/types/database.types";

const valid: CouponFormInput = {
  code: " diwali-10 ",
  description: "",
  discountType: "percent",
  discountValue: 10,
  maxDiscount: 2000,
  minOrderValue: 5000,
  validFrom: "2026-10-01",
  validUntil: "2026-10-31",
  maxTotalUses: 100,
  maxUsesPerCustomer: 1,
  firstOrderOnly: false,
  canCombine: false,
  appliesTo: "all",
  productIds: [],
  categoryIds: [],
  customerScope: "all",
  customerIds: [],
  isActive: true,
};

describe("couponFormSchema", () => {
  it("normalises the code to trimmed capitals", () => {
    const parsed = couponFormSchema.parse(valid);
    expect(parsed.code).toBe("DIWALI-10");
  });

  it.each([
    ["code", { code: "a!" }],
    ["discountValue", { discountValue: 150 }],
    ["discountValue", { discountValue: 0 }],
    ["validUntil", { validUntil: "2026-09-30" }],
    ["productIds", { appliesTo: "products" as const }],
    ["categoryIds", { appliesTo: "categories" as const }],
    ["customerIds", { customerScope: "selected" as const }],
    ["maxUsesPerCustomer", { maxTotalUses: 2, maxUsesPerCustomer: 5 }],
  ])("reports a problem with %s", (field, override) => {
    const result = couponFormSchema.safeParse({ ...valid, ...override });
    expect(result.success).toBe(false);
    if (!result.success) expect(fieldErrors(result.error)[field]).toBeTruthy();
  });

  it("allows unlimited usage and an open end date", () => {
    expect(couponFormSchema.safeParse({ ...valid, maxTotalUses: null, maxUsesPerCustomer: null, validUntil: null }).success).toBe(true);
  });
});

describe("generateCouponCode", () => {
  it("produces valid, unambiguous codes", () => {
    for (let i = 0; i < 50; i++) {
      const code = generateCouponCode();
      expect(code).toMatch(COUPON_CODE_PATTERN);
      expect(code.slice(4)).not.toMatch(/[01IO]/);
    }
  });
});

describe("IST dates", () => {
  it("turns calendar days into IST day bounds and back", () => {
    expect(istDayStart("2026-10-01")).toBe("2026-10-01T00:00:00.000+05:30");
    expect(istDayEnd("2026-10-31")).toBe("2026-10-31T23:59:59.999+05:30");
    // 31 Oct 23:59 IST is still 31 Oct, though it is 18:29 UTC.
    expect(toIstDateInput(istDayEnd("2026-10-31"))).toBe("2026-10-31");
    expect(toIstDateInput("2026-09-30T19:00:00Z")).toBe("2026-10-01");
  });
});

describe("getCouponStatus", () => {
  const base = {
    isActive: true,
    isArchived: false,
    validFrom: new Date("2026-10-01T00:00:00+05:30"),
    validUntil: new Date("2026-10-31T23:59:59+05:30"),
    maxTotalUses: 10,
  };
  const at = (iso: string) => new Date(iso);

  it("derives each status from dates, usage and flags", () => {
    expect(getCouponStatus(base, 0, at("2026-10-15T00:00:00Z"))).toBe("active");
    expect(getCouponStatus(base, 0, at("2026-09-15T00:00:00Z"))).toBe("scheduled");
    expect(getCouponStatus(base, 0, at("2026-11-15T00:00:00Z"))).toBe("expired");
    expect(getCouponStatus(base, 10, at("2026-10-15T00:00:00Z"))).toBe("used_up");
    expect(getCouponStatus({ ...base, isActive: false }, 0, at("2026-10-15T00:00:00Z"))).toBe("disabled");
    expect(getCouponStatus({ ...base, isArchived: true }, 0, at("2026-10-15T00:00:00Z"))).toBe("archived");
  });
});

describe("mapping", () => {
  it("round-trips a coupon through the save payload and form values", () => {
    const data = couponFormSchema.parse(valid);
    const payload = toSaveCouponPayload(data);
    expect(payload).toMatchObject({
      code: "DIWALI-10",
      valid_from: "2026-10-01T00:00:00.000+05:30",
      valid_until: "2026-10-31T23:59:59.999+05:30",
      max_discount: 2000,
    });

    const row = {
      id: "6f1b6a5e-1c0a-4a41-8f9e-2a6b1b0b6c11",
      version: 3,
      deleted_at: null,
      created_by: null,
      created_at: "",
      updated_at: "",
      code: payload.code,
      description: null,
      discount_type: "percent",
      discount_value: "10.00",
      max_discount: "2000.00",
      min_order_value: "5000.00",
      valid_from: "2026-09-30T18:30:00+00:00",
      valid_until: "2026-10-31T18:29:59.999+00:00",
      max_total_uses: 100,
      max_uses_per_customer: 1,
      first_order_only: false,
      can_combine: false,
      applies_to: "all",
      customer_scope: "all",
      is_active: true,
    } as Coupon;
    expect(toCouponFormValues(row, { productIds: [], categoryIds: [], customerIds: [] })).toMatchObject({
      validFrom: "2026-10-01",
      validUntil: "2026-10-31",
      discountValue: 10,
      maxDiscount: 2000,
      version: 3,
    });
  });

  it("drops the cap for fixed-amount coupons", () => {
    expect(toSaveCouponPayload(couponFormSchema.parse({ ...valid, discountType: "fixed", discountValue: 500 })).max_discount).toBeNull();
  });
});
