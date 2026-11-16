"use server";

import { requireAdmin } from "@/lib/auth-guard";
import { createAdminClient } from "@/lib/supabase/admin";
import { todayIst } from "@/lib/ledger";
import { getSalesReport, type SalesReport } from "@/actions/reports";

export interface DashboardData {
  today: string;
  /** Things waiting on someone; each links to the screen that clears it. */
  attention: {
    ordersToProcess: number | null;
    ordersInTransit: number | null;
    returnRequests: number | null;
    customersPending: number | null;
    openPurchaseOrders: number | null;
    rfqsOpen: number | null;
    inquiriesUnread: number | null;
    lowStock: number;
  };
  thisMonth: { net: number; invoices: number; collected: number | null };
  report: SalesReport;
  recentOrders: { id: string; order_number: string; created_at: string; status: string; total_amount: number; company: string }[];
}

/** First day of the month `monthsBack` months before `ymd` (YYYY-MM-DD). */
const monthStart = (ymd: string, monthsBack = 0) => {
  const [y, m] = ymd.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 - monthsBack, 1));
  return d.toISOString().slice(0, 10);
};

export async function getDashboardData(): Promise<DashboardData> {
  await requireAdmin();
  const db = createAdminClient();
  const today = todayIst();

  /** Exact row count without loading rows (no 1000-row limit). null = could not count. */
  const count = async (label: string, build: () => PromiseLike<{ count: number | null; error: { message: string } | null }>) => {
    const { count: c, error } = await build();
    if (error) {
      console.warn(`[dashboard] ${label}:`, error.message);
      return null;
    }
    return c ?? 0;
  };
  const head = (table: string) => db.from(table as never).select("id", { count: "exact", head: true });

  const [ordersToProcess, ordersInTransit, returnRequests, customersPending, openPurchaseOrders, rfqsOpen, inquiriesUnread, collected, report, recent] =
    await Promise.all([
      count("orders to process", () => head("orders").in("status", ["pending", "confirmed", "processing"])),
      count("orders in transit", () => head("orders").eq("status", "shipped")),
      count("return requests", () => head("orders").not("return_reason", "is", null).neq("status", "returned")),
      count("pending customers", () =>
        head("profiles").eq("approval_status", "pending").not("role", "in", '("admin","platform_owner","manufacturer")')),
      count("open POs", () => head("purchase_orders").in("status", ["Placed", "Dispatched / In Transit"])),
      count("open RFQs", () => head("rfqs").in("status", ["pending", "reviewing"])),
      count("unread inquiries", () => head("contact_submissions").eq("status", "unread")),
      (async () => {
        const { data, error } = await db.from("payments" as never).select("amount")
          .eq("status", "received").gte("payment_date", monthStart(today)).lte("payment_date", today);
        if (error) return null;
        return Math.round(((data as unknown as { amount: number | string }[]) ?? []).reduce((s, p) => s + (Number(p.amount) || 0), 0) * 100) / 100;
      })(),
      // Six months of sales for the trend, plus receivables and low stock as of today.
      getSalesReport({ from: monthStart(today, 5), to: today }),
      db.from("orders").select("id, order_number, created_at, status, total_amount, customer_details").order("created_at", { ascending: false }).limit(8),
    ]);

  const current = report.months.find((m) => m.month === today.slice(0, 7));
  return {
    today,
    attention: {
      ordersToProcess, ordersInTransit, returnRequests, customersPending, openPurchaseOrders, rfqsOpen, inquiriesUnread,
      lowStock: report.lowStock.length,
    },
    thisMonth: { net: current?.net ?? 0, invoices: current?.invoices ?? 0, collected },
    report,
    recentOrders: ((recent.data ?? []) as { id: string; order_number: string; created_at: string; status: string; total_amount: number | string; customer_details: { company_name?: string } | null }[])
      .map((o) => ({ id: o.id, order_number: o.order_number, created_at: o.created_at, status: o.status, total_amount: Number(o.total_amount) || 0, company: o.customer_details?.company_name ?? "—" })),
  };
}
