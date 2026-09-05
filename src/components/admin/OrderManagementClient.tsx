"use client";

import { useState, useMemo, useEffect } from "react";
import { Order, OrderItem } from "@/types/database.types";
import {
  ORDER_STATUSES,
  ORDER_STATUS_CONFIG,
  OrderStatus,
} from "@/lib/constants";
import { UpdateOrderTrackingModal } from "./UpdateOrderTrackingModal";
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
  Search,
  Truck,
  ExternalLink,
  Package,
  Clock,
  CheckCircle2,
  AlertCircle,
  Building2,
  Calendar,
  Filter,
  Eye,
  Edit,
  ArrowUpRight,
  TrendingUp,
  Boxes,
} from "lucide-react";
import { useRouter } from "next/navigation";

interface OrderManagementClientProps {
  initialOrders: Order[];
}

export function OrderManagementClient({ initialOrders }: OrderManagementClientProps) {
  const router = useRouter();
  const [orders, setOrders] = useState<Order[]>(initialOrders);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");

  useEffect(() => {
    setOrders(initialOrders);
  }, [initialOrders]);

  // Selected order for tracking update modal
  const [trackingModalOrder, setTrackingModalOrder] = useState<Order | null>(null);

  // Selected order for full line items view modal
  const [viewOrder, setViewOrder] = useState<Order | null>(null);

  const handleTrackingUpdateSuccess = (updatedFields: {
    status: OrderStatus;
    courier_partner?: string;
    awb_number?: string;
    tracking_url?: string;
    notes?: string;
  }) => {
    if (!trackingModalOrder) return;
    const targetId = trackingModalOrder.id;
    setOrders((prev) =>
      prev.map((ord) =>
        ord.id === targetId
          ? {
              ...ord,
              status: updatedFields.status,
              courier_partner: updatedFields.courier_partner !== undefined ? updatedFields.courier_partner : ord.courier_partner,
              awb_number: updatedFields.awb_number !== undefined ? updatedFields.awb_number : ord.awb_number,
              tracking_url: updatedFields.tracking_url !== undefined ? updatedFields.tracking_url : ord.tracking_url,
              notes: updatedFields.notes !== undefined ? updatedFields.notes : ord.notes,
              updated_at: new Date().toISOString(),
            }
          : ord
      )
    );
    setTrackingModalOrder(null);
    router.refresh();
  };

  // Filtered orders computation
  const filteredOrders = useMemo(() => {
    return orders.filter((ord) => {
      // Status filter
      if (statusFilter !== "ALL" && ord.status !== statusFilter) {
        return false;
      }

      // Search query
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchNumber = ord.order_number?.toLowerCase().includes(query);
        const matchCompany = ord.customer_details?.company_name?.toLowerCase().includes(query);
        const matchContact = ord.customer_details?.contact_name?.toLowerCase().includes(query);
        const matchAwb = ord.awb_number?.toLowerCase().includes(query);
        const matchCourier = ord.courier_partner?.toLowerCase().includes(query);
        const matchItems = Array.isArray(ord.items) && ord.items.some((i: OrderItem) =>
          i.sku?.toLowerCase().includes(query) || i.name?.toLowerCase().includes(query)
        );

        return matchNumber || matchCompany || matchContact || matchAwb || matchCourier || matchItems;
      }

      return true;
    });
  }, [orders, searchQuery, statusFilter]);

  // Metrics summary
  const metrics = useMemo(() => {
    const total = orders.length;
    const pending = orders.filter((o) => o.status === ORDER_STATUSES.PENDING).length;
    const confirmed = orders.filter((o) => o.status === ORDER_STATUSES.CONFIRMED).length;
    const processing = orders.filter((o) => o.status === ORDER_STATUSES.PROCESSING).length;
    const shipped = orders.filter((o) => o.status === ORDER_STATUSES.SHIPPED).length;
    const delivered = orders.filter((o) => o.status === ORDER_STATUSES.DELIVERED).length;
    const totalRevenue = orders
      .filter((o) => o.status !== ORDER_STATUSES.CANCELLED)
      .reduce((acc, o) => acc + (Number(o.total_amount) || 0), 0);

    return { total, pending, confirmed, processing, shipped, delivered, totalRevenue };
  }, [orders]);

  const handleRefresh = () => {
    router.refresh();
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            Order Fulfillment & Logistics
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Manage live purchase orders, update fulfillment stages, and attach carrier tracking numbers.
          </p>
        </div>
      </div>

      {/* KPI Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <Card className="p-3.5 bg-white border border-slate-200 shadow-none rounded-xl">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider">Total Orders</span>
            <Boxes className="h-4 w-4 text-[#024AE5]" />
          </div>
          <div className="text-xl font-bold text-slate-900">{metrics.total}</div>
        </Card>

        <Card className="p-3.5 bg-white border border-slate-200 shadow-none rounded-xl">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider">Pending Review</span>
            <Clock className="h-4 w-4 text-amber-500" />
          </div>
          <div className="text-xl font-bold text-amber-600">{metrics.pending}</div>
        </Card>

        <Card className="p-3.5 bg-white border border-slate-200 shadow-none rounded-xl">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider">Confirmed</span>
            <CheckCircle2 className="h-4 w-4 text-blue-500" />
          </div>
          <div className="text-xl font-bold text-blue-600">{metrics.confirmed}</div>
        </Card>

        <Card className="p-3.5 bg-white border border-slate-200 shadow-none rounded-xl">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider">Processing</span>
            <Package className="h-4 w-4 text-amber-500" />
          </div>
          <div className="text-xl font-bold text-slate-900">{metrics.processing}</div>
        </Card>

        <Card className="p-3.5 bg-white border border-slate-200 shadow-none rounded-xl">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider">In Transit</span>
            <Truck className="h-4 w-4 text-indigo-500" />
          </div>
          <div className="text-xl font-bold text-indigo-600">{metrics.shipped}</div>
        </Card>

        <Card className="p-3.5 bg-white border border-slate-200 shadow-none rounded-xl">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider">Total Value</span>
            <TrendingUp className="h-4 w-4 text-emerald-600" />
          </div>
          <div className="text-lg font-bold text-emerald-700 font-mono">
            ₹{metrics.totalRevenue.toLocaleString("en-IN")}
          </div>
        </Card>
      </div>

      {/* Filter and Search Bar */}
      <Card className="p-4 bg-white border border-slate-200 shadow-none rounded-xl space-y-3">
        <div className="flex flex-col sm:flex-row items-center gap-3">
          <div className="relative flex-1 w-full">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <Input
              type="text"
              placeholder="Search by Order #, Company Name, AWB #, SKU..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-9 text-xs border-slate-200 bg-slate-50/50 focus-visible:bg-white"
            />
          </div>

          <div className="flex items-center gap-1.5 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
            <Filter className="h-3.5 w-3.5 text-slate-400 shrink-0" />
            <span className="text-[11px] text-slate-400 font-bold uppercase shrink-0 mr-1">
              Status:
            </span>
            <button
              onClick={() => setStatusFilter("ALL")}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                statusFilter === "ALL"
                  ? "bg-[#024AE5] text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              All ({orders.length})
            </button>
            {Object.entries(ORDER_STATUSES).map(([key, val]) => (
              <button
                key={key}
                onClick={() => setStatusFilter(val)}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors capitalize ${
                  statusFilter === val
                    ? "bg-[#024AE5] text-white"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                {ORDER_STATUS_CONFIG[val]?.label || val}
              </button>
            ))}
          </div>
        </div>
      </Card>

      {/* Master Orders Table */}
      <div className="border border-slate-200 rounded-xl bg-white overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-slate-50/80">
              <TableRow className="border-b border-slate-200 text-xs">
                <TableHead className="font-bold text-slate-700 py-3">Order Number & Date</TableHead>
                <TableHead className="font-bold text-slate-700">Client Enterprise</TableHead>
                <TableHead className="font-bold text-slate-700">Items Summary</TableHead>
                <TableHead className="font-bold text-slate-700">Amount (₹)</TableHead>
                <TableHead className="font-bold text-slate-700">Status</TableHead>
                <TableHead className="font-bold text-slate-700">Carrier & Tracking</TableHead>
                <TableHead className="font-bold text-slate-700 text-right pr-4">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredOrders.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-48 text-center text-slate-500 text-xs">
                    <Boxes className="h-8 w-8 text-slate-300 mx-auto mb-2" />
                    No orders found matching your search and filter criteria.
                  </TableCell>
                </TableRow>
              ) : (
                filteredOrders.map((ord) => {
                  const statusCfg = ORDER_STATUS_CONFIG[ord.status] || {
                    label: ord.status,
                    badgeBg: "bg-slate-100",
                    badgeText: "text-slate-700",
                    border: "border-slate-200",
                  };
                  const itemsList = Array.isArray(ord.items) ? ord.items : [];
                  const totalUnits = itemsList.reduce((acc, i: any) => acc + (Number(i.quantity) || 0), 0);

                  return (
                    <TableRow key={ord.id} className="hover:bg-slate-50/60 border-b border-slate-100">
                      {/* Order Number & Date */}
                      <TableCell className="py-3.5">
                        <div className="font-mono font-bold text-xs text-[#024AE5]">
                          #{ord.order_number}
                        </div>
                        <div className="text-[11px] text-slate-400 mt-0.5">
                          {new Date(ord.created_at).toLocaleDateString("en-IN", {
                            day: "2-digit",
                            month: "short",
                            year: "numeric",
                          })}
                        </div>
                      </TableCell>

                      {/* Client Enterprise */}
                      <TableCell>
                        <div className="font-bold text-xs text-slate-800">
                          {ord.customer_details?.company_name || "Enterprise Account"}
                        </div>
                        <div className="text-[11px] text-slate-500 mt-0.5">
                          {ord.customer_details?.contact_name || ord.customer_details?.email}
                        </div>
                        {ord.customer_details?.gstin && (
                          <div className="text-[10px] font-mono text-slate-400">
                            GSTIN: {ord.customer_details.gstin}
                          </div>
                        )}
                      </TableCell>

                      {/* Items Summary */}
                      <TableCell>
                        <div className="text-xs text-slate-700 font-medium max-w-[200px] truncate">
                          {itemsList[0]?.name || "Industrial Hardware"}
                        </div>
                        <div className="text-[11px] text-slate-400 mt-0.5">
                          {itemsList.length > 1
                            ? `+${itemsList.length - 1} more items (${totalUnits} total units)`
                            : `${totalUnits} units`}
                        </div>
                      </TableCell>

                      {/* Amount */}
                      <TableCell>
                        <div className="font-mono font-bold text-xs text-slate-900">
                          ₹{Number(ord.total_amount).toLocaleString("en-IN")}
                        </div>
                        <div className="text-[10px] text-slate-400">
                          Incl. 18% GST
                        </div>
                      </TableCell>

                      {/* Status */}
                      <TableCell>
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold border ${statusCfg.badgeBg} ${statusCfg.badgeText} ${statusCfg.border}`}
                        >
                          {statusCfg.label}
                        </span>
                      </TableCell>

                      {/* Carrier & Tracking */}
                      <TableCell>
                        {ord.courier_partner || ord.awb_number ? (
                          <div className="space-y-0.5">
                            <div className="text-xs font-semibold text-slate-800 flex items-center gap-1">
                              <Truck className="h-3 w-3 text-indigo-500 shrink-0" />
                              <span>{ord.courier_partner || "Carrier Assigned"}</span>
                            </div>
                            {ord.awb_number && (
                              <div className="text-[11px] font-mono font-bold text-slate-600">
                                AWB: {ord.awb_number}
                              </div>
                            )}
                            {ord.tracking_url && (
                              <a
                                href={ord.tracking_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-[10px] text-[#024AE5] hover:underline flex items-center gap-0.5 font-bold"
                              >
                                <span>Track Live</span>
                                <ExternalLink className="h-2.5 w-2.5" />
                              </a>
                            )}
                          </div>
                        ) : (
                          <span className="text-[11px] text-slate-400 italic">Not dispatched</span>
                        )}
                      </TableCell>

                      {/* Actions */}
                      <TableCell className="text-right pr-4">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setViewOrder(ord)}
                            className="h-7 text-[11px] border-slate-200 px-2 gap-1 text-slate-700 shadow-none"
                            title="View Invoice & Line Items"
                          >
                            <Eye className="h-3 w-3" />
                            <span>Details</span>
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => setTrackingModalOrder(ord)}
                            className="h-7 text-[11px] bg-[#024AE5] hover:bg-[#024AE5]/90 text-white px-2.5 gap-1 shadow-none font-bold"
                          >
                            <Edit className="h-3 w-3" />
                            <span>Update</span>
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Tracking / Status Update Modal */}
      {trackingModalOrder && (
        <UpdateOrderTrackingModal
          isOpen={!!trackingModalOrder}
          onClose={() => setTrackingModalOrder(null)}
          order={trackingModalOrder}
          onSuccess={handleTrackingUpdateSuccess}
        />
      )}

      {/* Full Order Details Modal */}
      {viewOrder && (
        <Dialog open={!!viewOrder} onOpenChange={(open) => !open && setViewOrder(null)}>
          <DialogContent className="max-w-2xl bg-white p-6 rounded-2xl shadow-xl">
            <DialogHeader className="pb-3 border-b border-slate-200">
              <div className="flex items-center justify-between pr-8">
                <div className="flex items-center gap-2">
                  <Package className="h-5 w-5 text-[#024AE5]" />
                  <DialogTitle className="text-lg font-bold text-slate-900">
                    Order #{viewOrder.order_number}
                  </DialogTitle>
                </div>
                <span
                  className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-bold border ${
                    ORDER_STATUS_CONFIG[viewOrder.status]?.badgeBg
                  } ${ORDER_STATUS_CONFIG[viewOrder.status]?.badgeText} ${
                    ORDER_STATUS_CONFIG[viewOrder.status]?.border
                  }`}
                >
                  {ORDER_STATUS_CONFIG[viewOrder.status]?.label || viewOrder.status}
                </span>
              </div>
              <DialogDescription className="text-xs text-slate-500">
                Placed on{" "}
                {new Date(viewOrder.created_at).toLocaleString("en-IN", {
                  day: "2-digit",
                  month: "short",
                  year: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 pt-2">
              {/* Client & Shipping Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                <div>
                  <span className="text-slate-400 block text-[10px] font-bold uppercase">
                    Client Details
                  </span>
                  <div className="font-bold text-slate-900">
                    {viewOrder.customer_details?.company_name || "Enterprise Account"}
                  </div>
                  <div className="text-slate-600 mt-0.5">
                    {viewOrder.customer_details?.contact_name} ({viewOrder.customer_details?.mobile})
                  </div>
                  <div className="text-slate-500">{viewOrder.customer_details?.email}</div>
                  {viewOrder.customer_details?.gstin && (
                    <div className="font-mono text-[11px] text-slate-700 font-semibold mt-0.5">
                      GSTIN: {viewOrder.customer_details.gstin}
                    </div>
                  )}
                </div>

                <div>
                  <span className="text-slate-400 block text-[10px] font-bold uppercase">
                    Delivery Destination
                  </span>
                  <div className="text-slate-700 leading-relaxed font-medium">
                    {viewOrder.shipping_address}
                  </div>
                  {viewOrder.notes && (
                    <div className="mt-2 text-slate-600 italic bg-white p-1.5 rounded border border-slate-200 text-[11px]">
                      {viewOrder.notes}
                    </div>
                  )}
                </div>
              </div>

              {/* Line Items Table */}
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <Table>
                  <TableHeader className="bg-slate-50">
                    <TableRow className="text-xs">
                      <TableHead className="font-bold text-slate-700">SKU / Item</TableHead>
                      <TableHead className="font-bold text-slate-700 text-center">Qty</TableHead>
                      <TableHead className="font-bold text-slate-700 text-right">Unit Price</TableHead>
                      <TableHead className="font-bold text-slate-700 text-right">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {Array.isArray(viewOrder.items) &&
                      viewOrder.items.map((item: any, idx: number) => (
                        <TableRow key={idx} className="text-xs">
                          <TableCell className="py-2.5">
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

              {/* Invoicing Summary */}
              <div className="flex justify-end pt-2">
                <div className="w-64 space-y-1.5 text-xs">
                  <div className="flex justify-between text-slate-600">
                    <span>Subtotal</span>
                    <span className="font-mono">
                      ₹{Number(viewOrder.subtotal || viewOrder.total_amount * 0.847).toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>GST (18%)</span>
                    <span className="font-mono">
                      ₹{Number(viewOrder.gst_amount || viewOrder.total_amount * 0.153).toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm font-bold text-slate-900 pt-1.5 border-t border-slate-200">
                    <span>Total Amount</span>
                    <span className="font-mono text-[#024AE5]">
                      ₹{Number(viewOrder.total_amount).toFixed(2)}
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
