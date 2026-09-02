import { fetchProductBySlug } from "@/actions/product";
import { fetchCategoriesTree, fetchCategoryBySlug } from "@/actions/category";
import { fetchProductsByCategory } from "@/actions/product";
import { notFound } from "next/navigation";
import { ProductDetailsClient } from "@/components/storefront/ProductDetailsClient";
import { CategoryView } from "@/components/storefront/CategoryView";
import { Category } from "@/types/database.types";
import { createClient } from "@/lib/supabase/server";

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  
  // Try fetching as a Product
  const product = await fetchProductBySlug(slug);
  
  if (product) {
    const supabase = await createClient();
    const { data: { session } } = await supabase.auth.getSession();
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

    return <ProductDetailsClient product={product} breadcrumb={breadcrumb} isLoggedIn={isLoggedIn} />;
  }

  // Not a product, try fetching as a Category
  const category = await fetchCategoryBySlug(slug);
  
  if (category) {
    const { flatCategories } = await fetchCategoriesTree();
    const subCategories = flatCategories
      .filter(c => c.parent_id === category.id && c.is_active)
      .sort((a, b) => a.display_order - b.display_order);

    const products = subCategories.length === 0 ? await fetchProductsByCategory(slug) : [];

    // Build breadcrumb
    let breadcrumb: typeof category[] = [];
    let current: typeof category | undefined = flatCategories.find(c => c.id === category.id);
    while (current) {
      breadcrumb.unshift(current);
      current = flatCategories.find(c => c.id === current?.parent_id);
    }

    return <CategoryView category={category} subCategories={subCategories} products={products} breadcrumb={breadcrumb} />;
  }

  // Neither a product nor a category
  notFound();
}
  

