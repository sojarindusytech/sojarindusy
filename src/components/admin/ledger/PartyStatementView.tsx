"use client";

import Link from "next/link";
import { useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Download, FileText, Plus } from "lucide-react";
import type { JournalFormData, PartyStatement } from "@/actions/ledger";
import { amount, documentPdfHref, fmtDate, inr } from "@/lib/ledger";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { LedgerRangeBar } from "./LedgerRangeBar";
import { DrCr, StatementTable } from "./StatementTable";
import { JournalFormModal } from "./JournalFormModal";

type Tab = "statement" | "bills" | "ageing";

/**
 * One party's statement of account: opening balance, every entry with a running balance, closing
 * balance; for customers also the bills still due and how old the balance is. Admins and the
 * customer (their own) see the same page; admins also add opening balances and see cancelled entries.
 */
export function PartyStatementView({
  statement,
  admin,
  showReversed = false,
  formData,
  pdfHref,
}: {
  statement: PartyStatement;
  admin: boolean;
  showReversed?: boolean;
  /** Admin: accounts and parties for the opening balance form. */
  formData?: JournalFormData;
  pdfHref: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [tab, setTab] = useState<Tab>("statement");
  const [opening, setOpening] = useState(false);
  const { party, totals, range } = statement;
  const isCustomer = party?.role === "customer";

  const toggleReversed = (on: boolean) => {
    const next = new URLSearchParams(params.toString());
    if (on) next.set("all", "1");
    else next.delete("all");
    router.push(`${pathname}?${next.toString()}`);
  };

  const tabs: [Tab, string][] = [["statement", "Statement"]];
  if (isCustomer) tabs.push(["bills", `Pending bills (${statement.pendingBills.length})`], ["ageing", "Ageing"]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div className="space-y-1 min-w-0">
          {admin && (
            <Link href={`/admin/party-ledger?from=${range.from}&to=${range.to}`} className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-[#024AE5]">
              <ArrowLeft className="h-3.5 w-3.5" />Party Ledger
            </Link>
          )}
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 truncate">
            {admin ? party?.name ?? "Documents without a customer" : "Account Statement"}
          </h1>
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
            {party && <Badge variant={isCustomer ? "blue" : "warning"} className="text-[10px]">{isCustomer ? "Customer" : "Manufacturer"}</Badge>}
            {party?.gstin && <span className="font-mono">GSTIN {party.gstin}</span>}
            {isCustomer && <span>Credit period {party!.credit_days} days</span>}
            {!admin && party && <span>{party.name}</span>}
          </div>
        </div>
        <div className="flex gap-2 shrink-0">
          {admin && party && formData && (
            <Button variant="outline" className="gap-1.5" onClick={() => setOpening(true)}><Plus className="h-4 w-4" />Opening balance</Button>
          )}
          {party && (
            <Button asChild className="gap-1.5">
              <a href={pdfHref}><Download className="h-4 w-4" />Download PDF</a>
            </Button>
          )}
        </div>
      </div>

      {statement.error ? (
        <Card className="p-5 border-amber-200 bg-amber-50 text-sm text-amber-900 shadow-none rounded-xl">{statement.error}</Card>
      ) : (
        <>
          <div className={`grid grid-cols-2 ${isCustomer ? "lg:grid-cols-5" : "lg:grid-cols-4"} gap-3`}>
            {[
              ["Opening", <DrCr key="o" value={totals.opening} />],
              ["Debits", amount(totals.debit)],
              ["Credits", amount(totals.credit)],
              ["Closing", <DrCr key="c" value={totals.closing} className="text-[#024AE5]" />],
            ].map(([label, value]) => (
              <Card key={label as string} className="p-3.5 bg-white border border-slate-200 shadow-none rounded-xl">
                <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">{label}</div>
                <div className="text-lg font-bold text-slate-900">{value}</div>
              </Card>
            ))}
            {isCustomer && (
              <Card className="p-3.5 bg-white border border-slate-200 shadow-none rounded-xl col-span-2 lg:col-span-1">
                <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">Overdue</div>
                <div className={`text-lg font-bold ${statement.ageing?.overdue ? "text-red-700" : "text-slate-900"}`}>{inr(statement.ageing?.overdue ?? 0)}</div>
              </Card>
            )}
          </div>

          <Card className="p-4 bg-white border border-slate-200 shadow-none rounded-xl">
            <LedgerRangeBar from={range.from} to={range.to}>
              {admin && (
                <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                  <input type="checkbox" checked={showReversed} onChange={(e) => toggleReversed(e.target.checked)} className="h-4 w-4 accent-[#024AE5]" />
                  Show cancelled &amp; edited entries
                </label>
              )}
            </LedgerRangeBar>
          </Card>

          {tabs.length > 1 && (
            <div className="inline-flex rounded-lg border border-slate-200 p-0.5 bg-slate-50">
              {tabs.map(([key, label]) => (
                <button key={key} type="button" onClick={() => setTab(key)}
                  className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${tab === key ? "bg-white text-[#024AE5] shadow-sm" : "text-slate-600 hover:text-slate-900"}`}>
                  {label}
                </button>
              ))}
            </div>
          )}

          <div className="border border-slate-200 rounded-xl bg-white overflow-hidden">
            {tab === "statement" && <StatementTable lines={statement.lines} opening={totals.opening} />}

            {tab === "bills" && (
              <div className="overflow-x-auto">
                <Table className="min-w-[640px]">
                  <TableHeader>
                    <TableRow className="bg-slate-50/80 whitespace-nowrap">
                      <TableHead className="text-[11px] font-bold uppercase tracking-wider">Bill</TableHead>
                      <TableHead className="text-[11px] font-bold uppercase tracking-wider">Date</TableHead>
                      <TableHead className="text-[11px] font-bold uppercase tracking-wider text-right">Total</TableHead>
                      <TableHead className="text-[11px] font-bold uppercase tracking-wider text-right">Balance due</TableHead>
                      <TableHead className="text-[11px] font-bold uppercase tracking-wider text-right">Days</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {statement.pendingBills.length === 0 ? (
                      <TableRow><TableCell colSpan={5} className="py-10 text-center text-xs text-slate-500">No bills are due.</TableCell></TableRow>
                    ) : (
                      statement.pendingBills.map((b) => {
                        const href = documentPdfHref(b.kind, b.id);
                        const overdue = party ? b.days > party.credit_days : false;
                        return (
                          <TableRow key={b.id}>
                            <TableCell className="text-xs">
                              <span className="text-slate-500 mr-1.5">{b.kind === "invoice" ? "Invoice" : "Debit note"}</span>
                              {href ? (
                                <a href={href} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-mono font-semibold text-slate-900 hover:text-[#024AE5]">
                                  {b.number}<FileText className="h-3 w-3 text-slate-400" />
                                </a>
                              ) : <span className="font-mono font-semibold">{b.number}</span>}
                            </TableCell>
                            <TableCell className="text-xs text-slate-600 tabular-nums">{fmtDate(b.date)}</TableCell>
                            <TableCell className="text-xs text-right tabular-nums">{amount(b.total)}</TableCell>
                            <TableCell className="text-xs text-right font-semibold tabular-nums">{amount(b.balance)}</TableCell>
                            <TableCell className={`text-xs text-right tabular-nums ${overdue ? "font-semibold text-red-700" : "text-slate-600"}`}>{b.days}{overdue ? " (overdue)" : ""}</TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
                <p className="px-4 py-3 text-[11px] text-slate-500 border-t border-slate-100">
                  From Payments Received. Credit notes, opening balances and advances are not matched to bills here; the statement balance includes them.
                </p>
              </div>
            )}

            {tab === "ageing" && (
              <div className="p-4 space-y-3">
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                  {([
                    ["0–30 days", statement.ageing?.d0_30 ?? 0],
                    ["31–60 days", statement.ageing?.d31_60 ?? 0],
                    ["61–90 days", statement.ageing?.d61_90 ?? 0],
                    ["Over 90 days", statement.ageing?.d90_plus ?? 0],
                    ["Total due", statement.ageing?.due ?? 0],
                  ] as const).map(([label, value]) => (
                    <div key={label} className="rounded-lg border border-slate-200 p-3">
                      <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">{label}</div>
                      <div className="text-base font-bold text-slate-900 tabular-nums">{inr(value)}</div>
                    </div>
                  ))}
                </div>
                <p className="text-[11px] text-slate-500">
                  As on {fmtDate(range.to)}. Payments and credit notes settle the oldest amounts first; what is left is grouped by how old it is.
                </p>
              </div>
            )}
          </div>
        </>
      )}

      {opening && formData && party && (
        <JournalFormModal
          kind="opening"
          data={formData}
          partyId={party.id}
          onClose={() => setOpening(false)}
          onSaved={() => { setOpening(false); router.refresh(); }}
        />
      )}
    </div>
  );
}
