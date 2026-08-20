import { fetchCategoriesTree } from "@/actions/category";
import { fetchTags } from "@/actions/tag";
import { ProductUploadClient } from "@/components/admin/ProductUploadClient";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Product Upload Wizard | Sojar Indusy Admin",
  description: "Upload product family metadata, images, and import SKU variant matrices.",
};

export const revalidate = 0;

export default async function ProductUploadPage() {
  const { treeNodes } = await fetchCategoriesTree();
  const tags = await fetchTags();

  return <ProductUploadClient treeNodes={treeNodes} availableTags={tags} />;
}
