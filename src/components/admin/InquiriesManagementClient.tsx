"use client";

import React, { useState, useTransition } from "react";
import Image from "next/image";
import { ContactSubmission, ContactSubmissionStatus } from "@/types/database.types";
import {
  updateContactSubmission,
  deleteContactSubmission,
  fetchContactSubmissions,
} from "@/actions/contact";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Mail,
  Phone,
  MessageSquare,
  Search,
  CheckCircle2,
  Clock,
  Archive,
  Eye,
  Trash2,
  ExternalLink,
  RefreshCw,
  AlertCircle,
  FileText,
  Save,
} from "lucide-react";
import toast from "react-hot-toast";

interface InquiriesManagementClientProps {
  initialSubmissions: ContactSubmission[];
  tableMissing?: boolean;
}

export function InquiriesManagementClient({
  initialSubmissions,
  tableMissing = false,
}: InquiriesManagementClientProps) {
  const [submissions, setSubmissions] = useState<ContactSubmission[]>(initialSubmissions);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | ContactSubmissionStatus>("all");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isPending, startTransition] = useTransition();

  // Selected submission for viewing modal
  const [selectedInquiry, setSelectedInquiry] = useState<ContactSubmission | null>(null);
  const [adminNoteInput, setAdminNoteInput] = useState("");
  const [isSavingNote, setIsSavingNote] = useState(false);

  // Deletion confirm state
  const [inquiryToDelete, setInquiryToDelete] = useState<ContactSubmission | null>(null);

  // Filtered list
  const filteredSubmissions = submissions.filter((item) => {
    const matchesStatus = statusFilter === "all" || item.status === statusFilter;
    const q = searchTerm.toLowerCase().trim();
    if (!q) return matchesStatus;

    const matchesSearch =
      item.full_name?.toLowerCase().includes(q) ||
      item.email?.toLowerCase().includes(q) ||
      item.mobile?.toLowerCase().includes(q) ||
      item.message?.toLowerCase().includes(q) ||
      item.admin_notes?.toLowerCase().includes(q);

    return matchesStatus && matchesSearch;
  });

  // Metric counts
  const countTotal = submissions.length;
  const countUnread = submissions.filter((s) => s.status === "unread").length;
  const countRead = submissions.filter((s) => s.status === "read").length;
  const countReplied = submissions.filter((s) => s.status === "replied").length;
  const countArchived = submissions.filter((s) => s.status === "archived").length;

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      const res = await fetchContactSubmissions();
      if (res.data) {
        setSubmissions(res.data);
        toast.success("Submissions refreshed.");
      }
    } catch {
      toast.error("Failed to refresh submissions.");
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleOpenDetail = (inquiry: ContactSubmission) => {
    setSelectedInquiry(inquiry);
    setAdminNoteInput(inquiry.admin_notes || "");

    // Automatically mark as 'read' if it was 'unread'
    if (inquiry.status === "unread") {
      handleStatusChange(inquiry.id, "read", false);
    }
  };

  const handleStatusChange = async (
    id: string,
    newStatus: ContactSubmissionStatus,
    showToast = true
  ) => {
    startTransition(async () => {
      const res = await updateContactSubmission(id, { status: newStatus });
      if (res.success) {
        setSubmissions((prev) =>
          prev.map((item) => (item.id === id ? { ...item, status: newStatus } : item))
        );
        if (selectedInquiry && selectedInquiry.id === id) {
          setSelectedInquiry((prev) => (prev ? { ...prev, status: newStatus } : null));
        }
        if (showToast) {
          toast.success(`Marked as ${newStatus}`);
        }
      } else {
        toast.error(res.error || "Failed to update status");
      }
    });
  };

  const handleSaveNotes = async () => {
    if (!selectedInquiry) return;
    setIsSavingNote(true);

    try {
      const res = await updateContactSubmission(selectedInquiry.id, {
        admin_notes: adminNoteInput.trim() || null,
      });

      if (res.success) {
        setSubmissions((prev) =>
          prev.map((item) =>
            item.id === selectedInquiry.id
              ? { ...item, admin_notes: adminNoteInput.trim() || null }
              : item
          )
        );
        setSelectedInquiry((prev) =>
          prev ? { ...prev, admin_notes: adminNoteInput.trim() || null } : null
        );
        toast.success("Admin notes saved.");
      } else {
        toast.error(res.error || "Failed to save notes");
      }
    } catch {
      toast.error("Error saving notes");
    } finally {
      setIsSavingNote(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!inquiryToDelete) return;
    const id = inquiryToDelete.id;

    startTransition(async () => {
      const res = await deleteContactSubmission(id);
      if (res.success) {
        setSubmissions((prev) => prev.filter((item) => item.id !== id));
        if (selectedInquiry?.id === id) {
          setSelectedInquiry(null);
        }
        toast.success("Inquiry deleted successfully.");
      } else {
        toast.error(res.error || "Failed to delete inquiry");
      }
      setInquiryToDelete(null);
    });
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return "-";
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return dateStr;
    }
  };

  const getStatusBadge = (status: ContactSubmissionStatus) => {
    switch (status) {
      case "unread":
        return (
          <Badge variant="warning" className="gap-1 font-medium bg-amber-50 text-amber-800 border-amber-300">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
            Unread
          </Badge>
        );
      case "read":
        return (
          <Badge variant="blue" className="gap-1 font-medium bg-blue-50 text-[#024AE5] border-blue-200">
            <Clock className="w-3 h-3" />
            Read
          </Badge>
        );
      case "replied":
        return (
          <Badge variant="success" className="gap-1 font-medium bg-emerald-50 text-emerald-800 border-emerald-300">
            <CheckCircle2 className="w-3 h-3" />
            Replied
          </Badge>
        );
      case "archived":
        return (
          <Badge variant="secondary" className="gap-1 font-medium text-slate-600 bg-slate-100 border-slate-200">
            <Archive className="w-3 h-3" />
            Archived
          </Badge>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Pending Migration Banner */}
      {tableMissing && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-5 text-amber-900 shadow-sm flex items-start gap-3.5">
          <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="space-y-1 text-sm">
            <h4 className="font-bold text-amber-900">Database Table Migration Pending</h4>
            <p className="text-amber-800 leading-relaxed">
              The <code className="bg-amber-200/70 px-1.5 py-0.5 rounded font-mono text-xs">contact_submissions</code> table has not been created in Supabase yet.
              Please run the migration script in your Supabase SQL Editor:
              <br />
              <code className="bg-amber-200/70 px-1.5 py-0.5 rounded font-mono text-xs font-semibold">
                supabase/migrations/20260916_create_contact_submissions.sql
              </code>
            </p>
          </div>
        </div>
      )}

      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2.5">
            <MessageSquare className="w-6 h-6 text-[#024AE5]" />
            <span>Customer Inquiries</span>
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Review, reply, and track messages received from your storefront contact form.
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

      {/* Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Inquiries */}
        <Card className="p-4 bg-white border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Total Inquiries
            </span>
            <div className="p-2 rounded-lg bg-blue-50 text-[#024AE5]">
              <MessageSquare className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-extrabold text-slate-900 mt-2">{countTotal}</div>
          <p className="text-xs text-slate-400 mt-1">All submissions received</p>
        </Card>

        {/* Unread */}
        <Card className="p-4 bg-white border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-amber-700">
              Unread
            </span>
            <div className="p-2 rounded-lg bg-amber-50 text-amber-600">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-extrabold text-amber-700 mt-2">{countUnread}</div>
          <p className="text-xs text-amber-600 mt-1">Needs attention</p>
        </Card>

        {/* Replied */}
        <Card className="p-4 bg-white border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-emerald-700">
              Replied
            </span>
            <div className="p-2 rounded-lg bg-emerald-50 text-emerald-600">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-extrabold text-emerald-700 mt-2">{countReplied}</div>
          <p className="text-xs text-emerald-600 mt-1">Resolved inquiries</p>
        </Card>

        {/* Archived */}
        <Card className="p-4 bg-white border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Archived
            </span>
            <div className="p-2 rounded-lg bg-slate-100 text-slate-600">
              <Archive className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-extrabold text-slate-700 mt-2">{countArchived}</div>
          <p className="text-xs text-slate-400 mt-1">Closed records</p>
        </Card>
      </div>

      {/* Filter Tabs & Search Controls */}
      <Card className="p-4 bg-white border border-slate-200 shadow-xs space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Status Filter Tabs */}
          <div className="flex flex-wrap items-center gap-1.5">
            {[
              { key: "all", label: "All", count: countTotal },
              { key: "unread", label: "Unread", count: countUnread },
              { key: "read", label: "Read", count: countRead },
              { key: "replied", label: "Replied", count: countReplied },
              { key: "archived", label: "Archived", count: countArchived },
            ].map((tab) => {
              const active = statusFilter === tab.key;
              return (
                <button
                  key={tab.key}
                  onClick={() => setStatusFilter(tab.key as any)}
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
          <div className="relative w-full md:w-72">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <Input
              type="text"
              placeholder="Search inquiries..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 h-9 text-xs bg-slate-50 border-slate-200 focus:bg-white focus:border-[#024AE5]"
            />
          </div>
        </div>
      </Card>

      {/* Submissions Table */}
      <Card className="overflow-hidden border border-slate-200 shadow-xs bg-white">
        <Table>
          <TableHeader className="bg-slate-50/80">
            <TableRow className="border-b border-slate-200">
              <TableHead className="w-[200px] text-xs font-bold text-slate-700">Customer</TableHead>
              <TableHead className="w-[180px] text-xs font-bold text-slate-700">Contact</TableHead>
              <TableHead className="min-w-[260px] text-xs font-bold text-slate-700">Message</TableHead>
              <TableHead className="w-[120px] text-xs font-bold text-slate-700">Status</TableHead>
              <TableHead className="w-[150px] text-xs font-bold text-slate-700">Date Received</TableHead>
              <TableHead className="w-[120px] text-right text-xs font-bold text-slate-700">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredSubmissions.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="h-44 text-center">
                  <div className="flex flex-col items-center justify-center text-slate-400 space-y-2">
                    <MessageSquare className="w-8 h-8 stroke-1 text-slate-300" />
                    <p className="text-sm font-medium text-slate-600">No inquiries found</p>
                    <p className="text-xs text-slate-400">
                      {searchTerm
                        ? "No results matching your search terms."
                        : "No contact submissions in this category yet."}
                    </p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              filteredSubmissions.map((inquiry) => {
                const isUnread = inquiry.status === "unread";

                return (
                  <TableRow
                    key={inquiry.id}
                    className={`hover:bg-slate-50/60 transition-colors ${
                      isUnread ? "bg-amber-50/20 font-medium" : ""
                    }`}
                  >
                    {/* Customer */}
                    <TableCell className="py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-blue-50 text-[#024AE5] border border-blue-200/80 flex items-center justify-center text-xs font-bold shrink-0">
                          {inquiry.full_name?.charAt(0)?.toUpperCase() || "U"}
                        </div>
                        <div className="min-w-0 flex flex-col justify-center">
                          <span className="text-xs font-bold text-slate-900 truncate">
                            {inquiry.full_name}
                          </span>
                          {inquiry.admin_notes && (
                            <span className="inline-flex items-center gap-1 text-[10px] text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200 mt-1 font-normal w-fit">
                              <FileText className="w-2.5 h-2.5" />
                              Has Note
                            </span>
                          )}
                        </div>
                      </div>
                    </TableCell>

                    {/* Contact */}
                    <TableCell className="py-3.5">
                      <div className="space-y-1 text-xs text-slate-600">
                        <a
                          href={`mailto:${inquiry.email}`}
                          className="flex items-center gap-1.5 text-slate-700 hover:text-[#024AE5] transition-colors truncate"
                          title="Click to send email"
                        >
                          <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span className="truncate">{inquiry.email}</span>
                        </a>

                        {inquiry.mobile ? (
                          <div className="flex items-center gap-2">
                            <a
                              href={`tel:${inquiry.mobile}`}
                              className="flex items-center gap-1.5 text-slate-600 hover:text-[#024AE5] transition-colors"
                              title="Click to call"
                            >
                              <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                              <span>{inquiry.mobile}</span>
                            </a>
                            <a
                              href={`https://wa.me/${inquiry.mobile.replace(/[^0-9]/g, "")}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center justify-center hover:opacity-80 transition-opacity"
                              title="Message on WhatsApp"
                            >
                              <Image
                                src="/assets/icons/whatsapp.svg"
                                alt="WhatsApp"
                                width={14}
                                height={14}
                                className="w-3.5 h-3.5 shrink-0"
                              />
                            </a>
                          </div>
                        ) : (
                          <span className="text-[11px] text-slate-400 italic">No phone</span>
                        )}
                      </div>
                    </TableCell>

                    {/* Message Preview */}
                    <TableCell className="py-3.5">
                      <p
                        onClick={() => handleOpenDetail(inquiry)}
                        className="text-xs text-slate-700 line-clamp-2 cursor-pointer hover:text-slate-900 transition-colors"
                        title="Click to view full message"
                      >
                        {inquiry.message}
                      </p>
                    </TableCell>

                    {/* Status */}
                    <TableCell className="py-3.5">
                      {getStatusBadge(inquiry.status)}
                    </TableCell>

                    {/* Date */}
                    <TableCell className="py-3.5 text-xs text-slate-500">
                      {formatDate(inquiry.created_at)}
                    </TableCell>

                    {/* Actions */}
                    <TableCell className="py-3.5 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleOpenDetail(inquiry)}
                          className="h-8 px-2.5 text-xs text-slate-700 hover:text-[#024AE5] hover:bg-blue-50 border-slate-200 cursor-pointer"
                          title="View Inquiry Details"
                        >
                          <Eye className="w-3.5 h-3.5 mr-1" />
                          View
                        </Button>

                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setInquiryToDelete(inquiry)}
                          className="h-8 w-8 p-0 text-slate-400 hover:text-red-600 hover:bg-red-50 cursor-pointer"
                          title="Delete"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </Card>

      {/* Detail Dialog */}
      <Dialog
        open={!!selectedInquiry}
        onOpenChange={(open) => {
          if (!open) setSelectedInquiry(null);
        }}
      >
        <DialogContent className="max-w-2xl bg-white p-6 rounded-2xl">
          {selectedInquiry && (
            <div className="space-y-6">
              <DialogHeader className="pr-12">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <DialogTitle className="text-xl font-bold text-slate-900">
                      Inquiry from {selectedInquiry.full_name}
                    </DialogTitle>
                    <DialogDescription className="mt-1">
                      Received on {formatDate(selectedInquiry.created_at)}
                    </DialogDescription>
                  </div>
                  <div className="shrink-0">{getStatusBadge(selectedInquiry.status)}</div>
                </div>
              </DialogHeader>

              {/* Customer Info & Direct Action Strip */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 rounded-xl bg-slate-50 border border-slate-200">
                <div className="space-y-1.5 text-xs">
                  <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                    Customer Details
                  </span>
                  <p className="text-sm font-bold text-slate-900">{selectedInquiry.full_name}</p>
                  <a
                    href={`mailto:${selectedInquiry.email}`}
                    className="inline-flex items-center gap-1.5 text-slate-700 hover:text-[#024AE5]"
                  >
                    <Mail className="w-3.5 h-3.5 text-slate-400" />
                    <span>{selectedInquiry.email}</span>
                  </a>
                  {selectedInquiry.mobile && (
                    <div className="flex items-center gap-1.5 text-slate-700">
                      <Phone className="w-3.5 h-3.5 text-slate-400" />
                      <span>{selectedInquiry.mobile}</span>
                    </div>
                  )}
                </div>

                {/* Direct Action Buttons */}
                <div className="flex flex-col justify-center gap-2">
                  <a
                    href={`mailto:${selectedInquiry.email}?subject=Regarding your inquiry at Sojar Indusy`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-[#024AE5] hover:bg-[#013BB8] text-white text-xs font-bold transition-colors"
                  >
                    <Mail className="w-3.5 h-3.5" />
                    <span>Reply via Email</span>
                    <ExternalLink className="w-3 h-3 opacity-70" />
                  </a>

                  {selectedInquiry.mobile && (
                    <a
                      href={`https://wa.me/${selectedInquiry.mobile.replace(/[^0-9]/g, "")}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-colors shadow-xs hover:shadow-sm"
                    >
                      <Image
                        src="/assets/icons/whatsapp.svg"
                        alt="WhatsApp"
                        width={16}
                        height={16}
                        className="w-4 h-4 shrink-0"
                      />
                      <span>Chat on WhatsApp</span>
                      <ExternalLink className="w-3 h-3 opacity-70" />
                    </a>
                  )}
                </div>
              </div>

              {/* Message Content */}
              <div className="space-y-2">
                <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Customer Message
                </span>
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-sm text-slate-800 leading-relaxed whitespace-pre-wrap">
                  {selectedInquiry.message}
                </div>
              </div>

              {/* Status Selector */}
              <div className="space-y-2">
                <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Update Status
                </span>
                <div className="flex flex-wrap items-center gap-2">
                  {(["unread", "read", "replied", "archived"] as ContactSubmissionStatus[]).map(
                    (st) => {
                      const isCurrent = selectedInquiry.status === st;
                      return (
                        <button
                          key={st}
                          type="button"
                          onClick={() => handleStatusChange(selectedInquiry.id, st)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition-colors cursor-pointer ${
                            isCurrent
                              ? "bg-slate-900 text-white shadow-xs"
                              : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                          }`}
                        >
                          {st}
                        </button>
                      );
                    }
                  )}
                </div>
              </div>

              {/* Internal Admin Notes */}
              <div className="space-y-2 pt-2 border-t border-slate-100">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5 text-slate-500" />
                    Internal Admin Notes
                  </span>
                  <span className="text-[11px] text-slate-400">Only visible to administrators</span>
                </div>
                <textarea
                  rows={3}
                  value={adminNoteInput}
                  onChange={(e) => setAdminNoteInput(e.target.value)}
                  placeholder="e.g. Sent price quote on 16 Sep; waiting on dimensions confirmation..."
                  className="w-full text-xs p-3 rounded-lg border border-slate-200 focus:outline-none focus:border-[#024AE5] bg-white resize-y"
                />
                <div className="flex justify-end">
                  <Button
                    size="sm"
                    onClick={handleSaveNotes}
                    disabled={isSavingNote}
                    className="bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold gap-1.5 cursor-pointer"
                  >
                    <Save className="w-3.5 h-3.5" />
                    <span>{isSavingNote ? "Saving..." : "Save Note"}</span>
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Alert */}
      <AlertDialog
        open={!!inquiryToDelete}
        onOpenChange={(open) => {
          if (!open) setInquiryToDelete(null);
        }}
      >
        <AlertDialogContent className="bg-white rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base font-bold text-slate-900">
              Delete Contact Inquiry?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs text-slate-600">
              Are you sure you want to delete the inquiry from{" "}
              <span className="font-semibold text-slate-900">{inquiryToDelete?.full_name}</span>?
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="text-xs cursor-pointer">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              className="bg-red-600 hover:bg-red-700 text-white text-xs font-bold cursor-pointer"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
