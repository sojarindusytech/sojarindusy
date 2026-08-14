"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Users,
  Package,
  ShoppingBag,
  FileSpreadsheet,
  BookOpen,
  BarChart3,
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

interface NavSectionItem {
  id: string;
  title: string;
  href?: string;
  icon: React.ComponentType<{ className?: string }>;
  subItems?: SubItem[];
}

const navItems: NavSectionItem[] = [
  {
    id: "dashboard",
    title: "Dashboard",
    href: "/admin/dashboard",
    icon: LayoutDashboard,
  },
  {
    id: "customers",
    title: "Customers",
    href: "/admin/customers",
    icon: Users,
  },
  {
    id: "products",
    title: "Product Management",
    icon: Package,
    subItems: [
      { title: "Products", href: "/admin/products" },
      { title: "Categories / Variants", href: "/admin/categories" },
      { title: "Product Upload", href: "/admin/product-upload" },
    ],
  },
  {
    id: "orders",
    title: "Orders",
    icon: ShoppingBag,
    subItems: [
      { title: "Sales Orders", href: "/admin/sales-orders" },
      { title: "Purchase Orders", href: "/admin/purchase-orders" },
      { title: "Order List", href: "/admin/orders" },
      { title: "Order Returns", href: "/admin/order-returns" },
      { title: "Dispatch / Delivery", href: "/admin/dispatch" },
    ],
  },
  {
    id: "sales",
    title: "Sales",
    icon: FileSpreadsheet,
    subItems: [
      { title: "Invoice", href: "/admin/invoices" },
      { title: "Quotes", href: "/admin/quotes" },
      { title: "Debit Note", href: "/admin/debit-notes" },
      { title: "Credit Note", href: "/admin/credit-notes" },
      { title: "E-Way Bill", href: "/admin/eway-bills" },
      { title: "Expense", href: "/admin/expenses" },
      { title: "Delivery (Challan)", href: "/admin/delivery-challans" },
    ],
  },
  {
    id: "ledger",
    title: "Ledger",
    icon: BookOpen,
    subItems: [
      { title: "General Ledger", href: "/admin/general-ledger" },
      { title: "Party Ledger", href: "/admin/party-ledger" },
    ],
  },
  {
    id: "analytics",
    title: "Analytics & Logs",
    icon: BarChart3,
    subItems: [
      { title: "Reports", href: "/admin/reports" },
      { title: "Audit Log", href: "/admin/audit-logs" },
    ],
  },
];

export function AdminSidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  // Maintain open/closed state for each dropdown section (all closed by default)
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    products: false,
    orders: false,
    sales: false,
    ledger: false,
    analytics: false,
  });

  // Automatically expand the section that contains the current active route
  useEffect(() => {
    navItems.forEach((item) => {
      if (item.subItems) {
        const isChildActive = item.subItems.some((sub) => pathname.startsWith(sub.href));
        if (isChildActive) {
          setOpenSections((prev) => ({ ...prev, [item.id]: true }));
        }
      }
    });
  }, [pathname]);

  const toggleSection = (id: string) => {
    setOpenSections((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  return (
    <aside
      className={cn(
        "relative flex flex-col border-r border-slate-200 bg-white transition-all duration-300 z-30 shrink-0 select-none",
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

      {/* Scrollable Nav List */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-1.5">
        {navItems.map((item) => {
          const Icon = item.icon;
          const hasSubItems = item.subItems && item.subItems.length > 0;

          // Single Direct Route (Dashboard, Customers)
          if (!hasSubItems && item.href) {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.id}
                href={item.href}
                title={collapsed ? item.title : undefined}
                className={cn(
                  "flex items-center gap-3.5 rounded-lg px-3.5 py-2.5 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-[#024AE5]/10 text-[#024AE5] font-semibold"
                    : "text-slate-700 hover:bg-slate-50 hover:text-slate-900",
                  collapsed && "justify-center px-2"
                )}
              >
                <Icon className={cn("h-5 w-5 shrink-0", isActive ? "text-[#024AE5]" : "text-slate-500")} />
                {!collapsed && <span className="truncate">{item.title}</span>}
              </Link>
            );
          }

          // Dropdown Section (Product Management, Orders, Sales, Ledger, Analytics & Logs)
          const isOpen = !!openSections[item.id];
          const isSectionActive = item.subItems?.some((sub) => pathname === sub.href || pathname.startsWith(sub.href + "/"));

          return (
            <div key={item.id} className="space-y-0.5">
              {/* Dropdown Header Row */}
              <button
                type="button"
                onClick={() => toggleSection(item.id)}
                title={collapsed ? item.title : undefined}
                className={cn(
                  "flex w-full items-center justify-between rounded-lg px-3.5 py-2.5 text-sm font-medium transition-colors cursor-pointer",
                  isSectionActive && !isOpen
                    ? "bg-[#024AE5]/10 text-[#024AE5] font-semibold"
                    : "text-slate-800 hover:bg-slate-50 hover:text-slate-900",
                  collapsed && "justify-center px-2"
                )}
              >
                <div className="flex items-center gap-3.5">
                  <Icon className={cn("h-5 w-5 shrink-0", isSectionActive ? "text-[#024AE5]" : "text-slate-600")} />
                  {!collapsed && <span className="truncate">{item.title}</span>}
                </div>
                {!collapsed && (
                  <ChevronDown
                    className={cn(
                      "h-4 w-4 text-slate-400 transition-transform duration-200",
                      isOpen && "rotate-180 text-slate-700"
                    )}
                  />
                )}
              </button>

              {/* Dropdown Children */}
              {!collapsed && isOpen && item.subItems && (
                <div className="pl-8 pr-2 space-y-0.5 border-l-2 border-slate-100 ml-5 py-1 animate-in fade-in-50 duration-150">
                  {item.subItems.map((sub) => {
                    const isChildActive = pathname === sub.href || pathname.startsWith(sub.href + "/");
                    return (
                      <Link
                        key={sub.href}
                        href={sub.href}
                        className={cn(
                          "flex items-center rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                          isChildActive
                            ? "bg-[#024AE5]/10 text-[#024AE5] font-semibold"
                            : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
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
        })}
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
