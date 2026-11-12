"use client";

import { CheckCircle2, AlertTriangle } from "lucide-react";
import { amount, balanceSheet, fmtDate, profitAndLoss, trialBalance, type AccountTotals } from "@/lib/ledger";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const head = "text-[11px] font-bold uppercase tracking-wider";

/** Trial Balance: every account's closing balance on its side; the two totals always match. */
export function TrialBalanceView({ totals, to, onOpenAccount }: { totals: AccountTotals[]; to: string; onOpenAccount: (id: string) => void }) {
  const tb = trialBalance(totals);
  const balanced = tb.debit === tb.credit;
  return (
    <div>
      <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-slate-100">
        <p className="text-xs text-slate-600">Closing balances as on {fmtDate(to)}</p>
        <span className={`inline-flex items-center gap-1 text-xs font-semibold ${balanced ? "text-emerald-700" : "text-red-700"}`}>
          {balanced ? <CheckCircle2 className="h-3.5 w-3.5" /> : <AlertTriangle className="h-3.5 w-3.5" />}
          {balanced ? "Debits equal credits" : "Totals differ"}
        </span>
      </div>
      <div className="overflow-x-auto">
        <Table className="min-w-[560px]">
          <TableHeader>
            <TableRow className="bg-slate-50/80">
              <TableHead className={`${head} w-20`}>Code</TableHead>
              <TableHead className={head}>Account</TableHead>
              <TableHead className={`${head} text-right`}>Debit</TableHead>
              <TableHead className={`${head} text-right`}>Credit</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {tb.rows.length === 0 ? (
              <TableRow><TableCell colSpan={4} className="py-10 text-center text-xs text-slate-500">No balances yet.</TableCell></TableRow>
            ) : tb.rows.map((r) => (
              <TableRow key={r.account.id} className="cursor-pointer hover:bg-slate-50/60" onClick={() => onOpenAccount(r.account.id)}>
                <TableCell className="text-xs font-mono text-slate-500">{r.account.code}</TableCell>
                <TableCell className="text-xs font-medium text-slate-900">{r.account.name}</TableCell>
                <TableCell className="text-xs text-right tabular-nums">{r.debit ? amount(r.debit) : ""}</TableCell>
                <TableCell className="text-xs text-right tabular-nums">{r.credit ? amount(r.credit) : ""}</TableCell>
              </TableRow>
            ))}
            <TableRow className="bg-slate-50/80 border-t-2 border-slate-200">
              <TableCell colSpan={2} className="text-xs font-bold">Total</TableCell>
              <TableCell className="text-xs font-bold text-right tabular-nums">{amount(tb.debit)}</TableCell>
              <TableCell className="text-xs font-bold text-right tabular-nums">{amount(tb.credit)}</TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function Section({ title, rows, total, onOpenAccount }: { title: string; rows: { account: { id: string; code: string; name: string }; amount: number }[]; total: number; onOpenAccount: (id: string) => void }) {
  return (
    <div className="rounded-lg border border-slate-200 overflow-hidden">
      <div className="bg-slate-50/80 px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-slate-500">{title}</div>
      <div className="divide-y divide-slate-100">
        {rows.length === 0 && <div className="px-3 py-3 text-xs text-slate-400">Nothing yet</div>}
        {rows.map((r) => (
          <button type="button" key={r.account.id} onClick={() => onOpenAccount(r.account.id)}
            className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-xs hover:bg-slate-50/60">
            <span className="text-slate-800"><span className="font-mono text-slate-400 mr-2">{r.account.code}</span>{r.account.name}</span>
            <span className={`tabular-nums ${r.amount < 0 ? "text-red-700" : "text-slate-900"}`}>{r.amount < 0 ? `(${amount(-r.amount)})` : amount(r.amount)}</span>
          </button>
        ))}
      </div>
      <div className="flex justify-between border-t border-slate-200 px-3 py-2 text-xs font-bold">
        <span>Total {title.toLowerCase()}</span>
        <span className="tabular-nums">{amount(total)}</span>
      </div>
    </div>
  );
}

/** Income earned and expenses incurred in the period, and the profit or loss. */
export function ProfitLossView({ totals, from, to, onOpenAccount }: { totals: AccountTotals[]; from: string; to: string; onOpenAccount: (id: string) => void }) {
  const pl = profitAndLoss(totals);
  return (
    <div className="p-4 space-y-4">
      <p className="text-xs text-slate-600">{fmtDate(from)} to {fmtDate(to)}</p>
      <div className="grid md:grid-cols-2 gap-4">
        <Section title="Income" rows={pl.income} total={pl.totalIncome} onOpenAccount={onOpenAccount} />
        <Section title="Expenses" rows={pl.expense} total={pl.totalExpense} onOpenAccount={onOpenAccount} />
      </div>
      <div className={`flex items-center justify-between rounded-lg px-4 py-3 ${pl.net >= 0 ? "bg-emerald-50 text-emerald-900" : "bg-red-50 text-red-900"}`}>
        <span className="text-sm font-bold">{pl.net >= 0 ? "Net profit" : "Net loss"}</span>
        <span className="text-lg font-bold tabular-nums">₹{amount(Math.abs(pl.net))}</span>
      </div>
      <p className="text-[11px] text-slate-500">
        Purchases appear here only once manufacturer bills are entered as journals; until then payments made to manufacturers sit in Trade Payables.
      </p>
    </div>
  );
}

/** What the company owns and owes on the last day of the period. */
export function BalanceSheetView({ totals, to, onOpenAccount }: { totals: AccountTotals[]; to: string; onOpenAccount: (id: string) => void }) {
  const bs = balanceSheet(totals);
  const liabilitiesRows = [
    ...bs.liabilities,
    ...bs.equity,
    ...(bs.profit !== 0 ? [{ account: { id: "pl", code: "", name: bs.profit >= 0 ? "Profit & Loss (profit to date)" : "Profit & Loss (loss to date)" }, amount: bs.profit }] : []),
  ];
  const balanced = bs.totalAssets === bs.totalLiabilities;
  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-slate-600">As on {fmtDate(to)}</p>
        <span className={`inline-flex items-center gap-1 text-xs font-semibold ${balanced ? "text-emerald-700" : "text-red-700"}`}>
          {balanced ? <CheckCircle2 className="h-3.5 w-3.5" /> : <AlertTriangle className="h-3.5 w-3.5" />}
          {balanced ? "Assets equal liabilities + equity" : "Totals differ"}
        </span>
      </div>
      <div className="grid md:grid-cols-2 gap-4">
        <Section title="Liabilities & equity" rows={liabilitiesRows} total={bs.totalLiabilities} onOpenAccount={(id) => id !== "pl" && onOpenAccount(id)} />
        <Section title="Assets" rows={bs.assets} total={bs.totalAssets} onOpenAccount={onOpenAccount} />
      </div>
      <p className="text-[11px] text-slate-500">
        Trade Receivables / Payables are shown net. A negative amount (in brackets) means the balance is on the other side, e.g. advances.
      </p>
    </div>
  );
}
