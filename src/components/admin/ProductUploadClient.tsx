"use client";

import { useState, useRef, useTransition, useEffect } from "react";
import { CategoryNode, Tag } from "@/types/database.types";
import { CsvDataPreviewTable } from "./CsvDataPreviewTable";
import { CategoryCheckboxTree } from "@/components/common/CategoryCheckboxTree";
import { createFullProduct, uploadProductImage } from "@/actions/product";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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
  Download,
  History,
  FileSpreadsheet,
  CheckCircle2,
  Edit3,
  Sparkles,
  ChevronRight,
  Eye,
  ArrowRight,
  Upload,
  FolderTree,
  Tag as TagIcon,
  Plus,
  Trash2,
  Image as ImageIcon,
  Loader2,
  AlertCircle,
  Check,
  X,
  ExternalLink,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

interface ProductUploadClientProps {
  treeNodes: CategoryNode[];
  availableTags: Tag[];
  onSuccessComplete?: () => void;
  hideHeader?: boolean;
}

interface ImageItem {
  url: string;
  title: string;
}

export interface ParsedCsvData {
  fileName: string;
  fileSize: string;
  headers: string[];
  rows: Record<string, any>[];
}

export interface TagUploadState {
  tagId: string;
  tagName: string;
  shortDescription: string;
  file: File | null;
  csvData: ParsedCsvData | null;
  columnMapping: Record<string, string>;
  selectedRowIndices: number[];
}

const SYSTEM_MAPPABLE_FIELDS = [
  { key: "sku", label: "SKU Code (CODE) *", dataType: "Text" },
  { key: "diameter", label: "Diameter (D)", dataType: "Decimal" },
  { key: "fluteLength", label: "Flute Length (H)", dataType: "Decimal" },
  { key: "overallLength", label: "Overall Length (L)", dataType: "Decimal" },
  { key: "shankDia", label: "Shank Dia (D2)", dataType: "Decimal" },
  { key: "listPrice", label: "List Price (Excl. GST)", dataType: "Decimal" },
  { key: "stockQuantity", label: "Stock Quantity", dataType: "Integer" },
];

export function ProductUploadClient({
  treeNodes,
  availableTags,
  onSuccessComplete,
  hideHeader = false,
}: ProductUploadClientProps) {
  const router = useRouter();
  const [activeStep, setActiveStep] = useState<number>(1);
  const [isPending, startTransition] = useTransition();

  // STEP 1 STATE: Product Family & Media
  const [title, setTitle] = useState("");
  const [fullDescription, setFullDescription] = useState("");

  const [images, setImages] = useState<ImageItem[]>([]);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const imageFileInputRef = useRef<HTMLInputElement>(null);

  // Category Checkbox Selection
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>([]);

  // STEP 2 STATE: CSV Upload & Column Mapping per Tag
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [tagUploads, setTagUploads] = useState<Record<string, TagUploadState>>({});

  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null);

  // Handle Multi-Image Upload (Upload multiple image files at once)
  const handleImageFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsUploadingImage(true);
    const newUploadedImages: ImageItem[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const formData = new FormData();
      formData.append("file", file);

      const res = await uploadProductImage(formData);
      if (res.publicUrl) {
        newUploadedImages.push({
          url: res.publicUrl,
          title: file.name.replace(/\.[^/.]+$/, "").replace(/[-_]+/g, " "),
        });
      }
    }

    setIsUploadingImage(false);

    if (newUploadedImages.length > 0) {
      setImages((prev) => [...prev, ...newUploadedImages]);
    }

    if (imageFileInputRef.current) {
      imageFileInputRef.current.value = "";
    }
  };

  const handleUpdateImageTitle = (index: number, newTitle: string) => {
    setImages((prev) =>
      prev.map((img, i) => (i === index ? { ...img, title: newTitle } : img))
    );
  };

  const handleRemoveImage = (index: number) => {
    setImages((prev) => prev.filter((_, i) => i !== index));
  };

  // Robust CSV parser supporting quotes, comma/semicolon/tab delimiters
  const parseCsvContent = (text: string) => {
    const lines = text.split(/\r\n|\n/).filter((l) => l.trim() !== "");
    if (lines.length === 0) return null;

    // Detect delimiter
    const firstLine = lines[0];
    let delimiter = ",";
    if (firstLine.includes("\t")) delimiter = "\t";
    else if (firstLine.includes(";") && !firstLine.includes(",")) delimiter = ";";

    const parseLine = (line: string): string[] => {
      const tokens: string[] = [];
      let currentToken = "";
      let insideQuotes = false;

      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
          if (insideQuotes && line[i + 1] === '"') {
            currentToken += '"';
            i++;
          } else {
            insideQuotes = !insideQuotes;
          }
        } else if (char === delimiter && !insideQuotes) {
          tokens.push(currentToken.trim());
          currentToken = "";
        } else {
          currentToken += char;
        }
      }
      tokens.push(currentToken.trim());
      return tokens;
    };

    const rawHeaders = parseLine(lines[0]).filter((h) => h !== "");
    if (rawHeaders.length === 0) return null;

    const parsedRows: Record<string, any>[] = [];
    for (let i = 1; i < lines.length; i++) {
      const values = parseLine(lines[i]);
      if (values.length === 0 || (values.length === 1 && !values[0])) continue;
      const rowObj: Record<string, any> = {};
      rawHeaders.forEach((h, idx) => {
        rowObj[h] = values[idx] !== undefined ? values[idx] : "";
      });
      parsedRows.push(rowObj);
    }

    return { headers: rawHeaders, rows: parsedRows };
  };

  const handleTagCsvFileSelected = (tagId: string, file: File) => {
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const text = evt.target?.result as string;
      if (!text) return;

      const parsed = parseCsvContent(text);
      if (!parsed || parsed.headers.length === 0) {
        setSubmitError(`Failed to parse CSV file.`);
        return;
      }
      setSubmitError(null);

      const initialMap: Record<string, string> = {};
      parsed.headers.forEach((h) => {
        const lower = h.toLowerCase().trim();
        if (lower.includes("code") || lower.includes("sku")) initialMap[h] = "sku";
        else if (lower === "d" || lower === "dia" || lower.includes("diameter")) initialMap[h] = "diameter";
        else if (lower === "h" || lower.includes("flute")) initialMap[h] = "fluteLength";
        else if (lower === "l" || lower.includes("overall")) initialMap[h] = "overallLength";
        else if (lower === "d2" || lower.includes("shank")) initialMap[h] = "shankDia";
        else if (lower.includes("price")) initialMap[h] = "listPrice";
        else if (lower.includes("stock") || lower.includes("qty")) initialMap[h] = "stockQuantity";
        else initialMap[h] = h; // Custom attribute
      });

      setTagUploads((prev) => ({
        ...prev,
        [tagId]: {
          ...prev[tagId],
          file,
          csvData: {
            fileName: file.name,
            fileSize: `${(file.size / 1024).toFixed(1)} KB`,
            headers: parsed.headers,
            rows: parsed.rows,
          },
          columnMapping: initialMap,
          selectedRowIndices: parsed.rows.map((_, idx) => idx),
        },
      }));
    };

    reader.readAsText(file);
  };

  const handleUpdateCsvCell = (tagId: string, rowIdx: number, header: string, newValue: string) => {
    setTagUploads((prev) => {
      const upload = prev[tagId];
      if (!upload || !upload.csvData) return prev;
      
      const newRows = [...upload.csvData.rows];
      newRows[rowIdx] = { ...newRows[rowIdx], [header]: newValue };
      
      return {
        ...prev,
        [tagId]: {
          ...upload,
          csvData: { ...upload.csvData, rows: newRows }
        }
      };
    });
  };

  const handleToggleRow = (tagId: string, rowIdx: number) => {
    setTagUploads((prev) => {
      const upload = prev[tagId];
      if (!upload) return prev;
      const currentIndices = upload.selectedRowIndices;
      const newIndices = currentIndices.includes(rowIdx)
        ? currentIndices.filter(i => i !== rowIdx)
        : [...currentIndices, rowIdx];
      return { ...prev, [tagId]: { ...upload, selectedRowIndices: newIndices } };
    });
  };

  const handleToggleAllRows = (tagId: string, selectAll: boolean) => {
    setTagUploads((prev) => {
      const upload = prev[tagId];
      if (!upload || !upload.csvData) return prev;
      return { 
        ...prev, 
        [tagId]: { 
          ...upload, 
          selectedRowIndices: selectAll ? upload.csvData.rows.map((_, i) => i) : [] 
        } 
      };
    });
  };

  const handleToggleTag = (tagId: string) => {
    const isSelected = selectedTagIds.includes(tagId);
    if (isSelected) {
      setSelectedTagIds((prev) => prev.filter((id) => id !== tagId));
      setTagUploads((prev) => {
        const next = { ...prev };
        delete next[tagId];
        return next;
      });
    } else {
      setSelectedTagIds((prev) => [...prev, tagId]);
      const tag = availableTags.find((t) => t.id === tagId);
      if (tag) {
        setTagUploads((prev) => ({
          ...prev,
          [tagId]: {
            tagId: tag.id,
            tagName: tag.name,
            shortDescription: "",
            file: null,
            csvData: null,
            columnMapping: {},
            selectedRowIndices: [],
          },
        }));
      }
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!title) {
      setSubmitError("Product title is required.");
      return;
    }

    if (selectedTagIds.length === 0) {
      setSubmitError("Please select at least one tag to upload variants for.");
      return;
    }

    const uploads = Object.values(tagUploads);
    if (uploads.some(u => !u.csvData || u.csvData.rows.length === 0)) {
      setSubmitError("Please ensure all selected tags have a CSV file uploaded.");
      return;
    }

    const variantsToInsert: any[] = [];

    uploads.forEach((upload) => {
      if (!upload.csvData) return;
      const csvRows = upload.csvData.rows;
      
      csvRows.forEach((row, rowIdx) => {
        if (!upload.selectedRowIndices.includes(rowIdx)) return; // Skip excluded rows

        let sku = "";
        let diameter: number | null = null;
        let flute_length: number | null = null;
        let overall_length: number | null = null;
        let shank_diameter: number | null = null;
        let list_price: number = 0;
        let stock_quantity: number = 0;
        const specifications: Record<string, any> = { Tag: upload.tagName, ShortDescription: upload.shortDescription };

        Object.entries(upload.columnMapping).forEach(([header, sysField]) => {
          const val = row[header];
          if (sysField === "sku") sku = String(val || "").trim();
          else if (sysField === "diameter") diameter = Number(val) || null;
          else if (sysField === "fluteLength") flute_length = Number(val) || null;
          else if (sysField === "overallLength") overall_length = Number(val) || null;
          else if (sysField === "shankDia") shank_diameter = Number(val) || null;
          else if (sysField === "listPrice") list_price = val ? parseFloat(val.toString().replace(/[^0-9.]/g, "")) || 0 : 0;
          else if (sysField === "stockQuantity") stock_quantity = val ? parseInt(val.toString().replace(/[^0-9]/g, ""), 10) || 0 : 0;
          else specifications[sysField || header] = val;
        });

        variantsToInsert.push({
          sku: sku || `SKU-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          diameter,
          flute_length,
          overall_length,
          shank_diameter,
          list_price,
          stock_quantity,
          specifications,
        });
      });
    });

    startTransition(async () => {
      const res = await createFullProduct({
        title,
        description: fullDescription,
        images,
        categoryIds: selectedCategoryIds,
        tagIds: selectedTagIds,
        variants: variantsToInsert,
      });

      if (res.error) {
        setSubmitError(res.error);
      } else {
        setSubmitSuccess("Product Family and SKU variant matrix created successfully!");
        setTimeout(() => {
          if (onSuccessComplete) {
            onSuccessComplete();
          } else {
            router.push("/admin/products");
          }
        }, 800);
      }
    });
  };

  return (
    <div className="space-y-6 w-full max-w-full">
      {/* Header with Title and Actions */}
      {!hideHeader && (
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 pb-5">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Product Upload Wizard
            </h1>
            <p className="text-xs text-slate-500 mt-1">
              Define Product Family metadata, multi-image titles, category hierarchy, and bulk import SKU variant matrix.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Button variant="outline" size="sm" className="gap-1.5 text-xs border-slate-200 text-slate-700">
              <Download className="h-4 w-4 text-slate-500" />
              <span>Download CSV Template</span>
            </Button>
            <Link href="/admin/products">
              <Button variant="outline" size="sm" className="gap-1.5 text-xs border-slate-200 text-slate-700">
                <History className="h-4 w-4 text-slate-500" />
                <span>Products List</span>
              </Button>
            </Link>
          </div>
        </div>
      )}

      {/* 2-Step Process Stepper */}
      <div className="bg-white rounded-xl border border-slate-300 p-3 shadow-sm">
        <div className="flex items-center justify-between max-w-xl mx-auto">
          {/* Step 1 Toggle */}
          <button
            type="button"
            onClick={() => setActiveStep(1)}
            className="flex items-center gap-2.5 text-left cursor-pointer"
          >
            <div
              className={cn(
                "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-bold transition-all",
                activeStep === 1
                  ? "bg-[#024AE5] text-white shadow-xs ring-4 ring-[#024AE5]/15"
                  : "bg-slate-100 text-slate-700"
              )}
            >
              1
            </div>
            <div>
              <div className={cn("text-[11px] font-bold", activeStep === 1 ? "text-slate-900" : "text-slate-500")}>
                Product Family & Media
              </div>
              <div className="text-[10px] text-slate-400">Title, Descriptions, Images & Categories</div>
            </div>
          </button>

          <div className="flex-1 h-[1px] bg-slate-200 mx-6" />

          {/* Step 2 Toggle */}
          <button
            type="button"
            onClick={() => setActiveStep(2)}
            className="flex items-center gap-2.5 text-left cursor-pointer"
          >
            <div
              className={cn(
                "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-bold transition-all",
                activeStep === 2
                  ? "bg-[#024AE5] text-white shadow-xs ring-4 ring-[#024AE5]/15"
                  : "bg-slate-100 text-slate-700"
              )}
            >
              2
            </div>
            <div>
              <div className={cn("text-[11px] font-bold", activeStep === 2 ? "text-slate-900" : "text-slate-500")}>
                CSV SKU Upload & Tags
              </div>
              <div className="text-[10px] text-slate-400">Hardness Tags, Column Mapping & Stock</div>
            </div>
          </button>
        </div>
      </div>

      {submitError && (
        <div className="flex items-start gap-2 rounded-xl border border-rose-500/20 bg-rose-50 p-3 text-xs text-rose-800">
          <AlertCircle className="h-4 w-4 shrink-0 text-rose-600 mt-0.5" />
          <p className="font-medium">{submitError}</p>
        </div>
      )}
      {submitSuccess && (
        <div className="flex items-start gap-2 rounded-xl border border-emerald-500/20 bg-emerald-50 p-3 text-xs text-emerald-800">
          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 mt-0.5" />
          <p className="font-semibold">{submitSuccess}</p>
        </div>
      )}

      {/* STEP 1 CONTENT: Product Metadata, Multi-Images with Individual Titles, Category Tree */}
      {activeStep === 1 && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Left Column: Title, Descriptions, Multi-Images (7 cols) */}
            <div className="lg:col-span-7 space-y-5">
              <Card className="border border-slate-300 bg-white shadow-sm overflow-hidden rounded-xl">
                <CardHeader className="pb-3 border-b border-slate-100">
                  <CardTitle className="text-xs font-bold text-slate-900">
                    Product Family Details
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4 space-y-4">
                  {/* Title */}
                  <div className="space-y-1">
                    <Label className="text-xs font-medium text-slate-700">
                      Product Title <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="e.g. 4-Flute Standard End Mill"
                      required
                      className="h-9 text-xs border-slate-200 font-semibold"
                    />
                  </div>

                  {/* Full Description */}
                  <div className="space-y-1">
                    <Label className="text-xs font-medium text-slate-700">
                      Description <span className="text-red-500">*</span>
                    </Label>
                    <textarea
                      value={fullDescription}
                      onChange={(e) => setFullDescription(e.target.value)}
                      rows={4}
                      required
                      placeholder="Detailed tooling application specs, coating features, geometry notes..."
                      className="w-full rounded-md border border-slate-200 bg-white p-2.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#024AE5]/20"
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Multi-Image Upload (Every Image has an Individual Title) */}
              <Card className="border border-slate-300 bg-white shadow-sm overflow-hidden rounded-xl">
                <CardHeader className="pb-3 border-b border-slate-100 flex items-center justify-between">
                  <CardTitle className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                    <ImageIcon className="h-4 w-4 text-[#024AE5]" />
                    Product Images & Captions
                  </CardTitle>
                  <span className="text-[10px] text-slate-400 font-normal">
                    {images.length} Image(s) Attached
                  </span>
                </CardHeader>
                <CardContent className="p-4 space-y-4">
                  <input
                    type="file"
                    ref={imageFileInputRef}
                    accept="image/*"
                    multiple
                    onChange={handleImageFileUpload}
                    className="hidden"
                  />

                  {/* Image Items List */}
                  <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
                    {images.map((img, index) => (
                      <div
                        key={index}
                        className="flex items-center gap-3 p-2.5 bg-slate-50/80 border border-slate-200 rounded-xl"
                      >
                        <div className="h-14 w-14 rounded-lg border border-slate-200 overflow-hidden shrink-0 bg-white shadow-2xs">
                          <img
                            src={img.url}
                            alt={img.title}
                            className="h-full w-full object-cover"
                            onError={(e) => {
                              (e.target as HTMLElement).style.display = "none";
                            }}
                          />
                        </div>
                        <div className="flex-1 space-y-1 min-w-0">
                          <Label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                            Image Title / Alt Text #{index + 1}
                          </Label>
                          <Input
                            value={img.title}
                            onChange={(e) => handleUpdateImageTitle(index, e.target.value)}
                            placeholder="e.g. Front View, Corner Radius Detail..."
                            className="h-7 text-xs border-slate-200 bg-white"
                          />
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => handleRemoveImage(index)}
                          className="h-7 w-7 text-rose-500 hover:bg-rose-50 rounded shrink-0"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    ))}
                  </div>

                  {/* Add Image Dropzone */}
                  <div
                    onClick={() => imageFileInputRef.current?.click()}
                    className="border-2 border-dashed border-slate-200 rounded-xl p-4 flex flex-col items-center justify-center text-center bg-slate-50/40 hover:bg-slate-50 transition-colors cursor-pointer"
                  >
                    {isUploadingImage ? (
                      <div className="flex items-center gap-2 py-1 text-xs text-slate-600 font-medium">
                        <Loader2 className="h-4 w-4 animate-spin text-[#024AE5]" />
                        <span>Uploading image to storage...</span>
                      </div>
                    ) : (
                      <>
                        <Upload className="h-5 w-5 text-slate-400 mb-1" />
                        <p className="text-xs font-medium text-slate-700">
                          + Upload Additional Product Image
                        </p>
                        <p className="text-[10px] text-slate-400 mt-0.5">PNG, JPG, WebP up to 5MB</p>
                      </>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Right Column: Category Selection Checkbox Tree (5 cols) */}
            <div className="lg:col-span-5 space-y-5">
              <Card className="border border-slate-300 bg-white shadow-sm overflow-hidden rounded-xl h-full">
                <CardHeader className="pb-3 border-b border-slate-100 flex items-center justify-between">
                  <CardTitle className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                    <FolderTree className="h-4 w-4 text-[#024AE5]" />
                    Assign Product Categories
                  </CardTitle>
                  <Link href="/admin/categories" className="text-[10px] text-[#024AE5] hover:underline">
                    Manage Taxonomies →
                  </Link>
                </CardHeader>
                <CardContent className="p-3">
                  <CategoryCheckboxTree
                    treeNodes={treeNodes}
                    selectedIds={selectedCategoryIds}
                    onChange={(newIds) => setSelectedCategoryIds(newIds)}
                    className="border-0 p-0"
                  />
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Next Step Action */}
          <div className="flex items-center justify-end pt-2">
            <Button
              type="button"
              size="sm"
              onClick={() => setActiveStep(2)}
              disabled={!title}
              className="h-9 px-6 text-xs bg-[#024AE5] text-white hover:bg-[#023ecc] gap-1.5 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <span>Continue to CSV Upload & Tags</span>
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* STEP 2 CONTENT: Tags Selection & Multiple CSV Uploads */}
      {activeStep === 2 && (
        <div className="space-y-6">
          {/* TAGS SELECTOR */}
          <Card className="border border-slate-300 bg-white shadow-sm overflow-hidden rounded-xl">
            <CardHeader className="pb-3 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                  <TagIcon className="h-4 w-4 text-[#024AE5]" />
                  Select Tags for CSV Uploads
                </CardTitle>
                <p className="text-xs text-slate-500 mt-1">
                  Select tags below to create individual CSV upload blocks for each tag.
                </p>
              </div>
              <div className="flex gap-2">
                <Link href="/admin/tags" target="_blank">
                  <Button type="button" variant="outline" size="sm" className="h-8 text-xs border-slate-200">
                    <Plus className="h-3.5 w-3.5 mr-1" /> Add New Tag
                  </Button>
                </Link>
              </div>
            </CardHeader>
            <CardContent className="p-4">
              <div className="flex flex-wrap gap-2">
                {availableTags.map((tag) => {
                  const isSelected = selectedTagIds.includes(tag.id);
                  return (
                    <button
                      key={tag.id}
                      type="button"
                      onClick={() => handleToggleTag(tag.id)}
                      className={cn(
                        "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium cursor-pointer transition-colors border",
                        isSelected
                          ? "bg-[#024AE5] text-white border-[#024AE5] shadow-xs"
                          : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
                      )}
                    >
                      {isSelected && <Check className="h-3.5 w-3.5" />}
                      <span>{tag.name}</span>
                    </button>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* UPLOAD BLOCKS FOR EACH SELECTED TAG */}
          {selectedTagIds.map((tagId) => {
            const upload = tagUploads[tagId];
            if (!upload) return null;

            return (
              <Card key={tagId} className="border border-slate-300 bg-white shadow-sm overflow-hidden rounded-xl">
                <CardHeader className="bg-slate-50/50 pb-3 border-b border-slate-200">
                  <CardTitle className="text-sm font-bold text-slate-900 flex items-center justify-between">
                    <span>Tag Batch: <span className="text-[#024AE5] ml-1">{upload.tagName}</span></span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4 space-y-5">
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
                    {/* Short Description */}
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold text-slate-700">
                        Short Description (For {upload.tagName})
                      </Label>
                      <textarea
                        value={upload.shortDescription}
                        onChange={(e) => setTagUploads(prev => ({ ...prev, [tagId]: { ...prev[tagId], shortDescription: e.target.value } }))}
                        placeholder={`e.g. High precision ${upload.tagName} micro diameter end mill...`}
                        className="flex w-full rounded-md border border-slate-200 bg-transparent px-3 py-2 text-xs shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 h-24 resize-none"
                      />
                    </div>

                    {/* CSV Dropzone */}
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold text-slate-700">Upload CSV / Excel File <span className="text-red-500">*</span></Label>
                      <input
                        type="file"
                        id={`csvFile-${tagId}`}
                        accept=".csv,.xlsx,.xls"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handleTagCsvFileSelected(tagId, file);
                        }}
                        className="hidden"
                      />
                      <div
                        onClick={() => document.getElementById(`csvFile-${tagId}`)?.click()}
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={(e) => {
                          e.preventDefault();
                          const file = e.dataTransfer.files?.[0];
                          if (file) handleTagCsvFileSelected(tagId, file);
                        }}
                        className="h-24 border-2 border-dashed border-slate-200 rounded-xl p-4 flex flex-col items-center justify-center text-center bg-slate-50/50 hover:bg-slate-50 transition-colors cursor-pointer"
                      >
                        {upload.csvData ? (
                          <div className="flex items-center gap-2 text-xs text-slate-700 font-medium">
                            <CheckCircle2 className="h-4 w-4 text-[#3C8B4F] shrink-0" />
                            <span>{upload.csvData.fileName}</span>
                            <span className="text-[10px] text-slate-400">({upload.csvData.fileSize})</span>
                          </div>
                        ) : (
                          <>
                            <FileSpreadsheet className="h-6 w-6 text-[#3C8B4F] mb-1" />
                            <p className="text-[11px] font-medium text-slate-700">Click or Drag & Drop CSV</p>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Column Mapping for this CSV */}
                  {upload.csvData && (
                    <div className="border border-slate-200 rounded-xl overflow-hidden mt-4">
                      <div className="bg-slate-50/80 px-4 py-2 border-b border-slate-200 flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-700">Column Mapping ({upload.csvData.headers.filter(h => h.trim()).length} Columns)</span>
                      </div>
                      <div className="p-4">
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 text-xs overflow-x-auto min-w-full">
                          {upload.csvData.headers.filter(h => h.trim()).map((header, hIdx) => {
                            const isSystemField = SYSTEM_MAPPABLE_FIELDS.some(f => f.key === header);
                            const mappedKey = upload.columnMapping[header] || header;

                            return (
                              <div key={hIdx} className="space-y-1 bg-white p-2.5 rounded-lg border border-slate-200 shadow-xs">
                                <div className="text-[10px] text-slate-400 font-bold uppercase truncate">{header}</div>
                                <Select
                                  value={mappedKey}
                                  onValueChange={(val) =>
                                    setTagUploads(prev => ({
                                      ...prev,
                                      [tagId]: {
                                        ...prev[tagId],
                                        columnMapping: { ...prev[tagId].columnMapping, [header]: val }
                                      }
                                    }))
                                  }
                                >
                                  <SelectTrigger className="h-7 text-[11px] border-slate-200">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent className="max-h-56">
                                    <SelectItem value="ignore" className="text-[11px] text-slate-400 italic">-- Ignore --</SelectItem>
                                    {SYSTEM_MAPPABLE_FIELDS.map((f) => (
                                      <SelectItem key={f.key} value={f.key} className="text-[11px] font-medium">{f.label}</SelectItem>
                                    ))}
                                    {!isSystemField && (
                                      <SelectItem key={`dyn-${header}`} value={header} className="text-[11px] font-semibold text-slate-600">+ Dynamic: {header}</SelectItem>
                                    )}
                                  </SelectContent>
                                </Select>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                      
                      {/* Interactive Csv Data Preview Table */}
                      <CsvDataPreviewTable
                        csvData={upload.csvData}
                        columnMapping={upload.columnMapping}
                        selectedRowIndices={upload.selectedRowIndices}
                        onUpdateCell={(rowIdx, header, val) => handleUpdateCsvCell(tagId, rowIdx, header, val)}
                        onToggleRow={(rowIdx) => handleToggleRow(tagId, rowIdx)}
                        onToggleAllRows={(selectAll) => handleToggleAllRows(tagId, selectAll)}
                      />
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}

          {/* Bottom Actions */}
          <div className="flex items-center justify-between pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setActiveStep(1)}
              className="text-xs px-5 border-slate-200"
            >
              ← Back to Step 1
            </Button>

            <Button
              type="button"
              size="sm"
              disabled={isPending}
              onClick={handleSubmit}
              className="text-xs px-6 gap-1.5 bg-[#024AE5] text-white hover:bg-[#023ecc] font-medium"
            >
              {isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Importing Product Batch...</span>
                </>
              ) : (
                <>
                  <span>Complete Product Import</span>
                  <CheckCircle2 className="h-4 w-4" />
                </>
              )}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
