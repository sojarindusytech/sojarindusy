/**
 * Centralized Single Source of Truth for Domain Enums, Statuses, and Business Constants
 * Sojar Indusy - Industrial Manufacturing Platform
 */

// 1. User Titles
export const USER_TITLES = ["Mr", "Mrs", "Miss", "Ms"] as const;
export type UserTitle = (typeof USER_TITLES)[number];

// 2. User Roles
export const USER_ROLES = {
  PLATFORM_OWNER: "platform_owner",
  CUSTOMER: "customer",
} as const;
export type UserRole = (typeof USER_ROLES)[keyof typeof USER_ROLES];

export const USER_ROLE_CONFIG: Record<
  UserRole,
  { label: string; description: string; badgeVariant: "blue" | "green" | "secondary" }
> = {
  [USER_ROLES.PLATFORM_OWNER]: {
    label: "Platform Owner",
    description: "Full system administration and platform operations",
    badgeVariant: "blue",
  },
  [USER_ROLES.CUSTOMER]: {
    label: "Customer Account",
    description: "Industrial client, buyer, or fabrication partner",
    badgeVariant: "green",
  },
};

// 3. User Types (Platform Portal vs Offline Billing)
export const USER_TYPES = {
  PLATFORM_USER: "platform_user",
  OFFLINE_USER: "offline_user",
} as const;
export type UserType = (typeof USER_TYPES)[keyof typeof USER_TYPES];

export const USER_TYPE_CONFIG: Record<
  UserType,
  {
    label: string;
    shortLabel: string;
    description: string;
    badgeBg: string;
    badgeText: string;
    border: string;
  }
> = {
  [USER_TYPES.PLATFORM_USER]: {
    label: "Platform User (Online Portal)",
    shortLabel: "Platform User",
    description: "Registered online through the web portal",
    badgeBg: "bg-[#024AE5]/10",
    badgeText: "text-[#024AE5]",
    border: "border-[#024AE5]/20",
  },
  [USER_TYPES.OFFLINE_USER]: {
    label: "Offline User (Direct ERP / Billing)",
    shortLabel: "Offline User",
    description: "Direct walk-in or manual account created for billing, dispatch, and ledger",
    badgeBg: "bg-[#3C8B4F]/10",
    badgeText: "text-[#3C8B4F]",
    border: "border-[#3C8B4F]/20",
  },
};

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
