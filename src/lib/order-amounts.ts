import { GST_RATE, roundMoney } from "@/lib/pricing";
import { gstLabel, gstModeOf } from "@/lib/order-pricing";
import type { Order } from "@/types/database.types";

export interface OrderAmounts {
  subtotal: number;
  discount: number;
  /** subtotal - discount: the value GST is charged on. */
  taxable: number;
  gst: number;
  total: number;
  couponCode: string | null;
  /** "GST (CGST + SGST)", "GST (IGST)", or "GST (18%)" on orders from before per-SKU rates. */
  gstLabel: string;
}

/**
 * The money on an order, as stored. Very old orders may lack subtotal / GST;
 * those are derived from the total (they never had a discount).
 */
export function getOrderAmounts(
  order: Pick<Order, "subtotal" | "gst_amount" | "total_amount" | "discount_amount" | "coupon_code" | "tax_snapshot">
): OrderAmounts {
  const total = Number(order.total_amount) || 0;
  const discount = Number(order.discount_amount) || 0;
  const storedSubtotal = Number(order.subtotal) || 0;
  const label = order.tax_snapshot ? gstLabel(gstModeOf(order.tax_snapshot)) : "GST (18%)";

  if (storedSubtotal > 0) {
    const taxable = roundMoney(storedSubtotal - discount);
    return {
      subtotal: storedSubtotal,
      discount,
      taxable,
      gst: Number(order.gst_amount) || roundMoney(total - taxable),
      total,
      couponCode: order.coupon_code ?? null,
      gstLabel: label,
    };
  }

  const subtotal = roundMoney(total / (1 + GST_RATE));
  return {
    subtotal,
    discount: 0,
    taxable: subtotal,
    gst: roundMoney(total - subtotal),
    total,
    couponCode: null,
    gstLabel: label,
  };
}
