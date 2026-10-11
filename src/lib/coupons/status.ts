/**
 * A coupon's status is worked out from its dates, usage and flags; it is never
 * stored, so it can't go stale.
 */
export type CouponStatus = "active" | "scheduled" | "expired" | "used_up" | "disabled" | "archived";

export function getCouponStatus(
  coupon: {
    isActive: boolean;
    isArchived: boolean;
    validFrom: Date;
    validUntil: Date | null;
    maxTotalUses: number | null;
  },
  activeUses: number,
  now: Date = new Date()
): CouponStatus {
  if (coupon.isArchived) return "archived";
  if (!coupon.isActive) return "disabled";
  if (coupon.validUntil && now > coupon.validUntil) return "expired";
  if (coupon.maxTotalUses !== null && activeUses >= coupon.maxTotalUses) return "used_up";
  if (now < coupon.validFrom) return "scheduled";
  return "active";
}

export const COUPON_STATUS_CONFIG: Record<
  CouponStatus,
  { label: string; description: string; badgeVariant: "green" | "blue" | "secondary" | "warning" | "destructive" }
> = {
  active: { label: "Active", description: "Customers can use it now", badgeVariant: "green" },
  scheduled: { label: "Scheduled", description: "Starts on its valid-from date", badgeVariant: "blue" },
  expired: { label: "Expired", description: "Past its valid-until date", badgeVariant: "secondary" },
  used_up: { label: "Used up", description: "Reached its total usage limit", badgeVariant: "warning" },
  disabled: { label: "Disabled", description: "Turned off by an admin", badgeVariant: "secondary" },
  archived: { label: "Archived", description: "Deleted after use; kept for order history", badgeVariant: "destructive" },
};
