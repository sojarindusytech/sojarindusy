"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { Tag } from "@/types/database.types";
import { revalidatePath } from "next/cache";

export async function fetchTags(): Promise<Tag[]> {
  const supabase = createAdminClient();

  try {
    const { data, error } = await supabase
      .from("tags")
      .select("*")
      .order("name", { ascending: true });

    if (error || !data) {
      console.error("Error fetching tags:", error);
      return [];
    }
    return data as Tag[];
  } catch (err) {
    console.error("Exception fetching tags:", err);
    return [];
  }
}

export async function createTag(
  name: string,
  type: string = "hardness"
): Promise<{ success?: boolean; error?: string; tag?: Tag }> {
  const supabase = createAdminClient();

  const trimmedName = name.trim();
  if (!trimmedName) {
    return { error: "Tag name is required." };
  }

  const slug = trimmedName
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");

  try {
    const { data, error } = await supabase
      .from("tags")
      .insert({
        name: trimmedName,
        slug,
        type: type.toLowerCase().trim(),
      } as never)
      .select()
      .single();

    if (error) {
      if (error.code === "23505") {
        return { error: `Tag "${trimmedName}" already exists.` };
      }
      return { error: error.message };
    }

    revalidatePath("/admin/tags");
    revalidatePath("/admin/product-upload");
    return { success: true, tag: data as Tag };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to create tag." };
  }
}

export async function deleteTag(id: string): Promise<{ success?: boolean; error?: string }> {
  const supabase = createAdminClient();

  try {
    const { error } = await supabase.from("tags").delete().eq("id", id);
    if (error) return { error: error.message };

    revalidatePath("/admin/tags");
    revalidatePath("/admin/product-upload");
    return { success: true };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to delete tag." };
  }
}
