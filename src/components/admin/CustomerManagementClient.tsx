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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
  ShieldCheck,
  AlertTriangle,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
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

  // Modal State
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [addModalStep, setAddModalStep] = useState<1 | 2>(1);
  const [viewingCustomer, setViewingCustomer] = useState<Profile | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);

  // Confirmation Alert Dialog State (shadcn)
  const [confirmDialog, setConfirmDialog] = useState<{
    customer: Profile;
    targetStatus: ApprovalStatus;
  } | null>(null);

  // Add Customer Form State (Reusing SignUp Form fields with plain text inputs)
  const [formValues, setFormValues] = useState({
    title: USER_TITLES[0] as UserTitle,
    first_name: "",
    last_name: "",
    department: "",
    designation: "",
    mobile: "",
    landline: "",
    email: "",
    company_name: "",
    company_address: "",
    additional_address: "",
    gstin: "",
    city: "",
    state: "Maharashtra",
    pincode: "",
    credit_limit: String(COMMERCIAL_DEFAULTS.DEFAULT_CREDIT_LIMIT),
    credit_days: String(COMMERCIAL_DEFAULTS.DEFAULT_CREDIT_DAYS),
    notes: "",
  });

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormValues((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSelectChange = (name: string, value: string) => {
    setFormValues((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const resetAddForm = () => {
    setFormValues({
      title: USER_TITLES[0],
      first_name: "",
      last_name: "",
      department: "",
      designation: "",
      mobile: "",
      landline: "",
      email: "",
      company_name: "",
      company_address: "",
      additional_address: "",
      gstin: "",
      city: "",
      state: "Maharashtra",
      pincode: "",
      credit_limit: String(COMMERCIAL_DEFAULTS.DEFAULT_CREDIT_LIMIT),
      credit_days: String(COMMERCIAL_DEFAULTS.DEFAULT_CREDIT_DAYS),
      notes: "",
    });
    setAddModalStep(1);
    setFormError(null);
    setFormSuccess(null);
  };

  // Step 1 Validation
  const handleNextStep = (e: React.MouseEvent) => {
    e.preventDefault();
    setFormError(null);

    if (
      !formValues.first_name.trim() ||
      !formValues.last_name.trim() ||
      !formValues.email.trim() ||
      !formValues.mobile.trim() ||
      !formValues.department.trim() ||
      !formValues.designation.trim()
    ) {
      setFormError("Please fill in all required user fields marked with an asterisk (*).");
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formValues.email.trim())) {
      setFormError("Please enter a valid official email address.");
      return;
    }

    setAddModalStep(2);
  };

  // Step 2 Submission
  const handleSaveCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setFormSuccess(null);

    if (
      !formValues.company_name.trim() ||
      !formValues.company_address.trim() ||
      !formValues.city.trim() ||
      !formValues.state.trim() ||
      !formValues.pincode.trim()
    ) {
      setFormError("Please fill in all required company fields marked with an asterisk (*).");
      return;
    }

    const formData = new FormData();
    Object.entries(formValues).forEach(([key, val]) => {
      formData.append(key, val);
    });

    startTransition(async () => {
      const res = await createOfflineCustomer(formData);
      if (res.error) {
        setFormError(res.error);
      } else {
        setFormSuccess(res.message || "Customer account added successfully.");
        setTimeout(() => {
          setIsAddModalOpen(false);
          resetAddForm();
          const newCust: Profile = {
            id: `off-${Date.now()}`,
            role: "customer",
            title: formValues.title,
            first_name: formValues.first_name,
            last_name: formValues.last_name,
            company_name: formValues.company_name,
            email: formValues.email,
            mobile: formValues.mobile,
            landline: formValues.landline || null,
            designation: formValues.designation,
            department: formValues.department,
            company_address: formValues.company_address,
            additional_address: formValues.additional_address || null,
            city: formValues.city,
            state: formValues.state,
            pincode: formValues.pincode,
            gstin: formValues.gstin || null,
            approval_status: APPROVAL_STATUSES.APPROVED,
            user_type: USER_TYPES.OFFLINE_USER,
            credit_limit: Number(formValues.credit_limit) || COMMERCIAL_DEFAULTS.DEFAULT_CREDIT_LIMIT,
            credit_days: Number(formValues.credit_days) || COMMERCIAL_DEFAULTS.DEFAULT_CREDIT_DAYS,
            notes: formValues.notes || null,
            created_at: new Date().toISOString(),
          };
          setCustomers((prev) => [newCust, ...prev]);
        }, 800);
      }
    });
  };

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
      if (c.role === "platform_owner") return false;

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

      const userType = c.user_type || USER_TYPES.PLATFORM_USER;
      const matchesType = selectedUserType === "all" || userType === selectedUserType;

      const status = c.approval_status || APPROVAL_STATUSES.APPROVED;
      const matchesStatus = selectedStatus === "all" || status === selectedStatus;

      return matchesSearch && matchesType && matchesStatus;
    });

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

  // Perform status update after confirmation
  const handleConfirmedStatusChange = () => {
    if (!confirmDialog) return;
    const { customer, targetStatus } = confirmDialog;
    setConfirmDialog(null);

    startTransition(async () => {
      setCustomers((prev) =>
        prev.map((c) => (c.id === customer.id ? { ...c, approval_status: targetStatus } : c))
      );
      if (viewingCustomer && viewingCustomer.id === customer.id) {
        setViewingCustomer((prev) => (prev ? { ...prev, approval_status: targetStatus } : null));
      }
      await updateCustomerApprovalStatus(customer.id, targetStatus);
    });
  };

  return (
    <div className="space-y-6 w-full max-w-full">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Customers
          </h1>
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
              resetAddForm();
              setIsAddModalOpen(true);
            }}
            className="gap-1.5 text-xs bg-[#024AE5] text-white hover:bg-[#023ecc] shadow-none cursor-pointer font-medium"
          >
            <UserPlus className="h-3.5 w-3.5" />
            <span>+ Add Customer</span>
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

        {/* Online Customers */}
        <Card
          onClick={() => {
            setSelectedUserType("online");
            setSelectedStatus("all");
            setCurrentPage(1);
          }}
          className={`border bg-white shadow-none rounded-xl p-4 cursor-pointer transition-all ${
            selectedUserType === "online" || selectedUserType === "platform_user"
              ? "border-slate-400 ring-1 ring-slate-300"
              : "border-slate-200 hover:border-slate-300"
          }`}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] font-medium uppercase tracking-wider text-slate-500">
                Online Customers
              </p>
              <h3 className="text-2xl font-bold text-slate-900 mt-1">{platformCount}</h3>
            </div>
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 text-slate-600 border border-slate-200/60">
              <Globe className="h-4 w-4" />
            </div>
          </div>
          <p className="text-[11px] text-slate-500 mt-2">Web portal registered accounts</p>
        </Card>

        {/* Offline Clients */}
        <Card
          onClick={() => {
            setSelectedUserType("offline");
            setSelectedStatus("all");
            setCurrentPage(1);
          }}
          className={`border bg-white shadow-none rounded-xl p-4 cursor-pointer transition-all ${
            selectedUserType === "offline" || selectedUserType === "offline_user"
              ? "border-slate-400 ring-1 ring-slate-300"
              : "border-slate-200 hover:border-slate-300"
          }`}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] font-medium uppercase tracking-wider text-slate-500">
                Offline Clients
              </p>
              <h3 className="text-2xl font-bold text-slate-900 mt-1">{offlineCount}</h3>
            </div>
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 text-slate-600 border border-slate-200/60">
              <Store className="h-4 w-4" />
            </div>
          </div>
          <p className="text-[11px] text-slate-500 mt-2">Direct ERP & ledger billing accounts</p>
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
        {/* Search Input */}
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
          {/* Customer Channel Filter */}
          <div className="w-[170px]">
            <Select
              value={selectedUserType}
              onValueChange={(val) => {
                setSelectedUserType(val);
                setCurrentPage(1);
              }}
            >
              <SelectTrigger className="h-9 text-xs bg-white border-slate-200 text-slate-700">
                <SelectValue placeholder="All Channels" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Channels</SelectItem>
                <SelectItem value="online">Online Customers</SelectItem>
                <SelectItem value="offline">Offline Clients</SelectItem>
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

      {/* Customers Data Table */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-none overflow-hidden">
        <Table className="w-full table-fixed">
          <TableHeader className="bg-slate-50/80 border-b border-slate-200">
            <TableRow className="hover:bg-transparent border-0">
              {/* Customer & Company (24%) */}
              <TableHead
                onClick={() => handleSort("name")}
                className="w-[24%] text-[11px] font-semibold text-slate-600 tracking-wider uppercase py-2.5 px-3.5 cursor-pointer select-none hover:text-slate-900"
              >
                <div className="flex items-center gap-1">
                  Customer & Company
                  {getSortIcon("name")}
                </div>
              </TableHead>

              {/* Contact Details (20%) */}
              <TableHead className="w-[20%] text-[11px] font-semibold text-slate-600 tracking-wider uppercase py-2.5 px-3.5">
                Contact Details
              </TableHead>

              {/* Registered Date (12%) */}
              <TableHead
                onClick={() => handleSort("date")}
                className="w-[12%] text-[11px] font-semibold text-slate-600 tracking-wider uppercase py-2.5 px-3.5 cursor-pointer select-none hover:text-slate-900"
              >
                <div className="flex items-center gap-1">
                  Registered On
                  {getSortIcon("date")}
                </div>
              </TableHead>

              {/* User Type (11%) */}
              <TableHead
                onClick={() => handleSort("type")}
                className="w-[11%] text-[11px] font-semibold text-slate-600 tracking-wider uppercase py-2.5 px-3.5 cursor-pointer select-none hover:text-slate-900"
              >
                <div className="flex items-center gap-1">
                  Type
                  {getSortIcon("type")}
                </div>
              </TableHead>

              {/* Approval Status (11%) */}
              <TableHead
                onClick={() => handleSort("status")}
                className="w-[11%] text-[11px] font-semibold text-slate-600 tracking-wider uppercase py-2.5 px-3.5 cursor-pointer select-none hover:text-slate-900"
              >
                <div className="flex items-center gap-1">
                  Status
                  {getSortIcon("status")}
                </div>
              </TableHead>

              {/* Location (10%) */}
              <TableHead
                onClick={() => handleSort("location")}
                className="w-[10%] text-[11px] font-semibold text-slate-600 tracking-wider uppercase py-2.5 px-3.5 cursor-pointer select-none hover:text-slate-900"
              >
                <div className="flex items-center gap-1">
                  Location
                  {getSortIcon("location")}
                </div>
              </TableHead>

              {/* Actions (12%) */}
              <TableHead className="w-[12%] text-[11px] font-semibold text-slate-600 tracking-wider uppercase py-2.5 px-3.5 text-right">
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
                    <TableCell className="py-2.5 px-3.5 truncate">
                      <div className="flex items-center gap-2.5">
                        <div className="flex h-7.5 w-7.5 shrink-0 items-center justify-center rounded-md bg-slate-100 text-slate-700 font-medium text-xs border border-slate-200/80">
                          {customer.first_name?.[0] || "C"}
                          {customer.last_name?.[0] || ""}
                        </div>
                        <div className="min-w-0">
                          <div className="font-medium text-xs text-slate-900 truncate">
                            {customer.title} {customer.first_name} {customer.last_name}
                          </div>
                          <div className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5 truncate">
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
                    <TableCell className="py-2.5 px-3.5 truncate">
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
                    <TableCell className="py-2.5 px-3.5 whitespace-nowrap">
                      <div className="flex items-center gap-1.5 text-xs text-slate-600">
                        <Calendar className="h-3 w-3 text-slate-400 shrink-0" />
                        <span>{formatDate(customer.created_at)}</span>
                      </div>
                    </TableCell>

                    {/* Customer Channel */}
                    <TableCell className="py-2.5 px-3.5 whitespace-nowrap">
                      {userType === "online" || userType === "platform_user" ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-blue-50 text-[#024AE5] border border-blue-200/60">
                          <Globe className="h-3 w-3 text-[#024AE5]" /> Online
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200/60">
                          <Store className="h-3 w-3 text-emerald-600" /> Offline ERP
                        </span>
                      )}
                    </TableCell>

                    {/* Approval Status */}
                    <TableCell className="py-2.5 px-3.5 whitespace-nowrap">
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
                    <TableCell className="py-2.5 px-3.5 truncate">
                      <div className="text-xs text-slate-600 flex items-center gap-1 truncate">
                        <MapPin className="h-3 w-3 text-slate-400 shrink-0" />
                        <span className="truncate">
                          {customer.city}, {customer.state}
                        </span>
                      </div>
                    </TableCell>

                    {/* Actions with Confirmation Triggers */}
                    <TableCell className="py-2.5 px-3.5 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1.5">
                        {approvalStatus === APPROVAL_STATUSES.PENDING && (
                          <>
                            <Button
                              type="button"
                              size="icon"
                              title="Approve Customer"
                              disabled={isPending}
                              onClick={() =>
                                setConfirmDialog({
                                  customer,
                                  targetStatus: APPROVAL_STATUSES.APPROVED,
                                })
                              }
                              className="h-7 w-7 bg-emerald-600 text-white hover:bg-emerald-700 cursor-pointer shadow-none rounded-md p-1.5 shrink-0"
                            >
                              <Check className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              type="button"
                              size="icon"
                              title="Reject Customer"
                              disabled={isPending}
                              onClick={() =>
                                setConfirmDialog({
                                  customer,
                                  targetStatus: APPROVAL_STATUSES.REJECTED,
                                })
                              }
                              className="h-7 w-7 bg-rose-600 text-white hover:bg-rose-700 cursor-pointer shadow-none rounded-md p-1.5 shrink-0"
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
                          className="h-7 text-xs px-2.5 border-slate-200 text-slate-700 hover:bg-slate-50 hover:text-slate-900 shadow-none cursor-pointer shrink-0"
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
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-3.5 py-2.5 border-t border-slate-200 bg-slate-50/60">
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
            <div className="hidden sm:flex items-center gap-1.5 ml-3">
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
              className="h-7.5 px-2.5 text-xs gap-1 border-slate-200 text-slate-700 hover:bg-white disabled:opacity-40"
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
                      className={`h-7.5 w-7.5 p-0 text-xs font-semibold ${
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
              className="h-7.5 px-2.5 text-xs gap-1 border-slate-200 text-slate-700 hover:bg-white disabled:opacity-40"
            >
              <span>Next</span>
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </div>

      {/* SHADCN CONFIRMATION ALERT DIALOG FOR APPROVE / REJECT */}
      <AlertDialog
        open={Boolean(confirmDialog)}
        onOpenChange={(open) => {
          if (!open) setConfirmDialog(null);
        }}
      >
        <AlertDialogContent className="max-w-md bg-white border border-slate-200 shadow-2xl rounded-2xl p-6">
          <AlertDialogHeader>
            <div className="flex items-center gap-3">
              {confirmDialog?.targetStatus === APPROVAL_STATUSES.APPROVED ? (
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-200">
                  <ShieldCheck className="h-5 w-5" />
                </div>
              ) : (
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-rose-50 text-rose-600 border border-rose-200">
                  <AlertTriangle className="h-5 w-5" />
                </div>
              )}
              <div>
                <AlertDialogTitle className="text-base font-bold text-slate-900">
                  {confirmDialog?.targetStatus === APPROVAL_STATUSES.APPROVED
                    ? "Approve Customer Account?"
                    : "Reject Customer Account?"}
                </AlertDialogTitle>
                <p className="text-xs text-slate-500 mt-0.5">
                  {confirmDialog?.customer.company_name}
                </p>
              </div>
            </div>

            <AlertDialogDescription className="text-xs text-slate-600 pt-2 leading-relaxed">
              {confirmDialog?.targetStatus === APPROVAL_STATUSES.APPROVED ? (
                <>
                  Are you sure you want to approve{" "}
                  <strong className="text-slate-900 font-semibold">
                    {confirmDialog.customer.title} {confirmDialog.customer.first_name}{" "}
                    {confirmDialog.customer.last_name}
                  </strong>{" "}
                  from{" "}
                  <strong className="text-slate-900 font-semibold">
                    {confirmDialog.customer.company_name}
                  </strong>
                  ? This account will gain full purchasing, quotations, and online catalogue access.
                </>
              ) : (
                <>
                  Are you sure you want to reject registration for{" "}
                  <strong className="text-slate-900 font-semibold">
                    {confirmDialog?.customer.company_name}
                  </strong>{" "}
                  ({confirmDialog?.customer.email})? The customer will be marked as rejected.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>

          <AlertDialogFooter className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100">
            <AlertDialogCancel className="h-8 text-xs border-slate-200 text-slate-700 hover:bg-slate-50">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmedStatusChange}
              disabled={isPending}
              className={`h-8 text-xs font-medium text-white shadow-none ${
                confirmDialog?.targetStatus === APPROVAL_STATUSES.APPROVED
                  ? "bg-emerald-600 hover:bg-emerald-700"
                  : "bg-rose-600 hover:bg-rose-700"
              }`}
            >
              {isPending
                ? "Updating..."
                : confirmDialog?.targetStatus === APPROVAL_STATUSES.APPROVED
                ? "Yes, Approve Account"
                : "Yes, Reject Account"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ADD CUSTOMER MODAL (Compact 2-Step Wizard with Text Inputs & Offline Credit Fields) */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="relative w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl border border-slate-200 my-8 max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-3.5 mb-4">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-700 border border-slate-200/80">
                  <UserPlus className="h-4 w-4 text-slate-600" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-900">Add Customer</h2>
                  <p className="text-[11px] text-slate-500">
                    Step {addModalStep} of 2 • {addModalStep === 1 ? "User Details" : "Company & Credit Terms"}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  setIsAddModalOpen(false);
                  resetAddForm();
                }}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Error & Success Messages */}
            {formError && (
              <div className="mb-3.5 flex items-start gap-2.5 rounded-lg border border-red-500/20 bg-red-50 p-2.5 text-xs text-red-800">
                <AlertCircle className="h-4 w-4 shrink-0 text-red-600 mt-0.5" />
                <p>{formError}</p>
              </div>
            )}
            {formSuccess && (
              <div className="mb-3.5 flex items-start gap-2.5 rounded-lg border border-emerald-500/20 bg-emerald-50 p-2.5 text-xs text-emerald-800">
                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 mt-0.5" />
                <p>{formSuccess}</p>
              </div>
            )}

            <form onSubmit={handleSaveCustomer}>
              {/* STEP 1: USER DETAILS */}
              {addModalStep === 1 && (
                <div className="space-y-3 animate-in fade-in-50 duration-200">
                  {/* Title & Name */}
                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5">
                    <div className="sm:col-span-3 space-y-1">
                      <Label className="text-xs">Title *</Label>
                      <Select
                        value={formValues.title}
                        onValueChange={(val) => handleSelectChange("title", val)}
                      >
                        <SelectTrigger className="h-9 text-xs bg-white border-slate-200">
                          <SelectValue placeholder="Title" />
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

                    <div className="sm:col-span-4 space-y-1">
                      <Label className="text-xs">First Name *</Label>
                      <Input
                        name="first_name"
                        value={formValues.first_name}
                        onChange={handleInputChange}
                        required
                        className="h-9 text-xs border-slate-200"
                      />
                    </div>

                    <div className="sm:col-span-5 space-y-1">
                      <Label className="text-xs">Last Name *</Label>
                      <Input
                        name="last_name"
                        value={formValues.last_name}
                        onChange={handleInputChange}
                        required
                        className="h-9 text-xs border-slate-200"
                      />
                    </div>
                  </div>

                  {/* Department & Designation (Plain Inputs matching SignUpForm) */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <div className="space-y-1">
                      <Label className="text-xs">Department *</Label>
                      <Input
                        name="department"
                        value={formValues.department}
                        onChange={handleInputChange}
                        placeholder="Procurement / Machining"
                        required
                        className="h-9 text-xs border-slate-200"
                      />
                    </div>

                    <div className="space-y-1">
                      <Label className="text-xs">Designation *</Label>
                      <Input
                        name="designation"
                        value={formValues.designation}
                        onChange={handleInputChange}
                        placeholder="Commercial Manager"
                        required
                        className="h-9 text-xs border-slate-200"
                      />
                    </div>
                  </div>

                  {/* Mobile & Landline */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <div className="space-y-1">
                      <Label className="text-xs">Mobile *</Label>
                      <Input
                        name="mobile"
                        type="tel"
                        value={formValues.mobile}
                        onChange={handleInputChange}
                        required
                        className="h-9 text-xs border-slate-200"
                      />
                    </div>

                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <Label className="text-xs">Landline</Label>
                        <span className="text-[10px] text-slate-400">Optional</span>
                      </div>
                      <Input
                        name="landline"
                        type="tel"
                        value={formValues.landline}
                        onChange={handleInputChange}
                        className="h-9 text-xs border-slate-200"
                      />
                    </div>
                  </div>

                  {/* Email */}
                  <div className="space-y-1">
                    <Label className="text-xs">Official Email ID *</Label>
                    <Input
                      name="email"
                      type="email"
                      placeholder="name@company.com"
                      value={formValues.email}
                      onChange={handleInputChange}
                      required
                      className="h-9 text-xs border-slate-200"
                    />
                  </div>

                  {/* Footer 1 */}
                  <div className="flex items-center justify-between pt-3.5 border-t border-slate-100 mt-4">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setIsAddModalOpen(false);
                        resetAddForm();
                      }}
                      className="h-8 text-xs border-slate-200"
                    >
                      Cancel
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      onClick={handleNextStep}
                      className="h-8 text-xs bg-[#024AE5] text-white hover:bg-[#023ecc] gap-1.5"
                    >
                      <span>Next Step</span>
                      <ArrowRight className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              )}

              {/* STEP 2: COMPANY & CREDIT DETAILS */}
              {addModalStep === 2 && (
                <div className="space-y-3 animate-in fade-in-50 duration-200">
                  {/* Company Name */}
                  <div className="space-y-1">
                    <Label className="text-xs">Company Name *</Label>
                    <Input
                      name="company_name"
                      value={formValues.company_name}
                      onChange={handleInputChange}
                      required
                      className="h-9 text-xs border-slate-200"
                    />
                  </div>

                  {/* GSTIN */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs">GSTIN</Label>
                      <span className="text-[10px] text-slate-400">Optional</span>
                    </div>
                    <Input
                      name="gstin"
                      value={formValues.gstin}
                      onChange={handleInputChange}
                      className="h-9 text-xs border-slate-200 font-mono uppercase"
                    />
                  </div>

                  {/* Company Address */}
                  <div className="space-y-1">
                    <Label className="text-xs">Company Address *</Label>
                    <Input
                      name="company_address"
                      value={formValues.company_address}
                      onChange={handleInputChange}
                      required
                      className="h-9 text-xs border-slate-200"
                    />
                  </div>

                  {/* Additional Address */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs">Additional Address</Label>
                      <span className="text-[10px] text-slate-400">Optional</span>
                    </div>
                    <Input
                      name="additional_address"
                      value={formValues.additional_address}
                      onChange={handleInputChange}
                      className="h-9 text-xs border-slate-200"
                    />
                  </div>

                  {/* City, State, PIN */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    <div className="space-y-1">
                      <Label className="text-xs">City *</Label>
                      <Input
                        name="city"
                        value={formValues.city}
                        onChange={handleInputChange}
                        required
                        className="h-9 text-xs border-slate-200"
                      />
                    </div>

                    <div className="space-y-1">
                      <Label className="text-xs">State *</Label>
                      <Select
                        value={formValues.state}
                        onValueChange={(val) => handleSelectChange("state", val)}
                      >
                        <SelectTrigger className="h-9 text-xs bg-white border-slate-200">
                          <SelectValue placeholder="State" />
                        </SelectTrigger>
                        <SelectContent className="max-h-56">
                          {INDIAN_STATES.map((s) => (
                            <SelectItem key={s} value={s}>
                              {s}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-1">
                      <Label className="text-xs">PIN Code *</Label>
                      <Input
                        name="pincode"
                        value={formValues.pincode}
                        onChange={handleInputChange}
                        required
                        className="h-9 text-xs border-slate-200"
                      />
                    </div>
                  </div>

                  {/* Credit Terms for Offline Customers */}
                  <div className="pt-2 border-t border-slate-100 space-y-2">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-600 block">
                      Credit Parameters (Offline Account)
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      <div className="space-y-1">
                        <Label className="text-xs">Credit Limit (₹) *</Label>
                        <Input
                          name="credit_limit"
                          type="number"
                          value={formValues.credit_limit}
                          onChange={handleInputChange}
                          required
                          className="h-9 text-xs border-slate-200 font-semibold"
                        />
                      </div>

                      <div className="space-y-1">
                        <Label className="text-xs">Payment Terms (Days Net) *</Label>
                        <Input
                          name="credit_days"
                          type="number"
                          value={formValues.credit_days}
                          onChange={handleInputChange}
                          required
                          className="h-9 text-xs border-slate-200 font-semibold"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Footer 2 */}
                  <div className="flex items-center justify-between pt-3.5 border-t border-slate-100 mt-4">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setAddModalStep(1)}
                      className="h-8 text-xs border-slate-200 gap-1.5"
                    >
                      <ArrowLeft className="h-3.5 w-3.5" />
                      <span>Previous</span>
                    </Button>
                    <Button
                      type="submit"
                      size="sm"
                      disabled={isPending}
                      className="h-8 text-xs bg-[#024AE5] text-white hover:bg-[#023ecc] font-medium"
                    >
                      {isPending ? "Saving..." : "Save Customer"}
                    </Button>
                  </div>
                </div>
              )}
            </form>
          </div>
        </div>
      )}

      {/* VIEW CUSTOMER DETAILS MODAL */}
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
                    onValueChange={(val) => {
                      setConfirmDialog({
                        customer: viewingCustomer,
                        targetStatus: val as ApprovalStatus,
                      });
                    }}
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
