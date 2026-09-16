"use client";

import React from "react";
import { Product, CategoryNode, Attribute, Tag } from "@/types/database.types";
import { ProductUploadClient } from "@/components/admin/ProductUploadClient";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

interface ProductEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  product: Product;
  treeNodes?: CategoryNode[];
  availableAttributes?: Attribute[];
  availableTags?: Tag[];
}

export function ProductEditModal({
  isOpen,
  onClose,
  product,
  treeNodes = [],
  availableAttributes,
  availableTags,
}: ProductEditModalProps) {
  const activeAttributes = availableAttributes || availableTags || [];

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-6xl h-[90vh] flex flex-col overflow-hidden p-6 bg-white pr-12">
        <DialogHeader className="pb-3 border-b border-slate-200 shrink-0">
          <DialogTitle className="text-lg font-bold text-slate-900">
            Edit Product: {product.title}
          </DialogTitle>
          <DialogDescription className="text-xs text-slate-500">
            Update descriptions, images, technical documents, and variant matrices.
          </DialogDescription>
        </DialogHeader>

        <div className="pt-4 flex-1 overflow-y-auto pr-2 custom-scrollbar">
          <ProductUploadClient
            treeNodes={treeNodes}
            availableAttributes={activeAttributes}
            availableTags={activeAttributes}
            initialProduct={product}
            mode="edit"
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
