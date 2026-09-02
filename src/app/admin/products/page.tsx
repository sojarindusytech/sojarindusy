import { fetchProductsList } from "@/actions/product";
import { fetchCategoriesTree } from "@/actions/category";
import { fetchAttributes } from "@/actions/attribute";
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
  const attributes = await fetchAttributes();

  return (
    <ProductManagementClient
      initialProducts={products}
      treeNodes={treeNodes}
      availableAttributes={attributes}
      availableTags={attributes}
    />
  );
}
