import { describe, expect, it } from "vitest";
import { computeInvoice, stateCodeOf } from "../invoice";
import { gstLabel, gstModeOf, priceOrder, type OrderPricingLineInput, type OrderTaxBasis } from "../order-pricing";

const gujarat: OrderTaxBasis = { gstEnabled: true, defaultGstRate: 18, sellerStateCode: "24", placeOfSupply: "24-Gujarat" };
const maharashtra: OrderTaxBasis = { ...gujarat, placeOfSupply: "27-Maharashtra" };

const line = (over: Partial<OrderPricingLineInput> = {}): OrderPricingLineInput => ({
  quantity: 1,
  unitPrice: 1000,
  gstRate: null,
  couponEligible: true,
  ...over,
});

describe("priceOrder", () => {
  it("charges CGST + SGST within the seller's state, at the default rate", () => {
    const { totals, lines, tax } = priceOrder([line({ quantity: 2 })], 0, gujarat);
    expect(totals).toEqual({ subtotal: 2000, discount: 0, taxable: 2000, gst: 360, total: 2360 });
    expect(lines[0]).toMatchObject({ gstRate: 18, cgst: 180, sgst: 180, igst: 0, gstAmount: 360 });
    expect(tax).toMatchObject({ gst_enabled: true, intra_state: true, cgst: 180, sgst: 180, igst: 0 });
  });

  it("charges IGST to another state, at each SKU's own rate", () => {
    const { totals, lines, tax } = priceOrder([line(), line({ quantity: 2, unitPrice: 500, gstRate: 12 })], 0, maharashtra);
    expect(lines.map((l) => [l.gstRate, l.igst])).toEqual([[18, 180], [12, 120]]);
    expect(totals.gst).toBe(300);
    expect(tax).toMatchObject({ intra_state: false, place_of_supply: "27-Maharashtra", igst: 300 });
  });

  it("treats an unknown customer state as within the seller's state", () => {
    expect(priceOrder([line()], 0, { ...gujarat, placeOfSupply: null }).tax.intra_state).toBe(true);
  });

  it("charges no GST when GST billing is off, whatever the SKU rate", () => {
    const { totals, lines } = priceOrder([line({ gstRate: 28 })], 0, { ...gujarat, gstEnabled: false });
    expect(totals).toMatchObject({ gst: 0, total: 1000 });
    expect(lines[0].gstRate).toBe(0);
  });

  it("takes the coupon off only the eligible lines, before GST", () => {
    const { totals, lines } = priceOrder(
      [line({ couponEligible: false }), line({ quantity: 2, unitPrice: 500, gstRate: 12 })],
      100,
      gujarat
    );
    expect(lines.map((l) => l.discountAmount)).toEqual([0, 100]);
    expect(lines[1]).toMatchObject({ taxableAmount: 900, gstAmount: 108 });
    expect(totals).toEqual({ subtotal: 2000, discount: 100, taxable: 1900, gst: 288, total: 2188 });
  });

  it("totals always add up: subtotal - discount + GST = total", () => {
    const { totals } = priceOrder(
      [line({ quantity: 3, unitPrice: 333.33, gstRate: 12 }), line({ quantity: 7, unitPrice: 19.99, gstRate: 5 })],
      37.77,
      maharashtra
    );
    expect(Math.round((totals.subtotal - totals.discount + totals.gst) * 100)).toBe(Math.round(totals.total * 100));
    expect(totals.discount).toBe(37.77);
  });

  it("matches the invoice raised from the order to the paisa", () => {
    const lines = [line({ quantity: 3, unitPrice: 333.33, gstRate: 12 }), line(), line({ quantity: 11, unitPrice: 7.07, gstRate: 28 })];
    for (const basis of [gujarat, maharashtra]) {
      const order = priceOrder(lines, 139.99, basis);
      // What createInvoiceFromOrder does with the stored lines.
      const invoice = computeInvoice({
        items: lines.map((l, i) => ({
          name: `L${i}`,
          quantity: l.quantity,
          unitPrice: l.unitPrice,
          discountAmount: order.lines[i].discountAmount,
          gstRate: order.lines[i].gstRate,
        })),
        gstEnabled: basis.gstEnabled,
        defaultGstRate: 0, // unused: every line carries its rate
        sellerStateCode: basis.sellerStateCode,
        placeOfSupplyStateCode: stateCodeOf(basis.placeOfSupply),
      });
      expect(invoice.totals.subTotal).toBe(order.totals.total);
      expect(invoice.totals.discountTotal).toBe(order.totals.discount);
      expect(invoice.totals.taxableTotal).toBe(order.totals.taxable);
      expect(invoice.totals.cgstTotal + invoice.totals.sgstTotal + invoice.totals.igstTotal).toBeCloseTo(order.totals.gst, 10);
    }
  });
});

describe("GST labels", () => {
  it("names the split, or nothing for older orders", () => {
    expect(gstLabel(gstModeOf({ gst_enabled: true, intra_state: true }))).toBe("GST (CGST + SGST)");
    expect(gstLabel(gstModeOf({ gst_enabled: true, intra_state: false }))).toBe("GST (IGST)");
    expect(gstModeOf({ gst_enabled: false, intra_state: true })).toBe("none");
    expect(gstLabel(gstModeOf(null))).toBe("GST");
  });
});
