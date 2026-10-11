"use client";

import { useState } from "react";
import { Loader2, TicketPercent, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatInr } from "@/lib/pricing";
import type { AppliedCoupon } from "./useCheckoutCoupon";

interface CouponBoxProps {
  applied: AppliedCoupon | null;
  error: string | null;
  isApplying: boolean;
  isRefreshing: boolean;
  disabled?: boolean;
  onApply: (code: string) => void;
  onRemove: () => void;
}

/** "Have a coupon?" input, or the applied coupon with a Remove link. */
export function CouponBox({ applied, error, isApplying, isRefreshing, disabled, onApply, onRemove }: CouponBoxProps) {
  const [code, setCode] = useState("");

  return (
    <div className="space-y-2 border-t border-slate-100 pt-3">
      <label htmlFor="coupon-code" className="flex items-center gap-1.5 text-xs font-semibold text-slate-700">
        <TicketPercent className="h-3.5 w-3.5 text-[#024AE5]" /> Have a coupon?
      </label>

      {applied || isRefreshing ? (
        <div className="flex items-start justify-between gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2">
          <div className="min-w-0 text-xs">
            {isRefreshing || !applied ? (
              <p className="flex items-center gap-1.5 text-emerald-800">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Updating your discount…
              </p>
            ) : (
              <>
                <p className="font-mono font-bold text-emerald-900">{applied.code}</p>
                <p className="text-[11px] text-emerald-800">
                  {applied.description ? `${applied.description} · ` : ""}You save {formatInr(applied.discount)}
                </p>
              </>
            )}
          </div>
          <button
            type="button"
            onClick={() => {
              setCode("");
              onRemove();
            }}
            className="inline-flex shrink-0 items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-semibold text-emerald-900 hover:bg-emerald-100"
          >
            <X className="h-3 w-3" /> Remove
          </button>
        </div>
      ) : (
        <div className="flex gap-2">
          <Input
            id="coupon-code"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            onKeyDown={(e) => {
              // Enter applies the coupon instead of submitting the order form.
              if (e.key === "Enter") {
                e.preventDefault();
                if (!isApplying && !disabled) onApply(code);
              }
            }}
            placeholder="Enter coupon code"
            maxLength={32}
            autoComplete="off"
            disabled={disabled}
            aria-invalid={!!error || undefined}
            aria-describedby={error ? "coupon-error" : undefined}
            className="h-9 font-mono text-xs uppercase"
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onApply(code)}
            disabled={disabled || isApplying || !code.trim()}
            className="h-9 shrink-0 px-4 text-xs font-bold"
          >
            {isApplying ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Apply"}
          </Button>
        </div>
      )}

      {error && (
        <p id="coupon-error" role="alert" className="text-[11px] font-medium text-rose-600">
          {error}
        </p>
      )}
    </div>
  );
}
