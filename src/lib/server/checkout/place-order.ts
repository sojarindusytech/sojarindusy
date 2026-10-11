import "server-only";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { placeOrder } from "@/lib/server/rpc";
import { notifyAll } from "@/lib/server/notifications";
import { checkReorderForStock } from "@/lib/server/purchase-orders";
import { loadPricedCart, type PriceChange } from "@/lib/server/checkout/cart";
import { loadOrderTaxBasis, priceCart } from "@/lib/server/checkout/pricing";
import { orderErrorMessage } from "@/lib/server/checkout/messages";
import { resolveCoupon } from "@/lib/server/coupons/checkout";
import { couponMessage, isCouponErrorCode } from "@/lib/coupons/messages";
import type { CustomerOrderDetails, Profile } from "@/types/database.types";

const MAX_LINES = 200;
const MAX_SPEC_ENTRIES = 20;

const placeOrderSchema = z.object({
  items: z
    .array(
      z.object({
        variantId: z.uuid(),
        quantity: z.number().int().min(1).max(100_000),
        unitPrice: z.number().min(0).max(1_000_000_000),
        specifications: z.record(z.string(), z.unknown()).optional(),
      })
    )
    .min(1, "Your cart is empty.")
    .max(MAX_LINES, `An order can have at most ${MAX_LINES} lines.`),
  shippingAddress: z.string().trim().min(5, "Please enter a valid delivery address.").max(1000),
  notes: z.string().trim().max(2000).nullish(),
  idempotencyKey: z.uuid(),
  couponCode: z.string().max(64).nullish(),
});

export type PlaceOrderInput = z.input<typeof placeOrderSchema> & {
  user: { id: string; email: string };
};

export type PlaceOrderOutcome =
  | {
      ok: true;
      orderId: string;
      orderNumber: string;
      totalAmount: number;
      /** True when a retried submit returned the order created the first time. */
      replayed: boolean;
    }
  | {
      ok: false;
      code: string;
      message: string;
      /** Present for PRICE_CHANGED: the cart should be updated to these prices. */
      priceChanges?: PriceChange[];
    };

/**
 * Places a customer's order.
 *
 * Trust boundary: the browser supplies SKUs, quantities and the prices the
 * customer saw. Prices are re-read from the database; if any differ the order
 * is refused with the new prices so the customer can review them, instead of
 * silently charging a different amount. GST is worked out per line exactly as
 * the invoice will (src/lib/order-pricing.ts). The final price check, stock
 * reservation and order insert happen in one locked database step (place_order).
 *
 * The caller must already have verified the user is an approved customer.
 */
export async function placeCustomerOrder(input: PlaceOrderInput): Promise<PlaceOrderOutcome> {
  const parsed = placeOrderSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, code: "INVALID_REQUEST", message: parsed.error.issues[0]?.message ?? orderErrorMessage("INVALID_REQUEST") };
  }
  const { items, shippingAddress, notes, idempotencyKey, couponCode } = parsed.data;
  const { user } = input;

  // A retried submit whose first attempt already went through gets that order
  // back before any other check: re-checking the coupon now could fail (its
  // last use is the one this very order took) and wrongly report an error.
  const existing = await findOrderForAttempt(user.id, idempotencyKey);
  if (existing) {
    return { ok: true, orderId: existing.id, orderNumber: existing.order_number, totalAmount: Number(existing.total_amount), replayed: true };
  }

  const cartInput = items.map((i) => ({
    variantId: i.variantId,
    quantity: i.quantity,
    unitPrice: i.unitPrice,
    specifications: sanitizeSpecifications(i.specifications),
  }));
  const cart = await loadPricedCart(cartInput);

  if (cart.unavailable.length > 0) {
    return { ok: false, code: "ITEM_UNAVAILABLE", message: orderErrorMessage("ITEM_UNAVAILABLE", { sku: cart.unavailable[0] }) };
  }
  if (cart.priceChanges.length > 0) {
    return { ok: false, code: "PRICE_CHANGED", message: orderErrorMessage("PRICE_CHANGED"), priceChanges: cart.priceChanges };
  }
  if (cart.belowMinimum.length > 0) {
    return { ok: false, code: "BELOW_MIN_ORDER_QUANTITY", message: orderErrorMessage("BELOW_MIN_ORDER_QUANTITY", cart.belowMinimum[0]) };
  }

  // The coupon is evaluated against the repriced cart, exactly as on "Apply".
  let couponDiscount: { discount: number; eligibleLines: boolean[] } | null = null;
  let couponPayload: { coupon_id: string; version: number; eligible_subtotal: number } | null = null;
  let appliedCode: string | null = null;
  if (couponCode?.trim()) {
    const resolved = await resolveCoupon({ userId: user.id, rawCode: couponCode, cart });
    if (!resolved.ok) return { ok: false, code: resolved.code, message: resolved.message };
    couponDiscount = { discount: resolved.discount, eligibleLines: resolved.eligibleLines };
    couponPayload = {
      coupon_id: resolved.coupon.id,
      version: resolved.coupon.version,
      eligible_subtotal: resolved.eligibleSubtotal,
    };
    appliedCode = resolved.coupon.code;
  }

  const customerDetails = await snapshotCustomer(user);
  const taxBasis = await loadOrderTaxBasis(customerDetails.state);
  if (!taxBasis) {
    return { ok: false, code: "CHECKOUT_UNAVAILABLE", message: orderErrorMessage("CHECKOUT_UNAVAILABLE") };
  }
  const priced = priceCart(cart, taxBasis, couponDiscount);

  const { data, error } = await placeOrder({
    user_id: user.id,
    idempotency_key: idempotencyKey,
    shipping_address: shippingAddress,
    notes: notes || null,
    customer_details: { ...customerDetails },
    tax: priced.tax,
    items: cart.lines.map((l, i) => ({
      variant_id: l.variantId,
      quantity: l.quantity,
      unit_price: l.unitPrice,
      name: l.productTitle,
      specifications: l.specifications,
      discount_amount: priced.lines[i].discountAmount,
      gst_rate: priced.lines[i].gstRate,
      cgst: priced.lines[i].cgst,
      sgst: priced.lines[i].sgst,
      igst: priced.lines[i].igst,
    })),
    discount_amount: priced.totals.discount,
    coupon: couponPayload,
  });

  if (error) {
    if (error.code === "PRICE_CHANGED") {
      // The price moved between our read and the locked step: report all changes.
      const repriced = await loadPricedCart(cartInput);
      return { ok: false, code: error.code, message: orderErrorMessage(error.code), priceChanges: repriced.priceChanges };
    }
    if (isCouponErrorCode(error.code)) {
      // A limit was reached or the coupon changed between Apply and Place order.
      return { ok: false, code: error.code, message: couponMessage(error.code) };
    }
    return { ok: false, code: error.code, message: orderErrorMessage(error.code, error.detail) };
  }

  if (!data.replayed) {
    await checkReorderForStock(data.stock.map((s) => ({ variantId: s.variant_id, stockAfter: s.stock_after })));

    const total = Number(data.total_amount);
    await notifyAll([
      {
        role: "admin",
        title: "New Customer Order",
        message: `Order #${data.order_number} placed by ${customerDetails.company_name} (₹${total.toLocaleString("en-IN")})${appliedCode ? ` with coupon ${appliedCode}` : ""}.`,
        type: "order",
        link: "/admin/orders",
        metadata: { order_id: data.order_id, order_number: data.order_number, total, coupon_code: appliedCode },
      },
      {
        userId: user.id,
        title: "Order Placed Successfully",
        message: `Your order #${data.order_number} for ₹${total.toLocaleString("en-IN")} has been received and is being processed.`,
        type: "order",
        link: "/dashboard/orders",
        metadata: { order_id: data.order_id, order_number: data.order_number },
      },
    ]);
  }

  return {
    ok: true,
    orderId: data.order_id,
    orderNumber: data.order_number,
    totalAmount: Number(data.total_amount),
    replayed: data.replayed,
  };
}

async function findOrderForAttempt(userId: string, idempotencyKey: string) {
  const { data } = await createAdminClient()
    .from("orders")
    .select("id, order_number, total_amount")
    .eq("idempotency_key", idempotencyKey)
    .eq("user_id", userId)
    .maybeSingle();
  return data as { id: string; order_number: string; total_amount: number | string } | null;
}

/** The customer's details as printed on the order, frozen at order time. */
async function snapshotCustomer(user: { id: string; email: string }): Promise<CustomerOrderDetails> {
  const { data } = await createAdminClient().from("profiles").select("*").eq("id", user.id).single();
  const profile = data as Profile | null;
  return {
    company_name: profile?.company_name || user.email.split("@")[0] || "Registered Enterprise",
    contact_name: profile ? `${profile.title || "Mr"} ${profile.first_name} ${profile.last_name}`.trim() : "Purchasing Agent",
    mobile: profile?.mobile || "-",
    email: user.email,
    gstin: profile?.gstin || null,
    city: profile?.city || "-",
    state: profile?.state || "-",
    pincode: profile?.pincode || "-",
  };
}

/**
 * Item specifications are descriptive labels shown on the order (series,
 * dimensions). Keep them small and plain text.
 */
function sanitizeSpecifications(specs: Record<string, unknown> | undefined): Record<string, string> {
  const clean: Record<string, string> = {};
  if (!specs) return clean;
  for (const [key, value] of Object.entries(specs).slice(0, MAX_SPEC_ENTRIES)) {
    if (typeof value !== "string" && typeof value !== "number") continue;
    clean[key.slice(0, 60)] = String(value).slice(0, 200);
  }
  return clean;
}
