"use client";

import { useState, useRef, useTransition, useEffect } from "react";
import { CategoryNode, Attribute, Tag, Product, ProductImage, ProductDocument } from "@/types/database.types";
import { CsvDataPreviewTable } from "./CsvDataPreviewTable";
import { CategoryCheckboxTree } from "@/components/common/CategoryCheckboxTree";
import { createFullProduct, uploadProductImage, uploadProductDocument } from "@/actions/product";
import { updateFullProduct } from "@/actions/product-management";
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
  Download,
  History,
  CheckCircle2,
  Sparkles,
  ArrowRight,
  Upload,
  FolderTree,
  Plus,
  Trash2,
  Image as ImageIcon,
  Loader2,
  AlertCircle,
  Check,
  FileText,
  FileSpreadsheet,
  ExternalLink,
  Layers,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import toast from "react-hot-toast";

interface ProductUploadClientProps {
  treeNodes: CategoryNode[];
  availableAttributes?: Attribute[];
  availableTags?: Tag[];
  onSuccessComplete?: () => void;
  hideHeader?: boolean;
  initialProduct?: Product;
  mode?: "create" | "edit";
}

interface ImageItem {
  url: string;
  file?: File;
  title: string;
  attribute_id?: string | null;
  attribute_name?: string | null;
  is_primary?: boolean;
}

interface DocumentItem extends ProductDocument {
  file?: File;
}

export interface ParsedCsvData {
  fileName: string;
  fileSize: string;
  headers: string[];
  rows: Record<string, any>[];
}

export interface AttributeUploadState {
  attributeId: string;
  attributeName: string;
  shortDescription: string;
  file: File | null;
  csvData: ParsedCsvData | null;
  columnMapping: Record<string, string>;
  selectedRowIndices: number[];
}

export type TagUploadState = AttributeUploadState;

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
  availableAttributes,
  availableTags,
  onSuccessComplete,
  hideHeader = false,
  initialProduct,
  mode: propMode,
}: ProductUploadClientProps) {
  const mode = propMode || (initialProduct ? "edit" : "create");
  const activeAttributes = availableAttributes || availableTags || [];
  const router = useRouter();
  const [activeStep, setActiveStep] = useState<number>(1);
  const [isPending, startTransition] = useTransition();

  // STEP 1 STATE: Product Family & Media
  const [title, setTitle] = useState(initialProduct?.title || "");
  const [fullDescription, setFullDescription] = useState(initialProduct?.description || "");
  const [allShortDescription, setAllShortDescription] = useState("");

  const [images, setImages] = useState<ImageItem[]>([]);
  const imageFileInputRef = useRef<HTMLInputElement>(null);

  // Technical Documents (PDF / Excel)
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const documentFileInputRef = useRef<HTMLInputElement>(null);

  const [isSavingWithUpload, setIsSavingWithUpload] = useState(false);
  const [uploadProgressText, setUploadProgressText] = useState("");

  // Category Checkbox Selection
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>([]);

  // STEP 2 STATE: CSV Upload & Column Mapping per Attribute
  const [selectedAttributeIds, setSelectedAttributeIds] = useState<string[]>([]);
  const [attributeUploads, setAttributeUploads] = useState<Record<string, AttributeUploadState>>({});

  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null);

  // Pre-fill state if in edit mode
  useEffect(() => {
    if (initialProduct) {
      setTitle(initialProduct.title || "");
      setFullDescription(initialProduct.description || "");

      // Parse short_description
      let parsedAll = "";
      const attrShortMap: Record<string, string> = {};
      if (initialProduct.short_description) {
        try {
          if (initialProduct.short_description.trim().startsWith("{")) {
            const parsed = JSON.parse(initialProduct.short_description);
            parsedAll = parsed["all"] || parsed["global"] || "";
            Object.entries(parsed).forEach(([k, v]) => {
              if (k !== "all" && k !== "global" && typeof v === "string") {
                attrShortMap[k] = v;
              }
            });
          } else {
            parsedAll = initialProduct.short_description;
          }
        } catch {
          parsedAll = initialProduct.short_description;
        }
      }
      setAllShortDescription(parsedAll);

      // Images
      if (initialProduct.images && initialProduct.images.length > 0) {
        setImages(
          initialProduct.images.map((img) => ({
            url: img.url,
            title: img.title || "",
            attribute_id: img.attribute_id || null,
            attribute_name: img.attribute_name || null,
            is_primary: img.is_primary || false,
          }))
        );
      }

      // Documents
      if (initialProduct.documents && initialProduct.documents.length > 0) {
        setDocuments(initialProduct.documents);
      }

      // Categories
      if (initialProduct.categories && initialProduct.categories.length > 0) {
        setSelectedCategoryIds(initialProduct.categories.map((c) => c.id));
      }

      // Attributes
      const prodAttrs = initialProduct.attributes || initialProduct.tags || [];
      if (prodAttrs.length > 0) {
        const attrIds = prodAttrs.map((a) => a.id);
        setSelectedAttributeIds(attrIds);

        const uploads: Record<string, AttributeUploadState> = {};
        prodAttrs.forEach((attr) => {
          uploads[attr.id] = {
            attributeId: attr.id,
            attributeName: attr.name,
            shortDescription: attrShortMap[attr.id] || attrShortMap[attr.name] || "",
            file: null,
            csvData: null,
            columnMapping: {},
            selectedRowIndices: [],
          };
        });
        setAttributeUploads(uploads);
      }
    }
  }, [initialProduct]);

  // Handle Multi-Image Upload (Client-side preview only, uploaded on submit)
  const handleImageFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const newImages: ImageItem[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const previewUrl = URL.createObjectURL(file);
      newImages.push({
        url: previewUrl,
        file: file,
        title: file.name.replace(/\.[^/.]+$/, "").replace(/[-_]+/g, " "),
        attribute_id: null,
        attribute_name: null,
        is_primary: images.length === 0 && newImages.length === 0,
      });
    }

    setImages((prev) => [...prev, ...newImages]);
    if (imageFileInputRef.current) {
      imageFileInputRef.current.value = "";
    }
  };

  const handleUpdateImageTitle = (index: number, newTitle: string) => {
    setImages((prev) =>
      prev.map((img, i) => (i === index ? { ...img, title: newTitle } : img))
    );
  };

  const handleRemoveImage = (targetImg: ImageItem) => {
    if (targetImg.url.startsWith("blob:")) {
      URL.revokeObjectURL(targetImg.url);
    }
    setImages((prev) => prev.filter((img) => img !== targetImg));
  };

  // Handle Technical Documents Upload (Client-side preview only, uploaded on submit)
  const handleDocumentFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const ALLOWED_DOC_EXTENSIONS = ["pdf", "xlsx", "xls", "csv", "doc", "docx"];
    const newDocs: DocumentItem[] = [];
    const rejected: string[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const rawName = file.name;
      const fileExt = rawName.split(".").pop()?.toLowerCase() || "";

      if (!ALLOWED_DOC_EXTENSIONS.includes(fileExt)) {
        rejected.push(rawName);
        continue;
      }

      const previewUrl = URL.createObjectURL(file);
      let fileType: "pdf" | "excel" | "sheet" | "doc" | "other" = "other";
      if (fileExt === "pdf") fileType = "pdf";
      else if (fileExt === "xlsx" || fileExt === "xls") fileType = "excel";
      else if (fileExt === "csv") fileType = "sheet";
      else if (fileExt === "doc" || fileExt === "docx") fileType = "doc";

      const fileSize =
        file.size >= 1024 * 1024
          ? `${(file.size / (1024 * 1024)).toFixed(1)} MB`
          : `${(file.size / 1024).toFixed(1)} KB`;

      newDocs.push({
        id: `doc-${Date.now()}-${i}-${Math.random().toString(36).substring(2, 6)}`,
        name: rawName,
        url: previewUrl,
        file: file,
        file_type: fileType,
        file_size: fileSize,
        attribute_id: null,
        attribute_name: null,
      });
    }

    if (rejected.length > 0) {
      toast.error(
        `${rejected.length} file(s) rejected — unsupported type: ${rejected.join(", ")}. Allowed: PDF, Excel (.xlsx/.xls), CSV, Word (.doc/.docx).`,
        { duration: 6000 }
      );
    }

    if (newDocs.length > 0) setDocuments((prev) => [...prev, ...newDocs]);
    if (documentFileInputRef.current) {
      documentFileInputRef.current.value = "";
    }
  };

  const handleUpdateDocumentName = (index: number, newName: string) => {
    setDocuments((prev) =>
      prev.map((doc, i) => (i === index ? { ...doc, name: newName } : doc))
    );
  };

  const handleRemoveDocument = (targetDoc: DocumentItem) => {
    if (targetDoc.url.startsWith("blob:")) {
      URL.revokeObjectURL(targetDoc.url);
    }
    setDocuments((prev) => prev.filter((doc) => doc !== targetDoc));
  };

  // Handle per-attribute image upload in Step 2 (Client-side preview only, uploaded on submit)
  const handleAttributeImageUpload = (
    attrId: string,
    attrName: string,
    files: FileList | null
  ) => {
    if (!files || files.length === 0) return;
    const newUploaded: ImageItem[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const previewUrl = URL.createObjectURL(file);
      newUploaded.push({
        url: previewUrl,
        file: file,
        title: `${attrName} - ${file.name.replace(/\.[^/.]+$/, "").replace(/[-_]+/g, " ")}`,
        attribute_id: attrId,
        attribute_name: attrName,
        is_primary: false,
      });
    }

    setImages((prev) => [...prev, ...newUploaded]);
  };

  // Handle per-attribute document upload in Step 2 (Client-side preview only, uploaded on submit)
  const handleAttributeDocumentUpload = (
    attrId: string,
    attrName: string,
    files: FileList | null
  ) => {
    if (!files || files.length === 0) return;

    const ALLOWED_DOC_EXTENSIONS = ["pdf", "xlsx", "xls", "csv", "doc", "docx"];
    const newDocs: DocumentItem[] = [];
    const rejected: string[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const rawName = file.name;
      const fileExt = rawName.split(".").pop()?.toLowerCase() || "";

      if (!ALLOWED_DOC_EXTENSIONS.includes(fileExt)) {
        rejected.push(rawName);
        continue;
      }

      const previewUrl = URL.createObjectURL(file);
      let fileType: "pdf" | "excel" | "sheet" | "doc" | "other" = "other";
      if (fileExt === "pdf") fileType = "pdf";
      else if (fileExt === "xlsx" || fileExt === "xls") fileType = "excel";
      else if (fileExt === "csv") fileType = "sheet";
      else if (fileExt === "doc" || fileExt === "docx") fileType = "doc";

      const fileSize =
        file.size >= 1024 * 1024
          ? `${(file.size / (1024 * 1024)).toFixed(1)} MB`
          : `${(file.size / 1024).toFixed(1)} KB`;

      newDocs.push({
        id: `doc-${Date.now()}-${i}-${Math.random().toString(36).substring(2, 6)}`,
        name: rawName,
        url: previewUrl,
        file: file,
        file_type: fileType,
        file_size: fileSize,
        attribute_id: attrId,
        attribute_name: attrName,
      });
    }

    if (rejected.length > 0) {
      toast.error(
        `${rejected.length} file(s) rejected — unsupported type: ${rejected.join(", ")}. Allowed: PDF, Excel (.xlsx/.xls), CSV, Word (.doc/.docx).`,
        { duration: 6000 }
      );
    }

    if (newDocs.length > 0) setDocuments((prev) => [...prev, ...newDocs]);
  };

  // Robust CSV parser supporting quotes, comma/semicolon/tab delimiters
  const parseCsvContent = (text: string) => {
    const lines = text.split(/\r\n|\n/).filter((l) => l.trim() !== "");
    if (lines.length === 0) return null;

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

  const handleAttributeCsvFileSelected = (attributeId: string, file: File) => {
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
        else initialMap[h] = h;
      });

      setAttributeUploads((prev) => ({
        ...prev,
        [attributeId]: {
          ...prev[attributeId],
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

  const handleUpdateCsvCell = (attributeId: string, rowIdx: number, header: string, newValue: string) => {
    setAttributeUploads((prev) => {
      const upload = prev[attributeId];
      if (!upload || !upload.csvData) return prev;

      const newRows = [...upload.csvData.rows];
      newRows[rowIdx] = { ...newRows[rowIdx], [header]: newValue };

      return {
        ...prev,
        [attributeId]: {
          ...upload,
          csvData: { ...upload.csvData, rows: newRows },
        },
      };
    });
  };

  const handleToggleRow = (attributeId: string, rowIdx: number) => {
    setAttributeUploads((prev) => {
      const upload = prev[attributeId];
      if (!upload) return prev;
      const currentIndices = upload.selectedRowIndices;
      const newIndices = currentIndices.includes(rowIdx)
        ? currentIndices.filter((i) => i !== rowIdx)
        : [...currentIndices, rowIdx];
      return { ...prev, [attributeId]: { ...upload, selectedRowIndices: newIndices } };
    });
  };

  const handleToggleAllRows = (attributeId: string, selectAll: boolean) => {
    setAttributeUploads((prev) => {
      const upload = prev[attributeId];
      if (!upload || !upload.csvData) return prev;
      return {
        ...prev,
        [attributeId]: {
          ...upload,
          selectedRowIndices: selectAll ? upload.csvData.rows.map((_, i) => i) : [],
        },
      };
    });
  };

  const handleToggleAttribute = (attributeId: string) => {
    const isSelected = selectedAttributeIds.includes(attributeId);
    if (isSelected) {
      setSelectedAttributeIds((prev) => prev.filter((id) => id !== attributeId));
      setAttributeUploads((prev) => {
        const next = { ...prev };
        delete next[attributeId];
        return next;
      });
    } else {
      setSelectedAttributeIds((prev) => [...prev, attributeId]);
      const attr = activeAttributes.find((t) => t.id === attributeId);
      if (attr) {
        setAttributeUploads((prev) => ({
          ...prev,
          [attributeId]: {
            attributeId: attr.id,
            attributeName: attr.name,
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!title.trim()) {
      setSubmitError("Product title is required.");
      return;
    }

    const uploads = Object.values(attributeUploads);
    const hasExistingVariants = (initialProduct?.variants?.length || 0) > 0;

    if (mode === "create" && selectedAttributeIds.length === 0) {
      setSubmitError("Please select at least one attribute to upload variants for.");
      return;
    }

    if (mode === "create" && uploads.some((u) => !u.csvData || u.csvData.rows.length === 0)) {
      setSubmitError("Please ensure all selected attributes have a CSV file uploaded.");
      return;
    }

    setSubmitError(null);
    setIsSavingWithUpload(true);
    setUploadProgressText("Processing files for upload...");

    try {
      // 1. Upload pending client-side images
      const finalImages: ProductImage[] = [];
      for (let i = 0; i < images.length; i++) {
        const img = images[i];
        if (img.file) {
          setUploadProgressText(`Uploading image ${i + 1} of ${images.length}...`);
          const formData = new FormData();
          formData.append("file", img.file);
          const res = await uploadProductImage(formData);
          if (res.error || !res.publicUrl) {
            throw new Error(`Failed to upload image "${img.title}": ${res.error || "Storage error"}`);
          }
          finalImages.push({
            url: res.publicUrl,
            title: img.title,
            attribute_id: img.attribute_id || null,
            attribute_name: img.attribute_name || null,
            is_primary: img.is_primary ?? (i === 0),
          });
        } else {
          finalImages.push({
            url: img.url,
            title: img.title,
            attribute_id: img.attribute_id || null,
            attribute_name: img.attribute_name || null,
            is_primary: img.is_primary,
          });
        }
      }

      // 2. Upload pending client-side documents
      const finalDocuments: ProductDocument[] = [];
      for (let i = 0; i < documents.length; i++) {
        const doc = documents[i];
        if (doc.file) {
          setUploadProgressText(`Uploading document ${i + 1} of ${documents.length}...`);
          const formData = new FormData();
          formData.append("file", doc.file);
          const res = await uploadProductDocument(formData);
          if (res.error || !res.publicUrl) {
            const errMsg = res.error || "Storage error — check bucket permissions.";
            toast.error(`Document upload failed: ${errMsg}`, { duration: 8000 });
            throw new Error(`Failed to upload document "${doc.name}": ${errMsg}`);
          }
          finalDocuments.push({
            id: doc.id,
            name: doc.name || res.name || doc.file.name,
            url: res.publicUrl,
            file_type: (res.fileType as any) || doc.file_type || "pdf",
            file_size: res.fileSize || doc.file_size || `${(doc.file.size / 1024).toFixed(1)} KB`,
            attribute_id: doc.attribute_id || null,
            attribute_name: doc.attribute_name || null,
          });
        } else {
          finalDocuments.push({
            id: doc.id,
            name: doc.name,
            url: doc.url,
            file_type: doc.file_type,
            file_size: doc.file_size,
            attribute_id: doc.attribute_id || null,
            attribute_name: doc.attribute_name || null,
          });
        }
      }

      setUploadProgressText("Saving product data and SKU variants...");

      const variantsToInsert: any[] = [];

      uploads.forEach((upload) => {
        if (!upload.csvData) return;
        const csvRows = upload.csvData.rows;

        csvRows.forEach((row, rowIdx) => {
          if (!upload.selectedRowIndices.includes(rowIdx)) return;

          let sku = "";
          let diameter: number | null = null;
          let flute_length: number | null = null;
          let overall_length: number | null = null;
          let shank_diameter: number | null = null;
          let list_price: number = 0;
          let stock_quantity: number = 0;
          const specifications: Record<string, any> = {
            Attribute: upload.attributeName,
            Tag: upload.attributeName,
          };

          Object.entries(upload.columnMapping).forEach(([header, sysField]) => {
            const val = row[header];
            if (sysField === "sku") sku = String(val || "").trim();
            else if (sysField === "diameter") diameter = Number(val) || null;
            else if (sysField === "fluteLength") flute_length = Number(val) || null;
            else if (sysField === "overallLength") overall_length = Number(val) || null;
            else if (sysField === "shankDia") shank_diameter = Number(val) || null;
            else if (sysField === "listPrice")
              list_price = val ? parseFloat(val.toString().replace(/[^0-9.]/g, "")) || 0 : 0;
            else if (sysField === "stockQuantity")
              stock_quantity = val ? parseInt(val.toString().replace(/[^0-9]/g, ""), 10) || 0 : 0;
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

      const shortDescMap: Record<string, string> = {
        all: allShortDescription.trim(),
        global: allShortDescription.trim(),
      };

      uploads.forEach((u) => {
        if (u.shortDescription?.trim()) {
          shortDescMap[u.attributeId] = u.shortDescription.trim();
          shortDescMap[u.attributeName] = u.shortDescription.trim();
        }
      });

      if (mode === "edit" && initialProduct) {
        const res = await updateFullProduct(initialProduct.id, {
          title: title.trim(),
          shortDescription: Object.keys(shortDescMap).length > 0 ? JSON.stringify(shortDescMap) : "",
          description: fullDescription,
          images: finalImages,
          documents: finalDocuments,
          categoryIds: selectedCategoryIds,
          attributeIds: selectedAttributeIds,
          variantsToAppend: variantsToInsert.length > 0 ? variantsToInsert : undefined,
        });

        if (res.error) {
          setSubmitError(res.error);
        } else {
          setSubmitSuccess("Product details and media updated successfully!");
          setTimeout(() => {
            if (onSuccessComplete) {
              onSuccessComplete();
            } else {
              router.push("/admin/products");
            }
          }, 800);
        }
      } else {
        const res = await createFullProduct({
          title: title.trim(),
          shortDescription: Object.keys(shortDescMap).length > 0 ? JSON.stringify(shortDescMap) : "",
          description: fullDescription,
          images: finalImages,
          documents: finalDocuments,
          categoryIds: selectedCategoryIds,
          attributeIds: selectedAttributeIds,
          tagIds: selectedAttributeIds,
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
      }
    } catch (err: any) {
      setSubmitError(err.message || "An error occurred during media upload and saving.");
    } finally {
      setIsSavingWithUpload(false);
      setUploadProgressText("");
    }
  };

  return (
    <div className="space-y-6 w-full max-w-full">
      {/* Header with Title and Actions */}
      {!hideHeader && (
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 pb-5">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              {mode === "edit" ? "Edit Product Family" : "Product Upload Wizard"}
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              {mode === "edit"
                ? "Update family metadata, overview description, per-series descriptions, datasheets, and SKU matrices."
                : "Add new product family, assign categories, upload datasheets, and import CSV SKU variant matrices."}
            </p>
          </div>

          <div className="flex items-center gap-3">
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
      <div className="bg-white rounded-xl border border-slate-200 p-3 shadow-xs">
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
                Product Family, Media & Documents
              </div>
              <div className="text-[10px] text-slate-400">Overview, All Filter, Images & Datasheets</div>
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
                Attributes & CSV Variants Matrix
              </div>
              <div className="text-[10px] text-slate-400">Series Descriptions & SKU Imports</div>
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

      {/* STEP 1 CONTENT: Product Metadata, Descriptions, Multi-Images, Documents, Category Tree */}
      {activeStep === 1 && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Left Column: Title, Overview, All Filter Short Desc, Images, Documents (7 cols) */}
            <div className="lg:col-span-7 space-y-5">
              {/* Product Family Core Info */}
              <Card className="border border-slate-200 bg-white shadow-xs overflow-hidden rounded-xl">
                <CardHeader className="pb-3 border-b border-slate-100">
                  <CardTitle className="text-sm font-semibold text-slate-900">
                    Basic Information
                  </CardTitle>
                  <p className="text-xs text-slate-500 font-normal mt-0.5">
                    Product title and primary descriptions for storefront presentation.
                  </p>
                </CardHeader>
                <CardContent className="p-4 space-y-4">
                  {/* Title */}
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-slate-800">
                      Product Title <span className="text-rose-500">*</span>
                    </Label>
                    <Input
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="e.g. 4-Flute Solid Carbide End Mill"
                      required
                      className="h-9 text-sm border-slate-200 font-medium placeholder:text-slate-400"
                    />
                  </div>

                  {/* Overview Description (Shown in Overview tab on Product Page) */}
                  <div className="space-y-1">
                    <Label className="text-xs font-semibold text-slate-800">
                      Overview Description <span className="text-rose-500">*</span>
                    </Label>
                    <p className="text-[11px] text-slate-500">
                      Full specifications and geometry shown under the &quot;Overview&quot; tab on the product page
                    </p>
                    <textarea
                      value={fullDescription}
                      onChange={(e) => setFullDescription(e.target.value)}
                      rows={4}
                      required
                      placeholder="Tooling specifications, manufacturing geometry, coating characteristics, and application guidelines..."
                      className="w-full rounded-lg border border-slate-200 bg-white p-3 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#024AE5]/20 focus:border-[#024AE5] leading-relaxed mt-1"
                    />
                  </div>

                  {/* Short Description for 'All' Filter */}
                  <div className="space-y-1">
                    <Label className="text-xs font-semibold text-slate-800">
                      Short Description (Attributes) <span className="text-rose-500">*</span>
                    </Label>
                    <p className="text-[11px] text-slate-500">
                      Brief summary shown on catalog cards and when the &quot;All&quot; filter is selected
                    </p>
                    <textarea
                      value={allShortDescription}
                      onChange={(e) => setAllShortDescription(e.target.value)}
                      rows={2}
                      placeholder="e.g. High-performance solid carbide series available in multiple hardness grades (HRC 45, 55, 65) for universal CNC milling."
                      className="w-full rounded-lg border border-slate-200 bg-white p-3 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#024AE5]/20 focus:border-[#024AE5] leading-relaxed mt-1"
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Multi-Image Upload & Edit (Global for Attributes) */}
              <Card className="border border-slate-200 bg-white shadow-xs overflow-hidden rounded-xl">
                <CardHeader className="pb-3 border-b border-slate-100 flex items-center justify-between">
                  <div>
                    <CardTitle className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                      <ImageIcon className="h-4 w-4 text-[#024AE5]" />
                      <span>Product Images (Attributes)</span>
                    </CardTitle>
                    <p className="text-xs text-slate-500 font-normal mt-0.5">
                      Default images shown on catalog and storefront. Attribute-specific images can be added in Step 2.
                    </p>
                  </div>
                  <span className="text-xs text-slate-600 font-medium bg-slate-100 px-2.5 py-0.5 rounded-full">
                    {images.filter((img) => !img.attribute_id || img.attribute_id === "all").length} Global {images.filter((img) => !img.attribute_id || img.attribute_id === "all").length === 1 ? "Image" : "Images"}
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
                  <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
                    {images
                      .filter((img) => !img.attribute_id || img.attribute_id === "all")
                      .map((img) => {
                        const globalIdx = images.indexOf(img);
                        return (
                          <div
                            key={img.url + globalIdx}
                            className="flex flex-col sm:flex-row items-start sm:items-center gap-3 p-3 bg-slate-50/70 border border-slate-200/80 rounded-xl"
                          >
                            <div className="h-14 w-14 rounded-lg border border-slate-200 overflow-hidden shrink-0 bg-white shadow-2xs">
                              <img
                                src={img.url}
                                alt={img.title}
                                className="h-full w-full object-contain p-1"
                                onError={(e) => {
                                  (e.target as HTMLElement).style.display = "none";
                                }}
                              />
                            </div>

                            <div className="flex-1 w-full grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                              <div className="space-y-1">
                                <Label className="text-xs font-medium text-slate-600">
                                  Image Label
                                </Label>
                                <Input
                                  value={img.title}
                                  onChange={(e) => {
                                    if (globalIdx !== -1) handleUpdateImageTitle(globalIdx, e.target.value);
                                  }}
                                  placeholder="e.g. Front Profile, Coating Detail"
                                  className="h-8 text-xs border-slate-200 bg-white rounded-md placeholder:text-slate-400"
                                />
                              </div>

                              <div className="space-y-1">
                                <Label className="text-xs font-medium text-slate-500 uppercase tracking-wide">
                                  Scope
                                </Label>
                                <div className="flex items-center gap-1.5">
                                  <span className="inline-flex items-center text-[10px] font-medium text-[#024AE5] bg-blue-50 border border-blue-200 px-2 py-0.5 rounded whitespace-nowrap">
                                    All Attributes
                                  </span>
                                  {img.file && (
                                    <span className="inline-flex items-center text-[10px] font-medium text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded whitespace-nowrap">
                                      Pending
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>

                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => handleRemoveImage(img)}
                              className="h-8 w-8 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded shrink-0 self-end sm:self-center transition-colors"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        );
                      })}
                  </div>

                  {/* Add Image Dropzone */}
                  <div
                    onClick={() => imageFileInputRef.current?.click()}
                    className="border border-dashed border-slate-300 rounded-xl p-4 flex flex-col items-center justify-center text-center bg-slate-50/40 hover:bg-slate-50 transition-colors cursor-pointer"
                  >
                    <Upload className="h-5 w-5 text-slate-400 mb-1" />
                    <p className="text-xs font-semibold text-slate-700">
                      Select Images for Attributes
                    </p>
                    <p className="text-[11px] text-slate-400 mt-0.5">PNG, JPG, WebP (Uploaded when you click Submit)</p>
                  </div>
                </CardContent>
              </Card>

              {/* Technical Documents & Data Sheets (Global for Attributes) */}
              <Card className="border border-slate-200 bg-white shadow-xs overflow-hidden rounded-xl">
                <CardHeader className="pb-3 border-b border-slate-100 flex items-center justify-between">
                  <div>
                    <CardTitle className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                      <FileText className="h-4 w-4 text-[#3C8B4F]" />
                      <span>Technical Documents & Data Sheets (Attributes)</span>
                    </CardTitle>
                    <p className="text-xs text-slate-500 font-normal mt-0.5">
                      Global datasheets available for all attributes. Attribute-specific datasheets can be uploaded in Step 2.
                    </p>
                  </div>
                  <span className="inline-flex items-center gap-1 text-[10px] font-medium text-slate-500 bg-slate-100 px-2.5 py-1 rounded-full whitespace-nowrap">
                    {documents.filter((doc) => !doc.attribute_id || doc.attribute_id === "all").length}
                    &nbsp;{documents.filter((doc) => !doc.attribute_id || doc.attribute_id === "all").length === 1 ? "File" : "Files"}
                  </span>
                </CardHeader>
                <CardContent className="p-4 space-y-4">
                  <input
                    type="file"
                    ref={documentFileInputRef}
                    accept=".pdf,.xlsx,.xls,.csv,.doc,.docx"
                    multiple
                    onChange={handleDocumentFileUpload}
                    className="hidden"
                  />

                  {/* Document Items List */}
                  {documents.filter((doc) => !doc.attribute_id || doc.attribute_id === "all").length > 0 && (
                    <div className="space-y-3 max-h-64 overflow-y-auto pr-1">
                      {documents
                        .filter((doc) => !doc.attribute_id || doc.attribute_id === "all")
                        .map((doc) => {
                          const globalIdx = documents.indexOf(doc);
                          return (
                            <div
                              key={doc.id || doc.url}
                              className="flex items-center gap-3 p-3 bg-white border border-slate-200 rounded-lg hover:border-slate-300 transition-colors"
                            >
                              {/* File icon */}
                              <div className="h-9 w-9 rounded-md border border-slate-100 flex items-center justify-center shrink-0 bg-slate-50">
                                {doc.file_type === "excel" || doc.file_type === "sheet" ? (
                                  <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
                                ) : doc.file_type === "doc" ? (
                                  <FileText className="h-4 w-4 text-blue-500" />
                                ) : (
                                  <FileText className="h-4 w-4 text-rose-500" />
                                )}
                              </div>

                              {/* Name input — takes all available space */}
                              <div className="flex-1 min-w-0">
                                <Input
                                  value={doc.name}
                                  onChange={(e) => {
                                    if (globalIdx !== -1) handleUpdateDocumentName(globalIdx, e.target.value);
                                  }}
                                  placeholder="e.g. Technical Data Sheet"
                                  className="h-8 text-xs border-slate-200 bg-white rounded-md placeholder:text-slate-400"
                                />
                              </div>

                              {/* Inline meta pills */}
                              <div className="flex items-center gap-1.5 shrink-0">
                                <span className="inline-flex items-center text-[10px] font-semibold uppercase tracking-wide text-slate-400 bg-slate-100 px-2 py-0.5 rounded whitespace-nowrap">
                                  {doc.file_type}
                                </span>
                                <span className="inline-flex items-center text-[10px] font-medium text-slate-400 bg-slate-50 border border-slate-200 px-2 py-0.5 rounded whitespace-nowrap">
                                  {doc.file_size}
                                </span>
                                <span className="inline-flex items-center text-[10px] font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded whitespace-nowrap">
                                  Global
                                </span>
                                {doc.file && (
                                  <span className="inline-flex items-center text-[10px] font-medium text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded whitespace-nowrap">
                                    Pending
                                  </span>
                                )}
                              </div>

                              {/* Actions */}
                              <div className="flex items-center gap-0.5 shrink-0">
                                <a
                                  href={doc.url}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="p-1.5 text-slate-400 hover:text-[#024AE5] rounded hover:bg-slate-100 transition-colors"
                                  title="Preview Document"
                                >
                                  <ExternalLink className="h-3.5 w-3.5" />
                                </a>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleRemoveDocument(doc)}
                                  className="h-7 w-7 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  )}

                  {/* Add Document Dropzone */}
                  <div
                    onClick={() => documentFileInputRef.current?.click()}
                    className="border border-dashed border-slate-300 rounded-xl p-4 flex flex-col items-center justify-center text-center bg-slate-50/40 hover:bg-slate-50 transition-colors cursor-pointer"
                  >
                    <Upload className="h-5 w-5 text-slate-400 mb-1" />
                    <p className="text-xs font-semibold text-slate-700">
                      Select Technical Document for Attributes
                    </p>
                    <p className="text-[11px] text-slate-400 mt-0.5">PDF, Excel or Word documents (Uploaded on submit)</p>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Right Column: Categories Tree (5 cols) */}
            <div className="lg:col-span-5 space-y-4">
              <Card className="border border-slate-200 bg-white shadow-xs overflow-hidden rounded-xl">
                <CardHeader className="pb-3 border-b border-slate-100 flex items-center justify-between">
                  <div>
                    <CardTitle className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                      <FolderTree className="h-4 w-4 text-[#024AE5]" />
                      <span>Product Categories</span>
                    </CardTitle>
                    <p className="text-xs text-slate-500 font-normal mt-0.5">
                      Select categories where this product will appear.
                    </p>
                  </div>
                  <Link href="/admin/categories" className="text-xs text-[#024AE5] hover:underline font-medium">
                    Manage →
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

          {/* Step 1 Actions */}
          <div className="flex items-center justify-between pt-2 border-t border-slate-200">
            {mode === "edit" ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={handleSubmit}
                disabled={isSavingWithUpload || isPending}
                className="h-9 px-5 text-xs font-semibold text-slate-700 border-slate-300 hover:bg-slate-50 cursor-pointer"
              >
                {isSavingWithUpload ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin text-[#024AE5]" />
                    <span>{uploadProgressText || "Saving Changes..."}</span>
                  </>
                ) : (
                  "Save Changes (Metadata & Media)"
                )}
              </Button>
            ) : <div />}

            <Button
              type="button"
              size="sm"
              onClick={() => setActiveStep(2)}
              disabled={!title.trim()}
              className="h-9 px-6 text-xs bg-[#024AE5] text-white hover:bg-[#023ecc] gap-1.5 font-medium disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              <span>Continue to Attributes & CSV Import</span>
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* STEP 2 CONTENT: Attributes Selection & Multiple CSV Uploads */}
      {activeStep === 2 && (
        <div className="space-y-6">
          {/* ATTRIBUTES SELECTOR */}
          <Card className="border border-slate-300 bg-white shadow-xs overflow-hidden rounded-xl">
            <CardHeader className="pb-3 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div>
                <CardTitle className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                  <Sparkles className="h-4 w-4 text-[#024AE5]" />
                  Select Attributes / Series (e.g. HRC 45, 55, 65)
                </CardTitle>
                <p className="text-[10px] text-slate-400 mt-0.5">
                  Each attribute gets its own short description and SKU variant matrix.
                </p>
              </div>
              <div className="flex gap-2">
                <Link href="/admin/attributes" target="_blank">
                  <Button type="button" variant="outline" size="sm" className="h-8 text-xs border-slate-200">
                    <Plus className="h-3.5 w-3.5 mr-1" /> Add New Attribute
                  </Button>
                </Link>
              </div>
            </CardHeader>
            <CardContent className="p-4">
              <div className="flex flex-wrap gap-2">
                {activeAttributes.map((attr) => {
                  const isSelected = selectedAttributeIds.includes(attr.id);
                  return (
                    <button
                      key={attr.id}
                      type="button"
                      onClick={() => handleToggleAttribute(attr.id)}
                      className={cn(
                        "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium cursor-pointer transition-colors border",
                        isSelected
                          ? "bg-[#024AE5] text-white border-[#024AE5] shadow-xs"
                          : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
                      )}
                    >
                      {isSelected && <Check className="h-3.5 w-3.5" />}
                      <span>{attr.name}</span>
                    </button>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* PER ATTRIBUTE SECTIONS (Short Description & CSV Upload Matrix) */}
          <div className="space-y-6">
            {selectedAttributeIds.map((attrId) => {
              const upload = attributeUploads[attrId];
              if (!upload) return null;

              // Existing variant count for this attribute in edit mode
              const existingVariantsForAttr =
                initialProduct?.variants?.filter(
                  (v) =>
                    !v.is_archived &&
                    (v.specifications?.Attribute === upload.attributeName ||
                      v.specifications?.Tag === upload.attributeName)
                ) || [];

              // Attribute specific images
              const attrImages = images.filter(
                (img) => img.attribute_id === attrId || img.attribute_name === upload.attributeName
              );

              // Attribute specific documents
              const attrDocs = documents.filter(
                (doc) => doc.attribute_id === attrId || doc.attribute_name === upload.attributeName
              );

              return (
                <Card
                  key={attrId}
                  className="border border-slate-200 bg-white shadow-xs overflow-hidden rounded-xl"
                >
                  <CardHeader className="bg-slate-50/75 pb-3 border-b border-slate-100">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <Badge className="bg-[#024AE5] text-white text-xs px-2.5 py-0.5 rounded-md font-medium">
                          {upload.attributeName} Series
                        </Badge>
                        {existingVariantsForAttr.length > 0 && (
                          <Badge variant="outline" className="text-xs bg-emerald-50 text-emerald-800 border-emerald-200 font-medium">
                            {existingVariantsForAttr.length} Existing SKUs
                          </Badge>
                        )}
                        {attrImages.length > 0 && (
                          <Badge variant="outline" className="text-[11px] text-blue-700 bg-blue-50 border-blue-200 font-medium">
                            <ImageIcon className="w-3 h-3 mr-1" /> {attrImages.length} {attrImages.length === 1 ? "Image" : "Images"}
                          </Badge>
                        )}
                        {attrDocs.length > 0 && (
                          <Badge variant="outline" className="text-[11px] text-emerald-700 bg-emerald-50 border-emerald-200 font-medium">
                            <FileText className="w-3 h-3 mr-1" /> {attrDocs.length} {attrDocs.length === 1 ? "Datasheet" : "Datasheets"}
                          </Badge>
                        )}
                      </div>

                      {upload.csvData && (
                        <div className="flex items-center gap-2 text-xs text-slate-500 font-medium">
                          <span>{upload.csvData.fileName}</span>
                          <span>&bull;</span>
                          <span className="text-[#024AE5] font-bold">
                            {upload.selectedRowIndices.length} of {upload.csvData.rows.length} rows selected
                          </span>
                        </div>
                      )}
                    </div>
                  </CardHeader>

                  <CardContent className="p-5 space-y-5">
                    {/* Short Description for this specific Attribute */}
                    <div className="space-y-1.5 bg-slate-50/60 p-3.5 rounded-lg border border-slate-200/80">
                      <div className="flex items-center justify-between">
                        <Label className="text-xs font-semibold text-slate-800">
                          Short Description for {upload.attributeName} Series
                        </Label>
                        <span className="text-[11px] text-slate-500 font-normal">
                          Shown on product page when &quot;{upload.attributeName}&quot; is selected
                        </span>
                      </div>
                      <textarea
                        value={upload.shortDescription}
                        onChange={(e) =>
                          setAttributeUploads((prev) => ({
                            ...prev,
                            [attrId]: { ...prev[attrId], shortDescription: e.target.value },
                          }))
                        }
                        rows={2}
                        placeholder={`e.g. Engineered for machining materials up to ${upload.attributeName} with high thermal resistance and extended tool life.`}
                        className="w-full rounded-lg border border-slate-200 bg-white p-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#024AE5]/20 leading-relaxed placeholder:text-slate-400"
                      />
                    </div>

                    {/* Per-Attribute Image & Document Upload Blocks */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                      {/* Left: Image Upload for this Attribute */}
                      <div className="p-3.5 bg-slate-50/70 rounded-lg border border-slate-200/80 space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5">
                            <ImageIcon className="h-4 w-4 text-[#024AE5]" />
                            <span className="text-xs font-semibold text-slate-800">
                              {upload.attributeName} Series Image
                            </span>
                          </div>
                          <span className="text-[11px] text-slate-500 font-normal">
                            Shown when series is clicked
                          </span>
                        </div>

                        {/* List existing images for this attribute */}
                        {attrImages.length > 0 && (
                          <div className="space-y-2">
                            {attrImages.map((img) => {
                              const globalIdx = images.indexOf(img);
                              return (
                                <div
                                  key={img.url + globalIdx}
                                  className="flex items-center gap-2 p-2 bg-white rounded-md border border-slate-200 shadow-2xs"
                                >
                                  <div className="relative h-10 w-10 shrink-0 rounded overflow-hidden border border-slate-100 bg-slate-50">
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img
                                      src={img.url}
                                      alt={img.title || upload.attributeName}
                                      className="h-full w-full object-cover"
                                    />
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <Input
                                      value={img.title}
                                      onChange={(e) => {
                                        if (globalIdx !== -1) handleUpdateImageTitle(globalIdx, e.target.value);
                                      }}
                                      placeholder="Image label / caption"
                                      className="h-7 text-xs bg-slate-50/50 border-slate-200 focus:bg-white"
                                    />
                                  </div>
                                  {img.file && (
                                    <Badge variant="outline" className="text-[9px] bg-amber-50 text-amber-700 border-amber-200 shrink-0">
                                      Ready to Upload
                                    </Badge>
                                  )}
                                  <a
                                    href={img.url}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="p-1 text-slate-400 hover:text-[#024AE5] rounded hover:bg-slate-50"
                                    title="View Full Image"
                                  >
                                    <ExternalLink className="h-3.5 w-3.5" />
                                  </a>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => handleRemoveImage(img)}
                                    className="h-7 w-7 text-rose-500 hover:bg-rose-50 rounded"
                                    title="Remove image"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </Button>
                                </div>
                              );
                            })}
                          </div>
                        )}

                        {/* Upload Button / Dropzone */}
                        <div>
                          <input
                            type="file"
                            id={`attr-image-file-${attrId}`}
                            accept="image/*"
                            multiple
                            onChange={(e) => {
                              handleAttributeImageUpload(attrId, upload.attributeName, e.target.files);
                              e.target.value = "";
                            }}
                            className="hidden"
                          />
                          <label
                            htmlFor={`attr-image-file-${attrId}`}
                            className="border border-dashed border-blue-200 hover:border-[#024AE5] bg-blue-50/30 hover:bg-blue-50/60 rounded-md p-2.5 flex items-center justify-center gap-2 cursor-pointer transition-colors text-xs font-semibold text-[#024AE5]"
                          >
                            <Upload className="h-3.5 w-3.5" />
                            <span>+ Upload Image for {upload.attributeName}</span>
                          </label>
                        </div>
                      </div>

                      {/* Right: Technical Datasheet Upload for this Attribute */}
                      <div className="p-3.5 bg-slate-50/70 rounded-lg border border-slate-200 space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5">
                            <FileText className="h-4 w-4 text-[#3C8B4F]" />
                            <span className="text-xs font-bold text-slate-800">
                              {upload.attributeName} Technical Datasheet
                            </span>
                          </div>
                          <span className="text-[10px] text-slate-500">
                            Downloaded via &quot;Download Data Sheet&quot;
                          </span>
                        </div>

                        {/* List existing documents for this attribute */}
                        {attrDocs.length > 0 && (
                          <div className="space-y-2">
                            {attrDocs.map((doc) => {
                              const globalIdx = documents.indexOf(doc);
                              return (
                                <div
                                  key={doc.id || doc.url}
                                  className="flex items-center gap-2 p-2 bg-white rounded-md border border-slate-200 shadow-2xs"
                                >
                                  <div className="h-8 w-8 rounded bg-emerald-50 border border-emerald-100 flex items-center justify-center shrink-0">
                                    {doc.file_type === "excel" || doc.file_type === "sheet" ? (
                                      <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
                                    ) : (
                                      <FileText className="h-4 w-4 text-rose-600" />
                                    )}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <Input
                                      value={doc.name}
                                      onChange={(e) => {
                                        if (globalIdx !== -1) handleUpdateDocumentName(globalIdx, e.target.value);
                                      }}
                                      placeholder="Document name"
                                      className="h-7 text-xs bg-slate-50/50 border-slate-200 focus:bg-white"
                                    />
                                  </div>
                                  {doc.file && (
                                    <Badge variant="outline" className="text-[9px] bg-amber-50 text-amber-700 border-amber-200 shrink-0">
                                      Ready to Upload
                                    </Badge>
                                  )}
                                  {doc.file_size && (
                                    <span className="text-[10px] font-mono text-slate-400 shrink-0">
                                      {doc.file_size}
                                    </span>
                                  )}
                                  <a
                                    href={doc.url}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="p-1 text-slate-400 hover:text-[#024AE5] rounded hover:bg-slate-50"
                                    title="Download / View"
                                  >
                                    <ExternalLink className="h-3.5 w-3.5" />
                                  </a>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => handleRemoveDocument(doc)}
                                    className="h-7 w-7 text-rose-500 hover:bg-rose-50 rounded"
                                    title="Remove document"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </Button>
                                </div>
                              );
                            })}
                          </div>
                        )}

                        {/* Upload Button / Dropzone */}
                        <div>
                          <input
                            type="file"
                            id={`attr-doc-file-${attrId}`}
                            accept=".pdf,.xlsx,.xls,.csv,.doc,.docx"
                            multiple
                            onChange={(e) => {
                              handleAttributeDocumentUpload(attrId, upload.attributeName, e.target.files);
                              e.target.value = "";
                            }}
                            className="hidden"
                          />
                          <label
                            htmlFor={`attr-doc-file-${attrId}`}
                            className="border border-dashed border-emerald-200 hover:border-[#3C8B4F] bg-emerald-50/30 hover:bg-emerald-50/60 rounded-md p-2.5 flex items-center justify-center gap-2 cursor-pointer transition-colors text-xs font-semibold text-[#3C8B4F]"
                          >
                            <Upload className="h-3.5 w-3.5" />
                            <span>+ Upload Datasheet (PDF, Excel, Word)</span>
                          </label>
                        </div>
                      </div>
                    </div>

                    {/* CSV File Upload Section */}
                    {!upload.csvData ? (
                      <div className="border-2 border-dashed border-slate-300 rounded-xl p-6 text-center hover:bg-slate-50/60 transition-colors">
                        <input
                          type="file"
                          id={`csv-file-${attrId}`}
                          accept=".csv,.tsv,.txt"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) handleAttributeCsvFileSelected(attrId, file);
                          }}
                          className="hidden"
                        />
                        <label
                          htmlFor={`csv-file-${attrId}`}
                          className="flex flex-col items-center justify-center cursor-pointer"
                        >
                          <Upload className="h-7 w-7 text-slate-400 mb-2" />
                          <p className="text-xs font-bold text-slate-800">
                            {existingVariantsForAttr.length > 0
                              ? `Upload New CSV to Replace or Append ${upload.attributeName} SKUs`
                              : `Upload CSV SKU Matrix for ${upload.attributeName}`}
                          </p>
                          <p className="text-[11px] text-slate-400 mt-1">
                            Accepts CSV files with headers: CODE/SKU, D, H, L, D2, Price, Stock...
                          </p>
                        </label>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {/* Column Mapping Toolbar */}
                        <div className="p-3.5 bg-slate-50 rounded-lg border border-slate-200">
                          <div className="text-xs font-bold text-slate-800 mb-2">
                            Map CSV Columns to System Tooling Fields:
                          </div>
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                            {upload.csvData.headers.map((header) => (
                              <div key={header} className="space-y-1">
                                <Label className="text-[10px] font-semibold text-slate-600 truncate block">
                                  {header}
                                </Label>
                                <Select
                                  value={upload.columnMapping[header] || "ignore"}
                                  onValueChange={(val) => {
                                    setAttributeUploads((prev) => ({
                                      ...prev,
                                      [attrId]: {
                                        ...prev[attrId],
                                        columnMapping: {
                                          ...prev[attrId].columnMapping,
                                          [header]: val,
                                        },
                                      },
                                    }));
                                  }}
                                >
                                  <SelectTrigger className="h-7 text-xs bg-white border-slate-200">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="ignore">Ignore Column</SelectItem>
                                    {SYSTEM_MAPPABLE_FIELDS.map((f) => (
                                      <SelectItem key={f.key} value={f.key}>
                                        {f.label}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Interactive Data Preview Table */}
                        <CsvDataPreviewTable
                          csvData={upload.csvData}
                          columnMapping={upload.columnMapping}
                          selectedRowIndices={upload.selectedRowIndices}
                          onUpdateCell={(rowIdx, header, val) =>
                            handleUpdateCsvCell(attrId, rowIdx, header, val)
                          }
                          onToggleRow={(rowIdx) => handleToggleRow(attrId, rowIdx)}
                          onToggleAllRows={(selectAll: boolean) =>
                            handleToggleAllRows(attrId, selectAll)
                          }
                        />
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-between pt-4 border-t border-slate-200">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setActiveStep(1)}
              className="text-xs border-slate-200"
            >
              &larr; Back to Media & Descriptions
            </Button>

            <Button
              type="button"
              size="sm"
              onClick={handleSubmit}
              disabled={isSavingWithUpload || isPending}
              className="h-9 px-6 text-xs bg-[#024AE5] text-white hover:bg-[#023ecc] font-bold cursor-pointer shadow-sm"
            >
              {isSavingWithUpload ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  <span>{uploadProgressText || "Uploading Media & Saving..."}</span>
                </>
              ) : isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  <span>{mode === "edit" ? "Saving Changes..." : "Creating Product Matrix..."}</span>
                </>
              ) : mode === "edit" ? (
                "Save & Update Product"
              ) : (
                "Create Product Family"
              )}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
