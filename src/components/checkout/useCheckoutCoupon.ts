"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { applyCouponToCart } from "@/actions/coupon";
import type { CartItem } from "@/context/CartContext";
import { cartKeyOf, notifyPriceChanges, toPreviewLines as toLines, type ServerTotals } from "./useCheckoutPreview";

export interface AppliedCoupon extends ServerTotals {
  code: string;
  description: string | null;
  discount: number;
  /** The cart these totals (server-computed, with the discount) were computed for. */
  cartKey: string;
}

/**
 * Coupon state for checkout. Every discount shown comes from the server; when
 * the cart changes after a coupon is applied, it is re-checked automatically
 * so the customer never sees a stale discount.
 */
export function useCheckoutCoupon(
  items: CartItem[],
  applyPriceChanges: (changes: { variantId: string; newPrice: number }[]) => void
) {
  const [applied, setApplied] = useState<AppliedCoupon | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isApplying, startTransition] = useTransition();
  const cartKey = cartKeyOf(items);

  const runPreview = useCallback(
    async (code: string, forItems: CartItem[]) => {
      let res: Awaited<ReturnType<typeof applyCouponToCart>>;
      try {
        res = await applyCouponToCart({ code, items: toLines(forItems) });
      } catch {
        setApplied(null);
        setError("We couldn't check this coupon. Please check your connection and try again.");
        return;
      }
      if (!res.success) {
        setApplied(null);
        setError(res.error);
        return;
      }
      const { preview } = res;
      if (preview.priceChanges.length > 0) {
        // Prices moved since the items were added: update the cart, which
        // triggers a fresh check with the new prices.
        applyPriceChanges(preview.priceChanges);
        notifyPriceChanges();
      }
      if (preview.couponError || !preview.coupon) {
        setApplied(null);
        setError(preview.couponError?.message ?? "This coupon code isn't valid.");
        return;
      }
      setError(null);
      setApplied({
        code: preview.coupon.code,
        description: preview.coupon.description,
        discount: preview.coupon.discount,
        totals: preview.totals,
        gstMode: preview.gstMode,
        cartKey: cartKeyOf(forItems),
      });
    },
    [applyPriceChanges]
  );

  const apply = (rawCode: string) => {
    const code = rawCode.trim();
    if (!code) {
      setError("Please enter a coupon code.");
      return;
    }
    startTransition(() => runPreview(code, items));
  };

  const remove = () => {
    setApplied(null);
    setError(null);
  };

  /** After a failed order: drop the coupon and show why. */
  const reject = (message: string) => {
    setApplied(null);
    setError(message);
  };

  // Re-check after the cart changes.
  const isStale = !!applied && applied.cartKey !== cartKey;
  useEffect(() => {
    if (!applied || applied.cartKey === cartKey) return;
    let cancelled = false;
    applyCouponToCart({ code: applied.code, items: toLines(items) })
      .then((res) => {
        if (cancelled) return;
        if (!res.success || res.preview.couponError || !res.preview.coupon) {
          setApplied(null);
          setError(
            res.success ? res.preview.couponError?.message ?? "This coupon no longer applies." : res.error
          );
          return;
        }
        setApplied({
          code: res.preview.coupon.code,
          description: res.preview.coupon.description,
          discount: res.preview.coupon.discount,
          totals: res.preview.totals,
          gstMode: res.preview.gstMode,
          cartKey,
        });
      })
      .catch(() => {
        if (cancelled) return;
        // Never leave a stale discount on screen: drop it and let them re-apply.
        setApplied(null);
        setError("We couldn't refresh your coupon. Please apply it again.");
      });
    return () => {
      cancelled = true;
    };
  }, [applied, cartKey, items]);

  return {
    applied: isStale ? null : applied,
    /** The coupon to send with the order (even while its totals refresh). */
    appliedCode: applied?.code ?? null,
    error,
    isApplying,
    isRefreshing: isStale,
    apply,
    remove,
    reject,
  };
}
