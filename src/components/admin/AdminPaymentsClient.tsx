"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { Ban, Calendar, Download, Eye, HandCoins, Search, Wallet } from "lucide-react";
import { cancelPayment, getPaymentFormData, type PaymentFormData } from "@/actions/payment";
import { PAYMENT_CHANNELS, PAYMENT_MODES, modeLabel } from "@/lib/payments";
import { DATE_RANGE_OPTIONS, isWithinDateRange, type DateRangeKey } from "@/lib/date-range";
import type { Payment } from "@/types/database.types";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { PaginationBar, usePagination } from "@/components/common/Pagination";
import { PaymentFormModal } from "./PaymentFormModal";

const inr = (n: number) => `₹${n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtDate = (iso: string) => iso.split("-").reverse().join("-");
const channelLabel = (c: string) => PAYMENT_CHANNELS.find((x) => x.value === c)?.label ?? c;

function appliedTo(p: Payment): string {
  const parts = (p.allocations ?? []).map((a) => (a.kind === "invoice" ? a.invoice_number ?? "Invoice" : a.kind === "advance" ? "Advance" : a.note ? `Other (${a.note})` : "Other"));
  return parts.length ? parts.join(", ") : "—";
}

export function AdminPaymentsClient({ initialPayments }: { initialPayments: Payment[] }) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [mode, setMode] = useState("all");
  const [channel, setChannel] = useState("all");
  const [status, setStatus] = useState<"all" | "received" | "cancelled">("all");
  const [dateRange, setDateRange] = useState<DateRangeKey>("all");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");

  const [creating, setCreating] = useState(false);
  const [viewing, setViewing] = useState<Payment | null>(null);
  // Id of the receipt whose PDF has finished loading; the skeleton shows until it matches.
  const [loadedPdfId, setLoadedPdfId] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState<Payment | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [pending, startTransition] = useTransition();

  // Customers / open invoices / numbering, fetched ahead of the click so the form's dropdowns are ready on open.
  const [formData, setFormData] = useState<PaymentFormData | null>(null);
  useEffect(() => {
    let cancelled = false;
    getPaymentFormData().then((d) => { if (!cancelled) setFormData(d); });
    return () => { cancelled = true; };
  }, []);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return initialPayments.filter((p) => {
      if (mode !== "all" && p.mode !== mode) return false;
      if (channel !== "all" && p.channel !== channel) return false;
      if (status !== "all" && p.status !== status) return false;
      if (!isWithinDateRange(p.payment_date, dateRange, customFrom, customTo)) return false;
      if (!q) return true;
      return (
        p.receipt_number.toLowerCase().includes(q) ||
        p.payer_name.toLowerCase().includes(q) ||
        (p.reference ?? "").toLowerCase().includes(q) ||
        appliedTo(p).toLowerCase().includes(q)
      );
    });
  }, [initialPayments, search, mode, channel, status, dateRange, customFrom, customTo]);

  const pager = usePagination(filtered, `${search}|${mode}|${channel}|${status}|${dateRange}|${customFrom}|${customTo}`);

  const stats = useMemo(() => {
    const month = new Date().toISOString().slice(0, 7);
    const live = initialPayments.filter((p) => p.status === "received");
    const thisMonth = live.filter((p) => p.payment_date.startsWith(month));
    const sum = (rows: Payment[]) => rows.reduce((s, p) => s + p.amount, 0);
    const advances = live.flatMap((p) => p.allocations ?? []).filter((a) => a.kind === "advance").reduce((s, a) => s + Number(a.amount), 0);
    return {
      month: sum(thisMonth),
      count: live.length,
      ecom: sum(thisMonth.filter((p) => p.channel === "ecom")),
      offline: sum(thisMonth.filter((p) => p.channel === "offline")),
      advances,
    };
  }, [initialPayments]);

  const confirmCancel = () => {
    const target = cancelling;
    if (!target) return;
    startTransition(async () => {
      const res = await cancelPayment(target.id, cancelReason);
      if (res.success) {
        toast.success(`Receipt ${target.receipt_number} cancelled.`);
        setCancelling(null);
        setCancelReason("");
        router.refresh();
        getPaymentFormData().then(setFormData);
      } else {
        toast.error(res.error || "Failed to cancel receipt.");
      }
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Payments Received</h1>
          <p className="text-xs text-slate-500 mt-1">Every receipt across eCom and Offline / POS, with the invoices it was applied to.</p>
        </div>
        <Button onClick={() => setCreating(true)} className="gap-1.5">
          <HandCoins className="h-4 w-4" />
          Record Payment
        </Button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card className="p-3.5 bg-white border border-slate-200 shadow-none rounded-xl">
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">Received This Month</div>
          <div className="text-xl font-bold text-[#024AE5]">{inr(stats.month)}</div>
        </Card>
        <Card className="p-3.5 bg-white border border-slate-200 shadow-none rounded-xl">
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">eCom / Offline (month)</div>
          <div className="text-sm font-bold text-slate-900">{inr(stats.ecom)} <span className="text-slate-400 font-normal">/</span> {inr(stats.offline)}</div>
        </Card>
        <Card className="p-3.5 bg-white border border-slate-200 shadow-none rounded-xl">
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">Receipts</div>
          <div className="text-xl font-bold text-slate-900">{stats.count}</div>
        </Card>
        <Card className="p-3.5 bg-white border border-slate-200 shadow-none rounded-xl">
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">Advances Held</div>
          <div className="text-xl font-bold text-amber-600">{inr(stats.advances)}</div>
        </Card>
      </div>

      <Card className="p-4 bg-white border border-slate-200 shadow-none rounded-xl">
        <div className="flex flex-col lg:flex-row lg:items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
            <Input placeholder="Search receipt #, payer, reference or invoice..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-8 h-9 text-xs bg-slate-50/50 border-slate-200 focus:bg-white" />
          </div>
          <Select value={mode} onValueChange={setMode}>
            <SelectTrigger className="h-9 text-xs bg-slate-50/50 border-slate-200 w-full lg:w-[170px]"><SelectValue /></SelectTrigger>
            <SelectContent className="bg-white">
              <SelectItem value="all" className="text-xs">All Modes</SelectItem>
              {PAYMENT_MODES.map((m) => (<SelectItem key={m.value} value={m.value} className="text-xs">{m.label}</SelectItem>))}
            </SelectContent>
          </Select>
          <Select value={channel} onValueChange={setChannel}>
            <SelectTrigger className="h-9 text-xs bg-slate-50/50 border-slate-200 w-full lg:w-[140px]"><SelectValue /></SelectTrigger>
            <SelectContent className="bg-white">
              <SelectItem value="all" className="text-xs">All Channels</SelectItem>
              {PAYMENT_CHANNELS.map((c) => (<SelectItem key={c.value} value={c.value} className="text-xs">{c.label}</SelectItem>))}
            </SelectContent>
          </Select>
          <Select value={status} onValueChange={(v) => setStatus(v as typeof status)}>
            <SelectTrigger className="h-9 text-xs bg-slate-50/50 border-slate-200 w-full lg:w-[130px]"><SelectValue /></SelectTrigger>
            <SelectContent className="bg-white">
              <SelectItem value="all" className="text-xs">All Statuses</SelectItem>
              <SelectItem value="received" className="text-xs">Received</SelectItem>
              <SelectItem value="cancelled" className="text-xs">Cancelled</SelectItem>
            </SelectContent>
          </Select>
          <Select value={dateRange} onValueChange={(v) => setDateRange(v as DateRangeKey)}>
            <SelectTrigger className="h-9 text-xs bg-slate-50/50 border-slate-200 w-full lg:w-[150px]">
              <Calendar className="h-3.5 w-3.5 text-slate-400 mr-1.5 shrink-0" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-white">
              {DATE_RANGE_OPTIONS.map((o) => (<SelectItem key={o.value} value={o.value} className="text-xs">{o.label}</SelectItem>))}
            </SelectContent>
          </Select>
          {dateRange === "custom" && (
            <div className="flex items-center gap-2">
              <Input type="date" value={customFrom} max={customTo || undefined} onChange={(e) => setCustomFrom(e.target.value)} aria-label="From date" className="h-9 text-xs w-[140px]" />
              <span className="text-xs text-slate-400">to</span>
              <Input type="date" value={customTo} min={customFrom || undefined} onChange={(e) => setCustomTo(e.target.value)} aria-label="To date" className="h-9 text-xs w-[140px]" />
            </div>
          )}
        </div>
      </Card>

      <div className="border border-slate-200 rounded-xl bg-white overflow-hidden">
        <div className="overflow-x-auto [scrollbar-width:thin]">
          <Table className="min-w-[1000px]">
            <TableHeader>
              <TableRow className="bg-slate-50/80 whitespace-nowrap">
                <TableHead className="text-[11px] font-bold uppercase tracking-wider">Receipt #</TableHead>
                <TableHead className="text-[11px] font-bold uppercase tracking-wider">Date</TableHead>
                <TableHead className="text-[11px] font-bold uppercase tracking-wider">Received From</TableHead>
                <TableHead className="text-[11px] font-bold uppercase tracking-wider">Mode</TableHead>
                <TableHead className="text-[11px] font-bold uppercase tracking-wider">Reference</TableHead>
                <TableHead className="text-[11px] font-bold uppercase tracking-wider">Channel</TableHead>
                <TableHead className="text-[11px] font-bold uppercase tracking-wider">Applied To</TableHead>
                <TableHead className="text-[11px] font-bold uppercase tracking-wider text-right">Amount</TableHead>
                <TableHead className="text-[11px] font-bold uppercase tracking-wider">Status</TableHead>
                <TableHead className="text-[11px] font-bold uppercase tracking-wider text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10} className="py-14 text-center">
                    <Wallet className="h-8 w-8 mx-auto text-slate-300 mb-2" />
                    <p className="text-sm font-semibold text-slate-700">
                      {initialPayments.length === 0 ? "No payments recorded yet" : "No payments match your filters"}
                    </p>
                    {initialPayments.length === 0 && <p className="text-xs text-slate-500 mt-1">Click &ldquo;Record Payment&rdquo; to add the first receipt.</p>}
                  </TableCell>
                </TableRow>
              ) : (
                pager.pageItems.map((p) => (
                  <TableRow key={p.id} className={`whitespace-nowrap ${p.status === "cancelled" ? "opacity-60" : ""}`}>
                    <TableCell className="font-mono text-xs font-bold text-slate-900">{p.receipt_number}</TableCell>
                    <TableCell className="text-xs text-slate-600">{fmtDate(p.payment_date)}</TableCell>
                    <TableCell className="text-xs text-slate-800 font-medium max-w-[200px] truncate" title={p.payer_name}>{p.payer_name}</TableCell>
                    <TableCell className="text-xs text-slate-600">{modeLabel(p.mode).replace(/ \(.*\)$/, "")}</TableCell>
                    <TableCell className="text-xs text-slate-500 max-w-[140px] truncate" title={p.reference ?? undefined}>{p.reference || "—"}</TableCell>
                    <TableCell><Badge variant="outline" className="text-[10px]">{channelLabel(p.channel)}</Badge></TableCell>
                    <TableCell className="text-xs text-slate-600 max-w-[200px] truncate" title={appliedTo(p)}>{appliedTo(p)}</TableCell>
                    <TableCell className="text-xs font-bold text-[#024AE5] text-right">{inr(p.amount)}</TableCell>
                    <TableCell>
                      {p.status === "received" ? <Badge variant="success" className="text-[10px]">Received</Badge> : <Badge variant="destructive" className="text-[10px]" title={p.cancel_reason ?? undefined}>Cancelled</Badge>}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" className="h-8 px-2" title="View receipt" onClick={() => setViewing(p)}><Eye className="h-4 w-4" /></Button>
                      <Button asChild variant="ghost" size="sm" className="h-8 px-2" title="Download receipt">
                        <a href={`/api/payments/${p.id}/pdf?download=1`}><Download className="h-4 w-4" /></a>
                      </Button>
                      {p.status === "received" && (
                        <Button variant="ghost" size="sm" className="h-8 px-2 text-red-600 hover:text-red-700" title="Cancel receipt" onClick={() => setCancelling(p)}><Ban className="h-4 w-4" /></Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
        <PaginationBar state={pager} noun="receipts" />
      </div>

      {creating && (
        <PaymentFormModal
          data={formData}
          onOpenChange={setCreating}
          onCreated={(payment) => {
            setCreating(false);
            router.refresh();
            getPaymentFormData().then(setFormData);
            setViewing(payment);
          }}
        />
      )}

      <Dialog open={!!viewing} onOpenChange={(o) => !o && setViewing(null)}>
        <DialogContent className="max-w-4xl h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="font-mono">{viewing?.receipt_number}</DialogTitle>
            <DialogDescription>{viewing?.payer_name}</DialogDescription>
          </DialogHeader>
          {viewing && (
            <div className="relative flex-1 min-h-0">
              {loadedPdfId !== viewing.id && (
                <div className="absolute inset-0 z-10 rounded-lg border border-slate-200 bg-white p-6 space-y-5" aria-busy="true" aria-label="Loading receipt">
                  <Skeleton className="h-14 w-28" />
                  <Skeleton className="h-24" />
                  {Array.from({ length: 4 }).map((_, i) => (<Skeleton key={i} className="h-10 bg-slate-100" />))}
                </div>
              )}
              <iframe
                key={viewing.id}
                title={`Receipt ${viewing.receipt_number}`}
                src={`/api/payments/${viewing.id}/pdf`}
                onLoad={() => setLoadedPdfId(viewing.id)}
                className="h-full w-full rounded-lg border border-slate-200 bg-slate-50"
              />
            </div>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!cancelling} onOpenChange={(o) => { if (!o) { setCancelling(null); setCancelReason(""); } }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel receipt {cancelling?.receipt_number}?</AlertDialogTitle>
            <AlertDialogDescription>
              The receipt stays in the register as Cancelled and its number is not reused. The invoices it was applied to become payable again.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Textarea rows={2} placeholder="Reason (required)" value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} className="text-xs" />
          <AlertDialogFooter>
            <AlertDialogCancel>Keep receipt</AlertDialogCancel>
            <Button onClick={confirmCancel} disabled={pending || cancelReason.trim().length < 3} className="bg-red-600 hover:bg-red-700 text-white">
              {pending ? "Cancelling..." : "Cancel receipt"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
