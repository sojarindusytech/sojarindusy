"use client";

import { useEffect, useState, useTransition } from "react";
import toast from "react-hot-toast";
import { Search } from "lucide-react";
import { createManualPurchaseOrder, getPoManufacturerOptions } from "@/actions/purchase-order";
import { type InvoiceSkuHit } from "@/actions/invoice";
import { useSkuSearch } from "@/components/admin/useSkuSearch";
import { SkuSearchStatus } from "@/components/admin/SkuSearchStatus";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";

/** Create a purchase order by hand. The parent mounts it only while open. */
export function PurchaseOrderFormModal({ onOpenChange, onCreated }: { onOpenChange: (open: boolean) => void; onCreated: () => void }) {
  const [pending, startTransition] = useTransition();
  const [query, setQuery] = useState("");
  const [sku, setSku] = useState<InvoiceSkuHit | null>(null);
  const [quantity, setQuantity] = useState("");
  const [notes, setNotes] = useState("");
  const [manual, setManual] = useState(false);
  const [manualNumber, setManualNumber] = useState("");
  const [manufacturers, setManufacturers] = useState<{ id: string; name: string }[]>([]);
  // "" = no one in particular. Starts at the Sales Settings default once that has loaded.
  const [manufacturerId, setManufacturerId] = useState("");
  const [optionsReady, setOptionsReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getPoManufacturerOptions().then((o) => {
      if (cancelled) return;
      setManufacturers(o.manufacturers);
      setManufacturerId(o.defaultId ?? "");
      setOptionsReady(true);
    });
    return () => { cancelled = true; };
  }, []);

  const { hits: visibleHits, loading: skuLoading } = useSkuSearch(query);

  const submit = () => {
    if (!sku) return void toast.error("Select a SKU.");
    startTransition(async () => {
      const res = await createManualPurchaseOrder({
        variantId: sku.id,
        quantity: Number(quantity),
        notes,
        manualNumber: manual ? manualNumber : null,
        manufacturerId: manufacturerId || null,
      });
      if (res.success && res.order) {
        toast.success(`Purchase order ${res.order.order_number} created.`);
        onCreated();
      } else {
        toast.error(res.error || "Failed to create purchase order.");
      }
    });
  };

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>New Purchase Order</DialogTitle>
          <DialogDescription>Order stock from the manufacturer by hand, outside the automatic low-stock trigger.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>SKU</Label>
            {sku ? (
              <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs">
                <span><span className="font-bold text-slate-900">{sku.sku}</span><span className="text-slate-500"> · {sku.title}</span></span>
                <button type="button" className="text-[#024AE5] font-semibold" onClick={() => { setSku(null); setQuery(""); }}>Change</button>
              </div>
            ) : (
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
                <Input placeholder="Search SKU..." value={query} onChange={(e) => setQuery(e.target.value)} className="pl-8 h-9 text-xs" />
                {query.trim() && (
                  <div className="absolute z-10 mt-1 w-full max-h-56 overflow-auto rounded-lg border border-slate-200 bg-white shadow-lg">
                    {(skuLoading || visibleHits.length === 0) && <SkuSearchStatus loading={skuLoading} />}
                    {visibleHits.map((h) => (
                      <button key={h.id} type="button" onClick={() => { setSku(h); setQuery(""); }} className="w-full text-left px-3 py-2 hover:bg-blue-50 text-xs">
                        <span className="font-bold text-slate-900">{h.sku}</span>
                        <span className="text-slate-500"> · {h.title}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            <Label>Quantity</Label>
            <Input type="number" min={1} step={1} value={quantity} onChange={(e) => setQuantity(e.target.value)} placeholder="Units to order" className="h-9 text-xs" />
          </div>

          <div className="space-y-1.5">
            <Label>Manufacturer</Label>
            <Select value={manufacturerId || "none"} onValueChange={(v) => setManufacturerId(v === "none" ? "" : v)} disabled={!optionsReady}>
              <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent className="bg-white">
                <SelectItem value="none" className="text-xs">All manufacturers (no one in particular)</SelectItem>
                {manufacturers.map((m) => (
                  <SelectItem key={m.id} value={m.id} className="text-xs">{m.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Notes (optional)</Label>
            <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} className="text-xs" />
          </div>

          <div className="space-y-1.5">
            <label className="flex items-center gap-2 text-xs font-semibold text-slate-800 cursor-pointer">
              <input type="checkbox" checked={manual} onChange={(e) => setManual(e.target.checked)} className="h-4 w-4 accent-[#024AE5]" />
              Enter PO number manually
            </label>
            {manual ? (
              <Input placeholder="e.g. SI/PO/25-26/04" value={manualNumber} onChange={(e) => setManualNumber(e.target.value)} className="h-9 text-xs font-mono" />
            ) : (
              <p className="text-[11px] text-slate-500">The next number from Sales Settings is assigned automatically.</p>
            )}
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>Cancel</Button>
          <Button onClick={submit} disabled={pending || !optionsReady}>{pending ? "Creating..." : "Create Purchase Order"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
