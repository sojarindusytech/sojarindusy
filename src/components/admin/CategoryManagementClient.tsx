"use client";

import { useState, useTransition, useMemo } from "react";
import { Category, CategoryNode } from "@/types/database.types";
import {
  createCategory,
  updateCategory,
  deleteCategory,
  toggleCategoryStatus,
  generateSlug,
} from "@/actions/category";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Folder,
  FolderPlus,
  Tag,
  Plus,
  Edit2,
  Trash2,
  Search,
  CheckCircle2,
  AlertCircle,
  ChevronRight,
  ChevronDown,
  Layers,
  Sparkles,
  RefreshCw,
  X,
  AlertTriangle,
  ArrowUpDown,
  Check,
  Image as ImageIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface CategoryManagementClientProps {
  initialFlatCategories: Category[];
  initialTreeNodes: CategoryNode[];
}

export function CategoryManagementClient({
  initialFlatCategories,
  initialTreeNodes,
}: CategoryManagementClientProps) {
  const [flatCategories, setFlatCategories] = useState<Category[]>(initialFlatCategories);
  const [treeNodes, setTreeNodes] = useState<CategoryNode[]>(initialTreeNodes);

  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [isPending, startTransition] = useTransition();

  // Form State
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formValues, setFormValues] = useState({
    name: "",
    slug: "",
    parent_id: "none",
    description: "",
    image_url: "",
    display_order: "0",
    is_active: "true",
  });
  const [isSlugManuallyEdited, setIsSlugManuallyEdited] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);

  // Expanded Tree Nodes State
  const [expandedNodes, setExpandedNodes] = useState<Record<string, boolean>>({});

  // Confirmation Alert Dialog State (shadcn)
  const [deleteConfirmCategory, setDeleteConfirmCategory] = useState<Category | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Statistics Calculations
  const totalCount = flatCategories.length;
  const rootCount = flatCategories.filter((c) => !c.parent_id).length;
  const subCount = flatCategories.filter((c) => Boolean(c.parent_id)).length;
  const activeCount = flatCategories.filter((c) => c.is_active).length;

  // Re-build tree & flat helper when updating local state
  const refreshLocalState = (newList: Category[]) => {
    setFlatCategories(newList);

    const map = new Map<string, CategoryNode>();
    newList.forEach((c) => {
      map.set(c.id, { ...c, depth: 0, children: [], parent_name: null });
    });

    map.forEach((node) => {
      if (node.parent_id && map.has(node.parent_id)) {
        node.parent_name = map.get(node.parent_id)?.name || null;
      }
    });

    const buildSubtree = (parentId: string | null, depth: number): CategoryNode[] => {
      const children: CategoryNode[] = [];
      map.forEach((node) => {
        if (node.parent_id === parentId) {
          node.depth = depth;
          node.children = buildSubtree(node.id, depth + 1);
          children.push(node);
        }
      });
      return children;
    };

    const roots: CategoryNode[] = [];
    map.forEach((node) => {
      if (!node.parent_id || !map.has(node.parent_id)) {
        node.depth = 0;
        node.children = buildSubtree(node.id, 1);
        roots.push(node);
      }
    });

    setTreeNodes(roots);
  };

  // Handle Form Name Input (Auto-generate slug if not manually touched)
  const handleNameChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setFormValues((prev) => ({
      ...prev,
      name: val,
      slug: isSlugManuallyEdited ? prev.slug : val.toLowerCase().replace(/[^\w\s-]/g, "").replace(/[\s_-]+/g, "-"),
    }));
  };

  // Handle Add Subcategory Preset Action
  const handleAddSubcategoryPreset = (parentCategory: Category) => {
    setEditingId(null);
    setFormError(null);
    setFormSuccess(null);
    setIsSlugManuallyEdited(false);
    setFormValues({
      name: "",
      slug: "",
      parent_id: parentCategory.id,
      description: "",
      image_url: "",
      display_order: "0",
      is_active: "true",
    });
  };

  // Populate Edit Form
  const handleStartEdit = (category: Category) => {
    setEditingId(category.id);
    setFormError(null);
    setFormSuccess(null);
    setIsSlugManuallyEdited(true);
    setFormValues({
      name: category.name,
      slug: category.slug,
      parent_id: category.parent_id || "none",
      description: category.description || "",
      image_url: category.image_url || "",
      display_order: String(category.display_order ?? 0),
      is_active: category.is_active ? "true" : "false",
    });
  };

  // Reset Form
  const handleResetForm = () => {
    setEditingId(null);
    setFormError(null);
    setFormSuccess(null);
    setIsSlugManuallyEdited(false);
    setFormValues({
      name: "",
      slug: "",
      parent_id: "none",
      description: "",
      image_url: "",
      display_order: "0",
      is_active: "true",
    });
  };

  // Form Submit (Create or Update)
  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setFormSuccess(null);

    if (!formValues.name.trim()) {
      setFormError("Category name is required.");
      return;
    }

    const formData = new FormData();
    formData.append("name", formValues.name);
    formData.append("slug", formValues.slug);
    formData.append("parent_id", formValues.parent_id);
    formData.append("description", formValues.description);
    formData.append("image_url", formValues.image_url);
    formData.append("display_order", formValues.display_order);
    formData.append("is_active", formValues.is_active);

    startTransition(async () => {
      if (editingId) {
        // Update existing category
        const res = await updateCategory(editingId, formData);
        if (res.error) {
          setFormError(res.error);
        } else {
          setFormSuccess("Category updated successfully.");
          const updatedList = flatCategories.map((c) =>
            c.id === editingId
              ? {
                  ...c,
                  name: formValues.name,
                  slug: formValues.slug || c.slug,
                  parent_id: formValues.parent_id === "none" ? null : formValues.parent_id,
                  description: formValues.description || null,
                  image_url: formValues.image_url || null,
                  display_order: Number(formValues.display_order) || 0,
                  is_active: formValues.is_active === "true",
                }
              : c
          );
          refreshLocalState(updatedList);
          handleResetForm();
        }
      } else {
        // Create new category
        const res = await createCategory(formData);
        if (res.error) {
          setFormError(res.error);
        } else {
          setFormSuccess("Category created successfully.");
          if (res.category) {
            refreshLocalState([res.category, ...flatCategories]);
          }
          handleResetForm();
        }
      }
    });
  };

  // Perform Category Deletion (Checks strict child prevention rule)
  const handleConfirmDelete = async () => {
    if (!deleteConfirmCategory) return;
    setDeleteError(null);

    const targetId = deleteConfirmCategory.id;

    startTransition(async () => {
      const res = await deleteCategory(targetId);
      if (res.error) {
        setDeleteError(res.error);
      } else {
        setDeleteConfirmCategory(null);
        refreshLocalState(flatCategories.filter((c) => c.id !== targetId));
      }
    });
  };

  // Toggle Category Active Status
  const handleToggleActive = (category: Category) => {
    const newStatus = !category.is_active;
    startTransition(async () => {
      const updatedList = flatCategories.map((c) =>
        c.id === category.id ? { ...c, is_active: newStatus } : c
      );
      refreshLocalState(updatedList);
      await toggleCategoryStatus(category.id, newStatus);
    });
  };

  // Flatten tree for hierarchical table display with depth indicators
  const flattenedDisplayTree = useMemo(() => {
    const result: CategoryNode[] = [];

    const traverse = (node: CategoryNode) => {
      // Check search query filter
      const query = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !query ||
        node.name.toLowerCase().includes(query) ||
        node.slug.toLowerCase().includes(query) ||
        node.description?.toLowerCase().includes(query);

      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "active" && node.is_active) ||
        (statusFilter === "inactive" && !node.is_active);

      if (matchesSearch && matchesStatus) {
        result.push(node);
      }

      const isExpanded = expandedNodes[node.id] ?? true;
      if (node.children && node.children.length > 0 && isExpanded) {
        node.children.forEach((child) => traverse(child));
      }
    };

    treeNodes.forEach((root) => traverse(root));
    return result;
  }, [treeNodes, searchQuery, statusFilter, expandedNodes]);

  return (
    <div className="space-y-6 w-full max-w-full">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Categories & Hierarchy
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Manage WordPress-style free-form nested categories, image assets, and product taxonomies.
          </p>
        </div>

        <Button
          type="button"
          size="sm"
          onClick={handleResetForm}
          className="gap-1.5 text-xs bg-[#024AE5] text-white hover:bg-[#023ecc] shadow-none cursor-pointer font-medium"
        >
          <FolderPlus className="h-3.5 w-3.5" />
          <span>+ Add Root Category</span>
        </Button>
      </div>

      {/* KPI Metric Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Categories */}
        <Card className="border border-slate-200 bg-white shadow-none rounded-xl p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] font-medium uppercase tracking-wider text-slate-500">
                Total Categories
              </p>
              <h3 className="text-2xl font-bold text-slate-900 mt-1">{totalCount}</h3>
            </div>
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 text-slate-600 border border-slate-200/60">
              <Layers className="h-4 w-4" />
            </div>
          </div>
          <p className="text-[11px] text-slate-500 mt-2">Hierarchical category taxonomy</p>
        </Card>

        {/* Root Categories */}
        <Card className="border border-slate-200 bg-white shadow-none rounded-xl p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] font-medium uppercase tracking-wider text-slate-500">
                Root Categories
              </p>
              <h3 className="text-2xl font-bold text-slate-900 mt-1">{rootCount}</h3>
            </div>
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 text-slate-600 border border-slate-200/60">
              <Folder className="h-4 w-4" />
            </div>
          </div>
          <p className="text-[11px] text-slate-500 mt-2">Top-level primary branches</p>
        </Card>

        {/* Subcategories */}
        <Card className="border border-slate-200 bg-white shadow-none rounded-xl p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] font-medium uppercase tracking-wider text-slate-500">
                Subcategories
              </p>
              <h3 className="text-2xl font-bold text-slate-900 mt-1">{subCount}</h3>
            </div>
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 text-slate-600 border border-slate-200/60">
              <Tag className="h-4 w-4" />
            </div>
          </div>
          <p className="text-[11px] text-slate-500 mt-2">Nested parent-child subtrees</p>
        </Card>

        {/* Active Categories */}
        <Card className="border border-slate-200 bg-white shadow-none rounded-xl p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] font-medium uppercase tracking-wider text-slate-500">
                Active Categories
              </p>
              <h3 className="text-2xl font-bold text-slate-900 mt-1">{activeCount}</h3>
            </div>
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 text-slate-600 border border-slate-200/60">
              <CheckCircle2 className="h-4 w-4" />
            </div>
          </div>
          <p className="text-[11px] text-slate-500 mt-2">Published for product upload</p>
        </Card>
      </div>

      {/* Split Screen Layout: Left Form (Add/Edit) + Right Hierarchical Tree Table */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* LEFT COLUMN: Add / Edit Category Form (4 cols) */}
        <Card className="lg:col-span-4 border border-slate-200 bg-white shadow-none rounded-xl">
          <CardHeader className="border-b border-slate-100 pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-bold text-slate-900 flex items-center gap-2">
                {editingId ? (
                  <>
                    <Edit2 className="h-4 w-4 text-[#024AE5]" /> Edit Category
                  </>
                ) : (
                  <>
                    <Plus className="h-4 w-4 text-[#024AE5]" /> Add New Category
                  </>
                )}
              </CardTitle>
              {editingId && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleResetForm}
                  className="h-7 text-xs text-slate-500 hover:text-slate-900 px-2"
                >
                  Reset
                </Button>
              )}
            </div>
          </CardHeader>

          <CardContent className="p-4 space-y-4">
            {formError && (
              <div className="flex items-start gap-2 rounded-lg border border-rose-500/20 bg-rose-50 p-2.5 text-xs text-rose-800">
                <AlertCircle className="h-4 w-4 shrink-0 text-rose-600 mt-0.5" />
                <p>{formError}</p>
              </div>
            )}
            {formSuccess && (
              <div className="flex items-start gap-2 rounded-lg border border-emerald-500/20 bg-emerald-50 p-2.5 text-xs text-emerald-800">
                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 mt-0.5" />
                <p>{formSuccess}</p>
              </div>
            )}

            <form onSubmit={handleSubmitForm} className="space-y-4">
              {/* Category Name */}
              <div className="space-y-1">
                <Label className="text-xs font-medium text-slate-700">
                  Category Name <span className="text-red-500">*</span>
                </Label>
                <Input
                  name="name"
                  value={formValues.name}
                  onChange={handleNameChange}
                  placeholder="e.g. End Mills, Flat End Mills"
                  required
                  className="h-9 text-xs border-slate-200"
                />
              </div>

              {/* URL Slug */}
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-medium text-slate-700">URL Slug</Label>
                  <span className="text-[10px] text-slate-400">Auto-generated</span>
                </div>
                <Input
                  name="slug"
                  value={formValues.slug}
                  onChange={(e) => {
                    setIsSlugManuallyEdited(true);
                    setFormValues((prev) => ({ ...prev, slug: e.target.value }));
                  }}
                  placeholder="e.g. end-mills"
                  className="h-9 text-xs border-slate-200 font-mono text-slate-600"
                />
              </div>

              {/* Category Image URL */}
              <div className="space-y-1">
                <Label className="text-xs font-medium text-slate-700">Category Image URL (Optional)</Label>
                <div className="flex items-center gap-2">
                  <Input
                    name="image_url"
                    value={formValues.image_url}
                    onChange={(e) => setFormValues((prev) => ({ ...prev, image_url: e.target.value }))}
                    placeholder="https://example.com/category-image.jpg"
                    className="h-9 text-xs border-slate-200 flex-1"
                  />
                  {formValues.image_url ? (
                    <div className="h-9 w-9 rounded-lg border border-slate-200 overflow-hidden shrink-0 bg-slate-50 flex items-center justify-center">
                      <img
                        src={formValues.image_url}
                        alt="Preview"
                        className="h-full w-full object-cover"
                        onError={(e) => {
                          (e.target as HTMLElement).style.display = "none";
                        }}
                      />
                    </div>
                  ) : (
                    <div className="h-9 w-9 rounded-lg border border-slate-200/80 bg-slate-50 flex items-center justify-center text-slate-400 shrink-0">
                      <ImageIcon className="h-4 w-4" />
                    </div>
                  )}
                </div>
                <p className="text-[10px] text-slate-400">Image URL for store category banners & navigation icons.</p>
              </div>

              {/* Parent Category Selector */}
              <div className="space-y-1">
                <Label className="text-xs font-medium text-slate-700">Parent Category</Label>
                <Select
                  value={formValues.parent_id}
                  onValueChange={(val) => setFormValues((prev) => ({ ...prev, parent_id: val }))}
                >
                  <SelectTrigger className="h-9 text-xs bg-white border-slate-200 text-slate-800">
                    <SelectValue placeholder="Select Parent Category" />
                  </SelectTrigger>
                  <SelectContent className="max-h-60">
                    <SelectItem value="none" className="font-semibold text-slate-900">
                      None (Top-Level Root Category)
                    </SelectItem>
                    {flatCategories
                      .filter((c) => c.id !== editingId)
                      .map((c) => {
                        // Calculate indent prefix
                        const getIndent = (catId: string, depth = 0): string => {
                          const cat = flatCategories.find((item) => item.id === catId);
                          if (!cat || !cat.parent_id || depth > 5) {
                            return "—".repeat(depth);
                          }
                          return getIndent(cat.parent_id, depth + 1);
                        };

                        const indent = getIndent(c.id);
                        return (
                          <SelectItem key={c.id} value={c.id} className="text-xs">
                            {indent} {c.name}
                          </SelectItem>
                        );
                      })}
                  </SelectContent>
                </Select>
                <p className="text-[10px] text-slate-400 mt-0.5">
                  Select a parent to nest under, or "None" to create a root category.
                </p>
              </div>

              {/* Description */}
              <div className="space-y-1">
                <Label className="text-xs font-medium text-slate-700">Description (Optional)</Label>
                <Input
                  name="description"
                  value={formValues.description}
                  onChange={(e) => setFormValues((prev) => ({ ...prev, description: e.target.value }))}
                  placeholder="Tooling applications, geometry notes..."
                  className="h-9 text-xs border-slate-200"
                />
              </div>

              {/* Display Order & Active Status */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs font-medium text-slate-700">Display Order</Label>
                  <Input
                    type="number"
                    name="display_order"
                    value={formValues.display_order}
                    onChange={(e) => setFormValues((prev) => ({ ...prev, display_order: e.target.value }))}
                    className="h-9 text-xs border-slate-200 font-semibold"
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-medium text-slate-700">Status</Label>
                  <Select
                    value={formValues.is_active}
                    onValueChange={(val) => setFormValues((prev) => ({ ...prev, is_active: val }))}
                  >
                    <SelectTrigger className="h-9 text-xs bg-white border-slate-200">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="true">Active</SelectItem>
                      <SelectItem value="false">Inactive</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Form Buttons */}
              <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100">
                {editingId && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleResetForm}
                    className="h-8 text-xs border-slate-200"
                  >
                    Cancel
                  </Button>
                )}
                <Button
                  type="submit"
                  size="sm"
                  disabled={isPending}
                  className="h-8 text-xs bg-[#024AE5] text-white hover:bg-[#023ecc] font-medium cursor-pointer"
                >
                  {isPending ? "Saving..." : editingId ? "Update Category" : "Save Category"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        {/* RIGHT COLUMN: Hierarchical Category Tree Table (8 cols) */}
        <Card className="lg:col-span-8 border border-slate-200 bg-white shadow-none rounded-xl overflow-hidden">
          {/* Toolbar */}
          <div className="p-3.5 border-b border-slate-200 bg-white flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
              <Input
                type="text"
                placeholder="Filter category name, slug or description..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 h-8 text-xs bg-slate-50/60 border-slate-200 focus-visible:bg-white"
              />
            </div>

            <div className="flex items-center gap-2">
              <div className="w-[140px]">
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="h-8 text-xs bg-white border-slate-200 text-slate-700">
                    <SelectValue placeholder="All Statuses" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    <SelectItem value="active">Active Only</SelectItem>
                    <SelectItem value="inactive">Inactive Only</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {(searchQuery || statusFilter !== "all") && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setSearchQuery("");
                    setStatusFilter("all");
                  }}
                  className="h-8 text-xs text-slate-500 hover:text-slate-900 px-2"
                >
                  Reset
                </Button>
              )}
            </div>
          </div>

          {/* Tree Table */}
          <Table className="w-full table-fixed">
            <TableHeader className="bg-slate-50/80 border-b border-slate-200">
              <TableRow className="hover:bg-transparent border-0">
                <TableHead className="w-[45%] text-[11px] font-semibold text-slate-600 tracking-wider uppercase py-2.5 px-3.5">
                  Category Name & Hierarchy
                </TableHead>
                <TableHead className="w-[22%] text-[11px] font-semibold text-slate-600 tracking-wider uppercase py-2.5 px-3.5">
                  Slug
                </TableHead>
                <TableHead className="w-[11%] text-[11px] font-semibold text-slate-600 tracking-wider uppercase py-2.5 px-3.5 text-center">
                  Order
                </TableHead>
                <TableHead className="w-[11%] text-[11px] font-semibold text-slate-600 tracking-wider uppercase py-2.5 px-3.5 text-center">
                  Status
                </TableHead>
                <TableHead className="w-[11%] text-[11px] font-semibold text-slate-600 tracking-wider uppercase py-2.5 px-3.5 text-right">
                  Actions
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {flattenedDisplayTree.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-12 text-slate-500 bg-white">
                    <div className="flex flex-col items-center justify-center space-y-2">
                      <Folder className="h-8 w-8 text-slate-300" />
                      <p className="text-sm font-medium text-slate-700">No categories found</p>
                      <p className="text-xs text-slate-400">
                        Create a root category using the form on the left.
                      </p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                flattenedDisplayTree.map((node) => {
                  const hasChildren = node.children && node.children.length > 0;
                  const isExpanded = expandedNodes[node.id] ?? true;

                  return (
                    <TableRow
                      key={node.id}
                      className={cn(
                        "hover:bg-slate-50/70 transition-colors bg-white border-b border-slate-200/80",
                        editingId === node.id && "bg-blue-50/40"
                      )}
                    >
                      {/* Name & Indented Hierarchy */}
                      <TableCell className="py-2.5 px-3.5 truncate">
                        <div
                          className="flex items-center gap-1.5 min-w-0"
                          style={{ paddingLeft: `${node.depth * 16}px` }}
                        >
                          {/* Tree Indent Line Indicator */}
                          {node.depth > 0 && (
                            <span className="text-slate-300 font-mono text-xs shrink-0 select-none">
                              └─
                            </span>
                          )}

                          {/* Expand/Collapse Toggle */}
                          {hasChildren ? (
                            <button
                              type="button"
                              onClick={() =>
                                setExpandedNodes((prev) => ({
                                  ...prev,
                                  [node.id]: !isExpanded,
                                }))
                              }
                              className="h-5 w-5 shrink-0 flex items-center justify-center rounded text-slate-500 hover:bg-slate-200/60 cursor-pointer"
                            >
                              {isExpanded ? (
                                <ChevronDown className="h-3.5 w-3.5 text-slate-600" />
                              ) : (
                                <ChevronRight className="h-3.5 w-3.5 text-slate-600" />
                              )}
                            </button>
                          ) : (
                            <span className="w-5 shrink-0" />
                          )}

                          {/* Category Image Thumbnail or Icon */}
                          {node.image_url ? (
                            <div className="h-6 w-6 rounded border border-slate-200 overflow-hidden shrink-0 bg-slate-50">
                              <img
                                src={node.image_url}
                                alt={node.name}
                                className="h-full w-full object-cover"
                                onError={(e) => {
                                  (e.target as HTMLElement).style.display = "none";
                                }}
                              />
                            </div>
                          ) : node.depth === 0 ? (
                            <Folder className="h-4 w-4 text-slate-600 shrink-0" />
                          ) : (
                            <Tag className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                          )}

                          {/* Title & Sub-count Badge */}
                          <div className="min-w-0 flex items-center gap-1.5">
                            <span
                              className={cn(
                                "text-xs text-slate-900 truncate",
                                node.depth === 0 ? "font-bold text-slate-900" : "font-medium text-slate-700"
                              )}
                            >
                              {node.name}
                            </span>
                            {hasChildren && (
                              <span className="text-[9px] font-semibold text-slate-500 bg-slate-100 px-1.5 py-0.2 rounded border border-slate-200 shrink-0">
                                {node.children.length} sub
                              </span>
                            )}
                          </div>
                        </div>
                      </TableCell>

                      {/* Slug */}
                      <TableCell className="py-2.5 px-3.5 truncate">
                        <span className="text-[11px] font-mono text-slate-600 bg-slate-50 px-1.5 py-0.5 rounded border border-slate-200/60 truncate inline-block max-w-full">
                          {node.slug}
                        </span>
                      </TableCell>

                      {/* Order */}
                      <TableCell className="py-2.5 px-3.5 text-center font-semibold text-xs text-slate-700">
                        {node.display_order}
                      </TableCell>

                      {/* Status Toggle */}
                      <TableCell className="py-2.5 px-3.5 text-center whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => handleToggleActive(node)}
                          className={cn(
                            "inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium cursor-pointer transition-colors border",
                            node.is_active
                              ? "bg-emerald-50 text-emerald-700 border-emerald-200/60 hover:bg-emerald-100"
                              : "bg-slate-100 text-slate-500 border-slate-200 hover:bg-slate-200/60"
                          )}
                        >
                          <span
                            className={cn(
                              "h-1.5 w-1.5 rounded-full",
                              node.is_active ? "bg-emerald-500" : "bg-slate-400"
                            )}
                          />
                          {node.is_active ? "Active" : "Inactive"}
                        </button>
                      </TableCell>

                      {/* Actions */}
                      <TableCell className="py-2.5 px-3.5 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1">
                          {/* Add Subcategory Preset */}
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            title={`Add Subcategory under ${node.name}`}
                            onClick={() => handleAddSubcategoryPreset(node)}
                            className="h-7 w-7 text-slate-600 hover:bg-slate-100 hover:text-slate-900 cursor-pointer rounded-md p-1"
                          >
                            <Plus className="h-3.5 w-3.5" />
                          </Button>

                          {/* Edit */}
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            title="Edit Category"
                            onClick={() => handleStartEdit(node)}
                            className="h-7 w-7 text-slate-600 hover:bg-slate-100 hover:text-slate-900 cursor-pointer rounded-md p-1"
                          >
                            <Edit2 className="h-3.5 w-3.5" />
                          </Button>

                          {/* Delete (Strict check: Prevents deletion if subcategories exist) */}
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            title="Delete Category"
                            onClick={() => {
                              setDeleteError(null);
                              setDeleteConfirmCategory(node);
                            }}
                            className="h-7 w-7 text-slate-500 hover:bg-rose-50 hover:text-rose-600 cursor-pointer rounded-md p-1"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </Card>
      </div>

      {/* SHADCN CONFIRMATION ALERT DIALOG FOR CATEGORY DELETION */}
      <AlertDialog
        open={Boolean(deleteConfirmCategory)}
        onOpenChange={(open) => {
          if (!open) {
            setDeleteConfirmCategory(null);
            setDeleteError(null);
          }
        }}
      >
        <AlertDialogContent className="max-w-md bg-white border border-slate-200 shadow-2xl rounded-2xl p-6">
          <AlertDialogHeader>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-rose-50 text-rose-600 border border-rose-200">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div>
                <AlertDialogTitle className="text-base font-bold text-slate-900">
                  Delete Category?
                </AlertDialogTitle>
                <p className="text-xs text-slate-500 mt-0.5">
                  {deleteConfirmCategory?.name} ({deleteConfirmCategory?.slug})
                </p>
              </div>
            </div>

            {deleteError ? (
              <div className="mt-3 flex items-start gap-2.5 rounded-lg border border-rose-500/20 bg-rose-50 p-3 text-xs text-rose-800">
                <AlertCircle className="h-4 w-4 shrink-0 text-rose-600 mt-0.5" />
                <p>{deleteError}</p>
              </div>
            ) : (
              <AlertDialogDescription className="text-xs text-slate-600 pt-2 leading-relaxed">
                Are you sure you want to delete category{" "}
                <strong className="text-slate-900 font-semibold">
                  "{deleteConfirmCategory?.name}"
                </strong>
                ? If subcategories exist under this category, deletion will be prevented until child categories are removed or re-assigned.
              </AlertDialogDescription>
            )}
          </AlertDialogHeader>

          <AlertDialogFooter className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100">
            <AlertDialogCancel className="h-8 text-xs border-slate-200 text-slate-700 hover:bg-slate-50">
              {deleteError ? "Close" : "Cancel"}
            </AlertDialogCancel>
            {!deleteError && (
              <AlertDialogAction
                onClick={handleConfirmDelete}
                disabled={isPending}
                className="h-8 text-xs font-medium bg-rose-600 hover:bg-rose-700 text-white shadow-none"
              >
                {isPending ? "Deleting..." : "Yes, Delete Category"}
              </AlertDialogAction>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
