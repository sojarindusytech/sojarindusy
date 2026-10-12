import "server-only";
import { formatInr } from "@/lib/pricing";

/**
 * User-facing text for the error codes raised by place_order() and the
 * checkout service. Codes are stable; wording can change freely here.
 */
const MESSAGES: Record<string, string> = {
  ACCOUNT_NOT_APPROVED: "Your account must be approved before placing an order.",
  CART_EMPTY: "Your cart is empty.",
  SHIPPING_ADDRESS_REQUIRED: "Please enter a delivery address.",
  ITEM_UNAVAILABLE: "Some items in your cart are no longer available. Please remove them and try again.",
  PRICE_CHANGED: "Some prices have changed since you added them to your cart. Please review the updated total.",
  BELOW_MIN_ORDER_QUANTITY: "Some items are below their minimum order quantity.",
  INVALID_REQUEST: "We couldn't process this order. Please refresh the page and try again.",
  INVALID_DISCOUNT: "The discount could not be applied. Please remove the coupon and try again.",
  CHECKOUT_UNAVAILABLE: "Checkout is unavailable right now. Please try again in a moment.",
};

const FALLBACK = "We couldn't place your order. Please try again in a moment.";

export function orderErrorMessage(code: string, detail: Record<string, unknown> = {}): string {
  if (code === "BELOW_MIN_ORDER_QUANTITY" && detail.sku && detail.min) {
    return `${detail.sku} has a minimum order quantity of ${detail.min} units.`;
  }
  if (code === "ITEM_UNAVAILABLE" && detail.sku) {
    return `${detail.sku} is no longer available. Please remove it from your cart.`;
  }
  if (code === "PRICE_CHANGED" && detail.sku && typeof detail.price === "number") {
    return `The price of ${detail.sku} is now ${formatInr(detail.price)}. Please review the updated total.`;
  }
  return MESSAGES[code] ?? FALLBACK;
}
