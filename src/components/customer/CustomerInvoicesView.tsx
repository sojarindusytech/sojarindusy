"use client";

import React, { useState } from "react";
import { Order } from "@/types/database.types";
import { ORDER_STATUSES, ORDER_STATUS_CONFIG } from "@/lib/constants";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Eye, Receipt, FileText, CheckCircle2, ShieldCheck, Printer } from "lucide-react";
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

interface CustomerInvoicesViewProps {
  orders: Order[];
}

export function CustomerInvoicesView({ orders }: CustomerInvoicesViewProps) {
  const [activeOrderDetails, setActiveOrderDetails] = useState<Order | null>(null);

  // Invoices are only generated when order status is DELIVERED
  const deliveredOrders = orders.filter((ord) => ord.status === ORDER_STATUSES.DELIVERED);

  const handlePrint = () => {
    if (typeof window !== "undefined") {
      window.print();
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold text-slate-900 tracking-tight">
          GST Invoices & Commercial Statements
        </h1>
        <p className="text-xs text-slate-500">
          Official GST tax invoices are generated automatically once your order is delivered. Use these for accounting and Input Tax Credit (ITC).
        </p>
      </div>

      <Card className="border-slate-200 bg-white shadow-none rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-slate-50">
              <TableRow className="text-xs">
                <TableHead className="font-bold text-slate-700">Invoice / Order #</TableHead>
                <TableHead className="font-bold text-slate-700">Delivery Date</TableHead>
                <TableHead className="font-bold text-slate-700">Taxable Subtotal</TableHead>
                <TableHead className="font-bold text-slate-700">GST (18%)</TableHead>
                <TableHead className="font-bold text-slate-700">Total Invoice (₹)</TableHead>
                <TableHead className="font-bold text-slate-700">Status</TableHead>
                <TableHead className="font-bold text-slate-700 text-right pr-4">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {deliveredOrders.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-14 text-slate-500 text-xs">
                    <div className="space-y-2">
                      <Receipt className="h-8 w-8 text-slate-300 mx-auto" />
                      <p className="font-semibold text-slate-700 text-sm">
                        No Invoices Generated Yet
                      </p>
                      <p className="text-slate-400 max-w-sm mx-auto leading-relaxed text-[11px]">
                        Official GST Tax Invoices are generated automatically when orders reach <strong>Delivered</strong> status. Once your shipment is delivered, your invoice will appear here.
                      </p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                deliveredOrders.map((ord) => {
                  const sub = ord.subtotal || ord.total_amount * 0.847;
                  const gst = ord.gst_amount || ord.total_amount * 0.153;

                  return (
                    <TableRow key={ord.id} className="text-xs hover:bg-slate-50">
                      <TableCell className="font-mono font-bold text-[#024AE5]">
                        {ord.invoice_number || `INV-${ord.order_number.replace("ORD-", "")}`}
                      </TableCell>
                      <TableCell className="text-slate-500">
                        {new Date(ord.delivered_at || ord.updated_at || ord.created_at).toLocaleDateString("en-IN", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                        })}
                      </TableCell>
                      <TableCell className="font-mono text-slate-700">
                        ₹{Number(sub).toFixed(2)}
                      </TableCell>
                      <TableCell className="font-mono text-slate-700">
                        ₹{Number(gst).toFixed(2)}
                      </TableCell>
                      <TableCell className="font-mono font-bold text-slate-900">
                        ₹{Number(ord.total_amount).toFixed(2)}
                      </TableCell>
                      <TableCell>
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 gap-1">
                          <CheckCircle2 className="h-3 w-3" />
                          <span>Delivered & Invoiced</span>
                        </span>
                      </TableCell>
                      <TableCell className="text-right pr-4">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setActiveOrderDetails(ord)}
                          className="h-7 text-[11px] border-slate-200 gap-1 text-slate-700 shadow-none cursor-pointer hover:text-[#024AE5]"
                        >
                          <Eye className="h-3 w-3" />
                          <span>View Invoice</span>
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

      {/* Tax Invoice Dialog */}
      {activeOrderDetails && (
        <Dialog
          open={!!activeOrderDetails}
          onOpenChange={(open) => !open && setActiveOrderDetails(null)}
        >
          <DialogContent className="max-w-2xl bg-white p-6 rounded-2xl shadow-xl">
            <DialogHeader className="pb-3 border-b border-slate-200">
              <div className="flex items-center justify-between pr-8">
                <div className="flex items-center gap-2">
                  <Receipt className="h-5 w-5 text-[#024AE5]" />
                  <DialogTitle className="text-lg font-bold text-slate-900">
                    GST Tax Invoice #{activeOrderDetails.invoice_number || activeOrderDetails.order_number.replace("ORD-", "INV-")}
                  </DialogTitle>
                </div>
                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold border border-emerald-200 bg-emerald-50 text-emerald-800">
                  Delivered
                </span>
              </div>
              <DialogDescription className="text-xs text-slate-500">
                Delivered on{" "}
                {new Date(activeOrderDetails.delivered_at || activeOrderDetails.created_at).toLocaleString("en-IN", {
                  day: "2-digit",
                  month: "short",
                  year: "numeric",
                })}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 pt-2">
              {/* Seller / Buyer Header */}
              <div className="grid grid-cols-2 gap-4 text-xs bg-slate-50 p-3 rounded-xl border border-slate-200">
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase block">
                    Billed By
                  </span>
                  <div className="font-bold text-slate-900 mt-0.5">SOJAR INDUSY</div>
                  <div className="text-slate-500">Plot No. W-48, MIDC Bhosari, Pune 411026</div>
                  <div className="text-slate-500 font-mono text-[11px] mt-0.5">
                    GSTIN: 27AASCS8920K1ZX
                  </div>
                </div>

                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase block">
                    Billed & Delivered To
                  </span>
                  <div className="font-bold text-slate-900 mt-0.5">
                    {activeOrderDetails.customer_details?.company_name || "Enterprise Client"}
                  </div>
                  <div className="text-slate-500">
                    {activeOrderDetails.shipping_address}
                  </div>
                  {activeOrderDetails.customer_details?.gstin && (
                    <div className="text-slate-700 font-mono text-[11px] font-bold mt-0.5">
                      GSTIN: {activeOrderDetails.customer_details.gstin}
                    </div>
                  )}
                </div>
              </div>

              {/* Line Items Table */}
              <div className="rounded-lg border border-slate-200 overflow-hidden">
                <Table>
                  <TableHeader className="bg-slate-50">
                    <TableRow className="text-xs">
                      <TableHead className="font-bold text-slate-700">Item Description</TableHead>
                      <TableHead className="font-bold text-slate-700 text-center">Qty</TableHead>
                      <TableHead className="font-bold text-slate-700 text-right">Unit Rate (₹)</TableHead>
                      <TableHead className="font-bold text-slate-700 text-right">Taxable Subtotal (₹)</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {Array.isArray(activeOrderDetails.items) &&
                      activeOrderDetails.items.map((item, idx) => (
                        <TableRow key={idx} className="text-xs">
                          <TableCell>
                            <div className="font-bold text-slate-800">{item.name}</div>
                            <div className="font-mono text-[11px] font-bold text-[#024AE5]">
                              {item.sku}
                            </div>
                          </TableCell>
                          <TableCell className="text-center font-bold text-slate-800">
                            {item.quantity}
                          </TableCell>
                          <TableCell className="text-right font-mono text-slate-700">
                            ₹{Number(item.unit_price).toFixed(2)}
                          </TableCell>
                          <TableCell className="text-right font-mono font-bold text-slate-900">
                            ₹{(Number(item.unit_price) * Number(item.quantity)).toFixed(2)}
                          </TableCell>
                        </TableRow>
                      ))}
                  </TableBody>
                </Table>
              </div>

              {/* Financial Totals */}
              <div className="flex justify-end pt-1">
                <div className="w-64 space-y-1.5 text-xs">
                  <div className="flex justify-between text-slate-600">
                    <span>Taxable Subtotal</span>
                    <span className="font-mono">
                      ₹{Number(activeOrderDetails.subtotal || activeOrderDetails.total_amount * 0.847).toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>Standard GST (18%)</span>
                    <span className="font-mono">
                      ₹{Number(activeOrderDetails.gst_amount || activeOrderDetails.total_amount * 0.153).toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm font-bold text-slate-900 pt-1.5 border-t border-slate-200">
                    <span>Total Tax Invoice</span>
                    <span className="font-mono text-[#024AE5]">
                      ₹{Number(activeOrderDetails.total_amount).toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setActiveOrderDetails(null)}
                  className="h-8 text-xs border-slate-200 shadow-none cursor-pointer"
                >
                  Close
                </Button>
                <Button
                  size="sm"
                  onClick={handlePrint}
                  className="h-8 text-xs bg-[#024AE5] hover:bg-[#024AE5]/90 text-white shadow-none cursor-pointer gap-1.5 font-bold"
                >
                  <Printer className="h-3.5 w-3.5" />
                  <span>Print Tax Invoice</span>
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
