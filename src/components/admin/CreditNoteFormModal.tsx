"use client";

import { useState, useTransition } from "react";
import toast from "react-hot-toast";
import { issueCreditNote, type CreditNoteFormData } from "@/actions/credit-note";
import { computeCreditNote, type CreditNote } from "@/lib/credit-note";
import { financialYear, formatInvoiceNumber } from "@/lib/invoice";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";

const money = (n: number) => n.toLocaleString("en-IN", { style: "currency", currency: "INR" });
const today = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());

export function CreditNoteFormModal({ data, notes, initialInvoiceId, onClose, onIssued }: {
  data: CreditNoteFormData; notes: CreditNote[]; initialInvoiceId?: string;
  onClose: () => void; onIssued: (note: CreditNote) => void;
}) {
  const [invoiceId, setInvoiceId] = useState(initialInvoiceId ?? "");
  const [quantities, setQuantities] = useState<Record<number, string>>({});
  const [date, setDate] = useState(today);
  const [reason, setReason] = useState("");
  const [mode, setMode] = useState("auto");
  const [manualNumber, setManualNumber] = useState("");
  const [treatment, setTreatment] = useState<"gst" | "commercial">("commercial");
  const [confirmedTax, setConfirmedTax] = useState(false);
  const [requestId] = useState(() => crypto.randomUUID());
  const [pending, startTransition] = useTransition();
  const invoice = data.invoices.find((i) => i.id === invoiceId);
  const previous = notes.filter((n) => n.invoice_id === invoiceId);
  const used = (index: number) => previous.reduce((sum, n) => sum + n.items.filter((l) => l.sourceIndex === index).reduce((s, l) => s + l.quantity, 0), 0);
  const selection = Object.entries(quantities).filter(([, q]) => q !== "" && Number(q) !== 0).map(([index, q]) => ({ index: Number(index), quantity: Number(q) }));
  let preview: ReturnType<typeof computeCreditNote> | null = null;
  let previewError = "";
  if (invoice && selection.length) {
    try { preview = computeCreditNote(invoice, previous, selection, treatment); }
    catch (error) { previewError = error instanceof Error ? error.message : "Check quantities."; }
  }
  const fy = financialYear();
  const settings = data.settings;
  const next = formatInvoiceNumber(settings.credit_note_prefix, fy, settings.credit_note_fy === fy ? settings.credit_note_next_number : 1, settings.credit_note_pad);
  const priorTotal = previous.reduce((s, n) => s + n.total_amount, 0);
  const submit = () => startTransition(async () => {
    const result = await issueCreditNote({ invoiceId, requestId, date, reason, treatment, manualNumber: mode === "manual" ? manualNumber.trim() : null, lines: selection });
    if (!result.success) return void toast.error(result.error);
    toast.success(`Credit note ${result.note.credit_note_number} issued.`);
    onIssued(result.note);
  });

  return <Dialog open onOpenChange={(open) => { if (!open && !pending) onClose(); }}>
    <DialogContent className="max-w-4xl">
      <DialogHeader><DialogTitle>New Credit Note</DialogTitle><DialogDescription>Select invoice quantities to credit. Issued notes are permanent; inventory and payments are managed separately.</DialogDescription></DialogHeader>
      <div className="space-y-5">
        <div className="space-y-2"><Label>Source invoice</Label>
          <Select value={invoiceId} disabled={pending} onValueChange={(id) => { setInvoiceId(id); setQuantities({}); setTreatment("commercial"); setConfirmedTax(false); }}>
            <SelectTrigger aria-label="Source invoice"><SelectValue placeholder="Select an issued invoice" /></SelectTrigger>
            <SelectContent>{data.invoices.map((i) => <SelectItem key={i.id} value={i.id}>{i.invoice_number} · {i.bill_to.name} · {money(i.total_amount)}</SelectItem>)}</SelectContent>
          </Select>
          {!data.invoices.length && <p className="text-sm text-slate-500">Create an invoice before issuing a credit note.</p>}
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-2"><Label>Numbering</Label><Select value={mode} onValueChange={setMode} disabled={pending}><SelectTrigger aria-label="Numbering"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="auto">Auto</SelectItem><SelectItem value="manual">Manual</SelectItem></SelectContent></Select></div>
          <div className="space-y-2"><Label htmlFor="cn-number">Credit note number</Label><Input id="cn-number" value={mode === "auto" ? next : manualNumber} readOnly={mode === "auto"} disabled={pending} maxLength={16} onChange={(e) => setManualNumber(e.target.value)} /><p className="text-xs text-slate-500">{mode === "auto" ? "Preview only. The next available number is assigned on issue." : "Manual numbers do not advance the automatic counter."}</p></div>
          <div className="space-y-2"><Label htmlFor="cn-date">Date</Label><Input id="cn-date" type="date" value={date} max={today()} disabled={pending} min={invoice?.invoice_date} onChange={(e) => setDate(e.target.value)} /><p className="text-xs text-slate-500">Issue in the current financial year ({fy}).</p></div>
        </div>
        <div className="space-y-2"><Label htmlFor="cn-reason">Reason</Label><Textarea id="cn-reason" placeholder="For example, damaged goods returned" maxLength={1000} value={reason} disabled={pending} onChange={(e) => setReason(e.target.value)} /></div>
        <div className="space-y-2"><Label>Tax treatment</Label><Select value={treatment} disabled={pending} onValueChange={(v) => { setTreatment(v as typeof treatment); setConfirmedTax(false); }}><SelectTrigger aria-label="Tax treatment"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="commercial">Commercial credit — no GST adjustment</SelectItem>{invoice?.gst_enabled && <SelectItem value="gst">GST credit — reverse original tax proportionally</SelectItem>}</SelectContent></Select>
          <p className="text-xs text-slate-500">Commercial credits include the selected original line value with no GST reversal. GST credits use the invoice&apos;s original tax split.</p>
          {treatment === "gst" && <label className="flex items-start gap-2 text-sm"><input type="checkbox" className="mt-1 accent-[#024AE5]" checked={confirmedTax} disabled={pending} onChange={(e) => setConfirmedTax(e.target.checked)} />I have checked GST adjustment eligibility and the reporting deadline. Issuing this note does not file a GST return.</label>}
        </div>
        {invoice && <>
          <div className="flex flex-wrap justify-between gap-2 text-sm"><p>Invoice {money(invoice.total_amount)} · Already credited {money(priorTotal)}</p><Button variant="outline" size="sm" disabled={pending} onClick={() => setQuantities(Object.fromEntries(invoice.items.map((l, i) => [i, String(Math.max(0, l.quantity - used(i)))])))}>Credit all remaining quantities</Button></div>
          <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b text-left text-slate-500"><th className="py-2">Item</th><th>Original qty</th><th>Remaining qty</th><th className="w-32">Credit qty</th></tr></thead><tbody>{invoice.items.map((line, index) => <tr key={index} className="border-b"><td className="py-3 pr-3">{line.name}<span className="block text-xs text-slate-500">{line.sku}</span></td><td>{line.quantity}</td><td>{Math.max(0, line.quantity - used(index))}</td><td><Input type="number" aria-label={`Credit quantity for ${line.name}`} min={0} max={Math.max(0, line.quantity - used(index))} step="any" disabled={pending || used(index) >= line.quantity} value={quantities[index] ?? ""} placeholder="0" onChange={(e) => setQuantities((q) => ({ ...q, [index]: e.target.value }))} /></td></tr>)}</tbody></table></div>
        </>}
        {previewError && <p role="alert" className="text-sm text-red-600">{previewError}</p>}
        {preview && <div className="rounded-lg bg-slate-50 p-4 text-sm"><div className="flex justify-between"><span>{treatment === "gst" ? "Taxable credit" : "Commercial credit"}</span><span>{money(preview.totals.taxableTotal)}</span></div><div className="flex justify-between"><span>GST adjustment</span><span>{money(preview.totals.cgstTotal + preview.totals.sgstTotal + preview.totals.igstTotal)}</span></div><div className="flex justify-between"><span>Round off</span><span>{money(preview.totals.roundOff)}</span></div><div className="mt-2 flex justify-between font-semibold text-[#024AE5]"><span>Total credit</span><span>{money(preview.totals.total)}</span></div><div className="mt-2 flex justify-between"><span>Net invoice value after this credit</span><span>{money((invoice?.total_amount ?? 0) - priorTotal - preview.totals.total)}</span></div></div>}
      </div>
      <DialogFooter><Button variant="outline" disabled={pending} onClick={onClose}>Close</Button><Button disabled={pending || !preview || preview.totals.total <= 0 || reason.trim().length < 3 || (mode === "manual" && !/^[A-Za-z0-9/-]{1,16}$/.test(manualNumber.trim())) || (treatment === "gst" && !confirmedTax)} onClick={submit}>{pending ? "Issuing…" : "Issue Credit Note"}</Button></DialogFooter>
    </DialogContent>
  </Dialog>;
}
