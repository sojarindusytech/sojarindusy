import { formatInr } from "@/lib/pricing";
import { formatIstDate } from "@/lib/coupons/dates";
import type { CouponListItem } from "@/lib/coupons/types";

/** "10% off, up to ₹2,000.00" / "₹500.00 off" */
export function describeDiscount(c: Pick<CouponListItem, "discountType" | "discountValue" | "maxDiscount">): string {
  if (c.discountType === "fixed") return `${formatInr(c.discountValue)} off`;
  const pct = `${Number.isInteger(c.discountValue) ? c.discountValue : c.discountValue.toFixed(2)}% off`;
  return c.maxDiscount ? `${pct}, up to ${formatInr(c.maxDiscount)}` : pct;
}

/** "1 Oct 2026 – 31 Oct 2026" / "From 1 Oct 2026" */
export function describeValidity(c: Pick<CouponListItem, "validFrom" | "validUntil">): string {
  return c.validUntil
    ? `${formatIstDate(c.validFrom)} – ${formatIstDate(c.validUntil)}`
    : `From ${formatIstDate(c.validFrom)}`;
}

/** "12 / 50" or "12 / ∞" */
export function describeUsage(c: Pick<CouponListItem, "activeUses" | "maxTotalUses">): string {
  return `${c.activeUses} / ${c.maxTotalUses ?? "∞"}`;
}

export function describePerCustomer(limit: number | null): string {
  if (limit === null) return "Unlimited per customer";
  if (limit === 1) return "Once per customer";
  return `Up to ${limit} per customer`;
}

export function describeScope(c: Pick<CouponListItem, "appliesTo" | "customerScope" | "firstOrderOnly">): string {
  const what = { all: "All products", products: "Selected products", categories: "Selected categories" }[c.appliesTo];
  const who = c.customerScope === "all" ? "all customers" : "selected customers";
  return `${what} · ${who}${c.firstOrderOnly ? " · first order only" : ""}`;
}
