import { fetchProductBySlug } from "@/actions/product";
import { fetchCategoriesTree } from "@/actions/category";
import { notFound } from "next/navigation";
import { ProductDetailsClient } from "@/components/storefront/ProductDetailsClient";
import { Category } from "@/types/database.types";

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const product = await fetchProductBySlug(slug);

  if (!product) {
    notFound();
  }

  const { flatCategories } = await fetchCategoriesTree();
  
  // Build breadcrumb
  let breadcrumb: Category[] = [];
  if (product.categories && product.categories.length > 0) {
    let maxDepth = -1;
    let deepestPath: Category[] = [];

    for (const cat of product.categories) {
      let currentDepth = 0;
      let path: Category[] = [];
      let current = flatCategories.find(c => c.id === cat.id);
      
      while (current) {
        path.unshift(current);
        currentDepth++;
        current = flatCategories.find(c => c.id === current?.parent_id);
      }

      if (currentDepth > maxDepth) {
        maxDepth = currentDepth;
        deepestPath = path;
      }
    }
    
    breadcrumb = deepestPath;
  }

  return <ProductDetailsClient product={product} breadcrumb={breadcrumb} />;
}
