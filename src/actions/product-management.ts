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

import { recordStockMovement } from "@/actions/inventory";

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
    const { data: insertedData, error } = await supabase
      .from("product_variants")
      .insert({
        product_id: productId,
        sku: payload.sku.trim(),
        diameter: payload.diameter || null,
        flute_length: payload.flute_length || null,
        overall_length: payload.overall_length || null,
        shank_diameter: payload.shank_diameter || null,
        list_price: payload.list_price,
        stock_quantity: payload.stock_quantity,
        specifications: payload.specifications || {},
      } as never)
      .select("id, sku, stock_quantity, product_id, products(title)")
      .single();

    if (error) {
      if (error.code === "23505") {
        return { error: "This SKU already exists." };
      }
      return { error: error.message };
    }

    const inserted = insertedData as any;
    if (inserted && payload.stock_quantity > 0) {
      const productTitle = inserted.products?.title || "Product";
      await recordStockMovement({
        variantId: inserted.id,
        productId: inserted.product_id,
        skuCode: inserted.sku,
        productTitle,
        movementType: "INITIAL_IMPORT",
        quantityDelta: payload.stock_quantity,
        balanceBefore: 0,
        balanceAfter: payload.stock_quantity,
        notes: "Single SKU creation",
      });
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
  attributeIdOrTagId?: string
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

    const { data: insertedVariantsData, error } = await supabase
      .from("product_variants")
      .insert(variantRows as never)
      .select("id, sku, stock_quantity, product_id, products(title)");

    if (error) {
      if (error.code === "23505") {
        return { error: "One or more SKUs in your upload already exist in the database (or there are duplicates within the CSV). Please ensure all SKUs are unique." };
      }
      return { error: error.message };
    }

    const insertedVariants = (insertedVariantsData || []) as any[];
    // Log stock movements for inserted variants
    if (insertedVariants && insertedVariants.length > 0) {
      for (const v of insertedVariants) {
        const stockQty = Number(v.stock_quantity) || 0;
        if (stockQty > 0) {
          const productTitle = v.products?.title || "Product";
          await recordStockMovement({
            variantId: v.id,
            productId: v.product_id,
            skuCode: v.sku,
            productTitle,
            movementType: "INITIAL_IMPORT",
            quantityDelta: stockQty,
            balanceBefore: 0,
            balanceAfter: stockQty,
            notes: "Bulk SKU Append import",
          });
        }
      }
    }

    if (attributeIdOrTagId) {
      // Try product_attributes first
      const { data: existingAttrLink, error: attrCheckErr } = await supabase
        .from("product_attributes")
        .select("*")
        .eq("product_id", productId)
        .eq("attribute_id", attributeIdOrTagId)
        .single();

      if (attrCheckErr && attrCheckErr.code === "42P01") {
        // Fallback to product_tags
        const { data: existingTagLink } = await supabase
          .from("product_tags")
          .select("*")
          .eq("product_id", productId)
          .eq("tag_id", attributeIdOrTagId)
          .single();

        if (!existingTagLink) {
          await supabase.from("product_tags").insert({
            product_id: productId,
            tag_id: attributeIdOrTagId,
          } as never);
        }
      } else if (!existingAttrLink) {
        await supabase.from("product_attributes").insert({
          product_id: productId,
          attribute_id: attributeIdOrTagId,
        } as never);
      }
    }

    revalidatePath("/admin/products");
    return { success: true };
  } catch (err: any) {
    return { error: err.message };
  }
}

/**
 * Smart SKU Deletion:
 * If the SKU has historical inventory logs or past orders, it will be soft-archived (is_archived = true).
 * If it has never been used, it is safely hard-deleted.
 */
export async function deleteSku(
  variantId: string
): Promise<{ success?: boolean; error?: string; archived?: boolean }> {
  const supabase = createAdminClient();

  try {
    // 1. Fetch variant and product info
    const { data: variantData } = await supabase
      .from("product_variants")
      .select("id, sku, stock_quantity, product_id, products(title)")
      .eq("id", variantId)
      .maybeSingle();

    const variant = variantData as any;
    if (!variant) {
      return { error: "SKU not found." };
    }

    // 2. Check if inventory logs exist for this variant
    const { count: logCount } = await supabase
      .from("inventory_logs")
      .select("*", { count: "exact", head: true })
      .eq("variant_id", variantId);

    const hasHistory = (logCount && logCount > 0);

    if (hasHistory) {
      // Soft-archive to preserve audit trails and analytics
      const { error: archiveError } = await supabase
        .from("product_variants")
        .update({
          is_archived: true,
          archived_at: new Date().toISOString(),
        } as never)
        .eq("id", variantId);

      if (archiveError) throw archiveError;

      const productTitle = variant.products?.title || "Product";
      const currentStock = Number(variant.stock_quantity) || 0;
      await recordStockMovement({
        variantId: variant.id,
        productId: variant.product_id,
        skuCode: variant.sku,
        productTitle,
        movementType: "ARCHIVED",
        quantityDelta: 0,
        balanceBefore: currentStock,
        balanceAfter: currentStock,
        notes: "SKU archived by admin (history preserved)",
      });

      revalidatePath("/admin/products");
      return { success: true, archived: true };
    }

    // Unreferenced -> hard delete
    const { error } = await supabase
      .from("product_variants")
      .delete()
      .eq("id", variantId);

    if (error) {
      // Fallback to archive if a foreign key constraint blocks deletion
      if (error.code === "23503") {
        await supabase
          .from("product_variants")
          .update({
            is_archived: true,
            archived_at: new Date().toISOString(),
          } as never)
          .eq("id", variantId);

        revalidatePath("/admin/products");
        return { success: true, archived: true };
      }
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
    // 1. Fetch current state of variants
    const { data: existingVariantsData, error: fetchError } = await supabase
      .from("product_variants")
      .select("id, sku, stock_quantity, list_price, product_id, products(title)")
      .in("id", variantIds);

    if (fetchError) throw fetchError;
    const existingVariants = (existingVariantsData || []) as any[];
    if (existingVariants.length === 0) {
      return { error: "No variants found to update." };
    }

    if (updates.list_price_percentage !== undefined) {
      // Percentage price update
      const factor = 1 + updates.list_price_percentage / 100;
      const rowsToUpsert = existingVariants.map((v: any) => ({
        ...v,
        list_price: parseFloat((v.list_price * factor).toFixed(2)),
        updated_at: new Date().toISOString(),
      }));

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

      // If stock quantity was updated in bulk, log movement for each variant
      if (updates.stock_quantity !== undefined) {
        for (const v of existingVariants) {
          const oldStock = Number(v.stock_quantity) || 0;
          const newStock = updates.stock_quantity;
          const delta = newStock - oldStock;

          if (delta !== 0) {
            const productTitle = v.products?.title || "Product";
            await recordStockMovement({
              variantId: v.id,
              productId: v.product_id,
              skuCode: v.sku,
              productTitle,
              movementType: "BULK_UPDATE",
              quantityDelta: delta,
              balanceBefore: oldStock,
              balanceAfter: newStock,
              notes: `Bulk Stock Update (Set to ${newStock})`,
            });
          }
        }
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
    // 1. Fetch current variant for stock change comparison
    const { data: currentVariantData } = await supabase
      .from("product_variants")
      .select("id, sku, stock_quantity, product_id, products(title)")
      .eq("id", variantId)
      .maybeSingle();

    const currentVariant = currentVariantData as any;
    const oldStock = Number(currentVariant?.stock_quantity) || 0;
    const newStock = payload.stock_quantity;
    const stockDelta = newStock - oldStock;

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

    // 2. If stock changed, record stock movement log
    if (currentVariant && stockDelta !== 0) {
      const productTitle = currentVariant.products?.title || "Product";
      await recordStockMovement({
        variantId: currentVariant.id,
        productId: currentVariant.product_id,
        skuCode: payload.sku.trim(),
        productTitle,
        movementType: "MANUAL_ADJUSTMENT",
        quantityDelta: stockDelta,
        balanceBefore: oldStock,
        balanceAfter: newStock,
        notes: `Manual Edit (${stockDelta > 0 ? `+${stockDelta}` : stockDelta} units)`,
      });
    }

    revalidatePath("/admin/products");
    return { success: true };
  } catch (err: any) {
    return { error: err.message };
  }
}
