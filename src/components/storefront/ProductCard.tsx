import React from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Package } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Product } from "@/types/database.types";

interface ProductCardProps {
  product: Product;
  categoryPath?: string;
}

export function ProductCard({ product, categoryPath }: ProductCardProps) {
  const firstVariant = product.variants && product.variants.length > 0 ? product.variants[0] : null;
  const variantCount = product.variants?.length || 0;

  // 1. Clean description parser (handles JSON stringified maps or plain text)
  let displayDescription = product.short_description || "";
  if (displayDescription.startsWith("{")) {
    try {
      const parsed = JSON.parse(displayDescription);
      const values = Object.values(parsed);
      const validVal = values.find((v) => typeof v === "string" && v.trim() !== "");
      displayDescription = (validVal as string) || "";
    } catch {
      // Keep as-is if parse fails
    }
  }

  // 2. Intelligent attribute & spec chip deduplication
  const chipSet = new Set<string>();
  const chips: string[] = [];

  // Add from product.attributes
  if (product.attributes && Array.isArray(product.attributes)) {
    product.attributes.forEach((attr: any) => {
      const name = attr?.name?.trim();
      if (name && !chipSet.has(name.toLowerCase())) {
        chipSet.add(name.toLowerCase());
        chips.push(name);
      }
    });
  }

  // Add from product.tags
  if (product.tags && Array.isArray(product.tags)) {
    product.tags.forEach((tag: any) => {
      const name = tag?.name?.trim();
      if (name && !chipSet.has(name.toLowerCase())) {
        chipSet.add(name.toLowerCase());
        chips.push(name);
      }
    });
  }

  // Add from firstVariant specifications if chips are still sparse
  if (firstVariant?.specifications && typeof firstVariant.specifications === "object") {
    Object.entries(firstVariant.specifications).forEach(([key, val]) => {
      if (chips.length >= 3) return;
      const lowerKey = key.toLowerCase();
      // Skip raw keys that were previously duplicated like 'tag' or 'attribute'
      if (lowerKey === "tag" || lowerKey === "attribute") {
        const valStr = String(val).trim();
        if (valStr && !chipSet.has(valStr.toLowerCase())) {
          chipSet.add(valStr.toLowerCase());
          chips.push(valStr);
        }
        return;
      }
      const valStr = String(val).trim();
      if (valStr && !chipSet.has(valStr.toLowerCase())) {
        chipSet.add(valStr.toLowerCase());
        chips.push(valStr);
      }
    });
  }

  // 3. Primary image URL
  const imageUrl =
    product.images && product.images.length > 0 ? product.images[0].url : null;

  // 4. Clean URL construction
  let productHref = `/products/${product.slug}`;
  if (categoryPath) {
    productHref = `/products/${categoryPath}/${product.slug}`;
  } else if (product.categories && product.categories.length > 0) {
    productHref = `/products/${product.categories[0].slug}/${product.slug}`;
  }

  // 5. Category label
  const primaryCategory =
    product.categories && product.categories.length > 0
      ? product.categories[0].name
      : null;

  return (
    <Link href={productHref} className="block h-full group">
      <Card className="h-full flex flex-col justify-between rounded-2xl border border-slate-200/90 bg-white transition-all duration-300 hover:shadow-xl hover:shadow-blue-500/5 hover:border-[#024AE5]/50 overflow-hidden">
        {/* 1:1 Square Image Container */}
        <div className="relative aspect-square w-full bg-slate-50/70 border-b border-slate-100 overflow-hidden">
          {/* Subtle Ambient Radial Glow */}
          <div className="absolute inset-0 bg-radial from-white via-transparent to-slate-100/50 opacity-60 pointer-events-none" />

          {/* Floating Badges Overlay */}
          <div className="absolute top-3 inset-x-3 z-10 flex items-center justify-between gap-2 pointer-events-none">
            {primaryCategory ? (
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-white/95 backdrop-blur-xs text-slate-700 border border-slate-200/80 shadow-2xs truncate max-w-[60%]">
                {primaryCategory}
              </span>
            ) : (
              <span />
            )}


          </div>

          {/* Image */}
          {imageUrl ? (
            <div className="relative w-full h-full">
              <Image
                src={imageUrl}
                alt={product.title}
                fill
                sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 380px"
                className="object-contain transition-transform duration-500 ease-out group-hover:scale-105"
              />
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center text-slate-400 group-hover:text-[#024AE5] transition-colors">
              <Package className="h-12 w-12 mb-2 opacity-40" />
              <span className="text-[10px] uppercase font-bold tracking-widest text-slate-400">
                No Image Available
              </span>
            </div>
          )}
        </div>

        {/* Card Content */}
        <div className="flex flex-col justify-between flex-1 p-5 space-y-3.5">
          <div>
            {/* Attribute Badges Row */}
            {chips.length > 0 && (
              <div className="flex items-center gap-1.5 flex-wrap mb-2">
                {chips.slice(0, 3).map((chip, idx) => (
                  <Badge
                    key={idx}
                    variant="outline"
                    className="text-[10px] font-semibold tracking-wide bg-blue-50/70 text-[#024AE5] border-blue-200/80 px-2 py-0.5 rounded-md"
                  >
                    {chip}
                  </Badge>
                ))}
              </div>
            )}

            {/* Product Title */}
            <h3
              className="text-base font-bold text-slate-900 group-hover:text-[#024AE5] transition-colors line-clamp-2 leading-snug tracking-tight"
              title={product.title}
            >
              {product.title}
            </h3>

            {/* Short Description */}
            {displayDescription && (
              <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed mt-2">
                {displayDescription}
              </p>
            )}
          </div>


          {/* Card Footer with CTA */}
          <div className="pt-3 border-t border-slate-100 flex items-center justify-end mt-auto">
            <div className="inline-flex items-center gap-1.5 text-xs font-bold text-white bg-[#024AE5] group-hover:bg-[#023ecc] px-3.5 py-1.5 rounded-lg transition-all shadow-xs group-hover:shadow-md">
              <span>View Details</span>
              <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
            </div>
          </div>
        </div>
      </Card>
    </Link>
  );
}
