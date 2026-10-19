"use client";

import { useMemo, useState, useTransition } from "react";
import toast from "react-hot-toast";
import { Wand2 } from "lucide-react";
import { recordPayment, type PaymentFormData } from "@/actions/payment";
import {
  PAYMENT_CHANNELS,
  PAYMENT_MODES,
  autoAllocate,
  defaultChannel,
  fromPaise,
  toPaise,
  validateAllocations,
  type PaymentChannel,
} from "@/lib/payments";
import { financialYear, formatInvoiceNumber } from "@/lib/invoice";
import type { Payment } from "@/types/database.types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";

const WALK_IN = "__walkin__";
/** Hides the up/down spinner arrows on number inputs (Chrome/Safari + Firefox). */
const NO_SPINNER = "[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none";
const inr = (n: number) => `₹${n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const today = () => new Date().toISOString().slice(0, 10);
const fmtDate = (iso: string) => iso.split("-").reverse().join("-");

/** Record a payment received. The parent mounts it only while open, so state starts fresh each time. */
export function PaymentFormModal({
  data,
  initialInvoiceId,
  onOpenChange,
  onCreated,
}: {
  /** Prefetched by the parent so the dropdowns are ready on open. null while it is still loading. */
  data: PaymentFormData | null;
  /** Preselect this invoice or debit note (the "Record payment" action on its row). */
  initialInvoiceId?: string | null;
  onOpenChange: (open: boolean) => void;
  onCreated: (payment: Payment) => void;
}) {
  const [pending, startTransition] = useTransition();
  // One id per form open: a retried or double-clicked submit returns the same receipt.
  const [requestId] = useState(() => crypto.randomUUID());

  const [customerId, setCustomerId] = useState<string>("");
  const [payerName, setPayerName] = useState("");
  const [date, setDate] = useState(today());
  const [amount, setAmount] = useState("");
  const [mode, setMode] = useState<string>("bank_transfer");
  const [channelOverride, setChannelOverride] = useState<PaymentChannel | null>(null);
  const [reference, setReference] = useState("");
  const [deposit, setDeposit] = useState("");
  const [remarks, setRemarks] = useState("");
  const [manual, setManual] = useState(false);
  const [manualNumber, setManualNumber] = useState("");
  // invoice id -> amount typed (string so partial input like "12." works)
  const [applied, setApplied] = useState<Record<string, string>>({});
  const [remainderKind, setRemainderKind] = useState<"advance" | "other">("advance");
  const [otherNote, setOtherNote] = useState("");

  // Preselect the invoice this was opened from: immediately when the data is prefetched, otherwise as
  // soon as it arrives (done during render, so there is no empty first paint).
  const [seeded, setSeeded] = useState(false);
  if (data && initialInvoiceId && !seeded) {
    setSeeded(true);
    const preset = data.invoices.find((i) => i.id === initialInvoiceId);
    if (preset) {
      setCustomerId(preset.user_id ?? WALK_IN);
      setPayerName(preset.user_id ? "" : preset.bill_to_name);
      setAmount(String(preset.balance));
      setApplied({ [preset.id]: String(preset.balance) });
    }
  }

  const isWalkIn = customerId === WALK_IN;
  const customer = data?.customers.find((c) => c.id === customerId);

  const openInvoices = useMemo(() => {
    if (!data || !customerId) return [];
    return data.invoices.filter((i) => (isWalkIn ? i.user_id === null : i.user_id === customerId));
  }, [data, customerId, isWalkIn]);
  const balances = useMemo(() => Object.fromEntries(openInvoices.map((i) => [i.id, i.balance])), [openInvoices]);
  const isDebitNote = (id: string) => openInvoices.find((i) => i.id === id)?.kind === "debit_note";

  const amountNum = Number(amount) || 0;
  const invoiceLines = openInvoices
    .map((i) => ({ invoiceId: i.id, amount: Number(applied[i.id]) || 0 }))
    .filter((l) => l.amount > 0);
  const allocatedPaise = invoiceLines.reduce((s, l) => s + toPaise(l.amount), 0);
  const remainder = fromPaise(toPaise(amountNum) - allocatedPaise);
  const errors = validateAllocations({ amount: amountNum, invoiceLines, remainder, balances });

  const channel: PaymentChannel =
    channelOverride ??
    defaultChannel(
      openInvoices.filter((i) => (Number(applied[i.id]) || 0) > 0),
      customer?.channel
    );

  const receiptPreview = data?.settings
    ? formatInvoiceNumber(
        data.settings.receipt_prefix,
        financialYear(),
        data.settings.receipt_fy === financialYear() ? data.settings.receipt_next_number : 1,
        data.settings.receipt_pad
      )
    : "";

  const pickCustomer = (id: string) => {
    setCustomerId(id);
    setApplied({});
    setChannelOverride(null);
  };

  const toggleInvoice = (id: string, balance: number, on: boolean) =>
    setApplied((prev) => {
      const next = { ...prev };
      if (!on) {
        delete next[id];
        return next;
      }
      // Take what is still unallocated, up to the invoice balance.
      const used = Object.entries(prev).reduce((s, [k, v]) => (k === id ? s : s + toPaise(Number(v) || 0)), 0);
      const free = Math.max(0, toPaise(amountNum) - used);
      next[id] = String(fromPaise(Math.min(free > 0 ? free : toPaise(balance), toPaise(balance))));
      return next;
    });

  const runAutoAllocate = () => {
    const r = autoAllocate(amountNum, openInvoices);
    setApplied(Object.fromEntries(r.lines.map((l) => [l.invoiceId, String(l.amount)])));
  };

  const submit = () => {
    if (errors.length > 0) return void toast.error(errors[0]);
    if (!customerId) return void toast.error("Select a customer, or choose walk-in.");
    if (isWalkIn && !payerName.trim()) return void toast.error("Enter the payer's name.");

    startTransition(async () => {
      const allocations = [
        ...invoiceLines.map((l) =>
          isDebitNote(l.invoiceId)
            ? { kind: "debit_note" as const, debitNoteId: l.invoiceId, amount: l.amount }
            : { kind: "invoice" as const, invoiceId: l.invoiceId, amount: l.amount }
        ),
        ...(toPaise(remainder) > 0
          ? [{ kind: remainderKind, amount: remainder, note: remainderKind === "other" ? otherNote : null }]
          : []),
      ];
      const res = await recordPayment({
        requestId,
        customerId: isWalkIn ? null : customerId,
        payerName: isWalkIn ? payerName : null,
        paymentDate: date,
        amount: amountNum,
        mode,
        channel,
        reference,
        depositAccount: deposit,
        remarks,
        manualNumber: manual ? manualNumber : null,
        allocations,
      });
      if (res.success) {
        toast.success(`Receipt ${res.payment.receipt_number} recorded.`);
        onCreated(res.payment);
      } else {
        toast.error(res.error);
      }
    });
  };

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>Record Payment Received</DialogTitle>
          <DialogDescription>Cash, cheque, bank transfer, UPI, card and more. Split it across invoices and debit notes, or keep it as an advance.</DialogDescription>
        </DialogHeader>

        <div className="grid md:grid-cols-2 gap-5">
          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">Received from</h3>
            <Select disabled={!data} value={customerId} onValueChange={pickCustomer}>
              <SelectTrigger className="h-9 text-xs"><SelectValue placeholder={data ? "Select customer" : "Loading customers…"} /></SelectTrigger>
              <SelectContent className="bg-white max-h-64">
                <SelectItem value={WALK_IN} className="text-xs italic">Walk-in / unregistered payer</SelectItem>
                {data?.customers.map((c) => (
                  <SelectItem key={c.id} value={c.id} className="text-xs">{c.company_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {isWalkIn && (
              <Input placeholder="Payer name *" value={payerName} onChange={(e) => setPayerName(e.target.value)} className="h-9 text-xs" />
            )}
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <Label>Payment date</Label>
                <Input type="date" max={today()} value={date} onChange={(e) => setDate(e.target.value)} className="h-9 text-xs" />
              </div>
              <div className="space-y-1.5">
                <Label>Amount received (₹)</Label>
                <Input type="number" min={0} step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} className={`h-9 text-xs ${NO_SPINNER}`} />
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">Payment details</h3>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <Label>Received through</Label>
                <Select value={mode} onValueChange={setMode}>
                  <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-white">
                    {PAYMENT_MODES.map((m) => (
                      <SelectItem key={m.value} value={m.value} className="text-xs">{m.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Channel</Label>
                <Select value={channel} onValueChange={(v) => setChannelOverride(v as PaymentChannel)}>
                  <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-white">
                    {PAYMENT_CHANNELS.map((c) => (
                      <SelectItem key={c.value} value={c.value} className="text-xs">{c.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Input placeholder="UTR / cheque no. / txn id" value={reference} onChange={(e) => setReference(e.target.value)} className="h-9 text-xs" />
              <Input placeholder="Deposited in (bank / cash book)" value={deposit} onChange={(e) => setDeposit(e.target.value)} className="h-9 text-xs" />
            </div>
            <div className="space-y-1.5">
              <label className="flex items-center gap-2 text-xs font-semibold text-slate-800 cursor-pointer">
                <input type="checkbox" checked={manual} onChange={(e) => setManual(e.target.checked)} className="h-4 w-4 accent-[#024AE5]" />
                Enter receipt number manually
              </label>
              {manual ? (
                <Input placeholder="e.g. SI/RCPT/25-26/04" value={manualNumber} onChange={(e) => setManualNumber(e.target.value)} className="h-9 text-xs font-mono" />
              ) : (
                <p className="text-[11px] text-slate-500">Next receipt: <span className="font-mono font-bold text-slate-800">{receiptPreview || "…"}</span></p>
              )}
            </div>
          </div>
        </div>

        {/* Allocation */}
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">Apply to invoices &amp; debit notes</h3>
            <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={runAutoAllocate} disabled={openInvoices.length === 0 || amountNum <= 0}>
              <Wand2 className="h-3.5 w-3.5" /> Auto-allocate (oldest first)
            </Button>
          </div>

          <div className="rounded-lg border border-slate-200 overflow-x-auto">
            <table className="w-full text-xs min-w-[560px]">
              <thead className="bg-slate-50 text-[11px] uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="w-8 p-2" />
                  <th className="text-left p-2">Document</th>
                  <th className="text-left p-2">Date</th>
                  <th className="text-right p-2">Total</th>
                  <th className="text-right p-2">Balance</th>
                  <th className="text-right p-2 w-36">Apply (₹)</th>
                </tr>
              </thead>
              <tbody>
                {!customerId ? (
                  <tr><td colSpan={6} className="p-4 text-center text-slate-400">Select a customer to see their open invoices and debit notes.</td></tr>
                ) : openInvoices.length === 0 ? (
                  <tr><td colSpan={6} className="p-4 text-center text-slate-400">Nothing outstanding. The payment can be kept as an advance or other.</td></tr>
                ) : (
                  openInvoices.map((i) => {
                    const on = i.id in applied;
                    return (
                      <tr key={i.id} className="border-t border-slate-100">
                        <td className="p-2"><input type="checkbox" checked={on} onChange={(e) => toggleInvoice(i.id, i.balance, e.target.checked)} aria-label={`Apply to ${i.invoice_number}`} className="h-4 w-4 accent-[#024AE5]" /></td>
                        <td className="p-2">
                          <span className="font-mono font-bold text-slate-900">{i.invoice_number}</span>
                          {i.kind === "debit_note" && (
                            <span className="ml-1.5 rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800 ring-1 ring-amber-200">Debit note</span>
                          )}
                        </td>
                        <td className="p-2 text-slate-500">{fmtDate(i.invoice_date)}</td>
                        <td className="p-2 text-right text-slate-600">{inr(i.total)}</td>
                        <td className="p-2 text-right font-semibold text-slate-900">{inr(i.balance)}</td>
                        <td className="p-2">
                          <Input
                            type="number"
                            min={0}
                            max={i.balance}
                            step="0.01"
                            disabled={!on}
                            value={applied[i.id] ?? ""}
                            // An invoice can never be paid more than what is outstanding on it.
                            onChange={(e) => setApplied((p) => ({ ...p, [i.id]: Number(e.target.value) > i.balance ? String(i.balance) : e.target.value }))}
                            className={`h-8 text-xs text-right ${NO_SPINNER}`}
                          />
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2">
              <span className="text-slate-500">Remaining {inr(Math.max(0, remainder))} kept as</span>
              <Select value={remainderKind} onValueChange={(v) => setRemainderKind(v as "advance" | "other")}>
                <SelectTrigger className="h-8 w-[130px] text-xs"><SelectValue /></SelectTrigger>
                <SelectContent className="bg-white">
                  <SelectItem value="advance" className="text-xs">Advance payment</SelectItem>
                  <SelectItem value="other" className="text-xs">Other</SelectItem>
                </SelectContent>
              </Select>
              {remainderKind === "other" && (
                <Input placeholder="What for?" value={otherNote} onChange={(e) => setOtherNote(e.target.value)} className="h-8 w-48 text-xs" />
              )}
            </div>
            <span className={errors.length ? "text-rose-600 font-medium" : "text-emerald-700 font-medium"}>
              {errors.length ? errors[0] : `Allocated ${inr(amountNum)} ✓`}
            </span>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label>Remarks</Label>
          <Textarea rows={2} value={remarks} onChange={(e) => setRemarks(e.target.value)} className="text-xs" />
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>Cancel</Button>
          <Button onClick={submit} disabled={pending || errors.length > 0}>{pending ? "Saving..." : "Record Payment"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
