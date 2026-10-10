"use client";

import { useState } from "react";
import { bulkUpdateSkus } from "@/actions/product-management";
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
import { Loader2 } from "lucide-react";
import toast from "react-hot-toast";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { GstRateSelect } from "./GstRateSelect";
import { normalizeHsn } from "@/lib/invoice";

interface BulkUpdateModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedVariantIds: string[];
  onSuccess: () => void;
}

/**
 * The three per-SKU quantity fields share one input and one code path -- they
 * differ only by label and helper text.
 */
type QuantityField = "min_quantity" | "trigger_quantity" | "min_order_quantity";

const QUANTITY_FIELDS: Record<QuantityField, { label: string; hint: string; min: number }> = {
  min_quantity: {
    label: "Minimum SKU Quantity",
    hint: "Target stock level the auto purchase order restocks up to.",
    min: 0,
  },
  trigger_quantity: {
    label: "Trigger Quantity",
    hint: "Auto purchase order fires when stock falls to or below this. 0 disables auto-ordering.",
    min: 0,
  },
  min_order_quantity: {
    label: "Minimum Order Quantity",
    hint: "Customers must purchase at least this many units. Minimum and default is 1.",
    // A customer cannot order zero units, so this field floors at 1.
    min: 1,
  },
};

const isQuantityField = (f: string): f is QuantityField => f in QUANTITY_FIELDS;

export function BulkUpdateModal({ isOpen, onClose, selectedVariantIds, onSuccess }: BulkUpdateModalProps) {
  const [fieldToUpdate, setFieldToUpdate] = useState<QuantityField | "list_price" | "stock_quantity" | "list_price_percentage" | "gst_rate" | "hsn_code">("list_price");
  const [listPrice, setListPrice] = useState("");
  const [stockQuantity, setStockQuantity] = useState("");
  const [minQuantity, setMinQuantity] = useState("0");
  const [listPricePercentage, setListPricePercentage] = useState("");
  // "" = clear the SKU-level GST % so it falls back to the Sales Settings default.
  const [gstRate, setGstRate] = useState("18");
  const [hsnCode, setHsnCode] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (fieldToUpdate === "list_price" && listPrice.trim() === "") {
      toast.error("Please enter a new List Price.");
      return;
    }
    if (fieldToUpdate === "stock_quantity" && stockQuantity.trim() === "") {
      toast.error("Please enter a new Stock Quantity.");
      return;
    }
    if (isQuantityField(fieldToUpdate) && minQuantity.trim() === "") {
      toast.error(`Please enter a ${QUANTITY_FIELDS[fieldToUpdate].label}.`);
      return;
    }
    if (fieldToUpdate === "list_price_percentage" && listPricePercentage.trim() === "") {
      toast.error("Please enter a percentage upgrade.");
      return;
    }

    if (fieldToUpdate === "hsn_code" && !normalizeHsn(hsnCode).ok) {
      toast.error("HSN code must be 4 to 8 digits.");
      return;
    }

    setIsLoading(true);
    
    const updates: any = {};
    if (fieldToUpdate === "list_price") {
      updates.list_price = parseFloat(listPrice);
    } else if (fieldToUpdate === "stock_quantity") {
      updates.stock_quantity = parseInt(stockQuantity, 10);
    } else if (isQuantityField(fieldToUpdate)) {
      const floor = QUANTITY_FIELDS[fieldToUpdate].min;
      updates[fieldToUpdate] = Math.max(floor, parseInt(minQuantity, 10) || floor);
    } else if (fieldToUpdate === "list_price_percentage") {
      updates.list_price_percentage = parseFloat(listPricePercentage);
    } else if (fieldToUpdate === "gst_rate") {
      updates.gst_rate = gstRate === "" ? null : Number(gstRate);
    } else if (fieldToUpdate === "hsn_code") {
      updates.hsn_code = hsnCode.trim() || null;
    }

    const result = await bulkUpdateSkus(selectedVariantIds, updates);
    setIsLoading(false);

    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success(`Successfully updated ${selectedVariantIds.length} SKUs.`);
      setListPrice("");
      setStockQuantity("");
      setMinQuantity("0");
      setListPricePercentage("");
      setHsnCode("");
      onSuccess();
      onClose();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-sm bg-white p-6">
        <DialogHeader className="pb-3 border-b border-slate-200">
          <DialogTitle className="text-xl font-bold text-slate-900">
            Bulk Update SKUs
          </DialogTitle>
          <DialogDescription className="text-xs text-slate-500">
            Updating {selectedVariantIds.length} selected SKUs.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-4">
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-slate-700">Field to Update</Label>
            <Select value={fieldToUpdate} onValueChange={(v: any) => setFieldToUpdate(v)}>
              <SelectTrigger className="h-9 text-xs border-slate-200">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="list_price" className="text-xs">List Price (Fixed)</SelectItem>
                <SelectItem value="list_price_percentage" className="text-xs">List Price (% Upgrade)</SelectItem>
                <SelectItem value="stock_quantity" className="text-xs">Stock Quantity</SelectItem>
                <SelectItem value="min_quantity" className="text-xs">Minimum SKU Quantity</SelectItem>
                <SelectItem value="trigger_quantity" className="text-xs">Trigger Quantity</SelectItem>
                <SelectItem value="min_order_quantity" className="text-xs">Minimum Order Quantity</SelectItem>
                <SelectItem value="gst_rate" className="text-xs">GST %</SelectItem>
                <SelectItem value="hsn_code" className="text-xs">HSN Code</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {fieldToUpdate === "list_price" ? (
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-700">New List Price (₹) <span className="text-red-500">*</span></Label>
              <Input
                type="number"
                step="0.01"
                value={listPrice}
                onChange={(e) => setListPrice(e.target.value)}
                placeholder="Enter new price"
                className="h-9 text-xs border-slate-200"
                required
              />
            </div>
          ) : fieldToUpdate === "stock_quantity" ? (
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-700">New Stock Quantity <span className="text-red-500">*</span></Label>
              <Input
                type="number"
                value={stockQuantity}
                onChange={(e) => setStockQuantity(e.target.value)}
                placeholder="Enter new stock"
                className="h-9 text-xs border-slate-200"
                required
              />
            </div>
          ) : fieldToUpdate === "gst_rate" ? (
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-700">New GST %</Label>
              <GstRateSelect value={gstRate} onChange={setGstRate} defaultLabel="Clear (use Sales Settings default)" />
              <p className="text-[10px] text-slate-500 leading-tight">
                Applied to every selected SKU and used on new invoices. Existing invoices are not changed.
              </p>
            </div>
          ) : fieldToUpdate === "hsn_code" ? (
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-700">New HSN Code</Label>
              <Input
                inputMode="numeric"
                maxLength={8}
                value={hsnCode}
                onChange={(e) => setHsnCode(e.target.value.replace(/\D/g, ""))}
                placeholder="e.g. 82090010"
                className="h-9 text-xs border-slate-200"
              />
              <p className="text-[10px] text-slate-500 leading-tight">
                4 to 8 digits. Leave blank to clear the HSN code on the selected SKUs.
              </p>
            </div>
          ) : isQuantityField(fieldToUpdate) ? (
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-700">
                New {QUANTITY_FIELDS[fieldToUpdate].label} <span className="text-red-500">*</span>
              </Label>
              <Input
                type="number"
                min={QUANTITY_FIELDS[fieldToUpdate].min}
                step="1"
                value={minQuantity}
                onChange={(e) => setMinQuantity(e.target.value)}
                placeholder={`Enter quantity (minimum ${QUANTITY_FIELDS[fieldToUpdate].min})`}
                className="h-9 text-xs border-slate-200"
                required
              />
              <p className="text-[10px] text-slate-500 leading-tight">
                {QUANTITY_FIELDS[fieldToUpdate].hint}
              </p>
            </div>
          ) : (
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-700">Percentage Increase (%) <span className="text-red-500">*</span></Label>
              <Input
                type="number"
                step="0.01"
                value={listPricePercentage}
                onChange={(e) => setListPricePercentage(e.target.value)}
                placeholder="e.g. 10 for +10% increase"
                className="h-9 text-xs border-slate-200"
                required
              />
              <p className="text-[10px] text-slate-500 leading-tight">
                Positive values increase price (e.g. <code>10</code> adds 10%), negative values decrease price.
              </p>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isLoading}
              className="h-9 text-xs shadow-none border-slate-200 text-slate-600 hover:bg-slate-50"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isLoading}
              className="h-9 text-xs shadow-none bg-[#024AE5] hover:bg-[#024AE5]/90 text-white px-6"
            >
              {isLoading && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
              Apply Update
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
