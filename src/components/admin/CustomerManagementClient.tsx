"use client";

import { useState, useTransition } from "react";
import { Profile, ApprovalStatus, UserType, UserTitle } from "@/types/database.types";
import { updateCustomerApprovalStatus, createOfflineCustomer } from "@/actions/customer";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  Search,
  UserPlus,
  Users,
  Globe,
  Store,
  Clock,
  CheckCircle2,
  XCircle,
  Eye,
  Filter,
  Download,
  Building2,
  Phone,
  Mail,
  MapPin,
  FileText,
  X,
  CreditCard,
  Check,
  AlertCircle,
} from "lucide-react";

interface CustomerManagementClientProps {
  initialCustomers: Profile[];
}

export function CustomerManagementClient({ initialCustomers }: CustomerManagementClientProps) {
  const [customers, setCustomers] = useState<Profile[]>(initialCustomers);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedUserType, setSelectedUserType] = useState<string>("all");
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [isPending, startTransition] = useTransition();

  // Modal State
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [viewingCustomer, setViewingCustomer] = useState<Profile | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);

  // Statistics calculation
  const totalCount = customers.length;
  const platformCount = customers.filter((c) => (c.user_type || "platform_user") === "platform_user").length;
  const offlineCount = customers.filter((c) => c.user_type === "offline_user").length;
  const pendingCount = customers.filter((c) => (c.approval_status || "pending") === "pending" && c.role !== "platform_owner").length;

  // Filtered List
  const filteredCustomers = customers.filter((c) => {
    // Exclude platform admin from customer table
    if (c.role === "platform_owner") return false;

    // Search query filter
    const query = searchQuery.toLowerCase().trim();
    const matchesSearch =
      !query ||
      c.company_name?.toLowerCase().includes(query) ||
      c.first_name?.toLowerCase().includes(query) ||
      c.last_name?.toLowerCase().includes(query) ||
      c.email?.toLowerCase().includes(query) ||
      c.mobile?.toLowerCase().includes(query) ||
      c.gstin?.toLowerCase().includes(query) ||
      c.city?.toLowerCase().includes(query) ||
      c.state?.toLowerCase().includes(query);

    // User Type filter
    const userType = c.user_type || "platform_user";
    const matchesType = selectedUserType === "all" || userType === selectedUserType;

    // Approval Status filter
    const status = c.approval_status || "approved";
    const matchesStatus = selectedStatus === "all" || status === selectedStatus;

    return matchesSearch && matchesType && matchesStatus;
  });

  // Handle Quick Approval / Rejection
  const handleStatusChange = (customerId: string, newStatus: ApprovalStatus) => {
    startTransition(async () => {
      // Optimistic state update
      setCustomers((prev) =>
        prev.map((c) => (c.id === customerId ? { ...c, approval_status: newStatus } : c))
      );
      if (viewingCustomer && viewingCustomer.id === customerId) {
        setViewingCustomer((prev) => (prev ? { ...prev, approval_status: newStatus } : null));
      }
      await updateCustomerApprovalStatus(customerId, newStatus);
    });
  };

  // Handle Add Offline Customer Form Submission
  const handleAddOfflineCustomer = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setFormError(null);
    setFormSuccess(null);
    const formData = new FormData(e.currentTarget);

    startTransition(async () => {
      const res = await createOfflineCustomer(formData);
      if (res.error) {
        setFormError(res.error);
      } else {
        setFormSuccess(res.message || "Customer added successfully!");
        setTimeout(() => {
          setIsAddModalOpen(false);
          setFormSuccess(null);
          // Reload local state
          const newCust: Profile = {
            id: `off-${Date.now()}`,
            role: "customer",
            title: (formData.get("title") as UserTitle) || "Mr",
            first_name: (formData.get("first_name") as string) || "",
            last_name: (formData.get("last_name") as string) || "",
            company_name: (formData.get("company_name") as string) || "",
            email: (formData.get("email") as string) || "",
            mobile: (formData.get("mobile") as string) || "",
            designation: (formData.get("designation") as string) || "Commercial Contact",
            department: (formData.get("department") as string) || "Procurement",
            company_address: (formData.get("company_address") as string) || "",
            city: (formData.get("city") as string) || "",
            state: (formData.get("state") as string) || "",
            pincode: (formData.get("pincode") as string) || "",
            gstin: (formData.get("gstin") as string) || null,
            approval_status: "approved",
            user_type: "offline_user",
            credit_limit: Number(formData.get("credit_limit")) || 500000,
            credit_days: Number(formData.get("credit_days")) || 30,
            created_at: new Date().toISOString(),
          };
          setCustomers((prev) => [newCust, ...prev]);
        }, 800);
      }
    });
  };

  return (
    <div className="space-y-6 w-full">
      {/* Page Header with Action Buttons */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Customers Directory
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Manage verified platform accounts, pending onboarding signups, and offline client billing records.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              // Quick CSV export
              const csvContent =
                "data:text/csv;charset=utf-8," +
                ["Company,Name,Email,Mobile,GSTIN,City,Type,Status"]
                  .concat(
                    filteredCustomers.map(
                      (c) =>
                        `"${c.company_name}","${c.title} ${c.first_name} ${c.last_name}","${c.email}","${c.mobile}","${c.gstin || "-"}","${c.city}","${c.user_type || "platform_user"}","${c.approval_status || "approved"}"`
                    )
                  )
                  .join("\n");
              const encodedUri = encodeURI(csvContent);
              const link = document.createElement("a");
              link.setAttribute("href", encodedUri);
              link.setAttribute("download", `customers_export_${new Date().toISOString().slice(0, 10)}.csv`);
              document.body.appendChild(link);
              link.click();
              document.body.removeChild(link);
            }}
            className="gap-1.5 text-xs border-slate-200 text-slate-700 hover:bg-slate-50 shadow-none cursor-pointer"
          >
            <Download className="h-4 w-4 text-slate-500" />
            <span>Export CSV</span>
          </Button>

          <Button
            type="button"
            size="sm"
            onClick={() => {
              setFormError(null);
              setFormSuccess(null);
              setIsAddModalOpen(true);
            }}
            className="gap-2 text-xs bg-[#024AE5] text-white hover:bg-[#023ecc] shadow-none cursor-pointer font-medium"
          >
            <UserPlus className="h-4 w-4" />
            <span>+ Add Offline Customer</span>
          </Button>
        </div>
      </div>

      {/* KPI Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Customers */}
        <Card
          onClick={() => {
            setSelectedUserType("all");
            setSelectedStatus("all");
          }}
          className="border-slate-200/80 bg-white shadow-none rounded-xl p-4 cursor-pointer hover:border-[#024AE5]/40 transition-colors"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                Total Customers
              </p>
              <h3 className="text-2xl font-bold text-slate-900 mt-1">{totalCount}</h3>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-700">
              <Users className="h-5 w-5" />
            </div>
          </div>
          <p className="text-[11px] text-slate-500 mt-2">Active business accounts</p>
        </Card>

        {/* Platform Users */}
        <Card
          onClick={() => {
            setSelectedUserType("platform_user");
            setSelectedStatus("all");
          }}
          className={`border-slate-200/80 bg-white shadow-none rounded-xl p-4 cursor-pointer transition-colors ${
            selectedUserType === "platform_user" ? "border-[#024AE5] ring-1 ring-[#024AE5]" : "hover:border-[#024AE5]/40"
          }`}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                Platform Users
              </p>
              <h3 className="text-2xl font-bold text-[#024AE5] mt-1">{platformCount}</h3>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#024AE5]/10 text-[#024AE5]">
              <Globe className="h-5 w-5" />
            </div>
          </div>
          <p className="text-[11px] text-slate-500 mt-2">Website online portal signups</p>
        </Card>

        {/* Offline Users */}
        <Card
          onClick={() => {
            setSelectedUserType("offline_user");
            setSelectedStatus("all");
          }}
          className={`border-slate-200/80 bg-white shadow-none rounded-xl p-4 cursor-pointer transition-colors ${
            selectedUserType === "offline_user" ? "border-[#3C8B4F] ring-1 ring-[#3C8B4F]" : "hover:border-[#3C8B4F]/40"
          }`}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                Offline Customers
              </p>
              <h3 className="text-2xl font-bold text-[#3C8B4F] mt-1">{offlineCount}</h3>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#3C8B4F]/10 text-[#3C8B4F]">
              <Store className="h-5 w-5" />
            </div>
          </div>
          <p className="text-[11px] text-slate-500 mt-2">ERP billing & dispatch clients</p>
        </Card>

        {/* Pending Approvals */}
        <Card
          onClick={() => {
            setSelectedStatus("pending");
            setSelectedUserType("all");
          }}
          className={`border-slate-200/80 bg-white shadow-none rounded-xl p-4 cursor-pointer transition-colors ${
            selectedStatus === "pending" ? "border-amber-500 ring-1 ring-amber-500" : "hover:border-amber-400"
          }`}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                Pending Approval
              </p>
              <h3 className="text-2xl font-bold text-amber-600 mt-1">{pendingCount}</h3>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
              <Clock className="h-5 w-5" />
            </div>
          </div>
          <p className="text-[11px] text-amber-700 font-medium mt-2">
            {pendingCount > 0 ? "Requires admin review" : "All accounts verified"}
          </p>
        </Card>
      </div>

      {/* Filter & Search Bar */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 bg-white p-3.5 rounded-xl border border-slate-200 shadow-none">
        {/* Search Input */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
          <Input
            type="text"
            placeholder="Search company, contact name, email, phone, GSTIN, city..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 h-9 text-xs bg-slate-50 border-slate-200 focus-visible:bg-white focus-visible:ring-[#024AE5]"
          />
        </div>

        {/* Dropdown Filters */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* User Type Filter */}
          <div className="flex items-center gap-1.5">
            <Filter className="h-3.5 w-3.5 text-slate-400" />
            <span className="text-xs text-slate-500 font-medium">Type:</span>
            <select
              value={selectedUserType}
              onChange={(e) => setSelectedUserType(e.target.value)}
              className="h-9 rounded-lg border border-slate-200 bg-white px-2.5 text-xs text-slate-700 focus:border-[#024AE5] focus:outline-hidden"
            >
              <option value="all">All Types</option>
              <option value="platform_user">Platform User (Online)</option>
              <option value="offline_user">Offline User (Billing)</option>
            </select>
          </div>

          {/* Status Filter */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-slate-500 font-medium">Status:</span>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="h-9 rounded-lg border border-slate-200 bg-white px-2.5 text-xs text-slate-700 focus:border-[#024AE5] focus:outline-hidden"
            >
              <option value="all">All Statuses</option>
              <option value="approved">Approved</option>
              <option value="pending">Pending Approval</option>
              <option value="rejected">Rejected</option>
            </select>
          </div>

          {(searchQuery || selectedUserType !== "all" || selectedStatus !== "all") && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setSearchQuery("");
                setSelectedUserType("all");
                setSelectedStatus("all");
              }}
              className="text-xs text-slate-500 hover:text-slate-900 h-9 px-2"
            >
              Reset Filters
            </Button>
          )}
        </div>
      </div>

      {/* Customers Data Table */}
      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-none">
        <Table>
          <TableHeader className="bg-slate-50/80">
            <TableRow>
              <TableHead className="text-xs font-semibold text-slate-700 py-3.5">Customer & Company</TableHead>
              <TableHead className="text-xs font-semibold text-slate-700 py-3.5">Contact Details</TableHead>
              <TableHead className="text-xs font-semibold text-slate-700 py-3.5">User Type</TableHead>
              <TableHead className="text-xs font-semibold text-slate-700 py-3.5">Approval Status</TableHead>
              <TableHead className="text-xs font-semibold text-slate-700 py-3.5">Credit Terms</TableHead>
              <TableHead className="text-xs font-semibold text-slate-700 py-3.5">Location</TableHead>
              <TableHead className="text-xs font-semibold text-slate-700 py-3.5 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredCustomers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-12 text-slate-500">
                  <div className="flex flex-col items-center justify-center space-y-2">
                    <Users className="h-8 w-8 text-slate-300" />
                    <p className="text-sm font-medium text-slate-700">No customers found</p>
                    <p className="text-xs text-slate-400">
                      Try adjusting your search criteria or add an offline customer.
                    </p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              filteredCustomers.map((customer) => {
                const userType = customer.user_type || "platform_user";
                const approvalStatus = customer.approval_status || "approved";

                return (
                  <TableRow key={customer.id} className="hover:bg-slate-50/60 transition-colors">
                    {/* Customer & Company */}
                    <TableCell className="py-3">
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-700 font-semibold text-xs border border-slate-200">
                          {customer.first_name?.[0] || "C"}
                          {customer.last_name?.[0] || ""}
                        </div>
                        <div>
                          <div className="font-semibold text-xs text-slate-900 leading-tight">
                            {customer.title} {customer.first_name} {customer.last_name}
                          </div>
                          <div className="text-[11px] text-slate-600 font-medium flex items-center gap-1.5 mt-0.5">
                            <Building2 className="h-3 w-3 text-slate-400 shrink-0" />
                            <span className="truncate max-w-[180px]">{customer.company_name}</span>
                          </div>
                          {customer.gstin && (
                            <span className="inline-block mt-0.5 text-[9px] font-mono font-semibold bg-slate-100 text-slate-600 px-1.5 py-0.2 rounded border border-slate-200">
                              GSTIN: {customer.gstin}
                            </span>
                          )}
                        </div>
                      </div>
                    </TableCell>

                    {/* Contact Details */}
                    <TableCell className="py-3">
                      <div className="space-y-1 text-xs">
                        <div className="flex items-center gap-1.5 text-slate-700">
                          <Mail className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                          <span className="truncate max-w-[180px]">{customer.email}</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-slate-600">
                          <Phone className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                          <span>{customer.mobile}</span>
                        </div>
                      </div>
                    </TableCell>

                    {/* User Type */}
                    <TableCell className="py-3">
                      {userType === "platform_user" ? (
                        <Badge className="bg-[#024AE5]/10 text-[#024AE5] border-0 gap-1 text-[10px] font-semibold py-0.5">
                          <Globe className="h-3 w-3" /> Platform User
                        </Badge>
                      ) : (
                        <Badge className="bg-[#3C8B4F]/10 text-[#3C8B4F] border-0 gap-1 text-[10px] font-semibold py-0.5">
                          <Store className="h-3 w-3" /> Offline User
                        </Badge>
                      )}
                    </TableCell>

                    {/* Approval Status */}
                    <TableCell className="py-3">
                      {approvalStatus === "approved" && (
                        <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 gap-1 text-[10px] font-semibold py-0.5">
                          <CheckCircle2 className="h-3 w-3 text-emerald-600" /> Approved
                        </Badge>
                      )}
                      {approvalStatus === "pending" && (
                        <Badge className="bg-amber-50 text-amber-700 border-amber-200 gap-1 text-[10px] font-semibold py-0.5 animate-pulse">
                          <Clock className="h-3 w-3 text-amber-600" /> Pending Review
                        </Badge>
                      )}
                      {approvalStatus === "rejected" && (
                        <Badge className="bg-rose-50 text-rose-700 border-rose-200 gap-1 text-[10px] font-semibold py-0.5">
                          <XCircle className="h-3 w-3 text-rose-600" /> Rejected
                        </Badge>
                      )}
                    </TableCell>

                    {/* Credit Terms */}
                    <TableCell className="py-3">
                      <div className="text-xs">
                        <div className="font-semibold text-slate-900">
                          ₹{(customer.credit_limit || 500000).toLocaleString("en-IN")}
                        </div>
                        <div className="text-[10px] text-slate-400">
                          {customer.credit_days || 30} Days Net Credit
                        </div>
                      </div>
                    </TableCell>

                    {/* Location */}
                    <TableCell className="py-3">
                      <div className="text-xs text-slate-700 flex items-center gap-1">
                        <MapPin className="h-3 w-3 text-slate-400 shrink-0" />
                        <span>
                          {customer.city}, {customer.state}
                        </span>
                      </div>
                    </TableCell>

                    {/* Actions */}
                    <TableCell className="py-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {/* Quick Approve / Reject for Pending Accounts */}
                        {approvalStatus === "pending" && (
                          <>
                            <Button
                              type="button"
                              size="icon"
                              title="Approve Customer"
                              disabled={isPending}
                              onClick={() => handleStatusChange(customer.id, "approved")}
                              className="h-7 w-7 bg-emerald-600 text-white hover:bg-emerald-700 cursor-pointer shadow-none"
                            >
                              <Check className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              type="button"
                              size="icon"
                              title="Reject Customer"
                              disabled={isPending}
                              onClick={() => handleStatusChange(customer.id, "rejected")}
                              className="h-7 w-7 bg-rose-600 text-white hover:bg-rose-700 cursor-pointer shadow-none"
                            >
                              <X className="h-3.5 w-3.5" />
                            </Button>
                          </>
                        )}

                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setViewingCustomer(customer)}
                          className="h-7 text-xs px-2.5 gap-1 border-slate-200 text-slate-700 hover:bg-slate-100 shadow-none cursor-pointer"
                        >
                          <Eye className="h-3.5 w-3.5 text-slate-500" />
                          <span>View</span>
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

      {/* MODAL 1: ADD OFFLINE CUSTOMER (Exact same registration form fields, no auth account created) */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="relative w-full max-w-3xl rounded-2xl bg-white p-6 shadow-2xl border border-slate-200 my-8 max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-200 pb-4 mb-5">
              <div>
                <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <Store className="h-5 w-5 text-[#3C8B4F]" />
                  Add Offline Customer Profile
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Register a direct / offline business account for ERP invoicing, dispatch, billing, and ledger.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Offline Account Notice Banner */}
            <div className="mb-5 rounded-xl bg-blue-50/80 p-3.5 border border-blue-100 flex items-start gap-3 text-xs text-blue-800">
              <AlertCircle className="h-4 w-4 text-[#024AE5] shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold text-blue-900">ERP & Commercial Account Note: </span>
                This profile is created directly in the customer database for quotes, invoices, and ledger tracking.
                No website portal password or login credentials will be generated.
              </div>
            </div>

            {formError && (
              <div className="mb-4 rounded-xl bg-rose-50 p-3 text-xs text-rose-700 border border-rose-200">
                {formError}
              </div>
            )}
            {formSuccess && (
              <div className="mb-4 rounded-xl bg-emerald-50 p-3 text-xs text-emerald-700 border border-emerald-200">
                {formSuccess}
              </div>
            )}

            {/* Same Registration Form */}
            <form onSubmit={handleAddOfflineCustomer} className="space-y-6">
              {/* Section 1: Company Profile */}
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-3 flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-[#024AE5]" />
                  1. Company & Tax Details
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label className="text-xs font-medium text-slate-700">
                      Company Name <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      name="company_name"
                      required
                      className="h-9 text-xs border-slate-200"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-slate-700">
                      GSTIN (Optional)
                    </Label>
                    <Input
                      name="gstin"
                      className="h-9 text-xs border-slate-200 font-mono"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-slate-700">
                      Department / Industry Sector
                    </Label>
                    <Input
                      name="department"
                      defaultValue="Procurement & Fabrication"
                      className="h-9 text-xs border-slate-200"
                    />
                  </div>

                  <div className="space-y-1.5 sm:col-span-2">
                    <Label className="text-xs font-medium text-slate-700">
                      Registered Billing Address <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      name="company_address"
                      required
                      className="h-9 text-xs border-slate-200"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-slate-700">
                      City <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      name="city"
                      required
                      className="h-9 text-xs border-slate-200"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium text-slate-700">
                        State <span className="text-red-500">*</span>
                      </Label>
                      <Input
                        name="state"
                        required
                        className="h-9 text-xs border-slate-200"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium text-slate-700">
                        PIN Code <span className="text-red-500">*</span>
                      </Label>
                      <Input
                        name="pincode"
                        required
                        className="h-9 text-xs border-slate-200"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Section 2: Contact Person */}
              <div className="border-t border-slate-100 pt-4">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-3 flex items-center gap-2">
                  <Users className="h-4 w-4 text-[#024AE5]" />
                  2. Primary Contact Person
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-4">
                  {/* Title */}
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label className="text-xs font-medium text-slate-700">Title</Label>
                    <select
                      name="title"
                      className="h-9 w-full rounded-md border border-slate-200 bg-white px-2 text-xs text-slate-700 focus:outline-hidden"
                    >
                      <option value="Mr">Mr</option>
                      <option value="Mrs">Mrs</option>
                      <option value="Miss">Miss</option>
                      <option value="Ms">Ms</option>
                    </select>
                  </div>

                  {/* First Name */}
                  <div className="space-y-1.5 sm:col-span-5">
                    <Label className="text-xs font-medium text-slate-700">
                      First Name <span className="text-red-500">*</span>
                    </Label>
                    <Input name="first_name" required className="h-9 text-xs border-slate-200" />
                  </div>

                  {/* Last Name */}
                  <div className="space-y-1.5 sm:col-span-5">
                    <Label className="text-xs font-medium text-slate-700">
                      Last Name <span className="text-red-500">*</span>
                    </Label>
                    <Input name="last_name" required className="h-9 text-xs border-slate-200" />
                  </div>

                  {/* Designation */}
                  <div className="space-y-1.5 sm:col-span-6">
                    <Label className="text-xs font-medium text-slate-700">Designation</Label>
                    <Input name="designation" defaultValue="Commercial Manager" className="h-9 text-xs border-slate-200" />
                  </div>

                  {/* Official Email */}
                  <div className="space-y-1.5 sm:col-span-6">
                    <Label className="text-xs font-medium text-slate-700">
                      Official Email ID <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      type="email"
                      name="email"
                      required
                      placeholder="name@company.com"
                      className="h-9 text-xs border-slate-200"
                    />
                  </div>

                  {/* Mobile */}
                  <div className="space-y-1.5 sm:col-span-6">
                    <Label className="text-xs font-medium text-slate-700">
                      Mobile Number <span className="text-red-500">*</span>
                    </Label>
                    <Input name="mobile" required className="h-9 text-xs border-slate-200" />
                  </div>

                  {/* Landline */}
                  <div className="space-y-1.5 sm:col-span-6">
                    <Label className="text-xs font-medium text-slate-700">Landline (Optional)</Label>
                    <Input name="landline" className="h-9 text-xs border-slate-200" />
                  </div>
                </div>
              </div>

              {/* Section 3: Commercial & Credit Terms */}
              <div className="border-t border-slate-100 pt-4">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-3 flex items-center gap-2">
                  <CreditCard className="h-4 w-4 text-[#024AE5]" />
                  3. Commercial & Credit Parameters
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-slate-700">Credit Limit (₹)</Label>
                    <Input
                      type="number"
                      name="credit_limit"
                      defaultValue="500000"
                      className="h-9 text-xs border-slate-200 font-semibold"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-slate-700">Credit Payment Terms (Days)</Label>
                    <Input
                      type="number"
                      name="credit_days"
                      defaultValue="30"
                      className="h-9 text-xs border-slate-200"
                    />
                  </div>
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label className="text-xs font-medium text-slate-700">Internal Account Notes</Label>
                    <Input
                      name="notes"
                      className="h-9 text-xs border-slate-200"
                    />
                  </div>
                </div>
              </div>

              {/* Submit Buttons */}
              <div className="flex items-center justify-end gap-3 border-t border-slate-200 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsAddModalOpen(false)}
                  className="text-xs border-slate-200"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={isPending}
                  className="text-xs bg-[#024AE5] text-white hover:bg-[#023ecc] font-medium"
                >
                  {isPending ? "Saving Account..." : "Save Offline Customer"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: VIEW / MANAGE CUSTOMER DETAILS */}
      {viewingCustomer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="relative w-full max-w-2xl rounded-2xl bg-white p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-200 pb-4 mb-4">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#024AE5]/10 text-[#024AE5] font-bold text-sm">
                  {viewingCustomer.first_name?.[0]}
                  {viewingCustomer.last_name?.[0]}
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    {viewingCustomer.title} {viewingCustomer.first_name} {viewingCustomer.last_name}
                  </h3>
                  <p className="text-xs text-slate-500">
                    {viewingCustomer.designation} • {viewingCustomer.company_name}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setViewingCustomer(null)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Approval & Type Status Row */}
            <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-50 p-3.5 rounded-xl border border-slate-100 mb-4">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-slate-700">Account Type:</span>
                {viewingCustomer.user_type === "offline_user" ? (
                  <Badge className="bg-[#3C8B4F]/10 text-[#3C8B4F] border-0 text-[10px]">Offline Account</Badge>
                ) : (
                  <Badge className="bg-[#024AE5]/10 text-[#024AE5] border-0 text-[10px]">Platform Portal User</Badge>
                )}
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-slate-700">Approval:</span>
                <select
                  value={viewingCustomer.approval_status || "approved"}
                  onChange={(e) =>
                    handleStatusChange(viewingCustomer.id, e.target.value as ApprovalStatus)
                  }
                  className="h-8 rounded-md border border-slate-200 bg-white px-2 text-xs font-semibold text-slate-800"
                >
                  <option value="approved">Approved</option>
                  <option value="pending">Pending Review</option>
                  <option value="rejected">Rejected</option>
                </select>
              </div>
            </div>

            {/* Details Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div className="space-y-1">
                <span className="text-slate-400 font-medium">Official Email</span>
                <p className="font-semibold text-slate-800">{viewingCustomer.email}</p>
              </div>
              <div className="space-y-1">
                <span className="text-slate-400 font-medium">Mobile Phone</span>
                <p className="font-semibold text-slate-800">{viewingCustomer.mobile}</p>
              </div>
              <div className="space-y-1">
                <span className="text-slate-400 font-medium">GSTIN</span>
                <p className="font-mono font-semibold text-slate-800">{viewingCustomer.gstin || "Not Registered / N/A"}</p>
              </div>
              <div className="space-y-1">
                <span className="text-slate-400 font-medium">Department</span>
                <p className="font-semibold text-slate-800">{viewingCustomer.department}</p>
              </div>
              <div className="space-y-1 sm:col-span-2">
                <span className="text-slate-400 font-medium">Registered Address</span>
                <p className="text-slate-800">
                  {viewingCustomer.company_address}, {viewingCustomer.city}, {viewingCustomer.state} - {viewingCustomer.pincode}
                </p>
              </div>
              <div className="space-y-1">
                <span className="text-slate-400 font-medium">Credit Limit</span>
                <p className="font-bold text-slate-900 text-sm">
                  ₹{(viewingCustomer.credit_limit || 500000).toLocaleString("en-IN")}
                </p>
              </div>
              <div className="space-y-1">
                <span className="text-slate-400 font-medium">Credit Payment Terms</span>
                <p className="font-semibold text-slate-800">{viewingCustomer.credit_days || 30} Days Net</p>
              </div>
              {viewingCustomer.notes && (
                <div className="space-y-1 sm:col-span-2 bg-slate-50 p-3 rounded-lg border border-slate-100">
                  <span className="text-slate-400 font-medium">Internal Notes</span>
                  <p className="text-slate-700 italic">{viewingCustomer.notes}</p>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-3 border-t border-slate-200 pt-4 mt-6">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setViewingCustomer(null)}
                className="text-xs"
              >
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
