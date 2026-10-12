import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { roundMoney } from "@/lib/pricing";

/** A cart line as the browser sends it. Only variantId and quantity are trusted. */
export interface CartLineInput {
  variantId: string;
  quantity: number;
  /** The price the customer saw. Used to detect price changes, never to charge. */
  unitPrice: number;
  specifications?: Record<string, string>;
}

/** A cart line priced from the database. */
export interface PricedCartLine {
  variantId: string;
  productId: string;
  sku: string;
  productTitle: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  minOrderQuantity: number;
  /** The SKU's own GST %; null means the Sales Settings default. */
  gstRate: number | null;
  /** Categories the product is directly assigned to. */
  categoryIds: string[];
  specifications: Record<string, string>;
}

export interface PriceChange {
  variantId: string;
  sku: string;
  oldPrice: number;
  newPrice: number;
}

export interface PricedCart {
  lines: PricedCartLine[];
  subtotal: number;
  /** Lines whose current price differs from what the customer saw. */
  priceChanges: PriceChange[];
  /** SKUs that are archived, inactive or no longer exist. */
  unavailable: string[];
  /** Lines below the SKU's minimum order quantity. */
  belowMinimum: { sku: string; min: number }[];
}

interface VariantRow {
  id: string;
  sku: string;
  list_price: number | string;
  min_order_quantity: number | null;
  gst_rate: number | string | null;
  is_archived: boolean | null;
  product_id: string;
  products: { id: string; title: string; is_active: boolean } | null;
}

/** Combines repeated SKUs into one line, keeping the first price seen. */
export function mergeCartLines(lines: CartLineInput[]): CartLineInput[] {
  const merged = new Map<string, CartLineInput>();
  for (const line of lines) {
    const existing = merged.get(line.variantId);
    if (existing) {
      existing.quantity += line.quantity;
    } else {
      merged.set(line.variantId, { ...line });
    }
  }
  return [...merged.values()];
}

/** Prices a cart against the current catalogue. Does not lock or change anything. */
export async function loadPricedCart(input: CartLineInput[]): Promise<PricedCart> {
  const lines = mergeCartLines(input);
  const adminDb = createAdminClient();

  const { data: variantData, error } = await adminDb
    .from("product_variants")
    .select("id, sku, list_price, min_order_quantity, gst_rate, is_archived, product_id, products(id, title, is_active)")
    .in("id", lines.map((l) => l.variantId));
  if (error) throw new Error(`Could not load cart SKUs: ${error.message}`);

  const variants = new Map(((variantData || []) as unknown as VariantRow[]).map((v) => [v.id, v]));
  const productIds = [...new Set([...variants.values()].map((v) => v.product_id))];

  const categoriesByProduct = new Map<string, string[]>();
  if (productIds.length > 0) {
    const { data: links } = await adminDb
      .from("product_categories")
      .select("product_id, category_id")
      .in("product_id", productIds);
    for (const link of (links || []) as { product_id: string; category_id: string }[]) {
      const list = categoriesByProduct.get(link.product_id) ?? [];
      list.push(link.category_id);
      categoriesByProduct.set(link.product_id, list);
    }
  }

  const result: PricedCart = { lines: [], subtotal: 0, priceChanges: [], unavailable: [], belowMinimum: [] };

  for (const line of lines) {
    const v = variants.get(line.variantId);
    if (!v || v.is_archived || !v.products?.is_active) {
      result.unavailable.push(v?.sku ?? line.variantId);
      continue;
    }

    const unitPrice = Number(v.list_price);
    const minOrderQuantity = Math.max(1, Number(v.min_order_quantity) || 1);

    if (roundMoney(line.unitPrice) !== roundMoney(unitPrice)) {
      result.priceChanges.push({ variantId: v.id, sku: v.sku, oldPrice: line.unitPrice, newPrice: unitPrice });
    }
    if (line.quantity < minOrderQuantity) {
      result.belowMinimum.push({ sku: v.sku, min: minOrderQuantity });
    }

    const lineTotal = roundMoney(unitPrice * line.quantity);
    result.subtotal = roundMoney(result.subtotal + lineTotal);
    result.lines.push({
      variantId: v.id,
      productId: v.product_id,
      sku: v.sku,
      productTitle: v.products.title,
      quantity: line.quantity,
      unitPrice,
      lineTotal,
      minOrderQuantity,
      gstRate: v.gst_rate === null || v.gst_rate === undefined || v.gst_rate === "" ? null : Number(v.gst_rate),
      categoryIds: categoriesByProduct.get(v.product_id) ?? [],
      specifications: line.specifications ?? {},
    });
  }

  return result;
}
