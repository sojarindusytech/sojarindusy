"use client";

import { useState, useMemo, useEffect } from "react";
import { Order, OrderItem } from "@/types/database.types";
import {
  ORDER_STATUSES,
  ORDER_STATUS_CONFIG,
  OrderStatus,
  COURIER_PARTNERS,
} from "@/lib/constants";
import { updateOrderStatus } from "@/actions/order";
import { UpdateOrderTrackingModal } from "./UpdateOrderTrackingModal";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  Package,
  CheckCircle2,
  Clock,
  ExternalLink,
  Copy,
  Check,
  Eye,
  Receipt,
  MapPin,
  Calendar,
  Send,
  Boxes,
} from "lucide-react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";

interface DispatchManagementClientProps {
  initialOrders: Order[];
}

export function DispatchManagementClient({
  initialOrders,
}: DispatchManagementClientProps) {
  const router = useRouter();
  const [orders, setOrders] = useState<Order[]>(initialOrders);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<"ALL" | "READY" | "IN_TRANSIT" | "DELIVERED">("READY");
  const [copiedAwb, setCopiedAwb] = useState<string | null>(null);

  useEffect(() => {
    setOrders(initialOrders);
  }, [initialOrders]);

  // Selected order for dispatch / tracking modal
  const [trackingModalOrder, setTrackingModalOrder] = useState<Order | null>(null);

  // Selected order for full view modal
  const [viewOrder, setViewOrder] = useState<Order | null>(null);

  // Direct quick delivery confirmation
  const [deliveringOrder, setDeliveringOrder] = useState<Order | null>(null);
  const [isMarkingDelivered, setIsMarkingDelivered] = useState(false);

  const copyToClipboard = (text: string, label = "AWB / LR") => {
    navigator.clipboard.writeText(text);
    setCopiedAwb(text);
    toast.success(`${label} copied to clipboard!`);
    setTimeout(() => setCopiedAwb(null), 2500);
  };

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
              dispatched_at: updatedFields.status === ORDER_STATUSES.SHIPPED ? (ord.dispatched_at || new Date().toISOString()) : ord.dispatched_at,
              delivered_at: updatedFields.status === ORDER_STATUSES.DELIVERED ? (ord.delivered_at || new Date().toISOString()) : ord.delivered_at,
              updated_at: new Date().toISOString(),
            }
          : ord
      )
    );
    setTrackingModalOrder(null);
    router.refresh();
  };

  const handleQuickMarkDelivered = async () => {
    if (!deliveringOrder) return;
    try {
      setIsMarkingDelivered(true);
      const res = await updateOrderStatus(deliveringOrder.id, ORDER_STATUSES.DELIVERED);
      if (res.error) {
        toast.error(res.error);
      } else {
        toast.success(
          `Order #${deliveringOrder.order_number} marked Delivered. GST Tax Invoice generated!`
        );
        setOrders((prev) =>
          prev.map((ord) =>
            ord.id === deliveringOrder.id
              ? {
                  ...ord,
                  status: ORDER_STATUSES.DELIVERED,
                  delivered_at: new Date().toISOString(),
                  invoice_number: ord.invoice_number || ord.order_number.replace("ORD-", "INV-"),
                }
              : ord
          )
        );
        setDeliveringOrder(null);
        router.refresh();
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to mark delivered.");
    } finally {
      setIsMarkingDelivered(false);
    }
  };

  // Filtered orders
  const filteredOrders = useMemo(() => {
    return orders.filter((ord) => {
      // Exclude cancelled and returned from dispatch workflow
      if (ord.status === ORDER_STATUSES.CANCELLED || ord.status === ORDER_STATUSES.RETURNED) {
        return false;
      }

      // Tab filter
      if (activeTab === "READY") {
        const isReady =
          ord.status === ORDER_STATUSES.PENDING ||
          ord.status === ORDER_STATUSES.CONFIRMED ||
          ord.status === ORDER_STATUSES.PROCESSING;
        if (!isReady) return false;
      } else if (activeTab === "IN_TRANSIT") {
        if (ord.status !== ORDER_STATUSES.SHIPPED) return false;
      } else if (activeTab === "DELIVERED") {
        if (ord.status !== ORDER_STATUSES.DELIVERED) return false;
      }

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchNum = ord.order_number?.toLowerCase().includes(q);
        const matchComp = ord.customer_details?.company_name?.toLowerCase().includes(q);
        const matchContact = ord.customer_details?.contact_name?.toLowerCase().includes(q);
        const matchAwb = ord.awb_number?.toLowerCase().includes(q);
        const matchTransporter = ord.courier_partner?.toLowerCase().includes(q);
        const matchAddress = ord.shipping_address?.toLowerCase().includes(q);
        const matchItems =
          Array.isArray(ord.items) &&
          ord.items.some(
            (i: OrderItem) =>
              i.sku?.toLowerCase().includes(q) || i.name?.toLowerCase().includes(q)
          );

        return (
          matchNum ||
          matchComp ||
          matchContact ||
          matchAwb ||
          matchTransporter ||
          matchAddress ||
          matchItems
        );
      }

      return true;
    });
  }, [orders, searchQuery, activeTab]);

  // Metrics
  const metrics = useMemo(() => {
    const ready = orders.filter(
      (o) =>
        o.status === ORDER_STATUSES.PENDING ||
        o.status === ORDER_STATUSES.CONFIRMED ||
        o.status === ORDER_STATUSES.PROCESSING
    ).length;
    const inTransit = orders.filter((o) => o.status === ORDER_STATUSES.SHIPPED).length;
    const delivered = orders.filter((o) => o.status === ORDER_STATUSES.DELIVERED).length;
    const totalActive = ready + inTransit;

    return { ready, inTransit, delivered, totalActive };
  }, [orders]);

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            Dispatch & Logistics Fulfillment
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Coordinate manual transport & courier consignments, record LR/AWB numbers, and monitor live delivery milestones.
          </p>
        </div>
      </div>

      {/* KPI Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="p-3.5 bg-white border border-slate-200 shadow-none rounded-xl">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider">
              Ready to Dispatch
            </span>
            <Package className="h-4 w-4 text-amber-500" />
          </div>
          <div className="text-xl font-bold text-amber-600">{metrics.ready}</div>
        </Card>

        <Card className="p-3.5 bg-white border border-slate-200 shadow-none rounded-xl">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider">
              In Transit
            </span>
            <Truck className="h-4 w-4 text-indigo-500" />
          </div>
          <div className="text-xl font-bold text-indigo-600">{metrics.inTransit}</div>
        </Card>

        <Card className="p-3.5 bg-white border border-slate-200 shadow-none rounded-xl">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider">
              Delivered
            </span>
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          </div>
          <div className="text-xl font-bold text-emerald-600">{metrics.delivered}</div>
        </Card>

        <Card className="p-3.5 bg-white border border-slate-200 shadow-none rounded-xl">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider">
              Active Pipeline
            </span>
            <Boxes className="h-4 w-4 text-[#024AE5]" />
          </div>
          <div className="text-xl font-bold text-[#024AE5]">{metrics.totalActive} orders</div>
        </Card>
      </div>

      {/* Search & Tabs Toolbar */}
      <Card className="p-4 bg-white border border-slate-200 shadow-none rounded-xl space-y-3">
        <div className="flex flex-col sm:flex-row items-center gap-3">
          <div className="relative flex-1 w-full">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <Input
              type="text"
              placeholder="Search by Order #, Client, Transporter, LR/AWB, City..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-9 text-xs border-slate-200 bg-slate-50/50 focus-visible:bg-white"
            />
          </div>

          <div className="flex items-center gap-1.5 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
            <button
              onClick={() => setActiveTab("READY")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                activeTab === "READY"
                  ? "bg-amber-600 text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              Ready to Dispatch ({metrics.ready})
            </button>
            <button
              onClick={() => setActiveTab("IN_TRANSIT")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                activeTab === "IN_TRANSIT"
                  ? "bg-indigo-600 text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              In Transit ({metrics.inTransit})
            </button>
            <button
              onClick={() => setActiveTab("DELIVERED")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                activeTab === "DELIVERED"
                  ? "bg-emerald-600 text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              Delivered ({metrics.delivered})
            </button>
            <button
              onClick={() => setActiveTab("ALL")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                activeTab === "ALL"
                  ? "bg-[#024AE5] text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              All
            </button>
          </div>
        </div>
      </Card>

      {/* Consignments Table */}
      <div className="border border-slate-200 rounded-xl bg-white overflow-hidden">
        <div className="overflow-x-auto [scrollbar-width:thin]">
          <Table className="min-w-[950px]">
            <TableHeader className="bg-slate-50/80">
              <TableRow className="border-b border-slate-200 text-xs">
                <TableHead className="font-bold text-slate-700 py-3">Order & Date</TableHead>
                <TableHead className="font-bold text-slate-700">Client & Destination</TableHead>
                <TableHead className="font-bold text-slate-700">Consignment Items</TableHead>
                <TableHead className="font-bold text-slate-700">Transporter / Method</TableHead>
                <TableHead className="font-bold text-slate-700">LR / AWB #</TableHead>
                <TableHead className="font-bold text-slate-700">Fulfillment Status</TableHead>
                <TableHead className="font-bold text-slate-700 text-right pr-4">Quick Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredOrders.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-48 text-center text-slate-500 text-xs">
                    <Truck className="h-8 w-8 text-slate-300 mx-auto mb-2" />
                    No consignments found for the selected tab or search query.
                  </TableCell>
                </TableRow>
              ) : (
                filteredOrders.map((ord) => {
                  const itemsList = Array.isArray(ord.items) ? ord.items : [];
                  const totalUnits = itemsList.reduce(
                    (acc, i: any) => acc + (Number(i.quantity) || 0),
                    0
                  );
                  const isReady =
                    ord.status === ORDER_STATUSES.PENDING ||
                    ord.status === ORDER_STATUSES.CONFIRMED ||
                    ord.status === ORDER_STATUSES.PROCESSING;
                  const isInTransit = ord.status === ORDER_STATUSES.SHIPPED;
                  const isDelivered = ord.status === ORDER_STATUSES.DELIVERED;
                  const statusCfg = ORDER_STATUS_CONFIG[ord.status] || {
                    label: ord.status,
                    badgeBg: "bg-slate-100",
                    badgeText: "text-slate-700",
                    border: "border-slate-200",
                  };

                  return (
                    <TableRow key={ord.id} className="hover:bg-slate-50/60 border-b border-slate-100">
                      {/* Order & Date */}
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

                      {/* Client & Destination */}
                      <TableCell className="max-w-[200px]">
                        <div className="font-bold text-xs text-slate-800 truncate">
                          {ord.customer_details?.company_name || "Enterprise"}
                        </div>
                        <div className="text-[11px] text-slate-500 truncate mt-0.5">
                          {ord.customer_details?.contact_name || ord.customer_details?.email}
                        </div>
                        <div className="text-[10px] text-slate-400 truncate mt-0.5 flex items-center gap-1">
                          <MapPin className="h-2.5 w-2.5 shrink-0" />
                          <span className="truncate">{ord.shipping_address}</span>
                        </div>
                      </TableCell>

                      {/* Consignment Items */}
                      <TableCell>
                        <div className="text-xs text-slate-700 font-medium max-w-[180px] truncate">
                          {itemsList[0]?.name || "Industrial Hardware"}
                        </div>
                        <div className="text-[11px] text-slate-400 mt-0.5">
                          {itemsList.length > 1
                            ? `+${itemsList.length - 1} more items (${totalUnits} units)`
                            : `${totalUnits} total units`}
                        </div>
                      </TableCell>

                      {/* Transporter / Method */}
                      <TableCell>
                        {ord.courier_partner ? (
                          <div className="space-y-0.5">
                            <span className="text-xs font-semibold text-slate-800">
                              {ord.courier_partner}
                            </span>
                            {ord.dispatched_at && (
                              <div className="text-[10px] text-slate-400">
                                Dispatched {new Date(ord.dispatched_at).toLocaleDateString("en-IN", { month: "short", day: "numeric" })}
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-slate-400 italic">Unassigned</span>
                        )}
                      </TableCell>

                      {/* LR / AWB # */}
                      <TableCell>
                        {ord.awb_number ? (
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-1">
                              <span className="font-mono text-xs font-bold text-slate-700">
                                {ord.awb_number}
                              </span>
                              <button
                                onClick={() => copyToClipboard(ord.awb_number!)}
                                className="text-slate-400 hover:text-slate-700 p-0.5"
                                title="Copy AWB #"
                              >
                                {copiedAwb === ord.awb_number ? (
                                  <Check className="h-3 w-3 text-emerald-600" />
                                ) : (
                                  <Copy className="h-3 w-3" />
                                )}
                              </button>
                            </div>
                            {ord.tracking_url && (
                              <a
                                href={ord.tracking_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-[10px] text-[#024AE5] hover:underline flex items-center gap-0.5 font-bold"
                              >
                                <span>Track</span>
                                <ExternalLink className="h-2.5 w-2.5" />
                              </a>
                            )}
                          </div>
                        ) : (
                          <span className="text-[11px] text-slate-400 italic">-</span>
                        )}
                      </TableCell>

                      {/* Fulfillment Status */}
                      <TableCell>
                        <div className="space-y-1">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold border ${statusCfg.badgeBg} ${statusCfg.badgeText} ${statusCfg.border}`}
                          >
                            {statusCfg.label}
                          </span>
                          {ord.delivered_at && (
                            <div className="text-[10px] text-emerald-700 font-medium">
                              Delivered {new Date(ord.delivered_at).toLocaleDateString("en-IN", { month: "short", day: "numeric" })}
                            </div>
                          )}
                        </div>
                      </TableCell>

                      {/* Quick Actions */}
                      <TableCell className="text-right pr-4">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setViewOrder(ord)}
                            className="h-7 text-[11px] border-slate-200 px-2 gap-1 text-slate-700 shadow-none cursor-pointer"
                          >
                            <Eye className="h-3 w-3" />
                            <span>Details</span>
                          </Button>

                          {isReady && (
                            <Button
                              size="sm"
                              onClick={() => setTrackingModalOrder(ord)}
                              className="h-7 text-[11px] bg-[#024AE5] hover:bg-[#024AE5]/90 text-white px-2.5 gap-1 shadow-none font-bold cursor-pointer"
                            >
                              <Send className="h-3 w-3" />
                              <span>Dispatch</span>
                            </Button>
                          )}

                          {isInTransit && (
                            <>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setTrackingModalOrder(ord)}
                                className="h-7 text-[11px] border-slate-200 px-2 gap-1 text-slate-700 shadow-none cursor-pointer"
                              >
                                <Truck className="h-3 w-3" />
                                <span>Tracking</span>
                              </Button>
                              <Button
                                size="sm"
                                onClick={() => setDeliveringOrder(ord)}
                                className="h-7 text-[11px] bg-emerald-600 hover:bg-emerald-700 text-white px-2.5 gap-1 shadow-none font-bold cursor-pointer"
                              >
                                <CheckCircle2 className="h-3 w-3" />
                                <span>Mark Delivered</span>
                              </Button>
                            </>
                          )}

                          {isDelivered && (
                            <span className="text-[10px] text-emerald-700 font-bold bg-emerald-50 px-2 py-1 rounded border border-emerald-200">
                              Fulfilled
                            </span>
                          )}
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

      {/* Tracking / Dispatch Modal */}
      {trackingModalOrder && (
        <UpdateOrderTrackingModal
          isOpen={!!trackingModalOrder}
          onClose={() => setTrackingModalOrder(null)}
          order={trackingModalOrder}
          onSuccess={handleTrackingUpdateSuccess}
        />
      )}

      {/* Confirm Delivery Dialog */}
      {deliveringOrder && (
        <Dialog open={!!deliveringOrder} onOpenChange={(open) => !open && setDeliveringOrder(null)}>
          <DialogContent className="max-w-md bg-white p-5 rounded-xl shadow-xl">
            <DialogHeader className="pb-2 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                <DialogTitle className="text-base font-bold text-slate-900">
                  Confirm Consignment Delivery
                </DialogTitle>
              </div>
              <DialogDescription className="text-xs text-slate-500">
                Are you sure you want to mark Order #{deliveringOrder.order_number} as delivered?
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3 pt-2 text-xs">
              <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 space-y-1">
                <div className="flex justify-between">
                  <span className="text-slate-500">Recipient:</span>
                  <span className="font-semibold text-slate-800">
                    {deliveringOrder.customer_details?.company_name}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Address:</span>
                  <span className="text-slate-700 font-medium truncate max-w-[220px]">
                    {deliveringOrder.shipping_address}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Carrier:</span>
                  <span className="font-medium text-slate-800">
                    {deliveringOrder.courier_partner || "Direct Dispatch"}
                  </span>
                </div>
              </div>

              <div className="bg-emerald-50 border border-emerald-200 p-2.5 rounded-lg text-emerald-900 text-xs">
                An official GST Tax Invoice will be generated automatically and made available to the client immediately.
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setDeliveringOrder(null)}
                  className="text-xs text-slate-600 h-8 cursor-pointer"
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  size="sm"
                  disabled={isMarkingDelivered}
                  onClick={handleQuickMarkDelivered}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold h-8 px-4 cursor-pointer"
                >
                  {isMarkingDelivered ? "Confirming..." : "Confirm Delivery"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* View Consignment Details Modal */}
      {viewOrder && (
        <Dialog open={!!viewOrder} onOpenChange={(open) => !open && setViewOrder(null)}>
          <DialogContent className="max-w-xl bg-white p-5 rounded-xl shadow-xl">
            <DialogHeader className="pb-2 border-b border-slate-200">
              <div className="flex items-center justify-between pr-6">
                <DialogTitle className="text-base font-bold text-slate-900">
                  Consignment #{viewOrder.order_number}
                </DialogTitle>
                <span className="text-xs font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                  {ORDER_STATUS_CONFIG[viewOrder.status]?.label || viewOrder.status}
                </span>
              </div>
              <DialogDescription className="text-xs text-slate-500">
                Destination: {viewOrder.shipping_address}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3 pt-2 text-xs">
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 grid grid-cols-2 gap-2">
                <div>
                  <span className="text-slate-400 block text-[10px] font-bold uppercase">Transporter</span>
                  <div className="font-bold text-slate-900 mt-0.5">
                    {viewOrder.courier_partner || "Manual Transport / Not Assigned"}
                  </div>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] font-bold uppercase">AWB / LR Number</span>
                  <div className="font-mono font-bold text-slate-900 mt-0.5">
                    {viewOrder.awb_number || "None"}
                  </div>
                </div>
              </div>

              {viewOrder.notes && (
                <div className="bg-white p-2.5 rounded-lg border border-slate-200 italic text-slate-600">
                  {viewOrder.notes}
                </div>
              )}

              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <Table>
                  <TableHeader className="bg-slate-50">
                    <TableRow className="text-xs">
                      <TableHead className="font-bold text-slate-700">SKU / Item</TableHead>
                      <TableHead className="font-bold text-slate-700 text-center">Qty</TableHead>
                      <TableHead className="font-bold text-slate-700 text-right">Unit Price</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {Array.isArray(viewOrder.items) &&
                      viewOrder.items.map((it: any, idx: number) => (
                        <TableRow key={idx} className="text-xs">
                          <TableCell className="font-bold text-slate-800">
                            {it.name} <span className="font-mono text-blue-600">({it.sku})</span>
                          </TableCell>
                          <TableCell className="text-center font-bold">{it.quantity}</TableCell>
                          <TableCell className="text-right font-mono font-bold">
                            ₹{Number(it.unit_price).toFixed(2)}
                          </TableCell>
                        </TableRow>
                      ))}
                  </TableBody>
                </Table>
              </div>

              <div className="flex justify-between items-center pt-2 border-t border-slate-100">
                <span className="font-bold text-slate-900 text-sm">
                  Invoice Total: ₹{Number(viewOrder.total_amount).toFixed(2)}
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setViewOrder(null)}
                  className="h-8 text-xs border-slate-200"
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
