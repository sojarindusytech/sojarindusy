"use server";
import { recordAudit } from "@/lib/server/audit";

import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/auth-guard";
import { Attribute } from "@/types/database.types";
import { revalidatePath } from "next/cache";

export async function fetchAttributes(): Promise<Attribute[]> {
  const supabase = createAdminClient();

  try {
    // Try querying 'attributes' table first, fall back to 'tags' if table rename hasn't run yet
    let { data, error } = await supabase
      .from("attributes")
      .select("*")
      .order("name", { ascending: true });

    if (error && error.code === "42P01") {
      // Table does not exist, fallback to tags
      const fallback = await supabase
        .from("tags")
        .select("*")
        .order("name", { ascending: true });
      data = fallback.data as any;
      error = fallback.error;
    }

    if (error || !data) {
      console.error("Error fetching attributes:", error);
      return [];
    }
    return data as Attribute[];
  } catch (err) {
    console.error("Exception fetching attributes:", err);
    return [];
  }
}

export async function createAttribute(
  name: string
): Promise<{ success?: boolean; error?: string; attribute?: Attribute }> {
  await requireAdmin();
  const supabase = createAdminClient();

  const trimmedName = name.trim();
  if (!trimmedName) {
    return { error: "Attribute name is required." };
  }

  const slug = trimmedName
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");

  try {
    let { data, error } = await supabase
      .from("attributes")
      .insert({
        name: trimmedName,
        slug,
      } as never)
      .select()
      .single();

    if (error && error.code === "42P01") {
      // Fallback to tags table if attributes not yet migrated
      const fallback = await supabase
        .from("tags")
        .insert({
          name: trimmedName,
          slug,
        } as never)
        .select()
        .single();
      data = fallback.data as any;
      error = fallback.error;
    }

    if (error) {
      if (error.code === "23505") {
        return { error: `An attribute named "${trimmedName}" already exists. Please choose a different name.` };
      }
      return { error: error.message || "Unable to create attribute. Please try again." };
    }

    await recordAudit({ action: "attribute.create", entity: "attribute", entityId: (data as unknown as Attribute | null)?.id ?? null, summary: `Created attribute ${trimmedName}` });
    revalidatePath("/admin/attributes");
    revalidatePath("/admin/tags");
    revalidatePath("/admin/product-upload");
    revalidatePath("/admin/products");
    return { success: true, attribute: (data as unknown as Attribute) || undefined };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Unable to create attribute. Please try again." };
  }
}

export interface AttributeUsage {
  name: string;
  /** Product families the attribute is assigned to. */
  products: string[];
  /** SKUs carrying it in specifications.Attribute / specifications.Tag (set by Add / Edit SKU). */
  skuCount: number;
  skus: string[];
}

const SAMPLE = 5;

/** Where an attribute is used. null = attribute not found. */
async function loadAttributeUsage(id: string): Promise<AttributeUsage | { error: string } | null> {
  const supabase = createAdminClient();

  const { data: attr, error: attrErr } = await supabase.from("attributes").select("name").eq("id", id).maybeSingle();
  if (attrErr) return { error: attrErr.message };
  const name = (attr as { name?: string } | null)?.name;
  if (!name) return null;

  const { data: links, error: linkErr } = await supabase
    .from("product_attributes")
    .select("products(title)")
    .eq("attribute_id", id);
  if (linkErr) return { error: linkErr.message };
  const products = ((links ?? []) as { products?: { title?: string } | null }[])
    .map((l) => l.products?.title?.trim() || "Untitled product")
    .sort();

  // SKUs store the attribute by name; older ones only under "Tag".
  const skuSet = new Set<string>();
  for (const key of ["Attribute", "Tag"]) {
    const { data: rows, error } = await supabase
      .from("product_variants")
      .select("sku")
      .eq(`specifications->>${key}`, name)
      .limit(1000);
    if (error) return { error: error.message };
    for (const r of (rows ?? []) as { sku: string }[]) skuSet.add(r.sku);
  }
  const skus = [...skuSet].sort();

  return { name, products, skuCount: skus.length, skus: skus.slice(0, SAMPLE) };
}

/** For the delete confirmation: shows where the attribute is used before anything is deleted. */
export async function getAttributeUsage(id: string): Promise<{ usage?: AttributeUsage; error?: string }> {
  await requireAdmin();
  try {
    const usage = await loadAttributeUsage(id);
    if (!usage) return { error: "Attribute not found. It may already have been deleted." };
    if ("error" in usage) return { error: "Could not check where this attribute is used. Please try again." };
    return { usage };
  } catch (err) {
    console.error("[getAttributeUsage]", err);
    return { error: "Could not check where this attribute is used. Please try again." };
  }
}

export async function deleteAttribute(id: string): Promise<{ success?: boolean; error?: string }> {
  await requireAdmin();
  const supabase = createAdminClient();

  try {
    // Re-checked here: the confirmation dialog's answer may be stale.
    const usage = await loadAttributeUsage(id);
    if (!usage) return { error: "Attribute not found. It may already have been deleted." };
    if ("error" in usage) return { error: "Could not check where this attribute is used. Please try again." };
    const attrName = `"${usage.name}"`;
    if (usage.products.length > 0 || usage.skuCount > 0) {
      const parts = [
        usage.products.length > 0 && `${usage.products.length} product famil${usage.products.length === 1 ? "y" : "ies"}`,
        usage.skuCount > 0 && `${usage.skuCount} SKU${usage.skuCount === 1 ? "" : "s"}`,
      ].filter(Boolean);
      return {
        error: `Cannot delete attribute ${attrName}: it is used by ${parts.join(" and ")}. Remove it from them first.`,
      };
    }

    // 3. Perform deletion from attributes table
    let { error } = await supabase.from("attributes").delete().eq("id", id);

    if (error && error.code === "42P01") {
      const fallback = await supabase.from("tags").delete().eq("id", id);
      error = fallback.error;
    }

    if (error) {
      if (error.code === "23503") {
        return {
          error: `Cannot delete attribute ${attrName} because it is referenced by existing products or SKUs.`,
        };
      }
      return { error: error.message || "Failed to delete attribute. Please try again." };
    }

    await recordAudit({ action: "attribute.delete", entity: "attribute", entityId: id, summary: `Deleted attribute ${attrName}` });
    revalidatePath("/admin/attributes");
    revalidatePath("/admin/tags");
    revalidatePath("/admin/product-upload");
    revalidatePath("/admin/products");
    return { success: true };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to delete attribute. Please try again." };
  }
}

// Backward compatibility exports
export const fetchTags = fetchAttributes;
export const createTag = createAttribute;
export const deleteTag = deleteAttribute;
