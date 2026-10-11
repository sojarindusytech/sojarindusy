import { describe, expect, it } from "vitest";
import { getOrderAmounts } from "../order-amounts";

describe("getOrderAmounts", () => {
  it("reads a discounted order as stored", () => {
    expect(
      getOrderAmounts({ subtotal: 2000, discount_amount: 150, gst_amount: 333, total_amount: 2183, coupon_code: "SAVE10" })
    ).toEqual({ subtotal: 2000, discount: 150, taxable: 1850, gst: 333, total: 2183, couponCode: "SAVE10", gstLabel: "GST (18%)" });
  });

  it("treats an order without a discount as taxable on its subtotal", () => {
    expect(getOrderAmounts({ subtotal: 2000, gst_amount: 360, total_amount: 2360 })).toMatchObject({
      discount: 0,
      taxable: 2000,
      gst: 360,
    });
  });

  it("labels GST from the order's tax snapshot", () => {
    const tax = { gst_enabled: true, intra_state: false, seller_state_code: "24", place_of_supply: "27-Maharashtra", cgst: 0, sgst: 0, igst: 300 };
    expect(getOrderAmounts({ subtotal: 2000, gst_amount: 300, total_amount: 2300, tax_snapshot: tax }).gstLabel).toBe("GST (IGST)");
  });

  it("derives subtotal and GST for very old orders that only stored a total", () => {
    expect(getOrderAmounts({ total_amount: 1180 })).toMatchObject({ subtotal: 1000, gst: 180, total: 1180, discount: 0 });
  });
});
