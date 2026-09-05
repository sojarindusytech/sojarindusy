"use client";

import React, { useState } from "react";
import { RFQ } from "@/types/database.types";
import { RFQ_STATUS_CONFIG, RFQ_STATUSES } from "@/lib/constants";
import { submitCustomerRfq } from "@/actions/rfq";
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
  FileText,
  Plus,
  Send,
  Loader2,
  Eye,
  Search,
  Filter,
  RotateCcw,
  Boxes,
  Clock,
  CheckCircle2,
  Phone,
  Mail,
  Calendar,
  Layers,
} from "lucide-react";
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
import toast from "react-hot-toast";

interface CustomerRfqsViewProps {
  initialRfqs: RFQ[];
}

export function CustomerRfqsView({ initialRfqs }: CustomerRfqsViewProps) {
  const [rfqs, setRfqs] = useState<RFQ[]>(initialRfqs);
  const [isSubmitModalOpen, setIsSubmitModalOpen] = useState(false);
  const [selectedRfq, setSelectedRfq] = useState<RFQ | null>(null);

  // Form State
  const [itemName, setItemName] = useState("");
  const [quantity, setQuantity] = useState("");
  const [requiredDate, setRequiredDate] = useState("");
  const [specs, setSpecs] = useState("");
  const [drawingUrl, setDrawingUrl] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");

  const filteredRfqs = rfqs.filter((r) => {
    if (statusFilter !== "ALL" && r.status !== statusFilter) {
      return false;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchNum = r.rfq_number?.toLowerCase().includes(q);
      const matchItem = r.item_name?.toLowerCase().includes(q);
      const matchSpecs = r.specifications?.toLowerCase().includes(q);
      return matchNum || matchItem || matchSpecs;
    }
    return true;
  });

  const handleOpenSubmitModal = () => {
    setItemName("");
    setQuantity("");
    setRequiredDate("");
    setSpecs("");
    setDrawingUrl("");
    setIsSubmitModalOpen(true);
  };

  const handleSubmitRfq = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!itemName.trim()) {
      toast.error("Please enter product / tooling description.");
      return;
    }
    if (!quantity.trim()) {
      toast.error("Please specify estimated quantity.");
      return;
    }

    setIsSubmitting(true);
    const result = await submitCustomerRfq({
      item_name: itemName,
      quantity,
      required_by_date: requiredDate || undefined,
      specifications: specs || undefined,
      drawing_url: drawingUrl || undefined,
    });
    setIsSubmitting(false);

    if (result.error) {
      toast.error(result.error);
    } else if (result.rfq) {
      toast.success("RFQ submitted successfully! Our tooling application engineers will review and respond with pricing.");
      setRfqs([result.rfq, ...rfqs]);
      setIsSubmitModalOpen(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Top Header & New RFQ Action */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">
            Custom Tooling & Fastener RFQs
          </h1>
          <p className="text-xs text-slate-500">
            Submit drawings, specify non-standard dimensions, and track factory commercial quotes in real-time.
          </p>
        </div>

        <Button
          size="sm"
          onClick={handleOpenSubmitModal}
          className="bg-[#024AE5] hover:bg-[#024AE5]/90 text-white text-xs font-bold h-8.5 px-4 shadow-none gap-1.5 cursor-pointer self-start sm:self-auto"
        >
          <Plus className="h-3.5 w-3.5" />
          <span>Send New RFQ</span>
        </Button>
      </div>

      {/* Filter & Search Toolbar */}
      <div className="bg-white p-3.5 rounded-xl border border-slate-200 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 shadow-xs">
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
          <Input
            type="text"
            placeholder="Search by RFQ # or item description..."
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

        {/* Dropdown Filters */}
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

      {/* RFQ Table */}
      <Card className="border-slate-200 bg-white shadow-none rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-slate-50">
              <TableRow className="text-xs">
                <TableHead className="font-bold text-slate-700">RFQ Number</TableHead>
                <TableHead className="font-bold text-slate-700">Submitted On</TableHead>
                <TableHead className="font-bold text-slate-700">Product / Tooling Description</TableHead>
                <TableHead className="font-bold text-slate-700 text-center">Batch Qty</TableHead>
                <TableHead className="font-bold text-slate-700">Target Date</TableHead>
                <TableHead className="font-bold text-slate-700">Status</TableHead>
                <TableHead className="font-bold text-slate-700">Quoted Price</TableHead>
                <TableHead className="font-bold text-slate-700 text-right pr-4">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredRfqs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-12 text-slate-500 text-xs">
                    <div className="space-y-2">
                      <FileText className="h-8 w-8 text-slate-300 mx-auto" />
                      <p className="font-medium text-slate-700">
                        {searchQuery || statusFilter !== "ALL" ? "No matching RFQs found." : "No Custom RFQs submitted yet."}
                      </p>
                      <p className="text-[11px] text-slate-400 max-w-sm mx-auto">
                        Need custom solid carbide tools or non-standard fasteners? Click "Send New RFQ" above to get an engineering quote.
                      </p>
                    </div>
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
                      <TableCell className="text-slate-500">
                        {new Date(rfq.created_at).toLocaleDateString("en-IN", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                        })}
                      </TableCell>
                      <TableCell className="font-medium text-slate-900 max-w-xs truncate">
                        {rfq.item_name}
                      </TableCell>
                      <TableCell className="text-center font-bold text-slate-800">
                        {rfq.quantity}
                      </TableCell>
                      <TableCell className="text-slate-500">
                        {rfq.required_by_date ? (
                          new Date(rfq.required_by_date).toLocaleDateString("en-IN", {
                            day: "2-digit",
                            month: "short",
                            year: "numeric",
                          })
                        ) : (
                          <span className="text-slate-400">Standard</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold border ${cfg.badgeBg} ${cfg.badgeText} ${cfg.border}`}
                        >
                          {cfg.label}
                        </span>
                      </TableCell>
                      <TableCell className="font-mono font-bold text-slate-900">
                        {rfq.quoted_amount ? `₹${Number(rfq.quoted_amount).toLocaleString("en-IN")}` : (
                          <span className="text-slate-400 font-normal">Pending Quote</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right pr-4">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setSelectedRfq(rfq)}
                          className="h-7 text-[11px] border-slate-200 gap-1 text-slate-700 shadow-none cursor-pointer hover:text-[#024AE5] hover:border-blue-200"
                        >
                          <Eye className="h-3 w-3" />
                          <span>View RFQ</span>
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

      {/* MODAL 1: SEND NEW RFQ */}
      <Dialog open={isSubmitModalOpen} onOpenChange={setIsSubmitModalOpen}>
        <DialogContent className="max-w-xl bg-white p-6 rounded-2xl shadow-xl">
          <DialogHeader className="pb-3 border-b border-slate-200">
            <div className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-[#024AE5]" />
              <DialogTitle className="text-lg font-bold text-slate-900">
                Submit Request for Quotation (RFQ)
              </DialogTitle>
            </div>
            <DialogDescription className="text-xs text-slate-500">
              Provide required dimensions, material grade, and tolerances. Our Bhosari MIDC tooling desk responds with factory pricing within 4 hours.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmitRfq} className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-700">Tooling / Product Description *</Label>
              <Input
                required
                value={itemName}
                onChange={(e) => setItemName(e.target.value)}
                placeholder="e.g. 4-Flute Solid Carbide End Mill Ø12mm x 75mm (AlTiN Coated)"
                className="h-9 text-xs border-slate-200"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-700">Estimated Batch Quantity *</Label>
                <Input
                  required
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  placeholder="e.g. 500 pcs / 1,000 units"
                  className="h-9 text-xs border-slate-200"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-700">Required Target Date</Label>
                <Input
                  type="date"
                  value={requiredDate}
                  onChange={(e) => setRequiredDate(e.target.value)}
                  className="h-9 text-xs border-slate-200"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-700">
                Technical Specifications & Tolerances
              </Label>
              <Textarea
                value={specs}
                onChange={(e) => setSpecs(e.target.value)}
                placeholder="Specify cutting diameter (D), flute length (H), shank (D2), coating (AlTiN / TiAlN), hardness (HRC 45-65), material grade (SS316 / Carbide), etc."
                className="min-h-[90px] text-xs border-slate-200"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-700">
                Engineering Drawing / CAD Cloud Link (Optional)
              </Label>
              <Input
                value={drawingUrl}
                onChange={(e) => setDrawingUrl(e.target.value)}
                placeholder="https://drive.google.com/... or cloud drawing link"
                className="h-9 text-xs border-slate-200"
              />
            </div>

            <div className="flex justify-end gap-2.5 pt-3 border-t border-slate-100">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsSubmitModalOpen(false)}
                disabled={isSubmitting}
                className="h-8.5 text-xs border-slate-200 shadow-none cursor-pointer"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting}
                className="h-8.5 text-xs bg-[#024AE5] hover:bg-[#024AE5]/90 text-white shadow-none px-5 font-bold cursor-pointer gap-1.5"
              >
                {isSubmitting ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Send className="h-3.5 w-3.5" />
                )}
                <span>Send RFQ to Engineering Desk</span>
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* MODAL 2: VIEW RFQ DETAILS */}
      {selectedRfq && (
        <Dialog open={!!selectedRfq} onOpenChange={(open) => !open && setSelectedRfq(null)}>
          <DialogContent className="max-w-xl bg-white p-6 rounded-2xl shadow-xl">
            <DialogHeader className="pb-3 border-b border-slate-200">
              <div className="flex items-center justify-between pr-8">
                <div className="flex items-center gap-2">
                  <FileText className="h-5 w-5 text-[#024AE5]" />
                  <DialogTitle className="text-lg font-bold text-slate-900">
                    {selectedRfq.rfq_number}
                  </DialogTitle>
                </div>
                <span
                  className={`inline-flex items-center px-2.5 py-0.5 rounded text-xs font-bold border ${
                    RFQ_STATUS_CONFIG[selectedRfq.status]?.badgeBg
                  } ${RFQ_STATUS_CONFIG[selectedRfq.status]?.badgeText} ${
                    RFQ_STATUS_CONFIG[selectedRfq.status]?.border
                  }`}
                >
                  {RFQ_STATUS_CONFIG[selectedRfq.status]?.label || selectedRfq.status}
                </span>
              </div>
              <DialogDescription className="text-xs text-slate-500">
                Submitted on{" "}
                {new Date(selectedRfq.created_at).toLocaleString("en-IN", {
                  day: "2-digit",
                  month: "short",
                  year: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 pt-2">
              {/* Product Info Card */}
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2 text-xs">
                <div>
                  <span className="text-slate-400 uppercase font-bold text-[10px] block">
                    Product / Tooling Description
                  </span>
                  <p className="font-bold text-slate-900 text-sm mt-0.5">
                    {selectedRfq.item_name}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-200/60">
                  <div>
                    <span className="text-slate-400 uppercase font-bold text-[10px] block">
                      Estimated Quantity
                    </span>
                    <span className="font-semibold text-slate-800">
                      {selectedRfq.quantity}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 uppercase font-bold text-[10px] block">
                      Target Delivery Date
                    </span>
                    <span className="font-semibold text-slate-800">
                      {selectedRfq.required_by_date
                        ? new Date(selectedRfq.required_by_date).toLocaleDateString("en-IN", {
                            day: "2-digit",
                            month: "short",
                            year: "numeric",
                          })
                        : "Standard Timeline"}
                    </span>
                  </div>
                </div>

                {selectedRfq.specifications && (
                  <div className="pt-2 border-t border-slate-200/60">
                    <span className="text-slate-400 uppercase font-bold text-[10px] block">
                      Technical Specifications & Tolerances
                    </span>
                    <p className="text-slate-700 whitespace-pre-wrap mt-0.5 font-mono text-[11px] bg-white p-2.5 rounded border border-slate-200">
                      {selectedRfq.specifications}
                    </p>
                  </div>
                )}

                {selectedRfq.drawing_url && (
                  <div className="pt-2 border-t border-slate-200/60">
                    <span className="text-slate-400 uppercase font-bold text-[10px] block">
                      Engineering Drawing Link
                    </span>
                    <a
                      href={selectedRfq.drawing_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[#024AE5] hover:underline font-semibold text-xs inline-block mt-0.5"
                    >
                      {selectedRfq.drawing_url}
                    </a>
                  </div>
                )}
              </div>

              {/* Commercial Quote Status Card */}
              {selectedRfq.quoted_amount ? (
                <div className="p-4 bg-emerald-50/80 rounded-xl border border-emerald-200 space-y-2 text-xs">
                  <span className="text-emerald-800 uppercase font-bold text-[10px] block">
                    Official Factory Quotation
                  </span>
                  <div className="font-mono font-bold text-emerald-950 text-xl">
                    ₹{Number(selectedRfq.quoted_amount).toLocaleString("en-IN")}
                  </div>
                  {selectedRfq.admin_notes && (
                    <p className="text-emerald-800 text-xs mt-1">
                      <strong>Engineering Notes:</strong> {selectedRfq.admin_notes}
                    </p>
                  )}
                </div>
              ) : (
                <div className="p-3.5 bg-blue-50/60 rounded-xl border border-blue-100 flex items-center gap-3 text-xs text-blue-900">
                  <Clock className="h-5 w-5 text-[#024AE5] shrink-0" />
                  <p className="leading-relaxed">
                    Our tooling application engineers are currently reviewing workpiece machinability and calculating cycle time. A factory quotation will be posted here shortly.
                  </p>
                </div>
              )}

              {/* Engineering Hotline */}
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2 text-slate-700">
                  <Phone className="h-4 w-4 text-[#024AE5]" />
                  <span>Technical Tooling Desk: <strong>+91 (020) 2712-8940</strong></span>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setSelectedRfq(null)}
                  className="h-7 text-xs border-slate-200 shadow-none cursor-pointer"
                >
                  Close
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
