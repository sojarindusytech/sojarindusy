"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Boxes,
  FileText,
  Receipt,
  Building2,
  Headphones,
  ShoppingBag,
  ChevronLeft,
  ChevronRight,
  Layers,
  X,
  LogOut,
} from "lucide-react";
import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { createClient } from "@/lib/supabase/client";

interface CustomerSidebarProps {
  companyName?: string;
  isMobileOpen?: boolean;
  onMobileClose?: () => void;
}

export function CustomerSidebar({
  companyName = "Enterprise Portal",
  isMobileOpen,
  onMobileClose,
}: CustomerSidebarProps) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const saved = localStorage.getItem("customer_sidebar_collapsed");
    if (saved !== null) {
      setCollapsed(saved === "true");
    }
  }, []);

  const toggleSidebar = () => {
    const next = !collapsed;
    setCollapsed(next);
    localStorage.setItem("customer_sidebar_collapsed", String(next));
  };

  const navItems = [
    {
      id: "overview",
      title: "Dashboard",
      href: "/dashboard",
      icon: LayoutDashboard,
      matchExact: true,
    },
    {
      id: "orders",
      title: "Orders & Tracking",
      href: "/dashboard/orders",
      icon: Boxes,
      matchExact: false,
    },
    {
      id: "rfqs",
      title: "Custom RFQs",
      href: "/dashboard/rfqs",
      icon: FileText,
      matchExact: false,
    },
    {
      id: "invoices",
      title: "Invoices & Statements",
      href: "/dashboard/invoices",
      icon: Receipt,
      matchExact: false,
    },
    {
      id: "company",
      title: "Delivery & Profile",
      href: "/dashboard/profile",
      icon: Building2,
      matchExact: false,
    },
    {
      id: "support",
      title: "Technical Support",
      href: "/dashboard/support",
      icon: Headphones,
      matchExact: false,
    },
  ];

  return (
    <>
      {/* Desktop Sidebar (lg screens and up) */}
      <aside
        className={cn(
          "relative hidden lg:flex flex-col border-r border-slate-200 bg-white transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] z-30 shrink-0 select-none",
          collapsed ? "w-16" : "w-64"
        )}
      >
      {/* Sidebar Top Brand Header */}
      <div className="flex h-16 items-center justify-between px-4 border-b border-slate-100">
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
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-1.5">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = item.matchExact
            ? pathname === item.href
            : pathname.startsWith(item.href);

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
              <Icon
                className={cn(
                  "h-4 w-4 shrink-0 transition-transform duration-200 group-hover:scale-110",
                  isActive ? "text-[#024AE5]" : "text-slate-500"
                )}
              />
              {!collapsed && <span>{item.title}</span>}
            </Link>
          );
        })}

        {/* Separator */}
        <div className="pt-2 pb-1">
          <div className="border-t border-slate-100" />
        </div>

        {/* Storefront Catalog Link */}
        <Link
          href="/products"
          title={collapsed ? "Browse Catalog" : undefined}
          className={cn(
            "group flex items-center gap-3.5 rounded-lg px-3.5 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 hover:text-[#024AE5] transition-all duration-200 hover:translate-x-0.5",
            collapsed && "justify-center px-2 hover:translate-x-0"
          )}
        >
          <ShoppingBag className="h-4 w-4 text-slate-500 group-hover:text-[#024AE5] group-hover:scale-110 transition-transform duration-200 shrink-0" />
          {!collapsed && <span>Browse Catalog</span>}
        </Link>
      </div>

      {/* Collapse Toggle Footer (Admin Dashboard Layout Standard) */}
      <div className="border-t border-slate-100 p-3">
        <button
          type="button"
          onClick={toggleSidebar}
          className={cn(
            "group flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-slate-500 hover:bg-slate-50 hover:text-slate-800 transition-all duration-200 cursor-pointer",
            collapsed && "justify-center px-0"
          )}
          title={collapsed ? "Expand Sidebar" : "Collapse Sidebar"}
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

            {/* Account Badge Header */}
            <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-100">
              <div className="text-xs font-bold text-slate-900 truncate">
                {companyName}
              </div>
              <div className="text-[10px] text-slate-500 font-medium">
                Commercial Portal
              </div>
            </div>

            {/* Scrollable Navigation List */}
            <div className="flex-1 min-h-0 overflow-y-auto px-3 py-3 space-y-1.5 [scrollbar-width:thin]">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = item.matchExact
                  ? pathname === item.href
                  : pathname.startsWith(item.href);

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
                    <Icon
                      className={cn(
                        "h-4 w-4 shrink-0 transition-transform duration-200 group-hover:scale-110",
                        isActive ? "text-[#024AE5]" : "text-slate-500"
                      )}
                    />
                    <span>{item.title}</span>
                  </Link>
                );
              })}

              {/* Separator */}
              <div className="pt-2 pb-1">
                <div className="border-t border-slate-100" />
              </div>

              {/* Storefront Catalog Link */}
              <Link
                href="/products"
                onClick={onMobileClose}
                className="group flex items-center gap-3.5 rounded-lg px-3.5 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 hover:text-[#024AE5] transition-all duration-200"
              >
                <ShoppingBag className="h-4 w-4 text-slate-500 group-hover:text-[#024AE5] group-hover:scale-110 transition-transform duration-200 shrink-0" />
                <span>Browse Catalog</span>
              </Link>
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
