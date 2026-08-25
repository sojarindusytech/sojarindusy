import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { Clock, Sparkles, Folder, ChevronRight } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import type { Metadata } from "next";
import { fetchCategoriesTree } from "@/actions/category";

export const metadata: Metadata = {
  title: "Industrial Product Catalog | Sojar Indusy",
  description: "Browse high-precision fasteners, industrial valves, flanges, and engineered components by Sojar Indusy.",
};

export default async function ProductsPage() {
  const { flatCategories } = await fetchCategoriesTree();
  
  // Show root categories
  const rootCategories = flatCategories
    .filter(c => c.parent_id === null && c.is_active)
    .sort((a, b) => a.display_order - b.display_order);

  return (
    <div className="min-h-screen bg-slate-50 py-10">
      <div className="container mx-auto max-w-6xl px-4 sm:px-6 space-y-8">
        
        {/* Breadcrumbs */}
        <nav className="flex items-center gap-2 text-xs font-medium text-slate-500 mb-4 flex-wrap">
          <Link href="/" className="hover:text-[#024AE5]">Home</Link>
          <ChevronRight className="h-3.5 w-3.5" />
          <span className="text-slate-800 font-semibold">Products</span>
        </nav>

        {/* Page Title */}
        <div className="pb-2">
          <h1 className="text-4xl font-extrabold tracking-tight text-slate-900">
            Products
          </h1>
        </div>

        {/* Root Categories Grid */}
        <div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {rootCategories.map((sub) => (
              <Link key={sub.id} href={`/products/${sub.slug}`} className="block h-full">
                <Card className="h-full transition-all hover:border-[#024AE5]/40 bg-white shadow-sm hover:shadow-md cursor-pointer flex flex-col border border-slate-200 group overflow-hidden">
                  {/* Image Section */}
                  <div className="w-full aspect-video bg-slate-50 relative border-b border-slate-100 flex items-center justify-center overflow-hidden">
                    {sub.image_url ? (
                      <Image 
                        src={sub.image_url} 
                        alt={sub.name} 
                        fill 
                        className="object-cover group-hover:scale-105 transition-transform duration-500"
                      />
                    ) : (
                      <div className="flex flex-col items-center justify-center text-slate-400 group-hover:text-[#024AE5] transition-colors">
                        <Folder className="h-8 w-8 mb-1 opacity-50" />
                        <span className="text-[9px] uppercase font-semibold tracking-wider">No Image</span>
                      </div>
                    )}
                  </div>
                  
                  {/* Content Section */}
                  <div className="p-4 flex flex-col items-center text-center flex-1">
                    <CardTitle className="text-sm font-bold text-slate-900 group-hover:text-[#024AE5] transition-colors">{sub.name}</CardTitle>
                    {sub.description && (
                      <p className="text-[11px] text-slate-500 mt-2 line-clamp-2 leading-relaxed">{sub.description}</p>
                    )}
                  </div>
                </Card>
              </Link>
            ))}
          </div>

          {rootCategories.length === 0 && (
            <div className="col-span-full flex flex-col items-center justify-center py-20 text-slate-500">
              <p>No categories found in the database.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
