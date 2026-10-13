import "server-only";
import { getAuthContext, isAdminRole } from "@/lib/auth-guard";
import { APPROVAL_STATUSES } from "@/lib/constants";
import type { Product, ProductVariant } from "@/types/database.types";

/**
 * Who is looking at the storefront, and what they may see.
 *
 * Prices and stock are for approved customers (and admins) only. Everything
 * passed to a Client Component ends up in the page sent to the browser, so
 * hiding a price in the UI is not enough: it must not be in the data.
 */
export interface StorefrontViewer {
  isLoggedIn: boolean;
  isAdmin: boolean;
  /** Approved customer or admin. */
  canViewPrices: boolean;
  /** Signed-in customer still waiting for approval. */
  isPendingApproval: boolean;
}

const ANONYMOUS: StorefrontViewer = {
  isLoggedIn: false,
  isAdmin: false,
  canViewPrices: false,
  isPendingApproval: false,
};

export async function getStorefrontViewer(): Promise<StorefrontViewer> {
  const ctx = await getAuthContext();
  if (!ctx) return ANONYMOUS;

  const isAdmin = isAdminRole(ctx.role);
  const isCustomer = ctx.role === "customer";
  const approved = ctx.approvalStatus === APPROVAL_STATUSES.APPROVED;
  return {
    isLoggedIn: true,
    isAdmin,
    canViewPrices: isAdmin || (isCustomer && approved),
    isPendingApproval: isCustomer && !approved,
  };
}

/**
 * Builds the SKU sent to the browser from an explicit allow-list, so a new
 * column added to product_variants is never exposed by accident. Reorder
 * levels (min_quantity, trigger_quantity) are internal and never included.
 */
function toStorefrontVariant(v: ProductVariant, viewer: StorefrontViewer): ProductVariant {
  return {
    id: v.id,
    product_id: v.product_id,
    sku: v.sku,
    diameter: v.diameter ?? null,
    flute_length: v.flute_length ?? null,
    overall_length: v.overall_length ?? null,
    shank_diameter: v.shank_diameter ?? null,
    min_order_quantity: v.min_order_quantity,
    specifications: v.specifications ?? {},
    created_at: v.created_at,
    // Hidden values are sent as 0 and the UI does not render them.
    list_price: viewer.canViewPrices ? Number(v.list_price) : 0,
    // Customers see what they can actually buy: on hand minus units reserved by open orders.
    stock_quantity: viewer.canViewPrices ? Math.max(0, Number(v.stock_quantity) - (Number(v.reserved_quantity) || 0)) : 0,
  };
}

/** Inactive products are visible to admins only (they cannot be ordered). */
export function isVisibleOnStorefront(product: Product, viewer: StorefrontViewer): boolean {
  return product.is_active !== false || viewer.isAdmin;
}

export function toStorefrontProduct(product: Product, viewer: StorefrontViewer): Product {
  return {
    ...product,
    variants: (product.variants ?? []).map((v) => toStorefrontVariant(v, viewer)),
  };
}

export function toStorefrontProducts(products: Product[], viewer: StorefrontViewer): Product[] {
  return products.filter((p) => isVisibleOnStorefront(p, viewer)).map((p) => toStorefrontProduct(p, viewer));
}
