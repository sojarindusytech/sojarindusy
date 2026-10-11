import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { loadSalesSettings } from "@/lib/sales-settings";
import { placeOfSupplyFor } from "@/lib/indian-states";
import { priceOrder, type OrderTaxBasis, type PricedOrder } from "@/lib/order-pricing";
import type { PricedCart } from "@/lib/server/checkout/cart";

/**
 * The GST basis for a customer's order: GST on/off, default rate and seller
 * state from Sales Settings; place of supply from the customer's profile state
 * (the same source the invoice uses). Null when Sales Settings can't be read:
 * checkout must not guess the tax.
 */
export async function loadOrderTaxBasis(customerState: string | null | undefined): Promise<OrderTaxBasis | null> {
  const settings = await loadSalesSettings();
  if (!settings) return null;
  return {
    gstEnabled: settings.gst_billing_enabled,
    defaultGstRate: Number(settings.default_gst_rate),
    sellerStateCode: settings.state_code || null,
    placeOfSupply: placeOfSupplyFor(customerState),
  };
}

/** The state on the customer's profile, for the place of supply. */
export async function loadCustomerState(userId: string): Promise<string | null> {
  const { data } = await createAdminClient().from("profiles").select("state").eq("id", userId).maybeSingle();
  return (data as { state: string | null } | null)?.state ?? null;
}

/** Prices a repriced cart, with the coupon discount spread over the lines it applies to. */
export function priceCart(
  cart: PricedCart,
  basis: OrderTaxBasis,
  coupon: { discount: number; eligibleLines: boolean[] } | null
): PricedOrder {
  return priceOrder(
    cart.lines.map((l, i) => ({
      quantity: l.quantity,
      unitPrice: l.unitPrice,
      gstRate: l.gstRate,
      couponEligible: coupon?.eligibleLines[i] ?? false,
    })),
    coupon?.discount ?? 0,
    basis
  );
}
