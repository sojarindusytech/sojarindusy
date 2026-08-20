"use client";

import React, { useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ParsedCsvData } from "./ProductUploadClient";
import { Input } from "@/components/ui/input";
import { CheckCircle2, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface CsvDataPreviewTableProps {
  csvData: ParsedCsvData;
  columnMapping: Record<string, string>;
  selectedRowIndices: number[];
  onUpdateCell: (rowIndex: number, header: string, newValue: string) => void;
  onToggleRow: (rowIndex: number) => void;
  onToggleAllRows: (selectAll: boolean) => void;
}

export function CsvDataPreviewTable({
  csvData,
  columnMapping,
  selectedRowIndices,
  onUpdateCell,
  onToggleRow,
  onToggleAllRows,
}: CsvDataPreviewTableProps) {
  // State to track which cell is currently being edited
  const [editingCell, setEditingCell] = useState<{ rowIdx: number; header: string } | null>(null);
  const [editValue, setEditValue] = useState("");
  const [isExpanded, setIsExpanded] = useState(true);

  const handleEditClick = (rowIdx: number, header: string, currentValue: string) => {
    setEditingCell({ rowIdx, header });
    setEditValue(currentValue);
  };

  const handleEditSave = () => {
    if (editingCell) {
      onUpdateCell(editingCell.rowIdx, editingCell.header, editValue);
    }
    setEditingCell(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleEditSave();
    } else if (e.key === "Escape") {
      setEditingCell(null);
    }
  };

  // Determine row validity
  // A row is valid if it has SKU, List Price, and Stock Quantity mapping AND values are non-empty
  const getRowValidity = (row: Record<string, any>) => {
    let hasSku = false;
    let hasPrice = false;
    let hasStock = false;

    Object.entries(columnMapping).forEach(([header, sysKey]) => {
      const val = String(row[header] || "").trim();
      if (sysKey === "sku" && val) hasSku = true;
      if (sysKey === "listPrice" && val) hasPrice = true;
      if (sysKey === "stockQuantity" && val) hasStock = true;
    });

    return hasSku && hasPrice && hasStock;
  };

  const allSelected = selectedRowIndices.length === csvData.rows.length && csvData.rows.length > 0;
  const someSelected = selectedRowIndices.length > 0 && selectedRowIndices.length < csvData.rows.length;

  return (
    <div className="border border-slate-200 rounded-xl overflow-hidden mt-4 bg-white">
      <div className="bg-slate-50/80 px-4 py-2 border-b border-slate-200 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-xs font-bold text-slate-700">
            Data Preview & Edit ({csvData.rows.length} Rows)
          </span>
          <span className="text-[10px] text-slate-500 hidden sm:inline-block">
            Click any cell to edit. Checked rows will be imported.
          </span>
        </div>
        <button
          type="button"
          onClick={() => setIsExpanded(!isExpanded)}
          className="text-[11px] font-medium text-[#024AE5] hover:text-[#023ecc] hover:underline cursor-pointer px-2 py-1"
        >
          {isExpanded ? "Hide Preview" : "Show Preview"}
        </button>
      </div>
      
      {isExpanded && (
        <div className="overflow-x-auto max-h-[400px]">
          <Table className="w-full text-xs">
            <TableHeader className="sticky top-0 z-10 shadow-sm">
              <TableRow className="bg-[#024AE5] hover:bg-[#024AE5] border-none">
                <TableHead className="w-10 text-center px-2">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    ref={input => {
                      if (input) input.indeterminate = someSelected;
                    }}
                    onChange={(e) => onToggleAllRows(e.target.checked)}
                    className="cursor-pointer"
                  />
                </TableHead>
                <TableHead className="w-12 text-center text-white font-bold px-2">#</TableHead>
                
                {csvData.headers.filter(h => h.trim()).map((header, idx) => (
                  <TableHead key={idx} className="text-white font-bold px-3 whitespace-nowrap">
                    {header}
                    {columnMapping[header] && columnMapping[header] !== "ignore" && (
                      <span className="ml-1 text-[9px] text-blue-200 font-normal uppercase tracking-wider block">
                        ({columnMapping[header]})
                      </span>
                    )}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {csvData.rows.map((row, rowIdx) => {
                const isSelected = selectedRowIndices.includes(rowIdx);

                return (
                  <TableRow 
                    key={rowIdx} 
                    className={cn(
                      "hover:bg-slate-50/80 transition-colors border-b border-slate-100",
                      !isSelected && "opacity-50"
                    )}
                  >
                    <TableCell className="text-center px-2 py-2">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => onToggleRow(rowIdx)}
                        className="cursor-pointer"
                      />
                    </TableCell>
                    <TableCell className="text-center font-medium text-slate-500 px-2 py-2">
                      {rowIdx + 1}
                    </TableCell>

                    {csvData.headers.filter(h => h.trim()).map((header, colIdx) => {
                      const isEditing = editingCell?.rowIdx === rowIdx && editingCell?.header === header;
                      const val = row[header] !== undefined ? String(row[header]) : "";

                      return (
                        <TableCell 
                          key={colIdx} 
                          className={cn(
                            "px-3 py-1 whitespace-nowrap cursor-pointer border-l border-slate-100",
                            !isEditing && "hover:bg-blue-50/50"
                          )}
                          onClick={() => {
                            if (!isEditing) handleEditClick(rowIdx, header, val);
                          }}
                        >
                          {isEditing ? (
                            <Input
                              autoFocus
                              value={editValue}
                              onChange={(e) => setEditValue(e.target.value)}
                              onBlur={handleEditSave}
                              onKeyDown={handleKeyDown}
                              className="h-7 text-xs border-blue-400 bg-white min-w-[100px]"
                            />
                          ) : (
                            <span className={cn(
                              "block w-full truncate max-w-[200px]",
                              val ? "text-slate-900" : "text-slate-400 italic"
                            )}>
                              {val || "-"}
                            </span>
                          )}
                        </TableCell>
                      );
                    })}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
