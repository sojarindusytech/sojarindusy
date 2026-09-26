"use client";

import { useState, useMemo } from "react";
import { PurchaseOrder, PurchaseOrderStatus } from "@/types/database.types";
import { updatePurchaseOrderStatus } from "@/actions/purchase-order";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
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
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Truck,
  Package,
  Clock,
  CheckCircle2,
  Search,
  Calendar,
  AlertCircle,
  Loader2,
  ArrowRight,
  ShieldCheck,
  RefreshCw,
} from "lucide-react";
import { cn } from "@/lib/utils";
import toast from "react-hot-toast";

interface AdminPurchaseOrdersClientProps {
  initialOrders: PurchaseOrder[];
}

export function AdminPurchaseOrdersClient({
  initialOrders,
}: AdminPurchaseOrdersClientProps) {
  const [orders, setOrders] = useState<PurchaseOrder[]>(initialOrders);
  const [activeTab, setActiveTab] = useState<"active" | "past">("active");
  const [searchQuery, setSearchQuery] = useState("");

  // Confirmation Modal for receiving order
  const [receivingOrder, setReceivingOrder] = useState<PurchaseOrder | null>(null);
  const [receiveNotes, setReceiveNotes] = useState("");
  const [isUpdating, setIsUpdating] = useState(false);

  // Status change loading map
  const [updatingOrderId, setUpdatingOrderId] = useState<string | null>(null);

  // Split Active and Past Orders
  const activeOrders = useMemo(
    () =>
      orders.filter(
        (o) => o.status === "Placed" || o.status === "Dispatched / In Transit"
      ),
    [orders]
  );

  const pastOrders = useMemo(
    () => orders.filter((o) => o.status === "Received"),
    [orders]
  );

  const currentList = activeTab === "active" ? activeOrders : pastOrders;

  // Filtered by Search Query
  const filteredOrders = useMemo(() => {
    if (!searchQuery.trim()) return currentList;
    const q = searchQuery.toLowerCase().trim();
    return currentList.filter(
      (o) =>
        o.order_number?.toLowerCase().includes(q) ||
        o.sku_code?.toLowerCase().includes(q) ||
        o.product_title?.toLowerCase().includes(q)
    );
  }, [currentList, searchQuery]);

  // Aggregate Metrics
  const totalActiveUnits = activeOrders.reduce(
    (acc, curr) => acc + (curr.order_quantity || 0),
    0
  );
  const totalPastUnits = pastOrders.reduce(
    (acc, curr) => acc + (curr.order_quantity || 0),
    0
  );

  const handleStatusChange = async (
    po: PurchaseOrder,
    newStatus: PurchaseOrderStatus
  ) => {
    if (newStatus === po.status) return;

    // If changing to Received, open confirmation modal to explain auto-stock credit
    if (newStatus === "Received") {
      setReceivingOrder(po);
      setReceiveNotes("");
      return;
    }

    try {
      setUpdatingOrderId(po.id);
      const res = await updatePurchaseOrderStatus(po.id, newStatus);
      if (res.error) {
        toast.error(res.error);
      } else {
        toast.success(`PO ${po.order_number} status updated to ${newStatus}`);
        setOrders((prev) =>
          prev.map((item) =>
            item.id === po.id
              ? {
                  ...item,
                  status: newStatus,
                  dispatched_at:
                    newStatus === "Dispatched / In Transit"
                      ? new Date().toISOString()
                      : item.dispatched_at,
                }
              : item
          )
        );
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to update status");
    } finally {
      setUpdatingOrderId(null);
    }
  };

  const handleConfirmReceive = async () => {
    if (!receivingOrder) return;

    try {
      setIsUpdating(true);
      const res = await updatePurchaseOrderStatus(
        receivingOrder.id,
        "Received",
        receiveNotes.trim() || undefined
      );

      if (res.error) {
        toast.error(res.error);
      } else {
        toast.success(
          `Order received! Automatically credited +${receivingOrder.order_quantity} units to SKU stock.`
        );
        setOrders((prev) =>
          prev.map((item) =>
            item.id === receivingOrder.id
              ? {
                  ...item,
                  status: "Received",
                  received_at: new Date().toISOString(),
                  notes: receiveNotes.trim() || item.notes,
                }
              : item
          )
        );
        setReceivingOrder(null);
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to receive order");
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Title & Description */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2.5">
            <Truck className="h-6 w-6 text-[#024AE5]" />
            <span>Manufacturer Purchase Orders</span>
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Automated replenishment orders generated when SKU stock falls below the configured Minimum SKU threshold.
          </p>
        </div>
      </div>

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="border border-slate-200 bg-white shadow-2xs rounded-xl">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-500">Active Production POs</p>
              <h3 className="text-2xl font-bold text-slate-900 mt-0.5">
                {activeOrders.length}
              </h3>
              <p className="text-[11px] text-amber-600 font-medium mt-0.5">
                Awaiting factory delivery
              </p>
            </div>
            <div className="h-10 w-10 rounded-lg bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-600">
              <Clock className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border border-slate-200 bg-white shadow-2xs rounded-xl">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-500">Units on Order</p>
              <h3 className="text-2xl font-bold text-[#024AE5] mt-0.5">
                {totalActiveUnits}
              </h3>
              <p className="text-[11px] text-slate-400 font-medium mt-0.5">
                Units ordered from manufacturer
              </p>
            </div>
            <div className="h-10 w-10 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center text-[#024AE5]">
              <Package className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border border-slate-200 bg-white shadow-2xs rounded-xl">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-500">Past Received Orders</p>
              <h3 className="text-2xl font-bold text-emerald-700 mt-0.5">
                {pastOrders.length}
              </h3>
              <p className="text-[11px] text-emerald-600 font-medium mt-0.5">
                {totalPastUnits} units credited into stock
              </p>
            </div>
            <div className="h-10 w-10 rounded-lg bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600">
              <CheckCircle2 className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs & Search Filter */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          {/* Active vs Past Orders Tabs */}
          <div className="flex items-center gap-1.5 p-1 bg-slate-100/90 rounded-lg w-fit border border-slate-200/80">
            <button
              onClick={() => setActiveTab("active")}
              className={cn(
                "flex items-center gap-2 px-3.5 py-1.5 rounded-md text-xs font-bold transition-all cursor-pointer",
                activeTab === "active"
                  ? "bg-white text-slate-900 shadow-2xs"
                  : "text-slate-600 hover:text-slate-900"
              )}
            >
              <Clock className="h-3.5 w-3.5 text-amber-500" />
              <span>Active Orders</span>
              <span className="ml-0.5 px-1.5 py-0.2 rounded-full text-[10px] font-mono bg-amber-50 text-amber-700 border border-amber-200">
                {activeOrders.length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab("past")}
              className={cn(
                "flex items-center gap-2 px-3.5 py-1.5 rounded-md text-xs font-bold transition-all cursor-pointer",
                activeTab === "past"
                  ? "bg-white text-slate-900 shadow-2xs"
                  : "text-slate-600 hover:text-slate-900"
              )}
            >
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
              <span>Past Orders</span>
              <span className="ml-0.5 px-1.5 py-0.2 rounded-full text-[10px] font-mono bg-emerald-50 text-emerald-700 border border-emerald-200">
                {pastOrders.length}
              </span>
            </button>
          </div>

          {/* Search Box */}
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
            <Input
              type="text"
              placeholder="Search by PO #, SKU, or Title..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 h-9 text-xs bg-slate-50/50 border-slate-200 focus:bg-white"
            />
          </div>
        </div>

        {/* Purchase Orders Table */}
        <div className="border border-slate-200 rounded-lg overflow-x-auto">
          <Table>
            <TableHeader className="bg-slate-50/90 text-slate-700 text-xs">
              <TableRow className="border-b border-slate-200">
                <TableHead className="font-bold whitespace-nowrap">PO NUMBER</TableHead>
                <TableHead className="font-bold whitespace-nowrap">PRODUCT / SKU</TableHead>
                <TableHead className="font-bold whitespace-nowrap">SPECIFICATIONS</TableHead>
                <TableHead className="font-bold text-center whitespace-nowrap">MIN QTY</TableHead>
                <TableHead className="font-bold text-center whitespace-nowrap">STOCK AT TRIGGER</TableHead>
                <TableHead className="font-bold text-center whitespace-nowrap bg-blue-50/50 text-[#024AE5]">
                  ORDER QTY
                </TableHead>
                <TableHead className="font-bold text-center whitespace-nowrap">STATUS</TableHead>
                <TableHead className="font-bold text-center whitespace-nowrap">CHANGE STATUS</TableHead>
                <TableHead className="font-bold whitespace-nowrap">DATE</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody className="text-xs divide-y divide-slate-100">
              {filteredOrders.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={9}
                    className="py-12 text-center text-slate-500"
                  >
                    <div className="flex flex-col items-center justify-center gap-2">
                      <div className="h-10 w-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-400">
                        <Truck className="h-5 w-5" />
                      </div>
                      <p className="font-semibold text-slate-700">
                        {activeTab === "active"
                          ? "No active purchase orders pending."
                          : "No past received orders found."}
                      </p>
                      <p className="text-[11px] text-slate-400">
                        Orders are auto-generated when an SKU stock is deducted below its minimum threshold.
                      </p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                filteredOrders.map((po) => {
                  const specs = po.specifications || {};
                  const specItems = Object.entries(specs).filter(
                    ([k, v]) => v && k !== "Tag"
                  );
                  const isBusy = updatingOrderId === po.id;

                  return (
                    <TableRow
                      key={po.id}
                      className="hover:bg-slate-50/80 transition-colors"
                    >
                      {/* PO Number */}
                      <TableCell className="font-mono font-bold text-slate-900 whitespace-nowrap">
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-slate-100 border border-slate-200">
                          {po.order_number}
                        </span>
                      </TableCell>

                      {/* Product Title & SKU */}
                      <TableCell className="whitespace-nowrap">
                        <div className="font-semibold text-slate-900">
                          {po.product_title}
                        </div>
                        <div className="font-mono text-[11px] text-[#024AE5] font-bold">
                          {po.sku_code}
                        </div>
                      </TableCell>

                      {/* Specs */}
                      <TableCell className="max-w-[200px]">
                        {specItems.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {specItems.slice(0, 3).map(([k, v]) => (
                              <span
                                key={k}
                                className="inline-flex items-center text-[10px] bg-slate-50 text-slate-600 px-1.5 py-0.5 rounded border border-slate-200"
                              >
                                <span className="font-semibold mr-1">{k}:</span> {String(v)}
                              </span>
                            ))}
                            {specItems.length > 3 && (
                              <span className="text-[10px] text-slate-400">
                                +{specItems.length - 3} more
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-400 italic text-[11px]">
                            Standard Specs
                          </span>
                        )}
                      </TableCell>

                      {/* Min Quantity */}
                      <TableCell className="text-center font-semibold text-slate-700 whitespace-nowrap">
                        {po.min_quantity} Units
                      </TableCell>

                      {/* Actual Quantity at trigger */}
                      <TableCell className="text-center whitespace-nowrap">
                        <span className="inline-flex items-center text-rose-700 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded font-mono font-bold text-[11px]">
                          {po.actual_quantity} Units
                        </span>
                      </TableCell>

                      {/* Order Quantity (Difference) */}
                      <TableCell className="text-center whitespace-nowrap bg-blue-50/30">
                        <span className="inline-flex items-center text-[#024AE5] font-bold text-xs bg-blue-50 border border-blue-200 px-2.5 py-0.5 rounded-md">
                          +{po.order_quantity} Units
                        </span>
                      </TableCell>

                      {/* Status Badge */}
                      <TableCell className="text-center whitespace-nowrap">
                        {po.status === "Placed" && (
                          <Badge
                            variant="outline"
                            className="bg-amber-50 text-amber-700 border-amber-200 text-[11px] font-semibold"
                          >
                            <Clock className="w-3 h-3 mr-1" />
                            Placed
                          </Badge>
                        )}
                        {po.status === "Dispatched / In Transit" && (
                          <Badge
                            variant="outline"
                            className="bg-blue-50 text-blue-700 border-blue-200 text-[11px] font-semibold"
                          >
                            <Truck className="w-3 h-3 mr-1" />
                            Dispatched
                          </Badge>
                        )}
                        {po.status === "Received" && (
                          <Badge
                            variant="outline"
                            className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[11px] font-semibold"
                          >
                            <CheckCircle2 className="w-3 h-3 mr-1" />
                            Received
                          </Badge>
                        )}
                      </TableCell>

                      {/* Status Action Dropdown */}
                      <TableCell className="text-center whitespace-nowrap">
                        {po.status === "Received" ? (
                          <span className="text-[11px] font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded">
                            Received
                          </span>
                        ) : (
                          <Select
                            value={po.status}
                            disabled={isBusy}
                            onValueChange={(val) =>
                              handleStatusChange(po, val as PurchaseOrderStatus)
                            }
                          >
                            <SelectTrigger className="h-7 text-xs bg-white border-slate-200 min-w-[140px]">
                              {isBusy ? (
                                <div className="flex items-center gap-1.5">
                                  <Loader2 className="h-3 w-3 animate-spin text-slate-500" />
                                  <span>Updating...</span>
                                </div>
                              ) : (
                                <SelectValue />
                              )}
                            </SelectTrigger>
                            <SelectContent className="bg-white text-xs border-slate-200 shadow-md">
                              <SelectItem value="Placed" className="text-amber-700 font-medium">
                                Placed
                              </SelectItem>
                              <SelectItem
                                value="Dispatched / In Transit"
                                className="text-blue-700 font-medium"
                              >
                                Dispatched
                              </SelectItem>
                              <SelectItem
                                value="Received"
                                className="text-emerald-700 font-medium"
                              >
                                Received to us
                              </SelectItem>
                            </SelectContent>
                          </Select>
                        )}
                      </TableCell>

                      {/* Date */}
                      <TableCell className="whitespace-nowrap text-slate-500 text-[11px]">
                        <div className="flex items-center gap-1">
                          <Calendar className="h-3 w-3 text-slate-400" />
                          <span>
                            {new Date(po.placed_at || po.created_at).toLocaleDateString(
                              "en-IN",
                              {
                                day: "2-digit",
                                month: "short",
                                year: "numeric",
                              }
                            )}
                          </span>
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

      {/* Confirmation Dialog When Marking Order as Received */}
      <Dialog
        open={Boolean(receivingOrder)}
        onOpenChange={(open) => !open && setReceivingOrder(null)}
      >
        <DialogContent className="max-w-md bg-white p-6">
          <DialogHeader>
            <div className="flex items-center gap-2 text-emerald-600 mb-1">
              <ShieldCheck className="h-5 w-5" />
              <DialogTitle className="text-base font-bold text-slate-900">
                Confirm Goods Receipt & Automatic Stock Credit
              </DialogTitle>
            </div>
            <DialogDescription className="text-xs text-slate-500">
              Marking this purchase order as Received will increment inventory and create an audit log.
            </DialogDescription>
          </DialogHeader>

          {receivingOrder && (
            <div className="space-y-4 py-2 text-xs">
              <div className="bg-slate-50 p-3.5 rounded-lg border border-slate-200 space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-slate-500">PO Number:</span>
                  <span className="font-mono font-bold text-slate-900">
                    {receivingOrder.order_number}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500">SKU Code:</span>
                  <span className="font-mono font-bold text-[#024AE5]">
                    {receivingOrder.sku_code}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500">Units to Add:</span>
                  <span className="font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                    +{receivingOrder.order_quantity} Units
                  </span>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-700">
                  Receipt Notes / Inspection Remark (Optional)
                </Label>
                <Input
                  placeholder="e.g. Received batch #482 at warehouse, quality verified."
                  value={receiveNotes}
                  onChange={(e) => setReceiveNotes(e.target.value)}
                  className="h-9 text-xs border-slate-200"
                />
              </div>

              <div className="p-2.5 bg-blue-50/70 border border-blue-200 rounded text-[11px] text-blue-800 flex items-start gap-2">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-[#024AE5]" />
                <span>
                  This will log a <strong>RESTOCK</strong> movement in the SKU Inventory Ledger with reference to {receivingOrder.order_number} and move this order to <strong>Past Orders</strong>.
                </span>
              </div>
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0 mt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setReceivingOrder(null)}
              disabled={isUpdating}
              className="text-xs border-slate-200"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleConfirmReceive}
              disabled={isUpdating}
              className="bg-[#024AE5] hover:bg-[#0238B0] text-white text-xs font-bold gap-1.5"
            >
              {isUpdating ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  <span>Processing Restock...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  <span>Confirm & Restock SKU</span>
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
