import { fetchProductBySlug, fetchProductsByCategory } from "@/actions/product";
import { fetchCategoriesTree, fetchCategoryBySlug } from "@/actions/category";
import { notFound } from "next/navigation";
import { ProductDetailsClient } from "@/components/storefront/ProductDetailsClient";
import { CategoryView } from "@/components/storefront/CategoryView";
import { Category } from "@/types/database.types";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function CatchAllProductPage({
  params,
}: {
  params: Promise<{ slug: string[] | string }>;
}) {
  const { slug: rawSlug } = await params;
  const slugSegments = Array.isArray(rawSlug) ? rawSlug : [rawSlug];
  const targetSlug = slugSegments[slugSegments.length - 1];

  if (!targetSlug) {
    notFound();
  }

  // 1. Check if the target slug is a Product
  const product = await fetchProductBySlug(targetSlug);

  if (product) {
    const supabase = await createClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const isLoggedIn = !!session;

    const { flatCategories } = await fetchCategoriesTree();

    // Build breadcrumb
    let breadcrumb: Category[] = [];
    if (product.categories && product.categories.length > 0) {
      let maxDepth = -1;
      let deepestPath: Category[] = [];

      for (const cat of product.categories) {
        let currentDepth = 0;
        let path: Category[] = [];
        let current = flatCategories.find((c) => c.id === cat.id);

        while (current) {
          path.unshift(current);
          currentDepth++;
          current = flatCategories.find((c) => c.id === current?.parent_id);
        }

        if (currentDepth > maxDepth) {
          maxDepth = currentDepth;
          deepestPath = path;
        }
      }

      breadcrumb = deepestPath;
    }

    return (
      <ProductDetailsClient
        product={product}
        breadcrumb={breadcrumb}
        isLoggedIn={isLoggedIn}
      />
    );
  }

  // 2. Check if the target slug is a Category
  const category = await fetchCategoryBySlug(targetSlug);

  if (category) {
    const { flatCategories } = await fetchCategoriesTree();
    const subCategories = flatCategories
      .filter((c) => c.parent_id === category.id && c.is_active)
      .sort((a, b) => a.display_order - b.display_order);

    const products = await fetchProductsByCategory(targetSlug);

    // Build breadcrumb
    let breadcrumb: typeof category[] = [];
    let current: typeof category | undefined = flatCategories.find((c) => c.id === category.id);
    while (current) {
      breadcrumb.unshift(current);
      current = flatCategories.find((c) => c.id === current?.parent_id);
    }

    return (
      <CategoryView
        category={category}
        subCategories={subCategories}
        products={products}
        breadcrumb={breadcrumb}
      />
    );
  }

  // Neither product nor category
  notFound();
}
