import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Attribute, Category, Product, ProductVariant } from "@/types/database.types";

/**
 * Catalogue reads with full SKU data (prices, stock, reorder levels).
 *
 * Server-only: these used to be exported Server Actions, i.e. public endpoints
 * that returned every price and stock level to anyone. Storefront pages pass
 * the result through src/lib/server/storefront.ts, which hides what the viewer
 * may not see; admin screens use the guarded fetchProductsList action.
 */

type ProductRow = Omit<Product, "variants" | "categories" | "attributes" | "tags"> & {
  variants: ProductVariant[] | null;
};
interface CategoryLink {
  product_id: string;
  categories: Category | null;
}
/** product_attributes (current) or product_tags (before the rename migration). */
interface AttributeLink {
  product_id: string;
  attributes?: Attribute | null;
  tags?: Attribute | null;
}

const PRODUCT_WITH_VARIANTS = "*, variants:product_variants(*)";

/** Oldest SKU first, then by SKU code in natural order. */
function sortVariants(variants: ProductVariant[] | null): ProductVariant[] {
  return [...(variants ?? [])]
    .filter((v) => !v.is_archived)
    .sort((a, b) => {
      if (a.created_at && b.created_at && a.created_at !== b.created_at) {
        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      }
      return (a.sku || "").localeCompare(b.sku || "", undefined, { numeric: true, sensitivity: "base" });
    });
}

async function loadCategoryLinks(productIds: string[]): Promise<CategoryLink[]> {
  const { data } = await createAdminClient()
    .from("product_categories")
    .select("product_id, categories(*)")
    .in("product_id", productIds);
  return (data ?? []) as unknown as CategoryLink[];
}

/** Attributes per product; falls back to the pre-rename product_tags table. */
async function loadAttributeLinks(productIds: string[]): Promise<AttributeLink[]> {
  const db = createAdminClient();
  const { data, error } = await db
    .from("product_attributes")
    .select("product_id, attributes(*)")
    .in("product_id", productIds);
  if (!error && data && data.length > 0) return data as unknown as AttributeLink[];

  const { data: legacy } = await db.from("product_tags").select("product_id, tags(*)").in("product_id", productIds);
  return (legacy ?? []) as unknown as AttributeLink[];
}

function assemble(rows: ProductRow[], categoryLinks: CategoryLink[], attributeLinks: AttributeLink[]): Product[] {
  return rows.map((p) => {
    const attributes = attributeLinks
      .filter((l) => l.product_id === p.id)
      .map((l) => l.attributes || l.tags)
      .filter((a): a is Attribute => !!a);
    return {
      ...p,
      variants: sortVariants(p.variants),
      attributes,
      tags: attributes,
      categories: categoryLinks
        .filter((l) => l.product_id === p.id)
        .map((l) => l.categories)
        .filter((c): c is Category => !!c),
    };
  });
}

async function loadProducts(productIds?: string[]): Promise<Product[]> {
  let query = createAdminClient().from("products").select(PRODUCT_WITH_VARIANTS);
  if (productIds) query = query.in("id", productIds);
  const { data, error } = await query.order("created_at", { ascending: false });

  if (error) {
    console.error("[catalog] loadProducts:", error.message);
    return [];
  }
  const rows = (data ?? []) as unknown as ProductRow[];
  if (rows.length === 0) return [];

  const ids = rows.map((p) => p.id);
  const [categoryLinks, attributeLinks] = await Promise.all([loadCategoryLinks(ids), loadAttributeLinks(ids)]);
  return assemble(rows, categoryLinks, attributeLinks);
}

export async function getAllProducts(): Promise<Product[]> {
  try {
    return await loadProducts();
  } catch (err) {
    console.error("[catalog] getAllProducts:", err);
    return [];
  }
}

export async function getProductBySlug(slug: string): Promise<Product | null> {
  try {
    const { data, error } = await createAdminClient()
      .from("products")
      .select(PRODUCT_WITH_VARIANTS)
      .eq("slug", slug)
      .maybeSingle();
    if (error) {
      console.error("[catalog] getProductBySlug:", error.message);
      return null;
    }
    if (!data) return null;

    const row = data as unknown as ProductRow;
    const [categoryLinks, attributeLinks] = await Promise.all([loadCategoryLinks([row.id]), loadAttributeLinks([row.id])]);
    return assemble([row], categoryLinks, attributeLinks)[0];
  } catch (err) {
    console.error("[catalog] getProductBySlug:", err);
    return null;
  }
}

/** Products in a category or any of its sub-categories. */
export async function getProductsByCategory(categorySlug: string): Promise<Product[]> {
  try {
    const db = createAdminClient();
    const { data: category } = await db.from("categories").select("id, parent_id").eq("slug", categorySlug).maybeSingle();
    const target = category as Pick<Category, "id" | "parent_id"> | null;
    if (!target) return [];

    // Collect the category and all of its descendants.
    const { data: all } = await db.from("categories").select("id, parent_id");
    const categories = (all ?? []) as Pick<Category, "id" | "parent_id">[];
    const ids = new Set([target.id]);
    let grew = true;
    while (grew) {
      grew = false;
      for (const c of categories) {
        if (c.parent_id && ids.has(c.parent_id) && !ids.has(c.id)) {
          ids.add(c.id);
          grew = true;
        }
      }
    }

    let { data: links } = await db.from("product_categories").select("product_id").in("category_id", [...ids]);
    // A leaf category with no products of its own shows its parent's products.
    if ((!links || links.length === 0) && target.parent_id) {
      ({ data: links } = await db.from("product_categories").select("product_id").eq("category_id", target.parent_id));
    }

    const productIds = [...new Set(((links ?? []) as { product_id: string }[]).map((l) => l.product_id))];
    return productIds.length === 0 ? [] : await loadProducts(productIds);
  } catch (err) {
    console.error("[catalog] getProductsByCategory:", err);
    return [];
  }
}
