import { fetchCategoriesTree } from "@/actions/category";
import { CategoryManagementClient } from "@/components/admin/CategoryManagementClient";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Categories & Hierarchy | Sojar Indusy Admin",
  description: "WordPress-style nested category taxonomy management.",
};

export const revalidate = 0; // Dynamic route

export default async function CategoriesAdminPage() {
  const { flatCategories, treeNodes } = await fetchCategoriesTree();

  return (
    <CategoryManagementClient
      initialFlatCategories={flatCategories}
      initialTreeNodes={treeNodes}
    />
  );
}
