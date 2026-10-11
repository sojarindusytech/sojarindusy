"use server";

import { guardOrError, requireApprovedCustomer } from "@/lib/auth-guard";
import {
  MAX_CHECKOUT_LINES,
  previewCheckout,
  sanitizePreviewItems,
  type CheckoutPreview,
} from "@/lib/server/checkout/preview";

/**
 * The cart's totals as the order will store them: current prices, GST per SKU
 * rate and CGST + SGST or IGST for the customer's state. Read-only. The
 * browser's own totals are only an estimate (it does not know the GST rules).
 */
export async function fetchCheckoutPreview(input: {
  items: { variantId: string; quantity: number; unitPrice: number }[];
}): Promise<{ success: true; preview: CheckoutPreview } | { success: false; error: string }> {
  const guard = await guardOrError(requireApprovedCustomer);
  if (!guard.ctx) return { success: false, error: guard.error };

  const items = sanitizePreviewItems(input.items);
  if (items.length === 0) return { success: false, error: "Your cart is empty." };
  if (items.length > MAX_CHECKOUT_LINES) return { success: false, error: "Your cart has too many lines." };

  try {
    return { success: true, preview: await previewCheckout({ userId: guard.ctx.userId, items }) };
  } catch (err) {
    console.error("[fetchCheckoutPreview]", err);
    return { success: false, error: "We couldn't work out your totals right now." };
  }
}
