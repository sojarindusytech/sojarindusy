"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import toast from "react-hot-toast";
import { Plus, Trash2, Search } from "lucide-react";
import {
  createManualInvoice,
  updateInvoice,
  getInvoiceFormData,
  searchInvoiceSkus,
  type InvoiceFormCustomer,
  type InvoiceSkuHit,
} from "@/actions/invoice";
import { computeInvoice, formatInvoiceNumber, financialYear, stateCodeOf } from "@/lib/invoice";
import { INDIAN_STATES } from "@/lib/indian-states";
import type { Invoice } from "@/types/database.types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";

type FormData = Awaited<ReturnType<typeof getInvoiceFormData>>;

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

const CUSTOM = "__custom__";
const inr = (n: number) => `₹${n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const today = () => new Date().toISOString().slice(0, 10);

let rowKey = 0;
const blankRow = (over: Partial<Row> = {}): Row => ({
  key: ++rowKey, name: "", sku: "", description: "", hsn: "", quantity: "1", unitPrice: "", discountPct: "", gstRate: "", ...over,
});

interface Props {
  onOpenChange: (open: boolean) => void;
  onSaved: (invoice: Invoice) => void;
  /** Present = edit this invoice; absent = create a new one. */
  invoice?: Invoice;
}

export function InvoiceFormModal({ onOpenChange, onSaved, invoice }: Props) {
  const editing = !!invoice;
  const [data, setData] = useState<FormData | null>(null);
  const [pending, startTransition] = useTransition();

  const [customerId, setCustomerId] = useState<string>(invoice?.user_id ?? CUSTOM);
  // Edit only re-links the invoice to a customer the admin deliberately picks.
  const [customerPicked, setCustomerPicked] = useState(false);
  const [name, setName] = useState(invoice?.bill_to.name ?? "");
  const [address, setAddress] = useState(invoice?.bill_to.address ?? "");
  const [contact, setContact] = useState(invoice?.bill_to.contact ?? "");
  const [gstin, setGstin] = useState(invoice?.bill_to.gstin ?? "");
  const [supply, setSupply] = useState(invoice?.place_of_supply ?? "");
  const [date, setDate] = useState(invoice?.invoice_date ?? today());
  const [po, setPo] = useState(invoice?.po_number ?? "");
  const [gstEnabled, setGstEnabled] = useState(invoice?.gst_enabled ?? true);
  // When editing, the number is always editable and prefilled.
  const [manual, setManual] = useState(editing);
  const [manualNumber, setManualNumber] = useState(invoice?.invoice_number ?? "");
  const [rows, setRows] = useState<Row[]>(() =>
    invoice
      ? invoice.items.map((l) =>
          blankRow({
            name: l.name, sku: l.sku ?? "", description: l.description ?? "", hsn: l.hsn ?? "",
            quantity: String(l.quantity), unitPrice: String(l.unitPrice),
            discountPct: l.discountPct ? String(l.discountPct) : "",
            // Lines of a non-GST invoice have rate 0; leave blank so turning GST on uses the default.
            gstRate: invoice.gst_enabled ? String(l.gstRate) : "",
          })
        )
      : [blankRow()]
  );

  const [skuQuery, setSkuQuery] = useState("");
  const [skuHits, setSkuHits] = useState<InvoiceSkuHit[]>([]);

  // The parent mounts this form only while open, so state starts fresh each time.
  useEffect(() => {
    let cancelled = false;
    getInvoiceFormData().then((d) => {
      if (cancelled) return;
      setData(d);
      if (editing) return;
      setGstEnabled(d.settings?.gst_billing_enabled ?? true);
      setSupply(d.settings ? `${d.settings.state_code}-${d.settings.state_name}` : "");
    });
    return () => { cancelled = true; };
  }, [editing]);

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
    setCustomerPicked(true);
    const c: InvoiceFormCustomer | undefined = data?.customers.find((x) => x.id === id);
    if (!c) return;
    setName(c.company_name); setAddress(c.address); setContact(c.mobile); setGstin(c.gstin ?? "");
    if (c.place_of_supply) setSupply(c.place_of_supply);
  };

  const addSku = (hit: InvoiceSkuHit) => {
    setRows((rs) => {
      const row = blankRow({
        name: hit.sku, sku: hit.sku, description: hit.title, hsn: hit.hsn_code ?? "",
        unitPrice: String(hit.list_price), gstRate: hit.gst_rate === null ? "" : String(hit.gst_rate),
      });
      // Replace a still-empty first row instead of leaving it dangling.
      return rs.length === 1 && !rs[0].name && !rs[0].unitPrice ? [row] : [...rs, row];
    });
    setSkuQuery(""); setSkuHits([]);
  };

  const patchRow = (key: number, patch: Partial<Row>) =>
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));

  const computed = useMemo(
    () =>
      computeInvoice({
        items: rows.filter((r) => r.name.trim()).map((r) => ({
          name: r.name, quantity: Number(r.quantity), unitPrice: Number(r.unitPrice),
          discountPct: Number(r.discountPct) || 0, gstRate: r.gstRate === "" ? null : Number(r.gstRate),
        })),
        gstEnabled,
        defaultGstRate: defaultRate,
        sellerStateCode: settings?.state_code,
        placeOfSupplyStateCode: stateCodeOf(supply),
      }),
    [rows, gstEnabled, defaultRate, settings?.state_code, supply]
  );

  const autoPreview = settings
    ? formatInvoiceNumber(
        settings.invoice_prefix,
        financialYear(),
        settings.invoice_fy === financialYear() ? settings.invoice_next_number : 1,
        settings.invoice_pad
      )
    : "";

  const submit = () =>
    startTransition(async () => {
      const payload = {
        // Edit: only send a customer the admin chose in this session (see customerPicked).
        customerId: customerId === CUSTOM || (editing && !customerPicked) ? null : customerId,
        billTo: { name, address, contact, gstin },
        placeOfSupply: supply || null,
        invoiceDate: date,
        poNumber: po,
        gstEnabled,
        manualNumber: manual ? manualNumber : null,
        lines: rows.filter((r) => r.name.trim()).map((r) => ({
          name: r.name, sku: r.sku || null, description: r.description || null, hsn: r.hsn || null,
          quantity: Number(r.quantity), unitPrice: Number(r.unitPrice), discountPct: Number(r.discountPct) || 0,
          gstRate: r.gstRate === "" ? null : Number(r.gstRate),
        })),
      };
      const res = invoice ? await updateInvoice(invoice.id, payload) : await createManualInvoice(payload);
      if (res.success) {
        toast.success(`Invoice ${res.invoice.invoice_number} ${editing ? "updated" : "created"}.`);
        onSaved(res.invoice);
      } else {
        toast.error(res.error);
      }
    });

  const t = computed.totals;

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl">
        <DialogHeader>
          <DialogTitle>{editing ? `Edit Invoice ${invoice.invoice_number}` : "New Invoice"}</DialogTitle>
          <DialogDescription>
            {editing
              ? "Changes replace the issued invoice and its PDF. Totals are recalculated."
              : "For offline or verbal sales. Order invoices are created automatically on delivery."}
          </DialogDescription>
        </DialogHeader>

        <div className="grid md:grid-cols-2 gap-5">
          {/* Customer */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">Bill To</h3>
            <Select value={customerId} onValueChange={(v) => (v === CUSTOM ? setCustomerId(CUSTOM) : pickCustomer(v))}>
              <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Select customer" /></SelectTrigger>
              <SelectContent className="bg-white max-h-64">
                <SelectItem value={CUSTOM} className="text-xs italic">Enter details manually</SelectItem>
                {data?.customers.map((c) => (
                  <SelectItem key={c.id} value={c.id} className="text-xs">{c.company_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input placeholder="Customer / company name *" value={name} onChange={(e) => setName(e.target.value)} className="h-9 text-xs" />
            <Textarea placeholder="Address" rows={2} value={address} onChange={(e) => setAddress(e.target.value)} className="text-xs" />
            <div className="grid grid-cols-2 gap-2">
              <Input placeholder="Contact no." value={contact} onChange={(e) => setContact(e.target.value)} className="h-9 text-xs" />
              <Input placeholder="GSTIN" value={gstin} onChange={(e) => setGstin(e.target.value)} className="h-9 text-xs uppercase" />
            </div>
          </div>

          {/* Invoice details */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">Invoice Details</h3>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <Label>Date</Label>
                <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="h-9 text-xs" />
              </div>
              <div className="space-y-1.5">
                <Label>PO number</Label>
                <Input placeholder="e.g. VERBAL" value={po} onChange={(e) => setPo(e.target.value)} className="h-9 text-xs" />
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
              Bill with GST {gstEnabled && !computed.intraState ? <span className="font-normal text-slate-500">(inter-state: IGST)</span> : null}
            </label>
            <div className="space-y-1.5">
              {editing ? (
                <Label>Invoice number</Label>
              ) : (
                <label className="flex items-center gap-2 text-xs font-semibold text-slate-800 cursor-pointer">
                  <input type="checkbox" checked={manual} onChange={(e) => setManual(e.target.checked)} className="h-4 w-4 accent-[#024AE5]" />
                  Enter invoice number manually
                </label>
              )}
              {manual ? (
                <Input placeholder="e.g. SI/INV/25-26/04" value={manualNumber} onChange={(e) => setManualNumber(e.target.value)} className="h-9 text-xs font-mono" />
              ) : (
                <p className="text-[11px] text-slate-500">Next number: <span className="font-mono font-bold text-slate-800">{autoPreview || "…"}</span></p>
              )}
            </div>
          </div>
        </div>

        {/* Items */}
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
                  <th className="p-2 w-28">Price</th>
                  <th className="p-2 w-20">Disc %</th>
                  <th className="p-2 w-20">GST %</th>
                  <th className="text-right p-2 w-28">Amount</th>
                  <th className="w-8" />
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const line = computed.lines[rows.filter((x) => x.name.trim()).findIndex((x) => x.key === r.key)];
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

        {/* Totals */}
        <div className="ml-auto w-full sm:w-72 space-y-1 text-xs">
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

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>Cancel</Button>
          <Button onClick={submit} disabled={pending}>{pending ? (editing ? "Saving..." : "Creating...") : editing ? "Save Changes" : "Create Invoice"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
