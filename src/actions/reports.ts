"use server";

import { requireAdmin } from "@/lib/auth-guard";
import { createAdminClient } from "@/lib/supabase/admin";
import { selectAll } from "@/lib/server/select-all";
import { ledgerReceivableAgeing } from "@/lib/server/rpc";
import { loadParties, resolveRange, type LedgerRange } from "@/lib/server/ledger";
import {
  collectionsByMode,
  gstSummary,
  monthlySales,
  topCustomers,
  topProducts,
  type CustomerRow,
  type GstRow,
  type ModeRow,
  type MonthRow,
  type ProductRow,
  type ReportInvoice,
  type ReportNote,
  type ReportPayment,
} from "@/lib/reports";

export interface AgeingSummary {
  due: number;
  d0_30: number;
  d31_60: number;
  d61_90: number;
  d90_plus: number;
  overdue: number;
  /** Customers with the most overdue, biggest first. */
  topOverdue: { id: string; name: string; due: number; overdue: number }[];
}

export interface LowStockRow { sku: string; product: string; stock: number; reserved: number; trigger: number; target: number }

export interface SalesReport {
  range: LedgerRange;
  months: MonthRow[];
  gst: GstRow[];
  customers: CustomerRow[];
  products: ProductRow[];
  collections: ModeRow[];
  totals: { net: number; invoices: number; collected: number; avgInvoice: number };
  ageing: AgeingSummary | null;
  /** Most urgent first, at most 50 rows. */
  lowStock: LowStockRow[];
  /** Every SKU at or below its reorder level (the list above is cut to 50). */
  lowStockCount: number;
  /** Parts that could not be loaded; the rest of the report still shows. */
  warnings: string[];
}

const isMissingTable = (e: { code?: string }) => e.code === "PGRST205" || e.code === "42P01";
const r2 = (v: number) => Math.round(v * 100) / 100;

export async function getSalesReport(range?: Partial<LedgerRange>): Promise<SalesReport> {
  await requireAdmin();
  const r = resolveRange(range);
  const db = createAdminClient();
  const warnings: string[] = [];

  /** Loads one part; a missing table is "none yet", any other failure is a warning. */
  const part = async <T,>(label: string, load: () => Promise<T[]>): Promise<T[]> => {
    try {
      return await load();
    } catch (err) {
      const e = err as { code?: string; message?: string };
      if (!isMissingTable(e)) {
        console.error(`[getSalesReport] ${label}:`, e.code, e.message);
        warnings.push(`${label} could not be loaded.`);
      }
      return [];
    }
  };

  const [invoices, creditRows, debitRows, payments, variants] = await Promise.all([
    part<ReportInvoice>("Invoices", () =>
      selectAll((f, t) => (db.from("invoices") as any) // eslint-disable-line @typescript-eslint/no-explicit-any
        .select("invoice_date, user_id, bill_to, items, totals, total_amount")
        .eq("status", "issued").gte("invoice_date", r.from).lte("invoice_date", r.to)
        .order("invoice_date").order("id").range(f, t))),
    part<ReportNote & { credit_note_date: string }>("Credit notes", () =>
      selectAll((f, t) => db.from("credit_notes" as never)
        .select("credit_note_date, user_id, bill_to, totals, total_amount")
        .gte("credit_note_date", r.from).lte("credit_note_date", r.to)
        .order("credit_note_date").order("id").range(f, t))),
    part<ReportNote & { debit_note_date: string }>("Debit notes", () =>
      selectAll((f, t) => db.from("debit_notes" as never)
        .select("debit_note_date, user_id, bill_to, totals, total_amount")
        .eq("status", "issued").gte("debit_note_date", r.from).lte("debit_note_date", r.to)
        .order("debit_note_date").order("id").range(f, t))),
    part<ReportPayment>("Payments", () =>
      selectAll((f, t) => db.from("payments" as never)
        .select("payment_date, amount, mode")
        .eq("status", "received").gte("payment_date", r.from).lte("payment_date", r.to)
        .order("payment_date").order("id").range(f, t))),
    part<{ sku: string; stock_quantity: number; reserved_quantity: number; trigger_quantity: number; min_quantity: number; products: { title: string } | null }>(
      "Stock", () =>
        selectAll((f, t) => db.from("product_variants")
          .select("sku, stock_quantity, reserved_quantity, trigger_quantity, min_quantity, products(title)")
          .eq("is_archived", false).gt("trigger_quantity", 0)
          .order("id").range(f, t))),
  ]);

  const credits: ReportNote[] = creditRows.map((c) => ({ ...c, date: c.credit_note_date }));
  const debits: ReportNote[] = debitRows.map((d) => ({ ...d, date: d.debit_note_date }));

  const months = monthlySales(invoices, credits, debits, r);
  const net = r2(months.reduce((s, m) => s + m.net, 0));
  const collections = collectionsByMode(payments);
  const collected = r2(collections.reduce((s, m) => s + m.amount, 0));

  // Receivables as of the end of the range (ledger ageing, first-in-first-out).
  let ageing: AgeingSummary | null = null;
  const ageingRes = await ledgerReceivableAgeing(r.to);
  if (ageingRes.error) {
    if (!isMissingTable({ code: ageingRes.error.code })) warnings.push("Receivables ageing could not be loaded.");
  } else {
    const rows = ageingRes.data;
    const sum = (k: "due" | "d0_30" | "d31_60" | "d61_90" | "d90_plus" | "overdue") => r2(rows.reduce((s, x) => s + x[k], 0));
    const names = new Map((await loadParties().catch(() => [])).map((p) => [p.id, p.name]));
    ageing = {
      due: sum("due"), d0_30: sum("d0_30"), d31_60: sum("d31_60"), d61_90: sum("d61_90"), d90_plus: sum("d90_plus"), overdue: sum("overdue"),
      topOverdue: rows
        .filter((x) => x.overdue > 0)
        .sort((a, b) => b.overdue - a.overdue)
        .slice(0, 8)
        .map((x) => ({ id: x.party_id, name: names.get(x.party_id) ?? "Unknown customer", due: r2(x.due), overdue: r2(x.overdue) })),
    };
  }

  const lowAll: LowStockRow[] = variants
    .map((v) => ({
      sku: v.sku,
      product: v.products?.title ?? "",
      stock: Number(v.stock_quantity) || 0,
      reserved: Number(v.reserved_quantity) || 0,
      trigger: Number(v.trigger_quantity) || 0,
      target: Number(v.min_quantity) || 0,
    }))
    .filter((v) => v.stock - v.reserved <= v.trigger)
    .sort((a, b) => (a.stock - a.reserved - a.trigger) - (b.stock - b.reserved - b.trigger));
  const lowStock = lowAll.slice(0, 50);

  return {
    range: r,
    months,
    gst: gstSummary(invoices, credits, debits),
    customers: topCustomers(invoices, credits, debits, 10),
    products: topProducts(invoices, 10),
    collections,
    totals: { net, invoices: invoices.length, collected, avgInvoice: invoices.length ? r2(invoices.reduce((s, i) => s + (Number(i.total_amount) || 0), 0) / invoices.length) : 0 },
    ageing,
    lowStock,
    lowStockCount: lowAll.length,
    warnings,
  };
}
