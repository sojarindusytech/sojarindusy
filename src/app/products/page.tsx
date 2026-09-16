import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Folder, ChevronRight, Package, ArrowRight, Layers } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import type { Metadata } from "next";
import { fetchCategoriesTree } from "@/actions/category";
import { fetchProductsList } from "@/actions/product";
import { ProductCard } from "@/components/storefront/ProductCard";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Industrial Product Catalog | Sojar Indusy",
  description:
    "Browse high-precision solid carbide cutting tools, CNC end mills, fasteners, and engineered tooling components by Sojar Indusy.",
};

export default async function ProductsPage() {
  const [{ flatCategories }, products] = await Promise.all([
    fetchCategoriesTree(),
    fetchProductsList(),
  ]);

  // Show root categories
  const rootCategories = flatCategories
    .filter((c) => !c.parent_id && c.is_active)
    .sort((a, b) => a.display_order - b.display_order);

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Catalog Hero Banner */}
      <div className="bg-white border-b border-slate-200">
        <div className="container mx-auto max-w-6xl px-4 pt-8 pb-10 sm:px-6">
          <nav className="flex items-center gap-2 text-xs font-medium text-slate-500 mb-6">
            <Link href="/" className="hover:text-[#024AE5]">
              Home
            </Link>
            <ChevronRight className="h-3.5 w-3.5" />
            <span className="text-slate-900 font-semibold">Products</span>
          </nav>

          <div className="max-w-2xl">
            <Badge
              variant="outline"
              className="text-xs bg-blue-50 text-[#024AE5] border-blue-200 mb-3"
            >
              Precision Engineering Catalog
            </Badge>
            <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-900">
              Product Catalog & Tooling Families
            </h1>
            <p className="mt-3 text-base text-slate-600 leading-relaxed">
              Explore our comprehensive range of solid carbide end mills, drills,
              inserts, and custom CNC tooling manufactured to aerospace and
              automotive precision standards.
            </p>
          </div>
        </div>
      </div>

      <div className="container mx-auto max-w-6xl px-4 py-10 sm:px-6 space-y-12">
        {/* Root Categories Section */}
        {rootCategories.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <Folder className="h-4 w-4 text-[#024AE5]" />
                <span>Browse by Category</span>
              </h2>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {rootCategories.map((sub) => (
                <Link key={sub.id} href={`/products/${sub.slug}`} className="block h-full">
                  <Card className="h-full transition-all hover:border-[#024AE5]/40 bg-white shadow-xs hover:shadow-md cursor-pointer flex flex-col border border-slate-200 group overflow-hidden rounded-xl">
                    {/* Image Section (1:1 Square) */}
                    <div className="w-full aspect-square bg-slate-50 relative border-b border-slate-100 flex items-center justify-center overflow-hidden">
                      {sub.image_url ? (
                        <Image
                          src={sub.image_url}
                          alt={sub.name}
                          fill
                          className="object-cover group-hover:scale-105 transition-transform duration-500"
                        />
                      ) : (
                        <div className="flex flex-col items-center justify-center text-slate-400 group-hover:text-[#024AE5] transition-colors">
                          <Folder className="h-7 w-7 mb-1 opacity-50" />
                          <span className="text-[9px] uppercase font-semibold tracking-wider">
                            No Image
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Content Section */}
                    <div className="p-3.5 flex flex-col items-center text-center flex-1">
                      <CardTitle className="text-xs font-bold text-slate-900 group-hover:text-[#024AE5] transition-colors">
                        {sub.name}
                      </CardTitle>
                      {sub.description && (
                        <p className="text-[10px] text-slate-500 mt-1 line-clamp-2 leading-relaxed">
                          {sub.description}
                        </p>
                      )}
                    </div>
                  </Card>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* All Products & Tooling Families Section */}
        <div className="space-y-6 pt-4 border-t border-slate-200/80">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                <Package className="h-5 w-5 text-[#024AE5]" />
                <span>All Products & Tooling Families</span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Browse all tool lines with full dimensional SKU availability and CAD data
              </p>
            </div>
            <Badge
              variant="outline"
              className="text-xs bg-blue-50 text-[#024AE5] border-blue-200 font-semibold px-2.5 py-1"
            >
              {products.length} {products.length === 1 ? "Product Family" : "Product Families"}
            </Badge>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {products.map((item) => (
              <ProductCard key={item.id} product={item} />
            ))}

            {products.length === 0 && (
              <div className="col-span-full flex flex-col items-center justify-center py-20 text-slate-500 bg-white rounded-xl border border-dashed border-slate-200">
                <Package className="h-10 w-10 text-slate-300 mb-2" />
                <p className="text-sm font-medium text-slate-600">
                  No products found in the catalog.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
