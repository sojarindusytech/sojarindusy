"use client";

import { useState, useEffect } from "react";
import { Product } from "@/types/database.types";
import { updateProductMetadata } from "@/actions/product-management";
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

interface ProductEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  product: Product;
}

export function ProductEditModal({ isOpen, onClose, product }: ProductEditModalProps) {
  const [title, setTitle] = useState(product.title);
  const [shortDescMap, setShortDescMap] = useState<Record<string, string>>({});
  const [desc, setDesc] = useState(product.description || "");
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    try {
      if (product.short_description) {
        if (product.short_description.trim().startsWith("{")) {
          const parsed = JSON.parse(product.short_description);
          if (typeof parsed === 'object' && parsed !== null) {
            setShortDescMap(parsed);
            return;
          }
        } else {
          setShortDescMap({ "global": product.short_description });
          return;
        }
      }
    } catch (e) {
      console.warn("Could not parse short_description as JSON", e);
    }
    setShortDescMap({});
  }, [product.short_description]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      toast.error("Product title is required.");
      return;
    }

    setIsLoading(true);
    const result = await updateProductMetadata(product.id, {
      title,
      short_description: Object.keys(shortDescMap).length > 0 ? JSON.stringify(shortDescMap) : "",
      description: desc,
    });
    setIsLoading(false);

    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success("Product metadata updated successfully.");
      onClose();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl bg-white p-6">
        <DialogHeader className="pb-3 border-b border-slate-200">
          <DialogTitle className="text-xl font-bold text-slate-900">
            Edit Product Metadata
          </DialogTitle>
          <DialogDescription className="text-xs text-slate-500">
            Update the core information for this product family.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-4">
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-slate-700">Product Title <span className="text-red-500">*</span></Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Solid Carbide End Mill"
              className="h-9 text-xs border-slate-200"
              required
            />
          </div>

          {product.tags && product.tags.length > 0 ? (
            <div className="space-y-3">
              <Label className="text-xs font-semibold text-slate-700">Short Descriptions (by Tag)</Label>
              {product.tags.map((tag) => (
                <div key={tag.id} className="space-y-1.5 pl-3 border-l-2 border-slate-100">
                  <Label className="text-[10px] uppercase font-bold text-[#024AE5]">{tag.name}</Label>
                  <textarea
                    value={shortDescMap[tag.id] || ""}
                    onChange={(e) => setShortDescMap(prev => ({ ...prev, [tag.id]: e.target.value }))}
                    placeholder={`Summary for ${tag.name}...`}
                    className="flex w-full rounded-md border border-slate-200 bg-transparent px-3 py-2 text-xs shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 h-20 resize-none"
                  />
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-700">Short Description</Label>
              <textarea
                value={shortDescMap["global"] || ""}
                onChange={(e) => setShortDescMap(prev => ({ ...prev, ["global"]: e.target.value }))}
                placeholder="A brief summary..."
                className="flex w-full rounded-md border border-slate-200 bg-transparent px-3 py-2 text-xs shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 h-20 resize-none"
              />
            </div>
          )}

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-slate-700">Detailed Description</Label>
            <textarea
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              placeholder="Full product description..."
              className="flex w-full rounded-md border border-slate-200 bg-transparent px-3 py-2 text-xs shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 h-32 resize-none"
            />
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
