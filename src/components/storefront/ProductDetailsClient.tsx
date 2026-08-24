"use client";

import { useState } from "react";
import { Product } from "@/types/database.types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChevronRight, Share2, Download, ShoppingCart, Minus, Plus, Settings, CheckCircle2, ShieldCheck, Truck, Headphones } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { cn } from "@/lib/utils";

export function ProductDetailsClient({ product }: { product: Product }) {
  const [activeImageIdx, setActiveImageIdx] = useState(0);
  const [activeTab, setActiveTab] = useState("series");
  const [activeTagId, setActiveTagId] = useState<string | null>(null);
  
  // State for quantity selection per variant
  const [quantities, setQuantities] = useState<Record<string, number>>({});

  const updateQuantity = (variantId: string, delta: number) => {
    setQuantities(prev => {
      const current = prev[variantId] || 1;
      const next = Math.max(1, current + delta);
      return { ...prev, [variantId]: next };
    });
  };

  const category = product.categories?.[0];
  const images = product.images || [];
  
  const activeTagName = product.tags?.find(t => t.id === activeTagId)?.name;
  const filteredVariants = product.variants?.filter(v => {
    if (!activeTagName) return true;
    return v.specifications?.Tag === activeTagName;
  }) || [];

  // Determine dynamic columns based on filtered variants
  const hasDiameter = filteredVariants.some(v => v.diameter != null);
  const hasFluteLength = filteredVariants.some(v => v.flute_length != null);
  const hasOverallLength = filteredVariants.some(v => v.overall_length != null);
  const hasShankDiameter = filteredVariants.some(v => v.shank_diameter != null);

  const customSpecKeys = new Set<string>();
  filteredVariants.forEach(v => {
    if (v.specifications) {
      Object.keys(v.specifications).forEach(key => {
        if (key !== "Tag" && key !== "ShortDescription") {
          customSpecKeys.add(key);
        }
      });
    }
  });
  const dynamicSpecs = Array.from(customSpecKeys);
  
  // Fallback thumbnails if images are missing (to match the design)
  const gallery = images.length > 0 ? images.map(img => img.url) : [
    "https://images.unsplash.com/photo-1530983823122-3bea349e5251?q=80&w=600&auto=format&fit=crop",
    "https://images.unsplash.com/photo-1621905251189-08b45d6a269e?q=80&w=600&auto=format&fit=crop",
    "https://images.unsplash.com/photo-1504917595217-d4dc5ebe6122?q=80&w=600&auto=format&fit=crop"
  ];

  return (
    <div className="min-h-screen bg-white text-slate-900 pb-20">
      <div className="container mx-auto max-w-7xl px-4 sm:px-6 pt-6">
        
        {/* Breadcrumbs */}
        <nav className="flex items-center gap-2 text-xs font-medium text-slate-500 mb-8">
          <Link href="/" className="hover:text-[#024AE5]">Home</Link>
          <ChevronRight className="h-3.5 w-3.5" />
          <Link href="/products" className="hover:text-[#024AE5]">Products</Link>
          <ChevronRight className="h-3.5 w-3.5" />
          {category && (
            <>
              <Link href={`/categories/${category.slug}`} className="hover:text-[#024AE5]">{category.name}</Link>
              <ChevronRight className="h-3.5 w-3.5" />
            </>
          )}
          <span className="text-slate-800">{product.title}</span>
        </nav>

        {/* Product Hero Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 mb-16">
          
          {/* Left: Image Gallery */}
          <div className="space-y-6">
            <div className="relative aspect-video w-full rounded-xl border border-slate-200 bg-white overflow-hidden flex items-center justify-center p-8">
              <Image 
                src={gallery[activeImageIdx]} 
                alt={product.title} 
                fill 
                className="object-contain p-8"
              />
              <div className="absolute top-4 left-4">
                <Badge variant="blue" className="rounded bg-[#024AE5] text-white hover:bg-[#024AE5] px-3 py-1 text-[10px] font-bold uppercase tracking-wider">
                  2 FLUTE
                </Badge>
              </div>
            </div>
            
            <div className="flex gap-4 overflow-x-auto pb-2">
              {gallery.map((url, idx) => (
                <button 
                  key={idx}
                  onClick={() => setActiveImageIdx(idx)}
                  className={cn(
                    "relative flex-shrink-0 w-24 h-24 rounded-lg border-2 overflow-hidden bg-white p-2 flex flex-col items-center justify-center transition-all",
                    activeImageIdx === idx ? "border-[#024AE5]" : "border-slate-200 hover:border-slate-300"
                  )}
                >
                  <div className="relative w-full h-12 mb-2">
                    <Image src={url} alt="Thumbnail" fill className="object-contain" />
                  </div>
                  <span className={cn("text-[10px] font-medium text-center", activeImageIdx === idx ? "text-[#024AE5]" : "text-slate-500")}>
                    {idx === 0 ? "Image" : idx === 1 ? "Technical Drawing" : idx === 2 ? "Dimensions" : "Application"}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Right: Details */}
          <div className="flex flex-col">
            <div className="flex items-start justify-between gap-4 mb-4">
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold text-[#0F172A] tracking-tight mb-2">
                  {product.title}
                </h1>
                {product.tags && product.tags.length > 0 && (
                  <p className="text-lg font-semibold text-[#024AE5] mb-4">
                    {activeTagName ? `${activeTagName} Series` : (product.tags.length > 1 ? "Multiple Series" : `${product.tags[0].name} Series`)}
                  </p>
                )}
              </div>
            </div>

            <div className="text-slate-600 text-sm leading-relaxed mb-8 max-w-xl">
              {product.description || product.short_description || "High precision micro diameter end mill with 2 flutes for high-speed machining, fine finishing, and intricate detailing."}
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-8 border-b border-slate-200 mb-8 overflow-x-auto">
          <button
            onClick={() => setActiveTab("overview")}
            className={cn(
              "pb-3 text-sm font-bold transition-colors whitespace-nowrap",
              activeTab === "overview"
                ? "text-[#024AE5] border-b-2 border-[#024AE5]"
                : "text-slate-500 hover:text-slate-800 border-b-2 border-transparent"
            )}
          >
            Overview
          </button>
        </div>

        {/* Tags / Series Pills */}
        {product.tags && product.tags.length > 0 && (
          <div className="flex flex-col gap-4 mb-8">
            <div className="flex flex-wrap items-center gap-3">
              <button
                onClick={() => setActiveTagId(null)}
                className={cn(
                  "px-6 py-2 rounded-md text-sm font-bold transition-colors border",
                  activeTagId === null
                    ? "bg-[#024AE5] text-white border-[#024AE5]"
                    : "bg-white text-slate-600 border-slate-200 hover:border-slate-300"
                )}
              >
                All Series
              </button>
              {product.tags.map((tag) => (
                <button
                  key={tag.id}
                  onClick={() => setActiveTagId(tag.id)}
                  className={cn(
                    "px-6 py-2 rounded-md text-sm font-bold transition-colors border",
                    activeTagId === tag.id
                      ? "bg-[#024AE5] text-white border-[#024AE5]"
                      : "bg-white text-slate-600 border-slate-200 hover:border-slate-300"
                  )}
                >
                  {tag.name}
                </button>
              ))}
            </div>
            
            {/* Tag Short Description */}
            {activeTagId && (
              <div className="mt-2 text-slate-700 text-sm leading-relaxed max-w-3xl bg-slate-50 p-4 rounded-lg border border-slate-100">
                <span className="font-semibold text-slate-900 mb-1 block">Series Overview</span>
                {filteredVariants.find(v => v.specifications?.ShortDescription)?.specifications?.ShortDescription || "No specific description was provided for this series during upload."}
              </div>
            )}
          </div>
        )}

        {/* SKU Table Header Actions */}
        <div className="flex justify-end mb-4">
          <Button variant="outline" size="sm" className="text-xs gap-2 text-[#024AE5] font-semibold border-slate-200">
            Reset Filters
          </Button>
        </div>

        {/* SKU Table */}
        <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-sm mb-6">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-[#0F172A] text-white text-[10px] uppercase font-bold tracking-wider">
                <tr>
                  <th className="px-6 py-4">Code</th>
                  {hasDiameter && <th className="px-6 py-4 text-center">Dia<br/>(D)</th>}
                  {hasFluteLength && <th className="px-6 py-4 text-center">Flute Length<br/>(l)</th>}
                  {hasOverallLength && <th className="px-6 py-4 text-center">Overall Length<br/>(L)</th>}
                  {hasShankDiameter && <th className="px-6 py-4 text-center">Shank Dia<br/>(d)</th>}
                  {dynamicSpecs.map(spec => (
                    <th key={spec} className="px-6 py-4 text-center">{spec}</th>
                  ))}
                  <th className="px-6 py-4 text-right">List Price<br/>(Excl. GST)</th>
                  <th className="px-6 py-4 text-center">Stock</th>
                  <th className="px-6 py-4 text-center">Qty</th>
                  <th className="px-6 py-4 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredVariants.map((v) => {
                  const qty = quantities[v.id] || 1;
                  return (
                    <tr key={v.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4 font-semibold text-[#024AE5]">{v.sku}</td>
                      {hasDiameter && <td className="px-6 py-4 text-center text-slate-700">{v.diameter || "-"}</td>}
                      {hasFluteLength && <td className="px-6 py-4 text-center text-slate-700">{v.flute_length || "-"}</td>}
                      {hasOverallLength && <td className="px-6 py-4 text-center text-slate-700">{v.overall_length || "-"}</td>}
                      {hasShankDiameter && <td className="px-6 py-4 text-center text-slate-700">{v.shank_diameter || "-"}</td>}
                      {dynamicSpecs.map(spec => (
                        <td key={spec} className="px-6 py-4 text-center text-slate-700">
                          {v.specifications?.[spec] || "-"}
                        </td>
                      ))}
                      <td className="px-6 py-4 text-right font-semibold text-slate-900">₹{v.list_price.toFixed(2)}</td>
                      <td className="px-6 py-4 text-center">
                        <span className="text-[11px] font-bold text-[#137333]">In Stock</span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-center gap-3">
                          <button 
                            onClick={() => updateQuantity(v.id, -1)}
                            className="w-6 h-6 flex items-center justify-center text-slate-400 hover:text-slate-800 transition-colors"
                          >
                            <Minus className="h-3 w-3" />
                          </button>
                          <span className="w-4 text-center text-sm font-semibold text-slate-900">{qty}</span>
                          <button 
                            onClick={() => updateQuantity(v.id, 1)}
                            className="w-6 h-6 flex items-center justify-center text-slate-400 hover:text-slate-800 transition-colors"
                          >
                            <Plus className="h-3 w-3" />
                          </button>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <Button size="sm" className="bg-[#024AE5] hover:bg-[#0238B0] text-white shadow-none text-xs w-full max-w-[120px] font-bold">
                          <ShoppingCart className="h-3.5 w-3.5 mr-1.5" />
                          Add To Cart
                        </Button>
                      </td>
                    </tr>
                  )
                })}
                {filteredVariants.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-6 py-12 text-center text-slate-500">
                      No variants available for this product.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Pagination & Footer Meta */}
        <div className="flex items-center justify-between text-xs text-slate-500 font-medium mb-16">
          <span>Showing 1 to {filteredVariants.length} of {filteredVariants.length} results</span>
          <div className="flex items-center gap-2">
            <span>Rows per page:</span>
            <select className="border border-slate-200 rounded px-2 py-1 bg-white outline-none">
              <option>15</option>
              <option>30</option>
              <option>50</option>
            </select>
          </div>
        </div>

        {/* Trust Badges */}
        <div className="border-t border-slate-200 pt-10">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            <div className="flex items-center gap-4 justify-center">
              <div className="text-slate-400"><ShieldCheck className="h-6 w-6" /></div>
              <div>
                <div className="text-sm font-bold text-slate-900">GST Invoices</div>
                <div className="text-xs text-slate-500">On Every Order</div>
              </div>
            </div>
            <div className="flex items-center gap-4 justify-center">
              <div className="text-slate-400"><Truck className="h-6 w-6" /></div>
              <div>
                <div className="text-sm font-bold text-slate-900">Fast Delivery</div>
                <div className="text-xs text-slate-500">Pan India</div>
              </div>
            </div>
            <div className="flex items-center gap-4 justify-center">
              <div className="text-slate-400"><CheckCircle2 className="h-6 w-6" /></div>
              <div>
                <div className="text-sm font-bold text-slate-900">Secure Payments</div>
                <div className="text-xs text-slate-500">100% Protected</div>
              </div>
            </div>
            <div className="flex items-center gap-4 justify-center">
              <div className="text-slate-400"><Headphones className="h-6 w-6" /></div>
              <div>
                <div className="text-sm font-bold text-slate-900">Expert Support</div>
                <div className="text-xs text-slate-500">+91 98207 01219</div>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
