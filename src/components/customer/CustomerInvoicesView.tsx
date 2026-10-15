"use client";

import { pdfViewerSrc } from "@/lib/pdf-viewer";
import { useState } from "react";
import { Download, Eye, Receipt } from "lucide-react";
import type { InvoiceListRow } from "@/actions/invoice";
import type { DebitNoteListRow } from "@/actions/debit-note";
import { debitNoteReasonLabel } from "@/lib/debit-notes";
import { Card } from "@/components/ui/card";
import { IconAction } from "@/components/common/IconAction";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";

const inr = (n: number) => `₹${n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtDate = (iso: string) => iso.split("-").reverse().join("-");

/** The document open in the PDF viewer: an invoice or a debit note. */
interface Viewing {
  id: string;
  number: string;
  date: string;
  pdfUrl: string;
}

export function CustomerInvoicesView({
  invoices,
  debitNotes = [],
}: {
  invoices: InvoiceListRow[];
  debitNotes?: DebitNoteListRow[];
}) {
  const [viewing, setViewing] = useState<Viewing | null>(null);
  // Id of the document whose PDF has finished loading; the skeleton shows until it matches.
  const [loadedId, setLoadedId] = useState<string | null>(null);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold text-slate-900 tracking-tight">GST Invoices & Commercial Statements</h1>
        <p className="text-xs text-slate-500">
          Official tax invoices are issued once your order is delivered. Use these for accounting and Input Tax Credit (ITC).
        </p>
      </div>

      <Card className="border-slate-200 bg-white shadow-none rounded-xl overflow-hidden">
        <div className="overflow-x-auto [scrollbar-width:thin]">
          <Table className="min-w-[650px]">
            <TableHeader className="bg-slate-50">
              <TableRow className="text-xs">
                <TableHead className="font-bold text-slate-700">Invoice #</TableHead>
                <TableHead className="font-bold text-slate-700">Date</TableHead>
                <TableHead className="font-bold text-slate-700">PO / Order</TableHead>
                <TableHead className="font-bold text-slate-700">Type</TableHead>
                <TableHead className="font-bold text-slate-700">Total (₹)</TableHead>
                <TableHead className="font-bold text-slate-700 text-right pr-4">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invoices.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-14 text-slate-500 text-xs">
                    <div className="space-y-2">
                      <Receipt className="h-8 w-8 text-slate-300 mx-auto" />
                      <p className="font-semibold text-slate-700 text-sm">No Invoices Yet</p>
                      <p className="text-slate-400 max-w-sm mx-auto leading-relaxed text-[11px]">
                        Your invoice appears here once an order reaches <strong>Delivered</strong> status.
                      </p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                invoices.map((inv) => (
                  <TableRow key={inv.id} className="text-xs hover:bg-slate-50">
                    <TableCell className="font-mono font-bold text-[#024AE5] whitespace-nowrap">{inv.invoice_number}</TableCell>
                    <TableCell className="text-slate-500 whitespace-nowrap">{fmtDate(inv.invoice_date)}</TableCell>
                    <TableCell className="text-slate-600">{inv.po_number || "—"}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-[10px]">{inv.gst_enabled ? "Tax Invoice" : "Invoice"}</Badge>
                    </TableCell>
                    <TableCell className="font-mono font-bold text-slate-900">{inr(Number(inv.total_amount))}</TableCell>
                    <TableCell className="text-right pr-4 whitespace-nowrap">
                      <IconAction
                        label="View invoice"
                        onClick={() => setViewing({ id: inv.id, number: inv.invoice_number, date: inv.invoice_date, pdfUrl: `/api/invoices/${inv.id}/pdf` })}
                      >
                        <Eye />
                      </IconAction>
                      <IconAction label="Download invoice" href={`/api/invoices/${inv.id}/pdf?download=1`}><Download /></IconAction>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </Card>

      {debitNotes.length > 0 && (
        <div className="space-y-2">
          <div>
            <h2 className="text-sm font-bold text-slate-900">Debit Notes</h2>
            <p className="text-xs text-slate-500">
              Additional amounts charged against an invoice (for example a revised price or freight). Claim the GST on them as Input Tax Credit like an invoice.
            </p>
          </div>
          <Card className="border-slate-200 bg-white shadow-none rounded-xl overflow-hidden">
            <div className="overflow-x-auto [scrollbar-width:thin]">
              <Table className="min-w-[650px]">
                <TableHeader className="bg-slate-50">
                  <TableRow className="text-xs">
                    <TableHead className="font-bold text-slate-700">Debit Note #</TableHead>
                    <TableHead className="font-bold text-slate-700">Date</TableHead>
                    <TableHead className="font-bold text-slate-700">Against Invoice</TableHead>
                    <TableHead className="font-bold text-slate-700">Reason</TableHead>
                    <TableHead className="font-bold text-slate-700">Amount (₹)</TableHead>
                    <TableHead className="font-bold text-slate-700 text-right pr-4">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {debitNotes.map((dn) => (
                    <TableRow key={dn.id} className="text-xs hover:bg-slate-50">
                      <TableCell className="font-mono font-bold text-[#024AE5] whitespace-nowrap">{dn.debit_note_number}</TableCell>
                      <TableCell className="text-slate-500 whitespace-nowrap">{fmtDate(dn.debit_note_date)}</TableCell>
                      <TableCell className="text-slate-600 font-mono whitespace-nowrap">{dn.invoice_number}</TableCell>
                      <TableCell className="text-slate-600">{debitNoteReasonLabel(dn.reason)}</TableCell>
                      <TableCell className="font-mono font-bold text-slate-900">{inr(Number(dn.total_amount))}</TableCell>
                      <TableCell className="text-right pr-4 whitespace-nowrap">
                        <IconAction
                          label="View debit note"
                          onClick={() => setViewing({ id: dn.id, number: dn.debit_note_number, date: dn.debit_note_date, pdfUrl: `/api/debit-notes/${dn.id}/pdf` })}
                        >
                          <Eye />
                        </IconAction>
                        <IconAction label="Download debit note" href={`/api/debit-notes/${dn.id}/pdf?download=1`}><Download /></IconAction>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </Card>
        </div>
      )}

      <Dialog open={!!viewing} onOpenChange={(o) => !o && setViewing(null)}>
        <DialogContent className="max-w-4xl h-[90vh] flex flex-col">
          <div className="flex items-start justify-between gap-3 pr-8">
            <DialogHeader className="min-w-0">
              <DialogTitle className="font-mono">{viewing?.number}</DialogTitle>
              <DialogDescription>{viewing && fmtDate(viewing.date)}</DialogDescription>
            </DialogHeader>
            <Button asChild size="sm" variant="outline" className="gap-1.5 shrink-0">
              <a href={`${viewing?.pdfUrl}?download=1`}>
                <Download className="h-4 w-4" />
                Download
              </a>
            </Button>
          </div>
          {viewing && (
            <div className="relative flex-1 min-h-0">
              {loadedId !== viewing.id && (
                <div className="absolute inset-0 z-10 rounded-lg border border-slate-200 bg-white p-6 space-y-5" aria-busy="true" aria-label="Loading document">
                  <Skeleton className="h-14 w-28" />
                  <Skeleton className="h-24" />
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Skeleton key={i} className="h-10 bg-slate-100" />
                  ))}
                </div>
              )}
              <iframe
                key={viewing.id}
                title={viewing.number}
                src={pdfViewerSrc(viewing.pdfUrl)}
                onLoad={() => setLoadedId(viewing.id)}
                className="h-full w-full rounded-lg border border-slate-200 bg-slate-50"
              />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
