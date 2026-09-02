"use client";

import { useState, useEffect } from "react";
import { ProductVariant, InventoryLog } from "@/types/database.types";
import { fetchVariantStockLogs } from "@/actions/inventory";
import { AdjustStockModal } from "@/components/admin/AdjustStockModal";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  History,
  TrendingUp,
  TrendingDown,
  Clock,
  Package,
  Loader2,
  FileSpreadsheet,
  AlertCircle,
  ShieldCheck,
  PlusCircle,
} from "lucide-react";

interface SkuStockLogModalProps {
  isOpen: boolean;
  onClose: () => void;
  variant: ProductVariant;
  productTitle?: string;
  onStockUpdated?: (newStock: number) => void;
}

export function SkuStockLogModal({
  isOpen,
  onClose,
  variant,
  productTitle = "Product",
  onStockUpdated,
}: SkuStockLogModalProps) {
  const [logs, setLogs] = useState<InventoryLog[]>([]);
  const [currentStock, setCurrentStock] = useState<number>(variant.stock_quantity || 0);
  const [isLoading, setIsLoading] = useState(true);
  const [isAdjustModalOpen, setIsAdjustModalOpen] = useState(false);

  const loadLogs = async () => {
    if (!variant?.id) return;
    setIsLoading(true);
    try {
      const data = await fetchVariantStockLogs(variant.id);
      setLogs(data);
    } catch {
      // ignore
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && variant?.id) {
      setCurrentStock(variant.stock_quantity || 0);
      loadLogs();
    }
  }, [isOpen, variant?.id]);

  const handleStockAdjustmentSuccess = (newStock: number) => {
    setCurrentStock(newStock);
    loadLogs();
    if (onStockUpdated) {
      onStockUpdated(newStock);
    }
  };

  const formatDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return dateStr;
    }
  };

  const getMovementBadge = (type: string) => {
    switch (type) {
      case "INITIAL_IMPORT":
        return <Badge className="bg-blue-50 text-[#024AE5] border-blue-200 text-[10px] font-semibold">Initial Import</Badge>;
      case "MANUAL_ADJUSTMENT":
        return <Badge className="bg-purple-50 text-purple-700 border-purple-200 text-[10px] font-semibold">Manual Edit</Badge>;
      case "BULK_UPDATE":
        return <Badge className="bg-amber-50 text-amber-700 border-amber-200 text-[10px] font-semibold">Bulk Update</Badge>;
      case "ORDER_FULFILLED":
      case "ORDER_RESERVATION":
        return <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px] font-semibold">Order Placed</Badge>;
      case "ORDER_CANCELLED":
      case "RETURN_RESTOCK":
        return <Badge className="bg-teal-50 text-teal-700 border-teal-200 text-[10px] font-semibold">Order Restock</Badge>;
      case "ARCHIVED":
        return <Badge className="bg-rose-50 text-rose-700 border-rose-200 text-[10px] font-semibold">Archived</Badge>;
      default:
        return <Badge variant="outline" className="text-[10px]">{type}</Badge>;
    }
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="max-w-3xl bg-white p-6 max-h-[90vh] flex flex-col">
          <DialogHeader className="pb-4 border-b border-slate-100 shrink-0">
            <div className="flex items-start justify-between gap-4 pr-8">
              <div>
                <DialogTitle className="text-xl font-bold text-slate-900 flex items-center gap-2">
                  <History className="h-5 w-5 text-[#024AE5]" />
                  Stock Audit Ledger
                </DialogTitle>
                <DialogDescription className="text-xs text-slate-500 mt-0.5">
                  Complete inventory movement history for SKU <span className="font-mono font-bold text-slate-900">{variant.sku}</span>
                </DialogDescription>
              </div>
              <div className="flex items-center gap-3">
                <div className="text-right">
                  <span className="text-[10px] font-semibold uppercase text-slate-400 block leading-tight">Current Stock</span>
                  <span className="text-base font-bold text-[#3C8B4F] leading-tight">
                    {currentStock} Units
                  </span>
                </div>
                <Button
                  size="sm"
                  onClick={() => setIsAdjustModalOpen(true)}
                  className="bg-[#024AE5] hover:bg-[#023bb8] text-white text-xs h-8 px-3 flex items-center gap-1.5 font-semibold cursor-pointer shadow-xs"
                >
                  <PlusCircle className="h-3.5 w-3.5" />
                  Adjust Stock
                </Button>
              </div>
            </div>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto py-4">
            {isLoading ? (
              <div className="flex flex-col items-center justify-center py-16 text-slate-400 gap-2">
                <Loader2 className="h-7 w-7 animate-spin text-[#024AE5]" />
                <p className="text-xs">Loading stock ledger...</p>
              </div>
            ) : logs.length === 0 ? (
              <div className="text-center py-16 border-2 border-dashed border-slate-100 rounded-xl">
                <Package className="h-10 w-10 text-slate-300 mx-auto mb-2" />
                <h4 className="text-sm font-semibold text-slate-700">No stock movements recorded yet</h4>
                <p className="text-xs text-slate-400 max-w-sm mx-auto mt-1">
                  Stock changes will automatically log here when orders are placed, CSVs are imported, or stock is edited.
                </p>
              </div>
            ) : (
              <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-xs">
                <Table className="w-full text-xs">
                  <TableHeader className="bg-slate-50/80">
                    <TableRow className="border-b-slate-200">
                      <TableHead className="w-[18%] text-[11px] font-semibold text-slate-600 uppercase py-2.5">Date & Time</TableHead>
                      <TableHead className="w-[22%] text-[11px] font-semibold text-slate-600 uppercase py-2.5">Movement Type</TableHead>
                      <TableHead className="w-[15%] text-[11px] font-semibold text-slate-600 uppercase py-2.5 text-center">Change</TableHead>
                      <TableHead className="w-[18%] text-[11px] font-semibold text-slate-600 uppercase py-2.5 text-center">Balance</TableHead>
                      <TableHead className="w-[27%] text-[11px] font-semibold text-slate-600 uppercase py-2.5">Notes & Reference</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {logs.map((log) => {
                      const isPositive = log.quantity_delta > 0;
                      const isZero = log.quantity_delta === 0;

                      return (
                        <TableRow key={log.id} className="hover:bg-slate-50/60 border-b-slate-100">
                          <TableCell className="font-mono text-[11px] text-slate-500 py-3">
                            {log.created_at ? formatDate(log.created_at) : "-"}
                          </TableCell>
                          <TableCell className="py-3">
                            {getMovementBadge(log.movement_type)}
                          </TableCell>
                          <TableCell className="text-center py-3">
                            {isZero ? (
                              <span className="font-mono text-slate-400 font-bold text-xs">0</span>
                            ) : isPositive ? (
                              <span className="inline-flex items-center gap-0.5 font-bold font-mono text-[#3C8B4F] bg-emerald-50 px-2 py-0.5 rounded text-xs">
                                <TrendingUp className="h-3 w-3" />
                                +{log.quantity_delta}
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-0.5 font-bold font-mono text-rose-600 bg-rose-50 px-2 py-0.5 rounded text-xs">
                                <TrendingDown className="h-3 w-3" />
                                {log.quantity_delta}
                              </span>
                            )}
                          </TableCell>
                          <TableCell className="text-center py-3 font-mono text-slate-700">
                            <span className="text-slate-400">{log.balance_before}</span>
                            <span className="mx-1.5 text-slate-300">&rarr;</span>
                            <span className="font-bold text-slate-900">{log.balance_after}</span>
                          </TableCell>
                          <TableCell className="py-3 text-slate-600 max-w-[200px] truncate" title={log.notes || ""}>
                            {log.notes || (log.reference_id ? `Ref: ${log.reference_id}` : "-")}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>

          <div className="flex justify-end pt-3 border-t border-slate-100 shrink-0">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onClose}
              className="text-xs h-8 px-5 border-slate-200 text-slate-600 hover:bg-slate-50"
            >
              Close Ledger
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {isAdjustModalOpen && (
        <AdjustStockModal
          isOpen={true}
          onClose={() => setIsAdjustModalOpen(false)}
          variant={{ ...variant, stock_quantity: currentStock }}
          productTitle={productTitle}
          onSuccess={handleStockAdjustmentSuccess}
        />
      )}
    </>
  );
}
