"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import toast from "react-hot-toast";
import { Plus, Trash2, Search } from "lucide-react";
import { createCommercialQuote, type QuoteFormData } from "@/actions/quote";
import { searchInvoiceSkus, type InvoiceSkuHit } from "@/actions/invoice";
import { computeInvoice, financialYear, formatInvoiceNumber, stateCodeOf } from "@/lib/invoice";
import { INDIAN_STATES } from "@/lib/indian-states";
import type { CommercialQuote } from "@/types/database.types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";

interface Row {
  key: number;
  name: string;
  sku: string;
  description: string;
  hsn: string;
  quantity: string;
  unitPrice: string;
  discountPct: string;
  /** "" = use the default rate */
  gstRate: string;
}

const NONE = "__none__";
const inr = (n: number) => `₹${n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const isoDay = (d: Date) => d.toISOString().slice(0, 10);
const addDays = (days: number) => isoDay(new Date(Date.now() + days * 86400000));

let rowKey = 0;
const blankRow = (over: Partial<Row> = {}): Row => ({
  key: ++rowKey, name: "", sku: "", description: "", hsn: "", quantity: "1", unitPrice: "", discountPct: "", gstRate: "", ...over,
});

/** Create a quotation. The parent mounts it only while open. */
export function QuoteFormModal({
  data,
  onOpenChange,
  onCreated,
}: {
  /** Prefetched by the parent so the dropdowns are ready on open. null while it is still loading. */
  data: QuoteFormData | null;
  onOpenChange: (open: boolean) => void;
  onCreated: (quote: CommercialQuote) => void;
}) {
  const [pending, startTransition] = useTransition();

  const [rfqId, setRfqId] = useState(NONE);
  const [customerId, setCustomerId] = useState(NONE);
  const [company, setCompany] = useState("");
  const [contact, setContact] = useState("");
  const [email, setEmail] = useState("");
  const [mobile, setMobile] = useState("");
  const [gstin, setGstin] = useState("");
  const [address, setAddress] = useState("");
  const [supply, setSupply] = useState("");
  const [quoteDate, setQuoteDate] = useState(isoDay(new Date()));
  const [validUntil, setValidUntil] = useState(addDays(30));
  const [gstEnabled, setGstEnabled] = useState(true);
  const [manual, setManual] = useState(false);
  const [manualNumber, setManualNumber] = useState("");
  const [paymentTerms, setPaymentTerms] = useState("");
  const [deliveryTerms, setDeliveryTerms] = useState("");
  const [notes, setNotes] = useState("");
  const [rows, setRows] = useState<Row[]>([blankRow()]);

  const [skuQuery, setSkuQuery] = useState("");
  const [skuHits, setSkuHits] = useState<InvoiceSkuHit[]>([]);

  // Apply the Sales Settings defaults once the data is here (immediately when prefetched,
  // later if the form was opened before it finished loading). Done during render so there
  // is no empty first paint.
  const [appliedData, setAppliedData] = useState<QuoteFormData | null>(null);
  if (data && data !== appliedData) {
    setAppliedData(data);
    if (data.settings) {
      setGstEnabled(data.settings.gst_billing_enabled);
      setSupply(`${data.settings.state_code}-${data.settings.state_name}`);
      setValidUntil(addDays(data.settings.quote_validity_days));
      setPaymentTerms(data.settings.quote_payment_terms ?? "");
      setDeliveryTerms(data.settings.quote_delivery_terms ?? "");
    }
  }

  // Debounced SKU search.
  useEffect(() => {
    const q = skuQuery.trim();
    if (q.length < 2) return;
    let cancelled = false;
    const t = setTimeout(() => {
      searchInvoiceSkus(q).then((hits) => { if (!cancelled) setSkuHits(hits); });
    }, 250);
    return () => { cancelled = true; clearTimeout(t); };
  }, [skuQuery]);

  const visibleHits = skuQuery.trim().length < 2 ? [] : skuHits;
  const settings = data?.settings;
  const defaultRate = settings?.default_gst_rate ?? 18;

  const pickCustomer = (id: string) => {
    setCustomerId(id);
    const c = data?.customers.find((x) => x.id === id);
    if (!c) return;
    setCompany(c.company_name); setContact(c.contact_name); setEmail(c.email); setMobile(c.mobile);
    setGstin(c.gstin ?? ""); setAddress(c.address);
    if (c.place_of_supply) setSupply(c.place_of_supply);
  };

  // Linking an RFQ fills the client and seeds one line from the requested item.
  const pickRfq = (id: string) => {
    setRfqId(id);
    const r = data?.rfqs.find((x) => x.id === id);
    if (!r) return;
    const linked = r.user_id ? data?.customers.find((c) => c.id === r.user_id) : undefined;
    if (linked) pickCustomer(linked.id);
    else {
      setCustomerId(NONE);
      setCompany(r.company_name ?? ""); setContact(r.contact_person ?? ""); setEmail(r.email ?? ""); setMobile(r.mobile ?? "");
    }
    setRows([blankRow({ name: r.item_name, description: `Qty requested: ${r.quantity}`, quantity: String(parseInt(r.quantity, 10) || 1) })]);
  };

  const addSku = (hit: InvoiceSkuHit) => {
    setRows((rs) => {
      const row = blankRow({
        name: hit.sku, sku: hit.sku, description: hit.title, hsn: hit.hsn_code ?? "",
        unitPrice: String(hit.list_price), gstRate: hit.gst_rate === null ? "" : String(hit.gst_rate),
      });
      return rs.length === 1 && !rs[0].name && !rs[0].unitPrice ? [row] : [...rs, row];
    });
    setSkuQuery(""); setSkuHits([]);
  };

  const patchRow = (key: number, patch: Partial<Row>) =>
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));

  const filled = rows.filter((r) => r.name.trim());
  const computed = useMemo(
    () =>
      computeInvoice({
        items: filled.map((r) => ({
          name: r.name, quantity: Number(r.quantity), unitPrice: Number(r.unitPrice),
          discountPct: Number(r.discountPct) || 0, gstRate: r.gstRate === "" ? null : Number(r.gstRate),
        })),
        gstEnabled,
        defaultGstRate: defaultRate,
        sellerStateCode: settings?.state_code,
        placeOfSupplyStateCode: stateCodeOf(supply),
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rows, gstEnabled, defaultRate, settings?.state_code, supply]
  );

  const autoPreview = settings
    ? formatInvoiceNumber(
        settings.quote_prefix,
        financialYear(),
        settings.quote_fy === financialYear() ? settings.quote_next_number : 1,
        settings.quote_pad
      )
    : "";

  const submit = (status: "draft" | "sent") =>
    startTransition(async () => {
      const res = await createCommercialQuote({
        customerId: customerId === NONE ? null : customerId,
        rfqId: rfqId === NONE ? null : rfqId,
        company_name: company,
        contact_person: contact,
        email,
        mobile,
        gstin,
        address,
        placeOfSupply: supply || null,
        quoteDate,
        validUntil,
        gstEnabled,
        paymentTerms,
        deliveryTerms,
        adminNotes: notes,
        status,
        manualNumber: manual ? manualNumber : null,
        lines: filled.map((r) => ({
          name: r.name, sku: r.sku || null, description: r.description || null, hsn: r.hsn || null,
          quantity: Number(r.quantity), unitPrice: Number(r.unitPrice), discountPct: Number(r.discountPct) || 0,
          gstRate: r.gstRate === "" ? null : Number(r.gstRate),
        })),
      });
      if (res.success) {
        toast.success(`Quotation ${res.quote.quote_number} created.`);
        onCreated(res.quote);
      } else {
        toast.error(res.error);
      }
    });

  const t = computed.totals;

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl">
        <DialogHeader>
          <DialogTitle>Create Quotation</DialogTitle>
          <DialogDescription>Itemised estimate with discounts and GST. Pick an RFQ to quote it directly.</DialogDescription>
        </DialogHeader>

        {data && data.rfqs.length > 0 && (
          <div className="space-y-1.5">
            <Label>Quote an RFQ (optional)</Label>
            <Select value={rfqId} onValueChange={(v) => (v === NONE ? setRfqId(NONE) : pickRfq(v))}>
              <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent className="bg-white max-h-64">
                <SelectItem value={NONE} className="text-xs italic">Not linked to an RFQ</SelectItem>
                {data.rfqs.map((r) => (
                  <SelectItem key={r.id} value={r.id} className="text-xs">
                    {r.rfq_number} · {r.company_name} · {r.item_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-[11px] text-slate-500">The RFQ is marked Quoted once this quotation is created.</p>
          </div>
        )}

        <div className="grid md:grid-cols-2 gap-5">
          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">Client</h3>
            <Select disabled={!data} value={customerId} onValueChange={(v) => (v === NONE ? setCustomerId(NONE) : pickCustomer(v))}>
              <SelectTrigger className="h-9 text-xs"><SelectValue placeholder={data ? "Select customer" : "Loading customers…"} /></SelectTrigger>
              <SelectContent className="bg-white max-h-64">
                <SelectItem value={NONE} className="text-xs italic">Enter details manually</SelectItem>
                {data?.customers.map((c) => (
                  <SelectItem key={c.id} value={c.id} className="text-xs">{c.company_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input placeholder="Company name *" value={company} onChange={(e) => setCompany(e.target.value)} className="h-9 text-xs" />
            <div className="grid grid-cols-2 gap-2">
              <Input placeholder="Contact person" value={contact} onChange={(e) => setContact(e.target.value)} className="h-9 text-xs" />
              <Input placeholder="Mobile" value={mobile} onChange={(e) => setMobile(e.target.value)} className="h-9 text-xs" />
              <Input placeholder="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="h-9 text-xs" />
              <Input placeholder="GSTIN" value={gstin} onChange={(e) => setGstin(e.target.value)} className="h-9 text-xs uppercase" />
            </div>
            <Textarea placeholder="Address" rows={2} value={address} onChange={(e) => setAddress(e.target.value)} className="text-xs" />
          </div>

          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">Quotation Details</h3>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <Label>Date</Label>
                <Input type="date" value={quoteDate} onChange={(e) => setQuoteDate(e.target.value)} className="h-9 text-xs" />
              </div>
              <div className="space-y-1.5">
                <Label>Valid until</Label>
                <Input type="date" value={validUntil} min={quoteDate} onChange={(e) => setValidUntil(e.target.value)} className="h-9 text-xs" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Place of supply</Label>
              <Select value={supply} onValueChange={setSupply}>
                <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Select state" /></SelectTrigger>
                <SelectContent className="bg-white max-h-64">
                  {INDIAN_STATES.map((s) => (
                    <SelectItem key={s.code} value={`${s.code}-${s.name}`} className="text-xs">{s.code}-{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <label className="flex items-center gap-2 text-xs font-semibold text-slate-800 cursor-pointer">
              <input type="checkbox" checked={gstEnabled} onChange={(e) => setGstEnabled(e.target.checked)} className="h-4 w-4 accent-[#024AE5]" />
              Quote with GST {gstEnabled && !computed.intraState ? <span className="font-normal text-slate-500">(inter-state: IGST)</span> : null}
            </label>
            <div className="space-y-1.5">
              <label className="flex items-center gap-2 text-xs font-semibold text-slate-800 cursor-pointer">
                <input type="checkbox" checked={manual} onChange={(e) => setManual(e.target.checked)} className="h-4 w-4 accent-[#024AE5]" />
                Enter quotation number manually
              </label>
              {manual ? (
                <Input placeholder="e.g. SI/QT/25-26/04" value={manualNumber} onChange={(e) => setManualNumber(e.target.value)} className="h-9 text-xs font-mono" />
              ) : (
                <p className="text-[11px] text-slate-500">Next number: <span className="font-mono font-bold text-slate-800">{autoPreview || "…"}</span></p>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">Items</h3>
            <div className="relative sm:w-80">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
              <Input placeholder="Search SKU to add..." value={skuQuery} onChange={(e) => setSkuQuery(e.target.value)} className="pl-8 h-9 text-xs" />
              {visibleHits.length > 0 && (
                <div className="absolute z-10 mt-1 w-full max-h-56 overflow-auto rounded-lg border border-slate-200 bg-white shadow-lg">
                  {visibleHits.map((h) => (
                    <button key={h.sku} type="button" onClick={() => addSku(h)} className="w-full text-left px-3 py-2 hover:bg-blue-50 text-xs">
                      <span className="font-bold text-slate-900">{h.sku}</span>
                      <span className="text-slate-500"> · {h.title} · {inr(h.list_price)}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="overflow-x-auto rounded-lg border border-slate-200">
            <table className="w-full text-xs min-w-[760px]">
              <thead className="bg-slate-50 text-[11px] uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="text-left p-2">Item</th>
                  <th className="p-2 w-20">Qty</th>
                  <th className="p-2 w-28">Rate</th>
                  <th className="p-2 w-20">Disc %</th>
                  <th className="p-2 w-20">GST %</th>
                  <th className="text-right p-2 w-28">Amount</th>
                  <th className="w-8" />
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const line = computed.lines[filled.findIndex((x) => x.key === r.key)];
                  return (
                    <tr key={r.key} className="border-t border-slate-100 align-top">
                      <td className="p-1.5">
                        <Input placeholder="Item name / SKU" value={r.name} onChange={(e) => patchRow(r.key, { name: e.target.value })} className="h-8 text-xs" />
                        <Input placeholder="Description (optional)" value={r.description} onChange={(e) => patchRow(r.key, { description: e.target.value })} className="h-7 text-[11px] mt-1 text-slate-500" />
                      </td>
                      <td className="p-1.5"><Input type="number" min={0} value={r.quantity} onChange={(e) => patchRow(r.key, { quantity: e.target.value })} className="h-8 text-xs" /></td>
                      <td className="p-1.5"><Input type="number" min={0} step="0.01" value={r.unitPrice} onChange={(e) => patchRow(r.key, { unitPrice: e.target.value })} className="h-8 text-xs" /></td>
                      <td className="p-1.5"><Input type="number" min={0} max={100} step="0.01" value={r.discountPct} onChange={(e) => patchRow(r.key, { discountPct: e.target.value })} className="h-8 text-xs" /></td>
                      <td className="p-1.5"><Input type="number" min={0} max={100} step="0.01" placeholder={String(defaultRate)} disabled={!gstEnabled} value={r.gstRate} onChange={(e) => patchRow(r.key, { gstRate: e.target.value })} className="h-8 text-xs" /></td>
                      <td className="p-1.5 text-right font-semibold text-slate-900 pt-3">{line ? inr(line.amount) : "—"}</td>
                      <td className="p-1.5 pt-2">
                        <button type="button" aria-label="Remove item" disabled={rows.length === 1} onClick={() => setRows((rs) => rs.filter((x) => x.key !== r.key))} className="text-slate-400 hover:text-red-600 disabled:opacity-30">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={() => setRows((rs) => [...rs, blankRow()])}>
            <Plus className="h-3.5 w-3.5" /> Add custom line
          </Button>
        </div>

        <div className="grid md:grid-cols-2 gap-5">
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Payment terms</Label>
              <Input value={paymentTerms} onChange={(e) => setPaymentTerms(e.target.value)} className="h-9 text-xs" />
            </div>
            <div className="space-y-1.5">
              <Label>Delivery terms</Label>
              <Input value={deliveryTerms} onChange={(e) => setDeliveryTerms(e.target.value)} className="h-9 text-xs" />
            </div>
            <div className="space-y-1.5">
              <Label>Internal notes (not printed)</Label>
              <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} className="text-xs" />
            </div>
          </div>

          <div className="w-full space-y-1 text-xs self-end">
            <div className="flex justify-between"><span className="text-slate-500">Taxable amount</span><span>{inr(t.taxableTotal)}</span></div>
            {gstEnabled && (computed.intraState ? (
              <>
                <div className="flex justify-between"><span className="text-slate-500">CGST</span><span>{inr(t.cgstTotal)}</span></div>
                <div className="flex justify-between"><span className="text-slate-500">SGST</span><span>{inr(t.sgstTotal)}</span></div>
              </>
            ) : (
              <div className="flex justify-between"><span className="text-slate-500">IGST</span><span>{inr(t.igstTotal)}</span></div>
            ))}
            <div className="flex justify-between"><span className="text-slate-500">Round off</span><span>{inr(t.roundOff)}</span></div>
            <div className="flex justify-between border-t border-slate-200 pt-1.5 text-sm font-bold text-slate-900"><span>Total</span><span>{inr(t.total)}</span></div>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>Cancel</Button>
          <Button variant="outline" onClick={() => submit("draft")} disabled={pending}>Save as Draft</Button>
          <Button onClick={() => submit("sent")} disabled={pending}>{pending ? "Creating..." : "Create & Mark Sent"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
