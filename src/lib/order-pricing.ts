import { computeInvoice, round2, stateCodeOf } from "@/lib/invoice";
import { allocateDiscount } from "@/lib/coupons/allocate";
import type { OrderTotals } from "@/lib/pricing";
import type { OrderTaxSnapshot } from "@/types/database.types";

export type { OrderTaxSnapshot };

/**
 * Prices an order with the same maths as its tax invoice (src/lib/invoice.ts),
 * so the invoice raised on delivery shows exactly what the customer was charged:
 *
 *   - GST per line, at the SKU's own rate (or the Sales Settings default),
 *     charged on the line value after its share of the coupon discount;
 *   - CGST + SGST when the customer is in the seller's state, IGST otherwise;
 *   - no GST only if the basis says so (online checkout always charges GST).
 *
 * The order total is the invoice's total before its round-off to the rupee.
 * Pure: shared by checkout preview, order placement and tests.
 */

/** How GST applies to this order: from Sales Settings and the customer's state. */
export interface OrderTaxBasis {
  gstEnabled: boolean;
  /** GST % for SKUs without their own rate. */
  defaultGstRate: number;
  sellerStateCode: string | null;
  /** "24-Gujarat"; null when the customer's state is unknown (treated as intra-state). */
  placeOfSupply: string | null;
}

export interface OrderPricingLineInput {
  quantity: number;
  unitPrice: number;
  /** The SKU's own GST %; null means the settings default. */
  gstRate: number | null;
  /** Whether the coupon applies to this line. */
  couponEligible: boolean;
}

export interface PricedOrderLine {
  lineTotal: number;
  /** This line's share of the coupon discount. */
  discountAmount: number;
  taxableAmount: number;
  /** Effective GST % (0 when GST billing is off). */
  gstRate: number;
  cgst: number;
  sgst: number;
  igst: number;
  gstAmount: number;
}

export interface PricedOrder {
  lines: PricedOrderLine[];
  totals: OrderTotals;
  tax: OrderTaxSnapshot;
}

export function priceOrder(
  lines: OrderPricingLineInput[],
  discount: number,
  basis: OrderTaxBasis
): PricedOrder {
  const lineTotals = lines.map((l) => round2(Math.max(0, l.quantity) * Math.max(0, l.unitPrice)));
  const shares = allocateDiscount(
    lines.map((l, i) => ({ lineTotal: lineTotals[i], eligible: l.couponEligible })),
    discount
  );

  const invoice = computeInvoice({
    items: lines.map((l, i) => ({
      name: "",
      quantity: l.quantity,
      unitPrice: l.unitPrice,
      discountAmount: shares[i],
      gstRate: l.gstRate,
    })),
    gstEnabled: basis.gstEnabled,
    defaultGstRate: basis.defaultGstRate,
    sellerStateCode: basis.sellerStateCode,
    placeOfSupplyStateCode: stateCodeOf(basis.placeOfSupply),
  });

  const pricedLines = invoice.lines.map((l, i) => ({
    lineTotal: lineTotals[i],
    discountAmount: l.discountAmount,
    taxableAmount: l.taxable,
    gstRate: l.gstRate,
    cgst: l.cgst,
    sgst: l.sgst,
    igst: l.igst,
    gstAmount: round2(l.cgst + l.sgst + l.igst),
  }));

  const t = invoice.totals;
  return {
    lines: pricedLines,
    totals: {
      subtotal: round2(lineTotals.reduce((a, b) => a + b, 0)),
      discount: t.discountTotal,
      taxable: t.taxableTotal,
      gst: round2(t.cgstTotal + t.sgstTotal + t.igstTotal),
      total: t.subTotal,
    },
    tax: {
      gst_enabled: basis.gstEnabled,
      seller_state_code: basis.sellerStateCode,
      place_of_supply: basis.placeOfSupply,
      intra_state: invoice.intraState,
      cgst: t.cgstTotal,
      sgst: t.sgstTotal,
      igst: t.igstTotal,
    },
  };
}

/** How GST shows on an order or checkout summary. */
export type GstMode = "cgst_sgst" | "igst" | "none";

export function gstModeOf(tax: Pick<OrderTaxSnapshot, "gst_enabled" | "intra_state"> | null | undefined): GstMode | null {
  if (!tax) return null;
  if (!tax.gst_enabled) return "none";
  return tax.intra_state ? "cgst_sgst" : "igst";
}

export function gstLabel(mode: GstMode | null): string {
  if (mode === "cgst_sgst") return "GST (CGST + SGST)";
  if (mode === "igst") return "GST (IGST)";
  return "GST";
}
