"use client";

import { BarChart3, FileDown } from "lucide-react";
import type { SalesReport } from "@/actions/reports";
import { PageTitle } from "@/components/common/PageTitle";
import { LoadErrorCard } from "@/components/common/LoadErrorCard";
import { LedgerRangeBar } from "@/components/admin/ledger/LedgerRangeBar";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { downloadCsv } from "@/lib/csv";
import { modeLabel } from "@/lib/payments";

const inr = (n: number) => `₹${n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const inr0 = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;
const monthLabel = (ym: string) => new Date(`${ym}-01T00:00:00`).toLocaleDateString("en-IN", { month: "short", year: "2-digit" });

function Stat({ label, value, hint, tone = "text-slate-900" }: { label: string; value: string; hint?: string; tone?: string }) {
  return (
    <Card className="p-3.5 bg-white border border-slate-200 shadow-none rounded-xl">
      <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">{label}</div>
      <div className={`text-xl font-bold ${tone}`}>{value}</div>
      {hint && <div className="text-[11px] text-slate-500 mt-0.5">{hint}</div>}
    </Card>
  );
}

function Section({ id, title, onExport, children }: { id?: string; title: string; onExport?: () => void; children: React.ReactNode }) {
  return (
    <Card id={id} className="bg-white border border-slate-200 shadow-none rounded-xl overflow-hidden scroll-mt-20">
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
        <h2 className="text-sm font-bold text-slate-900">{title}</h2>
        {onExport && (
          <Button variant="ghost" size="sm" onClick={onExport} className="h-7 gap-1 text-xs text-slate-600">
            <FileDown className="h-3.5 w-3.5" /> CSV
          </Button>
        )}
      </div>
      <div className="p-4">{children}</div>
    </Card>
  );
}

const th = "text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500 py-1.5 pr-3";
const td = "py-1.5 pr-3 text-xs text-slate-700";
const tdNum = "py-1.5 pr-3 text-xs text-slate-900 text-right font-mono whitespace-nowrap";

/** Monthly net sales as thin bars from a shared baseline; hover shows the month's figures. */
export function MonthlyBars({ months }: { months: SalesReport["months"] }) {
  const max = Math.max(1, ...months.map((m) => m.net));
  return (
    <>
    <table className="sr-only">
      <caption>Net sales by month</caption>
      <thead><tr><th>Month</th><th>Net sales</th><th>Invoices</th></tr></thead>
      <tbody>{months.map((m) => <tr key={m.month}><td>{monthLabel(m.month)}</td><td>{inr0(m.net)}</td><td>{m.invoices}</td></tr>)}</tbody>
    </table>
    <div className="flex items-end gap-0.5 h-48 border-b border-slate-200 pt-6" aria-hidden="true">
      {months.map((m) => {
        const pct = Math.max(0, m.net) / max * 100;
        return (
          <div key={m.month} className="group relative flex-1 h-full flex flex-col justify-end items-center min-w-0">
            {/* Hover target is the whole column, wider and taller than the bar itself. */}
            <div className="pointer-events-none absolute bottom-full mb-1 hidden group-hover:block z-10 whitespace-nowrap rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] shadow-md">
              <div className="font-semibold text-slate-900">{monthLabel(m.month)}</div>
              <div className="text-slate-600">Net {inr0(m.net)}</div>
              <div className="text-slate-500">{m.invoices} invoices{m.credited ? ` · credits ${inr0(m.credited)}` : ""}</div>
            </div>
            <div className="w-full max-w-[28px] rounded-t-[4px] bg-[#024AE5] group-hover:bg-[#023ecc]" style={{ height: `${pct}%`, minHeight: m.net > 0 ? 2 : 0 }} />
            <div className="absolute -bottom-5 text-[10px] text-slate-500 truncate max-w-full">{monthLabel(m.month)}</div>
          </div>
        );
      })}
    </div>
    </>
  );
}

export function ReportsClient({ report }: { report: SalesReport }) {
  const { range, months, gst, customers, products, collections, totals, ageing, lowStock, warnings } = report;
  const stamp = `${range.from}-to-${range.to}`;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3">
        <div>
          <PageTitle icon={BarChart3}>Reports</PageTitle>
          <p className="text-xs text-slate-500 mt-1">
            From issued documents: sales are invoices minus credit notes plus debit notes. Receivables are as of the end date.
          </p>
        </div>
        <LedgerRangeBar from={range.from} to={range.to} />
      </div>

      {warnings.map((w) => <LoadErrorCard key={w} message={w} />)}

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <Stat label="Net Sales" value={inr0(totals.net)} hint="incl. GST" tone="text-[#024AE5]" />
        <Stat label="Invoices" value={String(totals.invoices)} hint={`avg ${inr0(totals.avgInvoice)}`} />
        <Stat label="Collected" value={inr0(totals.collected)} hint="payments received" tone="text-emerald-700" />
        <Stat label="Receivable" value={ageing ? inr0(ageing.due) : "—"} hint={`as of ${range.to}`} />
        <Stat label="Overdue" value={ageing ? inr0(ageing.overdue) : "—"} hint="past credit days" tone={ageing && ageing.overdue > 0 ? "text-rose-600" : "text-slate-900"} />
      </div>

      <Section
        title="Net sales by month"
        onExport={() => downloadCsv(`sales-by-month-${stamp}.csv`, ["Month", "Invoices", "Invoiced", "Credit notes", "Debit notes", "Net"],
          months.map((m) => [m.month, m.invoices, m.invoiced.toFixed(2), m.credited.toFixed(2), m.debited.toFixed(2), m.net.toFixed(2)]))}
      >
        {months.length === 0 ? (
          <p className="text-xs text-slate-500">No issued documents in this period.</p>
        ) : (
          <div className="grid lg:grid-cols-[1fr_360px] gap-6">
            <div className="pb-6"><MonthlyBars months={months} /></div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead><tr><th className={th}>Month</th><th className={`${th} text-right`}>Invoiced</th><th className={`${th} text-right`}>Credits</th><th className={`${th} text-right`}>Net</th></tr></thead>
                <tbody>
                  {months.map((m) => (
                    <tr key={m.month} className="border-t border-slate-100">
                      <td className={td}>{monthLabel(m.month)}</td>
                      <td className={tdNum}>{inr0(m.invoiced)}</td>
                      <td className={tdNum}>{m.credited ? `−${inr0(m.credited)}` : "—"}</td>
                      <td className={`${tdNum} font-semibold`}>{inr0(m.net)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </Section>

      <Section
        title="GST summary (output tax)"
        onExport={() => downloadCsv(`gst-summary-${stamp}.csv`, ["Documents", "Taxable", "CGST", "SGST", "IGST", "Total"],
          gst.map((g) => [g.label, g.taxable.toFixed(2), g.cgst.toFixed(2), g.sgst.toFixed(2), g.igst.toFixed(2), g.total.toFixed(2)]))}
      >
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px]">
            <thead><tr>{["Documents", "Taxable", "CGST", "SGST", "IGST", "Total"].map((h, i) => <th key={h} className={`${th} ${i ? "text-right" : ""}`}>{h}</th>)}</tr></thead>
            <tbody>
              {gst.map((g) => (
                <tr key={g.label} className={`border-t border-slate-100 ${g.label === "Net" ? "font-semibold bg-slate-50/60" : ""}`}>
                  <td className={td}>{g.label}</td>
                  <td className={tdNum}>{inr(g.taxable)}</td>
                  <td className={tdNum}>{inr(g.cgst)}</td>
                  <td className={tdNum}>{inr(g.sgst)}</td>
                  <td className={tdNum}>{inr(g.igst)}</td>
                  <td className={tdNum}>{inr(g.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <div className="grid lg:grid-cols-2 gap-6">
        <Section
          title="Top customers"
          onExport={() => downloadCsv(`top-customers-${stamp}.csv`, ["Customer", "GSTIN", "Invoices", "Net sales", "Share %"],
            customers.map((c) => [c.name, c.gstin ?? "", c.invoices, c.net.toFixed(2), c.share]))}
        >
          {customers.length === 0 ? <p className="text-xs text-slate-500">No sales in this period.</p> : (
            <table className="w-full">
              <thead><tr><th className={th}>Customer</th><th className={`${th} text-right`}>Invoices</th><th className={`${th} text-right`}>Net</th><th className={`${th} text-right`}>Share</th></tr></thead>
              <tbody>
                {customers.map((c) => (
                  <tr key={c.key} className="border-t border-slate-100">
                    <td className={`${td} max-w-[220px] truncate`} title={c.name}>{c.name}</td>
                    <td className={tdNum}>{c.invoices}</td>
                    <td className={tdNum}>{inr0(c.net)}</td>
                    <td className={tdNum}>{c.share.toFixed(1)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Section>

        <Section
          title="Top products"
          onExport={() => downloadCsv(`top-products-${stamp}.csv`, ["SKU", "Product", "Quantity", "Taxable value", "Invoices"],
            products.map((p) => [p.sku ?? "", p.name, p.quantity, p.taxable.toFixed(2), p.invoices]))}
        >
          {products.length === 0 ? <p className="text-xs text-slate-500">No sales in this period.</p> : (
            <table className="w-full">
              <thead><tr><th className={th}>SKU / product</th><th className={`${th} text-right`}>Qty</th><th className={`${th} text-right`}>Taxable</th></tr></thead>
              <tbody>
                {products.map((p) => (
                  <tr key={p.key} className="border-t border-slate-100">
                    <td className={`${td} max-w-[260px]`}>
                      <div className="font-mono text-[11px] text-slate-900">{p.sku ?? "—"}</div>
                      <div className="truncate text-slate-500" title={p.name}>{p.name}</div>
                    </td>
                    <td className={tdNum}>{p.quantity}</td>
                    <td className={tdNum}>{inr0(p.taxable)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Section>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <Section title="Collections by mode">
          {collections.length === 0 ? <p className="text-xs text-slate-500">No payments received in this period.</p> : (
            <table className="w-full">
              <thead><tr><th className={th}>Mode</th><th className={`${th} text-right`}>Receipts</th><th className={`${th} text-right`}>Amount</th></tr></thead>
              <tbody>
                {collections.map((c) => (
                  <tr key={c.mode} className="border-t border-slate-100">
                    <td className={td}>{modeLabel(c.mode)}</td>
                    <td className={tdNum}>{c.count}</td>
                    <td className={tdNum}>{inr0(c.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Section>

        <Section id="ageing" title={`Receivables ageing (as of ${range.to})`}>
          {!ageing ? <p className="text-xs text-slate-500">Receivables are available once the ledger migration is applied.</p> : (
            <div className="space-y-4">
              <table className="w-full">
                <thead><tr>{["0–30 days", "31–60", "61–90", "90+"].map((h) => <th key={h} className={`${th} text-right`}>{h}</th>)}</tr></thead>
                <tbody>
                  <tr className="border-t border-slate-100">
                    <td className={tdNum}>{inr0(ageing.d0_30)}</td>
                    <td className={tdNum}>{inr0(ageing.d31_60)}</td>
                    <td className={tdNum}>{inr0(ageing.d61_90)}</td>
                    <td className={`${tdNum} ${ageing.d90_plus > 0 ? "text-rose-600 font-semibold" : ""}`}>{inr0(ageing.d90_plus)}</td>
                  </tr>
                </tbody>
              </table>
              {ageing.topOverdue.length > 0 && (
                <table className="w-full">
                  <thead><tr><th className={th}>Most overdue</th><th className={`${th} text-right`}>Due</th><th className={`${th} text-right`}>Overdue</th></tr></thead>
                  <tbody>
                    {ageing.topOverdue.map((c) => (
                      <tr key={c.id} className="border-t border-slate-100">
                        <td className={td}><a href={`/admin/party-ledger/${c.id}`} className="hover:text-[#024AE5] hover:underline">{c.name}</a></td>
                        <td className={tdNum}>{inr0(c.due)}</td>
                        <td className={`${tdNum} text-rose-600`}>{inr0(c.overdue)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </Section>
      </div>

      <Section
        id="low-stock"
        title={`Low stock (${report.lowStockCount}${report.lowStockCount > lowStock.length ? `, most urgent ${lowStock.length} shown` : ""})`}
        onExport={lowStock.length ? () => downloadCsv(`low-stock-${range.to}.csv`, ["SKU", "Product", "On hand", "Reserved", "Available", "Reorder at", "Target"],
          lowStock.map((s) => [s.sku, s.product, s.stock, s.reserved, s.stock - s.reserved, s.trigger, s.target])) : undefined}
      >
        {lowStock.length === 0 ? <p className="text-xs text-slate-500">No SKU is at or below its reorder level.</p> : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px]">
              <thead><tr><th className={th}>SKU / product</th><th className={`${th} text-right`}>On hand</th><th className={`${th} text-right`}>Reserved</th><th className={`${th} text-right`}>Available</th><th className={`${th} text-right`}>Reorder at</th></tr></thead>
              <tbody>
                {lowStock.map((s) => (
                  <tr key={s.sku} className="border-t border-slate-100">
                    <td className={td}><span className="font-mono text-[11px] text-slate-900">{s.sku}</span> <span className="text-slate-500">{s.product}</span></td>
                    <td className={tdNum}>{s.stock}</td>
                    <td className={tdNum}>{s.reserved}</td>
                    <td className={`${tdNum} ${s.stock - s.reserved <= 0 ? "text-rose-600 font-semibold" : "text-amber-700"}`}>{s.stock - s.reserved}</td>
                    <td className={tdNum}>{s.trigger}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>
    </div>
  );
}
