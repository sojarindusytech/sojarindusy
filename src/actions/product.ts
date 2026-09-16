"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { Product, ProductVariant, ProductImage, ProductDocument } from "@/types/database.types";
import { generateSlug, uploadCategoryImage } from "@/actions/category";
import { revalidatePath } from "next/cache";

export interface CreateProductPayload {
  title: string;
  slug?: string;
  shortDescription?: string;
  description?: string;
  images: ProductImage[];
  documents?: ProductDocument[];
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
    const { data: dbProducts, error }: any = await (supabase.from("products") as any)
      .select(`
        *,
        variants:product_variants(*)
      `)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("fetchProductsList Error:", error);
      return [];
    }
    if (!dbProducts || dbProducts.length === 0) {
      return [];
    }

    const productIds = dbProducts.map((p: any) => p.id);

    // Fetch categories junction
    const { data: catLinks }: any = await (supabase.from("product_categories") as any)
      .select(`product_id, categories(*)`)
      .in("product_id", productIds);

    // Fetch attributes junction (with fallback to product_tags)
    let attrLinks: any[] = [];
    const { data: paData, error: paError }: any = await (supabase.from("product_attributes") as any)
      .select(`product_id, attributes(*)`)
      .in("product_id", productIds);

    if (!paError && paData) {
      attrLinks = paData;
    } else {
      const { data: ptData }: any = await (supabase.from("product_tags") as any)
        .select(`product_id, tags(*)`)
        .in("product_id", productIds);
      if (ptData) attrLinks = ptData;
    }

    return dbProducts.map((p: any) => {
      const pCats = catLinks?.filter((link: any) => link.product_id === p.id) || [];
      const pAttrs =
        attrLinks
          ?.filter((link: any) => link.product_id === p.id)
          .map((link: any) => link.attributes || link.tags)
          .filter(Boolean) || [];

      return {
        ...p,
        variants: sortVariants(p.variants?.filter((v: any) => !v.is_archived) || []),
        attributes: pAttrs,
        tags: pAttrs,
        categories: pCats.map((pc: any) => pc.categories).filter(Boolean),
      };
    }) as Product[];
  } catch (err) {
    console.error("fetchProductsList catch:", err);
    return [];
  }
}

export async function fetchProductBySlug(slug: string): Promise<Product | null> {
  const supabase = createAdminClient();

  try {
    const { data: dbProduct, error }: any = await (supabase.from("products") as any)
      .select(`
        *,
        variants:product_variants(*)
      `)
      .eq("slug", slug)
      .single();

    if (error || !dbProduct) {
      if (error && error.code !== "PGRST116") {
        console.error("fetchProductBySlug Error:", error);
      }
      return null;
    }

    const { data: catLinks }: any = await (supabase.from("product_categories") as any)
      .select(`categories(*)`)
      .eq("product_id", dbProduct.id);

    let attrs: any[] = [];
    const { data: paData, error: paError }: any = await (supabase.from("product_attributes") as any)
      .select(`attributes(*)`)
      .eq("product_id", dbProduct.id);

    if (!paError && paData && paData.length > 0) {
      attrs = paData.map((pa: any) => pa.attributes).filter(Boolean);
    } else {
      const { data: ptData }: any = await (supabase.from("product_tags") as any)
        .select(`tags(*)`)
        .eq("product_id", dbProduct.id);
      if (ptData && ptData.length > 0) {
        attrs = ptData.map((pt: any) => pt.tags).filter(Boolean);
      }
    }

    const mappedProduct = {
      ...dbProduct,
      variants: sortVariants(dbProduct.variants?.filter((v: any) => !v.is_archived) || []),
      attributes: attrs,
      tags: attrs,
      categories: catLinks?.map((pc: any) => pc.categories).filter(Boolean) || [],
    };

    return mappedProduct as Product;
  } catch (err) {
    console.error("fetchProductBySlug catch:", err);
    return null;
  }
}

export async function fetchProductsByCategory(categorySlug: string): Promise<Product[]> {
  const supabase = createAdminClient();

  try {
    const { data: catData, error: catError }: any = await (supabase.from("categories") as any)
      .select("id, parent_id")
      .eq("slug", categorySlug)
      .single();

    const categoryData = catData as any;
    if (catError || !categoryData) return [];

    // Query all categories to gather descendant tree
    const { data: allCategories }: any = await (supabase.from("categories") as any)
      .select("id, parent_id");

    const targetCategoryIds = new Set<string>([categoryData.id]);
    let added = true;
    while (added) {
      added = false;
      (allCategories || []).forEach((c: any) => {
        if (c.parent_id && targetCategoryIds.has(c.parent_id) && !targetCategoryIds.has(c.id)) {
          targetCategoryIds.add(c.id);
          added = true;
        }
      });
    }

    let { data: linkData, error: linkError }: any = await (supabase.from("product_categories") as any)
      .select("product_id")
      .in("category_id", Array.from(targetCategoryIds));

    // Fallback: if leaf category has no direct products, check parent category
    if ((!linkData || linkData.length === 0) && categoryData.parent_id) {
      const { data: parentLinks }: any = await (supabase.from("product_categories") as any)
        .select("product_id")
        .eq("category_id", categoryData.parent_id);
      if (parentLinks && parentLinks.length > 0) {
        linkData = parentLinks;
      }
    }

    if (linkError || !linkData || linkData.length === 0) return [];

    const productIds = Array.from(new Set(linkData.map((l: any) => l.product_id)));

    let { data: dbProducts, error }: any = await (supabase.from("products") as any)
      .select(`
        *,
        variants:product_variants(*)
      `)
      .in("id", productIds)
      .order("created_at", { ascending: false });

    if (error || !dbProducts || dbProducts.length === 0) {
      if (error) console.error("fetchProductsByCategory dbProducts error:", error);
      return [];
    }

    const { data: catLinks }: any = await (supabase.from("product_categories") as any)
      .select(`product_id, categories(*)`)
      .in("product_id", productIds);

    let attrLinks: any[] = [];
    const { data: paData }: any = await (supabase.from("product_attributes") as any)
      .select(`product_id, attributes(*)`)
      .in("product_id", productIds);

    if (paData && paData.length > 0) {
      attrLinks = paData;
    } else {
      const { data: ptData }: any = await (supabase.from("product_tags") as any)
        .select(`product_id, tags(*)`)
        .in("product_id", productIds);
      if (ptData) attrLinks = ptData;
    }

    return dbProducts.map((p: any) => {
      const pCats = catLinks?.filter((link: any) => link.product_id === p.id) || [];
      const pAttrs =
        attrLinks
          ?.filter((link: any) => link.product_id === p.id)
          .map((link: any) => link.attributes || link.tags)
          .filter(Boolean) || [];

      return {
        ...p,
        variants: sortVariants(p.variants?.filter((v: any) => !v.is_archived) || []),
        attributes: pAttrs,
        tags: pAttrs,
        categories: pCats.map((pc: any) => pc.categories).filter(Boolean),
      };
    }) as Product[];
  } catch (err) {
    console.error("fetchProductsByCategory error:", err);
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
        documents: payload.documents || [],
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

/**
 * Upload product technical document (PDF, Excel, Word, CSV) to Supabase Storage.
 * Uses the dedicated `product-documents` bucket which supports all document MIME types.
 */
export async function uploadProductDocument(formData: FormData): Promise<{
  publicUrl?: string;
  name?: string;
  fileSize?: string;
  fileType?: "pdf" | "excel" | "sheet" | "doc" | "other";
  error?: string;
}> {
  const supabase = createAdminClient();
  const file = formData.get("file") as File;

  if (!file || file.size === 0) {
    return { error: "No document file provided." };
  }

  const rawName = file.name;
  const fileExt = rawName.split(".").pop()?.toLowerCase() || "";

  // Validate extension on server side as a second guard
  const ALLOWED_EXTENSIONS = ["pdf", "xlsx", "xls", "csv", "doc", "docx"];
  if (!ALLOWED_EXTENSIONS.includes(fileExt)) {
    return {
      error: `File type ".${fileExt}" is not supported. Allowed: PDF, Excel (.xlsx/.xls), CSV, Word (.doc/.docx).`,
    };
  }

  let fileType: "pdf" | "excel" | "sheet" | "doc" | "other" = "other";
  if (fileExt === "pdf") fileType = "pdf";
  else if (fileExt === "xlsx" || fileExt === "xls") fileType = "excel";
  else if (fileExt === "csv") fileType = "sheet";
  else if (fileExt === "doc" || fileExt === "docx") fileType = "doc";

  // Derive a safe content-type so Supabase never rejects it
  const MIME_MAP: Record<string, string> = {
    pdf: "application/pdf",
    xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    xls: "application/vnd.ms-excel",
    csv: "text/csv",
    doc: "application/msword",
    docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  };
  const contentType = MIME_MAP[fileExt] ?? "application/octet-stream";

  const cleanName = rawName.replace(/[^a-zA-Z0-9._-]/g, "_");
  const fileName = `doc_${Date.now()}_${cleanName}`;
  const filePath = `documents/${fileName}`;
  const fileSize =
    file.size >= 1024 * 1024
      ? `${(file.size / (1024 * 1024)).toFixed(1)} MB`
      : `${(file.size / 1024).toFixed(1)} KB`;

  try {
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const { error: uploadError } = await supabase.storage
      .from("product-documents")
      .upload(filePath, buffer, {
        contentType,
        upsert: true,
      });

    if (uploadError) {
      console.error("uploadProductDocument storage error:", uploadError);
      return {
        error: `Upload failed for "${rawName}": ${uploadError.message}`,
      };
    }

    const { data: publicUrlData } = supabase.storage
      .from("product-documents")
      .getPublicUrl(filePath);

    return {
      publicUrl: publicUrlData.publicUrl,
      name: rawName,
      fileSize,
      fileType,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unexpected error during document upload.";
    console.error("uploadProductDocument catch:", err);
    return { error: `Failed to upload "${rawName}": ${msg}` };
  }
}

