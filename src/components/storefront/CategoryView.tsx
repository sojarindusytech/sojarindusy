import React from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Clock, Tag, Folder, ChevronRight, Package } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { Category, Product } from "@/types/database.types";

interface CategoryViewProps {
  category: Category;
  subCategories: Category[];
  products: Product[];
  breadcrumb: Category[];
}

export function CategoryView({ category, subCategories, products, breadcrumb }: CategoryViewProps) {
  return (
    <div className="min-h-screen bg-slate-50">
      {/* Category Header/Banner */}
      <div className="relative bg-white border-b border-slate-200 overflow-hidden">
        {category.image_url && (
          <div className="absolute inset-0 z-0">
            <Image
              src={category.image_url}
              alt={category.name}
              fill
              className="object-cover opacity-[0.03] mix-blend-multiply"
              priority
            />
          </div>
        )}
        
        <div className="container relative z-10 mx-auto max-w-6xl px-4 pt-8 pb-12 sm:px-6">
          {/* Breadcrumbs */}
          <nav className="flex items-center gap-2 text-xs font-medium text-slate-500 mb-8 flex-wrap">
            <Link href="/" className="hover:text-[#024AE5]">Home</Link>
            <ChevronRight className="h-3.5 w-3.5" />
            <Link href="/products" className="hover:text-[#024AE5]">Products</Link>
            <ChevronRight className="h-3.5 w-3.5" />
            {breadcrumb.map((cat, idx) => (
              <React.Fragment key={cat.id}>
                {idx === breadcrumb.length - 1 ? (
                  <span className="text-slate-800 font-semibold">{cat.name}</span>
                ) : (
                  <>
                    <Link href={`/products/${breadcrumb.slice(0, idx + 1).map(c => c.slug).join('/')}`} className="hover:text-[#024AE5]">{cat.name}</Link>
                    <ChevronRight className="h-3.5 w-3.5" />
                  </>
                )}
              </React.Fragment>
            ))}
          </nav>

          <h1 className="text-4xl font-extrabold tracking-tight text-slate-900">
            {category.name}
          </h1>
          {category.description && (
            <p className="mt-4 text-lg text-slate-600 max-w-2xl">
              {category.description}
            </p>
          )}
        </div>
      </div>

      <div className="container mx-auto max-w-6xl px-4 py-10 sm:px-6 space-y-10">
        
        {/* Sub-categories Grid */}
        {subCategories.length > 0 && (
          <div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {subCategories.map((sub) => {
                const fullCategoryPath = breadcrumb.map(c => c.slug).join('/');
                const subCategoryHref = fullCategoryPath ? `/products/${fullCategoryPath}/${sub.slug}` : `/products/${sub.slug}`;
                return (
                  <Link key={sub.id} href={subCategoryHref} className="block h-full">
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
                );
              })}
            </div>
          </div>
        )}

        {/* Products Grid (Only shown if no sub-categories exist) */}
        {subCategories.length === 0 && (
          <div>

        {/* Products Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {products.map((item) => {
            const firstVariant = item.variants && item.variants.length > 0 ? item.variants[0] : null;
            
            const specs = firstVariant?.specifications || {};
            const specKeys = Object.keys(specs).slice(0, 2);

            // Parse description if it is stored as JSON
            let displayDescription = item.short_description || "";
            if (displayDescription.startsWith('{')) {
              try {
                const parsed = JSON.parse(displayDescription);
                const values = Object.values(parsed);
                displayDescription = (values.find(v => typeof v === 'string' && v.trim() !== '') as string) || "";
              } catch (e) {}
            }

            // Product Image
            const imageUrl = item.images && item.images.length > 0 ? item.images[0].url : null;
            const fullCategoryPath = breadcrumb.map(c => c.slug).join('/');
            const productHref = breadcrumb.length > 0 ? `/products/${fullCategoryPath}/${item.slug}` : `/products/${item.slug}`;

            return (
              <Link key={item.id} href={productHref} className="block h-full">
                <Card className="h-full flex flex-col justify-between transition-all hover:border-[#024AE5]/40 bg-white shadow-sm hover:shadow-md cursor-pointer group overflow-hidden">
                  
                  {/* Image Section */}
                  <div className="w-full aspect-video bg-slate-50 relative border-b border-slate-100 flex items-center justify-center overflow-hidden">
                    {imageUrl ? (
                      <Image 
                        src={imageUrl} 
                        alt={item.title} 
                        fill 
                        className="object-cover group-hover:scale-105 transition-transform duration-500"
                      />
                    ) : (
                      <div className="flex flex-col items-center justify-center text-slate-400 group-hover:text-[#024AE5] transition-colors">
                        <Package className="h-10 w-10 mb-2 opacity-50" />
                        <span className="text-[10px] uppercase font-semibold tracking-wider">No Image</span>
                      </div>
                    )}
                  </div>

                  <div className="flex flex-col justify-between flex-1 p-4">
                    <CardHeader className="p-0 pb-3">

                      <CardTitle className="text-sm font-bold text-slate-900 line-clamp-2 leading-snug group-hover:text-[#024AE5] transition-colors" title={item.title}>
                        {item.title}
                      </CardTitle>
                    </CardHeader>

                    <CardContent className="p-0 space-y-2.5 text-xs">
                      {displayDescription && (
                        <p className="text-slate-500 line-clamp-2 text-[11px] mb-2 leading-relaxed">
                          {displayDescription}
                        </p>
                      )}
                    <div className="rounded-lg bg-slate-50 p-3 space-y-1.5 border border-slate-100">
                      {specKeys.map(key => (
                        <div key={key} className="flex justify-between">
                          <span className="text-slate-500 capitalize">{key}:</span>
                          <span className="font-semibold text-slate-800 line-clamp-1 text-right ml-2">{String(specs[key])}</span>
                        </div>
                      ))}
                      {firstVariant && (
                        <div className="flex justify-between">
                          <span className="text-slate-500">Variants:</span>
                          <span className="font-semibold text-[#024AE5]">{item.variants?.length || 0} Options</span>
                        </div>
                      )}
                    </div>
                  </CardContent>

                  <CardFooter className="pt-0 border-t border-slate-100 py-3 flex items-center justify-end mt-3">
                    <div className="inline-flex items-center justify-center rounded-md text-xs h-8 px-3 font-medium border border-input bg-background hover:bg-[#024AE5] hover:text-white transition-colors">
                      View Details
                    </div>
                  </CardFooter>
                  </div>
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
        )}
      </div>
    </div>
  );
}
