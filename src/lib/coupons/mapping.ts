import type { Coupon, CouponCheckoutContext } from "@/types/database.types";
import type { CouponCustomerContext, CouponRules } from "@/lib/coupons/engine";
import type { CouponFormData } from "@/lib/coupons/schema";
import { istDayEnd, istDayStart, toIstDateInput } from "@/lib/coupons/dates";

const num = (v: number | string | null | undefined): number | null =>
  v === null || v === undefined || v === "" ? null : Number(v);

/** A coupons row (numeric columns may arrive as strings) -> engine rules. */
export function toCouponRules(row: Coupon): CouponRules {
  return {
    id: row.id,
    code: row.code,
    description: row.description,
    discountType: row.discount_type,
    discountValue: Number(row.discount_value),
    maxDiscount: num(row.max_discount),
    minOrderValue: Number(row.min_order_value) || 0,
    validFrom: new Date(row.valid_from),
    validUntil: row.valid_until ? new Date(row.valid_until) : null,
    maxTotalUses: row.max_total_uses,
    maxUsesPerCustomer: row.max_uses_per_customer,
    firstOrderOnly: row.first_order_only,
    canCombine: row.can_combine,
    appliesTo: row.applies_to,
    customerScope: row.customer_scope,
    isActive: row.is_active,
    isArchived: row.deleted_at !== null,
    version: row.version,
  };
}

export function toCustomerContext(ctx: CouponCheckoutContext): CouponCustomerContext {
  return {
    totalUses: Number(ctx.total_uses) || 0,
    customerUses: Number(ctx.customer_uses) || 0,
    customerAllowed: ctx.customer_allowed,
    hasPriorOrders: ctx.has_prior_orders,
    productIds: ctx.product_ids ?? [],
    categoryIds: ctx.category_ids ?? [],
  };
}

/** Validated form data -> the coupon object save_coupon() expects. */
export function toSaveCouponPayload(data: CouponFormData): Record<string, unknown> {
  return {
    id: data.id ?? null,
    version: data.version ?? null,
    code: data.code,
    description: data.description || null,
    discount_type: data.discountType,
    discount_value: data.discountValue,
    // A cap only means something for percentage coupons.
    max_discount: data.discountType === "percent" ? data.maxDiscount : null,
    min_order_value: data.minOrderValue,
    valid_from: istDayStart(data.validFrom),
    valid_until: data.validUntil ? istDayEnd(data.validUntil) : null,
    max_total_uses: data.maxTotalUses,
    max_uses_per_customer: data.maxUsesPerCustomer,
    first_order_only: data.firstOrderOnly,
    can_combine: data.canCombine,
    applies_to: data.appliesTo,
    customer_scope: data.customerScope,
    is_active: data.isActive,
  };
}

/** A stored coupon + its lists -> the admin form's initial values. */
export function toCouponFormValues(
  row: Coupon,
  lists: { productIds: string[]; categoryIds: string[]; customerIds: string[] }
): CouponFormData {
  return {
    id: row.id,
    version: row.version,
    code: row.code,
    description: row.description ?? "",
    discountType: row.discount_type,
    discountValue: Number(row.discount_value),
    maxDiscount: num(row.max_discount),
    minOrderValue: Number(row.min_order_value) || 0,
    validFrom: toIstDateInput(row.valid_from),
    validUntil: row.valid_until ? toIstDateInput(row.valid_until) : null,
    maxTotalUses: row.max_total_uses,
    maxUsesPerCustomer: row.max_uses_per_customer,
    firstOrderOnly: row.first_order_only,
    canCombine: row.can_combine,
    appliesTo: row.applies_to,
    productIds: lists.productIds,
    categoryIds: lists.categoryIds,
    customerScope: row.customer_scope,
    customerIds: lists.customerIds,
    isActive: row.is_active,
  };
}
