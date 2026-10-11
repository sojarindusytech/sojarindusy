import type { CouponFormData, CouponFormInput } from "@/lib/coupons/schema";
import type { CouponAppliesTo, CouponCustomerScope, CouponDiscountType } from "@/types/database.types";

/**
 * What the form edits. Numbers stay as text while typing (so "" and "1." are
 * possible) and are converted once, on submit, into the validated schema input.
 */
export interface CouponFormState {
  id?: string;
  version?: number;
  code: string;
  description: string;
  isActive: boolean;
  discountType: CouponDiscountType;
  discountValue: string;
  maxDiscount: string;
  minOrderValue: string;
  validFrom: string;
  validUntil: string;
  totalLimit: "unlimited" | "limited";
  maxTotalUses: string;
  perCustomer: "once" | "unlimited" | "custom";
  maxUsesPerCustomer: string;
  firstOrderOnly: boolean;
  canCombine: boolean;
  appliesTo: CouponAppliesTo;
  productIds: string[];
  categoryIds: string[];
  customerScope: CouponCustomerScope;
  customerIds: string[];
}

export function emptyCouponForm(today: string): CouponFormState {
  return {
    code: "",
    description: "",
    isActive: true,
    discountType: "percent",
    discountValue: "",
    maxDiscount: "",
    minOrderValue: "0",
    validFrom: today,
    validUntil: "",
    totalLimit: "unlimited",
    maxTotalUses: "",
    perCustomer: "once",
    maxUsesPerCustomer: "1",
    firstOrderOnly: false,
    canCombine: false,
    appliesTo: "all",
    productIds: [],
    categoryIds: [],
    customerScope: "all",
    customerIds: [],
  };
}

const text = (n: number | null | undefined) => (n === null || n === undefined ? "" : String(n));

export function couponFormFromData(data: CouponFormData): CouponFormState {
  const perCustomer =
    data.maxUsesPerCustomer === null ? "unlimited" : data.maxUsesPerCustomer === 1 ? "once" : "custom";
  return {
    id: data.id,
    version: data.version,
    code: data.code,
    description: data.description,
    isActive: data.isActive,
    discountType: data.discountType,
    discountValue: text(data.discountValue),
    maxDiscount: text(data.maxDiscount),
    minOrderValue: text(data.minOrderValue),
    validFrom: data.validFrom,
    validUntil: data.validUntil ?? "",
    totalLimit: data.maxTotalUses === null ? "unlimited" : "limited",
    maxTotalUses: text(data.maxTotalUses),
    perCustomer,
    maxUsesPerCustomer: text(data.maxUsesPerCustomer),
    firstOrderOnly: data.firstOrderOnly,
    canCombine: data.canCombine,
    appliesTo: data.appliesTo,
    productIds: data.productIds,
    categoryIds: data.categoryIds,
    customerScope: data.customerScope,
    customerIds: data.customerIds,
  };
}

/** "" -> NaN for required numbers, so validation reports them as missing. */
const required = (s: string) => (s.trim() === "" ? Number.NaN : Number(s));
const optional = (s: string) => (s.trim() === "" ? null : Number(s));

export function couponFormToInput(s: CouponFormState): CouponFormInput {
  return {
    id: s.id,
    version: s.version,
    code: s.code,
    description: s.description,
    isActive: s.isActive,
    discountType: s.discountType,
    discountValue: required(s.discountValue),
    maxDiscount: s.discountType === "percent" ? optional(s.maxDiscount) : null,
    minOrderValue: s.minOrderValue.trim() === "" ? 0 : Number(s.minOrderValue),
    validFrom: s.validFrom,
    validUntil: s.validUntil || null,
    maxTotalUses: s.totalLimit === "unlimited" ? null : required(s.maxTotalUses),
    maxUsesPerCustomer:
      s.perCustomer === "unlimited" ? null : s.perCustomer === "once" ? 1 : required(s.maxUsesPerCustomer),
    firstOrderOnly: s.firstOrderOnly,
    canCombine: s.canCombine,
    appliesTo: s.appliesTo,
    productIds: s.appliesTo === "products" ? s.productIds : [],
    categoryIds: s.appliesTo === "categories" ? s.categoryIds : [],
    customerScope: s.customerScope,
    customerIds: s.customerScope === "selected" ? s.customerIds : [],
  };
}
