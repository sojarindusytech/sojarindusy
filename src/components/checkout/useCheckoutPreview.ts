"use client";

import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { fetchCheckoutPreview } from "@/actions/checkout";
import type { CartItem } from "@/context/CartContext";
import type { GstMode } from "@/lib/order-pricing";
import type { OrderTotals } from "@/lib/pricing";

export interface ServerTotals {
  totals: OrderTotals;
  gstMode: GstMode;
}

export const cartKeyOf = (items: CartItem[]) => items.map((i) => `${i.variantId}:${i.quantity}:${i.unitPrice}`).join("|");
export const toPreviewLines = (items: CartItem[]) =>
  items.map((i) => ({ variantId: i.variantId, quantity: i.quantity, unitPrice: i.unitPrice }));

/** Shown once however many checks find the same price changes. */
export function notifyPriceChanges() {
  toast("Some prices have changed. Your cart has been updated.", { icon: "ℹ️", id: "cart-price-changes" });
}

const DEBOUNCE_MS = 300;

/**
 * The cart's totals as the order will store them (per-SKU GST, CGST + SGST or
 * IGST), fetched from the server whenever the cart changes. Null while loading
 * or when the server can't be reached; the caller then shows the cart's own
 * estimate.
 */
export function useCheckoutPreview(
  items: CartItem[],
  enabled: boolean,
  applyPriceChanges: (changes: { variantId: string; newPrice: number }[]) => void
): { data: ServerTotals | null; isLoading: boolean } {
  const [result, setResult] = useState<{ key: string; data: ServerTotals | null } | null>(null);
  const cartKey = cartKeyOf(items);
  const active = enabled && items.length > 0;

  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      fetchCheckoutPreview({ items: toPreviewLines(items) })
        .then((res) => {
          if (cancelled) return;
          if (!res.success) {
            setResult({ key: cartKey, data: null });
            return;
          }
          const { preview } = res;
          if (preview.priceChanges.length > 0) {
            // Updating the cart changes its key, which fetches fresh totals.
            applyPriceChanges(preview.priceChanges);
            notifyPriceChanges();
            return;
          }
          setResult({ key: cartKey, data: { totals: preview.totals, gstMode: preview.gstMode } });
        })
        .catch(() => {
          if (!cancelled) setResult({ key: cartKey, data: null });
        });
    }, DEBOUNCE_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [active, cartKey, items, applyPriceChanges]);

  const current = active && result?.key === cartKey ? result : null;
  return { data: current?.data ?? null, isLoading: active && !current };
}
