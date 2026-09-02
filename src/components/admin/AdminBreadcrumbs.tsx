"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";

interface RouteMeta {
  section?: string;
  sectionHref?: string;
  subSection?: string;
  subSectionHref?: string;
  title: string;
}

const routeMap: Record<string, RouteMeta> = {
  "/admin/customers": {
    title: "Customers",
  },
  "/admin/products": {
    section: "Product Management",
    title: "Products",
  },
  "/admin/categories": {
    section: "Product Management",
    title: "Categories",
  },
  "/admin/attributes": {
    section: "Product Management",
    title: "Attributes",
  },
  "/admin/tags": {
    section: "Product Management",
    title: "Attributes",
  },
  "/admin/categories/tool-types": {
    section: "Product Management",
    sectionHref: "/admin/categories",
    subSection: "Categories",
    subSectionHref: "/admin/categories",
    title: "Tool Types",
  },
  "/admin/categories/flute-types": {
    section: "Product Management",
    sectionHref: "/admin/categories",
    subSection: "Categories",
    subSectionHref: "/admin/categories",
    title: "Flute Configurations",
  },
  "/admin/categories/material-grades": {
    section: "Product Management",
    sectionHref: "/admin/categories",
    subSection: "Categories",
    subSectionHref: "/admin/categories",
    title: "Material Grades & HRC",
  },
  "/admin/categories/coatings": {
    section: "Product Management",
    sectionHref: "/admin/categories",
    subSection: "Categories",
    subSectionHref: "/admin/categories",
    title: "Coatings & Treatments",
  },
  "/admin/product-upload": {
    section: "Product Management",
    title: "Product Upload",
  },
  "/admin/sales-orders": {
    section: "Orders",
    title: "Sales Orders",
  },
  "/admin/purchase-orders": {
    section: "Orders",
    title: "Purchase Orders",
  },
  "/admin/orders": {
    section: "Orders",
    title: "Order List",
  },
  "/admin/order-returns": {
    section: "Orders",
    title: "Order Returns",
  },
  "/admin/dispatch": {
    section: "Orders",
    title: "Dispatch / Delivery",
  },
  "/admin/invoices": {
    section: "Sales",
    title: "Invoice",
  },
  "/admin/quotes": {
    section: "Sales",
    title: "Quotes",
  },
  "/admin/debit-notes": {
    section: "Sales",
    title: "Debit Note",
  },
  "/admin/credit-notes": {
    section: "Sales",
    title: "Credit Note",
  },
  "/admin/eway-bills": {
    section: "Sales",
    title: "E-Way Bill",
  },
  "/admin/expenses": {
    section: "Sales",
    title: "Expense",
  },
  "/admin/delivery-challans": {
    section: "Sales",
    title: "Delivery (Challan)",
  },
  "/admin/general-ledger": {
    section: "Ledger",
    title: "General Ledger",
  },
  "/admin/party-ledger": {
    section: "Ledger",
    title: "Party Ledger",
  },
  "/admin/reports": {
    section: "Analytics & Logs",
    title: "Reports",
  },
  "/admin/audit-logs": {
    section: "Analytics & Logs",
    title: "Audit Log",
  },
};

export function AdminBreadcrumbs() {
  const pathname = usePathname();

  // Hide breadcrumbs entirely on the dashboard home page
  if (pathname === "/admin/dashboard") {
    return null;
  }

  const current = routeMap[pathname] || {
    title: pathname.split("/").filter(Boolean).pop()?.replace(/-/g, " ") || "Page",
  };

  return (
    <div className="w-full bg-transparent px-8 pt-3 pb-1">
      <Breadcrumb>
        <BreadcrumbList className="text-xs">
          {current.section && (
            <>
              <BreadcrumbItem>
                {current.sectionHref ? (
                  <BreadcrumbLink asChild>
                    <Link href={current.sectionHref}>{current.section}</Link>
                  </BreadcrumbLink>
                ) : (
                  <span className="text-slate-500 font-medium">{current.section}</span>
                )}
              </BreadcrumbItem>
              <BreadcrumbSeparator />
            </>
          )}

          {current.subSection && (
            <>
              <BreadcrumbItem>
                {current.subSectionHref ? (
                  <BreadcrumbLink asChild>
                    <Link href={current.subSectionHref}>{current.subSection}</Link>
                  </BreadcrumbLink>
                ) : (
                  <span className="text-slate-500 font-medium">{current.subSection}</span>
                )}
              </BreadcrumbItem>
              <BreadcrumbSeparator />
            </>
          )}

          <BreadcrumbItem>
            <BreadcrumbPage className="font-semibold text-slate-900">
              {current.title}
            </BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>
    </div>
  );
}
