"use client";

import { useState, useMemo, useEffect } from "react";
import { Order, OrderItem } from "@/types/database.types";
import {
  ORDER_STATUSES,
  ORDER_STATUS_CONFIG,
  OrderStatus,
} from "@/lib/constants";
import { updateOrderStatus } from "@/actions/order";
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
  RotateCcw,
  Boxes,
  CheckCircle2,
  Clock,
  AlertCircle,
  Eye,
  ArrowRight,
  TrendingDown,
  Building2,
  PackageCheck,
  ShieldAlert,
} from "lucide-react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";

interface OrderReturnsManagementClientProps {
  initialOrders: Order[];
}

export function OrderReturnsManagementClient({
  initialOrders,
}: OrderReturnsManagementClientProps) {
  const router = useRouter();
  const [orders, setOrders] = useState<Order[]>(initialOrders);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<"ALL" | "PENDING_REQUESTS" | "RESTOCKED">("ALL");

  useEffect(() => {
    setOrders(initialOrders);
  }, [initialOrders]);

  // Selected order for view details modal
  const [viewOrder, setViewOrder] = useState<Order | null>(null);

  // Selected order for processing return
  const [processReturnOrder, setProcessReturnOrder] = useState<Order | null>(null);
  const [processReason, setProcessReason] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);

  // All returns & return requests
  const returnRelatedOrders = useMemo(() => {
    return orders.filter(
      (o) => o.status === ORDER_STATUSES.RETURNED || !!o.return_reason
    );
  }, [orders]);

  // Filtered orders computation
  const filteredOrders = useMemo(() => {
    return returnRelatedOrders.filter((ord) => {
      // Tab filter
      if (activeTab === "PENDING_REQUESTS") {
        if (ord.status === ORDER_STATUSES.RETURNED || !ord.return_reason) return false;
      } else if (activeTab === "RESTOCKED") {
        if (ord.status !== ORDER_STATUSES.RETURNED) return false;
      }

      // Search query
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchNumber = ord.order_number?.toLowerCase().includes(query);
        const matchCompany = ord.customer_details?.company_name?.toLowerCase().includes(query);
        const matchContact = ord.customer_details?.contact_name?.toLowerCase().includes(query);
        const matchReason = ord.return_reason?.toLowerCase().includes(query);
        const matchItems =
          Array.isArray(ord.items) &&
          ord.items.some(
            (i: OrderItem) =>
              i.sku?.toLowerCase().includes(query) || i.name?.toLowerCase().includes(query)
          );

        return matchNumber || matchCompany || matchContact || matchReason || matchItems;
      }

      return true;
    });
  }, [returnRelatedOrders, searchQuery, activeTab]);

  // Metrics
  const metrics = useMemo(() => {
    const completedReturns = returnRelatedOrders.filter(
      (o) => o.status === ORDER_STATUSES.RETURNED
    );
    const pendingRequests = returnRelatedOrders.filter(
      (o) => o.status !== ORDER_STATUSES.RETURNED && !!o.return_reason
    );
    const totalRestockedValue = completedReturns.reduce(
      (acc, o) => acc + (Number(o.total_amount) || 0),
      0
    );
    const totalUnitsRestocked = completedReturns.reduce((acc, o) => {
      const items = Array.isArray(o.items) ? o.items : [];
      return acc + items.reduce((sum, item: any) => sum + (Number(item.quantity) || 0), 0);
    }, 0);

    return {
      totalRecords: returnRelatedOrders.length,
      completedReturns: completedReturns.length,
      pendingRequests: pendingRequests.length,
      totalRestockedValue,
      totalUnitsRestocked,
    };
  }, [returnRelatedOrders]);

  const handleConfirmProcessReturn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!processReturnOrder) return;

    try {
      setIsProcessing(true);
      const res = await updateOrderStatus(processReturnOrder.id, ORDER_STATUSES.RETURNED, {
        return_reason: processReason.trim() || processReturnOrder.return_reason || "Customer return verified",
      });

      if (res.error) {
        toast.error(res.error);
      } else {
        toast.success(
          `Order #${processReturnOrder.order_number} marked as Returned. Warehouse inventory has been restocked.`
        );
        setOrders((prev) =>
          prev.map((ord) =>
            ord.id === processReturnOrder.id
              ? {
                  ...ord,
                  status: ORDER_STATUSES.RETURNED,
                  return_reason: processReason.trim() || processReturnOrder.return_reason,
                  returned_at: new Date().toISOString(),
                }
              : ord
          )
        );
        setProcessReturnOrder(null);
        setProcessReason("");
        router.refresh();
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to process return.");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            Order Returns & Reverse Logistics (RMA)
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Review client return requests, inspect defective consignments, verify stock restock to inventory, and manage reverse pickups.
          </p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="p-3.5 bg-white border border-slate-200 shadow-none rounded-xl">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider">
              Total Returns
            </span>
            <RotateCcw className="h-4 w-4 text-purple-600" />
          </div>
          <div className="text-xl font-bold text-slate-900">{metrics.completedReturns}</div>
        </Card>

        <Card className="p-3.5 bg-white border border-slate-200 shadow-none rounded-xl">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider">
              Pending Requests
            </span>
            <Clock className="h-4 w-4 text-amber-500" />
          </div>
          <div className="text-xl font-bold text-amber-600">{metrics.pendingRequests}</div>
        </Card>

        <Card className="p-3.5 bg-white border border-slate-200 shadow-none rounded-xl">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider">
              Restocked Units
            </span>
            <Boxes className="h-4 w-4 text-blue-600" />
          </div>
          <div className="text-xl font-bold text-blue-600">{metrics.totalUnitsRestocked} units</div>
        </Card>

        <Card className="p-3.5 bg-white border border-slate-200 shadow-none rounded-xl">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider">
              Restocked Value
            </span>
            <TrendingDown className="h-4 w-4 text-purple-600" />
          </div>
          <div className="text-lg font-bold text-purple-700 font-mono">
            ₹{metrics.totalRestockedValue.toLocaleString("en-IN")}
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
              placeholder="Search by Order #, Client, Return Reason, SKU..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-9 text-xs border-slate-200 bg-slate-50/50 focus-visible:bg-white"
            />
          </div>

          <div className="flex items-center gap-1.5 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
            <button
              onClick={() => setActiveTab("ALL")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                activeTab === "ALL"
                  ? "bg-[#024AE5] text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              All Records ({returnRelatedOrders.length})
            </button>
            <button
              onClick={() => setActiveTab("PENDING_REQUESTS")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                activeTab === "PENDING_REQUESTS"
                  ? "bg-amber-600 text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              Pending Requests ({metrics.pendingRequests})
            </button>
            <button
              onClick={() => setActiveTab("RESTOCKED")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                activeTab === "RESTOCKED"
                  ? "bg-purple-600 text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              Restocked & Completed ({metrics.completedReturns})
            </button>
          </div>
        </div>
      </Card>

      {/* Returns Table */}
      <div className="border border-slate-200 rounded-xl bg-white overflow-hidden">
        <div className="overflow-x-auto [scrollbar-width:thin]">
          <Table className="min-w-[900px]">
            <TableHeader className="bg-slate-50/80">
              <TableRow className="border-b border-slate-200 text-xs">
                <TableHead className="font-bold text-slate-700 py-3">Order Number</TableHead>
                <TableHead className="font-bold text-slate-700">Client Enterprise</TableHead>
                <TableHead className="font-bold text-slate-700">Items / Qty</TableHead>
                <TableHead className="font-bold text-slate-700">Return Reason / RMA Note</TableHead>
                <TableHead className="font-bold text-slate-700">Status</TableHead>
                <TableHead className="font-bold text-slate-700">Processed At</TableHead>
                <TableHead className="font-bold text-slate-700 text-right pr-4">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredOrders.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-48 text-center text-slate-500 text-xs">
                    <RotateCcw className="h-8 w-8 text-slate-300 mx-auto mb-2" />
                    {returnRelatedOrders.length === 0
                      ? "No order return requests or returned orders recorded yet."
                      : "No matching returns found for your filter criteria."}
                  </TableCell>
                </TableRow>
              ) : (
                filteredOrders.map((ord) => {
                  const isReturned = ord.status === ORDER_STATUSES.RETURNED;
                  const isPendingRequest = !isReturned && !!ord.return_reason;
                  const itemsList = Array.isArray(ord.items) ? ord.items : [];
                  const totalUnits = itemsList.reduce(
                    (acc, i: any) => acc + (Number(i.quantity) || 0),
                    0
                  );

                  return (
                    <TableRow key={ord.id} className="hover:bg-slate-50/60 border-b border-slate-100">
                      {/* Order Number */}
                      <TableCell className="py-3.5">
                        <div className="font-mono font-bold text-xs text-[#024AE5]">
                          #{ord.order_number}
                        </div>
                        <div className="text-[11px] text-slate-400 mt-0.5">
                          Ordered{" "}
                          {new Date(ord.created_at).toLocaleDateString("en-IN", {
                            day: "2-digit",
                            month: "short",
                            year: "numeric",
                          })}
                        </div>
                      </TableCell>

                      {/* Client */}
                      <TableCell>
                        <div className="font-bold text-xs text-slate-800">
                          {ord.customer_details?.company_name || "Enterprise Account"}
                        </div>
                        <div className="text-[11px] text-slate-500 mt-0.5">
                          {ord.customer_details?.contact_name || ord.customer_details?.email}
                        </div>
                        {ord.customer_details?.mobile && (
                          <div className="text-[10px] text-slate-400">
                            Ph: {ord.customer_details.mobile}
                          </div>
                        )}
                      </TableCell>

                      {/* Items */}
                      <TableCell>
                        <div className="text-xs text-slate-700 font-medium max-w-[200px] truncate">
                          {itemsList[0]?.name || "Industrial Hardware"}
                        </div>
                        <div className="text-[11px] text-slate-400 mt-0.5">
                          {itemsList.length > 1
                            ? `+${itemsList.length - 1} more items (${totalUnits} total units)`
                            : `${totalUnits} units`}
                        </div>
                        <div className="text-xs font-mono font-bold text-slate-900 mt-0.5">
                          ₹{Number(ord.total_amount).toLocaleString("en-IN")}
                        </div>
                      </TableCell>

                      {/* Return Reason */}
                      <TableCell className="max-w-[250px]">
                        {ord.return_reason ? (
                          <div className="text-xs text-slate-700 bg-slate-50 p-2 rounded-lg border border-slate-200">
                            <p className="line-clamp-2" title={ord.return_reason}>
                              {ord.return_reason}
                            </p>
                          </div>
                        ) : (
                          <span className="text-xs text-slate-400 italic">No notes logged</span>
                        )}
                      </TableCell>

                      {/* Status Badge */}
                      <TableCell>
                        {isReturned ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs font-bold bg-purple-50 text-purple-700 border border-purple-200">
                            <CheckCircle2 className="h-3 w-3 text-purple-600" />
                            <span>Restocked to Warehouse</span>
                          </span>
                        ) : isPendingRequest ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200">
                            <AlertCircle className="h-3 w-3 text-amber-600" />
                            <span>Action Needed</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-slate-100 text-slate-700 border border-slate-200">
                            {ORDER_STATUS_CONFIG[ord.status]?.label || ord.status}
                          </span>
                        )}
                      </TableCell>

                      {/* Processed At */}
                      <TableCell>
                        {ord.returned_at ? (
                          <div className="text-xs text-slate-700">
                            <div className="font-semibold text-slate-900">
                              {new Date(ord.returned_at).toLocaleDateString("en-IN", {
                                day: "2-digit",
                                month: "short",
                                year: "numeric",
                              })}
                            </div>
                            <div className="text-[10px] text-slate-400">
                              {new Date(ord.returned_at).toLocaleTimeString("en-IN", {
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </div>
                          </div>
                        ) : (
                          <span className="text-[11px] text-amber-600 font-medium">Pending action</span>
                        )}
                      </TableCell>

                      {/* Actions */}
                      <TableCell className="text-right pr-4">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setViewOrder(ord)}
                            className="h-7 text-[11px] border-slate-200 px-2 gap-1 text-slate-700 shadow-none cursor-pointer"
                            title="View Consignment Details"
                          >
                            <Eye className="h-3 w-3" />
                            <span>Details</span>
                          </Button>

                          {!isReturned && (
                            <Button
                              size="sm"
                              onClick={() => {
                                setProcessReturnOrder(ord);
                                setProcessReason(ord.return_reason || "");
                              }}
                              className="h-7 text-[11px] bg-purple-600 hover:bg-purple-700 text-white px-2.5 gap-1 shadow-none font-bold cursor-pointer"
                            >
                              <RotateCcw className="h-3 w-3" />
                              <span>Process Return</span>
                            </Button>
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

      {/* Process Return Modal */}
      {processReturnOrder && (
        <Dialog
          open={!!processReturnOrder}
          onOpenChange={(open) => !open && setProcessReturnOrder(null)}
        >
          <DialogContent className="max-w-md bg-white p-5 rounded-xl shadow-xl">
            <DialogHeader className="pb-2 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <RotateCcw className="h-5 w-5 text-purple-600 shrink-0" />
                <DialogTitle className="text-base font-bold text-slate-900">
                  Process Return & Restock Inventory
                </DialogTitle>
              </div>
              <DialogDescription className="text-xs text-slate-500">
                Processing this return will automatically add the items back into active product inventory and log an audit entry in the inventory ledger.
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleConfirmProcessReturn} className="space-y-4 pt-2">
              <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 text-xs space-y-1">
                <div className="flex justify-between">
                  <span className="text-slate-500">Order:</span>
                  <span className="font-mono font-bold text-[#024AE5]">
                    #{processReturnOrder.order_number}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Client:</span>
                  <span className="font-semibold text-slate-800">
                    {processReturnOrder.customer_details?.company_name || "Enterprise"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Items to Restock:</span>
                  <span className="font-semibold text-slate-800">
                    {Array.isArray(processReturnOrder.items)
                      ? processReturnOrder.items.reduce((s, i: any) => s + (Number(i.quantity) || 0), 0)
                      : 0}{" "}
                    units
                  </span>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700">
                  Verified Return Reason / Inspection Notes
                </label>
                <textarea
                  rows={3}
                  value={processReason}
                  onChange={(e) => setProcessReason(e.target.value)}
                  placeholder="e.g. Received back at MIDC warehouse. Inspected and verified intact. Restocked to shelf A-12."
                  className="w-full text-xs p-2.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-600"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setProcessReturnOrder(null)}
                  className="text-xs text-slate-600 h-8"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={isProcessing}
                  className="bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold h-8 px-4"
                >
                  {isProcessing ? "Restocking..." : "Confirm Return & Restock Stock"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      )}

      {/* View Order Dialog */}
      {viewOrder && (
        <Dialog open={!!viewOrder} onOpenChange={(open) => !open && setViewOrder(null)}>
          <DialogContent className="max-w-xl bg-white p-5 rounded-xl shadow-xl">
            <DialogHeader className="pb-2 border-b border-slate-200">
              <div className="flex items-center justify-between pr-6">
                <DialogTitle className="text-base font-bold text-slate-900">
                  Return Order Details #{viewOrder.order_number}
                </DialogTitle>
                <span className="text-xs font-bold text-purple-700 bg-purple-50 px-2 py-0.5 rounded border border-purple-200">
                  {ORDER_STATUS_CONFIG[viewOrder.status]?.label || viewOrder.status}
                </span>
              </div>
              <DialogDescription className="text-xs text-slate-500">
                Order date: {new Date(viewOrder.created_at).toLocaleDateString("en-IN")}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3 pt-2 text-xs">
              {viewOrder.return_reason && (
                <div className="bg-purple-50 border border-purple-200 p-3 rounded-xl text-purple-900">
                  <span className="font-bold block text-[11px] uppercase tracking-wider text-purple-800">
                    Return Reason & Inspection Notes
                  </span>
                  <p className="mt-1 font-medium">{viewOrder.return_reason}</p>
                </div>
              )}

              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                <div className="font-bold text-slate-900">
                  {viewOrder.customer_details?.company_name}
                </div>
                <div className="text-slate-600">{viewOrder.shipping_address}</div>
              </div>

              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <Table>
                  <TableHeader className="bg-slate-50">
                    <TableRow className="text-xs">
                      <TableHead className="font-bold text-slate-700">SKU / Item</TableHead>
                      <TableHead className="font-bold text-slate-700 text-center">Qty</TableHead>
                      <TableHead className="font-bold text-slate-700 text-right">Price</TableHead>
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
                            ₹{(Number(it.unit_price) * Number(it.quantity)).toFixed(2)}
                          </TableCell>
                        </TableRow>
                      ))}
                  </TableBody>
                </Table>
              </div>

              <div className="flex justify-between items-center pt-2 border-t border-slate-100">
                <span className="font-bold text-slate-900 text-sm">
                  Total Order Value: ₹{Number(viewOrder.total_amount).toFixed(2)}
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
