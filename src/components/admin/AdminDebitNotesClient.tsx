"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { Ban, Calendar, Download, Eye, FileUp, Search, Settings } from "lucide-react";
import { cancelDebitNote, type DebitNoteListRow } from "@/actions/debit-note";
import { debitNoteReasonLabel } from "@/lib/debit-notes";
import { DATE_RANGE_OPTIONS, isWithinDateRange, type DateRangeKey } from "@/lib/date-range";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PaginationBar, usePagination } from "@/components/common/Pagination";
import { PageTitle } from "@/components/common/PageTitle";
import { IconAction } from "@/components/common/IconAction";
import { pdfViewerSrc } from "@/lib/pdf-viewer";
import { DebitNoteFormModal } from "./DebitNoteFormModal";

const inr = (n: number) => `₹${n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtDate = (iso: string) => iso.split("-").reverse().join("-");

export function AdminDebitNotesClient({
  initialDebitNotes,
  loadError = null,
}: {
  initialDebitNotes: DebitNoteListRow[];
  /** Set when the list couldn't be loaded (e.g. the migration isn't applied yet). */
  loadError?: string | null;
}) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<"all" | "issued" | "cancelled">("all");
  const [dateRange, setDateRange] = useState<DateRangeKey>("all");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [creating, setCreating] = useState(false);
  const [viewing, setViewing] = useState<{ id: string; number: string; customer: string } | null>(null);
  // Id of the note whose PDF has finished loading; the skeleton shows until it matches.
  const [loadedPdfId, setLoadedPdfId] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState<DebitNoteListRow | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [pending, startTransition] = useTransition();

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return initialDebitNotes.filter((dn) => {
      if (status !== "all" && dn.status !== status) return false;
      if (!isWithinDateRange(dn.debit_note_date, dateRange, customFrom, customTo)) return false;
      if (!q) return true;
      return (
        dn.debit_note_number.toLowerCase().includes(q) ||
        dn.invoice_number.toLowerCase().includes(q) ||
        dn.bill_to?.name?.toLowerCase().includes(q)
      );
    });
  }, [initialDebitNotes, search, status, dateRange, customFrom, customTo]);

  const pager = usePagination(filtered, `${search}|${status}|${dateRange}|${customFrom}|${customTo}`);

  const issued = initialDebitNotes.filter((d) => d.status === "issued");
  const debited = issued.reduce((sum, d) => sum + Number(d.total_amount || 0), 0);

  const confirmCancel = () => {
    const target = cancelling;
    if (!target) return;
    if (cancelReason.trim().length < 3) return void toast.error("Enter a reason (at least 3 characters).");
    startTransition(async () => {
      const res = await cancelDebitNote(target.id, cancelReason.trim());
      if (res.success) {
        toast.success(`Debit note ${target.debit_note_number} cancelled.`);
        setCancelling(null);
        setCancelReason("");
        router.refresh();
      } else {
        toast.error(res.error || "Failed to cancel the debit note.");
      }
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <PageTitle icon={FileUp}>Debit Note</PageTitle>
          <p className="text-xs text-slate-500 mt-1">
            Issued to a customer when an invoice charged too little. Reported in GSTR-1 for the month of issue.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button asChild variant="outline" className="gap-1.5">
            <Link href="/admin/settings/sales">
              <Settings className="h-4 w-4" />
              Settings
            </Link>
          </Button>
          <Button onClick={() => setCreating(true)} disabled={!!loadError} className="gap-1.5">
            <FileUp className="h-4 w-4" />
            New Debit Note
          </Button>
        </div>
      </div>

      {loadError && (
        <div role="alert" className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {loadError}
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        <Card className="p-3.5 bg-white border border-slate-200 shadow-none rounded-xl">
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">Debit Notes Issued</div>
          <div className="text-xl font-bold text-slate-900">{issued.length}</div>
        </Card>
        <Card className="p-3.5 bg-white border border-slate-200 shadow-none rounded-xl">
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">Total Debited</div>
          <div className="text-xl font-bold text-[#024AE5]">{inr(debited)}</div>
        </Card>
        <Card className="p-3.5 bg-white border border-slate-200 shadow-none rounded-xl col-span-2 lg:col-span-1">
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">Cancelled</div>
          <div className="text-xl font-bold text-slate-900">{initialDebitNotes.length - issued.length}</div>
        </Card>
      </div>

      <Card className="p-4 bg-white border border-slate-200 shadow-none rounded-xl">
        <div className="flex flex-col lg:flex-row lg:items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
            <Input
              placeholder="Search by debit note #, invoice # or customer..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 h-9 text-xs bg-slate-50/50 border-slate-200 focus:bg-white"
              aria-label="Search debit notes"
            />
          </div>
          <Select value={status} onValueChange={(v) => setStatus(v as typeof status)}>
            <SelectTrigger className="h-9 text-xs bg-slate-50/50 border-slate-200 w-full lg:w-[150px]" aria-label="Status">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-white">
              <SelectItem value="all" className="text-xs">All Statuses</SelectItem>
              <SelectItem value="issued" className="text-xs">Issued</SelectItem>
              <SelectItem value="cancelled" className="text-xs">Cancelled</SelectItem>
            </SelectContent>
          </Select>
          <Select value={dateRange} onValueChange={(v) => setDateRange(v as DateRangeKey)}>
            <SelectTrigger className="h-9 text-xs bg-slate-50/50 border-slate-200 w-full lg:w-[150px]" aria-label="Date range">
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
                <TableHead className="text-[11px] font-bold uppercase tracking-wider">Debit Note #</TableHead>
                <TableHead className="text-[11px] font-bold uppercase tracking-wider">Date</TableHead>
                <TableHead className="text-[11px] font-bold uppercase tracking-wider">Customer</TableHead>
                <TableHead className="text-[11px] font-bold uppercase tracking-wider">Against Invoice</TableHead>
                <TableHead className="text-[11px] font-bold uppercase tracking-wider">Reason</TableHead>
                <TableHead className="text-[11px] font-bold uppercase tracking-wider text-right">Amount</TableHead>
                <TableHead className="text-[11px] font-bold uppercase tracking-wider">Status</TableHead>
                <TableHead className="text-[11px] font-bold uppercase tracking-wider text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="py-14 text-center">
                    <FileUp className="h-8 w-8 mx-auto text-slate-300 mb-2" />
                    <p className="text-sm font-semibold text-slate-700">
                      {initialDebitNotes.length === 0 ? "No debit notes yet" : "No debit notes match your filters"}
                    </p>
                    {initialDebitNotes.length === 0 && (
                      <p className="text-xs text-slate-500 mt-1">
                        Click &ldquo;New Debit Note&rdquo;, or use the debit note button on an invoice.
                      </p>
                    )}
                  </TableCell>
                </TableRow>
              ) : (
                pager.pageItems.map((dn) => (
                  <TableRow key={dn.id} className={dn.status === "cancelled" ? "opacity-60" : undefined}>
                    <TableCell className="font-mono text-xs font-bold text-slate-900 whitespace-nowrap">{dn.debit_note_number}</TableCell>
                    <TableCell className="text-xs text-slate-600 whitespace-nowrap">{fmtDate(dn.debit_note_date)}</TableCell>
                    <TableCell className="text-xs text-slate-800 font-medium max-w-[200px] truncate">{dn.bill_to?.name}</TableCell>
                    <TableCell className="text-xs text-slate-600 whitespace-nowrap">
                      <span className="font-mono">{dn.invoice_number}</span>
                      <span className="text-slate-400"> · {fmtDate(dn.invoice_date)}</span>
                    </TableCell>
                    <TableCell className="text-xs text-slate-600 max-w-[200px]">
                      <div className="truncate">{debitNoteReasonLabel(dn.reason)}</div>
                      {dn.status === "cancelled" && dn.cancel_reason ? (
                        <div className="truncate text-[11px] text-red-600" title={dn.cancel_reason}>Cancelled: {dn.cancel_reason}</div>
                      ) : null}
                    </TableCell>
                    <TableCell className="text-xs font-bold text-slate-900 text-right whitespace-nowrap">{inr(Number(dn.total_amount))}</TableCell>
                    <TableCell>
                      {dn.status === "issued" ? (
                        <Badge variant="success" className="text-[10px]">Issued</Badge>
                      ) : (
                        <Badge variant="destructive" className="text-[10px]">Cancelled</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right whitespace-nowrap">
                      <IconAction
                        label="View PDF"
                        onClick={() => setViewing({ id: dn.id, number: dn.debit_note_number, customer: dn.bill_to?.name ?? "" })}
                      >
                        <Eye />
                      </IconAction>
                      <IconAction label="Download PDF" href={`/api/debit-notes/${dn.id}/pdf?download=1`}><Download /></IconAction>
                      {dn.status === "issued" && (
                        <IconAction label="Cancel debit note" tone="danger" onClick={() => setCancelling(dn)}><Ban /></IconAction>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
        <PaginationBar state={pager} noun="debit notes" />
      </div>

      {creating && (
        <DebitNoteFormModal
          onOpenChange={setCreating}
          onIssued={(dn) => {
            setCreating(false);
            router.refresh();
            setViewing({ id: dn.id, number: dn.debit_note_number, customer: dn.bill_to?.name ?? "" });
          }}
        />
      )}

      <Dialog open={!!viewing} onOpenChange={(o) => !o && setViewing(null)}>
        <DialogContent className="max-w-4xl h-[90vh] flex flex-col">
          <div className="flex items-start justify-between gap-3 pr-8">
            <DialogHeader className="min-w-0">
              <DialogTitle className="font-mono">{viewing?.number}</DialogTitle>
              <DialogDescription>{viewing?.customer}</DialogDescription>
            </DialogHeader>
            <Button asChild size="sm" variant="outline" className="gap-1.5 shrink-0">
              <a href={`/api/debit-notes/${viewing?.id}/pdf?download=1`}>
                <Download className="h-4 w-4" />
                Download
              </a>
            </Button>
          </div>
          {viewing && (
            <div className="relative flex-1 min-h-0">
              {loadedPdfId !== viewing.id && (
                <div className="absolute inset-0 z-10 rounded-lg border border-slate-200 bg-white p-6 space-y-5" aria-busy="true" aria-label="Loading debit note">
                  <Skeleton className="h-14 w-28" />
                  <Skeleton className="h-24" />
                  {Array.from({ length: 4 }).map((_, i) => (
                    <Skeleton key={i} className="h-10 bg-slate-100" />
                  ))}
                </div>
              )}
              <iframe
                key={viewing.id}
                title={`Debit note ${viewing.number}`}
                src={pdfViewerSrc(`/api/debit-notes/${viewing.id}/pdf`)}
                onLoad={() => setLoadedPdfId(viewing.id)}
                className="h-full w-full rounded-lg border border-slate-200 bg-slate-50"
              />
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!cancelling}
        onOpenChange={(o) => {
          if (!o && !pending) {
            setCancelling(null);
            setCancelReason("");
          }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Cancel debit note {cancelling?.debit_note_number}?</DialogTitle>
            <DialogDescription>
              It stays in the register as Cancelled and its number is not reused. The customer can no longer open it.
              If it was already reported in GSTR-1, report the cancellation in your next return.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            placeholder="Reason for cancelling (required)"
            rows={3}
            maxLength={500}
            value={cancelReason}
            onChange={(e) => setCancelReason(e.target.value)}
            className="text-sm"
            aria-label="Reason for cancelling"
          />
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => { setCancelling(null); setCancelReason(""); }} disabled={pending}>
              Keep debit note
            </Button>
            <Button variant="destructive" onClick={confirmCancel} disabled={pending || cancelReason.trim().length < 3}>
              {pending ? "Cancelling..." : "Cancel debit note"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
