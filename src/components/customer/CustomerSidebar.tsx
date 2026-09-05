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
} from "lucide-react";
import { useState, useEffect } from "react";

interface CustomerSidebarProps {
  companyName?: string;
}

export function CustomerSidebar({
  companyName = "Enterprise Portal",
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
    <aside
      className={cn(
        "relative flex flex-col border-r border-slate-200 bg-white transition-all duration-300 z-30 shrink-0 select-none",
        collapsed ? "w-16" : "w-64"
      )}
    >
      {/* Sidebar Top Brand Header */}
      <div className="flex h-16 items-center justify-between px-4 border-b border-slate-100">
        <Link href="/dashboard" className="flex items-center overflow-hidden py-1">
          <Image
            src="/assets/sojar-logo.webp"
            alt="Sojar Indusy"
            width={180}
            height={48}
            className={cn("h-8 w-auto object-contain transition-all", collapsed ? "h-7 w-7 object-left" : "max-w-[190px]")}
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
                "flex items-center gap-3.5 rounded-lg px-3.5 py-2.5 text-sm font-medium transition-colors",
                isActive
                  ? "bg-[#024AE5]/10 text-[#024AE5] font-semibold"
                  : "text-slate-700 hover:bg-slate-50 hover:text-slate-900",
                collapsed && "justify-center px-2"
              )}
            >
              <Icon
                className={cn(
                  "h-4 w-4 shrink-0 transition-colors",
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
            "flex items-center gap-3.5 rounded-lg px-3.5 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 hover:text-[#024AE5] transition-colors",
            collapsed && "justify-center px-2"
          )}
        >
          <ShoppingBag className="h-4 w-4 text-slate-500 shrink-0" />
          {!collapsed && <span>Browse Catalog</span>}
        </Link>
      </div>

      {/* Collapse Toggle Footer (Admin Dashboard Layout Standard) */}
      <div className="border-t border-slate-100 p-3">
        <button
          type="button"
          onClick={toggleSidebar}
          className={cn(
            "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-slate-500 hover:bg-slate-50 hover:text-slate-800 transition-colors cursor-pointer",
            collapsed && "justify-center px-0"
          )}
          title={collapsed ? "Expand Sidebar" : "Collapse Sidebar"}
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
