import { fetchCategoriesTree } from "@/actions/category";
import { fetchAttributes } from "@/actions/attribute";
import { ProductUploadClient } from "@/components/admin/ProductUploadClient";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Product Upload Wizard | Sojar Indusy Admin",
  description: "Upload product family metadata, images, and import SKU variant matrices.",
};

export const revalidate = 0;

export default async function ProductUploadPage() {
  const { treeNodes } = await fetchCategoriesTree();
  const attributes = await fetchAttributes();

  return (
    <ProductUploadClient
      treeNodes={treeNodes}
      availableAttributes={attributes}
      availableTags={attributes}
    />
  );
}
