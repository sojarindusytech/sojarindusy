import { formatInr } from "@/lib/pricing";
import { getOrderAmounts } from "@/lib/order-amounts";
import type { Order } from "@/types/database.types";

/** "Discount (CODE)  −₹150.00" in an order's totals; renders nothing without a discount. */
export function OrderDiscountRow({
  order,
}: {
  order: Pick<Order, "subtotal" | "gst_amount" | "total_amount" | "discount_amount" | "coupon_code" | "tax_snapshot">;
}) {
  const { discount, couponCode } = getOrderAmounts(order);
  if (discount <= 0) return null;
  return (
    <div className="flex justify-between text-emerald-700">
      <span>
        Discount{couponCode && <> (<span className="font-mono font-semibold">{couponCode}</span>)</>}
      </span>
      <span className="font-mono font-semibold">−{formatInr(discount)}</span>
    </div>
  );
}
