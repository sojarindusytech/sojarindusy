"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";

export async function updateProductMetadata(
  productId: string,
  payload: {
    title: string;
    short_description?: string;
    description?: string;
  }
): Promise<{ success?: boolean; error?: string }> {
  const supabase = createAdminClient();

  if (!payload.title?.trim()) {
    return { error: "Product title is required." };
  }

  try {
    const { error } = await supabase
      .from("products")
      .update({
        title: payload.title.trim(),
        short_description: payload.short_description || null,
        description: payload.description || null,
        updated_at: new Date().toISOString(),
      } as never)
      .eq("id", productId);

    if (error) {
      if (error.code === "23505") {
        return { error: "Product with this title already exists." };
      }
      return { error: error.message };
    }

    revalidatePath("/admin/products");
    return { success: true };
  } catch (err: any) {
    return { error: err.message };
  }
}

export async function addSingleSku(
  productId: string,
  payload: {
    sku: string;
    diameter?: number | null;
    flute_length?: number | null;
    overall_length?: number | null;
    shank_diameter?: number | null;
    list_price: number;
    stock_quantity: number;
    specifications?: Record<string, any>;
  }
): Promise<{ success?: boolean; error?: string }> {
  const supabase = createAdminClient();

  if (!payload.sku?.trim()) {
    return { error: "SKU is required." };
  }

  try {
    const { error } = await supabase.from("product_variants").insert({
      product_id: productId,
      sku: payload.sku.trim(),
      diameter: payload.diameter || null,
      flute_length: payload.flute_length || null,
      overall_length: payload.overall_length || null,
      shank_diameter: payload.shank_diameter || null,
      list_price: payload.list_price,
      stock_quantity: payload.stock_quantity,
      specifications: payload.specifications || {},
    } as never);

    if (error) {
      if (error.code === "23505") {
        return { error: "This SKU already exists." };
      }
      return { error: error.message };
    }

    revalidatePath("/admin/products");
    return { success: true };
  } catch (err: any) {
    return { error: err.message };
  }
}

export async function bulkAppendSkus(
  productId: string,
  variants: Array<{
    sku: string;
    diameter?: number | null;
    flute_length?: number | null;
    overall_length?: number | null;
    shank_diameter?: number | null;
    list_price: number;
    stock_quantity: number;
    specifications?: Record<string, any>;
  }>,
  tagId?: string
): Promise<{ success?: boolean; error?: string }> {
  const supabase = createAdminClient();

  if (!variants || variants.length === 0) {
    return { error: "No SKUs provided." };
  }

  try {
    const variantRows = variants.map((v) => ({
      product_id: productId,
      sku: v.sku.trim(),
      diameter: v.diameter || null,
      flute_length: v.flute_length || null,
      overall_length: v.overall_length || null,
      shank_diameter: v.shank_diameter || null,
      list_price: v.list_price,
      stock_quantity: v.stock_quantity,
      specifications: v.specifications || {},
    }));

    const { error } = await supabase.from("product_variants").insert(variantRows as never);

    if (error) {
      if (error.code === "23505") {
        return { error: "One or more SKUs in your upload already exist in the database (or there are duplicates within the CSV). Please ensure all SKUs are unique." };
      }
      return { error: error.message };
    }

    if (tagId) {
      const { data: existingLink } = await supabase
        .from("product_tags")
        .select("*")
        .eq("product_id", productId)
        .eq("tag_id", tagId)
        .single();

      if (!existingLink) {
        await supabase.from("product_tags").insert({
          product_id: productId,
          tag_id: tagId,
        } as never);
      }
    }

    revalidatePath("/admin/products");
    return { success: true };
  } catch (err: any) {
    return { error: err.message };
  }
}

export async function deleteSku(
  variantId: string
): Promise<{ success?: boolean; error?: string }> {
  const supabase = createAdminClient();

  try {
    const { error } = await supabase
      .from("product_variants")
      .delete()
      .eq("id", variantId);

    if (error) {
      return { error: error.message };
    }

    revalidatePath("/admin/products");
    return { success: true };
  } catch (err: any) {
    return { error: err.message };
  }
}

export async function bulkUpdateSkus(
  variantIds: string[],
  updates: {
    list_price?: number;
    stock_quantity?: number;
    list_price_percentage?: number;
  }
): Promise<{ success?: boolean; error?: string }> {
  const supabase = createAdminClient();

  if (!variantIds || variantIds.length === 0) {
    return { error: "No SKUs selected for update." };
  }

  try {
    if (updates.list_price_percentage !== undefined) {
      // 1. Fetch current prices
      const { data: existingVariants, error: fetchError } = await supabase
        .from("product_variants")
        .select("*")
        .in("id", variantIds);

      if (fetchError) throw fetchError;
      if (!existingVariants || existingVariants.length === 0) {
        return { error: "No variants found to update." };
      }

      // 2. Calculate new prices and prepare rows
      const factor = 1 + updates.list_price_percentage / 100;
      const rowsToUpsert = existingVariants.map((v: any) => ({
        ...v,
        list_price: parseFloat((v.list_price * factor).toFixed(2)),
        updated_at: new Date().toISOString(),
      }));

      // 3. Upsert
      const { error: upsertError } = await supabase
        .from("product_variants")
        .upsert(rowsToUpsert as never);

      if (upsertError) throw upsertError;

    } else {
      // Fixed value updates
      const updatePayload: any = { updated_at: new Date().toISOString() };
      if (updates.list_price !== undefined) {
        updatePayload.list_price = updates.list_price;
      }
      if (updates.stock_quantity !== undefined) {
        updatePayload.stock_quantity = updates.stock_quantity;
      }

      const { error } = await supabase
        .from("product_variants")
        .update(updatePayload as never)
        .in("id", variantIds);

      if (error) {
        return { error: error.message };
      }
    }

    revalidatePath("/admin/products");
    return { success: true };
  } catch (err: any) {
    return { error: err.message };
  }
}

export async function updateSingleSku(
  variantId: string,
  payload: {
    sku: string;
    diameter?: number | null;
    flute_length?: number | null;
    overall_length?: number | null;
    shank_diameter?: number | null;
    list_price: number;
    stock_quantity: number;
    specifications?: Record<string, any>;
  }
): Promise<{ success?: boolean; error?: string }> {
  const supabase = createAdminClient();

  if (!payload.sku?.trim()) {
    return { error: "SKU is required." };
  }

  try {
    const { error } = await supabase
      .from("product_variants")
      .update({
        sku: payload.sku.trim(),
        diameter: payload.diameter || null,
        flute_length: payload.flute_length || null,
        overall_length: payload.overall_length || null,
        shank_diameter: payload.shank_diameter || null,
        list_price: payload.list_price,
        stock_quantity: payload.stock_quantity,
        specifications: payload.specifications || {},
        updated_at: new Date().toISOString(),
      } as never)
      .eq("id", variantId);

    if (error) {
      if (error.code === "23505") {
        return { error: "This SKU already exists." };
      }
      return { error: error.message };
    }

    revalidatePath("/admin/products");
    return { success: true };
  } catch (err: any) {
    return { error: err.message };
  }
}
