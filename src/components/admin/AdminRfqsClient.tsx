"use client";

import React, { useState } from "react";
import { RFQ, RFQStatus } from "@/types/database.types";
import { updateRfqQuotation, fetchAllRfqsList } from "@/actions/rfq";
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
  Clock,
  Send,
  Loader2,
  ExternalLink,
  Edit,
  Phone,
  Mail,
  RefreshCw,
  MessageCircle,
  Paperclip,
  Calendar,
  Layers,
  Building2,
  CheckCircle2,
} from "lucide-react";
import toast from "react-hot-toast";

interface AdminRfqsClientProps {
  initialRfqs: RFQ[];
}

export function AdminRfqsClient({ initialRfqs }: AdminRfqsClientProps) {
  const [rfqs, setRfqs] = useState<RFQ[]>(initialRfqs);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Review & Quote Editor State
  const [editingRfq, setEditingRfq] = useState<RFQ | null>(null);
  const [quoteStatus, setQuoteStatus] = useState<RFQStatus>("pending");
  const [quotedAmount, setQuotedAmount] = useState<string>("");
  const [adminNotes, setAdminNotes] = useState<string>("");
  const [isSaving, setIsSaving] = useState(false);

  // Metrics
  const totalCount = rfqs.length;
  const pendingCount = rfqs.filter((r) => r.status === "pending").length;
  const reviewingCount = rfqs.filter((r) => r.status === "reviewing").length;
  const quotedCount = rfqs.filter((r) => r.status === "quoted" || r.status === "accepted").length;

  const filteredRfqs = rfqs.filter((r) => {
    if (statusFilter !== "ALL" && r.status !== statusFilter) {
      return false;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchNum = r.rfq_number?.toLowerCase().includes(q);
      const matchCompany = r.company_name?.toLowerCase().includes(q);
      const matchContact = r.contact_person?.toLowerCase().includes(q);
      const matchEmail = r.email?.toLowerCase().includes(q);
      const matchMobile = r.mobile?.toLowerCase().includes(q);
      const matchItem = r.item_name?.toLowerCase().includes(q);
      const matchSpecs = r.specifications?.toLowerCase().includes(q);
      return matchNum || matchCompany || matchContact || matchEmail || matchMobile || matchItem || matchSpecs;
    }
    return true;
  });

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      const freshRfqs = await fetchAllRfqsList();
      setRfqs(freshRfqs);
      toast.success("RFQs list refreshed.");
    } catch {
      toast.error("Failed to refresh RFQs.");
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleOpenEditor = (rfq: RFQ) => {
    setEditingRfq(rfq);
    setQuoteStatus(rfq.status);
    setQuotedAmount(rfq.quoted_amount ? String(rfq.quoted_amount) : "");
    setAdminNotes(rfq.admin_notes || "");
  };

  const handleSaveQuote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRfq) return;

    setIsSaving(true);
    const amountVal = quotedAmount.trim() ? Number(quotedAmount.trim()) : null;

    const result = await updateRfqQuotation(editingRfq.id, {
      status: quoteStatus,
      quoted_amount: amountVal,
      admin_notes: adminNotes.trim() || null,
    });

    setIsSaving(false);

    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success(`RFQ #${editingRfq.rfq_number} updated`);
      setRfqs((prev) =>
        prev.map((r) =>
          r.id === editingRfq.id
            ? {
                ...r,
                status: quoteStatus,
                quoted_amount: amountVal,
                admin_notes: adminNotes.trim() || null,
                updated_at: new Date().toISOString(),
              }
            : r
        )
      );
      setEditingRfq(null);
    }
  };

  const getStatusBadge = (status: RFQStatus) => {
    switch (status) {
      case "pending":
        return (
          <Badge variant="warning" className="gap-1 font-medium bg-amber-50 text-amber-800 border-amber-300">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
            Under Review
          </Badge>
        );
      case "reviewing":
        return (
          <Badge variant="blue" className="gap-1 font-medium bg-blue-50 text-[#024AE5] border-blue-200">
            <Clock className="w-3 h-3" />
            Engineering Review
          </Badge>
        );
      case "quoted":
        return (
          <Badge variant="blue" className="gap-1 font-medium bg-blue-100 text-[#024AE5] border-[#024AE5]/30">
            <CheckCircle2 className="w-3 h-3" />
            Quotation Issued
          </Badge>
        );
      case "accepted":
        return (
          <Badge variant="success" className="gap-1 font-medium bg-emerald-50 text-emerald-800 border-emerald-300">
            <CheckCircle2 className="w-3 h-3" />
            Accepted / PO
          </Badge>
        );
      case "declined":
        return (
          <Badge variant="destructive" className="gap-1 font-medium bg-red-50 text-red-700 border-red-200">
            Declined
          </Badge>
        );
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2.5">
            <Layers className="w-6 h-6 text-[#024AE5]" />
            <span>Customer Requests for Quotation (RFQs)</span>
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Review incoming custom tooling and fastener inquiries, inspect CAD drawings, and prepare estimates.
          </p>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={handleRefresh}
          disabled={isRefreshing}
          className="cursor-pointer gap-2 border-slate-200 hover:bg-slate-50 self-start sm:self-auto"
        >
          <RefreshCw className={`w-4 h-4 ${isRefreshing ? "animate-spin text-[#024AE5]" : "text-slate-500"}`} />
          <span>Refresh</span>
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-4 bg-white border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Total Inbound RFQs
            </span>
            <div className="p-2 rounded-lg bg-blue-50 text-[#024AE5]">
              <FileText className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-extrabold text-slate-900 mt-2">{totalCount}</div>
          <p className="text-xs text-slate-400 mt-1">All custom requests</p>
        </Card>

        <Card className="p-4 bg-white border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-amber-700">
              Under Review
            </span>
            <div className="p-2 rounded-lg bg-amber-50 text-amber-600">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-extrabold text-amber-700 mt-2">{pendingCount}</div>
          <p className="text-xs text-amber-600 mt-1">Newly submitted</p>
        </Card>

        <Card className="p-4 bg-white border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-[#024AE5]">
              Engineering Review
            </span>
            <div className="p-2 rounded-lg bg-blue-50 text-[#024AE5]">
              <Layers className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-extrabold text-[#024AE5] mt-2">{reviewingCount}</div>
          <p className="text-xs text-slate-400 mt-1">Drawing & feasibility check</p>
        </Card>

        <Card className="p-4 bg-white border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-emerald-700">
              Quotation Prepared
            </span>
            <div className="p-2 rounded-lg bg-emerald-50 text-emerald-600">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-extrabold text-emerald-700 mt-2">{quotedCount}</div>
          <p className="text-xs text-emerald-600 mt-1">Quoted or converted</p>
        </Card>
      </div>

      {/* Filter & Search Toolbar */}
      <Card className="p-4 bg-white border border-slate-200 shadow-xs space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Status Filter Tabs */}
          <div className="flex flex-wrap items-center gap-1.5">
            {[
              { key: "ALL", label: "All RFQs", count: totalCount },
              { key: "pending", label: "Under Review", count: pendingCount },
              { key: "reviewing", label: "Engineering Review", count: reviewingCount },
              { key: "quoted", label: "Quoted", count: rfqs.filter((r) => r.status === "quoted").length },
              { key: "accepted", label: "Accepted", count: rfqs.filter((r) => r.status === "accepted").length },
            ].map((tab) => {
              const active = statusFilter === tab.key;
              return (
                <button
                  key={tab.key}
                  onClick={() => setStatusFilter(tab.key)}
                  className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                    active
                      ? "bg-[#024AE5] text-white shadow-xs"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  <span>{tab.label}</span>
                  <span
                    className={`px-1.5 py-0.5 rounded-full text-[10px] ${
                      active ? "bg-white/20 text-white" : "bg-white text-slate-600"
                    }`}
                  >
                    {tab.count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Search Input */}
          <div className="relative w-full md:w-80">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <Input
              type="text"
              placeholder="Search by RFQ #, enterprise, tooling..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-9 text-xs bg-slate-50 border-slate-200 focus:bg-white focus:border-[#024AE5]"
            />
          </div>
        </div>
      </Card>

      {/* Admin RFQ Table */}
      <Card className="overflow-hidden border border-slate-200 shadow-xs bg-white">
        <Table>
          <TableHeader className="bg-slate-50/80">
            <TableRow className="border-b border-slate-200 text-xs">
              <TableHead className="w-[140px] font-bold text-slate-700">RFQ #</TableHead>
              <TableHead className="w-[220px] font-bold text-slate-700">Enterprise / Client</TableHead>
              <TableHead className="min-w-[240px] font-bold text-slate-700">Tooling & Specifications</TableHead>
              <TableHead className="w-[100px] text-center font-bold text-slate-700">Batch Qty</TableHead>
              <TableHead className="w-[120px] font-bold text-slate-700">Submitted</TableHead>
              <TableHead className="w-[140px] font-bold text-slate-700">Status</TableHead>
              <TableHead className="w-[130px] font-bold text-slate-700 text-right pr-4">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredRfqs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="h-44 text-center">
                  <div className="flex flex-col items-center justify-center text-slate-400 space-y-2">
                    <FileText className="w-8 h-8 stroke-1 text-slate-300" />
                    <p className="text-sm font-medium text-slate-600">No RFQs found</p>
                    <p className="text-xs text-slate-400">
                      {searchQuery ? "No custom requests matching your search." : "No RFQs in this category."}
                    </p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              filteredRfqs.map((rfq) => {
                const initialChar =
                  rfq.company_name?.charAt(0)?.toUpperCase() ||
                  rfq.contact_person?.charAt(0)?.toUpperCase() ||
                  "E";

                return (
                  <TableRow key={rfq.id} className="hover:bg-slate-50/70 transition-colors">
                    {/* RFQ Number */}
                    <TableCell className="py-3.5 align-middle">
                      <span className="font-mono font-bold text-xs text-[#024AE5]">
                        {rfq.rfq_number}
                      </span>
                    </TableCell>

                    {/* Enterprise / Client */}
                    <TableCell className="py-3.5 align-middle">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-blue-50 text-[#024AE5] border border-blue-200/80 flex items-center justify-center text-xs font-bold shrink-0">
                          {initialChar}
                        </div>
                        <div className="min-w-0 flex flex-col justify-center">
                          <span className="text-xs font-bold text-slate-900 truncate">
                            {rfq.company_name || "Enterprise Client"}
                          </span>
                          <span className="text-[11px] text-slate-500 truncate">
                            {rfq.contact_person}
                          </span>
                          <div className="flex items-center gap-2 mt-1 text-[11px]">
                            {rfq.email && (
                              <a
                                href={`mailto:${rfq.email}`}
                                className="text-slate-600 hover:text-[#024AE5] transition-colors"
                                title={rfq.email}
                              >
                                <Mail className="w-3 h-3" />
                              </a>
                            )}
                            {rfq.mobile && (
                              <>
                                <a
                                  href={`tel:${rfq.mobile}`}
                                  className="text-slate-600 hover:text-[#024AE5] transition-colors"
                                  title={rfq.mobile}
                                >
                                  <Phone className="w-3 h-3" />
                                </a>
                                <a
                                  href={`https://wa.me/${rfq.mobile.replace(/[^0-9]/g, "")}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-emerald-600 hover:text-emerald-700"
                                  title="Chat on WhatsApp"
                                >
                                  <MessageCircle className="w-3 h-3" />
                                </a>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    </TableCell>

                    {/* Tooling / Specs */}
                    <TableCell className="py-3.5 align-middle max-w-xs">
                      <div className="font-bold text-xs text-slate-900 truncate">
                        {rfq.item_name}
                      </div>
                      {rfq.specifications && (
                        <p className="text-slate-500 text-[11px] line-clamp-1 mt-0.5 font-mono">
                          {rfq.specifications}
                        </p>
                      )}
                      {rfq.drawing_url && (
                        <a
                          href={rfq.drawing_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-[10px] text-[#024AE5] bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200 mt-1 font-medium hover:underline"
                        >
                          <Paperclip className="w-2.5 h-2.5" />
                          <span>CAD Drawing</span>
                          <ExternalLink className="w-2.5 h-2.5 opacity-70" />
                        </a>
                      )}
                    </TableCell>

                    {/* Quantity */}
                    <TableCell className="py-3.5 align-middle text-center font-bold text-xs text-slate-800">
                      <span className="bg-slate-100 px-2 py-1 rounded text-xs">
                        {rfq.quantity}
                      </span>
                    </TableCell>

                    {/* Submitted Date */}
                    <TableCell className="py-3.5 align-middle text-xs text-slate-500">
                      {new Date(rfq.created_at).toLocaleDateString("en-IN", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                      })}
                    </TableCell>

                    {/* Status */}
                    <TableCell className="py-3.5 align-middle">
                      {getStatusBadge(rfq.status)}
                    </TableCell>

                    {/* Actions */}
                    <TableCell className="py-3.5 align-middle text-right pr-4">
                      <Button
                        size="sm"
                        onClick={() => handleOpenEditor(rfq)}
                        className="h-8 text-xs bg-[#024AE5] hover:bg-[#013BB8] text-white gap-1.5 shadow-none cursor-pointer"
                      >
                        <Edit className="w-3.5 h-3.5" />
                        <span>Review & Quote</span>
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </Card>

      {/* Review & Issue Quote Modal */}
      {editingRfq && (
        <Dialog open={!!editingRfq} onOpenChange={(open) => !open && setEditingRfq(null)}>
          <DialogContent className="max-w-2xl bg-white p-6 rounded-2xl shadow-xl">
            <DialogHeader className="pb-3 border-b border-slate-100 pr-12">
              <div className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-[#024AE5]" />
                <DialogTitle className="text-lg font-bold text-slate-900">
                  Review & Issue Quote: {editingRfq.rfq_number}
                </DialogTitle>
              </div>
              <DialogDescription className="text-xs text-slate-500 mt-1">
                Submitted by {editingRfq.company_name} ({editingRfq.contact_person}) on{" "}
                {new Date(editingRfq.created_at).toLocaleString("en-IN")}
              </DialogDescription>
            </DialogHeader>

            {/* Client Strip */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs">
              <div className="space-y-1">
                <span className="text-[10px] uppercase font-bold text-slate-500 block tracking-wider">
                  Client Details
                </span>
                <p className="font-bold text-slate-900 text-sm">{editingRfq.company_name || "Enterprise Client"}</p>
                <p className="text-slate-600">{editingRfq.contact_person}</p>
                <div className="flex items-center gap-2 pt-1">
                  {editingRfq.email && (
                    <a
                      href={`mailto:${editingRfq.email}?subject=Regarding RFQ ${editingRfq.rfq_number} - Sojar Indusy`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-[#024AE5] hover:underline"
                    >
                      <Mail className="w-3 h-3" />
                      <span>{editingRfq.email}</span>
                    </a>
                  )}
                </div>
              </div>

              <div className="flex flex-col justify-center gap-2">
                {editingRfq.email && (
                  <a
                    href={`mailto:${editingRfq.email}?subject=Regarding RFQ ${editingRfq.rfq_number} - Sojar Indusy`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center gap-2 px-3 py-1.5 rounded-lg bg-[#024AE5] hover:bg-[#013BB8] text-white text-xs font-bold transition-colors"
                  >
                    <Mail className="w-3.5 h-3.5" />
                    <span>Send Email</span>
                    <ExternalLink className="w-3 h-3 opacity-70" />
                  </a>
                )}

                {editingRfq.mobile && (
                  <a
                    href={`https://wa.me/${editingRfq.mobile.replace(/[^0-9]/g, "")}?text=Hello, regarding your RFQ ${editingRfq.rfq_number} at Sojar Indusy...`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-colors"
                  >
                    <MessageCircle className="w-3.5 h-3.5" />
                    <span>Chat on WhatsApp</span>
                    <ExternalLink className="w-3 h-3 opacity-70" />
                  </a>
                )}
              </div>
            </div>

            {/* Technical Tooling Details */}
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Item Description</span>
                  <div className="font-bold text-slate-900 text-sm mt-0.5">{editingRfq.item_name}</div>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Requested Quantity</span>
                  <div className="font-bold text-slate-800 text-sm mt-0.5">{editingRfq.quantity}</div>
                </div>
              </div>

              {editingRfq.required_by_date && (
                <div className="flex items-center gap-2 text-slate-600">
                  <Calendar className="w-3.5 h-3.5 text-slate-400" />
                  <span>Required By: <strong>{new Date(editingRfq.required_by_date).toLocaleDateString("en-IN")}</strong></span>
                </div>
              )}

              {editingRfq.specifications && (
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Technical Specifications</span>
                  <p className="mt-0.5 text-slate-700 bg-white p-2.5 rounded-lg border border-slate-200 whitespace-pre-wrap font-mono text-[11px] max-h-36 overflow-y-auto">
                    {editingRfq.specifications}
                  </p>
                </div>
              )}

              {editingRfq.drawing_url && (
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Technical Drawing / CAD Link</span>
                  <a
                    href={editingRfq.drawing_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[#024AE5] hover:underline font-bold text-xs inline-flex items-center gap-1.5 mt-1 bg-white px-3 py-1.5 rounded-lg border border-slate-200"
                  >
                    <Paperclip className="h-3.5 w-3.5" />
                    <span>Open CAD Drawing</span>
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              )}
            </div>

            {/* Quotation Form */}
            <form onSubmit={handleSaveQuote} className="space-y-4 pt-1">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-slate-700">Quotation Status *</Label>
                  <Select
                    value={quoteStatus}
                    onValueChange={(val: RFQStatus) => setQuoteStatus(val)}
                  >
                    <SelectTrigger className="h-9 text-xs border-slate-200">
                      <SelectValue placeholder="Select Status" />
                    </SelectTrigger>
                    <SelectContent className="bg-white border-slate-200 shadow-lg text-xs">
                      <SelectItem value="pending">Under Review</SelectItem>
                      <SelectItem value="reviewing">Engineering Review</SelectItem>
                      <SelectItem value="quoted">Quotation Ready / Issued</SelectItem>
                      <SelectItem value="accepted">Accepted / PO Received</SelectItem>
                      <SelectItem value="declined">Declined</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-slate-700">Commercial Quote Amount (₹)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="e.g. 45000"
                    value={quotedAmount}
                    onChange={(e) => setQuotedAmount(e.target.value)}
                    className="h-9 text-xs font-mono border-slate-200"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-700">
                  Engineering Notes & Lead Time (Visible to Customer)
                </Label>
                <Textarea
                  value={adminNotes}
                  onChange={(e) => setAdminNotes(e.target.value)}
                  placeholder="e.g. Quoted for Grade K10 Solid Carbide with AlTiN PVD coating. Estimated production lead time is 4 business days."
                  className="min-h-[80px] text-xs border-slate-200"
                />
              </div>

              <div className="flex justify-end gap-2.5 pt-3 border-t border-slate-100">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setEditingRfq(null)}
                  disabled={isSaving}
                  className="h-8.5 text-xs border-slate-200 shadow-none cursor-pointer"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isSaving}
                  className="h-8.5 text-xs bg-[#024AE5] hover:bg-[#013BB8] text-white shadow-none px-5 font-bold cursor-pointer gap-1.5"
                >
                  {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                  <span>Save & Send Quote</span>
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
