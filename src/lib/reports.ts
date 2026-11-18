/**
 * Sales analytics, computed from issued documents. Pure (no I/O) so the numbers are unit-tested.
 * Revenue is net of credit notes and includes debit notes, the way GST returns see it.
 */

export interface ReportInvoice {
  invoice_date: string;
  user_id: string | null;
  bill_to: { name?: string | null; gstin?: string | null } | null;
  items: { name: string; sku: string | null; hsn?: string | null; quantity: number; taxable: number; amount: number }[] | null;
  totals: { taxableTotal: number; cgstTotal: number; sgstTotal: number; igstTotal: number; total: number } | null;
  total_amount: number | string;
}

/** Credit / debit note: same money shape, its own date. */
export interface ReportNote {
  date: string;
  user_id: string | null;
  bill_to: { name?: string | null } | null;
  totals: { taxableTotal: number; cgstTotal: number; sgstTotal: number; igstTotal: number } | null;
  total_amount: number | string;
}

export interface ReportPayment {
  payment_date: string;
  amount: number | string;
  mode: string;
}

const n = (v: unknown) => Number(v) || 0;
const r2 = (v: number) => Math.round(v * 100) / 100;

export interface MonthRow { month: string; invoiced: number; credited: number; debited: number; net: number; invoices: number }

/**
 * One row per calendar month (YYYY-MM) that has any document, oldest first. Pass `from` / `to`
 * (YYYY-MM-DD) to also include the empty months in between as zero rows, so a chart never skips
 * a quiet month.
 */
export function monthlySales(
  invoices: Pick<ReportInvoice, "invoice_date" | "total_amount">[],
  credits: Pick<ReportNote, "date" | "total_amount">[],
  debits: Pick<ReportNote, "date" | "total_amount">[],
  span?: { from: string; to: string }
): MonthRow[] {
  const m = new Map<string, MonthRow>();
  const row = (month: string) => m.get(month) ?? m.set(month, { month, invoiced: 0, credited: 0, debited: 0, net: 0, invoices: 0 }).get(month)!;
  for (const i of invoices) { const x = row(i.invoice_date.slice(0, 7)); x.invoiced += n(i.total_amount); x.invoices += 1; }
  for (const c of credits) row(c.date.slice(0, 7)).credited += n(c.total_amount);
  for (const d of debits) row(d.date.slice(0, 7)).debited += n(d.total_amount);
  if (span) {
    // ponytail: walks month by month; fine for any realistic range (a decade is 120 steps).
    let [y, mo] = span.from.slice(0, 7).split("-").map(Number);
    const end = span.to.slice(0, 7);
    for (let guard = 0; guard < 1200; guard++) {
      const ym = `${y}-${String(mo).padStart(2, "0")}`;
      if (ym > end) break;
      row(ym);
      if (++mo > 12) { mo = 1; y++; }
    }
  }
  return [...m.values()]
    .map((x) => ({ ...x, invoiced: r2(x.invoiced), credited: r2(x.credited), debited: r2(x.debited), net: r2(x.invoiced - x.credited + x.debited) }))
    .sort((a, b) => a.month.localeCompare(b.month));
}

export interface GstRow { label: string; taxable: number; cgst: number; sgst: number; igst: number; total: number }

/** Output tax for the period: invoices + debit notes − credit notes (GSTR-1 / 3B view). */
export function gstSummary(invoices: ReportInvoice[], credits: ReportNote[], debits: ReportNote[]): GstRow[] {
  const sum = (label: string, docs: { totals: ReportInvoice["totals"] | ReportNote["totals"]; total_amount: number | string }[], sign: number): GstRow => {
    const t = { label, taxable: 0, cgst: 0, sgst: 0, igst: 0, total: 0 };
    for (const d of docs) {
      t.taxable += sign * n(d.totals?.taxableTotal);
      t.cgst += sign * n(d.totals?.cgstTotal);
      t.sgst += sign * n(d.totals?.sgstTotal);
      t.igst += sign * n(d.totals?.igstTotal);
      t.total += sign * n(d.total_amount);
    }
    return { label, taxable: r2(t.taxable), cgst: r2(t.cgst), sgst: r2(t.sgst), igst: r2(t.igst), total: r2(t.total) };
  };
  const rows = [sum("Invoices", invoices, 1), sum("Debit notes", debits, 1), sum("Credit notes", credits, -1)];
  const net = rows.reduce(
    (a, x) => ({ label: "Net", taxable: a.taxable + x.taxable, cgst: a.cgst + x.cgst, sgst: a.sgst + x.sgst, igst: a.igst + x.igst, total: a.total + x.total }),
    { label: "Net", taxable: 0, cgst: 0, sgst: 0, igst: 0, total: 0 }
  );
  return [...rows, { ...net, taxable: r2(net.taxable), cgst: r2(net.cgst), sgst: r2(net.sgst), igst: r2(net.igst), total: r2(net.total) }];
}

export interface CustomerRow { key: string; name: string; gstin: string | null; invoices: number; net: number; share: number }

/** Customers by net sales (invoices − credit notes + debit notes), biggest first. */
export function topCustomers(invoices: ReportInvoice[], credits: ReportNote[], debits: ReportNote[], limit = 10): CustomerRow[] {
  const m = new Map<string, Omit<CustomerRow, "share">>();
  const keyOf = (userId: string | null, name: string | null | undefined) => userId ?? `name:${(name ?? "Walk-in").trim().toLowerCase()}`;
  const row = (key: string, name: string, gstin: string | null) =>
    m.get(key) ?? m.set(key, { key, name, gstin, invoices: 0, net: 0 }).get(key)!;
  for (const i of invoices) {
    const x = row(keyOf(i.user_id, i.bill_to?.name), i.bill_to?.name ?? "Walk-in", i.bill_to?.gstin ?? null);
    x.invoices += 1;
    x.net += n(i.total_amount);
  }
  for (const c of credits) row(keyOf(c.user_id, c.bill_to?.name), c.bill_to?.name ?? "Walk-in", null).net -= n(c.total_amount);
  for (const d of debits) row(keyOf(d.user_id, d.bill_to?.name), d.bill_to?.name ?? "Walk-in", null).net += n(d.total_amount);
  const all = [...m.values()].map((x) => ({ ...x, net: r2(x.net) }));
  const total = all.reduce((s, x) => s + Math.max(0, x.net), 0);
  return all
    .sort((a, b) => b.net - a.net)
    .slice(0, limit)
    .map((x) => ({ ...x, share: total > 0 ? r2((Math.max(0, x.net) / total) * 100) : 0 }));
}

export interface ProductRow { key: string; sku: string | null; name: string; quantity: number; taxable: number; invoices: number }

/** Products / SKUs by taxable value invoiced, biggest first. "Extra GST only" lines are skipped. */
export function topProducts(invoices: ReportInvoice[], limit = 10): ProductRow[] {
  const m = new Map<string, ProductRow>();
  for (const i of invoices) {
    const seen = new Set<string>();
    for (const line of i.items ?? []) {
      if ((line as { taxOnly?: unknown }).taxOnly) continue;
      const key = line.sku ? `sku:${line.sku}` : `name:${line.name.trim().toLowerCase()}`;
      const x = m.get(key) ?? m.set(key, { key, sku: line.sku, name: line.name, quantity: 0, taxable: 0, invoices: 0 }).get(key)!;
      x.quantity += n(line.quantity);
      x.taxable += n(line.taxable);
      if (!seen.has(key)) { x.invoices += 1; seen.add(key); }
    }
  }
  return [...m.values()]
    .map((x) => ({ ...x, quantity: r2(x.quantity), taxable: r2(x.taxable) }))
    .sort((a, b) => b.taxable - a.taxable)
    .slice(0, limit);
}

export interface ModeRow { mode: string; amount: number; count: number }

export function collectionsByMode(payments: ReportPayment[]): ModeRow[] {
  const m = new Map<string, ModeRow>();
  for (const p of payments) {
    const x = m.get(p.mode) ?? m.set(p.mode, { mode: p.mode, amount: 0, count: 0 }).get(p.mode)!;
    x.amount += n(p.amount);
    x.count += 1;
  }
  return [...m.values()].map((x) => ({ ...x, amount: r2(x.amount) })).sort((a, b) => b.amount - a.amount);
}
