"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { Calendar, Download, Eye, FilePlus2, HandCoins, Pencil, Receipt, Search, Settings, Ban } from "lucide-react";
import type { InvoiceListRow } from "@/actions/invoice";
import { cancelInvoice, getInvoice } from "@/actions/invoice";
import type { Invoice } from "@/types/database.types";
import { DATE_RANGE_OPTIONS, isWithinDateRange, type DateRangeKey } from "@/lib/date-range";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { InvoiceFormModal } from "./InvoiceFormModal";
import { PaymentFormModal } from "./PaymentFormModal";
import { getPaymentFormData, type PaymentFormData } from "@/actions/payment";
import { paymentStatusLabel } from "@/lib/payments";
import { PaginationBar, usePagination } from "@/components/common/Pagination";

const inr = (n: number) => `₹${n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtDate = (iso: string) => iso.split("-").reverse().join("-");

/** Paper-shaped placeholder shown over the iframe while the PDF renders server-side. */
function PdfSkeleton() {
  return (
    <div className="absolute inset-0 z-10 overflow-hidden rounded-lg border border-slate-200 bg-white p-6 space-y-5" aria-busy="true" aria-label="Loading invoice">
      <div className="flex justify-between gap-6">
        <Skeleton className="h-14 w-28" />
        <div className="space-y-2 flex flex-col items-end">
          <Skeleton className="h-5 w-44" />
          <Skeleton className="h-3 w-72 max-w-full" />
          <Skeleton className="h-3 w-56 max-w-full" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Skeleton className="h-24" />
        <Skeleton className="h-24" />
      </div>
      <div className="space-y-2">
        <Skeleton className="h-8" />
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-10 bg-slate-100" />
        ))}
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Skeleton className="h-20" />
        <Skeleton className="h-20" />
      </div>
    </div>
  );
}

export function AdminInvoicesClient({ initialInvoices }: { initialInvoices: InvoiceListRow[] }) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<"all" | "issued" | "cancelled">("all");
  const [dateRange, setDateRange] = useState<DateRangeKey>("all");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [creating, setCreating] = useState(false);
  // "Record payment" from a row: the form opens with that invoice preselected. Its data is fetched ahead of the click.
  const [payingInvoiceId, setPayingInvoiceId] = useState<string | null>(null);
  const [paymentData, setPaymentData] = useState<PaymentFormData | null>(null);
  useEffect(() => {
    let cancelled = false;
    getPaymentFormData().then((d) => { if (!cancelled) setPaymentData(d); });
    return () => { cancelled = true; };
  }, []);
  // Full invoice (with lines) loaded for the edit form.
  const [editing, setEditing] = useState<Invoice | null>(null);
  const [loadingEditId, setLoadingEditId] = useState<string | null>(null);
  const [viewing, setViewing] = useState<InvoiceListRow | null>(null);
  // Id of the invoice whose PDF has finished loading; the skeleton shows until it matches.
  const [loadedPdfId, setLoadedPdfId] = useState<string | null>(null);
  // Bumped after an edit so the iframe re-fetches the regenerated PDF.
  const [pdfVersion, setPdfVersion] = useState(0);
  const [cancelling, setCancelling] = useState<InvoiceListRow | null>(null);
  const [pending, startTransition] = useTransition();

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return initialInvoices.filter((inv) => {
      if (status !== "all" && inv.status !== status) return false;
      if (!isWithinDateRange(inv.invoice_date, dateRange, customFrom, customTo)) return false;
      if (!q) return true;
      return (
        inv.invoice_number.toLowerCase().includes(q) ||
        inv.bill_to?.name?.toLowerCase().includes(q) ||
        inv.po_number?.toLowerCase().includes(q)
      );
    });
  }, [initialInvoices, search, status, dateRange, customFrom, customTo]);

  const pager = usePagination(filtered, `${search}|${status}|${dateRange}|${customFrom}|${customTo}`);

  const issued = initialInvoices.filter((i) => i.status === "issued");
  const billed = issued.reduce((sum, i) => sum + Number(i.total_amount || 0), 0);

  const startEdit = async (inv: InvoiceListRow) => {
    setLoadingEditId(inv.id);
    const full = await getInvoice(inv.id);
    setLoadingEditId(null);
    if (!full) return void toast.error("Could not load the invoice.");
    setEditing(full);
  };

  const confirmCancel = () => {
    const target = cancelling;
    if (!target) return;
    startTransition(async () => {
      const res = await cancelInvoice(target.id);
      setCancelling(null);
      if (res.success) {
        toast.success(`Invoice ${target.invoice_number} cancelled.`);
        router.refresh();
      } else {
        toast.error(res.error || "Failed to cancel invoice.");
      }
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Invoices</h1>
          <p className="text-xs text-slate-500 mt-1">
            Invoices are created automatically when an order is delivered, or manually for offline sales.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button asChild variant="outline" className="gap-1.5">
            <Link href="/admin/settings/sales">
              <Settings className="h-4 w-4" />
              Settings
            </Link>
          </Button>
          <Button onClick={() => setCreating(true)} className="gap-1.5">
            <FilePlus2 className="h-4 w-4" />
            New Invoice
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        <Card className="p-3.5 bg-white border border-slate-200 shadow-none rounded-xl">
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">Invoices Issued</div>
          <div className="text-xl font-bold text-slate-900">{issued.length}</div>
        </Card>
        <Card className="p-3.5 bg-white border border-slate-200 shadow-none rounded-xl">
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">Total Billed</div>
          <div className="text-xl font-bold text-[#024AE5]">{inr(billed)}</div>
        </Card>
        <Card className="p-3.5 bg-white border border-slate-200 shadow-none rounded-xl col-span-2 lg:col-span-1">
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">Cancelled</div>
          <div className="text-xl font-bold text-slate-900">{initialInvoices.length - issued.length}</div>
        </Card>
      </div>

      <Card className="p-4 bg-white border border-slate-200 shadow-none rounded-xl">
        <div className="flex flex-col lg:flex-row lg:items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
            <Input
              placeholder="Search by invoice #, customer or PO..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 h-9 text-xs bg-slate-50/50 border-slate-200 focus:bg-white"
            />
          </div>
          <Select value={status} onValueChange={(v) => setStatus(v as typeof status)}>
            <SelectTrigger className="h-9 text-xs bg-slate-50/50 border-slate-200 w-full lg:w-[150px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-white">
              <SelectItem value="all" className="text-xs">All Statuses</SelectItem>
              <SelectItem value="issued" className="text-xs">Issued</SelectItem>
              <SelectItem value="cancelled" className="text-xs">Cancelled</SelectItem>
            </SelectContent>
          </Select>
          <Select value={dateRange} onValueChange={(v) => setDateRange(v as DateRangeKey)}>
            <SelectTrigger className="h-9 text-xs bg-slate-50/50 border-slate-200 w-full lg:w-[150px]">
              <Calendar className="h-3.5 w-3.5 text-slate-400 mr-1.5 shrink-0" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-white">
              {DATE_RANGE_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value} className="text-xs">{o.label}</SelectItem>
              ))}
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
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50/80">
                <TableHead className="text-[11px] font-bold uppercase tracking-wider">Invoice #</TableHead>
                <TableHead className="text-[11px] font-bold uppercase tracking-wider">Date</TableHead>
                <TableHead className="text-[11px] font-bold uppercase tracking-wider">Customer</TableHead>
                <TableHead className="text-[11px] font-bold uppercase tracking-wider">PO</TableHead>
                <TableHead className="text-[11px] font-bold uppercase tracking-wider text-right">Total</TableHead>
                <TableHead className="text-[11px] font-bold uppercase tracking-wider text-right">Balance</TableHead>
                <TableHead className="text-[11px] font-bold uppercase tracking-wider">Payment</TableHead>
                <TableHead className="text-[11px] font-bold uppercase tracking-wider">Type</TableHead>
                <TableHead className="text-[11px] font-bold uppercase tracking-wider">Status</TableHead>
                <TableHead className="text-[11px] font-bold uppercase tracking-wider text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10} className="py-14 text-center">
                    <Receipt className="h-8 w-8 mx-auto text-slate-300 mb-2" />
                    <p className="text-sm font-semibold text-slate-700">
                      {initialInvoices.length === 0 ? "No invoices yet" : "No invoices match your filters"}
                    </p>
                    {initialInvoices.length === 0 && (
                      <p className="text-xs text-slate-500 mt-1">Click &ldquo;New Invoice&rdquo; to create one, or mark an order as delivered.</p>
                    )}
                  </TableCell>
                </TableRow>
              ) : (
                pager.pageItems.map((inv) => (
                  <TableRow key={inv.id} className={inv.status === "cancelled" ? "opacity-60" : undefined}>
                    <TableCell className="font-mono text-xs font-bold text-slate-900 whitespace-nowrap">{inv.invoice_number}</TableCell>
                    <TableCell className="text-xs text-slate-600 whitespace-nowrap">{fmtDate(inv.invoice_date)}</TableCell>
                    <TableCell className="text-xs text-slate-800 font-medium max-w-[220px] truncate">{inv.bill_to?.name}</TableCell>
                    <TableCell className="text-xs text-slate-600">{inv.po_number || "—"}</TableCell>
                    <TableCell className="text-xs font-bold text-slate-900 text-right whitespace-nowrap">{inr(Number(inv.total_amount))}</TableCell>
                    <TableCell className="text-xs text-right whitespace-nowrap">
                      {inv.balance === undefined || inv.status === "cancelled" ? "—" : <span className={inv.balance > 0 ? "font-semibold text-amber-700" : "text-emerald-700"}>{inr(inv.balance)}</span>}
                    </TableCell>
                    <TableCell>
                      {inv.payment_status && inv.status !== "cancelled" ? (
                        <Badge variant={inv.payment_status === "paid" ? "success" : inv.payment_status === "partial" ? "warning" : "outline"} className="text-[10px] whitespace-nowrap">
                          {paymentStatusLabel(inv.payment_status)}
                        </Badge>
                      ) : "—"}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-[10px]">{inv.gst_enabled ? "GST" : "Non-GST"}</Badge>
                    </TableCell>
                    <TableCell>
                      {inv.status === "issued" ? (
                        <Badge variant="success" className="text-[10px]">Issued</Badge>
                      ) : (
                        <Badge variant="destructive" className="text-[10px]">Cancelled</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right whitespace-nowrap">
                      <Button variant="ghost" size="sm" className="h-8 px-2" title="View PDF" onClick={() => setViewing(inv)}>
                        <Eye className="h-4 w-4" />
                      </Button>
                      {inv.status === "issued" && <Button asChild variant="ghost" size="sm" className="h-8 px-2" title="Create credit note"><Link href={`/admin/credit-notes?invoice=${inv.id}`}><FilePlus2 className="h-4 w-4" /></Link></Button>}
                      <Button asChild variant="ghost" size="sm" className="h-8 px-2" title="Download PDF">
                        <a href={`/api/invoices/${inv.id}/pdf?download=1`}>
                          <Download className="h-4 w-4" />
                        </a>
                      </Button>
                      {inv.status === "issued" && (inv.balance ?? 1) > 0 && (
                        <Button variant="ghost" size="sm" className="h-8 px-2 text-emerald-700" title="Record payment" onClick={() => setPayingInvoiceId(inv.id)}>
                          <HandCoins className="h-4 w-4" />
                        </Button>
                      )}
                      {inv.status === "issued" && (
                        <Button variant="ghost" size="sm" className="h-8 px-2" title="Edit invoice" disabled={loadingEditId === inv.id} onClick={() => startEdit(inv)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                      )}
                      {inv.status === "issued" && (
                        <Button variant="ghost" size="sm" className="h-8 px-2 text-red-600 hover:text-red-700" title="Cancel invoice" onClick={() => setCancelling(inv)}>
                          <Ban className="h-4 w-4" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
        <PaginationBar state={pager} noun="invoices" />
      </div>

      {payingInvoiceId && (
        <PaymentFormModal
          data={paymentData}
          initialInvoiceId={payingInvoiceId}
          onOpenChange={(open) => !open && setPayingInvoiceId(null)}
          onCreated={() => {
            setPayingInvoiceId(null);
            router.refresh();
            getPaymentFormData().then(setPaymentData);
          }}
        />
      )}

      {creating && (
        <InvoiceFormModal
          onOpenChange={setCreating}
          onSaved={(inv) => {
            setCreating(false);
            router.refresh();
            setViewing(inv);
          }}
        />
      )}

      {editing && (
        <InvoiceFormModal
          invoice={editing}
          onOpenChange={(open) => !open && setEditing(null)}
          onSaved={(inv) => {
            setEditing(null);
            router.refresh();
            // Re-show the PDF; clearing the loaded marker brings the skeleton back for the new render.
            setLoadedPdfId(null);
            setPdfVersion((v) => v + 1);
            setViewing(inv);
          }}
        />
      )}

      <Dialog open={!!viewing} onOpenChange={(o) => !o && setViewing(null)}>
        <DialogContent className="max-w-4xl h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="font-mono">{viewing?.invoice_number}</DialogTitle>
            <DialogDescription>{viewing?.bill_to?.name}</DialogDescription>
          </DialogHeader>
          {viewing && (
            <div className="relative flex-1 min-h-0">
              {loadedPdfId !== viewing.id && <PdfSkeleton />}
              <iframe
                key={`${viewing.id}-${pdfVersion}`}
                title={`Invoice ${viewing.invoice_number}`}
                src={`/api/invoices/${viewing.id}/pdf?v=${pdfVersion}`}
                onLoad={() => setLoadedPdfId(viewing.id)}
                className="h-full w-full rounded-lg border border-slate-200 bg-slate-50"
              />
            </div>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!cancelling} onOpenChange={(o) => !o && setCancelling(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel invoice {cancelling?.invoice_number}?</AlertDialogTitle>
            <AlertDialogDescription>
              The invoice stays in the register as Cancelled and its number is not reused. The customer can no longer open it.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep invoice</AlertDialogCancel>
            <AlertDialogAction onClick={confirmCancel} disabled={pending}>
              {pending ? "Cancelling..." : "Cancel invoice"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
