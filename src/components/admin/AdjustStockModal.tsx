"use client";

import { useState } from "react";
import { ProductVariant } from "@/types/database.types";
import { adjustVariantStock } from "@/actions/inventory";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Plus,
  Minus,
  Equal,
  Loader2,
  TrendingUp,
  TrendingDown,
  Package,
  CheckCircle2,
} from "lucide-react";
import toast from "react-hot-toast";

interface AdjustStockModalProps {
  isOpen: boolean;
  onClose: () => void;
  variant: ProductVariant;
  productTitle?: string;
  onSuccess?: (newStock: number) => void;
}

const STOCK_REASONS = [
  "Received Supplier Shipment",
  "Physical Count / Cycle Count Audit",
  "Damaged / Defective Stock Scrapped",
  "Customer Return Restocked",
  "Internal Transfer / Demo Sample",
  "Data Correction",
  "Other",
];

export function AdjustStockModal({
  isOpen,
  onClose,
  variant,
  productTitle = "Product",
  onSuccess,
}: AdjustStockModalProps) {
  const currentStock = Number(variant.stock_quantity) || 0;
  const [mode, setMode] = useState<"ADD" | "SUBTRACT" | "SET">("ADD");
  const [quantity, setQuantity] = useState<string>("");
  const [reason, setReason] = useState<string>(STOCK_REASONS[0]);
  const [referenceId, setReferenceId] = useState<string>("");
  const [notes, setNotes] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);

  // Compute live preview stock
  const numericQty = Math.max(0, parseInt(quantity, 10) || 0);
  let newStock = currentStock;
  let delta = 0;

  if (mode === "ADD") {
    newStock = currentStock + numericQty;
    delta = numericQty;
  } else if (mode === "SUBTRACT") {
    newStock = Math.max(0, currentStock - numericQty);
    delta = -(currentStock - newStock);
  } else if (mode === "SET") {
    newStock = numericQty;
    delta = newStock - currentStock;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!quantity || isNaN(numericQty) || numericQty < 0) {
      toast.error("Please enter a valid quantity.");
      return;
    }

    if (delta === 0) {
      toast.error("Adjustment results in no stock change.");
      return;
    }

    setIsLoading(true);
    const result = await adjustVariantStock({
      variantId: variant.id,
      mode,
      quantity: numericQty,
      reason,
      referenceId: referenceId.trim() || undefined,
      notes: notes.trim() || undefined,
    });
    setIsLoading(false);

    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success(
        `Stock updated to ${result.updatedStock ?? newStock} units.`
      );
      if (onSuccess && result.updatedStock !== undefined) {
        onSuccess(result.updatedStock);
      }
      onClose();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl bg-white p-6">
        <DialogHeader className="pb-3 border-b border-slate-100">
          <div className="flex items-center justify-between pr-6">
            <div>
              <DialogTitle className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <Package className="h-5 w-5 text-[#024AE5]" />
                Adjust Stock Quantity
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-500 mt-0.5">
                SKU: <span className="font-mono font-bold text-slate-900">{variant.sku}</span>
              </DialogDescription>
            </div>
            <div className="text-right">
              <span className="text-[10px] uppercase font-semibold text-slate-400 block leading-tight">Current Stock</span>
              <span className="text-base font-bold text-slate-800 leading-tight">{currentStock} Units</span>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          {/* Mode Selector */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-slate-700">Adjustment Mode</Label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setMode("ADD")}
                className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg border text-xs font-semibold transition-all cursor-pointer ${
                  mode === "ADD"
                    ? "bg-emerald-50 border-[#3C8B4F] text-[#3C8B4F] ring-1 ring-[#3C8B4F]"
                    : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
                }`}
              >
                <Plus className="h-3.5 w-3.5" />
                Add Stock (+)
              </button>
              <button
                type="button"
                onClick={() => setMode("SUBTRACT")}
                className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg border text-xs font-semibold transition-all cursor-pointer ${
                  mode === "SUBTRACT"
                    ? "bg-rose-50 border-rose-500 text-rose-700 ring-1 ring-rose-500"
                    : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
                }`}
              >
                <Minus className="h-3.5 w-3.5" />
                Subtract Stock (-)
              </button>
              <button
                type="button"
                onClick={() => setMode("SET")}
                className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg border text-xs font-semibold transition-all cursor-pointer ${
                  mode === "SET"
                    ? "bg-blue-50 border-[#024AE5] text-[#024AE5] ring-1 ring-[#024AE5]"
                    : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
                }`}
              >
                <Equal className="h-3.5 w-3.5" />
                Set Total (=)
              </button>
            </div>
          </div>

          {/* Row 1: Quantity Input + Live Calculation Preview Side-by-Side */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 items-end">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-700">
                {mode === "ADD"
                  ? "Units to Add (+)"
                  : mode === "SUBTRACT"
                  ? "Units to Deduct (-)"
                  : "New Total Stock (=)"}{" "}
                <span className="text-red-500">*</span>
              </Label>
              <Input
                type="number"
                min="0"
                placeholder={mode === "SET" ? "e.g. 150" : "e.g. 25"}
                value={quantity}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setQuantity(e.target.value)}
                className="h-9 text-xs border-slate-200 focus-visible:ring-[#024AE5]"
                required
                autoFocus
              />
            </div>

            {/* Live Preview Box */}
            <div className="bg-slate-50 border border-slate-200/80 rounded-lg h-9 px-3 flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-slate-400">Result:</span>
                <div className="font-mono font-bold text-slate-800 flex items-center gap-1.5">
                  <span className="text-slate-500">{currentStock}</span>
                  <span className="text-slate-300">&rarr;</span>
                  <span className="text-slate-900 font-bold">{newStock} Units</span>
                </div>
              </div>
              <div>
                {delta > 0 ? (
                  <span className="inline-flex items-center gap-0.5 font-bold font-mono text-[#3C8B4F] text-[11px] bg-emerald-50 px-1.5 py-0.5 rounded">
                    <TrendingUp className="h-3 w-3" />
                    +{delta}
                  </span>
                ) : delta < 0 ? (
                  <span className="inline-flex items-center gap-0.5 font-bold font-mono text-rose-600 text-[11px] bg-rose-50 px-1.5 py-0.5 rounded">
                    <TrendingDown className="h-3 w-3" />
                    {delta}
                  </span>
                ) : (
                  <span className="font-mono text-slate-400 font-bold text-[11px]">0</span>
                )}
              </div>
            </div>
          </div>

          {/* Row 2: Reason Dropdown + Reference/PO# Side-by-Side */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-700">Reason for Adjustment</Label>
              <Select value={reason} onValueChange={setReason}>
                <SelectTrigger className="h-9 text-xs border-slate-200 bg-white">
                  <SelectValue placeholder="Select reason" />
                </SelectTrigger>
                <SelectContent className="bg-white">
                  {STOCK_REASONS.map((r) => (
                    <SelectItem key={r} value={r} className="text-xs">
                      {r}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-700">
                Reference / PO # <span className="text-[10px] text-slate-400 font-normal">(Optional)</span>
              </Label>
              <Input
                placeholder="e.g. PO-2026-0819 or BATCH-44"
                value={referenceId}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setReferenceId(e.target.value)}
                className="h-9 text-xs border-slate-200 focus-visible:ring-[#024AE5]"
              />
            </div>
          </div>

          {/* Row 3: Additional Notes */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-slate-700">
              Additional Notes <span className="text-[10px] text-slate-400 font-normal">(Optional)</span>
            </Label>
            <Textarea
              placeholder="Explain any specifics regarding this count or adjustment..."
              value={notes}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setNotes(e.target.value)}
              rows={2}
              className="text-xs border-slate-200 resize-none min-h-[50px] focus-visible:ring-[#024AE5]"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onClose}
              className="text-xs h-8 px-4 border-slate-200 text-slate-600 hover:bg-slate-50"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isLoading || !quantity || delta === 0}
              className="text-xs h-8 px-5 bg-[#024AE5] hover:bg-[#023bb8] text-white font-semibold flex items-center gap-1.5 cursor-pointer shadow-xs"
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Apply Adjustment
                </>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
