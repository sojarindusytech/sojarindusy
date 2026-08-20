"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { Category, CategoryNode } from "@/types/database.types";
import { revalidatePath } from "next/cache";

// Helper to convert category name into URL-safe slug
export async function generateSlug(name: string): Promise<string> {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// Initial Seed Categories for Tooling Domain fallback
const SEED_CATEGORIES: Category[] = [
  {
    id: "cat-end-mills",
    name: "End Mills",
    slug: "end-mills",
    parent_id: null,
    description: "Solid carbide and HSS end milling cutters",
    image_url: "https://images.unsplash.com/photo-1581092160607-ee22621dd758?w=300&q=80",
    display_order: 1,
    is_active: true,
    created_at: new Date().toISOString(),
  },
  {
    id: "cat-flat-end-mills",
    name: "Flat End Mills",
    slug: "flat-end-mills",
    parent_id: "cat-end-mills",
    description: "Square end mills for slotting, profiling, and shoulder milling",
    image_url: null,
    display_order: 1,
    is_active: true,
    created_at: new Date().toISOString(),
  },
  {
    id: "cat-4flute-standard",
    name: "4-Flute Standard HRC55",
    slug: "4-flute-standard-hrc55",
    parent_id: "cat-flat-end-mills",
    description: "4-flute high hardness end mills for steel up to HRC 55",
    image_url: null,
    display_order: 1,
    is_active: true,
    created_at: new Date().toISOString(),
  },
  {
    id: "cat-[#024AE5]-ball-nose",
    name: "Ball Nose End Mills",
    slug: "ball-nose-end-mills",
    parent_id: "cat-end-mills",
    description: "Spherical end mills for 3D contouring and die mold machining",
    image_url: null,
    display_order: 2,
    is_active: true,
    created_at: new Date().toISOString(),
  },
  {
    id: "cat-drills",
    name: "Carbide Drills",
    slug: "carbide-drills",
    parent_id: null,
    description: "High performance internal coolant and solid carbide drills",
    image_url: "https://images.unsplash.com/photo-1504328345606-18bbc8c9d7d1?w=300&q=80",
    display_order: 2,
    is_active: true,
    created_at: new Date().toISOString(),
  },
  {
    id: "cat-reamers",
    name: "Precision Reamers",
    slug: "precision-reamers",
    parent_id: null,
    description: "High precision hole finishing tooling",
    image_url: null,
    display_order: 3,
    is_active: true,
    created_at: new Date().toISOString(),
  },
];

/**
 * Fetch all categories from Supabase and build a recursive parent-child tree
 */
export async function fetchCategoriesTree(): Promise<{
  flatCategories: Category[];
  treeNodes: CategoryNode[];
}> {
  const supabase = createAdminClient();

  let categoriesList: Category[] = [];

  try {
    const { data, error } = await supabase
      .from("categories")
      .select("*")
      .order("display_order", { ascending: true })
      .order("name", { ascending: true });

    if (error || !data || data.length === 0) {
      console.warn("Categories table empty or notice fetching:", error?.message);
      categoriesList = SEED_CATEGORIES;
    } else {
      categoriesList = data as Category[];
    }
  } catch (err) {
    console.warn("Exception loading categories from database:", err);
    categoriesList = SEED_CATEGORIES;
  }

  // Create a map for quick parent lookup
  const categoryMap = new Map<string, CategoryNode>();
  categoriesList.forEach((cat) => {
    categoryMap.set(cat.id, {
      ...cat,
      depth: 0,
      children: [],
      parent_name: null,
    });
  });

  // Assign parent names and depth
  categoryMap.forEach((node) => {
    if (node.parent_id && categoryMap.has(node.parent_id)) {
      const parent = categoryMap.get(node.parent_id);
      node.parent_name = parent?.name || null;
    }
  });

  // Build tree structure
  const rootNodes: CategoryNode[] = [];

  const buildSubtree = (parentId: string | null, depth: number): CategoryNode[] => {
    const children: CategoryNode[] = [];
    categoryMap.forEach((node) => {
      if (node.parent_id === parentId) {
        node.depth = depth;
        node.children = buildSubtree(node.id, depth + 1);
        children.push(node);
      }
    });
    return children;
  };

  categoryMap.forEach((node) => {
    if (!node.parent_id || !categoryMap.has(node.parent_id)) {
      node.depth = 0;
      node.children = buildSubtree(node.id, 1);
      rootNodes.push(node);
    }
  });

  return {
    flatCategories: categoriesList,
    treeNodes: rootNodes,
  };
}

/**
 * Create a new category
 */
export async function createCategory(formData: FormData): Promise<{
  success?: boolean;
  error?: string;
  category?: Category;
}> {
  const supabase = createAdminClient();

  const name = (formData.get("name") as string)?.trim();
  let slug = (formData.get("slug") as string)?.trim();
  const parentIdRaw = (formData.get("parent_id") as string)?.trim();
  const parent_id = parentIdRaw && parentIdRaw !== "none" && parentIdRaw !== "null" ? parentIdRaw : null;
  const description = (formData.get("description") as string)?.trim() || null;
  const image_url = (formData.get("image_url") as string)?.trim() || null;
  const display_order = Number(formData.get("display_order")) || 0;
  const is_active = formData.get("is_active") === "true" || formData.get("is_active") === "on" || formData.get("is_active") === "1";

  if (!name) {
    return { error: "Category name is required." };
  }

  if (!slug) {
    slug = await generateSlug(name);
  } else {
    slug = await generateSlug(slug);
  }

  const newCategory: Partial<Category> = {
    name,
    slug,
    parent_id,
    description,
    image_url,
    display_order,
    is_active,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  try {
    const { data, error } = await supabase
      .from("categories")
      .insert(newCategory as never)
      .select()
      .single();

    if (error) {
      if (error.code === "23505") {
        return { error: `Category with slug "${slug}" already exists. Please use a unique name or slug.` };
      }
      return { error: error.message };
    }

    revalidatePath("/admin/categories");
    return { success: true, category: data as Category };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to create category." };
  }
}

/**
 * Update an existing category
 */
export async function updateCategory(
  id: string,
  formData: FormData
): Promise<{
  success?: boolean;
  error?: string;
}> {
  const supabase = createAdminClient();

  const name = (formData.get("name") as string)?.trim();
  let slug = (formData.get("slug") as string)?.trim();
  const parentIdRaw = (formData.get("parent_id") as string)?.trim();
  const parent_id = parentIdRaw && parentIdRaw !== "none" && parentIdRaw !== "null" ? parentIdRaw : null;
  const description = (formData.get("description") as string)?.trim() || null;
  const image_url = (formData.get("image_url") as string)?.trim() || null;
  const display_order = Number(formData.get("display_order")) || 0;
  const is_active = formData.get("is_active") === "true" || formData.get("is_active") === "on" || formData.get("is_active") === "1";

  if (!name) {
    return { error: "Category name is required." };
  }

  if (parent_id === id) {
    return { error: "A category cannot be its own parent." };
  }

  if (!slug) {
    slug = await generateSlug(name);
  } else {
    slug = await generateSlug(slug);
  }

  try {
    const { error } = await supabase
      .from("categories")
      .update({
        name,
        slug,
        parent_id,
        description,
        image_url,
        display_order,
        is_active,
        updated_at: new Date().toISOString(),
      } as never)
      .eq("id", id);

    if (error) {
      return { error: error.message };
    }

    revalidatePath("/admin/categories");
    return { success: true };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to update category." };
  }
}

/**
 * Delete a category (Strict rule: Prevent deletion if child categories exist)
 */
export async function deleteCategory(id: string): Promise<{
  success?: boolean;
  error?: string;
}> {
  const supabase = createAdminClient();

  try {
    // 1. Check if child categories exist
    const { data: children, error: checkErr } = await supabase
      .from("categories")
      .select("id, name")
      .eq("parent_id", id);

    const childList = (children || []) as Array<{ id: string; name: string }>;
    if (childList.length > 0) {
      return {
        error: `Cannot delete this category because it contains ${childList.length} subcategory(${childList.map((c) => c.name).join(", ")}). Please re-assign or delete child categories first.`,
      };
    }

    // 2. Perform deletion
    const { error } = await supabase
      .from("categories")
      .delete()
      .eq("id", id);

    if (error) {
      return { error: error.message };
    }

    revalidatePath("/admin/categories");
    return { success: true };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to delete category." };
  }
}

/**
 * Toggle category active status
 */
export async function toggleCategoryStatus(
  id: string,
  is_active: boolean
): Promise<{ success?: boolean; error?: string }> {
  const supabase = createAdminClient();

  try {
    const { error } = await supabase
      .from("categories")
      .update({ is_active, updated_at: new Date().toISOString() } as never)
      .eq("id", id);

    if (error) return { error: error.message };

    revalidatePath("/admin/categories");
    return { success: true };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to toggle status." };
  }
}
