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
  ChevronDown,
  Layers,
} from "lucide-react";
import { useState, useEffect } from "react";

interface SubItem {
  title: string;
  href: string;
}

interface NavItem {
  title: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  subItems?: SubItem[];
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
      {
        title: "Categories / Variants",
        href: "/admin/categories",
        icon: Tags,
        subItems: [
          { title: "Overview", href: "/admin/categories" },
          { title: "Tool Types", href: "/admin/categories/tool-types" },
          { title: "Flute Configurations", href: "/admin/categories/flute-types" },
          { title: "Material Grades & HRC", href: "/admin/categories/material-grades" },
          { title: "Coatings & Treatments", href: "/admin/categories/coatings" },
        ],
      },
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
  const [openDropdowns, setOpenDropdowns] = useState<Record<string, boolean>>({
    "/admin/categories": true,
  });

  // Auto-expand category dropdown if user is on any category sub-route
  useEffect(() => {
    if (pathname.startsWith("/admin/categories")) {
      setOpenDropdowns((prev) => ({ ...prev, "/admin/categories": true }));
    }
  }, [pathname]);

  const toggleDropdown = (href: string) => {
    setOpenDropdowns((prev) => ({
      ...prev,
      [href]: !prev[href],
    }));
  };

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
              const hasSubItems = item.subItems && item.subItems.length > 0;
              const isParentActive = hasSubItems
                ? pathname.startsWith(item.href)
                : pathname === item.href;
              const isDropdownOpen = !!openDropdowns[item.href];
              const Icon = item.icon;

              if (hasSubItems && !collapsed) {
                return (
                  <div key={item.href} className="space-y-1">
                    <button
                      type="button"
                      onClick={() => toggleDropdown(item.href)}
                      className={cn(
                        "flex w-full items-center justify-between rounded-lg px-3 py-2 text-xs font-medium transition-colors cursor-pointer",
                        isParentActive
                          ? "bg-[#024AE5]/10 text-[#024AE5] font-semibold"
                          : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <Icon className={cn("h-4 w-4 shrink-0", isParentActive ? "text-[#024AE5]" : "text-slate-500")} />
                        <span className="truncate">{item.title}</span>
                      </div>
                      <ChevronDown
                        className={cn(
                          "h-3.5 w-3.5 text-slate-400 transition-transform duration-200",
                          isDropdownOpen && "rotate-180 text-slate-700"
                        )}
                      />
                    </button>

                    {/* Collapsible Sub Items */}
                    {isDropdownOpen && (
                      <div className="pl-7 pr-2 space-y-0.5 animate-in fade-in-50 duration-150 border-l border-slate-200 ml-4">
                        {item.subItems?.map((sub) => {
                          const isSubActive = pathname === sub.href;
                          return (
                            <Link
                              key={sub.href}
                              href={sub.href}
                              className={cn(
                                "flex items-center rounded-md px-2.5 py-1.5 text-[11px] font-medium transition-colors",
                                isSubActive
                                  ? "bg-[#024AE5] text-white font-semibold shadow-xs"
                                  : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                              )}
                            >
                              <span className="truncate">{sub.title}</span>
                            </Link>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              }

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  title={collapsed ? item.title : undefined}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2 text-xs font-medium transition-colors",
                    isParentActive
                      ? "bg-[#024AE5]/10 text-[#024AE5] font-semibold"
                      : "text-slate-600 hover:bg-slate-50 hover:text-slate-900",
                    collapsed && "justify-center px-2"
                  )}
                >
                  <Icon className={cn("h-4 w-4 shrink-0", isParentActive ? "text-[#024AE5]" : "text-slate-500")} />
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
            "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-slate-500 hover:bg-slate-50 hover:text-slate-800 transition-colors cursor-pointer",
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
