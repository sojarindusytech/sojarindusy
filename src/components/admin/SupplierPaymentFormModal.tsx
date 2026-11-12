"use client";

import { useState, useTransition } from "react";
import toast from "react-hot-toast";
import { recordSupplierPaymentAction, type SupplierPaymentFormData } from "@/actions/supplier-payment";
import { PAYMENT_MODES } from "@/lib/payments";
import { financialYear, formatInvoiceNumber } from "@/lib/invoice";
import { todayIst } from "@/lib/ledger";
import type { SupplierPayment } from "@/types/database.types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const NO_SPINNER = "[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none";

/** Record money paid to a manufacturer. Mounted only while open, so state starts fresh each time. */
export function SupplierPaymentFormModal({
  data,
  onOpenChange,
  onCreated,
}: {
  data: SupplierPaymentFormData | null;
  onOpenChange: (open: boolean) => void;
  onCreated: (payment: SupplierPayment) => void;
}) {
  const [requestId] = useState(() => crypto.randomUUID());
  const [manufacturerId, setManufacturerId] = useState(() => (data?.manufacturers.length === 1 ? data.manufacturers[0].id : ""));
  const [date, setDate] = useState(todayIst());
  const [amount, setAmount] = useState("");
  const [mode, setMode] = useState("bank_transfer");
  const [accountPick, setAccountPick] = useState<string | null>(null);
  const [reference, setReference] = useState("");
  const [billReference, setBillReference] = useState("");
  const [remarks, setRemarks] = useState("");
  const [pending, startTransition] = useTransition();

  const accounts = data?.accounts ?? [];
  const wantKind = mode === "cash" ? "cash" : "bank";
  const defaultAccount = (accounts.find((a) => a.kind === wantKind && a.is_default) ?? accounts.find((a) => a.kind === wantKind) ?? accounts[0])?.id ?? "";
  const accountId = accountPick ?? defaultAccount;

  const s = data?.settings;
  const fy = financialYear();
  const nextNumber = s
    ? formatInvoiceNumber(s.supplier_payment_prefix ?? "SI/PAY", fy, s.supplier_payment_fy === fy ? s.supplier_payment_next_number ?? 1 : 1, s.supplier_payment_pad ?? 2)
    : null;

  const amountNum = Number(amount) || 0;
  const problem = !manufacturerId ? "Pick the manufacturer." : amountNum <= 0 ? "Enter the amount paid." : !accountId ? "Pick the account it was paid from." : null;

  const submit = () =>
    startTransition(async () => {
      const res = await recordSupplierPaymentAction({
        requestId,
        manufacturerId,
        paymentDate: date,
        amount: amountNum,
        mode,
        accountId,
        reference,
        billReference,
        remarks,
      });
      if (res.success) {
        toast.success(`Payment ${res.payment.voucher_number} recorded.`);
        onCreated(res.payment);
      } else {
        toast.error(res.error);
      }
    });

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Record Payment Made</DialogTitle>
          <DialogDescription>
            Money paid to a manufacturer. It is posted to their ledger and taken out of the bank or cash account.
            {nextNumber && <> Next number: <span className="font-mono font-semibold text-slate-900">{nextNumber}</span>.</>}
          </DialogDescription>
        </DialogHeader>

        <div className="grid sm:grid-cols-2 gap-3">
          <div className="space-y-1.5 sm:col-span-2">
            <Label>Paid to</Label>
            <Select disabled={!data} value={manufacturerId} onValueChange={setManufacturerId}>
              <SelectTrigger className="h-9 text-xs"><SelectValue placeholder={data ? (data.manufacturers.length ? "Select manufacturer" : "No manufacturer accounts yet") : "Loading…"} /></SelectTrigger>
              <SelectContent className="bg-white max-h-64">
                {data?.manufacturers.map((m) => (<SelectItem key={m.id} value={m.id} className="text-xs">{m.name}</SelectItem>))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="sp-date">Payment date</Label>
            <Input id="sp-date" type="date" max={todayIst()} value={date} onChange={(e) => setDate(e.target.value)} className="h-9 text-xs" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="sp-amount">Amount paid (₹)</Label>
            <Input id="sp-amount" type="number" min={0} step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} className={`h-9 text-xs ${NO_SPINNER}`} />
          </div>
          <div className="space-y-1.5">
            <Label>Paid through</Label>
            <Select value={mode} onValueChange={setMode}>
              <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent className="bg-white">
                {PAYMENT_MODES.map((m) => (<SelectItem key={m.value} value={m.value} className="text-xs">{m.label}</SelectItem>))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Paid from</Label>
            <Select disabled={!data || accounts.length === 0} value={accountId} onValueChange={setAccountPick}>
              <SelectTrigger className="h-9 text-xs"><SelectValue placeholder={accounts.length ? "Bank / cash account" : "Add a bank account in Sales Settings"} /></SelectTrigger>
              <SelectContent className="bg-white">
                {accounts.map((a) => (
                  <SelectItem key={a.id} value={a.id} className="text-xs">{a.name}{a.kind === "bank" && a.account_no ? ` (…${a.account_no.slice(-4)})` : ""}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="sp-ref">UTR / cheque no.</Label>
            <Input id="sp-ref" value={reference} maxLength={100} onChange={(e) => setReference(e.target.value)} className="h-9 text-xs" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="sp-bill">Against bill / PO (optional)</Label>
            <Input id="sp-bill" value={billReference} maxLength={200} onChange={(e) => setBillReference(e.target.value)} placeholder="e.g. their bill no. or SI/PO/26-27/04" className="h-9 text-xs" />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="sp-remarks">Remarks</Label>
            <Textarea id="sp-remarks" rows={2} value={remarks} maxLength={1000} onChange={(e) => setRemarks(e.target.value)} className="text-xs" />
          </div>
        </div>

        <DialogFooter className="items-center">
          {problem && <p className="mr-auto text-[11px] text-amber-700">{problem}</p>}
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>Cancel</Button>
          <Button onClick={submit} disabled={pending || !!problem}>{pending ? "Saving..." : "Record payment"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
