"use client";

import React, { useState } from "react";
import { Order, Profile, OrderItem } from "@/types/database.types";
import { ORDER_STATUS_CONFIG, ORDER_STATUSES } from "@/lib/constants";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  CreditCard,
  Truck,
  TrendingUp,
  Boxes,
  FileText,
  ShoppingBag,
  ExternalLink,
  ChevronRight,
  Eye,
  Building2,
  ShieldCheck,
  Clock,
} from "lucide-react";
import Link from "next/link";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface CustomerOverviewViewProps {
  user: { id: string; email: string };
  profile: Profile | null;
  orders: Order[];
}

export function CustomerOverviewView({
  user,
  profile,
  orders,
}: CustomerOverviewViewProps) {
  const [activeOrderDetails, setActiveOrderDetails] = useState<Order | null>(null);

  // Financial & Metrics Computations
  const totalSpent = orders.reduce((acc, curr) => acc + (Number(curr.total_amount) || 0), 0);
  const activeOrders = orders.filter(
    (o) =>
      o.status === ORDER_STATUSES.PENDING ||
      o.status === ORDER_STATUSES.CONFIRMED ||
      o.status === ORDER_STATUSES.PROCESSING ||
      o.status === ORDER_STATUSES.SHIPPED
  );
  const deliveredOrders = orders.filter((o) => o.status === ORDER_STATUSES.DELIVERED);

  const creditLimit = profile?.credit_limit || 0;
  const creditDays = profile?.credit_days || 0;
  const hasCreditFacility = creditLimit > 0;
  const utilizedCredit = activeOrders.reduce((acc, curr) => acc + (Number(curr.total_amount) || 0), 0);
  const availableCredit = Math.max(0, creditLimit - utilizedCredit);
  const creditUsedPercent = hasCreditFacility ? Math.min(100, Math.round((utilizedCredit / creditLimit) * 100)) : 0;

  const recentOrders = orders.slice(0, 3);

  return (
    <div className="space-y-6">
      {/* Top Commercial KPI Cards (OVERVIEW ONLY) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="p-4 bg-white border border-slate-200 shadow-none rounded-xl space-y-2">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-[11px] font-bold uppercase tracking-wider">Active Shipments</span>
            <Truck className="h-4 w-4 text-indigo-600" />
          </div>
          <div className="text-xl font-bold text-indigo-700">
            {activeOrders.length} {activeOrders.length === 1 ? "Consignment" : "Consignments"}
          </div>
          <p className="text-[11px] text-slate-500">
            {activeOrders.filter((o) => o.status === ORDER_STATUSES.SHIPPED).length} currently in live transit
          </p>
        </Card>

        <Card className="p-4 bg-white border border-slate-200 shadow-none rounded-xl space-y-2">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-[11px] font-bold uppercase tracking-wider">Lifetime Procurements</span>
            <TrendingUp className="h-4 w-4 text-emerald-600" />
          </div>
          <div className="text-xl font-bold text-emerald-700 font-mono">
            ₹{totalSpent.toLocaleString("en-IN")}
          </div>
          <p className="text-[11px] text-slate-500">
            Across {orders.length} total purchase orders
          </p>
        </Card>

        <Card className="p-4 bg-white border border-slate-200 shadow-none rounded-xl space-y-2">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-[11px] font-bold uppercase tracking-wider">Completed Deliveries</span>
            <Boxes className="h-4 w-4 text-[#024AE5]" />
          </div>
          <div className="text-xl font-bold text-slate-900 font-mono">
            {deliveredOrders.length} {deliveredOrders.length === 1 ? "Order" : "Orders"}
          </div>
          <p className="text-[11px] text-slate-500">
            Receipt acknowledged & verified
          </p>
        </Card>
      </div>

      {/* Main Overview Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Recent Orders Section (8 Cols) */}
        <div className="lg:col-span-8 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-slate-900 tracking-tight">
                Recent Orders & Consignments
              </h2>
              <p className="text-xs text-slate-500">
                Latest dispatch status and tracking links.
              </p>
            </div>
            <Link href="/dashboard/orders">
              <Button
                variant="ghost"
                size="sm"
                className="text-xs font-bold text-[#024AE5] hover:text-[#024AE5]/80 hover:bg-blue-50 gap-1 h-8"
              >
                <span>View All ({orders.length})</span>
                <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            </Link>
          </div>

          {orders.length === 0 ? (
            <Card className="p-10 border border-slate-200 shadow-none bg-white rounded-xl text-center space-y-3">
              <div className="h-12 w-12 bg-slate-50 text-slate-400 rounded-full flex items-center justify-center mx-auto border border-slate-200">
                <Boxes className="h-6 w-6 text-slate-400" />
              </div>
              <div className="space-y-1">
                <h3 className="text-sm font-bold text-slate-900">No Orders Placed Yet</h3>
                <p className="text-xs text-slate-500 max-w-sm mx-auto">
                  Browse our catalog to place your first industrial tooling or fastener order.
                </p>
              </div>
              <div className="pt-2">
                <Link href="/products">
                  <Button
                    size="sm"
                    className="bg-[#024AE5] hover:bg-[#024AE5]/90 text-white text-xs font-bold h-8 px-4 shadow-none"
                  >
                    Browse Product Catalog
                  </Button>
                </Link>
              </div>
            </Card>
          ) : (
            <div className="space-y-3">
              {recentOrders.map((ord) => {
                const statusCfg = ORDER_STATUS_CONFIG[ord.status] || {
                  label: ord.status,
                  badgeBg: "bg-slate-100",
                  badgeText: "text-slate-700",
                  border: "border-slate-200",
                };
                const itemsList = Array.isArray(ord.items) ? ord.items : [];

                return (
                  <Card key={ord.id} className="p-4 bg-white border border-slate-200 shadow-none rounded-xl space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
                      <div className="flex items-center gap-2.5">
                        <span className="font-mono text-xs font-bold text-[#024AE5]">
                          #{ord.order_number}
                        </span>
                        <span className="text-[11px] text-slate-400">
                          {new Date(ord.created_at).toLocaleDateString("en-IN", {
                            day: "2-digit",
                            month: "short",
                            year: "numeric",
                          })}
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold border ${statusCfg.badgeBg} ${statusCfg.badgeText} ${statusCfg.border}`}
                        >
                          {statusCfg.label}
                        </span>
                        <span className="font-mono font-bold text-xs text-slate-900">
                          ₹{Number(ord.total_amount).toLocaleString("en-IN")}
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-col sm:flex-row sm:items-center justify-between text-xs text-slate-500 gap-2">
                      <div className="truncate max-w-sm">
                        <span className="font-medium text-slate-800">
                          {itemsList[0]?.name || "Tooling Hardware"}
                        </span>
                        {itemsList.length > 1 && (
                          <span className="text-slate-400">
                            {" "}
                            +{itemsList.length - 1} more item(s)
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {ord.tracking_url && (
                          <a
                            href={ord.tracking_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[#024AE5] hover:underline text-[11px] font-bold flex items-center gap-1"
                          >
                            <span>Track</span>
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setActiveOrderDetails(ord)}
                          className="text-slate-700 hover:text-slate-900 text-[11px] font-semibold gap-1 h-7 px-2"
                        >
                          <Eye className="h-3 w-3" />
                          <span>{ord.status === ORDER_STATUSES.DELIVERED ? "Invoice" : "Details"}</span>
                        </Button>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </div>

        {/* Quick Actions & Enterprise Summary (4 Cols) */}
        <div className="lg:col-span-4 space-y-4">
          <Card className="p-5 bg-gradient-to-br from-blue-900 to-[#024AE5] text-white border-0 shadow-none rounded-xl space-y-3">
            <div className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-blue-200" />
              <h3 className="font-bold text-sm">Need Custom Tooling?</h3>
            </div>
            <p className="text-xs text-blue-100 leading-relaxed">
              Submit your engineering drawings and tolerances for custom solid carbide end mills or non-standard fasteners.
            </p>
            <Link href="/dashboard/rfqs" className="inline-block pt-1">
              <Button
                size="sm"
                className="bg-white text-[#024AE5] hover:bg-slate-100 text-xs font-bold h-8 px-3.5 shadow-none"
              >
                Submit Custom RFQ
              </Button>
            </Link>
          </Card>

          <Card className="p-5 bg-white border border-slate-200 shadow-none rounded-xl space-y-3">
            <div className="flex items-center gap-2 border-b border-slate-100 pb-2.5">
              <Building2 className="h-4 w-4 text-[#024AE5]" />
              <h3 className="font-bold text-xs text-slate-900">Registered Enterprise</h3>
            </div>

            <div className="space-y-2 text-xs">
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Company Name</span>
                <span className="font-semibold text-slate-900">{profile?.company_name || "Enterprise Client"}</span>
              </div>

              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block">GSTIN / Tax ID</span>
                <span className="font-mono font-semibold text-slate-900">{profile?.gstin || "Not specified"}</span>
              </div>

              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Delivery Site</span>
                <p className="text-slate-600 truncate mt-0.5">
                  {profile?.city ? `${profile.city}, ${profile.state || "Maharashtra"}` : "Industrial Facility"}
                </p>
              </div>
            </div>

            <div className="pt-2 border-t border-slate-100">
              <Link href="/dashboard/profile">
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full text-xs font-semibold h-8 border-slate-200 text-slate-700 shadow-none"
                >
                  Manage Facility & GST Details
                </Button>
              </Link>
            </div>
          </Card>
        </div>
      </div>

      {/* Tax Invoice / Order Details Dialog */}
      {activeOrderDetails && (
        <Dialog
          open={!!activeOrderDetails}
          onOpenChange={(open) => !open && setActiveOrderDetails(null)}
        >
          <DialogContent className="max-w-2xl bg-white p-6 rounded-2xl shadow-xl">
            <DialogHeader className="pb-3 border-b border-slate-200">
              <div className="flex items-center justify-between pr-8">
                <div className="flex items-center gap-2">
                  <Boxes className="h-5 w-5 text-[#024AE5]" />
                  <DialogTitle className="text-lg font-bold text-slate-900">
                    {activeOrderDetails.status === ORDER_STATUSES.DELIVERED
                      ? `GST Tax Invoice #${activeOrderDetails.invoice_number || activeOrderDetails.order_number.replace("ORD-", "INV-")}`
                      : `Purchase Order #${activeOrderDetails.order_number}`}
                  </DialogTitle>
                </div>
                <span
                  className={`inline-flex items-center px-2.5 py-0.5 rounded text-xs font-bold border ${
                    ORDER_STATUS_CONFIG[activeOrderDetails.status]?.badgeBg
                  } ${ORDER_STATUS_CONFIG[activeOrderDetails.status]?.badgeText} ${
                    ORDER_STATUS_CONFIG[activeOrderDetails.status]?.border
                  }`}
                >
                  {ORDER_STATUS_CONFIG[activeOrderDetails.status]?.label ||
                    activeOrderDetails.status}
                </span>
              </div>
              <DialogDescription className="text-xs text-slate-500">
                Order date:{" "}
                {new Date(activeOrderDetails.created_at).toLocaleString("en-IN", {
                  day: "2-digit",
                  month: "short",
                  year: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 pt-2">
              {activeOrderDetails.status !== ORDER_STATUSES.DELIVERED && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-2.5 text-xs text-blue-900 flex items-center gap-2">
                  <Clock className="h-4 w-4 text-[#024AE5] shrink-0" />
                  <span>
                    Official GST Tax Invoice will be generated automatically once this order is marked as <strong>Delivered</strong>.
                  </span>
                </div>
              )}
              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 text-xs">
                <span className="text-slate-400 block text-[10px] font-bold uppercase">
                  Delivery Destination
                </span>
                <p className="text-slate-800 font-medium mt-0.5">
                  {activeOrderDetails.shipping_address}
                </p>
              </div>

              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <Table>
                  <TableHeader className="bg-slate-50">
                    <TableRow className="text-xs">
                      <TableHead className="font-bold text-slate-700">Item / SKU</TableHead>
                      <TableHead className="font-bold text-slate-700 text-center">Qty</TableHead>
                      <TableHead className="font-bold text-slate-700 text-right">Unit Price</TableHead>
                      <TableHead className="font-bold text-slate-700 text-right">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {Array.isArray(activeOrderDetails.items) &&
                      activeOrderDetails.items.map((item: OrderItem, idx: number) => (
                        <TableRow key={idx} className="text-xs">
                          <TableCell className="py-2.5">
                            <div className="font-bold text-slate-900">{item.name}</div>
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

              <div className="flex justify-end pt-2">
                <div className="w-64 space-y-1.5 text-xs">
                  <div className="flex justify-between text-slate-600">
                    <span>Taxable Subtotal</span>
                    <span className="font-mono">
                      ₹{Number(activeOrderDetails.subtotal || activeOrderDetails.total_amount * 0.847).toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>GST (18% Integrated / CGST+SGST)</span>
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
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
