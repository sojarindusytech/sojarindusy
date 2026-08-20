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
  tagIds: string[];
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

export async function fetchProductsList(): Promise<Product[]> {
  const supabase = createAdminClient();

  try {
    const { data: dbProducts, error } = await supabase
      .from("products")
      .select(`
        *,
        variants:product_variants(*),
        product_tags(
          tags(*)
        )
      `)
      .order("created_at", { ascending: false });

    if (error || !dbProducts || dbProducts.length === 0) {
      return [];
    }

    const mappedProducts = dbProducts.map((p: any) => ({
      ...p,
      tags: p.product_tags?.map((pt: any) => pt.tags).filter(Boolean) || [],
    }));

    return mappedProducts as Product[];
  } catch (err) {
    return [];
  }
}

/**
 * Creates a complete Product family with multi-images, assigned categories, tags, and imported CSV SKU variants
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

    // 3. Link Tags
    if (payload.tagIds && payload.tagIds.length > 0) {
      const tagRows = payload.tagIds.map((tagId) => ({
        product_id: productId,
        tag_id: tagId,
      }));
      await supabase.from("product_tags").insert(tagRows as never);
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

      const { error: varErr } = await supabase
        .from("product_variants")
        .insert(variantRows as never);

      if (varErr) {
        // Rollback explicitly to prevent orphaned product
        await supabase.from("product_tags").delete().eq("product_id", productId);
        await supabase.from("product_categories").delete().eq("product_id", productId);
        await supabase.from("products").delete().eq("id", productId);
        
        if (varErr.code === "23505") {
          return { error: "One or more SKUs in your upload already exist in the database (or there are duplicates within the CSV). Please ensure all SKUs are unique." };
        }
        return { error: `Failed to insert SKU variants: ${varErr.message}` };
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
