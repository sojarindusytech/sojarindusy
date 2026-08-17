"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { CategoryCheckboxTree } from "@/components/common/CategoryCheckboxTree";
import { CategoryNode } from "@/types/database.types";
import { fetchCategoriesTree } from "@/actions/category";
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
  Tag,
} from "lucide-react";
import Link from "next/link";

interface PreviewRow {
  index: number;
  sku: string;
  diameter: number;
  fluteLength: number;
  overallLength: number;
  shankDia: number;
  listPrice: string;
}

const sampleRows: PreviewRow[] = [
  { index: 1, sku: "SIH55E4A04050-1.0", diameter: 1.0, fluteLength: 3, overallLength: 50, shankDia: 4, listPrice: "-" },
  { index: 2, sku: "SIH55E4A04050-1.5", diameter: 1.5, fluteLength: 4, overallLength: 50, shankDia: 4, listPrice: "-" },
  { index: 3, sku: "SIH55E4A04050-2.0", diameter: 2.0, fluteLength: 5, overallLength: 50, shankDia: 4, listPrice: "-" },
  { index: 4, sku: "SIH55E4A04050-2.5", diameter: 2.5, fluteLength: 7, overallLength: 50, shankDia: 4, listPrice: "-" },
  { index: 5, sku: "SIH55E4A03050-3.0", diameter: 3.0, fluteLength: 9, overallLength: 50, shankDia: 3, listPrice: "-" },
];

export default function ProductUploadPage() {
  const [selectedFile, setSelectedFile] = useState<string>("4FLUTE_SIH55_Standard_End_Mill.xlsx");
  const [fileSize] = useState<string>("25.6 KB");
  const [activeStep, setActiveStep] = useState<number>(3);

  // Category Tree State
  const [treeNodes, setTreeNodes] = useState<CategoryNode[]>([]);
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>([
    "cat-end-mills",
    "cat-flat-end-mills",
    "cat-4flute-standard",
  ]);

  useEffect(() => {
    async function loadCategories() {
      const { treeNodes: nodes } = await fetchCategoriesTree();
      setTreeNodes(nodes);
    }
    loadCategories();
  }, []);

  return (
    <div className="space-y-6 w-full">
      {/* Header with Title and Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Product Upload
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Upload Excel file to import products (SKUs) in bulk and map category taxonomies.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" className="gap-1.5 text-xs border-slate-200 text-slate-700">
            <Download className="h-4 w-4 text-slate-500" />
            <span>Download Template</span>
          </Button>
          <Button variant="outline" size="sm" className="gap-1.5 text-xs border-slate-200 text-slate-700">
            <History className="h-4 w-4 text-slate-500" />
            <span>Upload History</span>
          </Button>
        </div>
      </div>

      {/* 4-Step Process Stepper */}
      <div className="bg-white rounded-xl border border-slate-200 bg-white p-5 shadow-none">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          {/* Step 1 */}
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#024AE5] text-white text-xs font-bold shadow-xs">
              1
            </div>
            <div>
              <div className="text-xs font-bold text-slate-900">Upload File</div>
              <div className="text-[11px] text-slate-500">Upload your Excel file</div>
            </div>
          </div>

          <div className="hidden md:block flex-1 h-[1px] bg-slate-200 mx-4" />

          {/* Step 2 */}
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#024AE5] text-white text-xs font-bold shadow-xs">
              2
            </div>
            <div>
              <div className="text-xs font-bold text-slate-900">Select Mapping</div>
              <div className="text-[11px] text-slate-500">Map columns with system fields</div>
            </div>
          </div>

          <div className="hidden md:block flex-1 h-[1px] bg-slate-200 mx-4" />

          {/* Step 3 */}
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#024AE5] text-white text-xs font-bold shadow-xs ring-4 ring-[#024AE5]/15">
              3
            </div>
            <div>
              <div className="text-xs font-bold text-slate-900">Validate Data</div>
              <div className="text-[11px] text-slate-500">Validate and preview data</div>
            </div>
          </div>

          <div className="hidden md:block flex-1 h-[1px] bg-slate-200 mx-4" />

          {/* Step 4 */}
          <div className="flex items-center gap-3 opacity-60">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-200 text-slate-700 text-xs font-bold">
              4
            </div>
            <div>
              <div className="text-xs font-bold text-slate-700">Import Data</div>
              <div className="text-[11px] text-slate-500">Import data to create products</div>
            </div>
          </div>
        </div>
      </div>

      {/* 3 Top Cards: Upload Zone, Summary, Category Selection */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Card 1: Upload Excel File */}
        <Card className="border-slate-200 bg-white shadow-none rounded-xl">
          <CardHeader className="pb-3 border-b border-slate-100">
            <CardTitle className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
              Upload Excel File <span className="text-red-500">*</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 space-y-3">
            <div className="border-2 border-dashed border-slate-200 rounded-xl p-6 flex flex-col items-center justify-center text-center bg-slate-50/50 hover:bg-slate-50 transition-colors">
              <FileSpreadsheet className="h-10 w-10 text-[#3C8B4F] mb-2" />
              <p className="text-xs font-medium text-slate-700 mb-1">
                Drag and drop your file here
              </p>
              <p className="text-[11px] text-slate-400 mb-3">or</p>
              <Button size="sm" variant="default" className="text-xs h-8 px-4 bg-[#024AE5] text-white">
                Choose File
              </Button>
            </div>

            {selectedFile && (
              <div className="flex items-center gap-2 text-xs text-slate-600 bg-emerald-50/60 border border-emerald-200/60 p-2.5 rounded-lg">
                <CheckCircle2 className="h-4 w-4 text-[#3C8B4F] shrink-0" />
                <div className="truncate">
                  <span className="font-semibold text-slate-900">File selected:</span> {selectedFile}
                  <span className="text-[10px] text-slate-400 ml-1.5 font-normal">({fileSize})</span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Card 2: Upload Summary */}
        <Card className="border-slate-200 bg-white shadow-none rounded-xl flex flex-col justify-between">
          <CardHeader className="pb-3 border-b border-slate-100">
            <CardTitle className="text-xs font-bold text-slate-900">
              Upload Summary
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 space-y-3 flex-1 flex flex-col justify-between">
            <div className="space-y-2 text-xs">
              <div className="flex items-center justify-between py-1 border-b border-slate-100">
                <span className="text-slate-600 font-medium">Total Rows</span>
                <span className="font-bold text-slate-900">25</span>
              </div>
              <div className="flex items-center justify-between py-1 border-b border-slate-100">
                <span className="text-[#3C8B4F] font-semibold">Valid Rows</span>
                <span className="font-bold text-[#3C8B4F]">25</span>
              </div>
              <div className="flex items-center justify-between py-1 border-b border-slate-100">
                <span className="text-red-600 font-medium">Invalid Rows</span>
                <span className="font-bold text-red-600">0</span>
              </div>
              <div className="flex items-center justify-between py-1">
                <span className="text-slate-600 font-medium">Duplicates</span>
                <span className="font-bold text-slate-900">0</span>
              </div>
            </div>

            <div className="bg-emerald-50 border border-emerald-200/80 p-3 rounded-lg flex items-start gap-2">
              <CheckCircle2 className="h-4 w-4 text-[#3C8B4F] shrink-0 mt-0.5" />
              <div>
                <div className="text-xs font-bold text-[#3C8B4F]">File validation successful</div>
                <div className="text-[11px] text-slate-600">All rows are valid and ready to import.</div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Card 3: Free-Form Category Selection (Checkbox Tree Integration) */}
        <Card className="border-slate-200 bg-white shadow-none rounded-xl flex flex-col justify-between">
          <CardHeader className="pb-3 border-b border-slate-100 flex items-center justify-between">
            <CardTitle className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
              <FolderTree className="h-3.5 w-3.5 text-[#024AE5]" />
              Assign Product Categories
            </CardTitle>
            <Link href="/admin/categories" className="text-[10px] text-[#024AE5] hover:underline">
              Manage Taxonomies →
            </Link>
          </CardHeader>
          <CardContent className="p-3 flex-1">
            <CategoryCheckboxTree
              treeNodes={treeNodes}
              selectedIds={selectedCategoryIds}
              onChange={(newIds) => setSelectedCategoryIds(newIds)}
              className="border-0 p-0"
            />
          </CardContent>
        </Card>
      </div>

      {/* Column Mapping Section */}
      <Card className="border-slate-200 bg-white shadow-none rounded-xl">
        <CardHeader className="pb-3 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            <CardTitle className="text-sm font-bold text-slate-900">
              Column Mapping
            </CardTitle>
            <p className="text-[11px] text-emerald-700 font-medium mt-0.5">
              Please map the columns from your Excel file with system product attributes.
            </p>
          </div>
          <Button variant="outline" size="sm" className="gap-1.5 text-xs text-[#024AE5] border-blue-200 hover:bg-blue-50">
            <Sparkles className="h-3.5 w-3.5" />
            <span>Auto Map Columns</span>
          </Button>
        </CardHeader>

        <CardContent className="p-4 overflow-x-auto">
          <div className="grid grid-cols-6 gap-3 min-w-[760px] text-xs">
            {/* Column 1 */}
            <div className="space-y-1.5 bg-slate-50/70 p-3 rounded-lg border border-slate-200/60">
              <div className="text-[11px] text-slate-500 font-semibold">Excel Column</div>
              <div className="font-bold text-slate-900">CODE</div>
              <div className="pt-2 text-[10px] text-slate-400">Map to Field *</div>
              <div className="font-medium text-[#024AE5] bg-white p-1.5 rounded border border-slate-200">
                SKU Code
              </div>
              <div className="text-[10px] text-slate-400">Data Type: <span className="text-slate-700 font-medium">Text</span></div>
            </div>

            {/* Column 2 */}
            <div className="space-y-1.5 bg-slate-50/70 p-3 rounded-lg border border-slate-200/60">
              <div className="text-[11px] text-slate-500 font-semibold">Excel Column</div>
              <div className="font-bold text-slate-900">D</div>
              <div className="pt-2 text-[10px] text-slate-400">Map to Field *</div>
              <div className="font-medium text-[#024AE5] bg-white p-1.5 rounded border border-slate-200">
                Diameter (D)
              </div>
              <div className="text-[10px] text-slate-400">Data Type: <span className="text-slate-700 font-medium">Decimal</span></div>
            </div>

            {/* Column 3 */}
            <div className="space-y-1.5 bg-slate-50/70 p-3 rounded-lg border border-slate-200/60">
              <div className="text-[11px] text-slate-500 font-semibold">Excel Column</div>
              <div className="font-bold text-slate-900">H</div>
              <div className="pt-2 text-[10px] text-slate-400">Map to Field *</div>
              <div className="font-medium text-[#024AE5] bg-white p-1.5 rounded border border-slate-200">
                Flute Length (H)
              </div>
              <div className="text-[10px] text-slate-400">Data Type: <span className="text-slate-700 font-medium">Decimal</span></div>
            </div>

            {/* Column 4 */}
            <div className="space-y-1.5 bg-slate-50/70 p-3 rounded-lg border border-slate-200/60">
              <div className="text-[11px] text-slate-500 font-semibold">Excel Column</div>
              <div className="font-bold text-slate-900">L</div>
              <div className="pt-2 text-[10px] text-slate-400">Map to Field *</div>
              <div className="font-medium text-[#024AE5] bg-white p-1.5 rounded border border-slate-200">
                Overall Length (L)
              </div>
              <div className="text-[10px] text-slate-400">Data Type: <span className="text-slate-700 font-medium">Decimal</span></div>
            </div>

            {/* Column 5 */}
            <div className="space-y-1.5 bg-slate-50/70 p-3 rounded-lg border border-slate-200/60">
              <div className="text-[11px] text-slate-500 font-semibold">Excel Column</div>
              <div className="font-bold text-slate-900">D2</div>
              <div className="pt-2 text-[10px] text-slate-400">Map to Field *</div>
              <div className="font-medium text-[#024AE5] bg-white p-1.5 rounded border border-slate-200">
                Shank Dia (D2)
              </div>
              <div className="text-[10px] text-slate-400">Data Type: <span className="text-slate-700 font-medium">Decimal</span></div>
            </div>

            {/* Column 6 */}
            <div className="space-y-1.5 bg-slate-50/70 p-3 rounded-lg border border-slate-200/60">
              <div className="text-[11px] text-slate-500 font-semibold">Excel Column</div>
              <div className="font-bold text-slate-900">LIST PRICE</div>
              <div className="pt-2 text-[10px] text-slate-400">Map to Field</div>
              <div className="font-medium text-[#024AE5] bg-white p-1.5 rounded border border-slate-200">
                List Price (Excl. GST)
              </div>
              <div className="text-[10px] text-slate-400">Data Type: <span className="text-slate-700 font-medium">Decimal</span></div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Data Preview Table */}
      <Card className="border-slate-200 bg-white shadow-none rounded-xl overflow-hidden">
        <CardHeader className="pb-3 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            <CardTitle className="text-sm font-bold text-slate-900">
              Data Preview (First 10 rows)
            </CardTitle>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-slate-500">Showing 10 of 25 rows</span>
            <Button variant="outline" size="sm" className="gap-1.5 text-xs">
              <Eye className="h-3.5 w-3.5 text-slate-500" />
              <span>Full Preview</span>
            </Button>
          </div>
        </CardHeader>

        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader className="bg-[#024AE5]">
              <TableRow className="hover:bg-[#024AE5] border-b-0">
                <TableHead className="text-white font-bold text-xs h-9 w-12 text-center">#</TableHead>
                <TableHead className="text-white font-bold text-xs h-9">SKU CODE</TableHead>
                <TableHead className="text-white font-bold text-xs h-9 text-center">DIAMETER (D)</TableHead>
                <TableHead className="text-white font-bold text-xs h-9 text-center">FLUTE LENGTH (H)</TableHead>
                <TableHead className="text-white font-bold text-xs h-9 text-center">OVERALL LENGTH (L)</TableHead>
                <TableHead className="text-white font-bold text-xs h-9 text-center">SHANK DIA (D2)</TableHead>
                <TableHead className="text-white font-bold text-xs h-9 text-center">LIST PRICE (EXCL. GST)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sampleRows.map((row) => (
                <TableRow key={row.index} className="text-xs hover:bg-slate-50">
                  <TableCell className="text-center font-medium text-slate-500">{row.index}</TableCell>
                  <TableCell className="font-mono font-semibold text-slate-900">{row.sku}</TableCell>
                  <TableCell className="text-center font-medium">{row.diameter.toFixed(1)}</TableCell>
                  <TableCell className="text-center font-medium">{row.fluteLength}</TableCell>
                  <TableCell className="text-center font-medium">{row.overallLength}</TableCell>
                  <TableCell className="text-center font-medium">{row.shankDia}</TableCell>
                  <TableCell className="text-center font-mono text-slate-400">{row.listPrice}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Bottom Actions */}
      <div className="flex items-center justify-end gap-3 pt-2">
        <Button variant="outline" size="sm" className="text-xs px-5">
          Cancel
        </Button>
        <Button size="sm" className="text-xs px-6 gap-1.5 bg-[#024AE5] text-white hover:bg-[#023ecc]">
          <span>Validate Data & Categories</span>
          <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
