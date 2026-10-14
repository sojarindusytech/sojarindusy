"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import toast from "react-hot-toast";
import { ListPlus, Plus, Search, Trash2, X } from "lucide-react";
import {
  getDebitNoteFormData,
  issueDebitNote,
  type DebitNoteFormData,
  type DebitNoteInvoiceOption,
} from "@/actions/debit-note";
import { getInvoice } from "@/actions/invoice";
import { computeInvoice, financialYear, formatInvoiceNumber, stateCodeOf } from "@/lib/invoice";
import { DEBIT_NOTE_REASONS, MAX_DEBIT_NOTE_NUMBER_LENGTH } from "@/lib/debit-notes";
import type { DebitNote, DebitNoteReason, Invoice } from "@/types/database.types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface Row {
  key: number;
  name: string;
  sku: string;
  description: string;
  hsn: string;
  unit: string;
  quantity: string;
  /** The amount added per unit (e.g. the price difference), not the original price. */
  unitPrice: string;
  /** "" = the Sales Settings default rate. */
  gstRate: string;
}

const inr = (n: number) => `₹${n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtDate = (iso: string) => iso.split("-").reverse().join("-");
/** Today in India time, as YYYY-MM-DD. */
const todayIst = () => new Date(Date.now() + 5.5 * 3600 * 1000).toISOString().slice(0, 10);

let rowKey = 0;
const blankRow = (over: Partial<Row> = {}): Row => ({
  key: ++rowKey, name: "", sku: "", description: "", hsn: "", unit: "", quantity: "1", unitPrice: "", gstRate: "", ...over,
});

interface Props {
  onOpenChange: (open: boolean) => void;
  onIssued: (debitNote: DebitNote) => void;
  /** Opened from an invoice row: that invoice is preselected. */
  initialInvoiceId?: string | null;
}

export function DebitNoteFormModal({ onOpenChange, onIssued, initialInvoiceId }: Props) {
  const [data, setData] = useState<DebitNoteFormData | null>(null);
  // One per form open: a double click or retry returns the note already issued.
  const [requestId] = useState(() => crypto.randomUUID());
  const [pending, startTransition] = useTransition();

  const [invoiceQuery, setInvoiceQuery] = useState("");
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [loadingInvoice, setLoadingInvoice] = useState(false);
  const [today] = useState(todayIst);
  const [date, setDate] = useState(today);
  const [reason, setReason] = useState<DebitNoteReason | "">("");
  const [reasonNote, setReasonNote] = useState("");
  const [manual, setManual] = useState(false);
  const [manualNumber, setManualNumber] = useState("");
  const [rows, setRows] = useState<Row[]>([]);

  // The parent mounts this form only while open, so state starts fresh each time.
  useEffect(() => {
    let cancelled = false;
    getDebitNoteFormData().then((d) => { if (!cancelled) setData(d); });
    return () => { cancelled = true; };
  }, []);

  const selectInvoice = async (id: string) => {
    setLoadingInvoice(true);
    const full = await getInvoice(id);
    setLoadingInvoice(false);
    if (!full || full.status !== "issued") {
      toast.error("That invoice could not be loaded or is cancelled.");
      return;
    }
    setInvoice(full);
    setInvoiceQuery("");
    setRows([]);
    // A note can't be dated before its invoice.
    setDate((d) => (d < full.invoice_date ? full.invoice_date : d));
  };

  useEffect(() => {
    if (!initialInvoiceId) return;
    let cancelled = false;
    getInvoice(initialInvoiceId).then((full) => {
      if (cancelled || !full || full.status !== "issued") return;
      setInvoice(full);
      setDate((d) => (d < full.invoice_date ? full.invoice_date : d));
    });
    return () => { cancelled = true; };
  }, [initialInvoiceId]);

  const invoiceHits: DebitNoteInvoiceOption[] = useMemo(() => {
    const q = invoiceQuery.trim().toLowerCase();
    if (!data || q.length < 1) return [];
    return data.invoices
      .filter((i) => i.invoice_number.toLowerCase().includes(q) || i.customer.toLowerCase().includes(q))
      .slice(0, 20);
  }, [data, invoiceQuery]);

  const settings = data?.settings;
  const defaultRate = settings?.default_gst_rate ?? 18;
  const gstEnabled = invoice?.gst_enabled ?? true;
  const supply = invoice?.place_of_supply || (settings ? `${settings.state_code}-${settings.state_name}` : "");

  const patchRow = (key: number, patch: Partial<Row>) =>
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));

  const addInvoiceLine = (index: number) => {
    const l = invoice?.items[index];
    if (!l) return;
    setRows((rs) => [
      ...rs,
      blankRow({
        name: l.name, sku: l.sku ?? "", description: l.description ?? "", hsn: l.hsn ?? "", unit: l.unit ?? "",
        quantity: String(l.quantity),
        // Same rate as on the invoice, unless the reason is that this rate was too low.
        gstRate: invoice?.gst_enabled ? String(l.gstRate) : "",
      }),
    ]);
  };

  const filled = useMemo(() => rows.filter((r) => r.name.trim()), [rows]);
  const computed = useMemo(
    () =>
      computeInvoice({
        items: filled.map((r) => ({
          name: r.name, quantity: Number(r.quantity), unitPrice: Number(r.unitPrice),
          gstRate: r.gstRate === "" ? null : Number(r.gstRate),
        })),
        gstEnabled,
        defaultGstRate: defaultRate,
        sellerStateCode: settings?.state_code,
        placeOfSupplyStateCode: stateCodeOf(supply),
      }),
    [filled, gstEnabled, defaultRate, settings?.state_code, supply]
  );

  const autoPreview = settings
    ? formatInvoiceNumber(
        settings.debit_note_prefix,
        financialYear(),
        settings.debit_note_fy === financialYear() ? settings.debit_note_next_number : 1,
        settings.debit_note_pad
      )
    : "";

  const reasonHint = DEBIT_NOTE_REASONS.find((r) => r.value === reason)?.hint;
  const t = computed.totals;

  const submit = () => {
    if (!invoice) return void toast.error("Select the invoice this debit note is for.");
    if (!reason) return void toast.error("Select a reason.");
    if (filled.length === 0) return void toast.error("Add at least one line.");
    startTransition(async () => {
      const res = await issueDebitNote({
        requestId,
        invoiceId: invoice.id,
        debitNoteDate: date,
        reason,
        reasonNote: reasonNote || null,
        manualNumber: manual ? manualNumber : null,
        lines: filled.map((r) => ({
          name: r.name, sku: r.sku || null, description: r.description || null, hsn: r.hsn || null, unit: r.unit || null,
          quantity: Number(r.quantity), unitPrice: Number(r.unitPrice),
          gstRate: r.gstRate === "" ? null : Number(r.gstRate),
        })),
      });
      if (res.success) {
        toast.success(`Debit note ${res.debitNote.debit_note_number} issued.`);
        onIssued(res.debitNote);
      } else {
        toast.error(res.error);
      }
    });
  };

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>New Debit Note</DialogTitle>
          <DialogDescription>
            Charge a customer more than an invoice did: a price revised upward, short-billed quantity, extra charges or
            GST charged too low. GST follows the original invoice.
          </DialogDescription>
        </DialogHeader>

        <div className="grid md:grid-cols-2 gap-5">
          {/* Invoice */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">Against Invoice</h3>
            {invoice ? (
              <div className="rounded-lg border border-slate-200 bg-slate-50/60 p-3 text-xs space-y-1">
                <div className="flex items-start justify-between gap-2">
                  <span className="font-mono font-bold text-slate-900">{invoice.invoice_number}</span>
                  <button
                    type="button"
                    onClick={() => { setInvoice(null); setRows([]); }}
                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-500 hover:text-red-600"
                  >
                    <X className="h-3 w-3" /> Change
                  </button>
                </div>
                <p className="text-slate-800 font-medium">{invoice.bill_to?.name}</p>
                <p className="text-slate-500">
                  Dated {fmtDate(invoice.invoice_date)} · Total {inr(Number(invoice.total_amount))}
                </p>
                <p className="text-slate-500">
                  {invoice.gst_enabled
                    ? computed.intraState ? "GST: CGST + SGST" : "GST: IGST (inter-state)"
                    : "Non-GST invoice: no GST on this note"}
                  {invoice.place_of_supply ? ` · Place of supply ${invoice.place_of_supply}` : ""}
                </p>
              </div>
            ) : (
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
                <Input
                  placeholder={data ? "Search invoice # or customer..." : "Loading invoices..."}
                  value={invoiceQuery}
                  onChange={(e) => setInvoiceQuery(e.target.value)}
                  disabled={!data || loadingInvoice}
                  className="pl-8 h-9 text-xs"
                  aria-label="Search invoices"
                />
                {invoiceHits.length > 0 && (
                  <div className="absolute z-10 mt-1 w-full max-h-64 overflow-auto rounded-lg border border-slate-200 bg-white shadow-lg">
                    {invoiceHits.map((h) => (
                      <button key={h.id} type="button" onClick={() => selectInvoice(h.id)} className="w-full text-left px-3 py-2 hover:bg-blue-50 text-xs">
                        <span className="font-mono font-bold text-slate-900">{h.invoice_number}</span>
                        <span className="text-slate-500"> · {h.customer} · {fmtDate(h.invoice_date)} · {inr(h.total)}</span>
                      </button>
                    ))}
                  </div>
                )}
                {invoiceQuery.trim() && data && invoiceHits.length === 0 && (
                  <p className="text-[11px] text-slate-500 mt-1">No issued invoice matches.</p>
                )}
              </div>
            )}
          </div>

          {/* Note details */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">Debit Note Details</h3>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <Label htmlFor="dn-date">Date</Label>
                <Input
                  id="dn-date"
                  type="date"
                  value={date}
                  min={invoice?.invoice_date}
                  max={today}
                  onChange={(e) => setDate(e.target.value)}
                  className="h-9 text-xs"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Reason</Label>
                <Select value={reason} onValueChange={(v) => setReason(v as DebitNoteReason)}>
                  <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Select reason" /></SelectTrigger>
                  <SelectContent className="bg-white">
                    {DEBIT_NOTE_REASONS.map((r) => (
                      <SelectItem key={r.value} value={r.value} className="text-xs">{r.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            {reasonHint && <p className="text-[11px] text-slate-500 -mt-1">{reasonHint}</p>}
            <Textarea
              placeholder={reason === "other" ? "Reason (required)" : "Note for the customer (optional), e.g. rate revised as per PO amendment"}
              rows={2}
              maxLength={500}
              value={reasonNote}
              onChange={(e) => setReasonNote(e.target.value)}
              className="text-xs"
              aria-label="Reason note"
            />
            <div className="space-y-1.5">
              <label className="flex items-center gap-2 text-xs font-semibold text-slate-800 cursor-pointer">
                <input type="checkbox" checked={manual} onChange={(e) => setManual(e.target.checked)} className="h-4 w-4 accent-[#024AE5]" />
                Enter debit note number manually
              </label>
              {manual ? (
                <>
                  <Input
                    placeholder="e.g. SI/DN/25-26/04"
                    value={manualNumber}
                    maxLength={MAX_DEBIT_NOTE_NUMBER_LENGTH}
                    onChange={(e) => setManualNumber(e.target.value)}
                    className="h-9 text-xs font-mono"
                    aria-label="Debit note number"
                  />
                  <p className="text-[11px] text-slate-500">Up to {MAX_DEBIT_NOTE_NUMBER_LENGTH} letters, digits, / and - (GST rule).</p>
                </>
              ) : (
                <p className="text-[11px] text-slate-500">Next number: <span className="font-mono font-bold text-slate-800">{autoPreview || "…"}</span></p>
              )}
            </div>
          </div>
        </div>

        {/* Lines */}
        <div className="space-y-2">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">Amounts to add</h3>
            {invoice && invoice.items.length > 0 && (
              <Select value="" onValueChange={(v) => addInvoiceLine(Number(v))}>
                <SelectTrigger className="h-9 text-xs sm:w-80" aria-label="Add a line from the invoice">
                  <ListPlus className="h-3.5 w-3.5 text-slate-400 mr-1.5 shrink-0" />
                  <SelectValue placeholder="Add a line from the invoice" />
                </SelectTrigger>
                <SelectContent className="bg-white max-h-64">
                  {invoice.items.map((l, i) => (
                    <SelectItem key={i} value={String(i)} className="text-xs">
                      {l.name} · {l.quantity} × {inr(l.unitPrice)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          <div className="overflow-x-auto rounded-lg border border-slate-200">
            <table className="w-full text-xs min-w-[720px]">
              <thead className="bg-slate-50 text-[11px] uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="text-left p-2">Item / charge</th>
                  <th className="p-2 w-20">Qty</th>
                  <th className="p-2 w-32">Extra per unit</th>
                  <th className="p-2 w-20">GST %</th>
                  <th className="text-right p-2 w-28">Amount</th>
                  <th className="w-8" />
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-4 text-center text-[11px] text-slate-500">
                      {invoice
                        ? "Add a line from the invoice (e.g. the price difference on an item), or a charge line."
                        : "Select an invoice first."}
                    </td>
                  </tr>
                ) : (
                  rows.map((r) => {
                    const line = computed.lines[filled.findIndex((x) => x.key === r.key)];
                    return (
                      <tr key={r.key} className="border-t border-slate-100 align-top">
                        <td className="p-1.5">
                          <Input placeholder="Item name or charge, e.g. Freight charges" value={r.name} onChange={(e) => patchRow(r.key, { name: e.target.value })} className="h-8 text-xs" aria-label="Item name" />
                          <Input placeholder="Description (optional)" value={r.description} onChange={(e) => patchRow(r.key, { description: e.target.value })} className="h-7 text-[11px] mt-1 text-slate-500" aria-label="Description" />
                        </td>
                        <td className="p-1.5"><Input type="number" min={0} value={r.quantity} onChange={(e) => patchRow(r.key, { quantity: e.target.value })} className="h-8 text-xs" aria-label="Quantity" /></td>
                        <td className="p-1.5"><Input type="number" min={0} step="0.01" placeholder="0.00" value={r.unitPrice} onChange={(e) => patchRow(r.key, { unitPrice: e.target.value })} className="h-8 text-xs" aria-label="Extra per unit" /></td>
                        <td className="p-1.5"><Input type="number" min={0} max={100} step="0.01" placeholder={String(defaultRate)} disabled={!gstEnabled} value={r.gstRate} onChange={(e) => patchRow(r.key, { gstRate: e.target.value })} className="h-8 text-xs" aria-label="GST %" /></td>
                        <td className="p-1.5 text-right font-semibold text-slate-900 pt-3">{line ? inr(line.amount) : "—"}</td>
                        <td className="p-1.5 pt-2">
                          <button type="button" aria-label="Remove line" onClick={() => setRows((rs) => rs.filter((x) => x.key !== r.key))} className="text-slate-400 hover:text-red-600">
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
          <Button type="button" variant="outline" size="sm" className="gap-1.5" disabled={!invoice} onClick={() => setRows((rs) => [...rs, blankRow()])}>
            <Plus className="h-3.5 w-3.5" /> Add charge line
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
          <div className="flex justify-between border-t border-slate-200 pt-1.5 text-sm font-bold text-slate-900"><span>Debit note total</span><span>{inr(t.total)}</span></div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>Cancel</Button>
          <Button onClick={submit} disabled={pending || !invoice}>{pending ? "Issuing..." : "Issue Debit Note"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
