"use client";

import { useState, useRef, useEffect } from "react";
import { Attribute, Tag } from "@/types/database.types";
import { bulkAppendSkus } from "@/actions/product-management";
import { fetchAttributes } from "@/actions/attribute";
import { fetchTags } from "@/actions/tag";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CsvDataPreviewTable } from "./CsvDataPreviewTable";
import { CsvRangePicker } from "./CsvRangePicker";
import { buildCsvTable, defaultCsvRange, guessColumnMapping, guessFieldForHeader, parseCsvGrid, type CsvRange } from "@/lib/csv-grid";
import { Loader2, Upload, FileSpreadsheet, AlertCircle } from "lucide-react";
import toast from "react-hot-toast";

interface ParsedCsvData {
  fileName: string;
  fileSize: string;
  headers: string[];
  rows: Record<string, any>[];
  grid?: string[][];
  range?: CsvRange;
  rowNumbers?: number[];
}

interface TargetColumn {
  key: string;
  label: string;
  dataType: string;
}

const TARGET_COLUMNS: TargetColumn[] = [
  { key: "sku", label: "SKU Code *", dataType: "String" },
  { key: "diameter", label: "Cutting Dia (D)", dataType: "Decimal" },
  { key: "fluteLength", label: "Flute Length (H)", dataType: "Decimal" },
  { key: "overallLength", label: "Overall Length (L)", dataType: "Decimal" },
  { key: "shankDia", label: "Shank Dia (D2)", dataType: "Decimal" },
  { key: "listPrice", label: "List Price (Excl. GST)", dataType: "Decimal" },
  { key: "stockQuantity", label: "Stock Quantity", dataType: "Integer" },
  { key: "minQuantity", label: "Minimum SKU Quantity", dataType: "Integer" },
  { key: "triggerQuantity", label: "Trigger Quantity", dataType: "Integer" },
  { key: "minOrderQuantity", label: "Minimum Order Quantity", dataType: "Integer" },
];

const SYSTEM_MAPPABLE_FIELDS = TARGET_COLUMNS;

interface AppendSkuModalProps {
  isOpen: boolean;
  onClose: () => void;
  productId: string;
  availableAttributes?: Attribute[];
  availableTags?: Tag[];
}

export function AppendSkuModal({ isOpen, onClose, productId, availableAttributes, availableTags }: AppendSkuModalProps) {
  const initialAttributes = availableAttributes || availableTags || [];
  const [selectedAttributeId, setSelectedAttributeId] = useState<string>("none");
  const [csvData, setCsvData] = useState<ParsedCsvData | null>(null);
  const [columnMapping, setColumnMapping] = useState<Record<string, string>>({});
  const [selectedRowIndices, setSelectedRowIndices] = useState<number[]>([]);
  const [submitError, setSubmitError] = useState<string | string[] | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [dynamicAttributes, setDynamicAttributes] = useState<Attribute[]>(initialAttributes);

  useEffect(() => {
    if (isOpen) {
      fetchAttributes().then(attrs => {
        if (attrs && attrs.length > 0) {
          setDynamicAttributes(attrs);
        }
      });
    }
  }, [isOpen]);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const text = evt.target?.result as string;
      if (!text) return;

      const grid = parseCsvGrid(text);
      if (grid.length === 0) {
        setSubmitError("Failed to parse CSV file.");
        return;
      }
      setSubmitError(null);
      const range = defaultCsvRange(grid);
      const parsed = buildCsvTable(grid, range);

      setCsvData({
        fileName: file.name,
        fileSize: (file.size / 1024).toFixed(1) + " KB",
        headers: parsed.headers,
        rows: parsed.rows,
        grid,
        range,
        rowNumbers: parsed.rowNumbers,
      });
      setColumnMapping(guessColumnMapping(parsed.headers));
      setSelectedRowIndices(parsed.rows.map((_, i) => i)); // Select all by default
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  /** Untick a column heading to skip it, tick it to import it again (with its guessed field). */
  const handleToggleColumn = (header: string, include: boolean) =>
    setColumnMapping((prev) => ({ ...prev, [header]: include ? guessFieldForHeader(header) : "ignore" }));

  /** The admin picked a different heading / data range: rebuild the table (cell edits are dropped). */
  const handleRangeChange = (range: CsvRange) => {
    if (!csvData?.grid) return;
    const table = buildCsvTable(csvData.grid, range);
    setCsvData({ ...csvData, headers: table.headers, rows: table.rows, rowNumbers: table.rowNumbers, range });
    setColumnMapping(guessColumnMapping(table.headers));
    setSelectedRowIndices(table.rows.map((_, i) => i));
  };

  const handleUpdateCell = (rowIndex: number, header: string, newValue: string) => {
    if (!csvData) return;
    setCsvData({
      ...csvData,
      rows: csvData.rows.map((r, i) => (i === rowIndex ? { ...r, [header]: newValue } : r)),
    });
  };

  const handleToggleRow = (rowIndex: number) => {
    setSelectedRowIndices((prev) =>
      prev.includes(rowIndex) ? prev.filter((idx) => idx !== rowIndex) : [...prev, rowIndex]
    );
  };

  const handleToggleAllRows = (selectAll: boolean) => {
    if (!csvData) return;
    if (selectAll) setSelectedRowIndices(csvData.rows.map((_, i) => i));
    else setSelectedRowIndices([]);
  };

  const handleSubmit = async () => {
    if (!csvData || selectedRowIndices.length === 0) {
      toast.error("No SKUs selected to import.");
      return;
    }

    const variantsToInsert: any[] = [];
    const rowErrors: string[] = [];

    selectedRowIndices.forEach((rowIndex) => {
      const row = csvData.rows[rowIndex];
      
      const getMappedVal = (targetKey: string) => {
        const header = Object.keys(columnMapping).find((k) => columnMapping[k] === targetKey);
        return header ? row[header] : undefined;
      };

      const sku = getMappedVal("sku");
      const listPriceStr = getMappedVal("listPrice");
      const stockQtyStr = getMappedVal("stockQuantity");
      const minQtyStr = getMappedVal("minQuantity");
      const triggerQtyStr = getMappedVal("triggerQuantity");
      const minOrderQtyStr = getMappedVal("minOrderQuantity");

      if (!sku) {
        rowErrors.push(`Row ${csvData.rowNumbers?.[rowIndex] ?? rowIndex + 1}: Missing SKU Code`);
        return;
      }
      const listPrice = listPriceStr ? parseFloat(listPriceStr.toString().replace(/[^0-9.]/g, "")) : 0;
      const stockQty = stockQtyStr ? parseInt(stockQtyStr.toString().replace(/[^0-9]/g, ""), 10) : 0;
      const minQty = minQtyStr ? parseInt(minQtyStr.toString().replace(/[^0-9]/g, ""), 10) : 0;
      const triggerQty = triggerQtyStr ? parseInt(triggerQtyStr.toString().replace(/[^0-9]/g, ""), 10) : 0;
      const minOrderQty = Math.max(1, (minOrderQtyStr ? parseInt(minOrderQtyStr.toString().replace(/[^0-9]/g, ""), 10) : 1) || 1);

      const specs: any = {};
      let attributeIdToLink: string | undefined = undefined;

      if (selectedAttributeId && selectedAttributeId !== "none") {
        const attr = dynamicAttributes.find(t => t.id === selectedAttributeId);
        if (attr) {
          specs.Attribute = attr.name;
          specs.Tag = attr.name; // backward compatibility
          attributeIdToLink = attr.id;
        }
      }

      const parseNum = (val: any) => val ? parseFloat(val) : null;

      variantsToInsert.push({
        sku: sku,
        diameter: parseNum(getMappedVal("diameter")),
        flute_length: parseNum(getMappedVal("fluteLength")),
        overall_length: parseNum(getMappedVal("overallLength")),
        shank_diameter: parseNum(getMappedVal("shankDia")),
        list_price: listPrice,
        stock_quantity: stockQty,
        min_quantity: minQty,
        trigger_quantity: triggerQty,
        min_order_quantity: minOrderQty,
        specifications: specs,
      });
    });

    if (rowErrors.length > 0) {
      setSubmitError(rowErrors);
      return;
    }

    if (variantsToInsert.length === 0) {
      setSubmitError("No valid rows could be parsed.");
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);

    const attributeIdToLink = selectedAttributeId !== "none" ? selectedAttributeId : undefined;
    const result = await bulkAppendSkus(productId, variantsToInsert, attributeIdToLink);
    
    setIsSubmitting(false);

    if (result.error) {
      setSubmitError(result.error);
    } else {
      toast.success(`Successfully imported ${variantsToInsert.length} SKUs.`);
      onClose();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-5xl h-[85vh] flex flex-col p-6 bg-white overflow-hidden">
        <DialogHeader className="pb-3 border-b border-slate-200 shrink-0">
          <DialogTitle className="text-xl font-bold text-slate-900">
            Append SKUs from CSV
          </DialogTitle>
          <DialogDescription className="text-xs text-slate-500">
            Upload a CSV to append SKUs to this existing product. You can optionally assign them to an Attribute.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto pt-4 space-y-6 pr-2 custom-scrollbar">
          {submitError && (
            <div className="flex items-start gap-2 p-3 bg-red-50 text-red-700 rounded-md border border-red-200 text-xs font-semibold max-h-40 overflow-y-auto custom-scrollbar">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <div className="flex flex-col gap-1">
                {Array.isArray(submitError) ? (
                  submitError.map((err, i) => <span key={i}>{err}</span>)
                ) : (
                  <span>{submitError}</span>
                )}
              </div>
            </div>
          )}

          <div className="flex items-center justify-between gap-6">
            <div className="space-y-1.5 flex-1 max-w-sm">
              <Label className="text-xs font-semibold text-slate-700">Assign to Attribute</Label>
              <Select value={selectedAttributeId} onValueChange={setSelectedAttributeId}>
                <SelectTrigger className="h-9 text-xs border-slate-200">
                  <SelectValue placeholder="Select Attribute" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none" className="text-xs italic text-slate-400">-- No Attribute --</SelectItem>
                  {dynamicAttributes.map((t) => (
                    <SelectItem key={t.id} value={t.id} className="text-xs font-medium">{t.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex-1 flex justify-end items-end">
              <div className="flex items-center gap-3">
                <input
                  type="file"
                  accept=".csv,.xlsx"
                  className="hidden"
                  ref={fileInputRef}
                  onChange={handleFileSelected}
                />
                <Button
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                  className="gap-2 h-9 text-xs font-semibold text-slate-700 hover:text-slate-900"
                >
                  <Upload className="h-4 w-4" />
                  {csvData ? "Upload Different CSV" : "Select CSV File"}
                </Button>
              </div>
            </div>
          </div>

          {csvData && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 px-3 py-2 bg-blue-50 text-blue-700 rounded border border-blue-100 text-xs font-medium">
                <FileSpreadsheet className="h-4 w-4" />
                <span>{csvData.fileName}</span>
                <span className="text-blue-400">|</span>
                <span>{csvData.rows.length} rows</span>
              </div>
              
              {csvData.grid && csvData.range && (
                <CsvRangePicker
                  grid={csvData.grid}
                  range={csvData.range}
                  dataRowCount={csvData.rows.length}
                  onChange={handleRangeChange}
                />
              )}

              <div className="border border-slate-200 rounded-xl overflow-hidden mt-4">
                <div className="bg-slate-50/80 px-4 py-2 border-b border-slate-200 flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-700">Column Mapping ({csvData.headers.filter(h => h.trim()).length} Columns)</span>
                </div>
                <div className="p-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 text-xs overflow-x-auto min-w-full">
                    {csvData.headers.filter(h => h.trim()).map((header, hIdx) => {
                      const isSystemField = SYSTEM_MAPPABLE_FIELDS.some(f => f.key === header);
                      const mappedKey = columnMapping[header] || header;

                      return (
                        <div key={hIdx} className="space-y-1 bg-white p-2.5 rounded-lg border border-slate-200 shadow-xs">
                          <div className="text-[10px] text-slate-400 font-bold uppercase truncate">{header}</div>
                          <Select
                            value={mappedKey}
                            onValueChange={(val) =>
                              setColumnMapping(prev => ({
                                ...prev,
                                [header]: val
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
              </div>

              <div className="border border-slate-200 rounded-lg overflow-hidden bg-white shadow-sm">
                <CsvDataPreviewTable
                  csvData={csvData}
                  columnMapping={columnMapping}
                  selectedRowIndices={selectedRowIndices}
                  onUpdateCell={handleUpdateCell}
                  onToggleRow={handleToggleRow}
                  onToggleColumn={handleToggleColumn}
                  onToggleAllRows={handleToggleAllRows}
                />
              </div>
            </div>
          )}
        </div>

        <div className="pt-4 border-t border-slate-100 flex justify-end gap-3 shrink-0">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={isSubmitting}
            className="h-9 text-xs shadow-none border-slate-200 text-slate-600 hover:bg-slate-50"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting || !csvData || selectedRowIndices.length === 0}
            className="h-9 text-xs shadow-none bg-[#024AE5] hover:bg-[#024AE5]/90 text-white px-6"
          >
            {isSubmitting && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
            Append {selectedRowIndices.length} SKUs
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
