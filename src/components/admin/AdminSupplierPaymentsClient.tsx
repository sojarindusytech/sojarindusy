"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { Ban, BookMarked, Calendar, Factory, HandCoins, Search } from "lucide-react";
import { cancelSupplierPaymentAction, getSupplierPaymentFormData, type SupplierPaymentFormData } from "@/actions/supplier-payment";
import { PAYMENT_MODES, modeLabel } from "@/lib/payments";
import { DATE_RANGE_OPTIONS, isWithinDateRange, type DateRangeKey } from "@/lib/date-range";
import { fmtDate, inr } from "@/lib/ledger";
import type { SupplierPayment } from "@/types/database.types";
import { PageTitle } from "@/components/common/PageTitle";
import { IconAction } from "@/components/common/IconAction";
import { PaginationBar, usePagination } from "@/components/common/Pagination";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { SupplierPaymentFormModal } from "./SupplierPaymentFormModal";

/** Payments Made: money paid to manufacturers. Each one posts to the manufacturer's Party Ledger. */
export function AdminSupplierPaymentsClient({ initialPayments, loadError }: { initialPayments: SupplierPayment[]; loadError: string | null }) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [mode, setMode] = useState("all");
  const [status, setStatus] = useState<"all" | "paid" | "cancelled">("all");
  const [dateRange, setDateRange] = useState<DateRangeKey>("all");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [creating, setCreating] = useState(false);
  const [cancelling, setCancelling] = useState<SupplierPayment | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [pending, startTransition] = useTransition();

  // Manufacturers / accounts fetched ahead of the click so the form is ready on open.
  const [formData, setFormData] = useState<SupplierPaymentFormData | null>(null);
  useEffect(() => {
    if (loadError) return;
    let cancelled = false;
    getSupplierPaymentFormData().then((d) => { if (!cancelled) setFormData(d); });
    return () => { cancelled = true; };
  }, [loadError]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return initialPayments.filter((p) => {
      if (mode !== "all" && p.mode !== mode) return false;
      if (status !== "all" && p.status !== status) return false;
      if (!isWithinDateRange(p.payment_date, dateRange, customFrom, customTo)) return false;
      if (!q) return true;
      return [p.voucher_number, p.payee_name, p.reference ?? "", p.bill_reference ?? "", p.paid_from_name].some((v) => v.toLowerCase().includes(q));
    });
  }, [initialPayments, search, mode, status, dateRange, customFrom, customTo]);
  const pager = usePagination(filtered, `${search}|${mode}|${status}|${dateRange}|${customFrom}|${customTo}`);

  const stats = useMemo(() => {
    const live = filtered.filter((p) => p.status === "paid");
    const byMaker = new Map<string, number>();
    for (const p of live) byMaker.set(p.payee_name, (byMaker.get(p.payee_name) ?? 0) + p.amount);
    const top = [...byMaker.entries()].sort((a, b) => b[1] - a[1])[0];
    return { total: live.reduce((s, p) => s + p.amount, 0), count: live.length, top };
  }, [filtered]);

  const confirmCancel = () => {
    const target = cancelling;
    if (!target) return;
    startTransition(async () => {
      const res = await cancelSupplierPaymentAction(target.id, cancelReason);
      if (res.success) {
        toast.success(`Payment ${target.voucher_number} cancelled.`);
        setCancelling(null);
        setCancelReason("");
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <PageTitle icon={Factory}>Payments Made</PageTitle>
        <Button onClick={() => setCreating(true)} className="gap-1.5" disabled={!!loadError}>
          <HandCoins className="h-4 w-4" />
          Record Payment
        </Button>
      </div>

      {loadError ? (
        <Card className="p-5 border-amber-200 bg-amber-50 text-sm text-amber-900 shadow-none rounded-xl">{loadError}</Card>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
            <Card className="p-3.5 bg-white border border-slate-200 shadow-none rounded-xl">
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">Amount Paid</div>
              <div className="text-xl font-bold text-[#024AE5]">{inr(stats.total)}</div>
            </Card>
            <Card className="p-3.5 bg-white border border-slate-200 shadow-none rounded-xl">
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">Payments</div>
              <div className="text-xl font-bold text-slate-900">{stats.count}</div>
            </Card>
            <Card className="p-3.5 bg-white border border-slate-200 shadow-none rounded-xl col-span-2 lg:col-span-1">
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">Paid Most To</div>
              <div className="text-sm font-bold text-slate-900 truncate">{stats.top ? `${stats.top[0]} · ${inr(stats.top[1])}` : "—"}</div>
            </Card>
          </div>

          <Card className="p-4 bg-white border border-slate-200 shadow-none rounded-xl">
            <div className="flex flex-col lg:flex-row lg:items-center gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
                <Input placeholder="Search voucher #, manufacturer, UTR or bill..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-8 h-9 text-xs bg-slate-50/50 border-slate-200 focus:bg-white" />
              </div>
              <Select value={mode} onValueChange={setMode}>
                <SelectTrigger className="h-9 text-xs bg-slate-50/50 border-slate-200 w-full lg:w-[170px]"><SelectValue /></SelectTrigger>
                <SelectContent className="bg-white">
                  <SelectItem value="all" className="text-xs">All Modes</SelectItem>
                  {PAYMENT_MODES.map((m) => (<SelectItem key={m.value} value={m.value} className="text-xs">{m.label}</SelectItem>))}
                </SelectContent>
              </Select>
              <Select value={status} onValueChange={(v) => setStatus(v as typeof status)}>
                <SelectTrigger className="h-9 text-xs bg-slate-50/50 border-slate-200 w-full lg:w-[130px]"><SelectValue /></SelectTrigger>
                <SelectContent className="bg-white">
                  <SelectItem value="all" className="text-xs">All Statuses</SelectItem>
                  <SelectItem value="paid" className="text-xs">Paid</SelectItem>
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
                    <TableHead className="text-[11px] font-bold uppercase tracking-wider">Voucher #</TableHead>
                    <TableHead className="text-[11px] font-bold uppercase tracking-wider">Date</TableHead>
                    <TableHead className="text-[11px] font-bold uppercase tracking-wider">Paid To</TableHead>
                    <TableHead className="text-[11px] font-bold uppercase tracking-wider">Mode</TableHead>
                    <TableHead className="text-[11px] font-bold uppercase tracking-wider">Reference</TableHead>
                    <TableHead className="text-[11px] font-bold uppercase tracking-wider">Paid From</TableHead>
                    <TableHead className="text-[11px] font-bold uppercase tracking-wider">Against</TableHead>
                    <TableHead className="text-[11px] font-bold uppercase tracking-wider text-right">Amount</TableHead>
                    <TableHead className="text-[11px] font-bold uppercase tracking-wider">Status</TableHead>
                    <TableHead className="text-[11px] font-bold uppercase tracking-wider text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={10} className="py-14 text-center">
                        <Factory className="h-8 w-8 mx-auto text-slate-300 mb-2" />
                        <p className="text-sm font-semibold text-slate-700">
                          {initialPayments.length === 0 ? "No payments made yet" : "No payments match your filters"}
                        </p>
                        {initialPayments.length === 0 && <p className="text-xs text-slate-500 mt-1">Click &ldquo;Record Payment&rdquo; when you pay a manufacturer.</p>}
                      </TableCell>
                    </TableRow>
                  ) : (
                    pager.pageItems.map((p) => (
                      <TableRow key={p.id} className={`whitespace-nowrap ${p.status === "cancelled" ? "opacity-60" : ""}`}>
                        <TableCell className="font-mono text-xs font-bold text-slate-900">{p.voucher_number}</TableCell>
                        <TableCell className="text-xs text-slate-600">{fmtDate(p.payment_date)}</TableCell>
                        <TableCell className="text-xs text-slate-800 font-medium max-w-[200px] truncate" title={p.payee_name}>{p.payee_name}</TableCell>
                        <TableCell className="text-xs text-slate-600">{modeLabel(p.mode).replace(/ \(.*\)$/, "")}</TableCell>
                        <TableCell className="text-xs text-slate-500 max-w-[140px] truncate" title={p.reference ?? undefined}>{p.reference || "—"}</TableCell>
                        <TableCell className="text-xs text-slate-600">{p.paid_from_name}</TableCell>
                        <TableCell className="text-xs text-slate-500 max-w-[160px] truncate" title={p.bill_reference ?? undefined}>{p.bill_reference || "—"}</TableCell>
                        <TableCell className="text-xs font-bold text-[#024AE5] text-right">{inr(p.amount)}</TableCell>
                        <TableCell>
                          {p.status === "paid" ? <Badge variant="success" className="text-[10px]">Paid</Badge> : <Badge variant="destructive" className="text-[10px]" title={p.cancel_reason ?? undefined}>Cancelled</Badge>}
                        </TableCell>
                        <TableCell className="text-right">
                          <Link href={`/admin/party-ledger/${p.manufacturer_id}`} title="Manufacturer's ledger" aria-label="Manufacturer's ledger"
                            className="inline-flex h-7 w-7 items-center justify-center rounded-md text-slate-500 hover:text-[#024AE5] [&_svg]:h-4 [&_svg]:w-4">
                            <BookMarked />
                          </Link>
                          {p.status === "paid" && (
                            <IconAction label="Cancel payment" tone="danger" onClick={() => setCancelling(p)}><Ban /></IconAction>
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
            <PaginationBar state={pager} noun="payments" />
          </div>
        </>
      )}

      {creating && (
        <SupplierPaymentFormModal
          data={formData}
          onOpenChange={setCreating}
          onCreated={() => {
            setCreating(false);
            router.refresh();
            getSupplierPaymentFormData().then(setFormData);
          }}
        />
      )}

      <AlertDialog open={!!cancelling} onOpenChange={(o) => { if (!o) { setCancelling(null); setCancelReason(""); } }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel payment {cancelling?.voucher_number}?</AlertDialogTitle>
            <AlertDialogDescription>
              The payment stays listed as Cancelled and its number is not reused. Its ledger entry is reversed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Textarea rows={2} placeholder="Reason (required)" value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} className="text-xs" />
          <AlertDialogFooter>
            <AlertDialogCancel>Keep payment</AlertDialogCancel>
            <Button onClick={confirmCancel} disabled={pending || cancelReason.trim().length < 3} className="bg-red-600 hover:bg-red-700 text-white">
              {pending ? "Cancelling..." : "Cancel payment"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
