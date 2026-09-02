"use client";

import React, { useState } from "react";
import { RFQ, RFQStatus } from "@/types/database.types";
import { RFQ_STATUS_CONFIG, RFQ_STATUSES } from "@/lib/constants";
import { updateRfqQuotation } from "@/actions/rfq";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
  ExternalLink,
  Edit,
  Building2,
  Phone,
  Mail,
  Receipt,
  Layers,
} from "lucide-react";
import toast from "react-hot-toast";

interface AdminQuotesClientProps {
  initialRfqs: RFQ[];
}

export function AdminQuotesClient({ initialRfqs }: AdminQuotesClientProps) {
  const [rfqs, setRfqs] = useState<RFQ[]>(initialRfqs);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");

  // Quotation Editor State
  const [editingRfq, setEditingRfq] = useState<RFQ | null>(null);
  const [quoteStatus, setQuoteStatus] = useState<RFQStatus>("pending");
  const [quotedAmount, setQuotedAmount] = useState<string>("");
  const [adminNotes, setAdminNotes] = useState<string>("");
  const [isSaving, setIsSaving] = useState(false);

  // Metrics
  const totalCount = rfqs.length;
  const pendingCount = rfqs.filter((r) => r.status === "pending" || r.status === "reviewing").length;
  const quotedCount = rfqs.filter((r) => r.status === "quoted").length;
  const acceptedCount = rfqs.filter((r) => r.status === "accepted").length;

  const filteredRfqs = rfqs.filter((r) => {
    if (statusFilter !== "ALL" && r.status !== statusFilter) {
      return false;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchNum = r.rfq_number?.toLowerCase().includes(q);
      const matchCompany = r.company_name?.toLowerCase().includes(q);
      const matchContact = r.contact_person?.toLowerCase().includes(q);
      const matchItem = r.item_name?.toLowerCase().includes(q);
      return matchNum || matchCompany || matchContact || matchItem;
    }
    return true;
  });

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
      toast.success(`RFQ #${editingRfq.rfq_number} updated with status: ${quoteStatus.toUpperCase()}`);
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

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">
            Customer Quotes & RFQ Management
          </h1>
          <p className="text-xs text-slate-500">
            Review incoming custom tooling and fastener requests, analyze drawings, and issue commercial quotations.
          </p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <Card className="p-4 bg-white border border-slate-200 shadow-none rounded-xl space-y-1">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
            Total RFQs
          </span>
          <div className="text-2xl font-bold text-slate-900">{totalCount}</div>
          <p className="text-[11px] text-slate-400">All customer requests</p>
        </Card>

        <Card className="p-4 bg-white border border-slate-200 shadow-none rounded-xl space-y-1">
          <span className="text-[11px] font-bold text-amber-700 uppercase tracking-wider block">
            Awaiting Quote
          </span>
          <div className="text-2xl font-bold text-amber-600">{pendingCount}</div>
          <p className="text-[11px] text-slate-400">Pending review</p>
        </Card>

        <Card className="p-4 bg-white border border-slate-200 shadow-none rounded-xl space-y-1">
          <span className="text-[11px] font-bold text-[#024AE5] uppercase tracking-wider block">
            Quotations Issued
          </span>
          <div className="text-2xl font-bold text-[#024AE5]">{quotedCount}</div>
          <p className="text-[11px] text-slate-400">Priced & delivered</p>
        </Card>

        <Card className="p-4 bg-white border border-slate-200 shadow-none rounded-xl space-y-1">
          <span className="text-[11px] font-bold text-emerald-700 uppercase tracking-wider block">
            Orders Converted
          </span>
          <div className="text-2xl font-bold text-emerald-600">{acceptedCount}</div>
          <p className="text-[11px] text-slate-400">Accepted by client</p>
        </Card>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-white p-3.5 rounded-xl border border-slate-200 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 shadow-xs">
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
          <Input
            type="text"
            placeholder="Search by RFQ #, enterprise, or tooling description..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-9 pl-9 text-xs border-slate-200 bg-slate-50/50 focus-visible:bg-white"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-2.5 top-2.5 text-xs text-slate-400 hover:text-slate-600 cursor-pointer"
            >
              &times;
            </button>
          )}
        </div>

        {/* Dropdowns */}
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex items-center gap-1.5">
            <Filter className="h-3.5 w-3.5 text-slate-400 shrink-0" />
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="h-9 w-44 text-xs font-semibold bg-slate-50/50 border-slate-200 shadow-none">
                <SelectValue placeholder="All Statuses" />
              </SelectTrigger>
              <SelectContent className="bg-white border-slate-200 shadow-lg text-xs">
                <SelectItem value="ALL">All Statuses ({rfqs.length})</SelectItem>
                <SelectItem value="pending">Under Review</SelectItem>
                <SelectItem value="reviewing">Engineering Review</SelectItem>
                <SelectItem value="quoted">Quotation Ready</SelectItem>
                <SelectItem value="accepted">Accepted / PO Issued</SelectItem>
                <SelectItem value="declined">Declined</SelectItem>
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
              className="h-9 text-xs text-slate-500 hover:text-slate-800 gap-1 px-2.5"
            >
              <RotateCcw className="h-3 w-3" />
              <span>Reset</span>
            </Button>
          )}
        </div>
      </div>

      {/* Admin RFQ Table */}
      <Card className="border-slate-200 bg-white shadow-none rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-slate-50">
              <TableRow className="text-xs">
                <TableHead className="font-bold text-slate-700">RFQ #</TableHead>
                <TableHead className="font-bold text-slate-700">Enterprise / Client</TableHead>
                <TableHead className="font-bold text-slate-700">Tooling / Specs</TableHead>
                <TableHead className="font-bold text-slate-700 text-center">Batch Qty</TableHead>
                <TableHead className="font-bold text-slate-700">Submitted</TableHead>
                <TableHead className="font-bold text-slate-700">Status</TableHead>
                <TableHead className="font-bold text-slate-700">Quoted Amount</TableHead>
                <TableHead className="font-bold text-slate-700 text-right pr-4">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredRfqs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-12 text-slate-500 text-xs">
                    No custom RFQs found matching the filters.
                  </TableCell>
                </TableRow>
              ) : (
                filteredRfqs.map((rfq) => {
                  const cfg = RFQ_STATUS_CONFIG[rfq.status] || {
                    label: rfq.status,
                    badgeBg: "bg-slate-100",
                    badgeText: "text-slate-700",
                    border: "border-slate-200",
                  };

                  return (
                    <TableRow key={rfq.id} className="text-xs hover:bg-slate-50">
                      <TableCell className="font-mono font-bold text-[#024AE5]">
                        {rfq.rfq_number}
                      </TableCell>
                      <TableCell>
                        <div className="font-bold text-slate-900">{rfq.company_name || "Enterprise"}</div>
                        <div className="text-slate-400 text-[11px]">{rfq.contact_person} &bull; {rfq.email}</div>
                      </TableCell>
                      <TableCell className="max-w-xs">
                        <div className="font-medium text-slate-900 truncate">{rfq.item_name}</div>
                        {rfq.specifications && (
                          <div className="text-slate-400 text-[11px] truncate">{rfq.specifications}</div>
                        )}
                      </TableCell>
                      <TableCell className="text-center font-bold text-slate-800">
                        {rfq.quantity}
                      </TableCell>
                      <TableCell className="text-slate-500">
                        {new Date(rfq.created_at).toLocaleDateString("en-IN", {
                          day: "2-digit",
                          month: "short",
                        })}
                      </TableCell>
                      <TableCell>
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold border ${cfg.badgeBg} ${cfg.badgeText} ${cfg.border}`}
                        >
                          {cfg.label}
                        </span>
                      </TableCell>
                      <TableCell className="font-mono font-bold text-slate-900">
                        {rfq.quoted_amount ? (
                          `₹${Number(rfq.quoted_amount).toLocaleString("en-IN")}`
                        ) : (
                          <span className="text-slate-400 font-normal">Pending</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right pr-4">
                        <Button
                          size="sm"
                          onClick={() => handleOpenEditor(rfq)}
                          className="h-7 text-[11px] bg-[#024AE5] hover:bg-[#024AE5]/90 text-white gap-1 shadow-none cursor-pointer"
                        >
                          <Edit className="h-3 w-3" />
                          <span>Review & Quote</span>
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </Card>

      {/* ADMIN QUOTATION EDITOR MODAL */}
      {editingRfq && (
        <Dialog open={!!editingRfq} onOpenChange={(open) => !open && setEditingRfq(null)}>
          <DialogContent className="max-w-2xl bg-white p-6 rounded-2xl shadow-xl">
            <DialogHeader className="pb-3 border-b border-slate-200">
              <div className="flex items-center justify-between pr-8">
                <div className="flex items-center gap-2">
                  <FileText className="h-5 w-5 text-[#024AE5]" />
                  <DialogTitle className="text-lg font-bold text-slate-900">
                    Review & Issue Quote: {editingRfq.rfq_number}
                  </DialogTitle>
                </div>
              </div>
              <DialogDescription className="text-xs text-slate-500">
                Submitted by {editingRfq.company_name} ({editingRfq.contact_person}) on{" "}
                {new Date(editingRfq.created_at).toLocaleString("en-IN")}
              </DialogDescription>
            </DialogHeader>

            {/* Request Summary */}
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Item Description</span>
                  <div className="font-bold text-slate-900 text-sm mt-0.5">{editingRfq.item_name}</div>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Requested Quantity</span>
                  <div className="font-bold text-slate-800 mt-0.5">{editingRfq.quantity}</div>
                </div>
              </div>

              {editingRfq.specifications && (
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Technical Specifications</span>
                  <p className="mt-0.5 text-slate-700 bg-white p-2.5 rounded border border-slate-200 whitespace-pre-wrap font-mono text-[11px]">
                    {editingRfq.specifications}
                  </p>
                </div>
              )}

              {editingRfq.drawing_url && (
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Technical Drawing Link</span>
                  <a
                    href={editingRfq.drawing_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[#024AE5] hover:underline font-bold text-xs inline-flex items-center gap-1 mt-0.5"
                  >
                    <span>Open Drawing URL</span>
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              )}
            </div>

            {/* Quotation Form */}
            <form onSubmit={handleSaveQuote} className="space-y-4 pt-2">
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
                  placeholder="e.g. Quoted for Grade K10 Solid Carbide with AlTiN PVD coating. Estimated production lead time is 4 business days from Bhosari MIDC."
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
                  className="h-8.5 text-xs bg-[#024AE5] hover:bg-[#024AE5]/90 text-white shadow-none px-5 font-bold cursor-pointer gap-1.5"
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
