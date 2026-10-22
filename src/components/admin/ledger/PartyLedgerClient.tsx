"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { BookMarked, ChevronRight, Factory, Plus, Search, Users } from "lucide-react";
import type { JournalFormData, PartyLedgerData } from "@/actions/ledger";
import { amount, inr, round2 } from "@/lib/ledger";
import { PageTitle } from "@/components/common/PageTitle";
import { PaginationBar, usePagination } from "@/components/common/Pagination";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { LedgerRangeBar } from "./LedgerRangeBar";
import { DrCr } from "./StatementTable";
import { JournalFormModal } from "./JournalFormModal";

type Tab = "customer" | "manufacturer";

/** Every customer and manufacturer with opening, debits, credits and closing balance for the period. */
export function PartyLedgerClient({ data, formData }: { data: PartyLedgerData; formData: JournalFormData }) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("customer");
  const [search, setSearch] = useState("");
  const [showAll, setShowAll] = useState(false);
  const [opening, setOpening] = useState(false);
  const qs = `from=${data.range.from}&to=${data.range.to}`;

  const stats = useMemo(() => {
    const customers = data.rows.filter((r) => r.party.role === "customer");
    const makers = data.rows.filter((r) => r.party.role === "manufacturer");
    const sum = (xs: number[]) => round2(xs.reduce((s, x) => s + x, 0));
    return {
      receivable: sum(customers.map((r) => Math.max(r.closing, 0))),
      advances: sum(customers.map((r) => Math.max(-r.closing, 0))),
      overdue: sum(customers.map((r) => r.overdue)),
      payable: sum(makers.map((r) => Math.max(-r.closing, 0))),
      paidAhead: sum(makers.map((r) => Math.max(r.closing, 0))),
    };
  }, [data.rows]);

  const rows = useMemo(() => {
    const q = search.toLowerCase().trim();
    return data.rows.filter((r) => {
      if (r.party.role !== tab) return false;
      if (!showAll && r.opening === 0 && r.debit === 0 && r.credit === 0) return false;
      if (!q) return true;
      return r.party.name.toLowerCase().includes(q) || (r.party.gstin ?? "").toLowerCase().includes(q) || (r.party.email ?? "").toLowerCase().includes(q);
    });
  }, [data.rows, tab, search, showAll]);
  const pager = usePagination(rows, `${tab}|${search}|${showAll}`, 25);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <PageTitle icon={BookMarked}>Party Ledger</PageTitle>
        <Button onClick={() => setOpening(true)} className="gap-1.5" disabled={!!data.error}>
          <Plus className="h-4 w-4" />
          Add opening balance
        </Button>
      </div>

      {data.error ? (
        <Card className="p-5 border-amber-200 bg-amber-50 text-sm text-amber-900 shadow-none rounded-xl">{data.error}</Card>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Card className="p-3.5 bg-white border border-slate-200 shadow-none rounded-xl">
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">Customers owe us</div>
              <div className="text-xl font-bold text-[#024AE5]">{inr(stats.receivable)}</div>
              {stats.advances > 0 && <div className="text-[11px] text-slate-500 mt-0.5">Advances held: {inr(stats.advances)}</div>}
            </Card>
            <Card className="p-3.5 bg-white border border-slate-200 shadow-none rounded-xl">
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">Overdue</div>
              <div className="text-xl font-bold text-red-700">{inr(stats.overdue)}</div>
              <div className="text-[11px] text-slate-500 mt-0.5">Past each customer&apos;s credit days</div>
            </Card>
            <Card className="p-3.5 bg-white border border-slate-200 shadow-none rounded-xl">
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">We owe manufacturers</div>
              <div className="text-xl font-bold text-amber-700">{inr(stats.payable)}</div>
            </Card>
            <Card className="p-3.5 bg-white border border-slate-200 shadow-none rounded-xl">
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">Paid to manufacturers ahead</div>
              <div className="text-xl font-bold text-slate-900">{inr(stats.paidAhead)}</div>
              <div className="text-[11px] text-slate-500 mt-0.5">Payments not yet matched by a bill</div>
            </Card>
          </div>

          <Card className="p-4 bg-white border border-slate-200 shadow-none rounded-xl space-y-3">
            <LedgerRangeBar from={data.range.from} to={data.range.to} />
            <div className="flex flex-col lg:flex-row lg:items-center gap-2">
              <div className="inline-flex rounded-lg border border-slate-200 p-0.5 bg-slate-50">
                {([["customer", "Customers", Users], ["manufacturer", "Manufacturers", Factory]] as const).map(([key, label, Icon]) => (
                  <button key={key} type="button" onClick={() => setTab(key)}
                    className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${tab === key ? "bg-white text-[#024AE5] shadow-sm" : "text-slate-600 hover:text-slate-900"}`}>
                    <Icon className="h-3.5 w-3.5" />{label}
                  </button>
                ))}
              </div>
              <div className="relative flex-1">
                <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
                <Input placeholder="Search name, GSTIN or email..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-8 h-9 text-xs bg-slate-50/50 border-slate-200 focus:bg-white" />
              </div>
              <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                <input type="checkbox" checked={showAll} onChange={(e) => setShowAll(e.target.checked)} className="h-4 w-4 accent-[#024AE5]" />
                Show parties with no entries
              </label>
            </div>
          </Card>

          <div className="border border-slate-200 rounded-xl bg-white overflow-hidden">
            <div className="overflow-x-auto [scrollbar-width:thin]">
              <Table className="min-w-[900px]">
                <TableHeader>
                  <TableRow className="bg-slate-50/80 whitespace-nowrap">
                    <TableHead className="text-[11px] font-bold uppercase tracking-wider">{tab === "customer" ? "Customer" : "Manufacturer"}</TableHead>
                    <TableHead className="text-[11px] font-bold uppercase tracking-wider text-right">Opening</TableHead>
                    <TableHead className="text-[11px] font-bold uppercase tracking-wider text-right">Debit</TableHead>
                    <TableHead className="text-[11px] font-bold uppercase tracking-wider text-right">Credit</TableHead>
                    <TableHead className="text-[11px] font-bold uppercase tracking-wider text-right">Closing</TableHead>
                    {tab === "customer" && <TableHead className="text-[11px] font-bold uppercase tracking-wider text-right">Overdue</TableHead>}
                    <TableHead className="w-10" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pager.pageItems.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="py-14 text-center">
                        <BookMarked className="h-8 w-8 mx-auto text-slate-300 mb-2" />
                        <p className="text-sm font-semibold text-slate-700">No {tab === "customer" ? "customers" : "manufacturers"} with entries in this period</p>
                        <p className="text-xs text-slate-500 mt-1">Invoices, receipts and payments made appear here automatically. Tick &ldquo;Show parties with no entries&rdquo; to see everyone.</p>
                      </TableCell>
                    </TableRow>
                  ) : (
                    pager.pageItems.map((r) => (
                      <TableRow key={r.party.id} className="cursor-pointer hover:bg-slate-50/60" onClick={() => router.push(`/admin/party-ledger/${r.party.id}?${qs}`)}>
                        <TableCell>
                          <div className="text-xs font-semibold text-slate-900">{r.party.name}</div>
                          {r.party.gstin && <div className="text-[11px] font-mono text-slate-500">{r.party.gstin}</div>}
                        </TableCell>
                        <TableCell className="text-xs text-right"><DrCr value={r.opening} /></TableCell>
                        <TableCell className="text-xs text-right tabular-nums">{r.debit ? amount(r.debit) : "—"}</TableCell>
                        <TableCell className="text-xs text-right tabular-nums">{r.credit ? amount(r.credit) : "—"}</TableCell>
                        <TableCell className="text-xs text-right font-bold"><DrCr value={r.closing} /></TableCell>
                        {tab === "customer" && (
                          <TableCell className={`text-xs text-right tabular-nums ${r.overdue > 0 ? "font-semibold text-red-700" : "text-slate-400"}`}>{r.overdue > 0 ? inr(r.overdue) : "—"}</TableCell>
                        )}
                        <TableCell className="text-right">
                          <Link href={`/admin/party-ledger/${r.party.id}?${qs}`} aria-label={`Open ${r.party.name}'s statement`} className="inline-flex h-7 w-7 items-center justify-center text-slate-400 hover:text-[#024AE5]" onClick={(e) => e.stopPropagation()}>
                            <ChevronRight className="h-4 w-4" />
                          </Link>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                  {data.unlinked && tab === "customer" && (
                    <TableRow className="bg-amber-50/40 cursor-pointer" onClick={() => router.push(`/admin/party-ledger/unlinked?${qs}`)}>
                      <TableCell>
                        <div className="text-xs font-semibold text-amber-900">Documents without a customer</div>
                        <div className="text-[11px] text-amber-800">Invoices or receipts that are not linked to a customer account</div>
                      </TableCell>
                      <TableCell className="text-xs text-right"><DrCr value={data.unlinked.opening} /></TableCell>
                      <TableCell className="text-xs text-right tabular-nums">{amount(data.unlinked.debit)}</TableCell>
                      <TableCell className="text-xs text-right tabular-nums">{amount(data.unlinked.credit)}</TableCell>
                      <TableCell className="text-xs text-right font-bold"><DrCr value={data.unlinked.closing} /></TableCell>
                      <TableCell />
                      <TableCell className="text-right"><ChevronRight className="h-4 w-4 text-slate-400 inline" /></TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
            <PaginationBar state={pager} noun={tab === "customer" ? "customers" : "manufacturers"} />
          </div>
          <p className="text-[11px] text-slate-500">
            <strong>Dr</strong> = the party owes us. <strong>Cr</strong> = we owe the party (or they paid in advance). Click a row for the full statement.
          </p>
        </>
      )}

      {opening && (
        <JournalFormModal
          kind="opening"
          data={formData}
          onClose={() => setOpening(false)}
          onSaved={() => { setOpening(false); router.refresh(); }}
        />
      )}
    </div>
  );
}
