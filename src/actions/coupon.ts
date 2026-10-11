"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { guardOrError, requireAdmin, requireApprovedCustomer } from "@/lib/auth-guard";
import { getCouponUsageSummary, removeCoupon, saveCoupon } from "@/lib/server/rpc";
import {
  MAX_CHECKOUT_LINES,
  previewCheckout,
  sanitizePreviewItems,
  type CheckoutPreview,
} from "@/lib/server/checkout/preview";
import { couponFormSchema, fieldErrors, type CouponFormInput } from "@/lib/coupons/schema";
import { toCouponFormValues, toCouponRules, toSaveCouponPayload } from "@/lib/coupons/mapping";
import { getCouponStatus } from "@/lib/coupons/status";
import type { CouponEditData, CouponFormOptions, CouponListItem, CouponRedemptionRow } from "@/lib/coupons/types";
import type { Category, Coupon, CouponRedemption, CouponUsageSummary } from "@/types/database.types";

const COUPONS_PATH = "/admin/coupons";
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// ============================================================================
// Customer: Apply Coupon at checkout
// ============================================================================

export interface ApplyCouponInput {
  code: string;
  items: { variantId: string; quantity: number; unitPrice: number }[];
}

/**
 * Previews the order with a coupon. Read-only: nothing is reserved; the
 * coupon is checked again, under a lock, when the order is placed.
 */
export async function applyCouponToCart(
  input: ApplyCouponInput
): Promise<{ success: true; preview: CheckoutPreview } | { success: false; error: string }> {
  const guard = await guardOrError(requireApprovedCustomer);
  if (!guard.ctx) return { success: false, error: "Your account must be approved before using coupons." };

  const items = sanitizePreviewItems(input.items);
  if (items.length === 0) return { success: false, error: "Your cart is empty." };
  if (items.length > MAX_CHECKOUT_LINES) return { success: false, error: "Your cart has too many lines." };

  try {
    const preview = await previewCheckout({
      userId: guard.ctx.userId,
      items,
      couponCode: String(input.code ?? "").slice(0, 64),
    });
    return { success: true, preview };
  } catch (err) {
    console.error("[applyCouponToCart]", err);
    return { success: false, error: "Coupons are unavailable right now. Please try again shortly." };
  }
}

// ============================================================================
// Admin: list, view, create, edit, delete
// ============================================================================

export async function fetchCouponsList(): Promise<CouponListItem[]> {
  await requireAdmin();
  const adminDb = createAdminClient();

  const { data, error } = await adminDb
    .from("coupons" as never)
    .select("*")
    .order("created_at", { ascending: false });
  if (error) {
    console.error("[fetchCouponsList]", error.message);
    return [];
  }

  const coupons = (data || []) as unknown as Coupon[];
  if (coupons.length === 0) return [];

  const usage = await getCouponUsageSummary(coupons.map((c) => c.id));
  const usageById = new Map<string, CouponUsageSummary>((usage.data ?? []).map((u) => [u.coupon_id, u]));
  const now = new Date();

  return coupons.map((row) => {
    const rules = toCouponRules(row);
    const u = usageById.get(row.id);
    const activeUses = Number(u?.active_uses ?? 0);
    return {
      id: row.id,
      code: row.code,
      description: row.description,
      discountType: rules.discountType,
      discountValue: rules.discountValue,
      maxDiscount: rules.maxDiscount,
      minOrderValue: rules.minOrderValue,
      validFrom: row.valid_from,
      validUntil: row.valid_until,
      maxTotalUses: rules.maxTotalUses,
      maxUsesPerCustomer: rules.maxUsesPerCustomer,
      firstOrderOnly: rules.firstOrderOnly,
      canCombine: rules.canCombine,
      appliesTo: rules.appliesTo,
      customerScope: rules.customerScope,
      isActive: rules.isActive,
      isArchived: rules.isArchived,
      version: rules.version,
      createdAt: row.created_at,
      activeUses,
      releasedUses: Number(u?.released_uses ?? 0),
      totalDiscount: Number(u?.total_discount ?? 0),
      status: getCouponStatus(rules, activeUses, now),
    };
  });
}

/** A coupon with its product / category / customer lists, as form values. */
export async function fetchCouponForEdit(couponId: string): Promise<CouponEditData | null> {
  await requireAdmin();
  if (!UUID_PATTERN.test(couponId)) return null;
  const adminDb = createAdminClient();

  const [coupon, products, categories, customers] = await Promise.all([
    adminDb.from("coupons" as never).select("*").eq("id", couponId).is("deleted_at", null).maybeSingle(),
    adminDb.from("coupon_products" as never).select("product_id").eq("coupon_id", couponId),
    adminDb.from("coupon_categories" as never).select("category_id").eq("coupon_id", couponId),
    adminDb.from("coupon_customers" as never).select("user_id").eq("coupon_id", couponId),
  ]);
  if (coupon.error || !coupon.data) return null;

  return toCouponFormValues(coupon.data as unknown as Coupon, {
    productIds: ((products.data || []) as { product_id: string }[]).map((r) => r.product_id),
    categoryIds: ((categories.data || []) as { category_id: string }[]).map((r) => r.category_id),
    customerIds: ((customers.data || []) as { user_id: string }[]).map((r) => r.user_id),
  });
}

/** Every use of a coupon, newest first, with the order it was used on. */
export async function fetchCouponRedemptions(couponId: string): Promise<CouponRedemptionRow[]> {
  await requireAdmin();
  if (!UUID_PATTERN.test(couponId)) return [];

  const { data, error } = await createAdminClient()
    .from("coupon_redemptions" as never)
    .select("*, orders(order_number, status, customer_details)")
    .eq("coupon_id", couponId)
    .order("created_at", { ascending: false })
    .limit(500);
  if (error) {
    console.error("[fetchCouponRedemptions]", error.message);
    return [];
  }

  type Row = CouponRedemption & {
    orders: { order_number: string; status: string; customer_details: { company_name?: string } | null } | null;
  };
  return ((data || []) as unknown as Row[]).map((r) => ({
    id: r.id,
    orderId: r.order_id,
    orderNumber: r.orders?.order_number ?? "-",
    orderStatus: r.orders?.status ?? "-",
    companyName: r.orders?.customer_details?.company_name ?? "-",
    discountAmount: Number(r.discount_amount),
    status: r.status,
    releaseReason: r.release_reason,
    createdAt: r.created_at,
  }));
}

/** Products, categories and approved customers for the coupon form's pickers. */
export async function fetchCouponFormOptions(): Promise<CouponFormOptions> {
  await requireAdmin();
  const adminDb = createAdminClient();

  const [products, categories, customers] = await Promise.all([
    adminDb.from("products").select("id, title, is_active").order("title"),
    adminDb.from("categories").select("id, name, parent_id, display_order").order("display_order").order("name"),
    adminDb
      .from("profiles")
      .select("id, company_name, first_name, last_name, email")
      .eq("role", "customer")
      .eq("approval_status", "approved")
      .order("company_name"),
  ]);

  return {
    products: ((products.data || []) as { id: string; title: string; is_active: boolean }[]).map((p) => ({
      id: p.id,
      title: p.title,
      isActive: p.is_active !== false,
    })),
    categories: flattenCategoryTree((categories.data || []) as Pick<Category, "id" | "name" | "parent_id">[]),
    customers: (
      (customers.data || []) as { id: string; company_name: string; first_name: string; last_name: string; email: string }[]
    ).map((c) => ({
      id: c.id,
      companyName: c.company_name,
      contactName: `${c.first_name} ${c.last_name}`.trim(),
      email: c.email,
    })),
  };
}

function flattenCategoryTree(rows: Pick<Category, "id" | "name" | "parent_id">[]): CouponFormOptions["categories"] {
  const children = new Map<string | null, typeof rows>();
  for (const row of rows) {
    const key = row.parent_id && rows.some((r) => r.id === row.parent_id) ? row.parent_id : null;
    children.set(key, [...(children.get(key) ?? []), row]);
  }
  const out: CouponFormOptions["categories"] = [];
  const seen = new Set<string>();
  const walk = (parentId: string | null, depth: number) => {
    for (const row of children.get(parentId) ?? []) {
      if (seen.has(row.id)) continue; // guards against a parent loop in the data
      seen.add(row.id);
      out.push({ id: row.id, name: row.name, parentId: row.parent_id, depth });
      walk(row.id, depth + 1);
    }
  };
  walk(null, 0);
  return out;
}

export type SaveCouponResult =
  | { success: true; id: string; message: string }
  | { success: false; error: string; fieldErrors?: Record<string, string> };

/** Create (no id) or update (id + version) a coupon and its eligibility lists. */
export async function saveCouponAction(input: CouponFormInput): Promise<SaveCouponResult> {
  const guard = await guardOrError(requireAdmin);
  if (!guard.ctx) return { success: false, error: guard.error };

  const parsed = couponFormSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: "Please fix the highlighted fields.", fieldErrors: fieldErrors(parsed.error) };
  }
  const data = parsed.data;

  const { data: saved, error } = await saveCoupon({
    coupon: toSaveCouponPayload(data),
    productIds: data.appliesTo === "products" ? data.productIds : [],
    categoryIds: data.appliesTo === "categories" ? data.categoryIds : [],
    customerIds: data.customerScope === "selected" ? data.customerIds : [],
    actorId: guard.ctx.userId,
  });

  if (error) {
    if (error.code === "UNIQUE_VIOLATION") {
      return { success: false, error: "A coupon with this code already exists.", fieldErrors: { code: "This code is already in use." } };
    }
    if (error.code === "COUPON_CHANGED") {
      return { success: false, error: "Someone else changed this coupon while you were editing. Reload it and try again." };
    }
    if (error.code === "COUPON_NOT_FOUND") {
      return { success: false, error: "This coupon no longer exists." };
    }
    return { success: false, error: "Could not save the coupon. Please check the details and try again." };
  }

  revalidatePath(COUPONS_PATH);
  return { success: true, id: saved.id, message: data.id ? `Coupon ${data.code} updated.` : `Coupon ${data.code} created.` };
}

/** Deletes a coupon that was never used; archives one that was (orders keep their record). */
export async function deleteCouponAction(
  couponId: string
): Promise<{ success: true; outcome: "deleted" | "archived"; message: string } | { success: false; error: string }> {
  const guard = await guardOrError(requireAdmin);
  if (!guard.ctx) return { success: false, error: guard.error };
  if (!UUID_PATTERN.test(couponId)) return { success: false, error: "Coupon not found." };

  const { data, error } = await removeCoupon(couponId);
  if (error) {
    return { success: false, error: error.code === "COUPON_NOT_FOUND" ? "Coupon not found." : "Could not delete the coupon." };
  }

  revalidatePath(COUPONS_PATH);
  return {
    success: true,
    outcome: data,
    message:
      data === "archived"
        ? "This coupon has been used, so it was archived instead of deleted. Past orders keep their discount record."
        : "Coupon deleted.",
  };
}

/** Turn a coupon on or off without editing anything else. */
export async function setCouponActiveAction(
  couponId: string,
  isActive: boolean
): Promise<{ success: true } | { success: false; error: string }> {
  const guard = await guardOrError(requireAdmin);
  if (!guard.ctx) return { success: false, error: guard.error };
  if (!UUID_PATTERN.test(couponId)) return { success: false, error: "Coupon not found." };

  const { data, error } = await createAdminClient()
    .from("coupons" as never)
    .update({ is_active: isActive } as never)
    .eq("id", couponId)
    .is("deleted_at", null)
    .select("id");

  if (error) return { success: false, error: "Could not update the coupon." };
  if (!data || (data as unknown[]).length === 0) return { success: false, error: "Coupon not found." };

  revalidatePath(COUPONS_PATH);
  return { success: true };
}
