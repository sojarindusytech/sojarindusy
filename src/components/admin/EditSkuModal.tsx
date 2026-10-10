"use client";

import { useState } from "react";
import { updateSingleSku } from "@/actions/product-management";
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
import { ProductVariant } from "@/types/database.types";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { GstRateSelect } from "./GstRateSelect";
import { normalizeHsn } from "@/lib/invoice";

interface EditSkuModalProps {
  isOpen: boolean;
  onClose: () => void;
  variant: ProductVariant;
  availableAttributes?: { id: string; name: string }[];
  availableTags?: { id: string; name: string }[];
}

export function EditSkuModal({ isOpen, onClose, variant, availableAttributes, availableTags }: EditSkuModalProps) {
  const activeAttributes = availableAttributes || availableTags || [];
  const [sku, setSku] = useState(variant.sku);
  const [diameter, setDiameter] = useState(variant.diameter?.toString() || "");
  const [fluteLength, setFluteLength] = useState(variant.flute_length?.toString() || "");
  const [overallLength, setOverallLength] = useState(variant.overall_length?.toString() || "");
  const [shankDiameter, setShankDiameter] = useState(variant.shank_diameter?.toString() || "");
  const [listPrice, setListPrice] = useState(variant.list_price.toString());
  const [stockQuantity, setStockQuantity] = useState(variant.stock_quantity.toString());
  const [minQuantity, setMinQuantity] = useState((variant.min_quantity ?? 0).toString());
  const [triggerQuantity, setTriggerQuantity] = useState((variant.trigger_quantity ?? 0).toString());
  const [minOrderQuantity, setMinOrderQuantity] = useState((variant.min_order_quantity ?? 1).toString());
  // "" = no SKU-level GST %, use the Sales Settings default.
  const [gstRate, setGstRate] = useState(variant.gst_rate == null ? "" : String(variant.gst_rate));
  const [hsnCode, setHsnCode] = useState(variant.hsn_code ?? "");
  const initialAttr = (variant.specifications as any)?.Attribute || (variant.specifications as any)?.Tag || "none";
  const [selectedAttributeName, setSelectedAttributeName] = useState<string>(initialAttr);
  
  const initialSpecs = (variant.specifications as Record<string, any>) || {};
  const [customSpecs, setCustomSpecs] = useState<Record<string, string>>(() => {
    const specs: Record<string, string> = {};
    Object.entries(initialSpecs).forEach(([k, v]) => {
      if (k !== "Attribute" && k !== "Tag" && k !== "ShortDescription") {
        specs[k] = v != null ? String(v) : "";
      }
    });
    return specs;
  });

  const [isLoading, setIsLoading] = useState(false);

  // Auto-ordering computes order size as min_quantity - trigger_quantity, so a
  // min at or below the trigger silently disables ordering for this SKU. Both
  // fields are in this form, so block the save rather than storing dead config.
  const triggerMisconfigured =
    Number(triggerQuantity) > 0 && Number(minQuantity) <= Number(triggerQuantity);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sku.trim()) {
      toast.error("SKU Code is required.");
      return;
    }

    if (triggerMisconfigured) {
      toast.error("Minimum SKU Quantity must be greater than Trigger Quantity.");
      return;
    }

    if (!normalizeHsn(hsnCode).ok) {
      toast.error("HSN code must be 4 to 8 digits.");
      return;
    }

    setIsLoading(true);
    
    const specs = { ...customSpecs } as any;
    if (selectedAttributeName && selectedAttributeName !== "none") {
      specs.Attribute = selectedAttributeName;
      specs.Tag = selectedAttributeName; // backward compatibility
    } else {
      delete specs.Attribute;
      delete specs.Tag;
    }

    const result = await updateSingleSku(variant.id, {
      sku,
      diameter: diameter ? parseFloat(diameter) : null,
      flute_length: fluteLength ? parseFloat(fluteLength) : null,
      overall_length: overallLength ? parseFloat(overallLength) : null,
      shank_diameter: shankDiameter ? parseFloat(shankDiameter) : null,
      list_price: parseFloat(listPrice) || 0,
      stock_quantity: parseInt(stockQuantity, 10) || 0,
      min_quantity: Math.max(0, parseInt(minQuantity, 10) || 0),
      trigger_quantity: Math.max(0, parseInt(triggerQuantity, 10) || 0),
      min_order_quantity: Math.max(1, parseInt(minOrderQuantity, 10) || 1),
      gst_rate: gstRate === "" ? null : Number(gstRate),
      hsn_code: hsnCode.trim() || null,
      specifications: specs,
    });
    setIsLoading(false);

    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success("SKU updated successfully.");
      onClose();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl bg-white p-4 sm:p-6">
        <DialogHeader className="pb-3 border-b border-slate-200">
          <DialogTitle className="text-xl font-bold text-slate-900">
            Edit SKU
          </DialogTitle>
          <DialogDescription className="text-xs text-slate-500">
            Update the variant details for {variant.sku}.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-700">SKU Code <span className="text-red-500">*</span></Label>
              <Input
                value={sku}
                onChange={(e) => setSku(e.target.value)}
                className="h-9 text-xs border-slate-200"
                required
              />
            </div>
            {activeAttributes && activeAttributes.length > 0 && (
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-700">Attribute Assignment</Label>
                <Select value={selectedAttributeName} onValueChange={setSelectedAttributeName}>
                  <SelectTrigger className="h-9 text-xs border-slate-200">
                    <SelectValue placeholder="Select Attribute" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none" className="text-xs italic text-slate-400">-- No Attribute --</SelectItem>
                    {activeAttributes.map((t) => (
                      <SelectItem key={t.id} value={t.name} className="text-xs font-medium">{t.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-700">Diameter (D)</Label>
              <Input
                type="number"
                step="0.01"
                value={diameter}
                onChange={(e) => setDiameter(e.target.value)}
                className="h-9 text-xs border-slate-200"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-700">Flute Length (H)</Label>
              <Input
                type="number"
                step="0.01"
                value={fluteLength}
                onChange={(e) => setFluteLength(e.target.value)}
                className="h-9 text-xs border-slate-200"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-700">Overall Length (L)</Label>
              <Input
                type="number"
                step="0.01"
                value={overallLength}
                onChange={(e) => setOverallLength(e.target.value)}
                className="h-9 text-xs border-slate-200"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-700">Shank Dia (D2)</Label>
              <Input
                type="number"
                step="0.01"
                value={shankDiameter}
                onChange={(e) => setShankDiameter(e.target.value)}
                className="h-9 text-xs border-slate-200"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-700 whitespace-nowrap">List Price (₹)</Label>
              <Input
                type="number"
                step="0.01"
                value={listPrice}
                onChange={(e) => setListPrice(e.target.value)}
                className="h-9 text-xs border-slate-200"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-700 whitespace-nowrap">Stock Quantity</Label>
              <Input
                type="number"
                value={stockQuantity}
                onChange={(e) => setStockQuantity(e.target.value)}
                className="h-9 text-xs border-slate-200"
              />
            </div>
          </div>

          {/* Tax: used on invoices. Blank GST % falls back to the Sales Settings default. */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-700 whitespace-nowrap">GST %</Label>
              <GstRateSelect value={gstRate} onChange={setGstRate} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-700 whitespace-nowrap">HSN Code</Label>
              <Input
                inputMode="numeric"
                maxLength={8}
                value={hsnCode}
                onChange={(e) => setHsnCode(e.target.value.replace(/\D/g, ""))}
                placeholder="e.g. 82090010"
                className="h-9 text-xs border-slate-200"
              />
            </div>
          </div>

          {/* The three quantity settings share a row so they read as one group. */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-700 whitespace-nowrap">Minimum SKU Quantity</Label>
              <Input
                type="number"
                min="0"
                step="1"
                value={minQuantity}
                onChange={(e) => setMinQuantity(e.target.value)}
                placeholder="0"
                className="h-9 text-xs border-slate-200"
              />
              <p className="text-[10px] text-slate-400 leading-tight">Restock target level</p>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-700 whitespace-nowrap">Trigger Quantity</Label>
              <Input
                type="number"
                min="0"
                step="1"
                value={triggerQuantity}
                onChange={(e) => setTriggerQuantity(e.target.value)}
                placeholder="0"
                className="h-9 text-xs border-slate-200"
              />
              <p className="text-[10px] text-slate-400 leading-tight">Auto-order fires at or below this. 0 = off</p>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-700 whitespace-nowrap">Minimum Order Quantity</Label>
              <Input
                type="number"
                min="1"
                step="1"
                value={minOrderQuantity}
                onChange={(e) => setMinOrderQuantity(e.target.value)}
                placeholder="1"
                className="h-9 text-xs border-slate-200"
              />
              <p className="text-[10px] text-slate-400 leading-tight">Customer&apos;s minimum purchase quantity. Defaults to 1.</p>
            </div>
          </div>

          {triggerMisconfigured ? (
            <p className="text-[11px] text-red-600" role="alert">
              Minimum SKU Quantity must be greater than Trigger Quantity, otherwise
              auto-ordering cannot work for this SKU.
            </p>
          ) : null}

          {/* Dynamic Specifications (if present from CSV) */}
          {Object.keys(customSpecs).length > 0 && (
            <div className="pt-2 border-t border-slate-100">
              <Label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-2">
                Additional Specifications
              </Label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {Object.entries(customSpecs).map(([key, val]) => (
                  <div key={key} className="space-y-1.5">
                    <Label className="text-xs font-semibold text-slate-700 capitalize">{key}</Label>
                    <Input
                      type="text"
                      value={val}
                      onChange={(e) => setCustomSpecs(prev => ({ ...prev, [key]: e.target.value }))}
                      className="h-9 text-xs border-slate-200"
                    />
                  </div>
                ))}
              </div>
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
              disabled={isLoading || triggerMisconfigured}
              className="h-9 text-xs shadow-none bg-[#024AE5] hover:bg-[#024AE5]/90 text-white px-6"
            >
              {isLoading && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
              Save Changes
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
