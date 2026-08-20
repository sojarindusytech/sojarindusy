"use client";

import React, { useState, useTransition } from "react";
import { Product, ProductVariant, CategoryNode, Tag } from "@/types/database.types";
import { deleteProduct, fetchProductsList } from "@/actions/product";
import { deleteSku } from "@/actions/product-management";
import { ProductUploadModal } from "@/components/admin/ProductUploadModal";
import { ProductEditModal } from "@/components/admin/ProductEditModal";
import { AddSkuModal } from "@/components/admin/AddSkuModal";
import { EditSkuModal } from "@/components/admin/EditSkuModal";
import { AppendSkuModal } from "@/components/admin/AppendSkuModal";
import { BulkUpdateModal } from "@/components/admin/BulkUpdateModal";
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
} from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

import { useSearchParams } from "next/navigation";
import { useEffect } from "react";

interface ProductManagementClientProps {
  initialProducts: Product[];
  treeNodes?: CategoryNode[];
  availableTags?: Tag[];
}

export function ProductManagementClient({
  initialProducts,
  treeNodes = [],
  availableTags = [],
}: ProductManagementClientProps) {
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
  const [editingSku, setEditingSku] = useState<{ variant: ProductVariant, tags: { id: string; name: string }[] } | null>(null);
  const [addingSkuProductId, setAddingSkuProductId] = useState<{ id: string, tags: { id: string; name: string }[] } | null>(null);
  const [appendingSkuProductId, setAppendingSkuProductId] = useState<{ id: string, tags: Tag[] } | null>(null);
  const [bulkUpdatingProductId, setBulkUpdatingProductId] = useState<string | null>(null);
  const [tagFilters, setTagFilters] = useState<Record<string, string>>({});
  const [isPending, startTransition] = useTransition();

  const totalFamilies = products.length;
  const totalSkus = products.reduce((acc, p) => acc + (p.variants?.length || 0), 0);
  const totalStock = products.reduce(
    (acc, p) => acc + (p.variants?.reduce((vAcc, v) => vAcc + (v.stock_quantity || 0), 0) || 0),
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
    } else {
      toast.success("SKU deleted successfully.");
      refreshProducts();
    }
  };

  const filteredProducts = products.filter((p) => {
    const query = searchQuery.toLowerCase().trim();
    if (!query) return true;
    const matchTitle = p.title.toLowerCase().includes(query);
    const matchDesc = p.short_description?.toLowerCase().includes(query);
    const matchSku = p.variants?.some((v) => v.sku.toLowerCase().includes(query));
    return matchTitle || matchDesc || matchSku;
  });

  return (
    <div className="space-y-6 w-full max-w-full">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Products & SKU Variant Catalog
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Manage product families, uploaded CSV SKU matrices, stock quantities, and list prices.
          </p>
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
      <div className="flex items-center gap-3 bg-white p-3 border border-slate-200 rounded-xl">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            placeholder="Search by SKU Code (e.g. SIH65), product title, or parameter..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 h-9 text-xs bg-slate-50/60 border-slate-200"
          />
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
              <TableHead className="font-bold text-slate-900 h-10 text-center">Tags / Series</TableHead>
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
                              setAppendingSkuProductId({ id: product.id, tags: availableTags });
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
                            className="h-7 w-7 text-rose-500 hover:bg-rose-50 rounded"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>

                    {/* Expandable Sub-Row for SKUs */}
                    {isExpanded && (() => {
                      const activeFilter = tagFilters[product.id] || "all";
                      const filteredVariants = product.variants?.filter(v => activeFilter === "all" || (v.specifications as any)?.Tag === activeFilter) || [];
                      
                      return (
                      <TableRow className="bg-slate-50/50 hover:bg-slate-50/50 border-b-slate-200">
                        <TableCell colSpan={6} className="p-0">
                          <div className="px-10 py-5 space-y-4 shadow-inner border-t border-slate-100">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-4">
                                <h4 className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2">
                                  <Package className="h-3.5 w-3.5" />
                                  SKU Inventory Matrix
                                </h4>
                                {product.tags && product.tags.length > 0 && (
                                  <Select 
                                    value={activeFilter} 
                                    onValueChange={(val) => setTagFilters(prev => ({ ...prev, [product.id]: val }))}
                                  >
                                    <SelectTrigger className="h-7 text-xs border-slate-200 w-[160px] shadow-none bg-white">
                                      <SelectValue placeholder="Filter by Tag" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="all" className="text-xs">All Tags</SelectItem>
                                      {product.tags.map(t => (
                                        <SelectItem key={t.id} value={t.name} className="text-xs">{t.name}</SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                )}
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
                                  onClick={() => setAddingSkuProductId({ id: product.id, tags: product.tags || [] })}
                                  className="h-7 text-xs bg-[#024AE5] hover:bg-[#024AE5]/90 text-white shadow-none"
                                >
                                  <Plus className="h-3.5 w-3.5 mr-1" /> Add SKU
                                </Button>
                              </div>
                            </div>
                            <div className="border border-slate-200 rounded-lg overflow-hidden bg-white shadow-sm">
                              <Table className="w-full table-fixed text-xs">
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
                                    <TableHead className="font-bold text-slate-800 h-9 text-center">FLUTE(H)</TableHead>
                                    <TableHead className="font-bold text-slate-800 h-9 text-center">OVERALL(L)</TableHead>
                                    <TableHead className="font-bold text-slate-800 h-9 text-center">SHANK(D2)</TableHead>
                                    <TableHead className="font-bold text-slate-800 h-9 text-center">LIST PRICE</TableHead>
                                    <TableHead className="font-bold text-slate-800 h-9 text-center">STOCK</TableHead>
                                    <TableHead className="font-bold text-slate-800 h-9 text-right pr-4">ACTIONS</TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {filteredVariants.length === 0 ? (
                                    <TableRow>
                                      <TableCell colSpan={6} className="text-center py-5 text-slate-500 font-medium">No SKUs match the current filter.</TableCell>
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
                                        <TableCell className="text-center font-medium py-2.5 text-slate-600">{v.flute_length ?? "-"}</TableCell>
                                        <TableCell className="text-center font-medium py-2.5 text-slate-600">{v.overall_length ?? "-"}</TableCell>
                                        <TableCell className="text-center font-medium py-2.5 text-slate-600">{v.shank_diameter ?? "-"}</TableCell>
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
                                            onClick={() => setEditingSku({ variant: v, tags: product.tags || [] })}
                                            className="h-6 w-6 text-slate-500 hover:text-[#024AE5] hover:bg-slate-100 rounded mr-1"
                                          >
                                            <Edit2 className="h-3.5 w-3.5" />
                                          </Button>
                                          <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => handleDeleteSku(v.id)}
                                            className="h-6 w-6 text-rose-500 hover:bg-rose-50 rounded"
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
          availableTags={addingSkuProductId.tags}
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
          availableTags={editingSku.tags}
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
          availableTags={appendingSkuProductId.tags}
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
    </div>
  );
}
