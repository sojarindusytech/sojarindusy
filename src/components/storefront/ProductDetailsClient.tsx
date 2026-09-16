"use client";

import React, { useState, useMemo } from "react";
import { Product, Category } from "@/types/database.types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ChevronRight,
  ShoppingCart,
  Minus,
  Plus,
  CheckCircle2,
  ShieldCheck,
  Truck,
  Headphones,
  Search,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  RotateCcw,
  ChevronLeft,
  Download,
  FileText,
  FileSpreadsheet,
  ExternalLink,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useCart } from "@/context/CartContext";
import { cn } from "@/lib/utils";
import toast from "react-hot-toast";

type SortKey =
  | "sku"
  | "diameter"
  | "flute_length"
  | "overall_length"
  | "shank_diameter"
  | "list_price"
  | "stock"
  | string;

type SortDirection = "asc" | "desc" | null;

export function ProductDetailsClient({
  product,
  breadcrumb,
  isLoggedIn = false,
}: {
  product: Product;
  breadcrumb?: Category[];
  isLoggedIn?: boolean;
}) {
  const router = useRouter();
  const { addItem } = useCart();
  const [activeImageIdx, setActiveImageIdx] = useState(0);
  const [activeTab, setActiveTab] = useState("selector");
  const prodAttributes = useMemo(() => {
    const list = [...(product.attributes || product.tags || [])];
    const existingNames = new Set(list.map((a) => a.name.toLowerCase().trim()));

    product.variants?.forEach((v) => {
      const attrVal = v.specifications?.Attribute || v.specifications?.Tag;
      if (attrVal && typeof attrVal === "string" && !existingNames.has(attrVal.toLowerCase().trim())) {
        existingNames.add(attrVal.toLowerCase().trim());
        list.push({
          id: `attr-${attrVal.toLowerCase().replace(/\s+/g, "-")}`,
          name: attrVal,
          slug: attrVal.toLowerCase().replace(/\s+/g, "-"),
          created_at: "",
        });
      }
    });

    return list;
  }, [product.attributes, product.tags, product.variants]);

  const [activeAttributeId, setActiveAttributeId] = useState<string>("all");
  const [isDatasheetModalOpen, setIsDatasheetModalOpen] = useState(false);

  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState("");
  const [filterDia, setFilterDia] = useState("ALL");
  const [filterFluteLength, setFilterFluteLength] = useState("ALL");
  const [filterShank, setFilterShank] = useState("ALL");
  const [filterOAL, setFilterOAL] = useState("ALL");
  const [customSpecFilters, setCustomSpecFilters] = useState<Record<string, string>>({});

  // Sorting State
  const [sortKey, setSortKey] = useState<SortKey | null>("diameter");
  const [sortDir, setSortDir] = useState<SortDirection>("asc");

  // Pagination State
  const [pageSize, setPageSize] = useState<number>(25);
  const [currentPage, setCurrentPage] = useState<number>(1);

  // Quantities per variant
  const [quantities, setQuantities] = useState<Record<string, number>>({});

  let shortDescMap: Record<string, string> = {};
  try {
    if (product.short_description?.trim().startsWith("{")) {
      shortDescMap = JSON.parse(product.short_description);
    }
  } catch (e) {
    // Ignore JSON parse errors
  }

  const updateQuantity = (variantId: string, delta: number) => {
    setQuantities((prev) => {
      const current = prev[variantId] || 1;
      const next = Math.max(1, current + delta);
      return { ...prev, [variantId]: next };
    });
  };

  const category = product.categories?.[0];
  const badgeText =
    breadcrumb && breadcrumb.length > 0
      ? breadcrumb[breadcrumb.length - 1].name
      : category?.name;
  const images = product.images || [];

  const activeAttributeName =
    activeAttributeId === "all"
      ? null
      : prodAttributes.find((t) => t.id === activeAttributeId)?.name;

  // 1. Filter by Series / Attribute
  const baseVariants = useMemo(() => {
    return (
      product.variants?.filter((v) => {
        if (!activeAttributeName || activeAttributeId === "all") return true;
        return (
          v.specifications?.Attribute === activeAttributeName ||
          v.specifications?.Tag === activeAttributeName
        );
      }) || []
    );
  }, [product.variants, activeAttributeName, activeAttributeId]);

  // Reset hero image to first slide whenever the active attribute changes
  React.useEffect(() => {
    setActiveImageIdx(0);
  }, [activeAttributeId]);

  const documents = product.documents || [];
  const activeDoc = useMemo(() => {
    if (activeAttributeId === "all") return null;
    const normActiveName = activeAttributeName?.toLowerCase().trim();

    return documents.find((d) => {
      if (!d) return false;
      if (d.attribute_id && d.attribute_id === activeAttributeId) return true;
      if (normActiveName) {
        const docAttr = d.attribute_name?.toLowerCase().trim();
        const docName = d.name?.toLowerCase().trim();
        if (docAttr && (docAttr === normActiveName || docAttr.includes(normActiveName) || normActiveName.includes(docAttr))) {
          return true;
        }
        if (docName && (docName.includes(normActiveName) || normActiveName.includes(docName))) {
          return true;
        }
      }
      return false;
    });
  }, [documents, activeAttributeId, activeAttributeName]);

  const globalDoc = documents.find((d) => !d.attribute_id || d.attribute_id === "all");

  // Only show in UI if a datasheet is available for the active attribute filter
  const isDatasheetAvailable =
    activeAttributeId === "all" ? documents.length > 0 : Boolean(activeDoc);

  const handleDownloadDatasheet = () => {
    if (activeDoc) {
      window.open(activeDoc.url, "_blank");
      return;
    }
    if (activeAttributeId === "all") {
      if (globalDoc) {
        window.open(globalDoc.url, "_blank");
        return;
      }
      if (documents.length === 1) {
        window.open(documents[0].url, "_blank");
        return;
      }
      if (documents.length > 1) {
        setIsDatasheetModalOpen(true);
        return;
      }
    }
  };

  const currentShortDescription = useMemo(() => {
    if (activeAttributeId === "all") {
      return (
        shortDescMap["all"] ||
        shortDescMap["global"] ||
        (!product.short_description?.trim().startsWith("{")
          ? product.short_description
          : "") ||
        "Industrial precision tooling engineered for high-performance CNC milling, drilling, and metalworking applications."
      );
    }
    if (activeAttributeId) {
      return (
        shortDescMap[activeAttributeId] ||
        (activeAttributeName ? shortDescMap[activeAttributeName] : "") ||
        shortDescMap["all"] ||
        shortDescMap["global"] ||
        (!product.short_description?.trim().startsWith("{")
          ? product.short_description
          : "") ||
        `Precision tooling engineered specifically for ${activeAttributeName} application parameters.`
      );
    }
    return "Select a series below to view its specific description.";
  }, [activeAttributeId, activeAttributeName, shortDescMap, product.short_description]);

  // Determine available dimensions for dropdown filters
  const availableDiameters = useMemo(() => {
    const set = new Set<string>();
    baseVariants.forEach((v) => {
      if (v.diameter != null) set.add(String(v.diameter));
    });
    return Array.from(set).sort((a, b) => Number(a) - Number(b));
  }, [baseVariants]);

  const availableFluteLengths = useMemo(() => {
    const set = new Set<string>();
    baseVariants.forEach((v) => {
      if (v.flute_length != null) set.add(String(v.flute_length));
    });
    return Array.from(set).sort((a, b) => Number(a) - Number(b));
  }, [baseVariants]);

  const availableShanks = useMemo(() => {
    const set = new Set<string>();
    baseVariants.forEach((v) => {
      if (v.shank_diameter != null) set.add(String(v.shank_diameter));
    });
    return Array.from(set).sort((a, b) => Number(a) - Number(b));
  }, [baseVariants]);

  const availableOALs = useMemo(() => {
    const set = new Set<string>();
    baseVariants.forEach((v) => {
      if (v.overall_length != null) set.add(String(v.overall_length));
    });
    return Array.from(set).sort((a, b) => Number(a) - Number(b));
  }, [baseVariants]);

  // Determine dynamic columns
  const hasDiameter = baseVariants.some((v) => v.diameter != null);
  const hasFluteLength = baseVariants.some((v) => v.flute_length != null);
  const hasOverallLength = baseVariants.some((v) => v.overall_length != null);
  const hasShankDiameter = baseVariants.some((v) => v.shank_diameter != null);

  const customSpecKeys = useMemo(() => {
    const set = new Set<string>();
    baseVariants.forEach((v) => {
      if (v.specifications) {
        Object.keys(v.specifications).forEach((key) => {
          if (
            key !== "Tag" &&
            key !== "Attribute" &&
            key !== "ShortDescription"
          ) {
            set.add(key);
          }
        });
      }
    });
    return Array.from(set);
  }, [baseVariants]);

  const totalColumnCount =
    4 +
    (hasDiameter ? 1 : 0) +
    (hasFluteLength ? 1 : 0) +
    (hasOverallLength ? 1 : 0) +
    (hasShankDiameter ? 1 : 0) +
    customSpecKeys.length +
    (isLoggedIn ? 1 : 0);

  const availableCustomSpecs = useMemo(() => {
    const map: Record<string, string[]> = {};
    customSpecKeys.forEach((key) => {
      const set = new Set<string>();
      baseVariants.forEach((v) => {
        const val = v.specifications?.[key];
        if (val != null && String(val).trim() !== "") {
          set.add(String(val).trim());
        }
      });
      if (set.size > 1) {
        map[key] = Array.from(set).sort((a, b) => {
          const numA = Number(a);
          const numB = Number(b);
          if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
          return a.localeCompare(b);
        });
      }
    });
    return map;
  }, [customSpecKeys, baseVariants]);

  // 2. Filter by Search Query & Dimension Selectors
  const filteredVariants = useMemo(() => {
    return baseVariants.filter((v) => {
      // Diameter filter
      if (filterDia !== "ALL" && String(v.diameter) !== filterDia) {
        return false;
      }
      // Flute Length filter
      if (filterFluteLength !== "ALL" && String(v.flute_length) !== filterFluteLength) {
        return false;
      }
      // Overall Length filter
      if (filterOAL !== "ALL" && String(v.overall_length) !== filterOAL) {
        return false;
      }
      // Shank Dia filter
      if (filterShank !== "ALL" && String(v.shank_diameter) !== filterShank) {
        return false;
      }
      // Dynamic Specs filter
      for (const [key, val] of Object.entries(customSpecFilters)) {
        if (val && val !== "ALL" && String(v.specifications?.[key] ?? "") !== val) {
          return false;
        }
      }

      // Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchSku = v.sku?.toLowerCase().includes(q);
        const matchDia =
          v.diameter != null && String(v.diameter).toLowerCase().includes(q);
        const matchFlute =
          v.flute_length != null &&
          String(v.flute_length).toLowerCase().includes(q);
        const matchOal =
          v.overall_length != null &&
          String(v.overall_length).toLowerCase().includes(q);
        const matchShank =
          v.shank_diameter != null &&
          String(v.shank_diameter).toLowerCase().includes(q);

        let matchSpecs = false;
        if (v.specifications) {
          matchSpecs = Object.values(v.specifications).some((val) =>
            String(val).toLowerCase().includes(q)
          );
        }

        return (
          matchSku ||
          matchDia ||
          matchFlute ||
          matchOal ||
          matchShank ||
          matchSpecs
        );
      }

      return true;
    });
  }, [baseVariants, filterDia, filterFluteLength, filterShank, filterOAL, customSpecFilters, searchQuery]);

  // 3. Sort Filtered Variants
  const sortedVariants = useMemo(() => {
    if (!sortKey || !sortDir) return filteredVariants;

    return [...filteredVariants].sort((a, b) => {
      let valA: any = null;
      let valB: any = null;

      if (sortKey === "sku") {
        valA = a.sku || "";
        valB = b.sku || "";
      } else if (sortKey === "diameter") {
        valA = a.diameter;
        valB = b.diameter;
      } else if (sortKey === "flute_length") {
        valA = a.flute_length;
        valB = b.flute_length;
      } else if (sortKey === "overall_length") {
        valA = a.overall_length;
        valB = b.overall_length;
      } else if (sortKey === "shank_diameter") {
        valA = a.shank_diameter;
        valB = b.shank_diameter;
      } else if (sortKey === "list_price") {
        valA = a.list_price || 0;
        valB = b.list_price || 0;
      } else if (sortKey === "stock") {
        valA = a.stock_quantity || 0;
        valB = b.stock_quantity || 0;
      } else {
        valA = a.specifications?.[sortKey] || "";
        valB = b.specifications?.[sortKey] || "";
      }

      // Numerical Sorting vs String Sorting
      const numA = Number(valA);
      const numB = Number(valB);

      if (
        !isNaN(numA) &&
        !isNaN(numB) &&
        valA !== "" &&
        valB !== "" &&
        valA !== null &&
        valB !== null
      ) {
        return sortDir === "asc" ? numA - numB : numB - numA;
      }

      const strA = String(valA ?? "").toLowerCase();
      const strB = String(valB ?? "").toLowerCase();
      if (strA < strB) return sortDir === "asc" ? -1 : 1;
      if (strA > strB) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
  }, [filteredVariants, sortKey, sortDir]);

  // 4. Paginated Slice
  const totalPages = Math.ceil(sortedVariants.length / pageSize) || 1;
  const paginatedVariants = useMemo(() => {
    if (pageSize >= 500) return sortedVariants;
    const start = (currentPage - 1) * pageSize;
    return sortedVariants.slice(start, start + pageSize);
  }, [sortedVariants, currentPage, pageSize]);

  // Handle Sort Header Click
  const handleSortClick = (key: SortKey) => {
    if (sortKey === key) {
      if (sortDir === "asc") setSortDir("desc");
      else if (sortDir === "desc") {
        setSortKey(null);
        setSortDir(null);
      }
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
    setCurrentPage(1);
  };

  // Reset all filters
  const handleResetFilters = () => {
    setSearchQuery("");
    setFilterDia("ALL");
    setFilterFluteLength("ALL");
    setFilterShank("ALL");
    setFilterOAL("ALL");
    setCustomSpecFilters({});
    setSortKey("diameter");
    setSortDir("asc");
    setCurrentPage(1);
  };

  const hasActiveFilters =
    searchQuery.trim() !== "" ||
    filterDia !== "ALL" ||
    filterFluteLength !== "ALL" ||
    filterShank !== "ALL" ||
    filterOAL !== "ALL" ||
    Object.values(customSpecFilters).some((v) => v !== "ALL");

  // Build gallery filtered to the active attribute
  const allImages = images.length > 0 ? images : [];

  const gallery = React.useMemo(() => {
    let filtered: typeof allImages = [];

    if (activeAttributeId === "all" || !activeAttributeId) {
      // Show images with no attribute or explicitly tagged as "all"
      filtered = allImages.filter(
        (img) => !img.attribute_id || img.attribute_id === "all"
      );
    } else {
      // Show images specific to this attribute
      filtered = allImages.filter(
        (img) =>
          img.attribute_id === activeAttributeId ||
          (img.attribute_name &&
            img.attribute_name.toLowerCase().trim() ===
              activeAttributeName?.toLowerCase().trim())
      );
      // Fallback: if no attribute-specific images exist, show global images
      if (filtered.length === 0) {
        filtered = allImages.filter(
          (img) => !img.attribute_id || img.attribute_id === "all"
        );
      }
    }

    // Absolute fallback — show all images if nothing matched
    if (filtered.length === 0) filtered = allImages;

    return filtered.length > 0
      ? filtered.map((img) => img.url)
      : [
          "https://images.unsplash.com/photo-1530983823122-3bea349e5251?q=80&w=600&auto=format&fit=crop",
          "https://images.unsplash.com/photo-1621905251189-08b45d6a269e?q=80&w=600&auto=format&fit=crop",
          "https://images.unsplash.com/photo-1504917595217-d4dc5ebe6122?q=80&w=600&auto=format&fit=crop",
        ];
  }, [allImages, activeAttributeId, activeAttributeName]);

  return (
    <div className="min-h-screen bg-white text-slate-900 pb-20">
      <div className="container mx-auto max-w-7xl px-4 sm:px-6 pt-6">
        {/* Breadcrumbs */}
        <nav className="flex items-center gap-2 text-xs font-medium text-slate-500 mb-8 flex-wrap">
          <Link href="/" className="hover:text-[#024AE5]">
            Home
          </Link>
          <ChevronRight className="h-3.5 w-3.5" />
          <Link href="/products" className="hover:text-[#024AE5]">
            Products
          </Link>
          <ChevronRight className="h-3.5 w-3.5" />
          {breadcrumb && breadcrumb.length > 0 ? (
            breadcrumb.map((cat, idx) => {
              const fullCategoryPath = breadcrumb
                .slice(0, idx + 1)
                .map((c) => c.slug)
                .join("/");
              return (
                <React.Fragment key={cat.id}>
                  <Link
                    href={`/products/${fullCategoryPath}`}
                    className="hover:text-[#024AE5]"
                  >
                    {cat.name}
                  </Link>
                  <ChevronRight className="h-3.5 w-3.5" />
                </React.Fragment>
              );
            })
          ) : (
            category && (
              <>
                <Link
                  href={`/products/${category.slug}`}
                  className="hover:text-[#024AE5]"
                >
                  {category.name}
                </Link>
                <ChevronRight className="h-3.5 w-3.5" />
              </>
            )
          )}
          <span className="text-slate-800">{product.title}</span>
        </nav>

        {/* Product Hero Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 mb-12 items-start">
          {/* Left: Image Gallery */}
          <div className="space-y-6">
            <div className="relative aspect-[4/3] w-full rounded-xl border border-slate-200 bg-white overflow-hidden">
              <Image
                src={gallery[activeImageIdx]}
                alt={product.title}
                fill
                className="object-contain p-2"
              />
              {badgeText && (
                <div className="absolute top-4 left-4">
                  <Badge
                    variant="blue"
                    className="rounded bg-[#024AE5] text-white hover:bg-[#024AE5] px-3 py-1 text-[10px] font-bold uppercase tracking-wider"
                  >
                    {badgeText}
                  </Badge>
                </div>
              )}
            </div>

            <div className="flex gap-4 overflow-x-auto pb-2">
              {gallery.map((url, idx) => (
                <button
                  key={idx}
                  onClick={() => setActiveImageIdx(idx)}
                  className={cn(
                    "relative flex-shrink-0 w-24 h-24 rounded-lg border-2 overflow-hidden bg-white p-2 flex flex-col items-center justify-center transition-all cursor-pointer",
                    activeImageIdx === idx
                      ? "border-[#024AE5]"
                      : "border-slate-200 hover:border-slate-300"
                  )}
                >
                  <div className="relative w-full h-12 mb-2">
                    <Image
                      src={url}
                      alt="Thumbnail"
                      fill
                      className="object-contain"
                    />
                  </div>
                  <span
                    className={cn(
                      "text-[10px] font-medium text-center",
                      activeImageIdx === idx
                        ? "text-[#024AE5]"
                        : "text-slate-500"
                    )}
                  >
                    {images.find((img) => img.url === url)?.title || `Image ${idx + 1}`}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Right: Details */}
          <div className="flex flex-col">
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-4">
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold text-[#0F172A] tracking-tight mb-1.5">
                  {product.title}
                </h1>
                {prodAttributes && prodAttributes.length > 0 && (
                  <p className="text-base font-semibold text-[#024AE5]">
                    {activeAttributeId === "all"
                      ? "Attributes"
                      : activeAttributeName
                      ? `${activeAttributeName} Attributes`
                      : "Attributes"}
                  </p>
                )}
              </div>

              {/* Download Data Sheet Button Placed Beside Title (Only when available for selected attribute) */}
              {isDatasheetAvailable && (
                <div className="flex items-center gap-2 shrink-0">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleDownloadDatasheet}
                    className="h-9 px-3.5 border-[#024AE5]/30 text-[#024AE5] hover:bg-[#024AE5]/5 font-semibold text-xs shadow-xs flex items-center gap-2 rounded-lg cursor-pointer transition-all"
                    title={
                      activeDoc
                        ? `Download ${activeDoc.name || "Data Sheet"}`
                        : "Download Technical Data Sheet (PDF / Excel)"
                    }
                  >
                    <Download className="w-4 h-4 text-[#024AE5]" />
                    <span>Download Data Sheet</span>
                    {activeAttributeId === "all" && documents.length > 1 && (
                      <Badge className="ml-1 px-1.5 py-0 text-[10px] bg-[#024AE5]/10 text-[#024AE5] border-0">
                        {documents.length}
                      </Badge>
                    )}
                  </Button>
                </div>
              )}
            </div>

            <div className="text-slate-600 text-sm leading-relaxed mb-8 max-w-xl">
              {currentShortDescription}
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center gap-8 border-b border-slate-200 mb-8 overflow-x-auto">
          <button
            onClick={() => setActiveTab("selector")}
            className={cn(
              "pb-3 text-sm font-bold transition-colors whitespace-nowrap cursor-pointer",
              activeTab === "selector"
                ? "text-[#024AE5] border-b-2 border-[#024AE5]"
                : "text-slate-500 hover:text-slate-800 border-b-2 border-transparent"
            )}
          >
            HRC Selector
          </button>
          <button
            onClick={() => setActiveTab("overview")}
            className={cn(
              "pb-3 text-sm font-bold transition-colors whitespace-nowrap cursor-pointer",
              activeTab === "overview"
                ? "text-[#024AE5] border-b-2 border-[#024AE5]"
                : "text-slate-500 hover:text-slate-800 border-b-2 border-transparent"
            )}
          >
            Overview
          </button>
        </div>

        {/* Tab Content: Overview */}
        {activeTab === "overview" && (
          <div className="text-slate-700 leading-relaxed max-w-4xl min-h-[300px]">
            {product.description ||
              (!product.short_description?.trim().startsWith("{") &&
                product.short_description) ||
              "Precision solid carbide cutting tools manufactured by Sojar Indusy."}
          </div>
        )}

        {/* Tab Content: HRC Selector & SKU Table */}
        {activeTab === "selector" && (
          <>
            {/* 1. Attribute / Series Pills */}
            {prodAttributes && prodAttributes.length > 0 && (
              <div className="flex flex-wrap items-center gap-2.5 mb-6">
                {/* 'All' Filter Pill */}
                <button
                  onClick={() => {
                    setActiveAttributeId("all");
                    handleResetFilters();
                  }}
                  className={cn(
                    "px-5 py-2 rounded-lg text-xs font-bold transition-all border cursor-pointer",
                    activeAttributeId === "all"
                      ? "bg-[#024AE5] text-white border-[#024AE5] shadow-xs"
                      : "bg-white text-slate-700 border-slate-200 hover:border-slate-300"
                  )}
                >
                  All
                </button>
                {prodAttributes.map((attr) => (
                  <button
                    key={attr.id}
                    onClick={() => {
                      setActiveAttributeId(attr.id);
                      handleResetFilters();
                    }}
                    className={cn(
                      "px-5 py-2 rounded-lg text-xs font-bold transition-all border cursor-pointer",
                      activeAttributeId === attr.id
                        ? "bg-[#024AE5] text-white border-[#024AE5] shadow-xs"
                        : "bg-white text-slate-700 border-slate-200 hover:border-slate-300"
                    )}
                  >
                    {attr.name}
                  </button>
                ))}
              </div>
            )}

            {/* SKU Table with Column-Aligned Dropdown Filters & Search */}
            <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-xs mb-4">
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="select-none">
                    {/* Row 1: Dedicated Filter Row - Dropdowns directly above columns, Search shifted above Stock/Qty/Action */}
                    <tr className="bg-slate-100/90 border-b border-slate-200">
                      {/* CODE / SKU Column: Filter Status or Reset */}
                      <th className="px-4 py-2 text-left align-middle min-w-[150px]">
                        {hasActiveFilters ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={handleResetFilters}
                            className="h-8 px-2.5 text-[11px] text-[#024AE5] hover:text-[#024AE5] hover:bg-blue-50 font-semibold gap-1.5 cursor-pointer whitespace-nowrap"
                            title="Reset all filters"
                          >
                            <RotateCcw className="h-3 w-3" />
                            <span>Reset</span>
                          </Button>
                        ) : (
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider pl-1 whitespace-nowrap">
                            Filters
                          </span>
                        )}
                      </th>

                      {/* DIA (D) Filter Dropdown */}
                      {hasDiameter && (
                        <th className="px-2 py-2 text-center align-middle min-w-[95px]">
                          {availableDiameters.length > 0 ? (
                            <Select
                              value={filterDia}
                              onValueChange={(val) => {
                                setFilterDia(val);
                                setCurrentPage(1);
                              }}
                            >
                              <SelectTrigger className="h-8 w-full text-xs font-semibold bg-white border-slate-200 shadow-none hover:border-slate-300 px-2.5">
                                <SelectValue placeholder="All Dia" />
                              </SelectTrigger>
                              <SelectContent className="bg-white border-slate-200 shadow-lg text-xs">
                                <SelectItem value="ALL">All Dia</SelectItem>
                                {availableDiameters.map((d) => (
                                  <SelectItem key={d} value={d}>
                                    {d}mm
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          ) : null}
                        </th>
                      )}

                      {/* FLUTE LENGTH (l) Filter Dropdown */}
                      {hasFluteLength && (
                        <th className="px-2 py-2 text-center align-middle min-w-[105px]">
                          {availableFluteLengths.length > 0 ? (
                            <Select
                              value={filterFluteLength}
                              onValueChange={(val) => {
                                setFilterFluteLength(val);
                                setCurrentPage(1);
                              }}
                            >
                              <SelectTrigger className="h-8 w-full text-xs font-semibold bg-white border-slate-200 shadow-none hover:border-slate-300 px-2.5">
                                <SelectValue placeholder="All Flute" />
                              </SelectTrigger>
                              <SelectContent className="bg-white border-slate-200 shadow-lg text-xs">
                                <SelectItem value="ALL">All Flute</SelectItem>
                                {availableFluteLengths.map((fl) => (
                                  <SelectItem key={fl} value={fl}>
                                    {fl}mm
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          ) : null}
                        </th>
                      )}

                      {/* OVERALL LENGTH (L) Filter Dropdown */}
                      {hasOverallLength && (
                        <th className="px-2 py-2 text-center align-middle min-w-[115px]">
                          {availableOALs.length > 0 ? (
                            <Select
                              value={filterOAL}
                              onValueChange={(val) => {
                                setFilterOAL(val);
                                setCurrentPage(1);
                              }}
                            >
                              <SelectTrigger className="h-8 w-full text-xs font-semibold bg-white border-slate-200 shadow-none hover:border-slate-300 px-2.5">
                                <SelectValue placeholder="All OAL" />
                              </SelectTrigger>
                              <SelectContent className="bg-white border-slate-200 shadow-lg text-xs">
                                <SelectItem value="ALL">All OAL</SelectItem>
                                {availableOALs.map((l) => (
                                  <SelectItem key={l} value={l}>
                                    {l}mm
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          ) : null}
                        </th>
                      )}

                      {/* SHANK DIA (d) Filter Dropdown */}
                      {hasShankDiameter && (
                        <th className="px-2 py-2 text-center align-middle min-w-[95px]">
                          {availableShanks.length > 0 ? (
                            <Select
                              value={filterShank}
                              onValueChange={(val) => {
                                setFilterShank(val);
                                setCurrentPage(1);
                              }}
                            >
                              <SelectTrigger className="h-8 w-full text-xs font-semibold bg-white border-slate-200 shadow-none hover:border-slate-300 px-2.5">
                                <SelectValue placeholder="All Shank" />
                              </SelectTrigger>
                              <SelectContent className="bg-white border-slate-200 shadow-lg text-xs">
                                <SelectItem value="ALL">All Shank</SelectItem>
                                {availableShanks.map((s) => (
                                  <SelectItem key={s} value={s}>
                                    {s}mm
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          ) : null}
                        </th>
                      )}

                      {/* Dynamic Specs Filter Dropdowns */}
                      {customSpecKeys.map((spec) => (
                        <th key={spec} className="px-2 py-2 text-center align-middle min-w-[95px]">
                          {availableCustomSpecs[spec]?.length > 0 ? (
                            <Select
                              value={customSpecFilters[spec] || "ALL"}
                              onValueChange={(val) => {
                                setCustomSpecFilters((prev) => ({
                                  ...prev,
                                  [spec]: val,
                                }));
                                setCurrentPage(1);
                              }}
                            >
                              <SelectTrigger className="h-8 w-full text-xs font-semibold bg-white border-slate-200 shadow-none hover:border-slate-300 px-2.5">
                                <SelectValue placeholder={`All ${spec}`} />
                              </SelectTrigger>
                              <SelectContent className="bg-white border-slate-200 shadow-lg text-xs">
                                <SelectItem value="ALL">All {spec}</SelectItem>
                                {availableCustomSpecs[spec].map((v) => (
                                  <SelectItem key={v} value={v}>
                                    {v}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          ) : null}
                        </th>
                      ))}

                      {/* LIST PRICE Spacer */}
                      {isLoggedIn && <th className="px-3 py-2 align-middle min-w-[120px]"></th>}

                      {/* Search Bar - Positioned exactly above STOCK, QTY, and ACTION columns */}
                      <th colSpan={3} className="px-3 py-2 align-middle min-w-[340px]">
                        <div className="relative w-full">
                          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                          <Input
                            type="text"
                            placeholder="Search Code, SKU, specs..."
                            value={searchQuery}
                            onChange={(e) => {
                              setSearchQuery(e.target.value);
                              setCurrentPage(1);
                            }}
                            className="h-8 pl-8 pr-7 text-xs bg-white border-slate-200 focus-visible:ring-[#024AE5] shadow-none w-full"
                          />
                          {searchQuery && (
                            <button
                              onClick={() => setSearchQuery("")}
                              className="absolute right-2 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400 hover:text-slate-600 cursor-pointer"
                            >
                              &times;
                            </button>
                          )}
                        </div>
                      </th>
                    </tr>

                    {/* Row 2: Main Column Headers */}
                    <tr className="bg-[#0F172A] text-white text-[10px] uppercase font-bold tracking-wider">
                      {/* CODE / SKU */}
                      <th
                        onClick={() => handleSortClick("sku")}
                        className="px-4 py-3.5 cursor-pointer hover:bg-slate-800/80 transition-colors whitespace-nowrap min-w-[150px]"
                        title="Sort by SKU Code"
                      >
                        <div className="flex items-center gap-1.5">
                          <span>CODE</span>
                          {sortKey === "sku" ? (
                            sortDir === "asc" ? (
                              <ArrowUp className="h-3.5 w-3.5 text-blue-400" />
                            ) : (
                              <ArrowDown className="h-3.5 w-3.5 text-blue-400" />
                            )
                          ) : (
                            <ArrowUpDown className="h-3 w-3 text-slate-400 opacity-60" />
                          )}
                        </div>
                      </th>

                      {/* DIA (D) */}
                      {hasDiameter && (
                        <th
                          onClick={() => handleSortClick("diameter")}
                          className="px-2 py-3.5 text-center cursor-pointer hover:bg-slate-800/80 transition-colors whitespace-nowrap min-w-[95px]"
                          title="Sort by Cutting Diameter"
                        >
                          <div className="flex items-center justify-center gap-1.5">
                            <span>DIA (D)</span>
                            {sortKey === "diameter" ? (
                              sortDir === "asc" ? (
                                <ArrowUp className="h-3.5 w-3.5 text-blue-400" />
                              ) : (
                                <ArrowDown className="h-3.5 w-3.5 text-blue-400" />
                              )
                            ) : (
                              <ArrowUpDown className="h-3 w-3 text-slate-400 opacity-60" />
                            )}
                          </div>
                        </th>
                      )}

                      {/* FLUTE LENGTH (l) */}
                      {hasFluteLength && (
                        <th
                          onClick={() => handleSortClick("flute_length")}
                          className="px-2 py-3.5 text-center cursor-pointer hover:bg-slate-800/80 transition-colors whitespace-nowrap min-w-[105px]"
                          title="Sort by Flute Length"
                        >
                          <div className="flex items-center justify-center gap-1.5">
                            <span>FLUTE LENGTH (l)</span>
                            {sortKey === "flute_length" ? (
                              sortDir === "asc" ? (
                                <ArrowUp className="h-3.5 w-3.5 text-blue-400" />
                              ) : (
                                <ArrowDown className="h-3.5 w-3.5 text-blue-400" />
                              )
                            ) : (
                              <ArrowUpDown className="h-3 w-3 text-slate-400 opacity-60" />
                            )}
                          </div>
                        </th>
                      )}

                      {/* OVERALL LENGTH (L) */}
                      {hasOverallLength && (
                        <th
                          onClick={() => handleSortClick("overall_length")}
                          className="px-2 py-3.5 text-center cursor-pointer hover:bg-slate-800/80 transition-colors whitespace-nowrap min-w-[115px]"
                          title="Sort by Overall Length"
                        >
                          <div className="flex items-center justify-center gap-1.5">
                            <span>OVERALL LENGTH (L)</span>
                            {sortKey === "overall_length" ? (
                              sortDir === "asc" ? (
                                <ArrowUp className="h-3.5 w-3.5 text-blue-400" />
                              ) : (
                                <ArrowDown className="h-3.5 w-3.5 text-blue-400" />
                              )
                            ) : (
                              <ArrowUpDown className="h-3 w-3 text-slate-400 opacity-60" />
                            )}
                          </div>
                        </th>
                      )}

                      {/* SHANK DIA (d) */}
                      {hasShankDiameter && (
                        <th
                          onClick={() => handleSortClick("shank_diameter")}
                          className="px-2 py-3.5 text-center cursor-pointer hover:bg-slate-800/80 transition-colors whitespace-nowrap min-w-[95px]"
                          title="Sort by Shank Diameter"
                        >
                          <div className="flex items-center justify-center gap-1.5">
                            <span>SHANK DIA (d)</span>
                            {sortKey === "shank_diameter" ? (
                              sortDir === "asc" ? (
                                <ArrowUp className="h-3.5 w-3.5 text-blue-400" />
                              ) : (
                                <ArrowDown className="h-3.5 w-3.5 text-blue-400" />
                              )
                            ) : (
                              <ArrowUpDown className="h-3 w-3 text-slate-400 opacity-60" />
                            )}
                          </div>
                        </th>
                      )}

                      {/* DYNAMIC SPECS */}
                      {customSpecKeys.map((spec) => (
                        <th
                          key={spec}
                          onClick={() => handleSortClick(spec)}
                          className="px-2 py-3.5 text-center cursor-pointer hover:bg-slate-800/80 transition-colors whitespace-nowrap min-w-[95px]"
                        >
                          <div className="flex items-center justify-center gap-1.5">
                            <span>{spec}</span>
                            {sortKey === spec ? (
                              sortDir === "asc" ? (
                                <ArrowUp className="h-3.5 w-3.5 text-blue-400" />
                              ) : (
                                <ArrowDown className="h-3.5 w-3.5 text-blue-400" />
                              )
                            ) : (
                              <ArrowUpDown className="h-3 w-3 text-slate-400 opacity-60" />
                            )}
                          </div>
                        </th>
                      ))}

                      {/* LIST PRICE */}
                      {isLoggedIn && (
                        <th
                          onClick={() => handleSortClick("list_price")}
                          className="px-3 py-3.5 text-right cursor-pointer hover:bg-slate-800/80 transition-colors whitespace-nowrap min-w-[120px]"
                          title="Sort by Price"
                        >
                          <div className="flex items-center justify-end gap-1.5">
                            <span>LIST PRICE (EXCL. GST)</span>
                            {sortKey === "list_price" ? (
                              sortDir === "asc" ? (
                                <ArrowUp className="h-3.5 w-3.5 text-blue-400" />
                              ) : (
                                <ArrowDown className="h-3.5 w-3.5 text-blue-400" />
                              )
                            ) : (
                              <ArrowUpDown className="h-3 w-3 text-slate-400 opacity-60" />
                            )}
                          </div>
                        </th>
                      )}

                      {/* STOCK */}
                      <th
                        onClick={() => handleSortClick("stock")}
                        className="px-3 py-3.5 text-center cursor-pointer hover:bg-slate-800/80 transition-colors whitespace-nowrap min-w-[105px]"
                      >
                        <div className="flex items-center justify-center gap-1.5">
                          <span>STOCK</span>
                          {sortKey === "stock" ? (
                            sortDir === "asc" ? (
                              <ArrowUp className="h-3.5 w-3.5 text-blue-400" />
                            ) : (
                              <ArrowDown className="h-3.5 w-3.5 text-blue-400" />
                            )
                          ) : (
                            <ArrowUpDown className="h-3 w-3 text-slate-400 opacity-60" />
                          )}
                        </div>
                      </th>

                      {/* QTY & ACTION */}
                      <th className="px-3 py-3.5 text-center whitespace-nowrap min-w-[105px]">QTY</th>
                      <th className="px-4 py-3.5 text-center whitespace-nowrap min-w-[130px]">ACTION</th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-slate-100">
                    {paginatedVariants.length === 0 ? (
                      <tr>
                        <td
                          colSpan={totalColumnCount}
                          className="px-6 py-12 text-center text-slate-500 text-xs"
                        >
                          <div className="space-y-2">
                            <p className="font-semibold text-slate-700">
                              No variants match the current search or filters.
                            </p>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={handleResetFilters}
                              className="text-xs text-[#024AE5]"
                            >
                              Reset All Filters
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      paginatedVariants.map((v) => {
                        const qty = quantities[v.id] || 1;
                        return (
                          <tr
                            key={v.id}
                            className="hover:bg-slate-50 transition-colors text-xs"
                          >
                            <td className="px-4 py-3 font-bold text-[#024AE5] whitespace-nowrap">
                              {v.sku}
                            </td>
                            {hasDiameter && (
                              <td className="px-2 py-3 text-center font-medium text-slate-800 whitespace-nowrap">
                                {v.diameter != null ? `${v.diameter}` : "-"}
                              </td>
                            )}
                            {hasFluteLength && (
                              <td className="px-2 py-3 text-center font-medium text-slate-800 whitespace-nowrap">
                                {v.flute_length != null
                                  ? `${v.flute_length}`
                                  : "-"}
                              </td>
                            )}
                            {hasOverallLength && (
                              <td className="px-2 py-3 text-center font-medium text-slate-800 whitespace-nowrap">
                                {v.overall_length != null
                                  ? `${v.overall_length}`
                                  : "-"}
                              </td>
                            )}
                            {hasShankDiameter && (
                              <td className="px-2 py-3 text-center font-medium text-slate-800 whitespace-nowrap">
                                {v.shank_diameter != null
                                  ? `${v.shank_diameter}`
                                  : "-"}
                              </td>
                            )}
                            {customSpecKeys.map((spec) => (
                              <td
                                key={spec}
                                className="px-2 py-3 text-center text-slate-700 whitespace-nowrap"
                              >
                                {v.specifications?.[spec] || "-"}
                              </td>
                            ))}
                            {isLoggedIn && (
                              <td className="px-3 py-3 text-right font-mono font-bold text-slate-900 whitespace-nowrap">
                                ₹{(v.list_price || 0).toFixed(2)}
                              </td>
                            )}
                            <td className="px-3 py-3 text-center whitespace-nowrap">
                              <span className="inline-flex items-center justify-center px-2.5 py-0.5 text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded whitespace-nowrap">
                                In Stock
                              </span>
                            </td>
                            <td className="px-3 py-3 whitespace-nowrap">
                              <div className="flex items-center justify-center gap-1.5">
                                <button
                                  onClick={() => updateQuantity(v.id, -1)}
                                  className="w-6 h-6 flex items-center justify-center rounded border border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
                                >
                                  <Minus className="h-3 w-3" />
                                </button>
                                <span className="w-5 text-center font-bold text-slate-900">
                                  {qty}
                                </span>
                                <button
                                  onClick={() => updateQuantity(v.id, 1)}
                                  className="w-6 h-6 flex items-center justify-center rounded border border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
                                >
                                  <Plus className="h-3 w-3" />
                                </button>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-center whitespace-nowrap">
                              <Button
                                size="sm"
                                className="bg-[#024AE5] hover:bg-[#0238B0] text-white shadow-none text-xs w-full max-w-[125px] font-bold h-8 cursor-pointer whitespace-nowrap"
                                onClick={() => {
                                  if (!isLoggedIn) {
                                    router.push(
                                      `/login?redirect=${encodeURIComponent(
                                        window.location.pathname
                                      )}`
                                    );
                                  } else {
                                    const qty = quantities[v.id] || 1;
                                    const itemSpecs: Record<string, any> = {
                                      ...(v.specifications || {}),
                                      ...(activeAttributeName ? { Series: activeAttributeName } : {}),
                                      ...(v.diameter != null ? { "Dia (D)": `${v.diameter}mm` } : {}),
                                      ...(v.flute_length != null ? { "Flute Length (l)": `${v.flute_length}mm` } : {}),
                                      ...(v.overall_length != null ? { "Overall Length (L)": `${v.overall_length}mm` } : {}),
                                      ...(v.shank_diameter != null ? { "Shank Dia (d)": `${v.shank_diameter}mm` } : {}),
                                    };
                                    addItem(
                                      {
                                        variantId: v.id,
                                        productId: product.id,
                                        sku: v.sku,
                                        title: product.title,
                                        unitPrice: v.list_price || 0,
                                        specifications: itemSpecs,
                                      },
                                      qty
                                    );
                                    toast.success(
                                      `Added ${qty} × ${v.sku} to cart`
                                    );
                                  }
                                }}
                              >
                                <ShoppingCart className="h-3.5 w-3.5 mr-1" />
                                Add To Cart
                              </Button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* 4. Pagination & Results Count */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500 font-medium mb-16">
              <span>
                Showing{" "}
                {sortedVariants.length === 0
                  ? 0
                  : (currentPage - 1) * pageSize + 1}{" "}
                to{" "}
                {Math.min(currentPage * pageSize, sortedVariants.length)} of{" "}
                {sortedVariants.length} variants
                {sortKey && (
                  <span className="text-slate-400 ml-1.5 font-normal">
                    (Sorted by{" "}
                    <strong className="text-slate-700 uppercase">
                      {sortKey}
                    </strong>{" "}
                    {sortDir === "asc" ? "▲" : "▼"})
                  </span>
                )}
              </span>

              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5">
                  <span>Rows per page:</span>
                  <select
                    value={pageSize}
                    onChange={(e) => {
                      setPageSize(Number(e.target.value));
                      setCurrentPage(1);
                    }}
                    className="border border-slate-200 rounded px-2 py-1 bg-white outline-none text-xs font-semibold"
                  >
                    <option value={15}>15</option>
                    <option value={25}>25</option>
                    <option value={50}>50</option>
                    <option value={100}>100</option>
                    <option value={1000}>All</option>
                  </select>
                </div>

                {totalPages > 1 && (
                  <div className="flex items-center gap-1">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={currentPage <= 1}
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      className="h-7 w-7 p-0 border-slate-200"
                    >
                      <ChevronLeft className="h-3.5 w-3.5" />
                    </Button>
                    <span className="px-2 text-xs font-bold text-slate-800">
                      {currentPage} / {totalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={currentPage >= totalPages}
                      onClick={() =>
                        setCurrentPage((p) => Math.min(totalPages, p + 1))
                      }
                      className="h-7 w-7 p-0 border-slate-200"
                    >
                      <ChevronRight className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </>
        )}

        {/* Trust Badges */}
        <div className="border-t border-slate-200 pt-10">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            <div className="flex items-center gap-4 justify-center">
              <div className="text-slate-400">
                <ShieldCheck className="h-6 w-6" />
              </div>
              <div>
                <div className="text-sm font-bold text-slate-900">
                  GST Invoices
                </div>
                <div className="text-xs text-slate-500">On Every Order</div>
              </div>
            </div>
            <div className="flex items-center gap-4 justify-center">
              <div className="text-slate-400">
                <Truck className="h-6 w-6" />
              </div>
              <div>
                <div className="text-sm font-bold text-slate-900">
                  Fast Delivery
                </div>
                <div className="text-xs text-slate-500">Pan India</div>
              </div>
            </div>
            <div className="flex items-center gap-4 justify-center">
              <div className="text-slate-400">
                <CheckCircle2 className="h-6 w-6" />
              </div>
              <div>
                <div className="text-sm font-bold text-slate-900">
                  Secure Payments
                </div>
                <div className="text-xs text-slate-500">100% Protected</div>
              </div>
            </div>
            <div className="flex items-center gap-4 justify-center">
              <div className="text-slate-400">
                <Headphones className="h-6 w-6" />
              </div>
              <div>
                <div className="text-sm font-bold text-slate-900">
                  Expert Support
                </div>
                <div className="text-xs text-slate-500">+91 98207 01219</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Technical Data Sheets Modal */}
      <Dialog open={isDatasheetModalOpen} onOpenChange={setIsDatasheetModalOpen}>
        <DialogContent className="sm:max-w-[550px] p-6 pr-12 bg-white">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <FileText className="w-5 h-5 text-[#024AE5]" />
              Technical Data Sheets & Catalogs
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Download official engineering documentation and cutting parameters for{" "}
              <span className="font-semibold text-slate-800">{product.title}</span>.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 pt-3">
            {documents.map((doc, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between p-3 rounded-xl border border-slate-200 bg-slate-50/80 hover:bg-slate-50 transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="h-9 w-9 rounded-lg border border-slate-200 flex items-center justify-center shrink-0 bg-white shadow-2xs">
                    {doc.file_type === "excel" || doc.file_type === "sheet" ? (
                      <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
                    ) : (
                      <FileText className="h-4 w-4 text-rose-500" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-slate-900 truncate">{doc.name}</p>
                    <div className="flex items-center gap-2 text-[10px] text-slate-400 mt-0.5">
                      <span className="uppercase font-semibold">{doc.file_type}</span>
                      {doc.file_size && <span>&bull; {doc.file_size}</span>}
                      {doc.attribute_name && (
                        <>
                          <span>&bull;</span>
                          <span className="text-[#024AE5] font-semibold">
                            {doc.attribute_name} Series
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                <a
                  href={doc.url}
                  target="_blank"
                  download
                  rel="noreferrer"
                  className="shrink-0"
                >
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 px-3 text-xs border-[#024AE5]/30 text-[#024AE5] hover:bg-[#024AE5]/10 font-semibold gap-1.5"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download</span>
                  </Button>
                </a>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
