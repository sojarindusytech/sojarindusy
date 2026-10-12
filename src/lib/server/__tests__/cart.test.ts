import { describe, expect, it } from "vitest";
import { mergeCartLines } from "../checkout/cart";

describe("mergeCartLines", () => {
  it("combines repeated SKUs and keeps the first price seen", () => {
    const merged = mergeCartLines([
      { variantId: "a", quantity: 2, unitPrice: 100 },
      { variantId: "b", quantity: 1, unitPrice: 50 },
      { variantId: "a", quantity: 3, unitPrice: 999 },
    ]);
    expect(merged).toEqual([
      { variantId: "a", quantity: 5, unitPrice: 100 },
      { variantId: "b", quantity: 1, unitPrice: 50 },
    ]);
  });

  it("does not mutate the input", () => {
    const input = [{ variantId: "a", quantity: 1, unitPrice: 1 }, { variantId: "a", quantity: 1, unitPrice: 1 }];
    mergeCartLines(input);
    expect(input[0].quantity).toBe(1);
  });
});
