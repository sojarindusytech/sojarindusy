"use client";

import { useState } from "react";
import { Download, Eye, Receipt } from "lucide-react";
import type { InvoiceListRow } from "@/actions/invoice";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";

const inr = (n: number) => `₹${n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtDate = (iso: string) => iso.split("-").reverse().join("-");

export function CustomerInvoicesView({ invoices }: { invoices: InvoiceListRow[] }) {
  const [viewing, setViewing] = useState<InvoiceListRow | null>(null);
  // Id of the invoice whose PDF has finished loading; the skeleton shows until it matches.
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
                      <Button size="sm" variant="outline" onClick={() => setViewing(inv)} className="h-7 text-[11px] border-slate-200 gap-1 text-slate-700 shadow-none hover:text-[#024AE5]">
                        <Eye className="h-3 w-3" />
                        <span>View</span>
                      </Button>
                      <Button asChild size="sm" variant="outline" className="h-7 text-[11px] border-slate-200 gap-1 text-slate-700 shadow-none hover:text-[#024AE5] ml-1.5">
                        <a href={`/api/invoices/${inv.id}/pdf?download=1`}>
                          <Download className="h-3 w-3" />
                          <span>Download</span>
                        </a>
                      </Button>
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
          <DialogHeader>
            <DialogTitle className="font-mono">{viewing?.invoice_number}</DialogTitle>
            <DialogDescription>{viewing && fmtDate(viewing.invoice_date)}</DialogDescription>
          </DialogHeader>
          {viewing && (
            <div className="relative flex-1 min-h-0">
              {loadedId !== viewing.id && (
                <div className="absolute inset-0 z-10 rounded-lg border border-slate-200 bg-white p-6 space-y-5" aria-busy="true" aria-label="Loading invoice">
                  <Skeleton className="h-14 w-28" />
                  <Skeleton className="h-24" />
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Skeleton key={i} className="h-10 bg-slate-100" />
                  ))}
                </div>
              )}
              <iframe
                key={viewing.id}
                title={`Invoice ${viewing.invoice_number}`}
                src={`/api/invoices/${viewing.id}/pdf`}
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
