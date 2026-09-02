/**
 * Centralized Single Source of Truth for Domain Enums, Statuses, and Business Constants
 * Sojar Indusy - Industrial Manufacturing Platform
 */

// 1. User Titles
export const USER_TITLES = ["Mr", "Mrs", "Miss", "Ms"] as const;
export type UserTitle = (typeof USER_TITLES)[number];

// 2. User Roles (RBAC: Permissions & Access)
export const USER_ROLES = {
  ADMIN: "admin",
  CUSTOMER: "customer",
  // Backward compatibility alias:
  PLATFORM_OWNER: "admin",
} as const;
export type UserRole = "admin" | "customer" | "platform_owner";

export const USER_ROLE_CONFIG: Record<
  string,
  { label: string; description: string; badgeVariant: "blue" | "green" | "secondary" }
> = {
  admin: {
    label: "Administrator",
    description: "Full system administration and platform operations",
    badgeVariant: "blue",
  },
  platform_owner: {
    label: "Administrator",
    description: "Full system administration and platform operations",
    badgeVariant: "blue",
  },
  customer: {
    label: "Customer Account",
    description: "Industrial client, buyer, or fabrication partner",
    badgeVariant: "green",
  },
};

// 3. Customer Channels (Origin / Onboarding Channel)
export const CUSTOMER_CHANNELS = {
  ONLINE: "online",
  OFFLINE: "offline",
  // Backward compatibility aliases:
  PLATFORM_USER: "online",
  OFFLINE_USER: "offline",
} as const;
export type CustomerChannel = "online" | "offline" | "platform_user" | "offline_user";
export type UserType = CustomerChannel;
export const USER_TYPES = CUSTOMER_CHANNELS;

export const CUSTOMER_CHANNEL_CONFIG: Record<
  string,
  {
    label: string;
    shortLabel: string;
    description: string;
    badgeBg: string;
    badgeText: string;
    border: string;
  }
> = {
  online: {
    label: "Online Customer (Web Portal)",
    shortLabel: "Online Customer",
    description: "Self-registered through the website portal",
    badgeBg: "bg-[#024AE5]/10",
    badgeText: "text-[#024AE5]",
    border: "border-[#024AE5]/20",
  },
  platform_user: {
    label: "Online Customer (Web Portal)",
    shortLabel: "Online Customer",
    description: "Self-registered through the website portal",
    badgeBg: "bg-[#024AE5]/10",
    badgeText: "text-[#024AE5]",
    border: "border-[#024AE5]/20",
  },
  offline: {
    label: "Offline Client (Direct ERP Billing)",
    shortLabel: "Offline Client",
    description: "Walk-in / direct client created for manual orders and ledger accounting",
    badgeBg: "bg-[#3C8B4F]/10",
    badgeText: "text-[#3C8B4F]",
    border: "border-[#3C8B4F]/20",
  },
  offline_user: {
    label: "Offline Client (Direct ERP Billing)",
    shortLabel: "Offline Client",
    description: "Walk-in / direct client created for manual orders and ledger accounting",
    badgeBg: "bg-[#3C8B4F]/10",
    badgeText: "text-[#3C8B4F]",
    border: "border-[#3C8B4F]/20",
  },
};
export const USER_TYPE_CONFIG = CUSTOMER_CHANNEL_CONFIG;

// 4. Customer Onboarding & Approval Statuses
export const APPROVAL_STATUSES = {
  PENDING: "pending",
  APPROVED: "approved",
  REJECTED: "rejected",
} as const;
export type ApprovalStatus = (typeof APPROVAL_STATUSES)[keyof typeof APPROVAL_STATUSES];

export const APPROVAL_STATUS_CONFIG: Record<
  ApprovalStatus,
  {
    label: string;
    description: string;
    badgeBg: string;
    badgeText: string;
    border: string;
    badgeVariant: "warning" | "green" | "destructive";
  }
> = {
  [APPROVAL_STATUSES.PENDING]: {
    label: "Pending Review",
    description: "Awaiting administrator verification and KYC clearance",
    badgeBg: "bg-amber-50",
    badgeText: "text-amber-700",
    border: "border-amber-200",
    badgeVariant: "warning",
  },
  [APPROVAL_STATUSES.APPROVED]: {
    label: "Approved",
    description: "Verified account with active purchasing and quotation access",
    badgeBg: "bg-emerald-50",
    badgeText: "text-emerald-700",
    border: "border-emerald-200",
    badgeVariant: "green",
  },
  [APPROVAL_STATUSES.REJECTED]: {
    label: "Rejected",
    description: "Account registration rejected or suspended",
    badgeBg: "bg-rose-50",
    badgeText: "text-rose-700",
    border: "border-rose-200",
    badgeVariant: "destructive",
  },
};

// 5. Order Statuses
export const ORDER_STATUSES = {
  PENDING: "pending",
  PROCESSING: "processing",
  SHIPPED: "shipped",
  DELIVERED: "delivered",
  CANCELLED: "cancelled",
} as const;
export type OrderStatus = (typeof ORDER_STATUSES)[keyof typeof ORDER_STATUSES];

export const ORDER_STATUS_CONFIG: Record<
  OrderStatus,
  {
    label: string;
    badgeVariant: "secondary" | "warning" | "blue" | "green" | "destructive" | "outline";
    description: string;
  }
> = {
  [ORDER_STATUSES.PENDING]: {
    label: "Pending Review",
    badgeVariant: "secondary",
    description: "Order placed, awaiting initial warehouse review",
  },
  [ORDER_STATUSES.PROCESSING]: {
    label: "Processing",
    badgeVariant: "warning",
    description: "Order verified, being packaged at CNC fulfillment unit",
  },
  [ORDER_STATUSES.SHIPPED]: {
    label: "Shipped",
    badgeVariant: "blue",
    description: "Dispatched with carrier, in transit with E-Way bill",
  },
  [ORDER_STATUSES.DELIVERED]: {
    label: "Delivered",
    badgeVariant: "green",
    description: "Delivered and acknowledged by recipient facility",
  },
  [ORDER_STATUSES.CANCELLED]: {
    label: "Cancelled",
    badgeVariant: "destructive",
    description: "Order cancelled or returned",
  },
};

// 6. Commercial & Credit Defaults
export const COMMERCIAL_DEFAULTS = {
  DEFAULT_CREDIT_LIMIT: 500000,
  DEFAULT_CREDIT_DAYS: 30,
  CREDIT_DAYS_OPTIONS: [15, 30, 45, 60, 90],
} as const;

// 7. Industry Sectors & Department Options
export const DEPARTMENT_OPTIONS = [
  "Procurement & Purchasing",
  "Tooling & Fabrication",
  "Plant Maintenance & Engineering",
  "Die & Mold Manufacturing",
  "CNC Operations & Machining",
  "Executive & General Management",
  "Quality Assurance & Inspection",
  "Finance & Accounts",
] as const;

// 8. Standard Indian States List
export const INDIAN_STATES = [
  "Andhra Pradesh",
  "Arunachal Pradesh",
  "Assam",
  "Bihar",
  "Chhattisgarh",
  "Goa",
  "Gujarat",
  "Haryana",
  "Himachal Pradesh",
  "Jharkhand",
  "Karnataka",
  "Kerala",
  "Madhya Pradesh",
  "Maharashtra",
  "Manipur",
  "Meghalaya",
  "Mizoram",
  "Nagaland",
  "Odisha",
  "Punjab",
  "Rajasthan",
  "Sikkim",
  "Tamil Nadu",
  "Telangana",
  "Tripura",
  "Uttar Pradesh",
  "Uttarakhand",
  "West Bengal",
  "Delhi",
  "Dadra and Nagar Haveli and Daman and Diu",
] as const;
