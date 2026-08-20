import { fetchProductsList } from "@/actions/product";
import { fetchCategoriesTree } from "@/actions/category";
import { fetchTags } from "@/actions/tag";
import { ProductManagementClient } from "@/components/admin/ProductManagementClient";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Products & SKU Matrix | Sojar Indusy Admin",
  description: "View product families, uploaded CSV SKU matrices, stock quantities, and pricing.",
};

export const revalidate = 0;

export default async function ProductsAdminPage() {
  const products = await fetchProductsList();
  const { treeNodes } = await fetchCategoriesTree();
  const tags = await fetchTags();

  return (
    <ProductManagementClient
      initialProducts={products}
      treeNodes={treeNodes}
      availableTags={tags}
    />
  );
}
