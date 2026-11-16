"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { Download, Eye, FileDown, FileMinus2, Plus, Search, Settings } from "lucide-react";
import { getCreditNoteFormData, type CreditNoteFormData } from "@/actions/credit-note";
import type { CreditNote } from "@/lib/credit-note";
import { CreditNoteFormModal } from "@/components/admin/CreditNoteFormModal";
import { PageTitle } from "@/components/common/PageTitle";
import { IconAction } from "@/components/common/IconAction";
import { PaginationBar, usePagination } from "@/components/common/Pagination";
import { DateRangeFilter, useDateRangeFilter } from "@/components/common/DateRangeFilter";
import { LoadErrorCard } from "@/components/common/LoadErrorCard";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { isWithinDateRange } from "@/lib/date-range";
import { useUrlState } from "@/lib/use-url-state";
import { downloadCsv } from "@/lib/csv";

const inr = (n: number) => `₹${n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtDate = (iso: string) => iso.split("-").reverse().join("-");
const unitsRestocked = (n: CreditNote) => (n.stock_returns ?? []).reduce((sum, line) => sum + line.quantity, 0);

/** Credit note register: admin (issue, settings) and customer (their own notes) share this view. */
export function AdminCreditNotesClient({
  notes,
  invoiceId,
  initialFormData = null,
  customer = false,
  loadError = null,
}: {
  notes: CreditNote[];
  invoiceId?: string;
  initialFormData?: CreditNoteFormData | null;
  customer?: boolean;
  loadError?: string | null;
}) {
  const router = useRouter();
  // Filters live in the URL: they survive reload / Back and can be shared as a link.
  const [search, setSearch] = useUrlState("q");
  const [treatment, setTreatment] = useUrlState("treatment", "all");
  const dates = useDateRangeFilter();
  const [formData, setFormData] = useState<CreditNoteFormData | null>(initialFormData);
  const [viewing, setViewing] = useState<CreditNote | null>(null);
  const [pending, startTransition] = useTransition();

  const openForm = () =>
    startTransition(async () => {
      try {
        setFormData(await getCreditNoteFormData());
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Unable to load invoices.");
      }
    });

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return notes.filter((n) => {
      if (treatment !== "all" && n.treatment !== treatment) return false;
      if (!isWithinDateRange(n.credit_note_date, dates.range, dates.from, dates.to)) return false;
      if (!q) return true;
      return [n.credit_note_number, n.invoice_number, n.bill_to?.name ?? "", n.bill_to?.gstin ?? "", n.reason]
        .some((v) => v.toLowerCase().includes(q));
    });
  }, [notes, search, treatment, dates.range, dates.from, dates.to]);

  const pager = usePagination(filtered, `${search}|${treatment}|${dates.key}`);

  // Cards follow the filters above.
  const credited = filtered.reduce((sum, n) => sum + Number(n.total_amount || 0), 0);
  const gstCount = filtered.filter((n) => n.treatment === "gst").length;
  const restocked = filtered.reduce((sum, n) => sum + unitsRestocked(n), 0);

  const exportCsv = () =>
    downloadCsv(
      `credit-notes-${new Date().toISOString().slice(0, 10)}.csv`,
      ["Credit note #", "Date", "Invoice #", "Invoice date", "Customer", "GSTIN", "Reason", "Treatment", "Amount"],
      filtered.map((n) => [
        n.credit_note_number, n.credit_note_date, n.invoice_number, n.invoice_date, n.bill_to?.name ?? "", n.bill_to?.gstin ?? "",
        n.reason, n.treatment === "gst" ? "GST" : "Commercial", Number(n.total_amount || 0).toFixed(2),
      ])
    );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <PageTitle icon={FileMinus2}>Credit Notes</PageTitle>
          <p className="text-xs text-slate-500 mt-1">Invoice adjustments and credit documents.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" className="gap-1.5" onClick={exportCsv} disabled={!!loadError || filtered.length === 0}>
            <FileDown className="h-4 w-4" />
            Export CSV
          </Button>
          {!customer && (
            <>
              <Button asChild variant="outline" className="gap-1.5">
                <Link href="/admin/settings/sales">
                  <Settings className="h-4 w-4" />
                  Settings
                </Link>
              </Button>
              <Button onClick={openForm} disabled={pending || !!loadError} className="gap-1.5">
                <Plus className="h-4 w-4" />
                {pending ? "Loading…" : "New Credit Note"}
              </Button>
            </>
          )}
        </div>
      </div>

      {loadError && <LoadErrorCard message={loadError} />}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card className="p-3.5 bg-white border border-slate-200 shadow-none rounded-xl">
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">Credit Notes</div>
          <div className="text-xl font-bold text-slate-900">{filtered.length}</div>
        </Card>
        <Card className="p-3.5 bg-white border border-slate-200 shadow-none rounded-xl">
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">Total Credited</div>
          <div className="text-xl font-bold text-[#024AE5]">{inr(credited)}</div>
        </Card>
        <Card className="p-3.5 bg-white border border-slate-200 shadow-none rounded-xl">
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">GST / Commercial</div>
          <div className="text-xl font-bold text-slate-900">{gstCount} <span className="text-slate-400 font-normal">/</span> {filtered.length - gstCount}</div>
        </Card>
        {!customer && (
          <Card className="p-3.5 bg-white border border-slate-200 shadow-none rounded-xl">
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">Units Restocked</div>
            <div className="text-xl font-bold text-emerald-700">{restocked}</div>
          </Card>
        )}
      </div>

      <Card className="p-4 bg-white border border-slate-200 shadow-none rounded-xl">
        <div className="flex flex-col lg:flex-row lg:items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
            <Input
              aria-label="Search credit notes"
              placeholder="Search number, invoice, customer, GSTIN or reason…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 h-9 text-xs bg-slate-50/50 border-slate-200 focus:bg-white"
            />
          </div>
          <Select value={treatment} onValueChange={setTreatment}>
            <SelectTrigger className="h-9 text-xs bg-slate-50/50 border-slate-200 w-full lg:w-[160px]" aria-label="Treatment">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-white">
              <SelectItem value="all" className="text-xs">All Treatments</SelectItem>
              <SelectItem value="gst" className="text-xs">GST</SelectItem>
              <SelectItem value="commercial" className="text-xs">Commercial</SelectItem>
            </SelectContent>
          </Select>
          <DateRangeFilter state={dates} />
        </div>
      </Card>

      <div className="border border-slate-200 rounded-xl bg-white overflow-hidden">
        <div className="overflow-x-auto [scrollbar-width:thin]">
          <Table className="min-w-[860px]">
            <TableHeader>
              <TableRow className="bg-slate-50/80">
                {["Credit Note #", "Date", "Invoice / Customer", "Reason", "Treatment", "Amount", "Actions"].map((h) => (
                  <TableHead key={h} className={`text-[11px] font-bold uppercase tracking-wider ${h === "Amount" || h === "Actions" ? "text-right" : ""}`}>{h}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="py-12 text-center text-sm text-slate-500">
                    {notes.length ? "No credit notes match your filters." : "No credit notes issued yet."}
                  </TableCell>
                </TableRow>
              ) : (
                pager.pageItems.map((n) => (
                  <TableRow key={n.id} className="whitespace-nowrap">
                    <TableCell className="font-mono text-xs font-bold text-slate-900">
                      {n.credit_note_number}
                      {n.numbering_mode === "manual" && <span className="ml-1.5 text-[10px] font-normal text-slate-400">manual</span>}
                    </TableCell>
                    <TableCell className="text-xs text-slate-600">{fmtDate(n.credit_note_date)}</TableCell>
                    <TableCell className="text-xs max-w-[240px]">
                      <div className="font-mono text-slate-700">{n.invoice_number}</div>
                      <div className="text-slate-500 truncate" title={n.bill_to?.name}>{n.bill_to?.name}</div>
                    </TableCell>
                    <TableCell className="text-xs text-slate-600 max-w-[260px] truncate" title={n.reason}>
                      {n.reason}
                      {!customer && unitsRestocked(n) > 0 && (
                        <div className="text-[10px] text-emerald-700">{unitsRestocked(n)} units restocked</div>
                      )}
                    </TableCell>
                    <TableCell><Badge variant="outline">{n.treatment === "gst" ? "GST" : "Commercial"}</Badge></TableCell>
                    <TableCell className="text-right font-mono text-xs font-bold text-slate-900">{inr(Number(n.total_amount || 0))}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <IconAction label={`View ${n.credit_note_number}`} onClick={() => setViewing(n)}><Eye /></IconAction>
                        <IconAction label={`Download ${n.credit_note_number}`} href={`/api/credit-notes/${n.id}/pdf?download=1`}><Download /></IconAction>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
        <PaginationBar state={pager} noun="credit notes" />
      </div>

      {formData && (
        <CreditNoteFormModal
          data={formData}
          notes={notes}
          initialInvoiceId={invoiceId}
          onClose={() => setFormData(null)}
          onIssued={(note) => {
            setFormData(null);
            setViewing(note);
            router.refresh();
          }}
        />
      )}
      <Dialog open={!!viewing} onOpenChange={(open) => { if (!open) setViewing(null); }}>
        <DialogContent className="flex h-[90vh] max-w-5xl flex-col">
          <DialogHeader>
            <DialogTitle>{viewing?.credit_note_number}</DialogTitle>
            <DialogDescription>Credit against {viewing?.invoice_number}</DialogDescription>
          </DialogHeader>
          {viewing && (
            <iframe title={`Credit note ${viewing.credit_note_number}`} src={`/api/credit-notes/${viewing.id}/pdf`} className="min-h-0 flex-1 rounded-lg border" />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
