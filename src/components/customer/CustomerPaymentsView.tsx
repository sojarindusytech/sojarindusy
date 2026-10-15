"use client";

import { pdfViewerSrc } from "@/lib/pdf-viewer";
import { useState } from "react";
import { Download, Eye, Wallet } from "lucide-react";
import type { Payment } from "@/types/database.types";
import { modeLabel } from "@/lib/payments";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { IconAction } from "@/components/common/IconAction";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";

const inr = (n: number) => `₹${n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtDate = (iso: string) => iso.split("-").reverse().join("-");

function appliedTo(p: Payment): string {
  const parts = (p.allocations ?? []).map((a) => (a.kind === "invoice" ? a.invoice_number ?? "Invoice" : a.kind === "advance" ? "Advance" : "Other"));
  return parts.length ? parts.join(", ") : "—";
}

/** The signed-in customer's receipts, with the same PDF the admin issues. */
export function CustomerPaymentsView({ payments }: { payments: Payment[] }) {
  const [viewing, setViewing] = useState<Payment | null>(null);
  // Id of the receipt whose PDF has finished loading; the skeleton shows until it matches.
  const [loadedId, setLoadedId] = useState<string | null>(null);
  const total = payments.reduce((s, p) => s + p.amount, 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-2">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">Payments & Receipts</h1>
          <p className="text-xs text-slate-500">Payments we have received from you, and the invoices they were applied to.</p>
        </div>
        {payments.length > 0 && (
          <div className="text-right">
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Total received</div>
            <div className="text-lg font-bold text-[#024AE5]">{inr(total)}</div>
          </div>
        )}
      </div>

      <Card className="border-slate-200 bg-white shadow-none rounded-xl overflow-hidden">
        <div className="overflow-x-auto [scrollbar-width:thin]">
          <Table className="min-w-[680px]">
            <TableHeader className="bg-slate-50">
              <TableRow className="text-xs whitespace-nowrap">
                <TableHead className="font-bold text-slate-700">Receipt #</TableHead>
                <TableHead className="font-bold text-slate-700">Date</TableHead>
                <TableHead className="font-bold text-slate-700">Mode</TableHead>
                <TableHead className="font-bold text-slate-700">Applied To</TableHead>
                <TableHead className="font-bold text-slate-700 text-right">Amount</TableHead>
                <TableHead className="font-bold text-slate-700 text-right pr-4">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {payments.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-14 text-slate-500 text-xs">
                    <div className="space-y-2">
                      <Wallet className="h-8 w-8 text-slate-300 mx-auto" />
                      <p className="font-semibold text-slate-700 text-sm">No payments yet</p>
                      <p className="text-slate-400 max-w-sm mx-auto leading-relaxed text-[11px]">Receipts appear here when we record a payment from you.</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                payments.map((p) => (
                  <TableRow key={p.id} className="text-xs hover:bg-slate-50 whitespace-nowrap">
                    <TableCell className="font-mono font-bold text-[#024AE5]">{p.receipt_number}</TableCell>
                    <TableCell className="text-slate-500">{fmtDate(p.payment_date)}</TableCell>
                    <TableCell className="text-slate-600">{modeLabel(p.mode).replace(/ \(.*\)$/, "")}</TableCell>
                    <TableCell className="text-slate-600 max-w-[220px] truncate" title={appliedTo(p)}>{appliedTo(p)}</TableCell>
                    <TableCell className="font-mono font-bold text-slate-900 text-right">{inr(p.amount)}</TableCell>
                    <TableCell className="text-right pr-4">
                      <IconAction label="View receipt" onClick={() => setViewing(p)}><Eye /></IconAction>
                      <IconAction label="Download receipt" href={`/api/payments/${p.id}/pdf?download=1`}><Download /></IconAction>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </Card>

      <Dialog open={!!viewing} onOpenChange={(o) => !o && setViewing(null)}>
        <DialogContent className="max-w-4xl h-[90vh] flex flex-col">
          <div className="flex items-start justify-between gap-3 pr-8">
            <DialogHeader className="min-w-0">
              <DialogTitle className="font-mono">{viewing?.receipt_number}</DialogTitle>
              <DialogDescription>{viewing && fmtDate(viewing.payment_date)}</DialogDescription>
            </DialogHeader>
            <Button asChild size="sm" variant="outline" className="gap-1.5 shrink-0">
              <a href={`/api/payments/${viewing?.id}/pdf?download=1`}>
                <Download className="h-4 w-4" />
                Download
              </a>
            </Button>
          </div>
          {viewing && (
            <div className="relative flex-1 min-h-0">
              {loadedId !== viewing.id && (
                <div className="absolute inset-0 z-10 rounded-lg border border-slate-200 bg-white p-6 space-y-5" aria-busy="true" aria-label="Loading receipt">
                  <Skeleton className="h-14 w-28" />
                  <Skeleton className="h-24" />
                  {Array.from({ length: 4 }).map((_, i) => (<Skeleton key={i} className="h-10 bg-slate-100" />))}
                </div>
              )}
              <iframe
                key={viewing.id}
                title={`Receipt ${viewing.receipt_number}`}
                src={pdfViewerSrc(`/api/payments/${viewing.id}/pdf`)}
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
