import { describe, expect, it } from "vitest";
import { couponFormSchema } from "@/lib/coupons/schema";
import { couponFormFromData, couponFormToInput, emptyCouponForm } from "../coupon-form-state";

describe("coupon form state", () => {
  it("starts as a valid one-time, unlimited-total, whole-cart coupon once a code and value are typed", () => {
    const state = { ...emptyCouponForm("2026-10-10"), code: "WELCOME", discountValue: "10" };
    const input = couponFormToInput(state);
    expect(input).toMatchObject({ maxTotalUses: null, maxUsesPerCustomer: 1, appliesTo: "all", validFrom: "2026-10-10" });
    expect(couponFormSchema.safeParse(input).success).toBe(true);
  });

  it("maps the usage modes to limits", () => {
    const base = { ...emptyCouponForm("2026-10-10"), code: "X1X", discountValue: "5" };
    expect(couponFormToInput({ ...base, perCustomer: "unlimited" }).maxUsesPerCustomer).toBeNull();
    expect(couponFormToInput({ ...base, perCustomer: "custom", maxUsesPerCustomer: "3" }).maxUsesPerCustomer).toBe(3);
    expect(couponFormToInput({ ...base, totalLimit: "limited", maxTotalUses: "50" }).maxTotalUses).toBe(50);
  });

  it("reports empty required numbers as invalid instead of zero", () => {
    const input = couponFormToInput({ ...emptyCouponForm("2026-10-10"), code: "ABC", totalLimit: "limited" });
    const parsed = couponFormSchema.safeParse(input);
    expect(parsed.success).toBe(false);
  });

  it("only sends the list that matches the chosen scope", () => {
    const state = {
      ...emptyCouponForm("2026-10-10"),
      code: "ABC",
      discountValue: "5",
      appliesTo: "all" as const,
      productIds: ["6f1b6a5e-1c0a-4a41-8f9e-2a6b1b0b6c11"],
    };
    expect(couponFormToInput(state).productIds).toEqual([]);
  });

  it("round-trips saved data", () => {
    const data = couponFormSchema.parse(couponFormToInput({
      ...emptyCouponForm("2026-10-10"),
      code: "ROUND",
      discountValue: "12.5",
      maxDiscount: "999",
      perCustomer: "custom",
      maxUsesPerCustomer: "2",
    }));
    expect(couponFormToInput(couponFormFromData(data))).toMatchObject({
      code: "ROUND",
      discountValue: 12.5,
      maxDiscount: 999,
      maxUsesPerCustomer: 2,
    });
  });
});
