"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/auth-guard";
import { revalidatePath } from "next/cache";
import { ProductImage, ProductDocument } from "@/types/database.types";
import { recordStockMovement } from "@/lib/server/inventory";
import { checkAndGeneratePurchaseOrder } from "@/lib/server/purchase-orders";
import { normalizeHsn } from "@/lib/invoice";

/** Rejects out-of-range GST % or malformed HSN before anything is written. */
function validateTaxFields(f: { gst_rate?: number | null; hsn_code?: string | null }): string | null {
  if (f.gst_rate !== undefined && f.gst_rate !== null && !(f.gst_rate >= 0 && f.gst_rate <= 100)) {
    return "GST % must be between 0 and 100.";
  }
  if (f.hsn_code !== undefined && !normalizeHsn(f.hsn_code).ok) {
    return "HSN code must be 4 to 8 digits.";
  }
  return null;
}

/** Only call after validateTaxFields: blank/invalid collapse to null. */
function cleanHsn(v: string | null | undefined): string | null {
  const r = normalizeHsn(v);
  return r.ok ? r.value : null;
}

export interface UpdateFullProductPayload {
  title: string;
  shortDescription?: string;
  description?: string;
  images: ProductImage[];
  documents?: ProductDocument[];
  categoryIds?: string[];
  attributeIds?: string[];
  variantsToAppend?: Array<{
    sku: string;
    diameter?: number | null;
    flute_length?: number | null;
    overall_length?: number | null;
    shank_diameter?: number | null;
    list_price: number;
    stock_quantity: number;
    min_quantity?: number | null;
    trigger_quantity?: number | null;
    min_order_quantity?: number | null;
    specifications?: Record<string, any>;
  }>;
}

export async function updateFullProduct(
  productId: string,
  payload: UpdateFullProductPayload
): Promise<{ success?: boolean; error?: string }> {
  await requireAdmin();
  const supabase = createAdminClient();

  if (!payload.title?.trim()) {
    return { error: "Product title is required." };
  }

  try {
    // 1. Update Core Product Metadata, Images, Documents, Overview Description
    const { error: prodErr } = await supabase
      .from("products")
      .update({
        title: payload.title.trim(),
        short_description: payload.shortDescription || null,
        description: payload.description || null,
        images: payload.images || [],
        documents: payload.documents || [],
        updated_at: new Date().toISOString(),
      } as never)
      .eq("id", productId);

    if (prodErr) {
      if (prodErr.code === "23505") {
        return { error: "Product with this title or slug already exists." };
      }
      return { error: prodErr.message };
    }

    // 2. Sync Categories if provided
    if (payload.categoryIds !== undefined) {
      await supabase.from("product_categories").delete().eq("product_id", productId);
      if (payload.categoryIds.length > 0) {
        const catRows = payload.categoryIds.map((catId) => ({
          product_id: productId,
          category_id: catId,
        }));
        await supabase.from("product_categories").insert(catRows as never);
      }
    }

    // 3. Sync Attributes / Tags if provided
    if (payload.attributeIds !== undefined) {
      await supabase.from("product_attributes").delete().eq("product_id", productId);
      await supabase.from("product_tags").delete().eq("product_id", productId);

      if (payload.attributeIds.length > 0) {
        const attrRows = payload.attributeIds.map((attrId) => ({
          product_id: productId,
          attribute_id: attrId,
        }));

        const { error: attrErr } = await supabase.from("product_attributes").insert(attrRows as never);
        if (attrErr && attrErr.code === "42P01") {
          const tagRows = payload.attributeIds.map((tId) => ({
            product_id: productId,
            tag_id: tId,
          }));
          await supabase.from("product_tags").insert(tagRows as never);
        }
      }
    }

    // 4. Optionally append new variants if provided from CSV
    if (payload.variantsToAppend && payload.variantsToAppend.length > 0) {
      const variantRows = payload.variantsToAppend.map((v) => ({
        product_id: productId,
        sku: v.sku,
        diameter: v.diameter ?? null,
        flute_length: v.flute_length ?? null,
        overall_length: v.overall_length ?? null,
        shank_diameter: v.shank_diameter ?? null,
        list_price: Number(v.list_price) || 0,
        stock_quantity: Number(v.stock_quantity) || 0,
        min_quantity: Number(v.min_quantity) || 0,
        trigger_quantity: Number(v.trigger_quantity) || 0,
        min_order_quantity: Math.max(1, Number(v.min_order_quantity) || 1),
        specifications: v.specifications || {},
      }));

      const { data: insertedVariantsData, error: varErr } = await supabase
        .from("product_variants")
        .insert(variantRows as never)
        .select("id, sku, stock_quantity, product_id");

      if (varErr) {
        return { error: `Product details saved, but failed to append some variants: ${varErr.message}` };
      }

      const insertedVariants = (insertedVariantsData || []) as any[];
      if (insertedVariants && insertedVariants.length > 0) {
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
              notes: "Appended variants from product editor batch",
            });
          }
        }
      }
    }

    revalidatePath("/admin/products");
    revalidatePath("/products");
    return { success: true };
  } catch (err: any) {
    return { error: err.message || "Failed to update product." };
  }
}

export async function updateProductMetadata(
  productId: string,
  payload: {
    title: string;
    short_description?: string;
    description?: string;
  }
): Promise<{ success?: boolean; error?: string }> {
  await requireAdmin();
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
    min_quantity?: number;
    trigger_quantity?: number;
    min_order_quantity?: number;
    /** null/undefined = use the Sales Settings default. */
    gst_rate?: number | null;
    /** null/blank = no HSN. */
    hsn_code?: string | null;
    specifications?: Record<string, any>;
  }
): Promise<{ success?: boolean; error?: string }> {
  await requireAdmin();
  const supabase = createAdminClient();

  if (!payload.sku?.trim()) {
    return { error: "SKU is required." };
  }

  const taxError = validateTaxFields(payload);
  if (taxError) return { error: taxError };

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
        min_quantity: payload.min_quantity ?? 0,
        trigger_quantity: payload.trigger_quantity ?? 0,
        min_order_quantity: Math.max(1, payload.min_order_quantity ?? 1),
        gst_rate: payload.gst_rate ?? null,
        hsn_code: cleanHsn(payload.hsn_code),
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

    // A SKU created with a trigger already set and stock at or below it should
    // order straight away, same as any other config change. Bulk/CSV creation
    // deliberately skips this -- those arrive with trigger 0 and would only
    // produce a round trip per row.
    if (inserted) {
      try {
        await checkAndGeneratePurchaseOrder(inserted.id, payload.stock_quantity);
      } catch (poErr) {
        console.warn("[addSkuToProduct] Notice auto PO check:", poErr);
      }
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
    min_quantity?: number;
    trigger_quantity?: number;
    min_order_quantity?: number;
    specifications?: Record<string, any>;
  }>,
  attributeIdOrTagId?: string
): Promise<{ success?: boolean; error?: string }> {
  await requireAdmin();
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
      min_quantity: v.min_quantity ?? 0,
      trigger_quantity: v.trigger_quantity ?? 0,
      min_order_quantity: Math.max(1, v.min_order_quantity ?? 1),
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
  await requireAdmin();
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
    min_quantity?: number;
    trigger_quantity?: number;
    min_order_quantity?: number;
    list_price_percentage?: number;
    /** null clears the SKU's own rate so it falls back to the Sales Settings default. */
    gst_rate?: number | null;
    /** null/blank clears the HSN code. */
    hsn_code?: string | null;
  }
): Promise<{ success?: boolean; error?: string }> {
  await requireAdmin();
  const supabase = createAdminClient();

  if (!variantIds || variantIds.length === 0) {
    return { error: "No SKUs selected for update." };
  }

  const taxError = validateTaxFields(updates);
  if (taxError) return { error: taxError };

  try {
    // 1. Fetch current state of variants
    const { data: existingVariantsData, error: fetchError } = await supabase
      .from("product_variants")
      .select("id, sku, stock_quantity, min_quantity, trigger_quantity, min_order_quantity, list_price, product_id, products(title)")
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
      // Reject the batch if the resulting config would silently disable
      // auto-ordering (order size is min_quantity - trigger_quantity, so a min
      // at or below the trigger can never produce a PO). Checked against each
      // variant's existing value, since only one of the two may be in this update.
      if (updates.min_quantity !== undefined || updates.trigger_quantity !== undefined) {
        const broken = existingVariants.filter((v: any) => {
          const min = updates.min_quantity ?? Number(v.min_quantity) ?? 0;
          const trigger = updates.trigger_quantity ?? Number(v.trigger_quantity) ?? 0;
          return trigger > 0 && min <= trigger;
        });

        if (broken.length > 0) {
          const names = broken.slice(0, 3).map((v: any) => v.sku).join(", ");
          const more = broken.length > 3 ? ` and ${broken.length - 3} more` : "";
          return {
            error: `Minimum SKU Quantity must be greater than Trigger Quantity. This change would break auto-ordering for ${names}${more}.`,
          };
        }
      }

      // Fixed value updates
      const updatePayload: any = { updated_at: new Date().toISOString() };
      if (updates.list_price !== undefined) {
        updatePayload.list_price = updates.list_price;
      }
      if (updates.stock_quantity !== undefined) {
        updatePayload.stock_quantity = updates.stock_quantity;
      }
      if (updates.min_quantity !== undefined) {
        updatePayload.min_quantity = updates.min_quantity;
      }
      if (updates.trigger_quantity !== undefined) {
        updatePayload.trigger_quantity = updates.trigger_quantity;
      }
      if (updates.min_order_quantity !== undefined) {
        // A customer cannot order zero units; floor at 1 regardless of input.
        updatePayload.min_order_quantity = Math.max(1, updates.min_order_quantity);
      }
      if (updates.gst_rate !== undefined) {
        updatePayload.gst_rate = updates.gst_rate;
      }
      if (updates.hsn_code !== undefined) {
        updatePayload.hsn_code = cleanHsn(updates.hsn_code);
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

      // Re-evaluate auto-ordering when a field that feeds the reorder decision
      // changed. Skipped for price-only edits, which cannot affect it.
      const affectsReorder =
        updates.stock_quantity !== undefined ||
        updates.min_quantity !== undefined ||
        updates.trigger_quantity !== undefined;

      if (affectsReorder) {
        for (const v of existingVariants) {
          const finalStock =
            updates.stock_quantity !== undefined
              ? updates.stock_quantity
              : Number(v.stock_quantity) || 0;
          try {
            await checkAndGeneratePurchaseOrder(v.id, finalStock);
          } catch (poErr) {
            console.warn(`[bulkUpdateSkus] Notice auto PO check for ${v.sku}:`, poErr);
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
    min_quantity?: number;
    trigger_quantity?: number;
    min_order_quantity?: number;
    /** null = use the Sales Settings default; undefined = leave unchanged. */
    gst_rate?: number | null;
    /** null/blank = no HSN; undefined = leave unchanged. */
    hsn_code?: string | null;
    specifications?: Record<string, any>;
  }
): Promise<{ success?: boolean; error?: string }> {
  await requireAdmin();
  const supabase = createAdminClient();

  if (!payload.sku?.trim()) {
    return { error: "SKU is required." };
  }

  const taxError = validateTaxFields(payload);
  if (taxError) return { error: taxError };

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
        min_quantity: payload.min_quantity ?? 0,
        trigger_quantity: payload.trigger_quantity ?? 0,
        min_order_quantity: Math.max(1, payload.min_order_quantity ?? 1),
        ...(payload.gst_rate !== undefined ? { gst_rate: payload.gst_rate } : {}),
        ...(payload.hsn_code !== undefined ? { hsn_code: cleanHsn(payload.hsn_code) } : {}),
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

    // 3. Re-evaluate auto-ordering now that this SKU's thresholds may have changed.
    // Without this, an admin who enables auto-ordering on a SKU already sitting
    // below its new trigger sees nothing happen until the next customer order or
    // stock adjustment -- which can be weeks away.
    try {
      await checkAndGeneratePurchaseOrder(variantId, newStock);
    } catch (poErr) {
      console.warn("[updateSku] Notice auto PO check:", poErr);
    }

    revalidatePath("/admin/products");
    return { success: true };
  } catch (err: any) {
    return { error: err.message };
  }
}
