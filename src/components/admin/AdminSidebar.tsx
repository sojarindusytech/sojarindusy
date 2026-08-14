"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Users,
  Package,
  Tags,
  UploadCloud,
  ShoppingCart,
  ShoppingBag,
  ListOrdered,
  RotateCcw,
  Truck,
  FileSpreadsheet,
  MessageSquareQuote,
  FileMinus,
  FilePlus,
  FileCheck,
  DollarSign,
  ClipboardCheck,
  BookOpen,
  BookMarked,
  BarChart3,
  ShieldAlert,
  ChevronLeft,
  ChevronRight,
  Layers,
} from "lucide-react";
import { useState } from "react";

interface NavItem {
  title: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
}

interface NavGroup {
  groupTitle?: string;
  items: NavItem[];
}

const navGroups: NavGroup[] = [
  {
    items: [
      { title: "Dashboard", href: "/admin/dashboard", icon: LayoutDashboard },
      { title: "Customers", href: "/admin/customers", icon: Users },
    ],
  },
  {
    groupTitle: "Product Management",
    items: [
      { title: "Products", href: "/admin/products", icon: Package },
      { title: "Categories / Variants", href: "/admin/categories", icon: Tags },
      { title: "Product Upload", href: "/admin/product-upload", icon: UploadCloud },
    ],
  },
  {
    groupTitle: "Orders",
    items: [
      { title: "Sales Orders", href: "/admin/sales-orders", icon: ShoppingCart },
      { title: "Purchase Orders", href: "/admin/purchase-orders", icon: ShoppingBag },
      { title: "Order List", href: "/admin/orders", icon: ListOrdered },
      { title: "Order Returns", href: "/admin/order-returns", icon: RotateCcw },
      { title: "Dispatch / Delivery", href: "/admin/dispatch", icon: Truck },
    ],
  },
  {
    groupTitle: "Sales",
    items: [
      { title: "Invoice", href: "/admin/invoices", icon: FileSpreadsheet },
      { title: "Quotes", href: "/admin/quotes", icon: MessageSquareQuote },
      { title: "Debit Note", href: "/admin/debit-notes", icon: FileMinus },
      { title: "Credit Note", href: "/admin/credit-notes", icon: FilePlus },
      { title: "E-Way Bill", href: "/admin/eway-bills", icon: FileCheck },
      { title: "Expense", href: "/admin/expenses", icon: DollarSign },
      { title: "Delivery (Challan)", href: "/admin/delivery-challans", icon: ClipboardCheck },
    ],
  },
  {
    groupTitle: "Ledger",
    items: [
      { title: "General Ledger", href: "/admin/general-ledger", icon: BookOpen },
      { title: "Party Ledger", href: "/admin/party-ledger", icon: BookMarked },
    ],
  },
  {
    groupTitle: "Analytics & Logs",
    items: [
      { title: "Reports", href: "/admin/reports", icon: BarChart3 },
      { title: "Audit Log", href: "/admin/audit-logs", icon: ShieldAlert },
    ],
  },
];

export function AdminSidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside
      className={cn(
        "relative flex flex-col border-r border-slate-200 bg-white transition-all duration-300 z-30 shrink-0",
        collapsed ? "w-16" : "w-64"
      )}
    >
      {/* Sidebar Top Logo */}
      <div className="flex h-16 items-center justify-between px-4 border-b border-slate-100">
        <Link href="/admin/dashboard" className="flex items-center gap-3 overflow-hidden">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#024AE5] to-[#3C8B4F] text-white">
            <Layers className="h-5 w-5" />
          </div>
          {!collapsed && (
            <div className="flex flex-col">
              <span className="text-sm font-bold tracking-tight text-slate-900 leading-tight">
                SOJAR INDUSY
              </span>
              <span className="text-[9px] font-semibold uppercase tracking-wider text-slate-400">
                INDUSTRIAL MANUFACTURING
              </span>
            </div>
          )}
        </Link>
      </div>

      {/* Navigation Label */}
      {!collapsed && (
        <div className="px-4 pt-4 pb-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
            NAVIGATION
          </span>
        </div>
      )}

      {/* Scrollable Nav List */}
      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-4">
        {navGroups.map((group, idx) => (
          <div key={idx} className="space-y-1">
            {group.groupTitle && !collapsed && (
              <div className="px-3 pt-2 pb-1 text-[11px] font-bold text-slate-500 uppercase tracking-wide">
                {group.groupTitle}
              </div>
            )}
            {group.items.map((item) => {
              const isActive = pathname === item.href;
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  title={collapsed ? item.title : undefined}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2 text-xs font-medium transition-colors",
                    isActive
                      ? "bg-[#024AE5]/10 text-[#024AE5] font-semibold"
                      : "text-slate-600 hover:bg-slate-50 hover:text-slate-900",
                    collapsed && "justify-center px-2"
                  )}
                >
                  <Icon className={cn("h-4 w-4 shrink-0", isActive ? "text-[#024AE5]" : "text-slate-500")} />
                  {!collapsed && <span className="truncate">{item.title}</span>}
                </Link>
              );
            })}
          </div>
        ))}
      </div>

      {/* Collapse Toggle Footer */}
      <div className="border-t border-slate-100 p-3">
        <button
          type="button"
          onClick={() => setCollapsed(!collapsed)}
          className={cn(
            "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-slate-500 hover:bg-slate-50 hover:text-slate-800 transition-colors",
            collapsed && "justify-center px-0"
          )}
        >
          {collapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <>
              <ChevronLeft className="h-4 w-4" />
              <span>Collapse</span>
            </>
          )}
        </button>
      </div>
    </aside>
  );
}
