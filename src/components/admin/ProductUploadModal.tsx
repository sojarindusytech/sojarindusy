"use client";

import { CategoryNode, Tag } from "@/types/database.types";
import { ProductUploadClient } from "@/components/admin/ProductUploadClient";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

interface ProductUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  treeNodes: CategoryNode[];
  availableTags: Tag[];
}

export function ProductUploadModal({
  isOpen,
  onClose,
  treeNodes,
  availableTags,
}: ProductUploadModalProps) {
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-6xl h-[90vh] flex flex-col overflow-hidden p-6 bg-white">
        <DialogHeader className="pb-3 border-b border-slate-200 shrink-0">
          <DialogTitle className="text-xl font-bold text-slate-900">
            Add New Product & Import SKUs
          </DialogTitle>
          <DialogDescription className="text-xs text-slate-500">
            Define Product Family metadata, multi-image titles, category hierarchy, and bulk import SKU variant matrix.
          </DialogDescription>
        </DialogHeader>

        <div className="pt-4 flex-1 overflow-y-auto pr-2 custom-scrollbar">
          <ProductUploadClient
            treeNodes={treeNodes}
            availableTags={availableTags}
            hideHeader={true}
            onSuccessComplete={() => {
              onClose();
            }}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
