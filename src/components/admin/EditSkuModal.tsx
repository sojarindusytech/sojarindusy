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

interface EditSkuModalProps {
  isOpen: boolean;
  onClose: () => void;
  variant: ProductVariant;
  availableTags?: { id: string; name: string }[];
}

export function EditSkuModal({ isOpen, onClose, variant, availableTags }: EditSkuModalProps) {
  const [sku, setSku] = useState(variant.sku);
  const [diameter, setDiameter] = useState(variant.diameter?.toString() || "");
  const [fluteLength, setFluteLength] = useState(variant.flute_length?.toString() || "");
  const [overallLength, setOverallLength] = useState(variant.overall_length?.toString() || "");
  const [shankDiameter, setShankDiameter] = useState(variant.shank_diameter?.toString() || "");
  const [listPrice, setListPrice] = useState(variant.list_price.toString());
  const [stockQuantity, setStockQuantity] = useState(variant.stock_quantity.toString());
  const [selectedTagName, setSelectedTagName] = useState<string>((variant.specifications as any)?.Tag || "none");
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sku.trim()) {
      toast.error("SKU Code is required.");
      return;
    }

    setIsLoading(true);
    
    const specs = { ...(variant.specifications as object) || {} } as any;
    if (selectedTagName && selectedTagName !== "none") {
      specs.Tag = selectedTagName;
    } else {
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
      <DialogContent className="max-w-md bg-white p-6">
        <DialogHeader className="pb-3 border-b border-slate-200">
          <DialogTitle className="text-xl font-bold text-slate-900">
            Edit SKU
          </DialogTitle>
          <DialogDescription className="text-xs text-slate-500">
            Update the variant details for {variant.sku}.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-700">SKU Code <span className="text-red-500">*</span></Label>
              <Input
                value={sku}
                onChange={(e) => setSku(e.target.value)}
                className="h-9 text-xs border-slate-200"
                required
              />
            </div>
            {availableTags && availableTags.length > 0 && (
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-700">Tag Assignment</Label>
                <Select value={selectedTagName} onValueChange={setSelectedTagName}>
                  <SelectTrigger className="h-9 text-xs border-slate-200">
                    <SelectValue placeholder="Select Tag" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none" className="text-xs italic text-slate-400">-- No Tag --</SelectItem>
                    {availableTags.map((t) => (
                      <SelectItem key={t.id} value={t.name} className="text-xs font-medium">{t.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
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

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-700">List Price (₹)</Label>
              <Input
                type="number"
                step="0.01"
                value={listPrice}
                onChange={(e) => setListPrice(e.target.value)}
                className="h-9 text-xs border-slate-200"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-700">Stock Quantity</Label>
              <Input
                type="number"
                value={stockQuantity}
                onChange={(e) => setStockQuantity(e.target.value)}
                className="h-9 text-xs border-slate-200"
              />
            </div>
          </div>

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
              Save Changes
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
