"use client";

import React, { useState } from "react";
import { CommercialQuote, QuoteStatus } from "@/types/database.types";
import { QUOTE_STATUS_CONFIG } from "@/lib/constants";
import {
  updateCommercialQuoteStatus,
  fetchCommercialQuotesList,
  createCommercialQuote,
} from "@/actions/quote";
import { generateQuotePdf } from "@/lib/generateQuotePdf";
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
  Printer,
  Plus,
  IndianRupee,
  Calendar,
  Layers,
  Trash2,
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

  // View Quote Detail State
  const [viewingQuote, setViewingQuote] = useState<CommercialQuote | null>(null);

  // Create Quote Dialog State
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [newCompanyName, setNewCompanyName] = useState("");
  const [newContactPerson, setNewContactPerson] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newMobile, setNewMobile] = useState("");
  const [newGstin, setNewGstin] = useState("");
  const [newAddress, setNewAddress] = useState("");
  const [newPaymentTerms, setNewPaymentTerms] = useState("30 Days PDC against delivery");
  const [newDeliveryTerms, setNewDeliveryTerms] = useState("Ex-Works MIDC Waluj, 5-7 business days");
  const [newValidDays, setNewValidDays] = useState("30");
  const [newItems, setNewItems] = useState<
    Array<{ title: string; sku: string; quantity: number; unit_price: number }>
  >([
    { title: "Solid Carbide End Mill 10mm 4-Flute", sku: "EM-SC-4F-10MM", quantity: 20, unit_price: 1450 },
  ]);

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
        (i) => i.title.toLowerCase().includes(term) || i.sku.toLowerCase().includes(term)
      );
      return matchNum || matchCompany || matchContact || matchEmail || matchMobile || matchItems;
    }
    return true;
  });

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

  const handlePrintPdf = (quote: CommercialQuote) => {
    try {
      const cartItems = quote.items.map((item) => ({
        id: item.id,
        productId: item.id,
        variantId: item.id,
        title: item.title,
        sku: item.sku,
        unitPrice: item.unit_price,
        quantity: item.quantity,
        specifications: item.specifications || {},
      }));

      generateQuotePdf(
        cartItems,
        {
          subtotal: quote.subtotal,
          gstAmount: quote.tax_amount,
          totalAmount: quote.total_amount,
        },
        {
          companyName: quote.company_name,
          contactName: quote.contact_person,
          email: quote.email,
          mobile: quote.mobile,
          address: quote.address || undefined,
          gstin: quote.gstin || undefined,
        }
      );
    } catch {
      toast.error("Failed to generate PDF quotation");
    }
  };

  // Create Quote Calculation Helpers
  const calcSubtotal = newItems.reduce((acc, item) => acc + item.quantity * item.unit_price, 0);
  const calcGst = calcSubtotal * 0.18;
  const calcTotal = calcSubtotal + calcGst;

  const handleAddItemRow = () => {
    setNewItems((prev) => [
      ...prev,
      { title: "", sku: "", quantity: 1, unit_price: 0 },
    ]);
  };

  const handleRemoveItemRow = (index: number) => {
    if (newItems.length <= 1) {
      toast.error("Quotation must have at least one line item");
      return;
    }
    setNewItems((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleItemChange = (index: number, field: string, value: any) => {
    setNewItems((prev) =>
      prev.map((item, idx) => {
        if (idx === index) {
          return { ...item, [field]: value };
        }
        return item;
      })
    );
  };

  const handleCreateQuote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCompanyName.trim()) {
      toast.error("Client company name is required");
      return;
    }
    if (!newContactPerson.trim()) {
      toast.error("Contact person is required");
      return;
    }
    if (!newEmail.trim() && !newMobile.trim()) {
      toast.error("Either email or mobile number is required");
      return;
    }
    if (newItems.some((i) => !i.title.trim() || i.quantity <= 0 || i.unit_price <= 0)) {
      toast.error("Please fill in valid titles, quantities, and unit rates for all items");
      return;
    }

    setIsCreating(true);
    try {
      const validUntilDate = new Date(
        Date.now() + parseInt(newValidDays || "30", 10) * 24 * 60 * 60 * 1000
      )
        .toISOString()
        .split("T")[0];

      const res = await createCommercialQuote({
        company_name: newCompanyName.trim(),
        contact_person: newContactPerson.trim(),
        email: newEmail.trim(),
        mobile: newMobile.trim(),
        gstin: newGstin.trim() || null,
        address: newAddress.trim() || null,
        items: newItems.map((item, idx) => ({
          id: `item-${Date.now()}-${idx}`,
          title: item.title,
          sku: item.sku || `SKU-${idx + 1}`,
          quantity: Number(item.quantity),
          unit_price: Number(item.unit_price),
          total_price: Number(item.quantity) * Number(item.unit_price),
        })),
        subtotal: calcSubtotal,
        tax_rate: 18,
        tax_amount: calcGst,
        total_amount: calcTotal,
        status: "sent",
        valid_until: validUntilDate,
        payment_terms: newPaymentTerms,
        delivery_terms: newDeliveryTerms,
        admin_notes: "Created from Admin Commercial Quotes workspace",
      });

      if (res.success && res.quote) {
        toast.success(`Quotation ${res.quote.quote_number} generated successfully!`);
        setQuotes((prev) => [res.quote!, ...prev]);
        setIsCreateOpen(false);
        // Reset form
        setNewCompanyName("");
        setNewContactPerson("");
        setNewEmail("");
        setNewMobile("");
        setNewGstin("");
        setNewAddress("");
      } else {
        toast.error(res.error || "Failed to create quotation");
      }
    } catch {
      toast.error("Unexpected error creating quotation");
    } finally {
      setIsCreating(false);
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
            <span className="text-xs text-slate-500">incl. 18% GST</span>
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
              placeholder="Search by quote # (e.g. QT-2609), company name, contact, item SKU..."
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
          <Table className="min-w-[900px]">
            <TableHeader className="bg-slate-50/75 border-b border-slate-200">
              <TableRow>
                <TableHead className="w-[180px] font-semibold text-slate-700">Quote Number</TableHead>
                <TableHead className="font-semibold text-slate-700">Client / Company</TableHead>
                <TableHead className="font-semibold text-slate-700">Line Items</TableHead>
                <TableHead className="font-semibold text-slate-700 text-right">Subtotal & GST</TableHead>
                <TableHead className="font-semibold text-slate-700 text-right">Total Amount</TableHead>
                <TableHead className="font-semibold text-slate-700">Status</TableHead>
                <TableHead className="font-semibold text-slate-700 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredQuotes.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-44 text-center">
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
                filteredQuotes.map((quote) => {
                  const statusMeta = QUOTE_STATUS_CONFIG[quote.status] || {
                    label: quote.status,
                    badgeBg: "bg-slate-100",
                    badgeText: "text-slate-700",
                    border: "border-slate-200",
                  };

                  return (
                    <TableRow key={quote.id} className="hover:bg-slate-50/60 transition-colors">
                      {/* Quote Number & Dates */}
                      <TableCell className="align-top py-3.5">
                        <div className="font-mono font-bold text-sm text-[#024AE5]">
                          {quote.quote_number}
                        </div>
                        <div className="flex items-center gap-1 text-[11px] text-slate-500 mt-1">
                          <Calendar className="w-3 h-3 text-slate-400" />
                          <span>{new Date(quote.created_at).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}</span>
                        </div>
                        <div className="text-[11px] text-slate-400 mt-0.5">
                          Valid: {new Date(quote.valid_until).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                        </div>
                      </TableCell>

                      {/* Client / Company Details */}
                      <TableCell className="align-top py-3.5">
                        <div className="font-semibold text-sm text-slate-900 flex items-center gap-1.5">
                          <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span>{quote.company_name}</span>
                        </div>
                        <div className="text-xs text-slate-600 mt-0.5 font-medium">
                          Attn: {quote.contact_person}
                        </div>
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-500 mt-1.5">
                          {quote.mobile && (
                            <span className="flex items-center gap-1">
                              <Phone className="w-3 h-3 text-slate-400" />
                              {quote.mobile}
                            </span>
                          )}
                          {quote.email && (
                            <span className="flex items-center gap-1">
                              <Mail className="w-3 h-3 text-slate-400" />
                              {quote.email}
                            </span>
                          )}
                        </div>
                        {quote.gstin && (
                          <div className="text-[10px] font-mono text-slate-400 mt-1">
                            GSTIN: {quote.gstin}
                          </div>
                        )}
                      </TableCell>

                      {/* Items Summary */}
                      <TableCell className="align-top py-3.5 max-w-[260px]">
                        <div className="text-xs font-semibold text-slate-800 flex items-center gap-1.5">
                          <Layers className="w-3.5 h-3.5 text-slate-400" />
                          <span>{quote.items.length} Line Item{quote.items.length !== 1 ? "s" : ""}</span>
                        </div>
                        <div className="space-y-1 mt-1.5">
                          {quote.items.slice(0, 2).map((item, idx) => (
                            <div key={idx} className="text-[11px] text-slate-600 truncate">
                              <span className="font-mono font-medium text-slate-700 mr-1.5">
                                {item.quantity}×
                              </span>
                              <span>{item.title}</span>
                            </div>
                          ))}
                          {quote.items.length > 2 && (
                            <button
                              onClick={() => setViewingQuote(quote)}
                              className="text-[11px] text-[#024AE5] font-medium hover:underline pt-0.5"
                            >
                              +{quote.items.length - 2} more items...
                            </button>
                          )}
                        </div>
                      </TableCell>

                      {/* Subtotal & GST */}
                      <TableCell className="align-top py-3.5 text-right font-mono">
                        <div className="text-xs text-slate-700">
                          ₹{quote.subtotal.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                        </div>
                        <div className="text-[11px] text-slate-400 mt-0.5">
                          +18% GST: ₹{quote.tax_amount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                        </div>
                      </TableCell>

                      {/* Total Amount */}
                      <TableCell className="align-top py-3.5 text-right">
                        <div className="font-mono font-bold text-sm text-[#024AE5]">
                          ₹{quote.total_amount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                        </div>
                        <div className="text-[10px] text-slate-400">Grand Total (Net)</div>
                      </TableCell>

                      {/* Status */}
                      <TableCell className="align-top py-3.5">
                        <Badge
                          variant="outline"
                          className={`${statusMeta.badgeBg} ${statusMeta.badgeText} ${statusMeta.border} text-xs font-medium px-2.5 py-0.5`}
                        >
                          {statusMeta.label}
                        </Badge>
                        {quote.admin_notes && (
                          <div className="text-[11px] text-slate-500 italic mt-1.5 max-w-[150px] truncate" title={quote.admin_notes}>
                            &quot;{quote.admin_notes}&quot;
                          </div>
                        )}
                      </TableCell>

                      {/* Actions */}
                      <TableCell className="align-top py-3.5 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handlePrintPdf(quote)}
                            className="h-8 px-2.5 border-[#024AE5]/30 text-[#024AE5] hover:bg-[#024AE5]/5 text-xs font-medium"
                            title="Print / Export Official PDF Quote"
                          >
                            <Printer className="w-3.5 h-3.5 mr-1" />
                            PDF Quote
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleOpenStatusModal(quote)}
                            className="h-8 px-2.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 text-xs"
                          >
                            Status
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
      </Card>

      {/* Status & Internal Notes Modal */}
      <Dialog open={!!selectedQuote} onOpenChange={(open) => !open && setSelectedQuote(null)}>
        <DialogContent className="sm:max-w-[500px] p-6 pr-12">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <FileText className="w-5 h-5 text-[#024AE5]" />
              Update Status & Notes
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
                          <div className="font-semibold text-xs text-slate-900">{item.title}</div>
                          <div className="font-mono text-[10px] text-slate-400">{item.sku}</div>
                        </TableCell>
                        <TableCell className="text-center font-mono text-xs py-2.5">
                          {item.quantity}
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs py-2.5">
                          ₹{item.unit_price.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                        </TableCell>
                        <TableCell className="text-right font-mono font-semibold text-xs py-2.5 text-slate-900">
                          ₹{item.total_price.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Financial summary box */}
              <div className="bg-slate-50 rounded-lg p-3.5 space-y-1.5 text-xs font-mono">
                <div className="flex justify-between text-slate-600">
                  <span>Subtotal:</span>
                  <span>₹{viewingQuote.subtotal.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>GST (18%):</span>
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
                    handlePrintPdf(viewingQuote);
                    setViewingQuote(null);
                  }}
                  className="bg-[#024AE5] text-white"
                >
                  <Printer className="w-3.5 h-3.5 mr-1.5" />
                  Print / Download PDF
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Create New Quotation Modal */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="max-w-2xl w-[95vw] sm:w-full max-h-[90vh] overflow-y-auto p-4 sm:p-6 rounded-xl sm:rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <Plus className="w-5 h-5 text-[#024AE5]" />
              Create Commercial Quotation
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Issue an official tooling price estimate with automatic 18% GST and itemized pricing.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreateQuote} className="space-y-4 pt-2">
            {/* Customer Details */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs font-semibold text-slate-700">Company Name *</Label>
                <Input
                  required
                  placeholder="e.g. Tata Motors Ltd"
                  value={newCompanyName}
                  onChange={(e) => setNewCompanyName(e.target.value)}
                  className="text-xs border-slate-200"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-semibold text-slate-700">Contact Person *</Label>
                <Input
                  required
                  placeholder="e.g. Ramesh Kulkarni"
                  value={newContactPerson}
                  onChange={(e) => setNewContactPerson(e.target.value)}
                  className="text-xs border-slate-200"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-semibold text-slate-700">Email Address</Label>
                <Input
                  type="email"
                  placeholder="ramesh@company.com"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  className="text-xs border-slate-200"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-semibold text-slate-700">Mobile Number</Label>
                <Input
                  placeholder="+91 98000 00000"
                  value={newMobile}
                  onChange={(e) => setNewMobile(e.target.value)}
                  className="text-xs border-slate-200"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-semibold text-slate-700">GSTIN</Label>
                <Input
                  placeholder="27AAAAA0000A1Z5"
                  value={newGstin}
                  onChange={(e) => setNewGstin(e.target.value)}
                  className="text-xs border-slate-200 font-mono"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-semibold text-slate-700">Validity (Days)</Label>
                <Input
                  type="number"
                  min="1"
                  max="90"
                  value={newValidDays}
                  onChange={(e) => setNewValidDays(e.target.value)}
                  className="text-xs border-slate-200"
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-semibold text-slate-700">Delivery Address / Plant Location</Label>
              <Input
                placeholder="Plot No, MIDC Industrial Area, City, State"
                value={newAddress}
                onChange={(e) => setNewAddress(e.target.value)}
                className="text-xs border-slate-200"
              />
            </div>

            {/* Line Items Builder */}
            <div className="space-y-2 pt-2 border-t border-slate-200">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                  Line Items & Unit Rates
                </Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleAddItemRow}
                  className="h-7 text-xs border-[#024AE5]/30 text-[#024AE5]"
                >
                  <Plus className="w-3.5 h-3.5 mr-1" />
                  Add Line Item
                </Button>
              </div>

              <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                {newItems.map((item, idx) => (
                  <div
                    key={idx}
                    className="p-2.5 bg-slate-50 rounded-lg border border-slate-200 grid grid-cols-12 gap-2 items-center text-xs"
                  >
                    <div className="col-span-5">
                      <Input
                        required
                        placeholder="Item Description / Tool Name"
                        value={item.title}
                        onChange={(e) => handleItemChange(idx, "title", e.target.value)}
                        className="h-8 text-xs bg-white"
                      />
                    </div>
                    <div className="col-span-2">
                      <Input
                        placeholder="SKU"
                        value={item.sku}
                        onChange={(e) => handleItemChange(idx, "sku", e.target.value)}
                        className="h-8 text-xs font-mono bg-white"
                      />
                    </div>
                    <div className="col-span-2">
                      <Input
                        required
                        type="number"
                        min="1"
                        placeholder="Qty"
                        value={item.quantity}
                        onChange={(e) => handleItemChange(idx, "quantity", Number(e.target.value))}
                        className="h-8 text-xs font-mono bg-white text-center"
                      />
                    </div>
                    <div className="col-span-2">
                      <Input
                        required
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="Rate ₹"
                        value={item.unit_price}
                        onChange={(e) => handleItemChange(idx, "unit_price", Number(e.target.value))}
                        className="h-8 text-xs font-mono bg-white text-right"
                      />
                    </div>
                    <div className="col-span-1 text-center">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemoveItemRow(idx)}
                        className="h-8 w-8 p-0 text-rose-500 hover:bg-rose-50"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Calculations Box */}
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 space-y-1 font-mono text-xs">
              <div className="flex justify-between text-slate-600">
                <span>Subtotal:</span>
                <span>₹{calcSubtotal.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>GST (18%):</span>
                <span>₹{calcGst.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="flex justify-between font-bold text-sm text-[#024AE5] pt-1.5 border-t border-slate-200">
                <span>Grand Total:</span>
                <span>₹{calcTotal.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
              </div>
            </div>

            <div className="pt-2 flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2 border-t border-slate-100">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsCreateOpen(false)}
                disabled={isCreating}
                className="w-full sm:w-auto h-9 sm:h-8"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={isCreating}
                className="w-full sm:w-auto h-9 sm:h-8 bg-[#024AE5] hover:bg-[#024AE5]/90 text-white font-medium shadow-sm justify-center"
              >
                {isCreating ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                    Generating Quotation...
                  </>
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5 mr-1.5" />
                    Issue Quotation
                  </>
                )}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
