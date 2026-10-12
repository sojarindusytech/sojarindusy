import type { CouponAppliesTo, CouponCustomerScope, CouponDiscountType, CouponRedemptionStatus } from "@/types/database.types";
import type { CouponStatus } from "@/lib/coupons/status";
import type { CouponFormData } from "@/lib/coupons/schema";

/** One row of the admin coupon list. Dates are ISO strings (serialisable). */
export interface CouponListItem {
  id: string;
  code: string;
  description: string | null;
  discountType: CouponDiscountType;
  discountValue: number;
  maxDiscount: number | null;
  minOrderValue: number;
  validFrom: string;
  validUntil: string | null;
  maxTotalUses: number | null;
  maxUsesPerCustomer: number | null;
  firstOrderOnly: boolean;
  canCombine: boolean;
  appliesTo: CouponAppliesTo;
  customerScope: CouponCustomerScope;
  isActive: boolean;
  isArchived: boolean;
  version: number;
  createdAt: string;
  /** Uses that count against the limit (placed, not cancelled). */
  activeUses: number;
  /** Uses given back by cancelled orders. */
  releasedUses: number;
  /** Total rupees discounted on orders that still count. */
  totalDiscount: number;
  status: CouponStatus;
}

export interface CouponRedemptionRow {
  id: string;
  orderId: string;
  orderNumber: string;
  orderStatus: string;
  companyName: string;
  discountAmount: number;
  status: CouponRedemptionStatus;
  releaseReason: string | null;
  createdAt: string;
}

export interface CouponFormOptions {
  products: { id: string; title: string; isActive: boolean }[];
  categories: { id: string; name: string; parentId: string | null; depth: number }[];
  customers: { id: string; companyName: string; contactName: string; email: string }[];
}

export type CouponEditData = CouponFormData;
