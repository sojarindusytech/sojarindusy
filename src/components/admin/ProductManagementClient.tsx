"use client";

import React, { useState, useTransition } from "react";
import { Product, ProductVariant, CategoryNode, Attribute, Tag } from "@/types/database.types";
import { deleteProduct, fetchProductsList } from "@/actions/product";
import { deleteSku } from "@/actions/product-management";
import { ProductUploadModal } from "@/components/admin/ProductUploadModal";
import { ProductEditModal } from "@/components/admin/ProductEditModal";
import { AddSkuModal } from "@/components/admin/AddSkuModal";
import { EditSkuModal } from "@/components/admin/EditSkuModal";
import { AppendSkuModal } from "@/components/admin/AppendSkuModal";
import { BulkUpdateModal } from "@/components/admin/BulkUpdateModal";
import { SkuStockLogModal } from "@/components/admin/SkuStockLogModal";
import toast from "react-hot-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Package,
  Plus,
  Search,
  Upload,
  ChevronDown,
  ChevronUp,
  Tag as TagIcon,
  CheckCircle2,
  Trash2,
  Edit2,
  ShoppingCart,
  Minus,
  Download,
  Eye,
  FileSpreadsheet,
  Layers,
  Sparkles,
  History,
} from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

import { useSearchParams } from "next/navigation";
import { useEffect } from "react";

interface ProductManagementClientProps {
  initialProducts: Product[];
  treeNodes?: CategoryNode[];
  availableAttributes?: Attribute[];
  availableTags?: Tag[];
}

export function ProductManagementClient({
  initialProducts,
  treeNodes = [],
  availableAttributes,
  availableTags,
}: ProductManagementClientProps) {
  const activeAttributes = availableAttributes || availableTags || [];
  const searchParams = useSearchParams();
  const [products, setProducts] = useState<Product[]>(initialProducts);
  const [searchQuery, setSearchQuery] = useState("");
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);

  useEffect(() => {
    if (searchParams.get("upload") === "true" || searchParams.get("modal") === "open") {
      setIsUploadModalOpen(true);
    }
  }, [searchParams]);

  const [expandedProductIds, setExpandedProductIds] = useState<Record<string, boolean>>({});
  const [selectedSkus, setSelectedSkus] = useState<Record<string, string[]>>({});
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [editingSku, setEditingSku] = useState<{ variant: ProductVariant, attributes: { id: string; name: string }[] } | null>(null);
  const [addingSkuProductId, setAddingSkuProductId] = useState<{ id: string, attributes: { id: string; name: string }[] } | null>(null);
  const [appendingSkuProductId, setAppendingSkuProductId] = useState<{ id: string, attributes: Attribute[] } | null>(null);
  const [bulkUpdatingProductId, setBulkUpdatingProductId] = useState<string | null>(null);
  const [viewingStockLogVariant, setViewingStockLogVariant] = useState<{ variant: ProductVariant, productTitle: string } | null>(null);
  const [attributeFilters, setAttributeFilters] = useState<Record<string, string>>({});
  const [skuSearchQueries, setSkuSearchQueries] = useState<Record<string, string>>({});
  const [skuStockFilters, setSkuStockFilters] = useState<Record<string, "all" | "in_stock" | "out_of_stock">>({});
  const [selectedPath, setSelectedPath] = useState<string[]>([]);
  const [isPending, startTransition] = useTransition();

  const totalFamilies = products.length;
  const totalSkus = products.reduce((acc, p) => acc + (p.variants?.filter(v => !v.is_archived).length || 0), 0);
  const totalStock = products.reduce(
    (acc, p) => acc + (p.variants?.filter(v => !v.is_archived).reduce((vAcc, v) => vAcc + (v.stock_quantity || 0), 0) || 0),
    0
  );

  const toggleExpand = (id: string) => {
    setExpandedProductIds((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleDelete = (id: string) => {
    if (!confirm("Are you sure you want to delete this product family and all its SKUs?")) return;
    startTransition(async () => {
      const res = await deleteProduct(id);
      if (!res.error) {
        setProducts((prev) => prev.filter((p) => p.id !== id));
      }
    });
  };

  const refreshProducts = async () => {
    const updated = await fetchProductsList();
    setProducts(updated);
  };

  const handleSelectAllSkus = (productId: string, variants: ProductVariant[], checked: boolean) => {
    setSelectedSkus(prev => ({
      ...prev,
      [productId]: checked ? variants.map(v => v.id) : []
    }));
  };

  const handleSelectSku = (productId: string, variantId: string, checked: boolean) => {
    setSelectedSkus(prev => {
      const current = prev[productId] || [];
      return {
        ...prev,
        [productId]: checked ? [...current, variantId] : current.filter(id => id !== variantId)
      };
    });
  };

  const handleDeleteSku = async (variantId: string) => {
    if (!confirm("Are you sure you want to delete this SKU?")) return;
    const result = await deleteSku(variantId);
    if (result.error) {
      toast.error(result.error);
    } else if (result.archived) {
      toast.success("SKU archived (history and logs preserved).");
      refreshProducts();
    } else {
      toast.success("SKU deleted successfully.");
      refreshProducts();
    }
  };

  const activeCategoryId = selectedPath.length > 0 ? selectedPath[selectedPath.length - 1] : "all";

  // Helper to collect all descendent category IDs including the root
  const getDescendantIds = (nodes: CategoryNode[], targetId: string): Set<string> => {
    const ids = new Set<string>();
    let targetNode: CategoryNode | null = null;
    
    const findNode = (n: CategoryNode[]) => {
      for (const node of n) {
        if (node.id === targetId) targetNode = node;
        if (node.children) findNode(node.children);
      }
    };
    findNode(nodes);

    if (targetNode) {
      ids.add((targetNode as CategoryNode).id);
      const addChildren = (n: CategoryNode) => {
        if (n.children) {
          for (const c of n.children) {
            ids.add(c.id);
            addChildren(c);
          }
        }
      };
      addChildren(targetNode);
    }
    return ids;
  };

  const activeCategoryAndDescendants = React.useMemo(() => {
    if (activeCategoryId === "all") return new Set<string>();
    return getDescendantIds(treeNodes, activeCategoryId);
  }, [activeCategoryId, treeNodes]);

  const filteredProducts = products.filter((p) => {
    const query = searchQuery.toLowerCase().trim();
    
    let matchCat = true;
    if (activeCategoryId !== "all") {
      matchCat = p.categories?.some(c => activeCategoryAndDescendants.has(c.id)) || false;
    }

    if (!query) return matchCat;
    
    const matchTitle = p.title.toLowerCase().includes(query);
    const matchDesc = p.short_description?.toLowerCase().includes(query);
    const matchSku = p.variants?.some((v) => v.sku.toLowerCase().includes(query));
    
    return matchCat && (matchTitle || matchDesc || matchSku);
  });

  // Generate cascading dropdown data
  const dropdownsToRender: { level: number; options: CategoryNode[]; selectedValue: string }[] = [];
  let currentOptions = treeNodes;
  let currentPathLevel = 0;
  
  while (currentOptions && currentOptions.length > 0) {
    const selectedValue = selectedPath[currentPathLevel] || "all";
    dropdownsToRender.push({ level: currentPathLevel, options: currentOptions, selectedValue });
    
    if (selectedValue === "all") {
      break;
    }
    
    const selectedNode = currentOptions.find(n => n.id === selectedValue);
    if (selectedNode && selectedNode.children && selectedNode.children.length > 0) {
      currentOptions = selectedNode.children;
      currentPathLevel++;
    } else {
      break;
    }
  }

  const handleCategorySelect = (level: number, value: string) => {
    const newPath = [...selectedPath].slice(0, level);
    if (value !== "all") {
      newPath.push(value);
    }
    setSelectedPath(newPath);
  };

  return (
    <div className="space-y-6 w-full max-w-full">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Product Families
          </h1>
        </div>

        <div className="flex items-center gap-3">
          <Button
            size="sm"
            onClick={() => setIsUploadModalOpen(true)}
            className="h-9 px-4 text-xs bg-[#024AE5] text-white hover:bg-[#023ecc] gap-2 font-bold cursor-pointer shadow-xs"
          >
            <Plus className="h-4 w-4 stroke-[2.5]" />
            <span>Add New Product</span>
          </Button>
        </div>
      </div>

      {/* KPI Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <Card className="border border-slate-200 bg-white shadow-none rounded-xl p-4">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Product Families</p>
          <h3 className="text-2xl font-bold text-slate-900 mt-1">{totalFamilies}</h3>
        </Card>
        <Card className="border border-slate-200 bg-white shadow-none rounded-xl p-4">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Active SKUs</p>
          <h3 className="text-2xl font-bold text-[#024AE5] mt-1">{totalSkus}</h3>
        </Card>
        <Card className="border border-slate-200 bg-white shadow-none rounded-xl p-4">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Total Stock Units</p>
          <h3 className="text-2xl font-bold text-[#3C8B4F] mt-1">{totalStock} Units</h3>
        </Card>
      </div>

      {/* Search & Filter Bar */}
      <div className="flex flex-col sm:flex-row items-center gap-3 bg-white p-3 border border-slate-200 rounded-xl">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            placeholder="Search by SKU Code (e.g. SIH65), product title, or parameter..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 h-9 text-xs bg-slate-50/60 border-slate-200"
          />
        </div>
        <div className="flex flex-wrap gap-2 w-full sm:w-auto">
          {dropdownsToRender.map((dropdown) => (
            <div key={dropdown.level} className="w-full sm:w-[160px]">
              <Select value={dropdown.selectedValue} onValueChange={(val) => handleCategorySelect(dropdown.level, val)}>
                <SelectTrigger className="h-9 text-xs bg-slate-50/60 border-slate-200">
                  <SelectValue placeholder="All Categories" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{dropdown.level === 0 ? "All Categories" : "All Subcategories"}</SelectItem>
                  {dropdown.options.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id}>
                      {cat.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ))}
        </div>
      </div>

      {/* Products & SKU Matrix Cards */}
      <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-sm mt-6">
        <Table className="w-full text-xs">
          <TableHeader className="bg-slate-50 border-b border-slate-200">
            <TableRow className="hover:bg-slate-50">
              <TableHead className="w-10 text-center"></TableHead>
              <TableHead className="font-bold text-slate-900 h-10">Product Family</TableHead>
              <TableHead className="font-bold text-slate-900 h-10">Slug</TableHead>
              <TableHead className="font-bold text-slate-900 h-10 text-center">SKUs</TableHead>
              <TableHead className="font-bold text-slate-900 h-10 text-center">Attributes</TableHead>
              <TableHead className="font-bold text-slate-900 h-10 text-right pr-4">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredProducts.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="h-32 text-center text-slate-500 font-medium">
                  No products found. Upload your first product family to get started!
                </TableCell>
              </TableRow>
            ) : (
              filteredProducts.map((product) => {
                const isExpanded = expandedProductIds[product.id] ?? false;

                return (
                  <React.Fragment key={product.id}>
                    {/* Main Row */}
                    <TableRow className={cn("hover:bg-slate-50/70 border-b-slate-100 cursor-pointer transition-colors", isExpanded && "bg-slate-50/50")} onClick={() => toggleExpand(product.id)}>
                      <TableCell className="text-center py-3">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 text-slate-500 hover:text-slate-800"
                        >
                          {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        </Button>
                      </TableCell>
                      <TableCell className="font-bold text-slate-900 py-3">{product.title}</TableCell>
                      <TableCell className="font-mono text-slate-500 py-3">/{product.slug}</TableCell>
                      <TableCell className="text-center py-3">
                        <Badge className="bg-blue-50 text-[#024AE5] border-blue-200 hover:bg-blue-100 shadow-none font-bold">
                          {product.variants?.length || 0}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center py-3">
                        <div className="flex flex-wrap items-center justify-center gap-1.5">
                          {product.tags?.slice(0, 2).map((t) => (
                            <Badge key={t.id} variant="outline" className="text-[10px] text-slate-600 bg-white border-slate-200 font-semibold shadow-none">
                              {t.name}
                            </Badge>
                          ))}
                          {product.tags && product.tags.length > 2 && (
                            <Badge variant="outline" className="text-[10px] text-slate-400 font-semibold shadow-none">
                              +{product.tags.length - 2}
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right py-3 pr-4" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              setAppendingSkuProductId({ id: product.id, attributes: activeAttributes });
                            }}
                            className="h-7 text-xs border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-900 shadow-none"
                          >
                            <FileSpreadsheet className="h-3.5 w-3.5 mr-1 text-[#3C8B4F]" />
                            Import SKUs
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingProduct(product);
                            }}
                            className="h-7 text-xs border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-900 shadow-none"
                          >
                            <Edit2 className="h-3.5 w-3.5 mr-1 text-[#024AE5]" />
                            Edit
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDelete(product.id)}
                            className="h-7 w-7 text-rose-500 hover:bg-rose-50 rounded cursor-pointer"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>

                    {/* Expandable Sub-Row for SKUs */}
                    {isExpanded && (() => {
                      const activeFilter = attributeFilters[product.id] || "all";
                      const skuSearch = (skuSearchQueries[product.id] || "").trim().toLowerCase();
                      const stockFilter = skuStockFilters[product.id] || "all";
                      const prodAttributes = product.attributes || product.tags || [];

                      // 1. Stable Deterministic Sorting so order NEVER jumps on updates
                      const sortedVariants = [...(product.variants || [])].sort((a, b) => {
                        if (a.created_at && b.created_at && a.created_at !== b.created_at) {
                          return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
                        }
                        return (a.sku || "").localeCompare(b.sku || "", undefined, { numeric: true, sensitivity: "base" });
                      });

                      // 2. Multi-Criteria Filtering (Active Series, Stock Status, and Keyword Search)
                      const filteredVariants = sortedVariants.filter(v => {
                        if (v.is_archived) return false;

                        // Series / Attribute filter
                        if (activeFilter !== "all") {
                          const attrMatch = (v.specifications as any)?.Attribute === activeFilter ||
                                            (v.specifications as any)?.Tag === activeFilter;
                          if (!attrMatch) return false;
                        }

                        // Stock filter
                        if (stockFilter === "in_stock" && (v.stock_quantity || 0) <= 0) return false;
                        if (stockFilter === "out_of_stock" && (v.stock_quantity || 0) > 0) return false;

                        // SKU & Dimension Search Query
                        if (skuSearch) {
                          const matchesSku = v.sku?.toLowerCase().includes(skuSearch);
                          const matchesSpecs = v.specifications && Object.values(v.specifications).some(val => 
                            String(val).toLowerCase().includes(skuSearch)
                          );
                          const matchesDims = [v.diameter, v.flute_length, v.overall_length, v.shank_diameter]
                            .filter(Boolean)
                            .some(dim => String(dim).includes(skuSearch));
                          if (!matchesSku && !matchesSpecs && !matchesDims) return false;
                        }

                        return true;
                      });
                      
                      // Compute dynamic dimension and custom specification columns
                      const hasDiameter = filteredVariants.some(v => v.diameter != null);
                      const hasFluteLength = filteredVariants.some(v => v.flute_length != null);
                      const hasOverallLength = filteredVariants.some(v => v.overall_length != null);
                      const hasShankDiameter = filteredVariants.some(v => v.shank_diameter != null);

                      const customSpecKeys = new Set<string>();
                      filteredVariants.forEach(v => {
                        if (v.specifications && typeof v.specifications === "object") {
                          Object.keys(v.specifications).forEach(key => {
                            if (key !== "Tag" && key !== "Attribute" && key !== "ShortDescription") {
                              customSpecKeys.add(key);
                            }
                          });
                        }
                      });
                      const dynamicSpecs = Array.from(customSpecKeys);
                      const totalColumnCount = 4 + (hasDiameter ? 1 : 0) + (hasFluteLength ? 1 : 0) + (hasOverallLength ? 1 : 0) + (hasShankDiameter ? 1 : 0) + dynamicSpecs.length;

                      const totalActiveSkus = product.variants?.filter(v => !v.is_archived).length || 0;

                      return (
                      <TableRow className="bg-slate-50/50 hover:bg-slate-50/50 border-b-slate-200">
                        <TableCell colSpan={6} className="p-0">
                          <div className="px-10 py-5 space-y-4 shadow-inner border-t border-slate-100">
                            <div className="flex flex-wrap items-center justify-between gap-3">
                              <div className="flex flex-wrap items-center gap-2.5">
                                <h4 className="text-[11px] font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5 mr-1">
                                  <Package className="h-3.5 w-3.5 text-slate-500" />
                                  SKU Inventory Matrix
                                </h4>

                                {/* Instant SKU Search Input */}
                                <div className="relative">
                                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
                                  <Input
                                    type="text"
                                    placeholder="Search SKU or spec..."
                                    value={skuSearchQueries[product.id] || ""}
                                    onChange={(e) => setSkuSearchQueries(prev => ({ ...prev, [product.id]: e.target.value }))}
                                    className="pl-8 h-7 text-xs w-[170px] bg-white border-slate-200 shadow-none focus-visible:ring-1 focus-visible:ring-slate-400"
                                  />
                                </div>

                                {/* Attribute Series Filter */}
                                {prodAttributes && prodAttributes.length > 0 && (
                                  <Select 
                                    value={activeFilter} 
                                    onValueChange={(val) => setAttributeFilters(prev => ({ ...prev, [product.id]: val }))}
                                  >
                                    <SelectTrigger className="h-7 text-xs border-slate-200 w-[135px] shadow-none bg-white">
                                      <SelectValue placeholder="All Attributes" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="all" className="text-xs">All Attributes</SelectItem>
                                      {prodAttributes.map(t => (
                                        <SelectItem key={t.id} value={t.name} className="text-xs">{t.name}</SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                )}

                                {/* Stock Status Filter */}
                                <Select 
                                  value={stockFilter} 
                                  onValueChange={(val) => setSkuStockFilters(prev => ({ ...prev, [product.id]: val as any }))}
                                >
                                  <SelectTrigger className="h-7 text-xs border-slate-200 w-[125px] shadow-none bg-white">
                                    <SelectValue placeholder="All Stock" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="all" className="text-xs">All Stock</SelectItem>
                                    <SelectItem value="in_stock" className="text-xs text-emerald-700 font-medium">In Stock (&gt;0)</SelectItem>
                                    <SelectItem value="out_of_stock" className="text-xs text-rose-600 font-medium">Out of Stock</SelectItem>
                                  </SelectContent>
                                </Select>

                                <span className="text-[11px] text-slate-500 font-medium pl-1">
                                  {filteredVariants.length} of {totalActiveSkus} SKUs
                                </span>
                              </div>

                              <div className="flex gap-2">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => setBulkUpdatingProductId(product.id)}
                                  disabled={!(selectedSkus[product.id]?.length > 0)}
                                  className="h-7 text-xs border-slate-200"
                                >
                                  Bulk Update ({selectedSkus[product.id]?.length || 0})
                                </Button>
                                <Button
                                  size="sm"
                                  onClick={() => setAddingSkuProductId({ id: product.id, attributes: prodAttributes })}
                                  className="h-7 text-xs bg-[#024AE5] hover:bg-[#024AE5]/90 text-white shadow-none"
                                >
                                  <Plus className="h-3.5 w-3.5 mr-1" /> Add SKU
                                </Button>
                              </div>
                            </div>
                            <div className="border border-slate-200 rounded-lg overflow-x-auto bg-white shadow-sm">
                              <Table className="w-full text-xs min-w-[650px]">
                                <TableHeader className="bg-slate-100/50">
                                  <TableRow className="hover:bg-slate-100/50 border-b-slate-200">
                                    <TableHead className="w-10 text-center px-2">
                                      <input
                                        type="checkbox"
                                        checked={(filteredVariants.length > 0 && filteredVariants.every(v => selectedSkus[product.id]?.includes(v.id))) || false}
                                        onChange={(e) => handleSelectAllSkus(product.id, filteredVariants, e.target.checked)}
                                        className="cursor-pointer"
                                      />
                                    </TableHead>
                                    <TableHead className="font-bold text-slate-800 h-9">SKU CODE</TableHead>
                                    {hasDiameter && <TableHead className="font-bold text-slate-800 h-9 text-center">DIA(D)</TableHead>}
                                    {hasFluteLength && <TableHead className="font-bold text-slate-800 h-9 text-center">FLUTE(H)</TableHead>}
                                    {hasOverallLength && <TableHead className="font-bold text-slate-800 h-9 text-center">OVERALL(L)</TableHead>}
                                    {hasShankDiameter && <TableHead className="font-bold text-slate-800 h-9 text-center">SHANK(D2)</TableHead>}
                                    {dynamicSpecs.map(spec => (
                                      <TableHead key={spec} className="font-bold text-slate-800 h-9 text-center uppercase">{spec}</TableHead>
                                    ))}
                                    <TableHead className="font-bold text-slate-800 h-9 text-center">LIST PRICE</TableHead>
                                    <TableHead className="font-bold text-slate-800 h-9 text-center">STOCK</TableHead>
                                    <TableHead className="font-bold text-slate-800 h-9 text-right pr-4">ACTIONS</TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {filteredVariants.length === 0 ? (
                                    <TableRow>
                                      <TableCell colSpan={totalColumnCount} className="text-center py-5 text-slate-500 font-medium">No SKUs match the current filter.</TableCell>
                                    </TableRow>
                                  ) : (
                                    filteredVariants.map((v) => (
                                      <TableRow key={v.id} className="hover:bg-slate-50/60 border-b-slate-100">
                                        <TableCell className="text-center px-2">
                                          <input
                                            type="checkbox"
                                            checked={selectedSkus[product.id]?.includes(v.id) || false}
                                            onChange={(e) => handleSelectSku(product.id, v.id, e.target.checked)}
                                            className="cursor-pointer"
                                          />
                                        </TableCell>
                                        <TableCell className="font-mono font-bold text-[#024AE5] py-2.5">{v.sku}</TableCell>
                                        {hasDiameter && <TableCell className="text-center font-medium py-2.5 text-slate-600">{v.diameter ?? "-"}</TableCell>}
                                        {hasFluteLength && <TableCell className="text-center font-medium py-2.5 text-slate-600">{v.flute_length ?? "-"}</TableCell>}
                                        {hasOverallLength && <TableCell className="text-center font-medium py-2.5 text-slate-600">{v.overall_length ?? "-"}</TableCell>}
                                        {hasShankDiameter && <TableCell className="text-center font-medium py-2.5 text-slate-600">{v.shank_diameter ?? "-"}</TableCell>}
                                        {dynamicSpecs.map(spec => (
                                          <TableCell key={spec} className="text-center font-medium py-2.5 text-slate-600">
                                            {(v.specifications as any)?.[spec] ?? "-"}
                                          </TableCell>
                                        ))}
                                        <TableCell className="text-center font-mono font-semibold py-2.5 text-slate-900">₹{v.list_price.toFixed(2)}</TableCell>
                                        <TableCell className="text-center py-2.5">
                                          {v.stock_quantity > 0 ? (
                                            <span className="inline-flex items-center text-[#3C8B4F] font-bold text-[11px] bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100">
                                              {v.stock_quantity} Units
                                            </span>
                                          ) : (
                                            <span className="inline-flex items-center text-rose-600 font-bold text-[11px] bg-rose-50 px-2 py-0.5 rounded border border-rose-100">
                                              Out of Stock
                                            </span>
                                          )}
                                        </TableCell>
                                        <TableCell className="text-right pr-4">
                                          <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => setViewingStockLogVariant({ variant: v, productTitle: product.title })}
                                            className="h-6 w-6 text-slate-500 hover:text-[#024AE5] hover:bg-slate-100 rounded mr-1 cursor-pointer"
                                            title="View Stock Audit Log"
                                          >
                                            <History className="h-3.5 w-3.5" />
                                          </Button>
                                          <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => setEditingSku({ variant: v, attributes: (product.attributes || product.tags || []) })}
                                            className="h-6 w-6 text-slate-500 hover:text-[#024AE5] hover:bg-slate-100 rounded mr-1 cursor-pointer"
                                            title="Edit SKU"
                                          >
                                            <Edit2 className="h-3.5 w-3.5" />
                                          </Button>
                                          <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => handleDeleteSku(v.id)}
                                            className="h-6 w-6 text-rose-500 hover:bg-rose-50 rounded cursor-pointer"
                                            title="Delete or Archive SKU"
                                          >
                                            <Trash2 className="h-3.5 w-3.5" />
                                          </Button>
                                        </TableCell>
                                      </TableRow>
                                    ))
                                  )}
                                </TableBody>
                              </Table>
                            </div>
                          </div>
                        </TableCell>
                      </TableRow>
                      );
                    })()}
                  </React.Fragment>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Add Product / CSV Upload Dialog Modal */}
      <ProductUploadModal
        isOpen={isUploadModalOpen}
        onClose={() => {
          setIsUploadModalOpen(false);
          refreshProducts();
        }}
        treeNodes={treeNodes}
        availableTags={availableTags}
      />

      {editingProduct && (
        <ProductEditModal
          isOpen={true}
          onClose={() => {
            setEditingProduct(null);
            refreshProducts();
          }}
          product={editingProduct}
        />
      )}

      {addingSkuProductId && (
        <AddSkuModal
          isOpen={true}
          onClose={() => {
            setAddingSkuProductId(null);
            refreshProducts();
          }}
          productId={addingSkuProductId.id}
          availableAttributes={addingSkuProductId.attributes}
          availableTags={addingSkuProductId.attributes}
        />
      )}

      {editingSku && (
        <EditSkuModal
          isOpen={true}
          onClose={() => {
            setEditingSku(null);
            refreshProducts();
          }}
          variant={editingSku.variant}
          availableAttributes={editingSku.attributes}
          availableTags={editingSku.attributes}
        />
      )}

      {appendingSkuProductId && (
        <AppendSkuModal
          isOpen={true}
          onClose={() => {
            setAppendingSkuProductId(null);
            refreshProducts();
          }}
          productId={appendingSkuProductId.id}
          availableAttributes={appendingSkuProductId.attributes}
          availableTags={appendingSkuProductId.attributes}
        />
      )}

      {bulkUpdatingProductId && (
        <BulkUpdateModal
          isOpen={true}
          onClose={() => {
            setBulkUpdatingProductId(null);
            setSelectedSkus(prev => ({ ...prev, [bulkUpdatingProductId]: [] }));
          }}
          selectedVariantIds={selectedSkus[bulkUpdatingProductId] || []}
          onSuccess={() => {
            refreshProducts();
          }}
        />
      )}

      {viewingStockLogVariant && (
        <SkuStockLogModal
          isOpen={true}
          onClose={() => setViewingStockLogVariant(null)}
          variant={viewingStockLogVariant.variant}
          productTitle={viewingStockLogVariant.productTitle}
          onStockUpdated={() => refreshProducts()}
        />
      )}
    </div>
  );
}
