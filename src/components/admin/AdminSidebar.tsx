"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Users,
  MessageSquare,
  FileText,
  Package,
  ShoppingBag,
  FileSpreadsheet,
  BookOpen,
  BarChart3,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Layers,
  X,
  LogOut,
} from "lucide-react";
import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { createClient } from "@/lib/supabase/client";

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
    id: "inquiries",
    title: "Inquiries",
    href: "/admin/inquiries",
    icon: MessageSquare,
  },
  {
    id: "products",
    title: "Product Management",
    icon: Package,
    subItems: [
      { title: "Products", href: "/admin/products" },
      { title: "Categories", href: "/admin/categories" },
      { title: "Attributes", href: "/admin/attributes" },
    ],
  },
  {
    id: "orders",
    title: "Orders",
    icon: ShoppingBag,
    subItems: [
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
      { title: "RFQs", href: "/admin/rfqs" },
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

interface AdminSidebarProps {
  isMobileOpen?: boolean;
  onMobileClose?: () => void;
}

export function AdminSidebar({ isMobileOpen, onMobileClose }: AdminSidebarProps = {}) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

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
    <>
      {/* Desktop Sidebar (lg screens and up) */}
      <aside
        className={cn(
          "sticky top-0 h-screen hidden lg:flex flex-col border-r border-slate-200 bg-white transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] z-30 shrink-0 select-none",
          collapsed ? "w-16" : "w-64"
        )}
      >
      {/* Sidebar Top Logo */}
      <div className="flex h-16 shrink-0 items-center justify-between px-4 border-b border-slate-100">
        <Link href="/" className="flex items-center overflow-hidden py-1" title="Sojar Solutions Home">
          <Image
            src="/assets/sojar-logo.svg"
            alt="Sojar Solutions"
            width={180}
            height={48}
            className={cn("h-8 w-auto object-contain transition-all duration-300", collapsed ? "h-7 w-7 object-left" : "max-w-[190px]")}
            priority
          />
        </Link>
      </div>

      {/* Scrollable Nav List */}
      <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-3 py-3 space-y-1.5 [scrollbar-width:thin] [scrollbar-color:#CBD5E1_transparent]">
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
                  "group flex items-center gap-3.5 rounded-lg px-3.5 py-2.5 text-sm font-medium transition-all duration-200 hover:translate-x-0.5",
                  isActive
                    ? "bg-[#024AE5]/10 text-[#024AE5] font-semibold"
                    : "text-slate-700 hover:bg-slate-50 hover:text-slate-900",
                  collapsed && "justify-center px-2 hover:translate-x-0"
                )}
              >
                <Icon className={cn("h-5 w-5 shrink-0 transition-transform duration-200 group-hover:scale-110", isActive ? "text-[#024AE5]" : "text-slate-500")} />
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
                  "group flex w-full items-center justify-between rounded-lg px-3.5 py-2.5 text-sm font-medium transition-all duration-200 cursor-pointer hover:translate-x-0.5",
                  isSectionActive && !isOpen
                    ? "bg-[#024AE5]/10 text-[#024AE5] font-semibold"
                    : "text-slate-800 hover:bg-slate-50 hover:text-slate-900",
                  collapsed && "justify-center px-2 hover:translate-x-0"
                )}
              >
                <div className="flex items-center gap-3.5">
                  <Icon className={cn("h-5 w-5 shrink-0 transition-transform duration-200 group-hover:scale-110", isSectionActive ? "text-[#024AE5]" : "text-slate-600")} />
                  {!collapsed && <span className="truncate">{item.title}</span>}
                </div>
                {!collapsed && (
                  <ChevronDown
                    className={cn(
                      "h-4 w-4 text-slate-400 transition-transform duration-300 ease-in-out",
                      isOpen && "rotate-180 text-slate-700"
                    )}
                  />
                )}
              </button>

              {/* Dropdown Children */}
              {!collapsed && isOpen && item.subItems && (
                <div className="pl-8 pr-2 space-y-0.5 border-l-2 border-slate-100 ml-5 py-1 animate-in fade-in-50 duration-200">
                  {item.subItems.map((sub) => {
                    const isChildActive = pathname === sub.href || pathname.startsWith(sub.href + "/");
                    return (
                      <Link
                        key={sub.href}
                        href={sub.href}
                        className={cn(
                          "flex items-center rounded-md px-3 py-1.5 text-xs font-medium transition-all duration-150 hover:translate-x-0.5",
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
      <div className="shrink-0 border-t border-slate-100 p-3">
        <button
          type="button"
          onClick={() => setCollapsed(!collapsed)}
          className={cn(
            "group flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-slate-500 hover:bg-slate-50 hover:text-slate-800 transition-all duration-200 cursor-pointer",
            collapsed && "justify-center px-0"
          )}
        >
          {collapsed ? (
            <ChevronRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5" />
          ) : (
            <>
              <ChevronLeft className="h-4 w-4 transition-transform duration-200 group-hover:-translate-x-0.5" />
              <span>Collapse</span>
            </>
          )}
        </button>
      </div>
      </aside>

      {/* Mobile Drawer (via Portal) with smooth open & close animations */}
      {mounted && createPortal(
        <div
          className={cn(
            "fixed inset-0 z-50 lg:hidden transition-all duration-300",
            isMobileOpen ? "visible pointer-events-auto" : "invisible pointer-events-none delay-300"
          )}
        >
          {/* Backdrop */}
          <div
            className={cn(
              "fixed inset-0 bg-slate-900/50 backdrop-blur-xs transition-opacity duration-300 ease-in-out",
              isMobileOpen ? "opacity-100" : "opacity-0"
            )}
            onClick={onMobileClose}
          />

          {/* Slide-out Drawer Panel */}
          <div
            className={cn(
              "fixed left-0 top-0 bottom-0 w-[280px] max-w-[85vw] bg-white shadow-2xl flex flex-col z-10 border-r border-slate-200 transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]",
              isMobileOpen ? "translate-x-0" : "-translate-x-full"
            )}
          >
            {/* Drawer Top Header with Logo & Close Button */}
            <div className="flex h-16 shrink-0 items-center justify-between px-4 border-b border-slate-100 bg-white">
              <Link
                href="/"
                onClick={onMobileClose}
                className="flex items-center overflow-hidden py-1"
                title="Sojar Solutions Home"
              >
                <Image
                  src="/assets/sojar-logo.svg"
                  alt="Sojar Solutions"
                  width={160}
                  height={40}
                  className="h-7 w-auto object-contain"
                />
              </Link>
              <button
                type="button"
                onClick={onMobileClose}
                className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-all duration-200 hover:rotate-90 active:scale-90 cursor-pointer"
                aria-label="Close navigation menu"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Scrollable Navigation List */}
            <div className="flex-1 min-h-0 overflow-y-auto px-3 py-3 space-y-1.5 [scrollbar-width:thin]">
              {navItems.map((item) => {
                const Icon = item.icon;
                const hasSubItems = item.subItems && item.subItems.length > 0;

                if (!hasSubItems && item.href) {
                  const isActive = pathname === item.href;
                  return (
                    <Link
                      key={item.id}
                      href={item.href}
                      onClick={onMobileClose}
                      className={cn(
                        "group flex items-center gap-3.5 rounded-lg px-3.5 py-2.5 text-sm font-medium transition-all duration-200",
                        isActive
                          ? "bg-[#024AE5]/10 text-[#024AE5] font-semibold"
                          : "text-slate-700 hover:bg-slate-50 hover:text-slate-900"
                      )}
                    >
                      <Icon className={cn("h-5 w-5 shrink-0", isActive ? "text-[#024AE5]" : "text-slate-500")} />
                      <span className="truncate">{item.title}</span>
                    </Link>
                  );
                }

                const isOpen = !!openSections[item.id];
                const isSectionActive = item.subItems?.some((sub) => pathname === sub.href || pathname.startsWith(sub.href + "/"));

                return (
                  <div key={item.id} className="space-y-0.5">
                    <button
                      type="button"
                      onClick={() => toggleSection(item.id)}
                      className={cn(
                        "group flex w-full items-center justify-between rounded-lg px-3.5 py-2.5 text-sm font-medium transition-all duration-200 cursor-pointer",
                        isSectionActive && !isOpen
                          ? "bg-[#024AE5]/10 text-[#024AE5] font-semibold"
                          : "text-slate-800 hover:bg-slate-50 hover:text-slate-900"
                      )}
                    >
                      <div className="flex items-center gap-3.5">
                        <Icon className={cn("h-5 w-5 shrink-0", isSectionActive ? "text-[#024AE5]" : "text-slate-600")} />
                        <span className="truncate">{item.title}</span>
                      </div>
                      <ChevronDown
                        className={cn(
                          "h-4 w-4 text-slate-400 transition-transform duration-300 ease-in-out",
                          isOpen && "rotate-180 text-slate-700"
                        )}
                      />
                    </button>

                    {isOpen && item.subItems && (
                      <div className="pl-8 pr-2 space-y-0.5 border-l-2 border-slate-100 ml-5 py-1 animate-in fade-in-50 duration-200">
                        {item.subItems.map((sub) => {
                          const isChildActive = pathname === sub.href || pathname.startsWith(sub.href + "/");
                          return (
                            <Link
                              key={sub.href}
                              href={sub.href}
                              onClick={onMobileClose}
                              className={cn(
                                "flex items-center rounded-md px-3 py-1.5 text-xs font-medium transition-all duration-150",
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

            {/* Mobile Drawer Footer: Sign Out */}
            <div className="shrink-0 border-t border-slate-100 p-3 bg-slate-50/50">
              <button
                type="button"
                onClick={async () => {
                  onMobileClose?.();
                  const supabase = createClient();
                  await supabase.auth.signOut();
                  window.location.href = "/login";
                }}
                className="flex w-full items-center justify-center gap-2 h-8 px-2.5 text-xs font-semibold text-slate-700 bg-white hover:text-red-600 hover:bg-red-50 hover:border-red-200 border border-slate-200 rounded-md transition-colors cursor-pointer"
              >
                <LogOut className="h-3.5 w-3.5" />
                <span>Sign Out</span>
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
