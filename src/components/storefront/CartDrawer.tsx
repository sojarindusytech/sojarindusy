"use client";

import { useCart } from "@/context/CartContext";
import { Button } from "@/components/ui/button";
import {
  ShoppingBag,
  X,
  Plus,
  Minus,
  Trash2,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  FileDown,
  Printer,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { generateQuotePdf } from "@/lib/generateQuotePdf";
import toast from "react-hot-toast";

export function CartDrawer() {
  const {
    items,
    removeItem,
    updateQuantity,
    subtotal,
    gstAmount,
    totalAmount,
    itemCount,
    isCartOpen,
    setIsCartOpen,
  } = useCart();
  const router = useRouter();

  if (!isCartOpen) return null;

  const handleDownloadQuote = () => {
    if (items.length === 0) {
      toast.error("Cart is empty. Add items to generate a quotation.");
      return;
    }
    generateQuotePdf(items, { subtotal, gstAmount, totalAmount });
    toast.success("Generating official Commercial Price Quotation PDF...");
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/40 backdrop-blur-xs transition-opacity animate-in fade-in duration-200">
      {/* Backdrop click to close */}
      <div className="flex-1" onClick={() => setIsCartOpen(false)} />

      {/* Drawer Container */}
      <div className="w-full max-w-md bg-white h-full shadow-2xl flex flex-col border-l border-slate-200 animate-in slide-in-from-right duration-300">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-2">
            <ShoppingBag className="h-5 w-5 text-[#024AE5]" />
            <h2 className="font-bold text-slate-900 text-base">Industrial Cart</h2>
            <span className="text-xs bg-[#024AE5]/10 text-[#024AE5] font-bold px-2 py-0.5 rounded-full">
              {itemCount} {itemCount === 1 ? "Item" : "Items"}
            </span>
          </div>
          <button
            onClick={() => setIsCartOpen(false)}
            className="h-8 w-8 rounded-full hover:bg-slate-200/60 flex items-center justify-center text-slate-500 hover:text-slate-900 transition-colors cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Cart Items List */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3.5 divide-y divide-slate-100">
          {items.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center py-16">
              <div className="h-16 w-16 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 mb-4">
                <ShoppingBag className="h-8 w-8" />
              </div>
              <h3 className="font-bold text-slate-800 text-base mb-1">Your cart is empty</h3>
              <p className="text-xs text-slate-500 max-w-xs mb-6">
                Browse our industrial tooling catalog and add required SKUs to place an order or download a quotation.
              </p>
              <Button
                onClick={() => {
                  setIsCartOpen(false);
                  router.push("/products");
                }}
                className="bg-[#024AE5] hover:bg-[#024AE5]/90 text-white text-xs h-9 shadow-none cursor-pointer"
              >
                Browse Catalog
              </Button>
            </div>
          ) : (
            items.map((item) => {
              // Extract specs summary
              const specBadges: string[] = [];
              if (item.specifications) {
                Object.entries(item.specifications).forEach(([k, v]) => {
                  if (v && k !== "ShortDescription" && k !== "Tag") {
                    specBadges.push(`${k}: ${v}`);
                  }
                });
              }

              return (
                <div key={item.variantId} className="pt-3.5 first:pt-0 flex gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <h4 className="font-bold text-xs text-slate-900 truncate">
                          {item.title}
                        </h4>
                        <p className="font-mono text-[11px] font-bold text-[#024AE5] mt-0.5">
                          {item.sku}
                        </p>
                        {specBadges.length > 0 && (
                          <p className="text-[10px] text-slate-500 mt-1 line-clamp-2 leading-relaxed">
                            {specBadges.join(" • ")}
                          </p>
                        )}
                      </div>
                      <button
                        onClick={() => removeItem(item.variantId)}
                        className="text-slate-400 hover:text-rose-600 transition-colors p-1 rounded cursor-pointer shrink-0"
                        title="Remove item"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>

                    {/* Quantity and Price */}
                    <div className="flex items-center justify-between mt-3">
                      <div className="flex items-center border border-slate-200 rounded-lg bg-slate-50/60 p-0.5">
                        <button
                          onClick={() => updateQuantity(item.variantId, item.quantity - 1)}
                          className="h-6 w-6 rounded flex items-center justify-center text-slate-600 hover:bg-white hover:shadow-xs transition-all cursor-pointer"
                        >
                          <Minus className="h-3 w-3" />
                        </button>
                        <span className="w-9 text-center font-bold text-xs text-slate-800">
                          {item.quantity}
                        </span>
                        <button
                          onClick={() => updateQuantity(item.variantId, item.quantity + 1)}
                          className="h-6 w-6 rounded flex items-center justify-center text-slate-600 hover:bg-white hover:shadow-xs transition-all cursor-pointer"
                        >
                          <Plus className="h-3 w-3" />
                        </button>
                      </div>

                      <div className="text-right">
                        <div className="text-xs font-bold text-slate-900 font-mono">
                          ₹{(item.unitPrice * item.quantity).toFixed(2)}
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono">
                          ₹{item.unitPrice.toFixed(2)} / unit
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer & Actions */}
        {items.length > 0 && (
          <div className="p-4 sm:p-5 border-t border-slate-100 bg-slate-50/70 space-y-3">
            <div className="space-y-1.5 text-xs">
              <div className="flex items-center justify-between text-slate-600">
                <span>Subtotal (Excl. Tax)</span>
                <span className="font-mono font-medium">₹{subtotal.toFixed(2)}</span>
              </div>
              <div className="flex items-center justify-between text-slate-600">
                <span>Standard GST (18%)</span>
                <span className="font-mono font-medium">₹{gstAmount.toFixed(2)}</span>
              </div>
              <div className="flex items-center justify-between text-sm font-bold text-slate-900 pt-1.5 border-t border-slate-200">
                <span>Total Amount</span>
                <span className="font-mono text-[#024AE5]">₹{totalAmount.toFixed(2)}</span>
              </div>
            </div>

            {/* Action Buttons: Download Quote + Proceed to Checkout */}
            <div className="space-y-2 pt-1">
              <Button
                type="button"
                variant="outline"
                onClick={handleDownloadQuote}
                className="w-full h-9.5 text-xs font-bold border-slate-300 text-slate-800 hover:text-[#024AE5] hover:border-blue-300 hover:bg-blue-50/50 shadow-none gap-2 cursor-pointer transition-colors"
              >
                <FileDown className="h-4 w-4 text-[#024AE5]" />
                <span>Download as Quote (PDF)</span>
              </Button>

              <Button
                onClick={() => {
                  setIsCartOpen(false);
                  router.push("/checkout");
                }}
                className="w-full bg-[#024AE5] hover:bg-[#024AE5]/90 text-white font-bold text-xs h-10 shadow-none gap-2 cursor-pointer"
              >
                <span>Proceed to Checkout</span>
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>

            <div className="flex items-center justify-center gap-4 text-[10px] text-slate-500 pt-1">
              <span className="flex items-center gap-1">
                <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" /> GST Invoiced
              </span>
              <span className="flex items-center gap-1">
                <CheckCircle2 className="h-3.5 w-3.5 text-blue-600" /> Direct Factory Dispatch
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
