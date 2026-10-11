import { describe, expect, it } from "vitest";
import { computeOrderTotals, roundMoney } from "../pricing";

describe("roundMoney", () => {
  it("rounds to paise, half away from zero, without float drift", () => {
    expect(roundMoney(1.005)).toBe(1.01);
    expect(roundMoney(2.675)).toBe(2.68);
    expect(roundMoney(-1.005)).toBe(-1.01);
    expect(roundMoney(0.1 + 0.2)).toBe(0.3);
  });
});

describe("computeOrderTotals", () => {
  it("charges 18% GST on the subtotal when there is no discount", () => {
    expect(computeOrderTotals(2000)).toEqual({ subtotal: 2000, discount: 0, taxable: 2000, gst: 360, total: 2360 });
  });

  it("takes the discount off before GST", () => {
    // Same figures the database test asserts for place_order().
    expect(computeOrderTotals(2000, 150)).toEqual({ subtotal: 2000, discount: 150, taxable: 1850, gst: 333, total: 2183 });
  });

  it("never discounts below zero or applies a negative discount", () => {
    expect(computeOrderTotals(100, 500).total).toBe(0);
    expect(computeOrderTotals(100, -50).discount).toBe(0);
    expect(computeOrderTotals(-10).subtotal).toBe(0);
  });
});
