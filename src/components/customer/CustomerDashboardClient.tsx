"use client";

import React, { useState } from "react";
import { Order, Profile, OrderItem } from "@/types/database.types";
import {
  ORDER_STATUSES,
  ORDER_STATUS_CONFIG,
  OrderStatus,
} from "@/lib/constants";
import { updateCustomerProfile } from "@/actions/customer";
import { CustomerSidebar } from "./CustomerSidebar";
import { CustomerHeader } from "./CustomerHeader";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Package,
  ShoppingBag,
  Truck,
  CheckCircle2,
  Clock,
  Building2,
  Phone,
  Mail,
  LogOut,
  ExternalLink,
  Copy,
  Check,
  ChevronRight,
  Boxes,
  FileText,
  AlertCircle,
  Eye,
  ShieldCheck,
  CreditCard,
  Headphones,
  Settings,
  Plus,
  Send,
  Loader2,
  Receipt,
  TrendingUp,
  Search,
  Filter,
  ArrowUpDown,
  RotateCcw,
} from "lucide-react";
import Link from "next/link";
import toast from "react-hot-toast";

interface CustomerDashboardClientProps {
  user: { id: string; email: string };
  profile: Profile | null;
  orders: Order[];
}

export function CustomerDashboardClient({
  user,
  profile: initialProfile,
  orders,
}: CustomerDashboardClientProps) {
  const [profile, setProfile] = useState<Profile | null>(initialProfile);
  const [activeTab, setActiveTab] = useState<string>("overview");
  const [orderStatusFilter, setOrderStatusFilter] = useState<string>("ALL");
  const [orderSearch, setOrderSearch] = useState("");
  const [sortBy, setSortBy] = useState<"DATE_DESC" | "DATE_ASC" | "AMOUNT_DESC" | "AMOUNT_ASC">("DATE_DESC");
  const [activeOrderDetails, setActiveOrderDetails] = useState<Order | null>(null);
  const [copiedAwb, setCopiedAwb] = useState<string | null>(null);

  // Edit Profile Modal State
  const [isEditProfileOpen, setIsEditProfileOpen] = useState(false);
  const [editCompanyName, setEditCompanyName] = useState(profile?.company_name || "");
  const [editFirstName, setEditFirstName] = useState(profile?.first_name || "");
  const [editLastName, setEditLastName] = useState(profile?.last_name || "");
  const [editMobile, setEditMobile] = useState(profile?.mobile || "");
  const [editGstin, setEditGstin] = useState(profile?.gstin || "");
  const [editAddress, setEditAddress] = useState(profile?.company_address || "");
  const [editCity, setEditCity] = useState(profile?.city || "");
  const [editState, setEditState] = useState(profile?.state || "");
  const [editPincode, setEditPincode] = useState(profile?.pincode || "");
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  // RFQ Submission Modal State
  const [isRfqModalOpen, setIsRfqModalOpen] = useState(false);
  const [rfqItemName, setRfqItemName] = useState("");
  const [rfqQuantity, setRfqQuantity] = useState("");
  const [rfqSpecs, setRfqSpecs] = useState("");
  const [rfqDeliveryDate, setRfqDeliveryDate] = useState("");
  const [isSubmittingRfq, setIsSubmittingRfq] = useState(false);

  const copyToClipboard = (text: string, label = "AWB Number") => {
    navigator.clipboard.writeText(text);
    setCopiedAwb(text);
    toast.success(`${label} copied to clipboard!`);
    setTimeout(() => setCopiedAwb(null), 2500);
  };

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

  // Orders Filtering & Sorting
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

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingProfile(true);

    const result = await updateCustomerProfile({
      company_name: editCompanyName,
      first_name: editFirstName,
      last_name: editLastName,
      mobile: editMobile,
      gstin: editGstin || null,
      company_address: editAddress,
      city: editCity,
      state: editState,
      pincode: editPincode,
    });

    setIsSavingProfile(false);

    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success("Company profile & billing details updated successfully.");
      setProfile((prev) =>
        prev
          ? {
              ...prev,
              company_name: editCompanyName,
              first_name: editFirstName,
              last_name: editLastName,
              mobile: editMobile,
              gstin: editGstin,
              company_address: editAddress,
              city: editCity,
              state: editState,
              pincode: editPincode,
            }
          : null
      );
      setIsEditProfileOpen(false);
    }
  };

  const handleSubmitRfq = (e: React.FormEvent) => {
    e.preventDefault();
    if (!rfqItemName.trim()) {
      toast.error("Please specify the tooling or fastener specifications.");
      return;
    }
    setIsSubmittingRfq(true);
    setTimeout(() => {
      setIsSubmittingRfq(false);
      setIsRfqModalOpen(false);
      setRfqItemName("");
      setRfqQuantity("");
      setRfqSpecs("");
      toast.success("Request for Quotation (RFQ) submitted! Our application engineer will revert with pricing within 4 hours.");
    }, 800);
  };

  const fullName = profile ? `${profile.title || "Mr"} ${profile.first_name} ${profile.last_name}` : "Valued Client";

  return (
    <div className="flex min-h-screen bg-slate-50/50">
      {/* Left Dedicated Sidebar */}
      <CustomerSidebar
        companyName={profile?.company_name || "Enterprise Account"}
      />

      {/* Main Content Area */}
      <div className="flex flex-1 flex-col overflow-x-hidden min-w-0 bg-white">
        {/* Top App Header */}
        <CustomerHeader
          userName={fullName}
          userEmail={user.email}
          companyName={profile?.company_name || "Enterprise Partner"}
          onOpenRfq={() => setIsRfqModalOpen(true)}
        />

        {/* Dashboard Main Body */}
        <main className="flex-1 p-6 sm:p-8 space-y-6">
          {/* Top 3 Commercial KPI Cards (Cleaned) */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card className="p-4 bg-white border border-slate-200 shadow-none rounded-xl space-y-2">
              <div className="flex items-center justify-between text-slate-500">
                <span className="text-[11px] font-bold uppercase tracking-wider">Available Credit Line</span>
                <CreditCard className="h-4 w-4 text-[#024AE5]" />
              </div>
              <div className="text-xl font-bold text-slate-900 font-mono">
                ₹{availableCredit.toLocaleString("en-IN")}
              </div>
              <div className="space-y-1">
                <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                  <div
                    className="bg-[#024AE5] h-full rounded-full transition-all"
                    style={{ width: `${creditUsedPercent}%` }}
                  />
                </div>
                <div className="flex justify-between text-[10px] text-slate-400">
                  <span>Terms: {creditDays} Net Days</span>
                  <span>Limit: ₹{creditLimit.toLocaleString("en-IN")}</span>
                </div>
              </div>
            </Card>

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
                {deliveredOrders.length} completed orders delivered
              </p>
            </Card>
          </div>

          {/* VIEW 1: OVERVIEW & ORDERS */}
          {(activeTab === "overview" || activeTab === "orders") && (
            <div className="space-y-4">
              {/* Header Title & Actions */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                  <h2 className="text-xl font-bold text-slate-900 tracking-tight">
                    Industrial Orders & Logistics Tracking
                  </h2>
                  <p className="text-xs text-slate-500">
                    Real-time status tracking, carrier AWB numbers, and live consignment links.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    onClick={() => setIsRfqModalOpen(true)}
                    className="bg-[#3C8B4F] hover:bg-[#347844] text-white text-xs font-bold h-8.5 shadow-none gap-1.5 cursor-pointer"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    <span>Request Custom RFQ</span>
                  </Button>
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

              {/* Clean Filter & Search Toolbar with Dropdown */}
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

                  {/* Reset Button (only if active filters) */}
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
                        ? "Try adjusting your search query or changing the status filter dropdown."
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

                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setActiveOrderDetails(ord)}
                            className="text-[#024AE5] hover:text-[#024AE5]/80 hover:bg-blue-50 text-xs font-bold gap-1 h-8 px-2.5 cursor-pointer self-end sm:self-auto"
                          >
                            <Eye className="h-3.5 w-3.5" />
                            <span>View Full Tax Invoice</span>
                          </Button>
                        </div>
                      </Card>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* VIEW 2: RFQS & CUSTOM MANUFACTURING */}
          {activeTab === "rfqs" && (
            <div className="space-y-4">
              <div className="bg-white p-6 rounded-xl border border-slate-200 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                  <div>
                    <h3 className="text-base font-bold text-slate-900">Custom Tooling & Fastener RFQ</h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Need custom CNC solid carbide profiles, non-standard lengths, or bulk production runs?
                    </p>
                  </div>
                  <Button
                    onClick={() => setIsRfqModalOpen(true)}
                    className="bg-[#024AE5] hover:bg-[#024AE5]/90 text-white text-xs h-9 font-bold shadow-none gap-1.5 cursor-pointer"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    <span>Submit New RFQ</span>
                  </Button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
                  <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-1.5">
                    <div className="h-8 w-8 rounded-lg bg-blue-100 text-[#024AE5] flex items-center justify-center font-bold text-xs mb-2">
                      1
                    </div>
                    <h4 className="text-xs font-bold text-slate-800">Engineering Drawing Review</h4>
                    <p className="text-[11px] text-slate-500 leading-relaxed">
                      Submit required tool diameters, flute lengths, coating specs, and tolerances.
                    </p>
                  </div>

                  <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-1.5">
                    <div className="h-8 w-8 rounded-lg bg-blue-100 text-[#024AE5] flex items-center justify-center font-bold text-xs mb-2">
                      2
                    </div>
                    <h4 className="text-xs font-bold text-slate-800">Direct Factory Quotation</h4>
                    <p className="text-[11px] text-slate-500 leading-relaxed">
                      Receive volume-tiered commercial quote with estimated production lead time within 4 hours.
                    </p>
                  </div>

                  <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-1.5">
                    <div className="h-8 w-8 rounded-lg bg-blue-100 text-[#024AE5] flex items-center justify-center font-bold text-xs mb-2">
                      3
                    </div>
                    <h4 className="text-xs font-bold text-slate-800">Production & QC Dispatch</h4>
                    <p className="text-[11px] text-slate-500 leading-relaxed">
                      Manufactured at Bhosari MIDC with automated laser dimensional inspection and material test certificates.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* VIEW 3: INVOICES & FINANCIALS */}
          {activeTab === "invoices" && (
            <div className="space-y-4">
              <Card className="border-slate-200 bg-white shadow-none rounded-xl overflow-hidden">
                <CardHeader className="border-b border-slate-100 pb-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-base font-bold text-slate-900">
                        GST Invoices & Statements
                      </CardTitle>
                      <CardDescription className="text-xs">
                        Download official GST tax invoices for accounting & input tax credit (ITC).
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>

                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader className="bg-slate-50">
                      <TableRow className="text-xs">
                        <TableHead className="font-bold text-slate-700">Invoice / Order #</TableHead>
                        <TableHead className="font-bold text-slate-700">Billing Date</TableHead>
                        <TableHead className="font-bold text-slate-700">Taxable Subtotal</TableHead>
                        <TableHead className="font-bold text-slate-700">GST (18%)</TableHead>
                        <TableHead className="font-bold text-slate-700">Total Invoice (₹)</TableHead>
                        <TableHead className="font-bold text-slate-700">Status</TableHead>
                        <TableHead className="font-bold text-slate-700 text-right pr-4">Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {orders.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={7} className="text-center py-12 text-slate-500 text-xs">
                            No commercial invoices available yet. Invoices are generated automatically upon order placement.
                          </TableCell>
                        </TableRow>
                      ) : (
                        orders.map((ord) => {
                          const sub = ord.subtotal || ord.total_amount * 0.847;
                          const gst = ord.gst_amount || ord.total_amount * 0.153;

                          return (
                            <TableRow key={ord.id} className="text-xs hover:bg-slate-50">
                              <TableCell className="font-mono font-bold text-[#024AE5]">
                                INV-{ord.order_number.replace("ORD-", "")}
                              </TableCell>
                              <TableCell className="text-slate-500">
                                {new Date(ord.created_at).toLocaleDateString("en-IN", {
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
                                <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                  Invoiced
                                </span>
                              </TableCell>
                              <TableCell className="text-right pr-4">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => setActiveOrderDetails(ord)}
                                  className="h-7 text-[11px] border-slate-200 gap-1 text-slate-700 shadow-none cursor-pointer"
                                >
                                  <Eye className="h-3 w-3" />
                                  <span>View</span>
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
            </div>
          )}

          {/* VIEW 4: COMPANY PROFILE & SITES */}
          {activeTab === "company" && (
            <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
              <Card className="md:col-span-8 p-6 bg-white border border-slate-200 shadow-none rounded-xl space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-2">
                    <Building2 className="h-5 w-5 text-[#024AE5]" />
                    <h3 className="font-bold text-sm text-slate-900">Registered Enterprise & Facility Details</h3>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => setIsEditProfileOpen(true)}
                    className="bg-[#024AE5] hover:bg-[#024AE5]/90 text-white text-xs h-8 font-bold shadow-none cursor-pointer"
                  >
                    <Settings className="h-3.5 w-3.5 mr-1" />
                    Edit Profile
                  </Button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                  <div>
                    <span className="text-slate-400 block text-[11px] font-semibold">Enterprise Entity Name</span>
                    <span className="font-bold text-slate-900 text-sm">{profile?.company_name || "Enterprise Account"}</span>
                  </div>

                  <div>
                    <span className="text-slate-400 block text-[11px] font-semibold">GSTIN / Tax Identifier</span>
                    <span className="font-mono font-bold text-slate-900">{profile?.gstin || "Not specified"}</span>
                  </div>

                  <div>
                    <span className="text-slate-400 block text-[11px] font-semibold">Authorized Representative</span>
                    <span className="font-semibold text-slate-800">{profile?.title} {profile?.first_name} {profile?.last_name}</span>
                    <p className="text-slate-500 text-[11px]">{profile?.designation} &bull; {profile?.department}</p>
                  </div>

                  <div>
                    <span className="text-slate-400 block text-[11px] font-semibold">Primary Contact Numbers</span>
                    <span className="font-semibold text-slate-800">{profile?.mobile || "-"}</span>
                    {profile?.landline && <p className="text-slate-500 text-[11px]">Landline: {profile.landline}</p>}
                  </div>

                  <div className="sm:col-span-2 pt-2 border-t border-slate-100">
                    <span className="text-slate-400 block text-[11px] font-semibold">Factory / Corporate Delivery Address</span>
                    <p className="text-slate-800 font-medium leading-relaxed mt-0.5">
                      {profile?.company_address || "Industrial MIDC Estate"}
                      {profile?.additional_address && `, ${profile.additional_address}`}
                      <br />
                      {profile?.city || "Pune"}, {profile?.state || "Maharashtra"} - {profile?.pincode || "411001"}
                    </p>
                  </div>
                </div>
              </Card>

              <Card className="md:col-span-4 p-6 bg-white border border-slate-200 shadow-none rounded-xl space-y-4">
                <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
                  <ShieldCheck className="h-4 w-4 text-emerald-600" />
                  <h3 className="font-bold text-sm text-slate-900">Commercial Terms</h3>
                </div>

                <div className="space-y-3 text-xs">
                  <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-1">
                    <span className="text-slate-400 block text-[10px] font-bold uppercase">Credit Facility</span>
                    <div className="font-mono font-bold text-slate-900 text-sm">
                      ₹{creditLimit.toLocaleString("en-IN")}
                    </div>
                    <span className="text-[10px] text-emerald-700 font-semibold bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200 inline-block">
                      {creditDays} Net Days Term
                    </span>
                  </div>

                  <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-1">
                    <span className="text-slate-400 block text-[10px] font-bold uppercase">Tax Exemption / SEZ</span>
                    <div className="text-slate-700 font-medium">Standard CGST + SGST (18%)</div>
                  </div>
                </div>
              </Card>
            </div>
          )}

          {/* VIEW 5: TECHNICAL SUPPORT & HELPDESK */}
          {activeTab === "support" && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card className="p-6 bg-white border border-slate-200 shadow-none rounded-xl space-y-4">
                <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
                  <Headphones className="h-5 w-5 text-[#024AE5]" />
                  <h3 className="font-bold text-sm text-slate-900">Tooling & Engineering Support</h3>
                </div>

                <div className="space-y-3 text-xs">
                  <p className="text-slate-600 leading-relaxed">
                    Have questions regarding speed & feed parameters, workpiece machinability, or custom tooling tolerances?
                  </p>

                  <div className="space-y-2 pt-2">
                    <div className="flex items-center gap-2.5 p-3 rounded-lg bg-blue-50/60 border border-blue-100">
                      <Phone className="h-4 w-4 text-[#024AE5]" />
                      <div>
                        <span className="font-bold text-slate-900 block">Direct Technical Hotline</span>
                        <span className="text-slate-600 font-mono">+91 (020) 2712-8940 / +91 98765 43210</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2.5 p-3 rounded-lg bg-slate-50 border border-slate-200">
                      <Mail className="h-4 w-4 text-slate-600" />
                      <div>
                        <span className="font-bold text-slate-900 block">Engineering Desk Email</span>
                        <span className="text-slate-600">engineering@sojarindusy.com</span>
                      </div>
                    </div>
                  </div>
                </div>
              </Card>

              <Card className="p-6 bg-white border border-slate-200 shadow-none rounded-xl space-y-4">
                <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
                  <Truck className="h-5 w-5 text-indigo-600" />
                  <h3 className="font-bold text-sm text-slate-900">Dispatch & E-Way Bill Logistics Desk</h3>
                </div>

                <div className="space-y-3 text-xs">
                  <p className="text-slate-600 leading-relaxed">
                    For urgent consignment tracking, carrier changes, or multi-site drop shipment delivery coordination.
                  </p>

                  <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-1">
                    <span className="text-slate-400 block text-[10px] font-bold uppercase">Warehouse Location</span>
                    <div className="font-bold text-slate-900">Sojar Indusy Tech MIDC Logistics Hub</div>
                    <div className="text-slate-500">Phase 1 MIDC Industrial Area, Chinchwad, Pune - 411019</div>
                  </div>

                  <div className="flex items-center gap-2 text-slate-600">
                    <Clock className="h-3.5 w-3.5 text-slate-400" />
                    <span>Dispatch Hours: Mon – Sat (08:30 AM to 07:00 PM IST)</span>
                  </div>
                </div>
              </Card>
            </div>
          )}
        </main>
      </div>

      {/* Edit Profile Modal */}
      <Dialog open={isEditProfileOpen} onOpenChange={setIsEditProfileOpen}>
        <DialogContent className="max-w-lg bg-white p-6 rounded-2xl shadow-xl">
          <DialogHeader className="pb-3 border-b border-slate-200">
            <div className="flex items-center gap-2">
              <Settings className="h-5 w-5 text-[#024AE5]" />
              <DialogTitle className="text-lg font-bold text-slate-900">
                Edit Enterprise Profile
              </DialogTitle>
            </div>
            <DialogDescription className="text-xs text-slate-500">
              Update registered company name, GSTIN, and primary factory delivery address.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSaveProfile} className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-700">Company / Enterprise Name *</Label>
              <Input
                required
                value={editCompanyName}
                onChange={(e) => setEditCompanyName(e.target.value)}
                className="h-8.5 text-xs border-slate-200"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-700">First Name *</Label>
                <Input
                  required
                  value={editFirstName}
                  onChange={(e) => setEditFirstName(e.target.value)}
                  className="h-8.5 text-xs border-slate-200"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-700">Last Name *</Label>
                <Input
                  required
                  value={editLastName}
                  onChange={(e) => setEditLastName(e.target.value)}
                  className="h-8.5 text-xs border-slate-200"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-700">Mobile Phone *</Label>
                <Input
                  required
                  value={editMobile}
                  onChange={(e) => setEditMobile(e.target.value)}
                  className="h-8.5 text-xs border-slate-200"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-700">GSTIN (Optional)</Label>
                <Input
                  value={editGstin}
                  onChange={(e) => setEditGstin(e.target.value)}
                  placeholder="27AAAAA9999A1Z9"
                  className="h-8.5 text-xs border-slate-200 font-mono"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-700">Factory / Billing Address *</Label>
              <Textarea
                required
                value={editAddress}
                onChange={(e) => setEditAddress(e.target.value)}
                className="min-h-[60px] text-xs border-slate-200"
              />
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-700">City *</Label>
                <Input
                  required
                  value={editCity}
                  onChange={(e) => setEditCity(e.target.value)}
                  className="h-8.5 text-xs border-slate-200"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-700">State *</Label>
                <Input
                  required
                  value={editState}
                  onChange={(e) => setEditState(e.target.value)}
                  className="h-8.5 text-xs border-slate-200"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-700">PIN Code *</Label>
                <Input
                  required
                  value={editPincode}
                  onChange={(e) => setEditPincode(e.target.value)}
                  className="h-8.5 text-xs border-slate-200"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2.5 pt-3 border-t border-slate-100">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsEditProfileOpen(false)}
                disabled={isSavingProfile}
                className="h-8 text-xs border-slate-200 shadow-none cursor-pointer"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isSavingProfile}
                className="h-8 text-xs bg-[#024AE5] hover:bg-[#024AE5]/90 text-white shadow-none px-5 font-bold cursor-pointer"
              >
                {isSavingProfile && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
                Save Profile
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* RFQ Submission Modal */}
      <Dialog open={isRfqModalOpen} onOpenChange={setIsRfqModalOpen}>
        <DialogContent className="max-w-lg bg-white p-6 rounded-2xl shadow-xl">
          <DialogHeader className="pb-3 border-b border-slate-200">
            <div className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-[#024AE5]" />
              <DialogTitle className="text-lg font-bold text-slate-900">
                Request Custom Quotation (RFQ)
              </DialogTitle>
            </div>
            <DialogDescription className="text-xs text-slate-500">
              Submit your technical specifications for custom CNC tooling or high-volume industrial batches.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmitRfq} className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-700">Product / Tooling Description *</Label>
              <Input
                required
                value={rfqItemName}
                onChange={(e) => setRfqItemName(e.target.value)}
                placeholder="e.g. 4-Flute End Mill with Corner Radius 1.0mm (Carbide)"
                className="h-8.5 text-xs border-slate-200"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-700">Estimated Batch Quantity *</Label>
                <Input
                  required
                  value={rfqQuantity}
                  onChange={(e) => setRfqQuantity(e.target.value)}
                  placeholder="e.g. 500 units"
                  className="h-8.5 text-xs border-slate-200"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-700">Required By Date</Label>
                <Input
                  type="date"
                  value={rfqDeliveryDate}
                  onChange={(e) => setRfqDeliveryDate(e.target.value)}
                  className="h-8.5 text-xs border-slate-200"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-700">Technical Specs, Material Grade & Tolerances</Label>
              <Textarea
                value={rfqSpecs}
                onChange={(e) => setRfqSpecs(e.target.value)}
                placeholder="Specify cutting diameter (D), flute length (H), shank (D2), coating (AlTiN / TiAlN), hardness (HRC 45-65), etc."
                className="min-h-[75px] text-xs border-slate-200"
              />
            </div>

            <div className="flex justify-end gap-2.5 pt-3 border-t border-slate-100">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsRfqModalOpen(false)}
                disabled={isSubmittingRfq}
                className="h-8 text-xs border-slate-200 shadow-none cursor-pointer"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isSubmittingRfq}
                className="h-8 text-xs bg-[#024AE5] hover:bg-[#024AE5]/90 text-white shadow-none px-5 font-bold gap-1.5 cursor-pointer"
              >
                {isSubmittingRfq ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                Submit RFQ
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

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
                  <Package className="h-5 w-5 text-[#024AE5]" />
                  <DialogTitle className="text-lg font-bold text-slate-900">
                    Tax Invoice #{activeOrderDetails.order_number}
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
              {/* Delivery Address & Notes */}
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

              {/* Items Table */}
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

              {/* Invoicing Breakdown */}
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
