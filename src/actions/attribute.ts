"use server";

import { createAdminClient } from "@/lib/supabase/admin";
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

    revalidatePath("/admin/attributes");
    revalidatePath("/admin/tags");
    revalidatePath("/admin/product-upload");
    revalidatePath("/admin/products");
    return { success: true, attribute: (data as unknown as Attribute) || undefined };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Unable to create attribute. Please try again." };
  }
}

export async function deleteAttribute(id: string): Promise<{ success?: boolean; error?: string }> {
  const supabase = createAdminClient();

  try {
    // 1. Fetch the attribute name for friendly display
    let attrName = "this attribute";
    const { data: attrData } = await supabase
      .from("attributes")
      .select("name")
      .eq("id", id)
      .maybeSingle();

    const typedAttr = attrData as { name?: string } | null;
    if (typedAttr?.name) {
      attrName = `"${typedAttr.name}"`;
    } else {
      const { data: tagData } = await supabase
        .from("tags")
        .select("name")
        .eq("id", id)
        .maybeSingle();
      const typedTag = tagData as { name?: string } | null;
      if (typedTag?.name) attrName = `"${typedTag.name}"`;
    }

    // 2. Check if any products are associated with this attribute & fetch their titles
    let productTitles: string[] = [];
    let { data: productLinks, error: countError } = await supabase
      .from("product_attributes")
      .select("product_id, products(id, title)")
      .eq("attribute_id", id);

    if (countError && countError.code === "42P01") {
      // Fallback to product_tags
      const fallback = await supabase
        .from("product_tags")
        .select("product_id, products(id, title)")
        .eq("tag_id", id);
      productLinks = fallback.data as any;
    }

    if (productLinks && productLinks.length > 0) {
      productTitles = productLinks
        .map((p: any) => p.products?.title)
        .filter((t: string | undefined): t is string => Boolean(t && t.trim()));

      const count = productLinks.length;
      const productListStr = productTitles.length > 0
        ? ` (${productTitles.slice(0, 3).map(t => `"${t}"`).join(", ")}${productTitles.length > 3 ? ` and ${productTitles.length - 3} more` : ""})`
        : "";

      return {
        error: `Cannot delete attribute ${attrName} because it is currently assigned to ${count} product family${count > 1 ? "ies" : ""}${productListStr}. Please remove this attribute from the product(s) before deleting.`,
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
