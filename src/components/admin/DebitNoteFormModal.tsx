"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import toast from "react-hot-toast";
import { CheckCircle2, Info, ListPlus, Loader2, Plus, Search, Trash2, X } from "lucide-react";
import {
  getDebitNoteFormData,
  issueDebitNote,
  type DebitNoteFormData,
  type DebitNoteInvoiceOption,
} from "@/actions/debit-note";
import { getInvoice } from "@/actions/invoice";
import { computeInvoice, financialYear, formatInvoiceNumber, GST_RATE_OPTIONS, round2, stateCodeOf } from "@/lib/invoice";
import {
  billedRate,
  buildDebitNoteLines,
  DEBIT_NOTE_CHARGE_PRESETS,
  DEBIT_NOTE_REASONS,
  lineKindFor,
  MAX_DEBIT_NOTE_NUMBER_LENGTH,
  principalGstRate,
  type DebitNoteAdjustment,
  type DebitNoteLineKind,
} from "@/lib/debit-notes";
import type { DebitNote, DebitNoteReason, Invoice } from "@/types/database.types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

/**
 * One line of the form, by reason. Inputs stay strings so an empty box stays empty;
 * they become numbers in toAdjustment(). Lines that adjust an invoice line point at
 * it by index; the server prices them from the stored invoice.
 */
type Row =
  | { key: number; kind: "rate"; line: number; quantity: string; newRate: string }
  | { key: number; kind: "quantity"; line: number; quantity: string; rate: string }
  | { key: number; kind: "charge"; label: string; amount: string; gstRate: string; hsn: string }
  | { key: number; kind: "tax"; line: number; correctRate: string }
  | { key: number; kind: "custom"; name: string; description: string; hsn: string; quantity: string; unitPrice: string; gstRate: string };

const inr = (n: number) => `₹${n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtDate = (iso: string) => iso.split("-").reverse().join("-");
const pct = (n: number) => `${Number.isInteger(n) ? n : n.toFixed(2)}%`;
/** Today in India time, as YYYY-MM-DD. */
const todayIst = () => new Date(Date.now() + 5.5 * 3600 * 1000).toISOString().slice(0, 10);
/** "" (not entered yet) is NaN, so an empty box never counts as 0. */
const num = (v: string) => (v.trim() === "" ? NaN : Number(v));

let rowKey = 0;
const nextKey = () => ++rowKey;

/** A form line as the server expects it, or null while it is still incomplete. */
function toAdjustment(r: Row): DebitNoteAdjustment | null {
  switch (r.kind) {
    case "rate": {
      const quantity = num(r.quantity);
      const newRate = num(r.newRate);
      return Number.isFinite(quantity) && Number.isFinite(newRate) ? { kind: "rate", line: r.line, quantity, newRate } : null;
    }
    case "quantity": {
      const quantity = num(r.quantity);
      const rate = num(r.rate);
      return Number.isFinite(quantity) && Number.isFinite(rate) ? { kind: "quantity", line: r.line, quantity, rate } : null;
    }
    case "charge": {
      const amount = num(r.amount);
      return r.label.trim() && Number.isFinite(amount)
        ? { kind: "charge", label: r.label, amount, gstRate: r.gstRate === "" ? null : Number(r.gstRate), hsn: r.hsn || null }
        : null;
    }
    case "tax": {
      const correctRate = num(r.correctRate);
      return Number.isFinite(correctRate) ? { kind: "tax", line: r.line, correctRate } : null;
    }
    case "custom": {
      const quantity = num(r.quantity);
      const unitPrice = num(r.unitPrice);
      return r.name.trim() && Number.isFinite(quantity) && Number.isFinite(unitPrice)
        ? {
            kind: "custom", name: r.name, description: r.description || null, hsn: r.hsn || null,
            quantity, unitPrice, gstRate: r.gstRate === "" ? null : Number(r.gstRate),
          }
        : null;
    }
  }
}

const EMPTY_HINT: Record<DebitNoteLineKind, string> = {
  rate: "Add the items whose price went up, then enter the new rate.",
  quantity: "Add the items that were supplied but not billed, then enter the extra quantity.",
  charge: "Add the charges to bill, e.g. Freight charges.",
  tax: "Add the items that were charged too little GST, then pick the correct rate.",
  custom: "Add a line for each amount to charge.",
};

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
  // The search result being loaded, so the clicked row shows a spinner.
  const [pickingId, setPickingId] = useState<string | null>(null);
  const [loadingInitial, setLoadingInitial] = useState(!!initialInvoiceId);
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

  // Only state setters inside, so it never changes.
  const applyInvoice = useCallback((full: Invoice) => {
    setInvoice(full);
    setRows([]);
    // A note can't be dated before its invoice.
    setDate((d) => (d < full.invoice_date ? full.invoice_date : d));
    // GST can't be "too low" on an invoice billed without GST.
    setReason((r) => (r === "tax_rate_correction" && !full.gst_enabled ? "" : r));
  }, []);

  useEffect(() => {
    if (!initialInvoiceId) return;
    let cancelled = false;
    getInvoice(initialInvoiceId)
      .then((full) => {
        if (cancelled) return;
        if (full && full.status === "issued") applyInvoice(full);
        else toast.error("That invoice could not be loaded or is cancelled.");
      })
      .finally(() => { if (!cancelled) setLoadingInitial(false); });
    return () => { cancelled = true; };
  }, [initialInvoiceId, applyInvoice]);

  const selectInvoice = async (id: string) => {
    if (pickingId) return;
    setPickingId(id);
    try {
      const full = await getInvoice(id);
      if (!full || full.status !== "issued") {
        toast.error("That invoice could not be loaded or is cancelled.");
        return;
      }
      applyInvoice(full);
      setInvoiceQuery("");
    } catch {
      toast.error("Could not load the invoice. Check your connection and try again.");
    } finally {
      setPickingId(null);
    }
  };

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
  const items = useMemo(() => invoice?.items ?? [], [invoice]);
  const kind = reason ? lineKindFor(reason) : null;
  const reasonInfo = DEBIT_NOTE_REASONS.find((r) => r.value === reason);
  const chargeRate = principalGstRate(items) ?? defaultRate;

  const changeReason = (next: DebitNoteReason) => {
    // Each reason has its own kind of line; lines entered for another reason don't carry over.
    if (rows.length > 0 && lineKindFor(next) !== kind) toast("Lines cleared for the new reason.", { icon: "ℹ️" });
    if (lineKindFor(next) !== kind) setRows([]);
    setReason(next);
  };

  const patchRow = (key: number, patch: Record<string, string>) =>
    setRows((rs) => rs.map((r) => (r.key === key ? ({ ...r, ...patch } as Row) : r)));
  const removeRow = (key: number) => setRows((rs) => rs.filter((r) => r.key !== key));

  const usedLines = new Set(rows.flatMap((r) => ("line" in r ? [r.line] : [])));
  const freeLines = items.map((l, i) => ({ l, i })).filter(({ i }) => !usedLines.has(i));

  const rowForLine = (i: number): Row | null => {
    const l = items[i];
    if (!l || !kind) return null;
    if (kind === "rate") return { key: nextKey(), kind, line: i, quantity: String(l.quantity), newRate: "" };
    if (kind === "quantity") return { key: nextKey(), kind, line: i, quantity: "", rate: String(billedRate(l)) };
    if (kind === "tax") return { key: nextKey(), kind, line: i, correctRate: "" };
    return null;
  };
  const addInvoiceLine = (i: number) => {
    const row = rowForLine(i);
    if (row) setRows((rs) => [...rs, row]);
  };
  const addAllInvoiceLines = () =>
    setRows((rs) => [...rs, ...freeLines.map(({ i }) => rowForLine(i)).filter((r): r is Row => r !== null)]);
  const addCharge = (label: string) =>
    setRows((rs) => [...rs, { key: nextKey(), kind: "charge", label, amount: "", gstRate: gstEnabled ? String(chargeRate) : "", hsn: "" }]);
  const addCustom = () =>
    setRows((rs) => [...rs, { key: nextKey(), kind: "custom", name: "", description: "", hsn: "", quantity: "1", unitPrice: "", gstRate: "" }]);

  // Live preview with the same rules the server uses.
  const preview = useMemo(() => {
    const complete = rows.map((r) => ({ key: r.key, adj: toAdjustment(r) })).filter((x) => x.adj !== null);
    const built = invoice && reason && complete.length > 0
      ? buildDebitNoteLines({ gst_enabled: invoice.gst_enabled, items }, reason, complete.map((x) => x.adj as DebitNoteAdjustment))
      : null;
    const computed = computeInvoice({
      items: built?.ok ? built.lines : [],
      gstEnabled,
      defaultGstRate: defaultRate,
      sellerStateCode: settings?.state_code,
      placeOfSupplyStateCode: stateCodeOf(supply),
    });
    const amountByKey = new Map<number, number>();
    if (built?.ok) complete.forEach((x, i) => amountByKey.set(x.key, computed.lines[i]?.amount ?? 0));
    return { computed, amountByKey, error: built && !built.ok ? built.error : null };
  }, [rows, invoice, reason, items, gstEnabled, defaultRate, settings?.state_code, supply]);

  const autoPreview = settings
    ? formatInvoiceNumber(
        settings.debit_note_prefix,
        financialYear(),
        settings.debit_note_fy === financialYear() ? settings.debit_note_next_number : 1,
        settings.debit_note_pad
      )
    : "";

  const t = preview.computed.totals;
  const intraState = preview.computed.intraState;

  const submit = () => {
    if (!invoice) return void toast.error("Select the invoice this debit note is for.");
    if (!reason) return void toast.error("Select a reason.");
    if (rows.length === 0) return void toast.error("Add at least one line.");
    const adjustments = rows.map(toAdjustment);
    if (adjustments.some((a) => a === null)) return void toast.error("Fill in every line, or remove the empty ones.");
    if (preview.error) return void toast.error(preview.error);
    startTransition(async () => {
      const res = await issueDebitNote({
        requestId,
        invoiceId: invoice.id,
        debitNoteDate: date,
        reason,
        reasonNote: reasonNote || null,
        manualNumber: manual ? manualNumber : null,
        adjustments: adjustments as DebitNoteAdjustment[],
      });
      if (res.success) {
        toast.success(`Debit note ${res.debitNote.debit_note_number} issued.`);
        onIssued(res.debitNote);
      } else {
        toast.error(res.error);
      }
    });
  };

  const amountCell = (key: number) => {
    const a = preview.amountByKey.get(key);
    return <td className="p-1.5 text-right font-semibold text-slate-900 pt-3 whitespace-nowrap">{a === undefined ? "—" : inr(a)}</td>;
  };
  const removeCell = (key: number) => (
    <td className="p-1.5 pt-2">
      <button type="button" aria-label="Remove line" onClick={() => removeRow(key)} className="text-slate-400 hover:text-red-600">
        <Trash2 className="h-4 w-4" />
      </button>
    </td>
  );
  const itemCell = (i: number) => {
    const l = items[i];
    return (
      <td className="p-2">
        <div className="font-semibold text-slate-900">{l?.name}</div>
        {l?.description ? <div className="text-[11px] text-slate-500">{l.description}</div> : null}
      </td>
    );
  };
  const gstCell = (rate: number) => <td className="p-2 text-center text-slate-600">{gstEnabled ? pct(rate) : "—"}</td>;
  const th = "p-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500";
  const rowClass = "border-t border-slate-100 align-top motion-safe:animate-soft-enter";

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>New Debit Note</DialogTitle>
          <DialogDescription>
            Charge a customer the difference an invoice missed. Pick the invoice and the reason; the form asks for exactly
            what changed and works out the amount and GST.
          </DialogDescription>
        </DialogHeader>

        <div className="grid md:grid-cols-2 gap-5">
          {/* Invoice */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">1. Against Invoice</h3>
            {invoice ? (
              <div key={invoice.id} className="motion-safe:animate-soft-enter">
                <div className="rounded-lg border border-[#024AE5]/30 bg-blue-50/40 p-3 text-xs space-y-1 motion-safe:animate-select-pulse">
                  <div className="flex items-start justify-between gap-2">
                    <span className="inline-flex items-center gap-1.5 font-mono font-bold text-slate-900">
                      <CheckCircle2 className="h-3.5 w-3.5 text-[#024AE5]" aria-hidden />
                      {invoice.invoice_number}
                    </span>
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
                    Dated {fmtDate(invoice.invoice_date)} · Total {inr(Number(invoice.total_amount))} · {items.length} item{items.length === 1 ? "" : "s"}
                  </p>
                  <p className="text-slate-500">
                    {invoice.gst_enabled
                      ? intraState ? "GST: CGST + SGST" : "GST: IGST (inter-state)"
                      : "Non-GST invoice: no GST on this note"}
                    {invoice.place_of_supply ? ` · Place of supply ${invoice.place_of_supply}` : ""}
                  </p>
                </div>
              </div>
            ) : loadingInitial ? (
              <div className="rounded-lg border border-slate-200 p-3 space-y-2" aria-busy="true">
                <p className="flex items-center gap-1.5 text-xs text-slate-500">
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-[#024AE5]" /> Loading invoice…
                </p>
                <Skeleton className="h-3 w-40" />
                <Skeleton className="h-3 w-56" />
              </div>
            ) : (
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
                <Input
                  placeholder={data ? "Search invoice # or customer..." : "Loading invoices..."}
                  value={invoiceQuery}
                  onChange={(e) => setInvoiceQuery(e.target.value)}
                  disabled={!data || !!pickingId}
                  className="pl-8 h-9 text-xs"
                  aria-label="Search invoices"
                />
                {invoiceHits.length > 0 && (
                  <div className="absolute z-10 mt-1 w-full max-h-64 overflow-auto rounded-lg border border-slate-200 bg-white shadow-lg motion-safe:animate-soft-enter">
                    {invoiceHits.map((h) => {
                      const loading = pickingId === h.id;
                      return (
                        <button
                          key={h.id}
                          type="button"
                          onClick={() => selectInvoice(h.id)}
                          disabled={!!pickingId}
                          aria-busy={loading}
                          className={`w-full text-left px-3 py-2 text-xs flex items-center justify-between gap-2 ${
                            loading ? "bg-blue-50" : "hover:bg-blue-50"
                          } ${pickingId && !loading ? "opacity-50" : ""}`}
                        >
                          <span className="min-w-0 truncate">
                            <span className="font-mono font-bold text-slate-900">{h.invoice_number}</span>
                            <span className="text-slate-500"> · {h.customer} · {fmtDate(h.invoice_date)} · {inr(h.total)}</span>
                          </span>
                          {loading && (
                            <span className="inline-flex shrink-0 items-center gap-1 text-[11px] font-semibold text-[#024AE5]">
                              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading…
                            </span>
                          )}
                        </button>
                      );
                    })}
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
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">2. Reason & Details</h3>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <Label>Reason</Label>
                <Select value={reason} onValueChange={(v) => changeReason(v as DebitNoteReason)}>
                  <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Select reason" /></SelectTrigger>
                  <SelectContent className="bg-white">
                    {DEBIT_NOTE_REASONS.map((r) => (
                      <SelectItem
                        key={r.value}
                        value={r.value}
                        disabled={r.value === "tax_rate_correction" && !!invoice && !invoice.gst_enabled}
                        className="text-xs"
                      >
                        {r.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
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
            </div>
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

        {/* Amounts, by reason */}
        <div className="space-y-2">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">3. What to charge</h3>
            {invoice && kind && (kind === "rate" || kind === "quantity" || kind === "tax") && (
              <div className="flex flex-wrap items-center gap-2">
                <Select value="" onValueChange={(v) => addInvoiceLine(Number(v))} disabled={freeLines.length === 0}>
                  <SelectTrigger className="h-9 text-xs sm:w-72" aria-label="Add an item from the invoice">
                    <ListPlus className="h-3.5 w-3.5 text-slate-400 mr-1.5 shrink-0" />
                    <SelectValue placeholder={freeLines.length ? "Add an item from the invoice" : "All items added"} />
                  </SelectTrigger>
                  <SelectContent className="bg-white max-h-64">
                    {freeLines.map(({ l, i }) => (
                      <SelectItem key={i} value={String(i)} className="text-xs">
                        {l.name} · {l.quantity} × {inr(billedRate(l))}{gstEnabled ? ` · GST ${pct(l.gstRate)}` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {kind !== "quantity" && freeLines.length > 1 && (
                  <Button type="button" variant="outline" size="sm" onClick={addAllInvoiceLines}>Add all items</Button>
                )}
              </div>
            )}
            {invoice && kind === "charge" && (
              <div className="flex flex-wrap gap-1.5">
                {DEBIT_NOTE_CHARGE_PRESETS.map((p) => (
                  <Button key={p} type="button" variant="outline" size="sm" className="h-7 gap-1 text-[11px]" onClick={() => addCharge(p)}>
                    <Plus className="h-3 w-3" /> {p}
                  </Button>
                ))}
                <Button type="button" variant="outline" size="sm" className="h-7 gap-1 text-[11px]" onClick={() => addCharge("")}>
                  <Plus className="h-3 w-3" /> Other charge
                </Button>
              </div>
            )}
            {invoice && kind === "custom" && (
              <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={addCustom}>
                <Plus className="h-3.5 w-3.5" /> Add line
              </Button>
            )}
          </div>

          {reasonInfo && invoice && (
            <p key={reasonInfo.value} className="flex items-start gap-2 rounded-lg bg-blue-50/60 border border-blue-100 px-3 py-2 text-[11px] text-slate-700 motion-safe:animate-soft-enter">
              <Info className="h-3.5 w-3.5 text-[#024AE5] shrink-0 mt-px" aria-hidden />
              <span>
                {reasonInfo.formula}
                {kind === "quantity" && " A debit note doesn't change stock: if more units left than were billed, adjust stock in Products."}
              </span>
            </p>
          )}

          <div className="overflow-x-auto rounded-lg border border-slate-200">
            <table className="w-full text-xs min-w-[760px]">
              {kind === "rate" && (
                <thead className="bg-slate-50"><tr>
                  <th className={`${th} text-left`}>Item</th><th className={th}>Billed qty</th><th className={`${th} w-20`}>Qty</th>
                  <th className={th}>Billed rate</th><th className={`${th} w-28`}>New rate</th><th className={th}>Extra / unit</th>
                  <th className={th}>GST</th><th className={`${th} text-right`}>Amount</th><th className="w-8" />
                </tr></thead>
              )}
              {kind === "quantity" && (
                <thead className="bg-slate-50"><tr>
                  <th className={`${th} text-left`}>Item</th><th className={th}>Billed qty</th><th className={`${th} w-24`}>Extra qty</th>
                  <th className={`${th} w-28`}>Rate</th><th className={th}>GST</th><th className={`${th} text-right`}>Amount</th><th className="w-8" />
                </tr></thead>
              )}
              {kind === "charge" && (
                <thead className="bg-slate-50"><tr>
                  <th className={`${th} text-left`}>Charge</th><th className={`${th} w-32`}>Amount</th><th className={`${th} w-28`}>GST %</th>
                  <th className={`${th} w-28`}>HSN/SAC</th><th className={`${th} text-right`}>Total</th><th className="w-8" />
                </tr></thead>
              )}
              {kind === "tax" && (
                <thead className="bg-slate-50"><tr>
                  <th className={`${th} text-left`}>Item</th><th className={th}>Taxable value</th><th className={th}>Charged</th>
                  <th className={`${th} w-32`}>Correct GST %</th><th className={`${th} text-right`}>Extra GST</th><th className="w-8" />
                </tr></thead>
              )}
              {kind === "custom" && (
                <thead className="bg-slate-50"><tr>
                  <th className={`${th} text-left`}>Item / charge</th><th className={`${th} w-20`}>Qty</th><th className={`${th} w-28`}>Rate</th>
                  <th className={`${th} w-20`}>GST %</th><th className={`${th} text-right`}>Amount</th><th className="w-8" />
                </tr></thead>
              )}
              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="p-5 text-center text-[11px] text-slate-500">
                      {!invoice ? "Select an invoice first." : !kind ? "Select a reason to see what to enter." : EMPTY_HINT[kind]}
                    </td>
                  </tr>
                ) : (
                  rows.map((r) => {
                    if (r.kind === "rate") {
                      const l = items[r.line];
                      const billed = l ? billedRate(l) : 0;
                      const extra = Number.isFinite(num(r.newRate)) ? round2(num(r.newRate) - billed) : null;
                      return (
                        <tr key={r.key} className={rowClass}>
                          {itemCell(r.line)}
                          <td className="p-2 text-center text-slate-600">{l?.quantity}</td>
                          <td className="p-1.5"><Input type="number" min={1} max={l?.quantity} value={r.quantity} onChange={(e) => patchRow(r.key, { quantity: e.target.value })} className="h-8 text-xs" aria-label="Quantity" /></td>
                          <td className="p-2 text-center text-slate-600 whitespace-nowrap">{inr(billed)}</td>
                          <td className="p-1.5"><Input type="number" min={0} step="0.01" placeholder={String(billed)} value={r.newRate} onChange={(e) => patchRow(r.key, { newRate: e.target.value })} className="h-8 text-xs" aria-label="New rate" /></td>
                          <td className={`p-2 text-center whitespace-nowrap ${extra !== null && extra <= 0 ? "text-red-600" : "text-slate-700"}`}>
                            {extra === null ? "—" : `${extra > 0 ? "+" : ""}${inr(extra)}`}
                          </td>
                          {gstCell(l?.gstRate ?? 0)}
                          {amountCell(r.key)}
                          {removeCell(r.key)}
                        </tr>
                      );
                    }
                    if (r.kind === "quantity") {
                      const l = items[r.line];
                      return (
                        <tr key={r.key} className={rowClass}>
                          {itemCell(r.line)}
                          <td className="p-2 text-center text-slate-600">{l?.quantity}</td>
                          <td className="p-1.5"><Input type="number" min={1} placeholder="0" value={r.quantity} onChange={(e) => patchRow(r.key, { quantity: e.target.value })} className="h-8 text-xs" aria-label="Extra quantity" /></td>
                          <td className="p-1.5"><Input type="number" min={0} step="0.01" value={r.rate} onChange={(e) => patchRow(r.key, { rate: e.target.value })} className="h-8 text-xs" aria-label="Rate" /></td>
                          {gstCell(l?.gstRate ?? 0)}
                          {amountCell(r.key)}
                          {removeCell(r.key)}
                        </tr>
                      );
                    }
                    if (r.kind === "charge") {
                      return (
                        <tr key={r.key} className={rowClass}>
                          <td className="p-1.5"><Input placeholder="e.g. Freight charges" value={r.label} onChange={(e) => patchRow(r.key, { label: e.target.value })} className="h-8 text-xs" aria-label="Charge name" /></td>
                          <td className="p-1.5"><Input type="number" min={0} step="0.01" placeholder="0.00" value={r.amount} onChange={(e) => patchRow(r.key, { amount: e.target.value })} className="h-8 text-xs" aria-label="Charge amount" /></td>
                          <td className="p-1.5">
                            {gstEnabled ? (
                              <Select value={r.gstRate} onValueChange={(v) => patchRow(r.key, { gstRate: v })}>
                                <SelectTrigger className="h-8 text-xs" aria-label="GST %"><SelectValue /></SelectTrigger>
                                <SelectContent className="bg-white">
                                  {[...new Set<number>([...GST_RATE_OPTIONS, chargeRate])].sort((a, b) => a - b).map((g) => (
                                    <SelectItem key={g} value={String(g)} className="text-xs">{pct(g)}{g === chargeRate ? " (goods' rate)" : ""}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            ) : (
                              <span className="block pt-2 text-center text-slate-500">—</span>
                            )}
                          </td>
                          <td className="p-1.5"><Input placeholder="Optional" value={r.hsn} onChange={(e) => patchRow(r.key, { hsn: e.target.value })} className="h-8 text-xs" aria-label="HSN or SAC" /></td>
                          {amountCell(r.key)}
                          {removeCell(r.key)}
                        </tr>
                      );
                    }
                    if (r.kind === "tax") {
                      const l = items[r.line];
                      const charged = l?.gstRate ?? 0;
                      const options = GST_RATE_OPTIONS.filter((g) => g > charged);
                      return (
                        <tr key={r.key} className={rowClass}>
                          {itemCell(r.line)}
                          <td className="p-2 text-center text-slate-600 whitespace-nowrap">{inr(l?.taxable ?? 0)}</td>
                          <td className="p-2 text-center text-slate-600">{pct(charged)}</td>
                          <td className="p-1.5">
                            <Select value={r.correctRate} onValueChange={(v) => patchRow(r.key, { correctRate: v })}>
                              <SelectTrigger className="h-8 text-xs" aria-label="Correct GST %"><SelectValue placeholder="Select" /></SelectTrigger>
                              <SelectContent className="bg-white">
                                {options.map((g) => (
                                  <SelectItem key={g} value={String(g)} className="text-xs">{pct(g)}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </td>
                          {amountCell(r.key)}
                          {removeCell(r.key)}
                        </tr>
                      );
                    }
                    return (
                      <tr key={r.key} className={rowClass}>
                        <td className="p-1.5">
                          <Input placeholder="Item name or charge" value={r.name} onChange={(e) => patchRow(r.key, { name: e.target.value })} className="h-8 text-xs" aria-label="Item name" />
                          <Input placeholder="Description (optional)" value={r.description} onChange={(e) => patchRow(r.key, { description: e.target.value })} className="h-7 text-[11px] mt-1 text-slate-500" aria-label="Description" />
                        </td>
                        <td className="p-1.5"><Input type="number" min={0} value={r.quantity} onChange={(e) => patchRow(r.key, { quantity: e.target.value })} className="h-8 text-xs" aria-label="Quantity" /></td>
                        <td className="p-1.5"><Input type="number" min={0} step="0.01" placeholder="0.00" value={r.unitPrice} onChange={(e) => patchRow(r.key, { unitPrice: e.target.value })} className="h-8 text-xs" aria-label="Rate" /></td>
                        <td className="p-1.5"><Input type="number" min={0} max={100} step="0.01" placeholder={String(defaultRate)} disabled={!gstEnabled} value={r.gstRate} onChange={(e) => patchRow(r.key, { gstRate: e.target.value })} className="h-8 text-xs" aria-label="GST %" /></td>
                        {amountCell(r.key)}
                        {removeCell(r.key)}
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
          {preview.error && (
            <p role="alert" className="text-[11px] font-medium text-red-600">{preview.error}</p>
          )}
        </div>

        {/* Totals */}
        <div className="ml-auto w-full sm:w-72 space-y-1 text-xs">
          <div className="flex justify-between"><span className="text-slate-500">Taxable amount</span><span>{inr(t.taxableTotal)}</span></div>
          {gstEnabled && (intraState ? (
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
          <Button onClick={submit} disabled={pending || !invoice || !reason || rows.length === 0} className="gap-1.5">
            {pending && <Loader2 className="h-4 w-4 animate-spin" />}
            {pending ? "Issuing..." : "Issue Debit Note"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
