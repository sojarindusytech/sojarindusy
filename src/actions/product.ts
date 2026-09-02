"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { Product, ProductVariant, ProductImage } from "@/types/database.types";
import { generateSlug, uploadCategoryImage } from "@/actions/category";
import { revalidatePath } from "next/cache";

export interface CreateProductPayload {
  title: string;
  slug?: string;
  shortDescription?: string;
  description?: string;
  images: ProductImage[];
  categoryIds: string[];
  attributeIds?: string[];
  tagIds?: string[];
  variants: Array<{
    sku: string;
    diameter?: number | null;
    flute_length?: number | null;
    overall_length?: number | null;
    shank_diameter?: number | null;
    list_price: number;
    stock_quantity: number;
    specifications?: Record<string, any>;
  }>;
}

function sortVariants(variants: any[]): ProductVariant[] {
  if (!variants || !Array.isArray(variants)) return [];
  return [...variants].sort((a, b) => {
    if (a.created_at && b.created_at && a.created_at !== b.created_at) {
      return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    }
    return (a.sku || "").localeCompare(b.sku || "", undefined, { numeric: true, sensitivity: "base" });
  });
}

export async function fetchProductsList(): Promise<Product[]> {
  const supabase = createAdminClient();

  try {
    // Attempt fetch with product_attributes(attributes(*))
    let { data: dbProducts, error } = await supabase
      .from("products")
      .select(`
        *,
        variants:product_variants(*),
        product_attributes(
          attributes(*)
        )
      `)
      .order("created_at", { ascending: false });

    // Fallback if table not yet renamed
    if (error && error.code === "42P01") {
      const fallback = await supabase
        .from("products")
        .select(`
          *,
          variants:product_variants(*),
          product_tags(
            tags(*)
          )
        `)
        .order("created_at", { ascending: false });
      dbProducts = fallback.data as any;
      error = fallback.error;
    }

    if (error) {
      console.error("fetchProductsList Supabase Error:", error);
      return [];
    }
    if (!dbProducts || dbProducts.length === 0) {
      return [];
    }

    // Workaround for missing foreign key from product_categories to products
    const { data: catLinks } = await supabase
      .from("product_categories")
      .select(`
        product_id,
        categories(*)
      `);

    const mappedProducts = dbProducts.map((p: any) => {
      const pCats = catLinks?.filter((link: any) => link.product_id === p.id) || [];
      const attrs = 
        p.product_attributes?.map((pa: any) => pa.attributes).filter(Boolean) ||
        p.product_tags?.map((pt: any) => pt.tags).filter(Boolean) ||
        [];

      return {
        ...p,
        variants: sortVariants(p.variants),
        attributes: attrs,
        tags: attrs,
        categories: pCats.map((pc: any) => pc.categories).filter(Boolean),
      };
    });

    return mappedProducts as Product[];
  } catch (err) {
    return [];
  }
}

export async function fetchProductBySlug(slug: string): Promise<Product | null> {
  const supabase = createAdminClient();

  try {
    let { data, error } = await supabase
      .from("products")
      .select(`
        *,
        variants:product_variants(*),
        product_attributes(
          attributes(*)
        )
      `)
      .eq("slug", slug)
      .single();

    if (error && error.code === "42P01") {
      const fallback = await supabase
        .from("products")
        .select(`
          *,
          variants:product_variants(*),
          product_tags(
            tags(*)
          )
        `)
        .eq("slug", slug)
        .single();
      data = fallback.data as any;
      error = fallback.error;
    }

    const dbProduct = data as any;

    if (error || !dbProduct) {
      return null;
    }

    const { data: catLinks } = await supabase
      .from("product_categories")
      .select(`categories(*)`)
      .eq("product_id", dbProduct.id);

    const attrs =
      dbProduct.product_attributes?.map((pa: any) => pa.attributes).filter(Boolean) ||
      dbProduct.product_tags?.map((pt: any) => pt.tags).filter(Boolean) ||
      [];

    const mappedProduct = {
      ...dbProduct,
      variants: sortVariants(dbProduct.variants?.filter((v: any) => !v.is_archived) || []),
      attributes: attrs,
      tags: attrs,
      categories: catLinks?.map((pc: any) => pc.categories).filter(Boolean) || [],
    };

    return mappedProduct as Product;
  } catch (err) {
    return null;
  }
}

export async function fetchProductsByCategory(categorySlug: string): Promise<Product[]> {
  const supabase = createAdminClient();

  try {
    const { data: catData, error: catError } = await supabase
      .from("categories")
      .select("id")
      .eq("slug", categorySlug)
      .single();

    const categoryData = catData as any;

    if (catError || !categoryData) return [];

    const { data: linkData, error: linkError } = await supabase
      .from("product_categories")
      .select("product_id")
      .eq("category_id", categoryData.id);

    if (linkError || !linkData || linkData.length === 0) return [];

    const productIds = linkData.map((l: any) => l.product_id);

    let { data: dbProducts, error } = await supabase
      .from("products")
      .select(`
        *,
        variants:product_variants(*),
        product_attributes(
          attributes(*)
        )
      `)
      .in("id", productIds)
      .order("created_at", { ascending: false });

    if (error && error.code === "42P01") {
      const fallback = await supabase
        .from("products")
        .select(`
          *,
          variants:product_variants(*),
          product_tags(
            tags(*)
          )
        `)
        .in("id", productIds)
        .order("created_at", { ascending: false });
      dbProducts = fallback.data as any;
      error = fallback.error;
    }

    if (error || !dbProducts || dbProducts.length === 0) return [];

    const { data: catLinks } = await supabase
      .from("product_categories")
      .select(`product_id, categories(*)`)
      .in("product_id", dbProducts.map((p: any) => p.id));

    return dbProducts.map((p: any) => {
      const pCats = catLinks?.filter((link: any) => link.product_id === p.id) || [];
      const attrs =
        p.product_attributes?.map((pa: any) => pa.attributes).filter(Boolean) ||
        p.product_tags?.map((pt: any) => pt.tags).filter(Boolean) ||
        [];

      return {
        ...p,
        variants: sortVariants(p.variants),
        attributes: attrs,
        tags: attrs,
        categories: pCats.map((pc: any) => pc.categories).filter(Boolean),
      };
    }) as Product[];
  } catch (err) {
    return [];
  }
}

/**
 * Creates a complete Product family with multi-images, assigned categories, attributes, and imported CSV SKU variants
 */
export async function createFullProduct(payload: CreateProductPayload): Promise<{
  success?: boolean;
  error?: string;
  productId?: string;
}> {
  const supabase = createAdminClient();

  const title = payload.title?.trim();
  if (!title) {
    return { error: "Product title is required." };
  }

  const slug = payload.slug ? await generateSlug(payload.slug) : await generateSlug(title);

  try {
    // 1. Insert Parent Product
    const { data: productData, error: productErr } = await supabase
      .from("products")
      .insert({
        title,
        slug,
        short_description: payload.shortDescription || null,
        description: payload.description || null,
        images: payload.images || [],
        is_active: true,
      } as never)
      .select()
      .single();

    if (productErr) {
      if (productErr.code === "23505") {
        return { error: `Product with slug "${slug}" or title already exists.` };
      }
      return { error: productErr.message };
    }

    const productId = (productData as Product).id;

    // 2. Link Categories
    if (payload.categoryIds && payload.categoryIds.length > 0) {
      const categoryRows = payload.categoryIds.map((catId) => ({
        product_id: productId,
        category_id: catId,
      }));
      await supabase.from("product_categories").insert(categoryRows as never);
    }

    // 3. Link Attributes / Tags
    const attrIds = payload.attributeIds || payload.tagIds || [];
    if (attrIds.length > 0) {
      const attributeRows = attrIds.map((attrId) => ({
        product_id: productId,
        attribute_id: attrId,
      }));

      const { error: attrErr } = await supabase.from("product_attributes").insert(attributeRows as never);
      if (attrErr && attrErr.code === "42P01") {
        // Fallback to product_tags
        const tagRows = attrIds.map((tId) => ({
          product_id: productId,
          tag_id: tId,
        }));
        await supabase.from("product_tags").insert(tagRows as never);
      }
    }

    // 4. Insert Variants (SKU rows from CSV)
    if (payload.variants && payload.variants.length > 0) {
      const variantRows = payload.variants.map((v) => ({
        product_id: productId,
        sku: v.sku,
        diameter: v.diameter ?? null,
        flute_length: v.flute_length ?? null,
        overall_length: v.overall_length ?? null,
        shank_diameter: v.shank_diameter ?? null,
        list_price: Number(v.list_price) || 0,
        stock_quantity: Number(v.stock_quantity) || 0,
        specifications: v.specifications || {},
      }));

      const { data: insertedVariantsData, error: varErr } = await supabase
        .from("product_variants")
        .insert(variantRows as never)
        .select("id, sku, stock_quantity, product_id");

      if (varErr) {
        // Rollback explicitly to prevent orphaned product
        await supabase.from("product_attributes").delete().eq("product_id", productId);
        await supabase.from("product_tags").delete().eq("product_id", productId);
        await supabase.from("product_categories").delete().eq("product_id", productId);
        await supabase.from("products").delete().eq("id", productId);
        
        if (varErr.code === "23505") {
          return { error: "One or more SKUs in your upload already exist in the database (or there are duplicates within the CSV). Please ensure all SKUs are unique." };
        }
        return { error: `Failed to insert SKU variants: ${varErr.message}` };
      }

      const insertedVariants = (insertedVariantsData || []) as any[];
      // Record initial inventory logs for created variants
      if (insertedVariants && insertedVariants.length > 0) {
        const { recordStockMovement } = await import("@/actions/inventory");
        for (const v of insertedVariants) {
          const stockQty = Number(v.stock_quantity) || 0;
          if (stockQty > 0) {
            await recordStockMovement({
              variantId: v.id,
              productId: v.product_id,
              skuCode: v.sku,
              productTitle: payload.title.trim(),
              movementType: "INITIAL_IMPORT",
              quantityDelta: stockQty,
              balanceBefore: 0,
              balanceAfter: stockQty,
              notes: "Initial CSV batch upload",
            });
          }
        }
      }
    }

    revalidatePath("/admin/products");
    revalidatePath("/admin/product-upload");
    return { success: true, productId };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to create product batch." };
  }
}

export async function deleteProduct(productId: string): Promise<{ success?: boolean; error?: string }> {
  const supabase = createAdminClient();

  try {
    const { error } = await supabase.from("products").delete().eq("id", productId);
    if (error) return { error: error.message };

    revalidatePath("/admin/products");
    return { success: true };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to delete product." };
  }
}

/**
 * Upload product image to Supabase Storage
 */
export async function uploadProductImage(formData: FormData): Promise<{
  publicUrl?: string;
  error?: string;
}> {
  return uploadCategoryImage(formData);
}
