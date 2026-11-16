"use server";

import { requireAdmin } from "@/lib/auth-guard";
import { createAdminClient } from "@/lib/supabase/admin";
import { selectAll } from "@/lib/server/select-all";
import { ledgerReceivableAgeing } from "@/lib/server/rpc";
import { todayIst } from "@/lib/ledger";
import { monthlySales, type MonthRow } from "@/lib/reports";

export interface DashboardData {
  today: string;
  /** Things waiting on someone; each links to the screen that clears it. null = could not count. */
  attention: {
    ordersToProcess: number | null;
    ordersInTransit: number | null;
    returnRequests: number | null;
    customersPending: number | null;
    openPurchaseOrders: number | null;
    rfqsOpen: number | null;
    inquiriesUnread: number | null;
    lowStock: number | null;
  };
  thisMonth: { net: number; invoices: number; collected: number | null };
  /** Exactly six months, oldest first, quiet months as zero. */
  months: MonthRow[];
  receivables: { due: number; overdue: number; topOverdue: { id: string; name: string; overdue: number }[] } | null;
  recentOrders: { id: string; order_number: string; created_at: string; status: string; total_amount: number; company: string }[];
  /** Parts that could not be loaded; the rest still shows. */
  warnings: string[];
}

/** First day of the month `monthsBack` months before `ymd` (YYYY-MM-DD). */
const monthStart = (ymd: string, monthsBack = 0) => {
  const [y, m] = ymd.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1 - monthsBack, 1)).toISOString().slice(0, 10);
};
const r2 = (v: number) => Math.round(v * 100) / 100;
const isMissingTable = (e: { code?: string }) => e.code === "PGRST205" || e.code === "42P01";

/**
 * Everything the dashboard shows, and nothing more: counts are done by the database, sales use
 * only dates and totals (no invoice lines), stock reads three numbers per SKU.
 */
export async function getDashboardData(): Promise<DashboardData> {
  await requireAdmin();
  const db = createAdminClient();
  const today = todayIst();
  const sixMonthsFrom = monthStart(today, 5);
  const warnings: string[] = [];

  /** Exact row count without loading rows (no 1000-row limit). null = could not count. */
  type CountResult = { count: number | null; error: { message: string; code?: string } | null };
  const count = async (label: string, build: () => PromiseLike<CountResult>, fallback?: () => PromiseLike<CountResult>) => {
    let { count: c, error } = await build();
    if (error && fallback) ({ count: c, error } = await fallback());
    if (error) {
      console.warn(`[dashboard] ${label}:`, error.message);
      return null;
    }
    return c ?? 0;
  };
  const head = (table: string) => db.from(table as never).select("id", { count: "exact", head: true });

  /** Rows of a light query; a missing table is "none yet", other failures become a warning. */
  const rows = async <T,>(label: string, load: () => Promise<T[]>): Promise<T[] | null> => {
    try {
      return await load();
    } catch (err) {
      const e = err as { code?: string; message?: string };
      if (isMissingTable(e)) return [];
      console.error(`[dashboard] ${label}:`, e.code, e.message);
      warnings.push(`${label} could not be loaded.`);
      return null;
    }
  };

  const customerPending = () =>
    head("profiles").eq("approval_status", "pending").not("role", "in", '("admin","platform_owner","manufacturer")');

  const [
    ordersToProcess, ordersInTransit, returnRequests, customersPending, openPurchaseOrders, rfqsOpen, inquiriesUnread,
    invoices, credits, debits, payments, stock, ageing, recent,
  ] = await Promise.all([
    count("orders to process", () => head("orders").in("status", ["pending", "confirmed", "processing"])),
    count("orders in transit", () => head("orders").eq("status", "shipped")),
    count("return requests", () => head("orders").not("return_reason", "is", null).neq("status", "returned")),
    // Deactivated accounts are not waiting for approval; before that migration the column is missing.
    count("pending customers", () => customerPending().is("deactivated_at", null), customerPending),
    count("open POs", () => head("purchase_orders").in("status", ["Placed", "Dispatched / In Transit"])),
    count("open RFQs", () => head("rfqs").in("status", ["pending", "reviewing"])),
    count("unread inquiries", () => head("contact_submissions").eq("status", "unread")),
    rows<{ invoice_date: string; total_amount: number | string }>("Invoices", () =>
      selectAll((f, t) => db.from("invoices").select("invoice_date, total_amount")
        .eq("status", "issued").gte("invoice_date", sixMonthsFrom).lte("invoice_date", today).order("id").range(f, t))),
    rows<{ date: string; total_amount: number | string }>("Credit notes", async () =>
      (await selectAll<{ credit_note_date: string; total_amount: number | string }>((f, t) => db.from("credit_notes" as never)
        .select("credit_note_date, total_amount").gte("credit_note_date", sixMonthsFrom).lte("credit_note_date", today).order("id").range(f, t)))
        .map((c) => ({ date: c.credit_note_date, total_amount: c.total_amount }))),
    rows<{ date: string; total_amount: number | string }>("Debit notes", async () =>
      (await selectAll<{ debit_note_date: string; total_amount: number | string }>((f, t) => db.from("debit_notes" as never)
        .select("debit_note_date, total_amount").eq("status", "issued").gte("debit_note_date", sixMonthsFrom).lte("debit_note_date", today).order("id").range(f, t)))
        .map((d) => ({ date: d.debit_note_date, total_amount: d.total_amount }))),
    rows<{ amount: number | string }>("Payments", () =>
      selectAll((f, t) => db.from("payments" as never).select("amount")
        .eq("status", "received").gte("payment_date", monthStart(today)).lte("payment_date", today).order("id").range(f, t))),
    rows<{ stock_quantity: number; reserved_quantity: number; trigger_quantity: number }>("Stock", () =>
      selectAll((f, t) => db.from("product_variants").select("stock_quantity, reserved_quantity, trigger_quantity")
        .eq("is_archived", false).gt("trigger_quantity", 0).order("id").range(f, t))),
    ledgerReceivableAgeing(today),
    db.from("orders").select("id, order_number, created_at, status, total_amount, customer_details").order("created_at", { ascending: false }).limit(8),
  ]);

  const months = monthlySales(invoices ?? [], credits ?? [], debits ?? [], { from: sixMonthsFrom, to: today });
  const current = months.find((m) => m.month === today.slice(0, 7));

  // Receivables: totals for every customer, names only for the few shown.
  let receivables: DashboardData["receivables"] = null;
  if (ageing.error) {
    if (!isMissingTable({ code: ageing.error.code })) warnings.push("Receivables could not be loaded.");
  } else {
    const top = ageing.data.filter((x) => x.overdue > 0).sort((a, b) => b.overdue - a.overdue).slice(0, 4);
    const names = new Map<string, string>();
    if (top.length) {
      const { data } = await db.from("profiles").select("id, company_name, first_name, last_name, email").in("id", top.map((x) => x.party_id));
      for (const p of (data ?? []) as { id: string; company_name: string | null; first_name: string | null; last_name: string | null; email: string | null }[]) {
        names.set(p.id, p.company_name || `${p.first_name ?? ""} ${p.last_name ?? ""}`.trim() || p.email || "Customer");
      }
    }
    receivables = {
      due: r2(ageing.data.reduce((s, x) => s + x.due, 0)),
      overdue: r2(ageing.data.reduce((s, x) => s + x.overdue, 0)),
      topOverdue: top.map((x) => ({ id: x.party_id, name: names.get(x.party_id) ?? "Customer", overdue: r2(x.overdue) })),
    };
  }

  if (recent.error) warnings.push("Recent orders could not be loaded.");

  return {
    today,
    attention: {
      ordersToProcess, ordersInTransit, returnRequests, customersPending, openPurchaseOrders, rfqsOpen, inquiriesUnread,
      lowStock: stock === null
        ? null
        : stock.filter((v) => (Number(v.stock_quantity) || 0) - (Number(v.reserved_quantity) || 0) <= (Number(v.trigger_quantity) || 0)).length,
    },
    thisMonth: {
      net: current?.net ?? 0,
      invoices: current?.invoices ?? 0,
      collected: payments === null ? null : r2(payments.reduce((s, p) => s + (Number(p.amount) || 0), 0)),
    },
    months,
    receivables,
    recentOrders: ((recent.data ?? []) as { id: string; order_number: string; created_at: string; status: string; total_amount: number | string; customer_details: { company_name?: string } | null }[])
      .map((o) => ({ id: o.id, order_number: o.order_number, created_at: o.created_at, status: o.status, total_amount: Number(o.total_amount) || 0, company: o.customer_details?.company_name ?? "—" })),
    warnings,
  };
}
