"use client";

import { useState, useMemo } from "react";
import { PurchaseOrder } from "@/types/database.types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
  Search,
  Clock,
  CheckCircle2,
  Truck,
  Package,
  Layers,
  Calendar,
  AlertCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface ManufacturerDashboardClientProps {
  orders: PurchaseOrder[];
}

export function ManufacturerDashboardClient({
  orders,
}: ManufacturerDashboardClientProps) {
  const [activeTab, setActiveTab] = useState<"active" | "past">("active");
  const [searchQuery, setSearchQuery] = useState("");

  // Split Active Orders (Placed, Dispatched / In Transit) and Past Orders (Received)
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

  // Current list based on active tab
  const currentOrders = activeTab === "active" ? activeOrders : pastOrders;

  // Filter by search query
  const filteredOrders = useMemo(() => {
    if (!searchQuery.trim()) return currentOrders;
    const q = searchQuery.toLowerCase().trim();
    return currentOrders.filter(
      (o) =>
        o.order_number?.toLowerCase().includes(q) ||
        o.sku_code?.toLowerCase().includes(q) ||
        o.product_title?.toLowerCase().includes(q)
    );
  }, [currentOrders, searchQuery]);

  // Aggregate Metrics
  const totalActiveUnits = activeOrders.reduce(
    (acc, curr) => acc + (curr.order_quantity || 0),
    0
  );
  const totalPastUnits = pastOrders.reduce(
    (acc, curr) => acc + (curr.order_quantity || 0),
    0
  );

  return (
    <div className="space-y-6">
      {/* Title & Portal Description */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <span>Production & Purchase Orders</span>
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Real-time feed of automated production replenishment orders.
          </p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="border border-slate-200 bg-white shadow-2xs rounded-xl">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-500">Active Orders</p>
              <h3 className="text-2xl font-bold text-slate-900 mt-0.5">
                {activeOrders.length}
              </h3>
              <p className="text-[11px] text-amber-600 font-medium mt-0.5">
                Pending Production / Transit
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
              <p className="text-xs font-semibold text-slate-500">Total Units to Order</p>
              <h3 className="text-2xl font-bold text-[#024AE5] mt-0.5">
                {totalActiveUnits}
              </h3>
              <p className="text-[11px] text-slate-400 font-medium mt-0.5">
                Total units ordered across active POs
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
              <p className="text-xs font-semibold text-slate-500">Past Delivered Orders</p>
              <h3 className="text-2xl font-bold text-emerald-700 mt-0.5">
                {pastOrders.length}
              </h3>
              <p className="text-[11px] text-emerald-600 font-medium mt-0.5">
                {totalPastUnits} units received by Sojar
              </p>
            </div>
            <div className="h-10 w-10 rounded-lg bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600">
              <CheckCircle2 className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tab Switcher & Search Bar */}
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

        {/* Read-Only Orders Table */}
        <div className="border border-slate-200 rounded-lg overflow-x-auto">
          <Table>
            <TableHeader className="bg-slate-50/90 text-slate-700 text-xs">
              <TableRow className="border-b border-slate-200">
                <TableHead className="font-bold whitespace-nowrap">PO NUMBER</TableHead>
                <TableHead className="font-bold whitespace-nowrap">PRODUCT / SKU</TableHead>
                <TableHead className="font-bold whitespace-nowrap">SPECIFICATIONS</TableHead>
                <TableHead className="font-bold text-center whitespace-nowrap bg-blue-50/50 text-[#024AE5]">
                  ORDER QTY
                </TableHead>
                <TableHead className="font-bold text-center whitespace-nowrap">STATUS</TableHead>
                <TableHead className="font-bold whitespace-nowrap">DATE PLACED</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody className="text-xs divide-y divide-slate-100">
              {filteredOrders.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="py-12 text-center text-slate-500"
                  >
                    <div className="flex flex-col items-center justify-center gap-2">
                      <div className="h-10 w-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-400">
                        <Package className="h-5 w-5" />
                      </div>
                      <p className="font-semibold text-slate-700">
                        {activeTab === "active"
                          ? "No active production orders pending."
                          : "No past completed orders found."}
                      </p>
                      <p className="text-[11px] text-slate-400">
                        Production orders placed by Sojar will appear here automatically.
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

                  return (
                    <TableRow
                      key={po.id}
                      className="hover:bg-slate-50/80 transition-colors"
                    >
                      {/* Order Number */}
                      <TableCell className="font-mono font-bold text-slate-900 whitespace-nowrap">
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-slate-100 border border-slate-200">
                          {po.order_number}
                        </span>
                      </TableCell>

                      {/* Product & SKU */}
                      <TableCell className="whitespace-nowrap">
                        <div className="font-semibold text-slate-900">
                          {po.product_title}
                        </div>
                        <div className="font-mono text-[11px] text-[#024AE5] font-bold">
                          {po.sku_code}
                        </div>
                      </TableCell>

                      {/* Specifications */}
                      <TableCell className="max-w-[220px]">
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

                      {/* Order Quantity */}
                      <TableCell className="text-center whitespace-nowrap bg-blue-50/30">
                        <span className="inline-flex items-center text-[#024AE5] font-bold text-xs bg-blue-50 border border-blue-200 px-2.5 py-0.5 rounded-md">
                          {po.order_quantity} Units
                        </span>
                      </TableCell>

                      {/* Status */}
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
                            Dispatched / In Transit
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

                      {/* Date Placed */}
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
    </div>
  );
}
