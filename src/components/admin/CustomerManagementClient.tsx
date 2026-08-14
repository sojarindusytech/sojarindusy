"use client";

import { useState, useTransition, useMemo } from "react";
import { Profile } from "@/types/database.types";
import {
  USER_TYPES,
  USER_TYPE_CONFIG,
  APPROVAL_STATUSES,
  APPROVAL_STATUS_CONFIG,
  USER_TITLES,
  COMMERCIAL_DEFAULTS,
  DEPARTMENT_OPTIONS,
  INDIAN_STATES,
  ApprovalStatus,
  UserType,
  UserTitle,
} from "@/lib/constants";
import { updateCustomerApprovalStatus, createOfflineCustomer } from "@/actions/customer";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  Eye,
  Filter,
  Download,
  Building2,
  Phone,
  Mail,
  MapPin,
  X,
  CreditCard,
  Check,
  AlertCircle,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Calendar,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

interface CustomerManagementClientProps {
  initialCustomers: Profile[];
}

type SortField = "name" | "type" | "status" | "date" | "location";
type SortDirection = "asc" | "desc";

export function CustomerManagementClient({ initialCustomers }: CustomerManagementClientProps) {
  const [customers, setCustomers] = useState<Profile[]>(initialCustomers);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedUserType, setSelectedUserType] = useState<string>("all");
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [isPending, startTransition] = useTransition();

  // Sorting State
  const [sortField, setSortField] = useState<SortField>("date");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

  // Pagination State
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [itemsPerPage, setItemsPerPage] = useState<number>(10);

  // Modal & Form State
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [viewingCustomer, setViewingCustomer] = useState<Profile | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);

  // Form select values
  const [formTitle, setFormTitle] = useState<UserTitle>(USER_TITLES[0]);
  const [formDept, setFormDept] = useState<string>(DEPARTMENT_OPTIONS[0]);
  const [formState, setFormState] = useState<string>("Maharashtra");
  const [formCreditDays, setFormCreditDays] = useState<string>(
    String(COMMERCIAL_DEFAULTS.DEFAULT_CREDIT_DAYS)
  );

  // Statistics calculation
  const totalCount = customers.length;
  const platformCount = customers.filter(
    (c) => (c.user_type || USER_TYPES.PLATFORM_USER) === USER_TYPES.PLATFORM_USER
  ).length;
  const offlineCount = customers.filter(
    (c) => c.user_type === USER_TYPES.OFFLINE_USER
  ).length;
  const pendingCount = customers.filter(
    (c) => (c.approval_status || APPROVAL_STATUSES.PENDING) === APPROVAL_STATUSES.PENDING && c.role !== "platform_owner"
  ).length;

  // Filtered & Sorted List
  const filteredAndSortedCustomers = useMemo(() => {
    const result = customers.filter((c) => {
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
      const userType = c.user_type || USER_TYPES.PLATFORM_USER;
      const matchesType = selectedUserType === "all" || userType === selectedUserType;

      // Approval Status filter
      const status = c.approval_status || APPROVAL_STATUSES.APPROVED;
      const matchesStatus = selectedStatus === "all" || status === selectedStatus;

      return matchesSearch && matchesType && matchesStatus;
    });

    // Apply Sorting
    result.sort((a, b) => {
      let comparison = 0;
      if (sortField === "name") {
        const nameA = (a.company_name || a.first_name || "").toLowerCase();
        const nameB = (b.company_name || b.first_name || "").toLowerCase();
        comparison = nameA.localeCompare(nameB);
      } else if (sortField === "type") {
        const typeA = a.user_type || USER_TYPES.PLATFORM_USER;
        const typeB = b.user_type || USER_TYPES.PLATFORM_USER;
        comparison = typeA.localeCompare(typeB);
      } else if (sortField === "status") {
        const statusA = a.approval_status || APPROVAL_STATUSES.PENDING;
        const statusB = b.approval_status || APPROVAL_STATUSES.PENDING;
        comparison = statusA.localeCompare(statusB);
      } else if (sortField === "date") {
        const dateA = a.created_at ? new Date(a.created_at).getTime() : 0;
        const dateB = b.created_at ? new Date(b.created_at).getTime() : 0;
        comparison = dateA - dateB;
      } else if (sortField === "location") {
        const locA = `${a.city || ""}, ${a.state || ""}`.toLowerCase();
        const locB = `${b.city || ""}, ${b.state || ""}`.toLowerCase();
        comparison = locA.localeCompare(locB);
      }

      return sortDirection === "asc" ? comparison : -comparison;
    });

    return result;
  }, [customers, searchQuery, selectedUserType, selectedStatus, sortField, sortDirection]);

  // Pagination Calculations
  const totalItems = filteredAndSortedCustomers.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / itemsPerPage));
  const validCurrentPage = Math.min(currentPage, totalPages);

  const paginatedCustomers = useMemo(() => {
    const startIndex = (validCurrentPage - 1) * itemsPerPage;
    return filteredAndSortedCustomers.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredAndSortedCustomers, validCurrentPage, itemsPerPage]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  const getSortIcon = (field: SortField) => {
    if (sortField !== field) {
      return <ArrowUpDown className="h-3 w-3 text-slate-400 opacity-60 ml-1 inline-block" />;
    }
    return sortDirection === "asc" ? (
      <ArrowUp className="h-3 w-3 text-[#024AE5] ml-1 inline-block" />
    ) : (
      <ArrowDown className="h-3 w-3 text-[#024AE5] ml-1 inline-block" />
    );
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return "—";
    try {
      const d = new Date(dateString);
      return d.toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      });
    } catch {
      return "—";
    }
  };

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
    formData.set("title", formTitle);
    formData.set("department", formDept);
    formData.set("state", formState);
    formData.set("credit_days", formCreditDays);

    startTransition(async () => {
      const res = await createOfflineCustomer(formData);
      if (res.error) {
        setFormError(res.error);
      } else {
        setFormSuccess(res.message || "Customer added successfully!");
        setTimeout(() => {
          setIsAddModalOpen(false);
          setFormSuccess(null);
          const newCust: Profile = {
            id: `off-${Date.now()}`,
            role: "customer",
            title: formTitle,
            first_name: (formData.get("first_name") as string) || "",
            last_name: (formData.get("last_name") as string) || "",
            company_name: (formData.get("company_name") as string) || "",
            email: (formData.get("email") as string) || "",
            mobile: (formData.get("mobile") as string) || "",
            designation: (formData.get("designation") as string) || "Commercial Contact",
            department: formDept,
            company_address: (formData.get("company_address") as string) || "",
            city: (formData.get("city") as string) || "",
            state: formState,
            pincode: (formData.get("pincode") as string) || "",
            gstin: (formData.get("gstin") as string) || null,
            approval_status: APPROVAL_STATUSES.APPROVED,
            user_type: USER_TYPES.OFFLINE_USER,
            credit_limit: Number(formData.get("credit_limit")) || COMMERCIAL_DEFAULTS.DEFAULT_CREDIT_LIMIT,
            credit_days: Number(formCreditDays) || COMMERCIAL_DEFAULTS.DEFAULT_CREDIT_DAYS,
            created_at: new Date().toISOString(),
          };
          setCustomers((prev) => [newCust, ...prev]);
        }, 800);
      }
    });
  };

  return (
    <div className="space-y-6 w-full max-w-full">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Customers Directory
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Manage verified platform accounts, pending onboarding signups, and offline client billing records.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              const csvContent =
                "data:text/csv;charset=utf-8," +
                ["Company,Name,Email,Mobile,GSTIN,City,State,Registered Date,Type,Status"]
                  .concat(
                    filteredAndSortedCustomers.map(
                      (c) =>
                        `"${c.company_name}","${c.title} ${c.first_name} ${c.last_name}","${c.email}","${c.mobile}","${c.gstin || "-"}","${c.city}","${c.state}","${formatDate(c.created_at)}","${c.user_type || USER_TYPES.PLATFORM_USER}","${c.approval_status || APPROVAL_STATUSES.APPROVED}"`
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
            <Download className="h-3.5 w-3.5 text-slate-500" />
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
            className="gap-1.5 text-xs bg-[#024AE5] text-white hover:bg-[#023ecc] shadow-none cursor-pointer font-medium"
          >
            <UserPlus className="h-3.5 w-3.5" />
            <span>+ Add Offline Customer</span>
          </Button>
        </div>
      </div>

      {/* KPI Metric Cards (Neutral Minimalist Styling) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Customers */}
        <Card
          onClick={() => {
            setSelectedUserType("all");
            setSelectedStatus("all");
            setCurrentPage(1);
          }}
          className={`border bg-white shadow-none rounded-xl p-4 cursor-pointer transition-all ${
            selectedUserType === "all" && selectedStatus === "all"
              ? "border-slate-300 ring-1 ring-slate-200"
              : "border-slate-200 hover:border-slate-300"
          }`}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] font-medium uppercase tracking-wider text-slate-500">
                Total Customers
              </p>
              <h3 className="text-2xl font-bold text-slate-900 mt-1">{totalCount}</h3>
            </div>
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 text-slate-600 border border-slate-200/60">
              <Users className="h-4 w-4" />
            </div>
          </div>
          <p className="text-[11px] text-slate-500 mt-2">Active business accounts</p>
        </Card>

        {/* Platform Users */}
        <Card
          onClick={() => {
            setSelectedUserType(USER_TYPES.PLATFORM_USER);
            setSelectedStatus("all");
            setCurrentPage(1);
          }}
          className={`border bg-white shadow-none rounded-xl p-4 cursor-pointer transition-all ${
            selectedUserType === USER_TYPES.PLATFORM_USER
              ? "border-slate-400 ring-1 ring-slate-300"
              : "border-slate-200 hover:border-slate-300"
          }`}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] font-medium uppercase tracking-wider text-slate-500">
                Platform Users
              </p>
              <h3 className="text-2xl font-bold text-slate-900 mt-1">{platformCount}</h3>
            </div>
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 text-slate-600 border border-slate-200/60">
              <Globe className="h-4 w-4" />
            </div>
          </div>
          <p className="text-[11px] text-slate-500 mt-2">Website online portal signups</p>
        </Card>

        {/* Offline Users */}
        <Card
          onClick={() => {
            setSelectedUserType(USER_TYPES.OFFLINE_USER);
            setSelectedStatus("all");
            setCurrentPage(1);
          }}
          className={`border bg-white shadow-none rounded-xl p-4 cursor-pointer transition-all ${
            selectedUserType === USER_TYPES.OFFLINE_USER
              ? "border-slate-400 ring-1 ring-slate-300"
              : "border-slate-200 hover:border-slate-300"
          }`}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] font-medium uppercase tracking-wider text-slate-500">
                Offline Customers
              </p>
              <h3 className="text-2xl font-bold text-slate-900 mt-1">{offlineCount}</h3>
            </div>
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 text-slate-600 border border-slate-200/60">
              <Store className="h-4 w-4" />
            </div>
          </div>
          <p className="text-[11px] text-slate-500 mt-2">Direct ERP & billing accounts</p>
        </Card>

        {/* Pending Approvals */}
        <Card
          onClick={() => {
            setSelectedStatus(APPROVAL_STATUSES.PENDING);
            setSelectedUserType("all");
            setCurrentPage(1);
          }}
          className={`border bg-white shadow-none rounded-xl p-4 cursor-pointer transition-all ${
            selectedStatus === APPROVAL_STATUSES.PENDING
              ? "border-amber-400 ring-1 ring-amber-200"
              : "border-slate-200 hover:border-slate-300"
          }`}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] font-medium uppercase tracking-wider text-slate-500">
                Pending Approval
              </p>
              <h3 className="text-2xl font-bold text-slate-900 mt-1">{pendingCount}</h3>
            </div>
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 text-slate-600 border border-slate-200/60">
              <Clock className="h-4 w-4" />
            </div>
          </div>
          <p className="text-[11px] text-slate-500 mt-2">
            {pendingCount > 0 ? "Requires review" : "All accounts verified"}
          </p>
        </Card>
      </div>

      {/* Filter & Search Toolbar */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 bg-white p-3 rounded-xl border border-slate-200 shadow-none">
        {/* Search Input (shadcn) */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
          <Input
            type="text"
            placeholder="Search company, contact name, email, phone, GSTIN, city..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setCurrentPage(1);
            }}
            className="pl-9 h-9 text-xs bg-slate-50/60 border-slate-200 focus-visible:bg-white focus-visible:ring-1 focus-visible:ring-slate-400"
          />
        </div>

        {/* Dropdown Filters */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* User Type Filter */}
          <div className="w-[160px]">
            <Select
              value={selectedUserType}
              onValueChange={(val) => {
                setSelectedUserType(val);
                setCurrentPage(1);
              }}
            >
              <SelectTrigger className="h-9 text-xs bg-white border-slate-200 text-slate-700">
                <SelectValue placeholder="All Types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value={USER_TYPES.PLATFORM_USER}>Platform Users</SelectItem>
                <SelectItem value={USER_TYPES.OFFLINE_USER}>Offline Customers</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Status Filter */}
          <div className="w-[160px]">
            <Select
              value={selectedStatus}
              onValueChange={(val) => {
                setSelectedStatus(val);
                setCurrentPage(1);
              }}
            >
              <SelectTrigger className="h-9 text-xs bg-white border-slate-200 text-slate-700">
                <SelectValue placeholder="All Statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value={APPROVAL_STATUSES.APPROVED}>Approved</SelectItem>
                <SelectItem value={APPROVAL_STATUSES.PENDING}>Pending Review</SelectItem>
                <SelectItem value={APPROVAL_STATUSES.REJECTED}>Rejected</SelectItem>
              </SelectContent>
            </Select>
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
                setCurrentPage(1);
              }}
              className="text-xs text-slate-500 hover:text-slate-900 h-9 px-2.5"
            >
              Reset
            </Button>
          )}
        </div>
      </div>

      {/* Customers Data Table - Fits 100% Desktop Width Without Horizontal Scroll */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-none overflow-hidden">
        <Table className="w-full table-fixed">
          <TableHeader className="bg-slate-50/80 border-b border-slate-200">
            <TableRow className="hover:bg-transparent border-0">
              {/* Customer & Company (28%) */}
              <TableHead
                onClick={() => handleSort("name")}
                className="w-[28%] text-[11px] font-semibold text-slate-600 tracking-wider uppercase py-3 px-4 cursor-pointer select-none hover:text-slate-900"
              >
                <div className="flex items-center gap-1">
                  Customer & Company
                  {getSortIcon("name")}
                </div>
              </TableHead>

              {/* Contact Details (24%) */}
              <TableHead className="w-[24%] text-[11px] font-semibold text-slate-600 tracking-wider uppercase py-3 px-4">
                Contact Details
              </TableHead>

              {/* Registered Date (14%) */}
              <TableHead
                onClick={() => handleSort("date")}
                className="w-[14%] text-[11px] font-semibold text-slate-600 tracking-wider uppercase py-3 px-4 cursor-pointer select-none hover:text-slate-900"
              >
                <div className="flex items-center gap-1">
                  Registered On
                  {getSortIcon("date")}
                </div>
              </TableHead>

              {/* User Type (11%) */}
              <TableHead
                onClick={() => handleSort("type")}
                className="w-[11%] text-[11px] font-semibold text-slate-600 tracking-wider uppercase py-3 px-4 cursor-pointer select-none hover:text-slate-900"
              >
                <div className="flex items-center gap-1">
                  Type
                  {getSortIcon("type")}
                </div>
              </TableHead>

              {/* Approval Status (11%) */}
              <TableHead
                onClick={() => handleSort("status")}
                className="w-[11%] text-[11px] font-semibold text-slate-600 tracking-wider uppercase py-3 px-4 cursor-pointer select-none hover:text-slate-900"
              >
                <div className="flex items-center gap-1">
                  Status
                  {getSortIcon("status")}
                </div>
              </TableHead>

              {/* Location (12%) */}
              <TableHead
                onClick={() => handleSort("location")}
                className="w-[12%] text-[11px] font-semibold text-slate-600 tracking-wider uppercase py-3 px-4 cursor-pointer select-none hover:text-slate-900"
              >
                <div className="flex items-center gap-1">
                  Location
                  {getSortIcon("location")}
                </div>
              </TableHead>

              {/* Actions (10%) */}
              <TableHead className="w-[10%] text-[11px] font-semibold text-slate-600 tracking-wider uppercase py-3 px-4 text-right">
                Actions
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedCustomers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-12 text-slate-500 bg-white">
                  <div className="flex flex-col items-center justify-center space-y-2">
                    <Users className="h-8 w-8 text-slate-300" />
                    <p className="text-sm font-medium text-slate-700">No customers found</p>
                    <p className="text-xs text-slate-400">
                      Try adjusting your search criteria or register an offline customer.
                    </p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              paginatedCustomers.map((customer) => {
                const userType = customer.user_type || USER_TYPES.PLATFORM_USER;
                const approvalStatus = customer.approval_status || APPROVAL_STATUSES.APPROVED;

                return (
                  <TableRow
                    key={customer.id}
                    className="hover:bg-slate-50/70 transition-colors bg-white border-b border-slate-200/80"
                  >
                    {/* Customer & Company */}
                    <TableCell className="py-3 px-4 truncate">
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-700 font-medium text-xs border border-slate-200/80">
                          {customer.first_name?.[0] || "C"}
                          {customer.last_name?.[0] || ""}
                        </div>
                        <div className="min-w-0">
                          <div className="font-medium text-xs text-slate-900 truncate">
                            {customer.title} {customer.first_name} {customer.last_name}
                          </div>
                          <div className="text-[11px] text-slate-500 flex items-center gap-1.5 mt-0.5 truncate">
                            <Building2 className="h-3 w-3 text-slate-400 shrink-0" />
                            <span className="truncate">{customer.company_name}</span>
                          </div>
                          {customer.gstin && (
                            <span className="inline-block mt-0.5 text-[9px] font-mono text-slate-500 bg-slate-50 px-1 py-0.2 rounded border border-slate-200">
                              GST: {customer.gstin}
                            </span>
                          )}
                        </div>
                      </div>
                    </TableCell>

                    {/* Contact Details */}
                    <TableCell className="py-3 px-4 truncate">
                      <div className="space-y-0.5 text-xs">
                        <div className="flex items-center gap-1.5 text-slate-700 truncate">
                          <Mail className="h-3 w-3 text-slate-400 shrink-0" />
                          <span className="truncate">{customer.email}</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-slate-500 text-[11px] truncate">
                          <Phone className="h-3 w-3 text-slate-400 shrink-0" />
                          <span>{customer.mobile}</span>
                        </div>
                      </div>
                    </TableCell>

                    {/* Registered Date */}
                    <TableCell className="py-3 px-4 whitespace-nowrap">
                      <div className="flex items-center gap-1.5 text-xs text-slate-600">
                        <Calendar className="h-3 w-3 text-slate-400 shrink-0" />
                        <span>{formatDate(customer.created_at)}</span>
                      </div>
                    </TableCell>

                    {/* User Type */}
                    <TableCell className="py-3 px-4 whitespace-nowrap">
                      {userType === USER_TYPES.PLATFORM_USER ? (
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-medium bg-slate-100 text-slate-700 border border-slate-200/60">
                          <Globe className="h-3 w-3 text-slate-500" /> Platform
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-medium bg-slate-100 text-slate-700 border border-slate-200/60">
                          <Store className="h-3 w-3 text-slate-500" /> Offline ERP
                        </span>
                      )}
                    </TableCell>

                    {/* Approval Status */}
                    <TableCell className="py-3 px-4 whitespace-nowrap">
                      {approvalStatus === APPROVAL_STATUSES.APPROVED && (
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200/60">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Approved
                        </span>
                      )}
                      {approvalStatus === APPROVAL_STATUSES.PENDING && (
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-medium bg-amber-50 text-amber-700 border border-amber-200/60">
                          <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" /> Pending
                        </span>
                      )}
                      {approvalStatus === APPROVAL_STATUSES.REJECTED && (
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-medium bg-rose-50 text-rose-700 border border-rose-200/60">
                          <span className="h-1.5 w-1.5 rounded-full bg-rose-500" /> Rejected
                        </span>
                      )}
                    </TableCell>

                    {/* Location */}
                    <TableCell className="py-3 px-4 truncate">
                      <div className="text-xs text-slate-600 flex items-center gap-1 truncate">
                        <MapPin className="h-3 w-3 text-slate-400 shrink-0" />
                        <span className="truncate">
                          {customer.city}, {customer.state}
                        </span>
                      </div>
                    </TableCell>

                    {/* Actions (Solid Green Check & Red X for Instant Approval/Rejection) */}
                    <TableCell className="py-3 px-4 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1.5">
                        {approvalStatus === APPROVAL_STATUSES.PENDING && (
                          <>
                            <Button
                              type="button"
                              size="icon"
                              title="Approve Customer"
                              disabled={isPending}
                              onClick={() => handleStatusChange(customer.id, APPROVAL_STATUSES.APPROVED)}
                              className="h-7 w-7 bg-emerald-600 text-white hover:bg-emerald-700 cursor-pointer shadow-none rounded-md"
                            >
                              <Check className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              type="button"
                              size="icon"
                              title="Reject Customer"
                              disabled={isPending}
                              onClick={() => handleStatusChange(customer.id, APPROVAL_STATUSES.REJECTED)}
                              className="h-7 w-7 bg-rose-600 text-white hover:bg-rose-700 cursor-pointer shadow-none rounded-md"
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
                          className="h-7 text-xs px-2.5 border-slate-200 text-slate-700 hover:bg-slate-50 hover:text-slate-900 shadow-none cursor-pointer"
                        >
                          <Eye className="h-3.5 w-3.5 text-slate-500 mr-1" />
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

        {/* Pagination Bar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3 border-t border-slate-200 bg-slate-50/60">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <span>
              Showing{" "}
              <strong className="font-semibold text-slate-800">
                {totalItems === 0 ? 0 : (validCurrentPage - 1) * itemsPerPage + 1}
              </strong>{" "}
              to{" "}
              <strong className="font-semibold text-slate-800">
                {Math.min(validCurrentPage * itemsPerPage, totalItems)}
              </strong>{" "}
              of <strong className="font-semibold text-slate-800">{totalItems}</strong> customers
            </span>

            {/* Rows Per Page Selector */}
            <div className="hidden sm:flex items-center gap-1.5 ml-4">
              <span className="text-slate-400">Rows per page:</span>
              <div className="w-[65px]">
                <Select
                  value={String(itemsPerPage)}
                  onValueChange={(val) => {
                    setItemsPerPage(Number(val));
                    setCurrentPage(1);
                  }}
                >
                  <SelectTrigger className="h-7 text-xs bg-white border-slate-200 py-0 px-2">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="5">5</SelectItem>
                    <SelectItem value="10">10</SelectItem>
                    <SelectItem value="25">25</SelectItem>
                    <SelectItem value="50">50</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Page Navigation Buttons */}
          <div className="flex items-center gap-1">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={validCurrentPage <= 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              className="h-8 px-2.5 text-xs gap-1 border-slate-200 text-slate-700 hover:bg-white disabled:opacity-40"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
              <span>Previous</span>
            </Button>

            {/* Page Number Buttons */}
            {Array.from({ length: totalPages }, (_, i) => i + 1)
              .filter(
                (p) =>
                  p === 1 ||
                  p === totalPages ||
                  (p >= validCurrentPage - 1 && p <= validCurrentPage + 1)
              )
              .map((pageNum, idx, arr) => {
                const prevPage = arr[idx - 1];
                const showEllipsis = prevPage && pageNum - prevPage > 1;

                return (
                  <div key={pageNum} className="flex items-center">
                    {showEllipsis && <span className="px-1 text-slate-400 text-xs">...</span>}
                    <Button
                      type="button"
                      size="sm"
                      variant={validCurrentPage === pageNum ? "default" : "outline"}
                      onClick={() => setCurrentPage(pageNum)}
                      className={`h-8 w-8 p-0 text-xs font-semibold ${
                        validCurrentPage === pageNum
                          ? "bg-[#024AE5] text-white hover:bg-[#023ecc]"
                          : "border-slate-200 text-slate-700 hover:bg-white"
                      }`}
                    >
                      {pageNum}
                    </Button>
                  </div>
                );
              })}

            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={validCurrentPage >= totalPages}
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              className="h-8 px-2.5 text-xs gap-1 border-slate-200 text-slate-700 hover:bg-white disabled:opacity-40"
            >
              <span>Next</span>
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </div>

      {/* MODAL 1: ADD OFFLINE CUSTOMER */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="relative w-full max-w-3xl rounded-2xl bg-white p-6 shadow-2xl border border-slate-200 my-8 max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-200 pb-4 mb-5">
              <div>
                <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <Store className="h-5 w-5 text-slate-700" />
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
            <div className="mb-5 rounded-xl bg-slate-50 p-3.5 border border-slate-200 flex items-start gap-3 text-xs text-slate-700">
              <AlertCircle className="h-4 w-4 text-slate-500 shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold text-slate-900">ERP & Commercial Account Note: </span>
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

            {/* Same Registration Form with shadcn Components */}
            <form onSubmit={handleAddOfflineCustomer} className="space-y-6">
              {/* Section 1: Company Profile */}
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-3 flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-slate-600" />
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
                      className="h-10 text-xs border-slate-200"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-slate-700">
                      GSTIN (Optional)
                    </Label>
                    <Input
                      name="gstin"
                      className="h-10 text-xs border-slate-200 font-mono uppercase"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-slate-700">
                      Department / Industry Sector
                    </Label>
                    <Select value={formDept} onValueChange={setFormDept}>
                      <SelectTrigger className="h-10 text-xs bg-white border-slate-200">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {DEPARTMENT_OPTIONS.map((dept) => (
                          <SelectItem key={dept} value={dept}>
                            {dept}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5 sm:col-span-2">
                    <Label className="text-xs font-medium text-slate-700">
                      Registered Billing Address <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      name="company_address"
                      required
                      className="h-10 text-xs border-slate-200"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-slate-700">
                      City <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      name="city"
                      required
                      className="h-10 text-xs border-slate-200"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium text-slate-700">
                        State <span className="text-red-500">*</span>
                      </Label>
                      <Select value={formState} onValueChange={setFormState}>
                        <SelectTrigger className="h-10 text-xs bg-white border-slate-200">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="max-h-60">
                          {INDIAN_STATES.map((st) => (
                            <SelectItem key={st} value={st}>
                              {st}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium text-slate-700">
                        PIN Code <span className="text-red-500">*</span>
                      </Label>
                      <Input
                        name="pincode"
                        required
                        className="h-10 text-xs border-slate-200"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Section 2: Contact Person */}
              <div className="border-t border-slate-100 pt-4">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-3 flex items-center gap-2">
                  <Users className="h-4 w-4 text-slate-600" />
                  2. Primary Contact Person
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-4">
                  {/* Title (shadcn Select) */}
                  <div className="space-y-1.5 sm:col-span-3">
                    <Label className="text-xs font-medium text-slate-700">Title</Label>
                    <Select value={formTitle} onValueChange={(val) => setFormTitle(val as UserTitle)}>
                      <SelectTrigger className="h-10 text-xs bg-white border-slate-200">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {USER_TITLES.map((t) => (
                          <SelectItem key={t} value={t}>
                            {t}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* First Name */}
                  <div className="space-y-1.5 sm:col-span-4">
                    <Label className="text-xs font-medium text-slate-700">
                      First Name <span className="text-red-500">*</span>
                    </Label>
                    <Input name="first_name" required className="h-10 text-xs border-slate-200" />
                  </div>

                  {/* Last Name */}
                  <div className="space-y-1.5 sm:col-span-5">
                    <Label className="text-xs font-medium text-slate-700">
                      Last Name <span className="text-red-500">*</span>
                    </Label>
                    <Input name="last_name" required className="h-10 text-xs border-slate-200" />
                  </div>

                  {/* Designation */}
                  <div className="space-y-1.5 sm:col-span-6">
                    <Label className="text-xs font-medium text-slate-700">Designation</Label>
                    <Input name="designation" defaultValue="Commercial Manager" className="h-10 text-xs border-slate-200" />
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
                      className="h-10 text-xs border-slate-200"
                    />
                  </div>

                  {/* Mobile */}
                  <div className="space-y-1.5 sm:col-span-6">
                    <Label className="text-xs font-medium text-slate-700">
                      Mobile Number <span className="text-red-500">*</span>
                    </Label>
                    <Input name="mobile" required className="h-10 text-xs border-slate-200" />
                  </div>

                  {/* Landline */}
                  <div className="space-y-1.5 sm:col-span-6">
                    <Label className="text-xs font-medium text-slate-700">Landline (Optional)</Label>
                    <Input name="landline" className="h-10 text-xs border-slate-200" />
                  </div>
                </div>
              </div>

              {/* Section 3: Commercial & Credit Terms */}
              <div className="border-t border-slate-100 pt-4">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-3 flex items-center gap-2">
                  <CreditCard className="h-4 w-4 text-slate-600" />
                  3. Commercial & Credit Parameters
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-slate-700">Credit Limit (₹)</Label>
                    <Input
                      type="number"
                      name="credit_limit"
                      defaultValue={COMMERCIAL_DEFAULTS.DEFAULT_CREDIT_LIMIT}
                      className="h-10 text-xs border-slate-200 font-semibold"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-slate-700">Credit Payment Terms (Days)</Label>
                    <Select value={formCreditDays} onValueChange={setFormCreditDays}>
                      <SelectTrigger className="h-10 text-xs bg-white border-slate-200">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {COMMERCIAL_DEFAULTS.CREDIT_DAYS_OPTIONS.map((days) => (
                          <SelectItem key={days} value={String(days)}>
                            {days} Days Net
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label className="text-xs font-medium text-slate-700">Internal Account Notes</Label>
                    <Input
                      name="notes"
                      placeholder="e.g. Authorized for Grade HRC 55 tooling supplies"
                      className="h-10 text-xs border-slate-200"
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
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-100 text-slate-700 font-bold text-sm border border-slate-200/80">
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
            <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-50 p-3.5 rounded-xl border border-slate-200 mb-4">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-slate-700">Account Type:</span>
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-medium bg-white text-slate-700 border border-slate-200">
                  {viewingCustomer.user_type === USER_TYPES.OFFLINE_USER ? (
                    <>
                      <Store className="h-3 w-3 text-slate-500" /> Offline ERP
                    </>
                  ) : (
                    <>
                      <Globe className="h-3 w-3 text-slate-500" /> Platform User
                    </>
                  )}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-slate-700">Approval:</span>
                <div className="w-[150px]">
                  <Select
                    value={viewingCustomer.approval_status || APPROVAL_STATUSES.APPROVED}
                    onValueChange={(val) =>
                      handleStatusChange(viewingCustomer.id, val as ApprovalStatus)
                    }
                  >
                    <SelectTrigger className="h-8 text-xs bg-white border-slate-200 font-semibold">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={APPROVAL_STATUSES.APPROVED}>Approved</SelectItem>
                      <SelectItem value={APPROVAL_STATUSES.PENDING}>Pending Review</SelectItem>
                      <SelectItem value={APPROVAL_STATUSES.REJECTED}>Rejected</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
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
                <p className="font-mono font-semibold text-slate-800">
                  {viewingCustomer.gstin || "Not Registered / N/A"}
                </p>
              </div>
              <div className="space-y-1">
                <span className="text-slate-400 font-medium">Department</span>
                <p className="font-semibold text-slate-800">{viewingCustomer.department}</p>
              </div>
              <div className="space-y-1">
                <span className="text-slate-400 font-medium">Registered Date</span>
                <p className="font-semibold text-slate-800">{formatDate(viewingCustomer.created_at)}</p>
              </div>
              <div className="space-y-1">
                <span className="text-slate-400 font-medium">Commercial Model</span>
                <p className="font-semibold text-slate-800">
                  {viewingCustomer.user_type === USER_TYPES.OFFLINE_USER
                    ? "Direct ERP / Net Credit Terms"
                    : "Online Self-Service / Prepaid"}
                </p>
              </div>
              <div className="space-y-1 sm:col-span-2">
                <span className="text-slate-400 font-medium">Registered Address</span>
                <p className="text-slate-800">
                  {viewingCustomer.company_address}, {viewingCustomer.city}, {viewingCustomer.state} - {viewingCustomer.pincode}
                </p>
              </div>
              {viewingCustomer.user_type === USER_TYPES.OFFLINE_USER && (
                <>
                  <div className="space-y-1">
                    <span className="text-slate-400 font-medium">Credit Limit</span>
                    <p className="font-bold text-slate-900 text-sm">
                      ₹{(viewingCustomer.credit_limit || COMMERCIAL_DEFAULTS.DEFAULT_CREDIT_LIMIT).toLocaleString("en-IN")}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <span className="text-slate-400 font-medium">Credit Payment Terms</span>
                    <p className="font-semibold text-slate-800">
                      {viewingCustomer.credit_days || COMMERCIAL_DEFAULTS.DEFAULT_CREDIT_DAYS} Days Net
                    </p>
                  </div>
                </>
              )}
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
