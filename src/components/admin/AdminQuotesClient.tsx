"use client";

import React, { useEffect, useState } from "react";
import { CommercialQuote, QuoteStatus, QuoteStatusHistoryEntry } from "@/types/database.types";
import { QUOTE_STATUS_CONFIG } from "@/lib/constants";
import { updateCommercialQuoteStatus, fetchCommercialQuotesList, getQuoteFormData, fetchQuoteStatusHistory, type QuoteFormData } from "@/actions/quote";
import { QuoteFormModal } from "./QuoteFormModal";
import { Skeleton } from "@/components/ui/skeleton";
import { PaginationBar, usePagination } from "@/components/common/Pagination";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  FileText,
  Search,
  Filter,
  RotateCcw,
  CheckCircle2,
  Clock,
  Send,
  Loader2,
  Building2,
  Phone,
  Mail,
  RefreshCw,
  Download,
  Eye,
  Plus,
  IndianRupee,
  Calendar,
  Layers,
} from "lucide-react";
import toast from "react-hot-toast";

interface AdminQuotesClientProps {
  initialQuotes: CommercialQuote[];
}

export function AdminQuotesClient({ initialQuotes }: AdminQuotesClientProps) {
  const [quotes, setQuotes] = useState<CommercialQuote[]>(initialQuotes);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Status & Note Management State
  const [selectedQuote, setSelectedQuote] = useState<CommercialQuote | null>(null);
  const [statusDraft, setStatusDraft] = useState<QuoteStatus>("draft");
  const [notesDraft, setNotesDraft] = useState("");
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  // Status timeline (separate table) for the quote open in the status modal.
  const [history, setHistory] = useState<{ quoteId: string; rows: QuoteStatusHistoryEntry[] } | null>(null);
  const selectedId = selectedQuote?.id ?? null;
  useEffect(() => {
    if (!selectedId) return;
    let cancelled = false;
    fetchQuoteStatusHistory(selectedId).then((rows) => { if (!cancelled) setHistory({ quoteId: selectedId, rows }); });
    return () => { cancelled = true; };
  }, [selectedId]);
  const historyLoading = !!selectedId && history?.quoteId !== selectedId;

  // View Quote Detail State
  const [viewingQuote, setViewingQuote] = useState<CommercialQuote | null>(null);

  // Create form + PDF preview
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  // Customers / open RFQs / defaults for the form, fetched ahead of the click so its dropdowns are ready on open.
  const [formData, setFormData] = useState<QuoteFormData | null>(null);
  useEffect(() => {
    let cancelled = false;
    getQuoteFormData().then((d) => { if (!cancelled) setFormData(d); });
    return () => { cancelled = true; };
  }, []);
  const [pdfQuote, setPdfQuote] = useState<CommercialQuote | null>(null);
  // Id of the quote whose PDF has finished loading; the skeleton shows until it matches.
  const [loadedPdfId, setLoadedPdfId] = useState<string | null>(null);

  // Metrics
  const totalCount = quotes.length;
  const totalPipelineValue = quotes.reduce((acc, q) => acc + q.total_amount, 0);
  const acceptedQuotes = quotes.filter((q) => q.status === "accepted");
  const acceptedValue = acceptedQuotes.reduce((acc, q) => acc + q.total_amount, 0);
  const pendingOrSentCount = quotes.filter((q) => q.status === "sent" || q.status === "draft").length;

  const filteredQuotes = quotes.filter((q) => {
    if (statusFilter !== "ALL" && q.status !== statusFilter) {
      return false;
    }
    if (searchQuery.trim()) {
      const term = searchQuery.toLowerCase();
      const matchNum = q.quote_number?.toLowerCase().includes(term);
      const matchCompany = q.company_name?.toLowerCase().includes(term);
      const matchContact = q.contact_person?.toLowerCase().includes(term);
      const matchEmail = q.email?.toLowerCase().includes(term);
      const matchMobile = q.mobile?.toLowerCase().includes(term);
      const matchItems = q.items?.some(
        (i) => i.name.toLowerCase().includes(term) || (i.sku ?? "").toLowerCase().includes(term)
      );
      return matchNum || matchCompany || matchContact || matchEmail || matchMobile || matchItems;
    }
    return true;
  });

  const pager = usePagination(filteredQuotes, `${searchQuery}|${statusFilter}`);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      const fresh = await fetchCommercialQuotesList();
      setQuotes(fresh);
      toast.success("Quotations list refreshed");
    } catch {
      toast.error("Failed to refresh quotations");
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleOpenStatusModal = (quote: CommercialQuote) => {
    setSelectedQuote(quote);
    setStatusDraft(quote.status);
    setNotesDraft(quote.admin_notes || "");
  };

  // Inline status change from the table. Notes are untouched; use the quote's detail modal to add one.
  const [statusUpdatingId, setStatusUpdatingId] = useState<string | null>(null);
  const handleInlineStatus = async (quote: CommercialQuote, next: QuoteStatus) => {
    if (next === quote.status) return;
    setStatusUpdatingId(quote.id);
    try {
      const res = await updateCommercialQuoteStatus(quote.id, { status: next });
      if (res.success) {
        setQuotes((prev) => prev.map((q) => (q.id === quote.id ? { ...q, status: next, updated_at: new Date().toISOString() } : q)));
        toast.success(`${quote.quote_number} marked ${QUOTE_STATUS_CONFIG[next]?.label ?? next}`);
      } else {
        toast.error(res.error || "Failed to update status");
      }
    } catch {
      toast.error("Unexpected error updating status");
    } finally {
      setStatusUpdatingId(null);
    }
  };

  const handleSaveStatus = async () => {
    if (!selectedQuote) return;
    setIsUpdatingStatus(true);
    try {
      const res = await updateCommercialQuoteStatus(selectedQuote.id, {
        status: statusDraft,
        admin_notes: notesDraft,
      });

      if (res.success) {
        toast.success(`Quotation ${selectedQuote.quote_number} updated`);
        setQuotes((prev) =>
          prev.map((q) =>
            q.id === selectedQuote.id
              ? { ...q, status: statusDraft, admin_notes: notesDraft, updated_at: new Date().toISOString() }
              : q
          )
        );
        setSelectedQuote(null);
      } else {
        toast.error(res.error || "Failed to update quotation status");
      }
    } catch {
      toast.error("Unexpected error updating quotation status");
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-[#024AE5]/10 flex items-center justify-center text-[#024AE5]">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Commercial Quotes</h1>
              <p className="text-sm text-slate-500">
                Official price estimates, line-item valuations, GST calculations, and print-ready PDF quotations.
              </p>
            </div>
          </div>
        </div>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full sm:w-auto">
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="w-full sm:w-auto justify-center border-slate-200 text-slate-700 hover:bg-slate-50 h-9 sm:h-8"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${isRefreshing ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Button
            size="sm"
            onClick={() => setIsCreateOpen(true)}
            className="w-full sm:w-auto justify-center bg-[#024AE5] hover:bg-[#024AE5]/90 text-white font-medium shadow-sm h-9 sm:h-8"
          >
            <Plus className="w-4 h-4 mr-2" />
            Create Quotation
          </Button>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-4 bg-white border border-slate-200 shadow-sm rounded-xl">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Quotes</span>
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-[#024AE5] flex items-center justify-center">
              <FileText className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-900">{totalCount}</span>
            <span className="text-xs text-slate-500">commercial estimates</span>
          </div>
        </Card>

        <Card className="p-4 bg-white border border-slate-200 shadow-sm rounded-xl">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Pipeline Value</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-[#3C8B4F] flex items-center justify-center">
              <IndianRupee className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-900">
              ₹{totalPipelineValue.toLocaleString("en-IN")}
            </span>
            <span className="text-xs text-slate-500">incl. GST where applicable</span>
          </div>
        </Card>

        <Card className="p-4 bg-white border border-slate-200 shadow-sm rounded-xl">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Accepted / Confirmed</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-emerald-600">{acceptedQuotes.length}</span>
            <span className="text-xs text-slate-500">
              (₹{acceptedValue.toLocaleString("en-IN")})
            </span>
          </div>
        </Card>

        <Card className="p-4 bg-white border border-slate-200 shadow-sm rounded-xl">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Pending Client Action</span>
            <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-700 flex items-center justify-center">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-amber-600">{pendingOrSentCount}</span>
            <span className="text-xs text-slate-500">drafts & dispatched</span>
          </div>
        </Card>
      </div>

      {/* Filters and Search Bar */}
      <Card className="p-4 bg-white border border-slate-200 shadow-sm rounded-xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <Input
              type="text"
              placeholder="Search by quote #, company name, contact, item SKU..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 bg-slate-50/50 border-slate-200 focus:bg-white text-sm"
            />
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 min-w-[190px]">
              <Filter className="w-4 h-4 text-slate-400" />
              <Select value={statusFilter} onValueChange={(val) => setStatusFilter(val)}>
                <SelectTrigger className="border-slate-200 text-sm bg-white">
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All Statuses ({quotes.length})</SelectItem>
                  <SelectItem value="draft">Draft ({quotes.filter((q) => q.status === "draft").length})</SelectItem>
                  <SelectItem value="sent">Sent to Client ({quotes.filter((q) => q.status === "sent").length})</SelectItem>
                  <SelectItem value="accepted">Accepted / Confirmed ({quotes.filter((q) => q.status === "accepted").length})</SelectItem>
                  <SelectItem value="rejected">Declined ({quotes.filter((q) => q.status === "rejected").length})</SelectItem>
                  <SelectItem value="expired">Expired ({quotes.filter((q) => q.status === "expired").length})</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {(searchQuery || statusFilter !== "ALL") && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSearchQuery("");
                  setStatusFilter("ALL");
                }}
                className="text-slate-500 hover:text-slate-700 text-xs"
              >
                <RotateCcw className="w-3.5 h-3.5 mr-1" />
                Reset
              </Button>
            )}
          </div>
        </div>
      </Card>

      {/* Commercial Quotes Table */}
      <Card className="bg-white border border-slate-200 shadow-sm rounded-xl overflow-hidden">
        <div className="overflow-x-auto [scrollbar-width:thin]">
          <Table className="min-w-[1000px]">
            <TableHeader className="bg-slate-50/75 border-b border-slate-200">
              <TableRow className="whitespace-nowrap">
                <TableHead className="font-semibold text-slate-700">Quote #</TableHead>
                <TableHead className="font-semibold text-slate-700">Date</TableHead>
                <TableHead className="font-semibold text-slate-700">Valid Until</TableHead>
                <TableHead className="font-semibold text-slate-700">Client</TableHead>
                <TableHead className="font-semibold text-slate-700 text-center">Items</TableHead>
                <TableHead className="font-semibold text-slate-700 text-right">Taxable</TableHead>
                <TableHead className="font-semibold text-slate-700 text-right">GST</TableHead>
                <TableHead className="font-semibold text-slate-700 text-right">Total</TableHead>
                <TableHead className="font-semibold text-slate-700">Status</TableHead>
                <TableHead className="font-semibold text-slate-700 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredQuotes.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10} className="h-44 text-center">
                    <div className="flex flex-col items-center justify-center text-slate-400">
                      <FileText className="w-8 h-8 mb-2 text-slate-300" />
                      <p className="text-sm font-medium text-slate-600">No commercial quotations found</p>
                      <p className="text-xs text-slate-400 mt-1">
                        Try adjusting your search criteria or create a new quotation.
                      </p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                pager.pageItems.map((quote) => {
                  const statusMeta = QUOTE_STATUS_CONFIG[quote.status] || {
                    label: quote.status,
                    badgeBg: "bg-slate-100",
                    badgeText: "text-slate-700",
                    border: "border-slate-200",
                  };
                  const fmtDay = (iso: string) =>
                    new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
                  const money = (n: number) => `₹${n.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`;

                  // One line per quote: every cell is nowrap, long text truncates (full text on hover).
                  return (
                    <TableRow key={quote.id} className="hover:bg-slate-50/60 transition-colors whitespace-nowrap">
                      <TableCell className="py-2.5 font-mono font-bold text-xs text-[#024AE5]">
                        <button onClick={() => handleOpenStatusModal(quote)} className="hover:underline" title="Notes & status history">
                          {quote.quote_number}
                        </button>
                      </TableCell>
                      <TableCell className="py-2.5 text-xs text-slate-600">{fmtDay(quote.quote_date)}</TableCell>
                      <TableCell className="py-2.5 text-xs text-slate-500">{fmtDay(quote.valid_until)}</TableCell>
                      <TableCell
                        className="py-2.5 max-w-[240px] truncate text-xs font-semibold text-slate-900"
                        title={[quote.company_name, quote.contact_person, quote.mobile, quote.email, quote.gstin && `GSTIN ${quote.gstin}`].filter(Boolean).join(" · ")}
                      >
                        {quote.company_name}
                        {quote.contact_person ? <span className="font-normal text-slate-500"> · {quote.contact_person}</span> : null}
                      </TableCell>
                      <TableCell className="py-2.5 text-center">
                        <button
                          onClick={() => setViewingQuote(quote)}
                          className="text-xs font-medium text-[#024AE5] hover:underline"
                          title={quote.items.map((i) => `${i.quantity}× ${i.name}`).join(", ")}
                        >
                          {quote.items.length} item{quote.items.length !== 1 ? "s" : ""}
                        </button>
                      </TableCell>
                      <TableCell className="py-2.5 text-right font-mono text-xs text-slate-700">{money(quote.subtotal)}</TableCell>
                      <TableCell className="py-2.5 text-right font-mono text-xs text-slate-500">
                        {quote.gst_enabled ? money(quote.tax_amount) : "—"}
                      </TableCell>
                      <TableCell className="py-2.5 text-right font-mono font-bold text-xs text-[#024AE5]">{money(quote.total_amount)}</TableCell>
                      <TableCell className="py-2.5" title={quote.admin_notes ? `Note: ${quote.admin_notes}` : undefined}>
                        <Select
                          value={quote.status}
                          disabled={statusUpdatingId === quote.id}
                          onValueChange={(v) => handleInlineStatus(quote, v as QuoteStatus)}
                        >
                          <SelectTrigger
                            className={`h-7 w-[130px] text-[11px] font-medium px-2 py-0 ${statusMeta.badgeBg} ${statusMeta.badgeText} ${statusMeta.border}`}
                            aria-label={`Status of ${quote.quote_number}`}
                          >
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="bg-white">
                            {(Object.keys(QUOTE_STATUS_CONFIG) as QuoteStatus[]).map((st) => (
                              <SelectItem key={st} value={st} className="text-xs">{QUOTE_STATUS_CONFIG[st].label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell className="py-2.5 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setPdfQuote(quote)}
                            className="h-7 px-2 border-[#024AE5]/30 text-[#024AE5] hover:bg-[#024AE5]/5 text-xs font-medium"
                            title="View official PDF quotation"
                          >
                            <Eye className="w-3.5 h-3.5 mr-1" />
                            PDF
                          </Button>
                          <Button asChild variant="ghost" size="sm" className="h-7 px-2 text-slate-600" title="Download PDF">
                            <a href={`/api/quotes/${quote.id}/pdf?download=1`}>
                              <Download className="w-3.5 h-3.5" />
                            </a>
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
        <PaginationBar state={pager} noun="quotations" />
      </Card>

      {/* Status & Internal Notes Modal */}
      <Dialog open={!!selectedQuote} onOpenChange={(open) => !open && setSelectedQuote(null)}>
        <DialogContent className="sm:max-w-[640px] p-6 pr-12 max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <FileText className="w-5 h-5 text-[#024AE5]" />
              Notes & Status History
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Manage commercial status for quotation{" "}
              <span className="font-mono font-semibold text-[#024AE5]">
                {selectedQuote?.quote_number}
              </span>{" "}
              ({selectedQuote?.company_name})
            </DialogDescription>
          </DialogHeader>

          {selectedQuote && (
            <div className="space-y-4 pt-2">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-700">Quotation Status</Label>
                <Select
                  value={statusDraft}
                  onValueChange={(val) => setStatusDraft(val as QuoteStatus)}
                >
                  <SelectTrigger className="border-slate-200">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">Draft (Preparing Estimate)</SelectItem>
                    <SelectItem value="sent">Sent to Client (Dispatched / Pending Decision)</SelectItem>
                    <SelectItem value="accepted">Accepted / PO Confirmed (Proceed to Production)</SelectItem>
                    <SelectItem value="rejected">Declined / Rejected</SelectItem>
                    <SelectItem value="expired">Expired (&gt;30 Days)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-700">Internal Admin & Commercial Notes</Label>
                <Textarea
                  rows={4}
                  placeholder="Record customer negotiations, approved volume discounts, or Purchase Order references..."
                  value={notesDraft}
                  onChange={(e) => setNotesDraft(e.target.value)}
                  className="border-slate-200 text-xs leading-relaxed"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-700">Status History</Label>
                <div className="border border-slate-200 rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader className="bg-slate-50">
                      <TableRow>
                        <TableHead className="text-[11px]">When</TableHead>
                        <TableHead className="text-[11px]">Change</TableHead>
                        <TableHead className="text-[11px]">By</TableHead>
                        <TableHead className="text-[11px]">Note</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {historyLoading ? (
                        Array.from({ length: 2 }).map((_, i) => (
                          <TableRow key={i}>
                            <TableCell colSpan={4}><Skeleton className="h-4 w-full" /></TableCell>
                          </TableRow>
                        ))
                      ) : !history || history.rows.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={4} className="text-center text-xs text-slate-400 py-4">No status changes recorded yet.</TableCell>
                        </TableRow>
                      ) : (
                        history.rows.map((h) => (
                          <TableRow key={h.id} className="text-xs">
                            <TableCell className="whitespace-nowrap text-slate-500">
                              {new Date(h.changed_at).toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                            </TableCell>
                            <TableCell className="whitespace-nowrap font-medium text-slate-800">
                              {h.from_status ? `${QUOTE_STATUS_CONFIG[h.from_status]?.label ?? h.from_status} → ` : ""}
                              {QUOTE_STATUS_CONFIG[h.to_status]?.label ?? h.to_status}
                            </TableCell>
                            <TableCell className="text-slate-600">{h.changed_by_name || "—"}</TableCell>
                            <TableCell className="text-slate-500 max-w-[180px] truncate" title={h.notes ?? undefined}>{h.notes || "—"}</TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </div>

              <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-100">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedQuote(null)}
                  disabled={isUpdatingStatus}
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={handleSaveStatus}
                  disabled={isUpdatingStatus}
                  className="bg-[#024AE5] hover:bg-[#024AE5]/90 text-white font-medium"
                >
                  {isUpdatingStatus ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    "Save Changes"
                  )}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* View Items Breakdown Modal */}
      <Dialog open={!!viewingQuote} onOpenChange={(open) => !open && setViewingQuote(null)}>
        <DialogContent className="max-w-2xl w-[95vw] sm:w-full p-4 sm:p-6 rounded-xl sm:rounded-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2">
              <Layers className="w-5 h-5 text-[#024AE5]" />
              Quotation Line Items Breakdown
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Quotation{" "}
              <span className="font-mono font-semibold text-[#024AE5]">
                {viewingQuote?.quote_number}
              </span>{" "}
              for {viewingQuote?.company_name}
            </DialogDescription>
          </DialogHeader>

          {viewingQuote && (
            <div className="space-y-4 pt-2">
              <div className="border border-slate-200 rounded-lg overflow-x-auto [scrollbar-width:thin]">
                <Table className="min-w-[480px]">
                  <TableHeader className="bg-slate-50">
                    <TableRow>
                      <TableHead className="text-xs">SKU & Title</TableHead>
                      <TableHead className="text-xs text-center">Qty</TableHead>
                      <TableHead className="text-xs text-right">Unit Rate</TableHead>
                      <TableHead className="text-xs text-right">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {viewingQuote.items.map((item, idx) => (
                      <TableRow key={idx}>
                        <TableCell className="py-2.5">
                          <div className="font-semibold text-xs text-slate-900">{item.name}</div>
                          <div className="font-mono text-[10px] text-slate-400">{item.description || item.sku}</div>
                        </TableCell>
                        <TableCell className="text-center font-mono text-xs py-2.5">
                          {item.quantity}
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs py-2.5">
                          ₹{item.unitPrice.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                        </TableCell>
                        <TableCell className="text-right font-mono font-semibold text-xs py-2.5 text-slate-900">
                          ₹{item.taxable.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Financial summary box */}
              <div className="bg-slate-50 rounded-lg p-3.5 space-y-1.5 text-xs font-mono">
                <div className="flex justify-between text-slate-600">
                  <span>Taxable amount:</span>
                  <span>₹{viewingQuote.subtotal.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>{viewingQuote.gst_enabled ? "GST:" : "GST: not applied"}</span>
                  <span>₹{viewingQuote.tax_amount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between font-bold text-sm text-[#024AE5] pt-1.5 border-t border-slate-200">
                  <span>Grand Total:</span>
                  <span>₹{viewingQuote.total_amount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
                </div>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <Button
                  size="sm"
                  onClick={() => {
                    setPdfQuote(viewingQuote);
                    setViewingQuote(null);
                  }}
                  className="bg-[#024AE5] text-white"
                >
                  <Eye className="w-3.5 h-3.5 mr-1.5" />
                  View PDF
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {isCreateOpen && (
        <QuoteFormModal
          data={formData}
          onOpenChange={setIsCreateOpen}
          onCreated={(quote) => {
            setIsCreateOpen(false);
            // The RFQ list and the next-number preview just changed.
            getQuoteFormData().then(setFormData);
            setQuotes((prev) => [quote, ...prev]);
            setPdfQuote(quote);
          }}
        />
      )}

      {/* PDF preview: the same react-pdf render that Download saves */}
      <Dialog open={!!pdfQuote} onOpenChange={(open) => !open && setPdfQuote(null)}>
        <DialogContent className="max-w-4xl h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="font-mono">{pdfQuote?.quote_number}</DialogTitle>
            <DialogDescription>{pdfQuote?.company_name}</DialogDescription>
          </DialogHeader>
          {pdfQuote && (
            <div className="relative flex-1 min-h-0">
              {loadedPdfId !== pdfQuote.id && (
                <div className="absolute inset-0 z-10 rounded-lg border border-slate-200 bg-white p-6 space-y-5" aria-busy="true" aria-label="Loading quotation">
                  <Skeleton className="h-14 w-28" />
                  <Skeleton className="h-24" />
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Skeleton key={i} className="h-10 bg-slate-100" />
                  ))}
                </div>
              )}
              <iframe
                key={pdfQuote.id}
                title={`Quotation ${pdfQuote.quote_number}`}
                src={`/api/quotes/${pdfQuote.id}/pdf`}
                onLoad={() => setLoadedPdfId(pdfQuote.id)}
                className="h-full w-full rounded-lg border border-slate-200 bg-slate-50"
              />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
