"use client";

import React, { useState } from "react";
import { Order, Profile, OrderItem } from "@/types/database.types";
import { ORDER_STATUSES, ORDER_STATUS_CONFIG, OrderStatus } from "@/lib/constants";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Boxes,
  Truck,
  Check,
  Copy,
  ExternalLink,
  Eye,
  Plus,
  ShoppingBag,
  Search,
  Filter,
  ArrowUpDown,
  RotateCcw,
  Receipt,
  Clock,
} from "lucide-react";
import Link from "next/link";
import toast from "react-hot-toast";
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

interface CustomerOrdersViewProps {
  orders: Order[];
}

export function CustomerOrdersView({ orders }: CustomerOrdersViewProps) {
  const [orderStatusFilter, setOrderStatusFilter] = useState<string>("ALL");
  const [orderSearch, setOrderSearch] = useState("");
  const [sortBy, setSortBy] = useState<"DATE_DESC" | "DATE_ASC" | "AMOUNT_DESC" | "AMOUNT_ASC">("DATE_DESC");
  const [activeOrderDetails, setActiveOrderDetails] = useState<Order | null>(null);
  const [copiedAwb, setCopiedAwb] = useState<string | null>(null);

  const copyToClipboard = (text: string, label = "AWB Number") => {
    navigator.clipboard.writeText(text);
    setCopiedAwb(text);
    toast.success(`${label} copied to clipboard!`);
    setTimeout(() => setCopiedAwb(null), 2500);
  };

  const filteredOrders = orders
    .filter((o) => {
      if (orderStatusFilter !== "ALL" && o.status !== orderStatusFilter) {
        return false;
      }
      if (orderSearch.trim()) {
        const q = orderSearch.toLowerCase();
        const matchNum = o.order_number?.toLowerCase().includes(q);
        const matchAwb = o.awb_number?.toLowerCase().includes(q);
        const matchItem = Array.isArray(o.items) && o.items.some((i) => i.name?.toLowerCase().includes(q) || i.sku?.toLowerCase().includes(q));
        return matchNum || matchAwb || matchItem;
      }
      return true;
    })
    .sort((a, b) => {
      if (sortBy === "DATE_DESC") {
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      }
      if (sortBy === "DATE_ASC") {
        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      }
      if (sortBy === "AMOUNT_DESC") {
        return Number(b.total_amount) - Number(a.total_amount);
      }
      if (sortBy === "AMOUNT_ASC") {
        return Number(a.total_amount) - Number(b.total_amount);
      }
      return 0;
    });

  const getTimelineStep = (status: OrderStatus) => {
    switch (status) {
      case ORDER_STATUSES.PENDING:
        return 1;
      case ORDER_STATUSES.CONFIRMED:
        return 2;
      case ORDER_STATUSES.PROCESSING:
        return 3;
      case ORDER_STATUSES.SHIPPED:
        return 4;
      case ORDER_STATUSES.DELIVERED:
        return 5;
      case ORDER_STATUSES.CANCELLED:
        return -1;
      default:
        return 1;
    }
  };

  const steps = [
    { step: 1, label: "Placed", desc: "Order Logged" },
    { step: 2, label: "Confirmed", desc: "Inventory Allocated" },
    { step: 3, label: "Packaging", desc: "MIDC Warehouse" },
    { step: 4, label: "In Transit", desc: "Carrier Dispatched" },
    { step: 5, label: "Delivered", desc: "Receipt Acknowledged" },
  ];

  return (
    <div className="space-y-4">
      {/* Header Title & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">
            Industrial Orders & Logistics Tracking
          </h1>
          <p className="text-xs text-slate-500">
            Real-time status tracking, carrier AWB numbers, and live consignment links.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/dashboard/rfqs">
            <Button
              size="sm"
              className="bg-[#3C8B4F] hover:bg-[#347844] text-white text-xs font-bold h-8.5 shadow-none gap-1.5 cursor-pointer"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Request Custom RFQ</span>
            </Button>
          </Link>
          <Link href="/products">
            <Button
              size="sm"
              className="bg-[#024AE5] hover:bg-[#024AE5]/90 text-white text-xs font-bold h-8.5 shadow-none gap-1.5 cursor-pointer"
            >
              <ShoppingBag className="h-3.5 w-3.5" />
              <span>Browse Products</span>
            </Button>
          </Link>
        </div>
      </div>

      {/* Clean Filter & Search Toolbar with shadcn Dropdowns */}
      <div className="bg-white p-3.5 rounded-xl border border-slate-200 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 shadow-xs">
        {/* Search Bar */}
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
          <Input
            type="text"
            placeholder="Search by Order #, SKU, or Carrier AWB..."
            value={orderSearch}
            onChange={(e) => setOrderSearch(e.target.value)}
            className="h-9 pl-9 text-xs border-slate-200 bg-slate-50/50 focus-visible:bg-white"
          />
          {orderSearch && (
            <button
              onClick={() => setOrderSearch("")}
              className="absolute right-2.5 top-2.5 text-xs text-slate-400 hover:text-slate-600"
            >
              &times;
            </button>
          )}
        </div>

        {/* Dropdowns & Reset Action */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Status Dropdown Filter */}
          <div className="flex items-center gap-1.5">
            <Filter className="h-3.5 w-3.5 text-slate-400 shrink-0" />
            <Select value={orderStatusFilter} onValueChange={(val) => setOrderStatusFilter(val)}>
              <SelectTrigger className="h-9 w-44 text-xs font-semibold bg-slate-50/50 border-slate-200 shadow-none">
                <SelectValue placeholder="All Statuses" />
              </SelectTrigger>
              <SelectContent className="bg-white border-slate-200 shadow-lg text-xs">
                <SelectItem value="ALL">All Statuses ({orders.length})</SelectItem>
                {Object.entries(ORDER_STATUSES).map(([key, val]) => (
                  <SelectItem key={key} value={val}>
                    {ORDER_STATUS_CONFIG[val]?.label || val}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Sort By Dropdown */}
          <div className="flex items-center gap-1.5">
            <ArrowUpDown className="h-3.5 w-3.5 text-slate-400 shrink-0" />
            <Select value={sortBy} onValueChange={(val: any) => setSortBy(val)}>
              <SelectTrigger className="h-9 w-44 text-xs font-semibold bg-slate-50/50 border-slate-200 shadow-none">
                <SelectValue placeholder="Sort Orders" />
              </SelectTrigger>
              <SelectContent className="bg-white border-slate-200 shadow-lg text-xs">
                <SelectItem value="DATE_DESC">Date (Newest First)</SelectItem>
                <SelectItem value="DATE_ASC">Date (Oldest First)</SelectItem>
                <SelectItem value="AMOUNT_DESC">Value (High to Low)</SelectItem>
                <SelectItem value="AMOUNT_ASC">Value (Low to High)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Reset Button */}
          {(orderSearch || orderStatusFilter !== "ALL") && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setOrderSearch("");
                setOrderStatusFilter("ALL");
              }}
              className="h-9 text-xs text-slate-500 hover:text-slate-800 gap-1 px-2.5"
              title="Reset search & filters"
            >
              <RotateCcw className="h-3 w-3" />
              <span>Reset</span>
            </Button>
          )}
        </div>
      </div>

      {/* Orders List / Clean Empty State */}
      {filteredOrders.length === 0 ? (
        <Card className="p-12 border border-slate-200 shadow-none bg-white rounded-xl text-center space-y-3">
          <div className="h-12 w-12 bg-slate-50 text-slate-400 rounded-full flex items-center justify-center mx-auto border border-slate-200">
            <Boxes className="h-6 w-6 text-slate-400" />
          </div>
          <div className="space-y-1">
            <h3 className="text-sm font-bold text-slate-900">
              {orderSearch || orderStatusFilter !== "ALL" ? "No matching orders found" : "No orders placed yet"}
            </h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              {orderSearch || orderStatusFilter !== "ALL"
                ? "Try adjusting your search query or selecting a different status filter."
                : "Your active industrial consignments and consignment tracking history will appear here once orders are placed."}
            </p>
          </div>
          <div className="pt-2 flex items-center justify-center gap-2">
            {(orderSearch || orderStatusFilter !== "ALL") && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setOrderSearch("");
                  setOrderStatusFilter("ALL");
                }}
                className="text-xs border-slate-200 h-8 shadow-none cursor-pointer"
              >
                Clear Filters
              </Button>
            )}
            <Link href="/products">
              <Button
                size="sm"
                className="bg-[#024AE5] hover:bg-[#024AE5]/90 text-white text-xs font-bold h-8 px-4 shadow-none cursor-pointer"
              >
                Browse Product Catalog
              </Button>
            </Link>
          </div>
        </Card>
      ) : (
        <div className="space-y-4">
          {filteredOrders.map((ord) => {
            const statusCfg = ORDER_STATUS_CONFIG[ord.status] || {
              label: ord.status,
              badgeBg: "bg-slate-100",
              badgeText: "text-slate-700",
              border: "border-slate-200",
            };
            const currentStep = getTimelineStep(ord.status);
            const itemsList = Array.isArray(ord.items) ? ord.items : [];
            const totalQty = itemsList.reduce((acc, i: any) => acc + (Number(i.quantity) || 0), 0);

            return (
              <Card key={ord.id} className="p-5 sm:p-6 bg-white border border-slate-200 shadow-none rounded-xl space-y-4">
                {/* Top Bar */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-sm font-bold text-[#024AE5]">
                      #{ord.order_number}
                    </span>
                    <span className="text-xs text-slate-400">
                      Placed {new Date(ord.created_at).toLocaleDateString("en-IN", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                      })}
                    </span>
                  </div>

                  <div className="flex items-center gap-2.5">
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded text-xs font-bold border ${statusCfg.badgeBg} ${statusCfg.badgeText} ${statusCfg.border}`}
                    >
                      {statusCfg.label}
                    </span>
                    <span className="font-mono font-bold text-sm text-slate-900">
                      ₹{Number(ord.total_amount).toLocaleString("en-IN")}
                    </span>
                  </div>
                </div>

                {/* 5-Step Visual Progress Timeline */}
                {ord.status !== ORDER_STATUSES.CANCELLED && (
                  <div className="pt-2 pb-1">
                    <div className="relative flex items-center justify-between">
                      <div className="absolute left-4 right-4 top-3 h-0.5 bg-slate-200 -z-0" />
                      <div
                        className="absolute left-4 top-3 h-0.5 bg-[#024AE5] -z-0 transition-all duration-500"
                        style={{
                          width: `${Math.max(0, ((currentStep - 1) / (steps.length - 1)) * 100)}%`,
                        }}
                      />

                      {steps.map((s) => {
                        const isCompleted = currentStep >= s.step;
                        const isCurrent = currentStep === s.step;

                        return (
                          <div key={s.step} className="flex flex-col items-center relative z-10">
                            <div
                              className={`h-6 w-6 rounded-full flex items-center justify-center text-[10px] font-bold border-2 transition-all ${
                                isCompleted
                                  ? "bg-[#024AE5] border-[#024AE5] text-white"
                                  : "bg-white border-slate-300 text-slate-400"
                              } ${isCurrent ? "ring-4 ring-blue-100" : ""}`}
                            >
                              {isCompleted ? <Check className="h-3 w-3" /> : s.step}
                            </div>
                            <span
                              className={`text-[11px] font-bold mt-1.5 ${
                                isCurrent
                                  ? "text-[#024AE5]"
                                  : isCompleted
                                  ? "text-slate-800"
                                  : "text-slate-400"
                              }`}
                            >
                              {s.label}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Live Carrier Tracking Box */}
                {(ord.courier_partner || ord.awb_number || ord.tracking_url) && (
                  <div className="bg-blue-50/70 border border-blue-200/80 rounded-xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="h-9 w-9 rounded-lg bg-blue-600 text-white flex items-center justify-center shrink-0">
                        <Truck className="h-5 w-5" />
                      </div>
                      <div className="space-y-0.5">
                        <div className="text-xs font-bold text-slate-900 flex items-center gap-2">
                          <span>Carrier: {ord.courier_partner || "Direct Dispatch"}</span>
                          {ord.dispatched_at && (
                            <span className="text-[10px] text-blue-700 bg-blue-100/80 px-1.5 py-0.2 rounded font-medium">
                              Dispatched {new Date(ord.dispatched_at).toLocaleDateString("en-IN", { month: "short", day: "numeric" })}
                            </span>
                          )}
                        </div>
                        {ord.awb_number && (
                          <div className="flex items-center gap-1.5 text-xs text-slate-700">
                            <span className="text-slate-500">AWB / Consignment:</span>
                            <span className="font-mono font-bold">{ord.awb_number}</span>
                            <button
                              onClick={() => copyToClipboard(ord.awb_number!)}
                              className="text-slate-400 hover:text-slate-700 p-0.5 rounded cursor-pointer"
                              title="Copy AWB #"
                            >
                              {copiedAwb === ord.awb_number ? (
                                <Check className="h-3 w-3 text-emerald-600" />
                              ) : (
                                <Copy className="h-3 w-3" />
                              )}
                            </button>
                          </div>
                        )}
                      </div>
                    </div>

                    {ord.tracking_url ? (
                      <a
                        href={ord.tracking_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center justify-center gap-1.5 bg-[#024AE5] hover:bg-[#024AE5]/90 text-white text-xs font-bold px-3.5 py-2 rounded-lg shadow-xs transition-colors shrink-0"
                      >
                        <span>Track Live Shipment</span>
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    ) : (
                      <span className="text-[11px] text-blue-700 font-semibold bg-white/70 px-2.5 py-1 rounded border border-blue-200 shrink-0">
                        In Transit
                      </span>
                    )}
                  </div>
                )}

                {/* Items Summary & Action Buttons */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between text-xs text-slate-500 pt-1 gap-2 border-t border-slate-100">
                  <div className="truncate max-w-md">
                    <span className="font-medium text-slate-800">
                      {itemsList[0]?.name || "Tooling Hardware"}
                    </span>
                    {itemsList.length > 1 && (
                      <span className="text-slate-400">
                        {" "}
                        +{itemsList.length - 1} more item(s) &bull; {totalQty} total units
                      </span>
                    )}
                  </div>

                  {ord.status === ORDER_STATUSES.DELIVERED ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setActiveOrderDetails(ord)}
                      className="text-[#024AE5] hover:text-[#024AE5]/80 hover:bg-blue-50 text-xs font-bold gap-1.5 h-8 px-2.5 cursor-pointer self-end sm:self-auto"
                    >
                      <Receipt className="h-3.5 w-3.5" />
                      <span>View Tax Invoice</span>
                    </Button>
                  ) : (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setActiveOrderDetails(ord)}
                      className="text-slate-700 hover:text-slate-900 hover:bg-slate-100 text-xs font-semibold gap-1.5 h-8 px-2.5 cursor-pointer self-end sm:self-auto"
                    >
                      <Eye className="h-3.5 w-3.5" />
                      <span>Order Details</span>
                    </Button>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Itemized Order Details & Invoice Dialog */}
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
                {activeOrderDetails.notes && (
                  <p className="mt-2 text-slate-600 italic bg-white p-2 rounded border border-slate-200">
                    {activeOrderDetails.notes}
                  </p>
                )}
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
