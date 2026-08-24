import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Clock, Tag } from "lucide-react";
import Link from "next/link";
import { fetchCategoryBySlug } from "@/actions/category";
import { fetchProductsByCategory } from "@/actions/product";
import { notFound } from "next/navigation";
import Image from "next/image";

export default async function CategoryPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const category = await fetchCategoryBySlug(slug);
  if (!category) {
    notFound();
  }

  const products = await fetchProductsByCategory(slug);

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Category Header/Banner */}
      <div className="relative bg-[#0F172A] border-b border-slate-200 overflow-hidden">
        {category.image_url && (
          <div className="absolute inset-0 z-0">
            <Image
              src={category.image_url}
              alt={category.name}
              fill
              className="object-cover opacity-20 mix-blend-overlay"
              priority
            />
          </div>
        )}
        {/* Gradient overlay for readability */}
        <div className="absolute inset-0 z-0 bg-gradient-to-r from-[#0F172A] via-[#0F172A]/80 to-transparent"></div>
        
        <div className="container relative z-10 mx-auto max-w-6xl px-4 py-20 sm:px-6">
          <Badge variant="blue" className="mb-4 bg-[#024AE5]/20 text-blue-200 border-[#024AE5]/30">
            Category
          </Badge>
          <h1 className="text-4xl font-extrabold tracking-tight text-white drop-shadow-md">
            {category.name}
          </h1>
          {category.description && (
            <p className="mt-4 text-lg text-slate-300 max-w-2xl drop-shadow-sm">
              {category.description}
            </p>
          )}
        </div>
      </div>

      <div className="container mx-auto max-w-6xl px-4 py-10 sm:px-6 space-y-10">
        <div className="flex items-center justify-between border-b border-slate-200 pb-4">
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <Tag className="h-5 w-5 text-[#024AE5]" />
            Products in {category.name}
          </h2>
          <span className="text-sm font-medium bg-slate-200 text-slate-700 px-3 py-1 rounded-full">{products.length} Items</span>
        </div>

        {/* Products Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {products.map((item) => {
            const firstVariant = item.variants && item.variants.length > 0 ? item.variants[0] : null;
            const sku = firstVariant?.sku || "N/A";
            const categoryName = item.categories && item.categories.length > 0 ? item.categories[0].name : "Uncategorized";
            
            const specs = firstVariant?.specifications || {};
            const material = specs.material || "Industrial Grade Alloy";
            const standard = specs.standard || "ISO / DIN Standard";

            return (
              <Link key={item.id} href={`/products/${item.slug}`} className="block h-full">
                <Card className="h-full flex flex-col justify-between transition-all hover:border-[#024AE5]/40 bg-white shadow-sm hover:shadow-md cursor-pointer">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between gap-2">
                      <Badge variant="secondary" className="text-[10px] font-semibold bg-slate-100 text-slate-700 hover:bg-slate-200">
                        {categoryName}
                      </Badge>
                      <span className="font-mono text-[10px] text-slate-400">{sku}</span>
                    </div>
                    <CardTitle className="text-base font-bold text-slate-900 pt-2 line-clamp-2" title={item.title}>
                      {item.title}
                    </CardTitle>
                  </CardHeader>

                  <CardContent className="space-y-2.5 text-xs">
                    {item.short_description && (
                      <p className="text-slate-500 line-clamp-2 text-[11px] mb-2 leading-relaxed">
                        {item.short_description}
                      </p>
                    )}
                    <div className="rounded-lg bg-slate-50 p-3 space-y-1.5 border border-slate-100">
                      <div className="flex justify-between">
                        <span className="text-slate-500">Material:</span>
                        <span className="font-semibold text-slate-800 line-clamp-1 text-right ml-2">{material}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Standard:</span>
                        <span className="font-mono text-slate-700 line-clamp-1 text-right ml-2">{standard}</span>
                      </div>
                      {firstVariant && (
                        <div className="flex justify-between">
                          <span className="text-slate-500">Variants:</span>
                          <span className="font-semibold text-[#024AE5]">{item.variants?.length || 0} Options</span>
                        </div>
                      )}
                    </div>
                  </CardContent>

                  <CardFooter className="pt-0 border-t border-slate-100 py-3 flex items-center justify-between">
                    <div className="flex items-center gap-1 text-[11px] text-[#3C8B4F] font-semibold">
                      <span className="flex h-2 w-2 rounded-full bg-[#3C8B4F] mr-1"></span>
                      <span>In Stock</span>
                    </div>
                    <div className="inline-flex items-center justify-center rounded-md text-xs h-8 px-3 font-medium border border-input bg-background hover:bg-[#024AE5] hover:text-white transition-colors">
                      View Details
                    </div>
                  </CardFooter>
                </Card>
              </Link>
            );
          })}

          {products.length === 0 && (
            <div className="col-span-full flex flex-col items-center justify-center py-20 text-slate-500">
              <p>No products found for this category.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
