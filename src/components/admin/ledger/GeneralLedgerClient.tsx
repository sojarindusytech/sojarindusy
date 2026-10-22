"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { BookOpen, Eye, Loader2, Pencil, Plus, Power } from "lucide-react";
import {
  getAccountLedger,
  getDayBook,
  setLedgerAccountActive,
  type GeneralLedgerData,
  type JournalFormData,
  type JournalRow,
} from "@/actions/ledger";
import {
  ACCOUNT_KIND_LABELS,
  ACCOUNT_TYPE_LABELS,
  VOUCHER_LABELS,
  amount,
  fmtDate,
  groupByEntry,
  type ReportLine,
} from "@/lib/ledger";
import type { LedgerAccount, LedgerAccountType } from "@/types/database.types";
import { PageTitle } from "@/components/common/PageTitle";
import { IconAction } from "@/components/common/IconAction";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { LedgerRangeBar } from "./LedgerRangeBar";
import { DrCr, StatementTable } from "./StatementTable";
import { AccountFormModal } from "./AccountFormModal";
import { BalanceSheetView, ProfitLossView, TrialBalanceView } from "./GlReports";
import { GlJournals } from "./GlJournals";
import { GlTally } from "./GlTally";

const TABS = [
  ["accounts", "Accounts"],
  ["ledger", "Account Ledger"],
  ["daybook", "Day Book"],
  ["trial", "Trial Balance"],
  ["pl", "Profit & Loss"],
  ["bs", "Balance Sheet"],
  ["journals", "Journals"],
  ["tally", "Tally Export"],
] as const;
type Tab = (typeof TABS)[number][0];

const head = "text-[11px] font-bold uppercase tracking-wider";

export function GeneralLedgerClient({
  data,
  journals,
  formData,
  initialTab,
  initialAccountId,
}: {
  data: GeneralLedgerData;
  journals: { rows: JournalRow[]; error: string | null };
  formData: JournalFormData;
  initialTab?: string;
  initialAccountId?: string;
}) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>(TABS.some(([k]) => k === initialTab) ? (initialTab as Tab) : "accounts");
  const [accountId, setAccountId] = useState<string>(initialAccountId ?? "");
  const [editing, setEditing] = useState<LedgerAccount | null>(null);
  const [adding, setAdding] = useState(false);
  const [pending, startTransition] = useTransition();
  const { from, to } = data.range;

  const partyNames = useMemo(() => new Map(formData.parties.map((p) => [p.id, p.name])), [formData.parties]);
  const totalsById = useMemo(() => new Map(data.totals.map((t) => [t.account.id, t])), [data.totals]);

  const openAccount = (id: string) => {
    setAccountId(id);
    setTab("ledger");
  };

  const toggleActive = (a: LedgerAccount) =>
    startTransition(async () => {
      const res = await setLedgerAccountActive(a.id, !a.active);
      if (res.success) {
        toast.success(a.active ? `${a.name} turned off.` : `${a.name} turned on.`);
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <PageTitle icon={BookOpen}>General Ledger</PageTitle>
        {tab === "accounts" && !data.error && (
          <Button onClick={() => setAdding(true)} className="gap-1.5"><Plus className="h-4 w-4" />Add account</Button>
        )}
      </div>

      {data.error ? (
        <Card className="p-5 border-amber-200 bg-amber-50 text-sm text-amber-900 shadow-none rounded-xl">{data.error}</Card>
      ) : (
        <>
          <Card className="p-4 bg-white border border-slate-200 shadow-none rounded-xl">
            <LedgerRangeBar from={from} to={to} />
          </Card>

          <div className="flex gap-1 overflow-x-auto rounded-lg border border-slate-200 p-0.5 bg-slate-50 [scrollbar-width:thin]">
            {TABS.map(([key, label]) => (
              <button key={key} type="button" onClick={() => setTab(key)}
                className={`shrink-0 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${tab === key ? "bg-white text-[#024AE5] shadow-sm" : "text-slate-600 hover:text-slate-900"}`}>
                {label}
              </button>
            ))}
          </div>

          <div className="border border-slate-200 rounded-xl bg-white overflow-hidden">
            {tab === "accounts" && (
              <div className="overflow-x-auto [scrollbar-width:thin]">
                <Table className="min-w-[980px]">
                  <TableHeader>
                    <TableRow className="bg-slate-50/80 whitespace-nowrap">
                      <TableHead className={`${head} w-20`}>Code</TableHead>
                      <TableHead className={head}>Account</TableHead>
                      <TableHead className={head}>Tally</TableHead>
                      <TableHead className={`${head} text-right`}>Opening</TableHead>
                      <TableHead className={`${head} text-right`}>Debit</TableHead>
                      <TableHead className={`${head} text-right`}>Credit</TableHead>
                      <TableHead className={`${head} text-right`}>Closing</TableHead>
                      <TableHead className={`${head} text-right w-28`}>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(Object.keys(ACCOUNT_TYPE_LABELS) as LedgerAccountType[]).map((type) => {
                      const accounts = data.accounts.filter((a) => a.type === type);
                      if (!accounts.length) return null;
                      return [
                        <TableRow key={`h-${type}`} className="bg-slate-50/40 hover:bg-slate-50/40">
                          <TableCell colSpan={8} className="text-[11px] font-bold uppercase tracking-wider text-slate-500 py-1.5">{ACCOUNT_TYPE_LABELS[type]}</TableCell>
                        </TableRow>,
                        ...accounts.map((a) => {
                          const t = totalsById.get(a.id);
                          return (
                            <TableRow key={a.id} className={a.active ? "" : "opacity-50"}>
                              <TableCell className="text-xs font-mono text-slate-500">{a.code}</TableCell>
                              <TableCell>
                                <div className="flex flex-wrap items-center gap-1.5">
                                  <span className="text-xs font-semibold text-slate-900">{a.name}</span>
                                  {a.kind !== "general" && <Badge variant="outline" className="text-[10px]">{ACCOUNT_KIND_LABELS[a.kind]}</Badge>}
                                  {a.is_default && <Badge variant="blue" className="text-[10px]">Default</Badge>}
                                  {!a.active && <Badge variant="outline" className="text-[10px]">Inactive</Badge>}
                                </div>
                              </TableCell>
                              <TableCell className="text-[11px] text-slate-500">
                                {a.kind === "receivable" || a.kind === "payable" ? "One ledger per party" : a.tally_name || a.name}
                                <div className="text-slate-400">{a.tally_group}</div>
                              </TableCell>
                              <TableCell className="text-xs text-right"><DrCr value={t?.opening ?? 0} /></TableCell>
                              <TableCell className="text-xs text-right tabular-nums">{t?.debit ? amount(t.debit) : "—"}</TableCell>
                              <TableCell className="text-xs text-right tabular-nums">{t?.credit ? amount(t.credit) : "—"}</TableCell>
                              <TableCell className="text-xs text-right font-semibold"><DrCr value={t?.closing ?? 0} /></TableCell>
                              <TableCell className="text-right whitespace-nowrap">
                                <IconAction label="Open ledger" tone="primary" onClick={() => openAccount(a.id)}><Eye /></IconAction>
                                <IconAction label="Edit" onClick={() => setEditing(a)}><Pencil /></IconAction>
                                {!a.system_key && !a.is_default && (
                                  <IconAction label={a.active ? "Turn off" : "Turn on"} tone={a.active ? "danger" : "success"} disabled={pending} onClick={() => toggleActive(a)}><Power /></IconAction>
                                )}
                              </TableCell>
                            </TableRow>
                          );
                        }),
                      ];
                    })}
                  </TableBody>
                </Table>
              </div>
            )}

            {tab === "ledger" && (
              <AccountLedgerTab accounts={data.accounts} accountId={accountId} onAccountChange={setAccountId} from={from} to={to} partyNames={partyNames} />
            )}
            {tab === "daybook" && <DayBookTab from={from} to={to} partyNames={partyNames} />}
            {tab === "trial" && <TrialBalanceView totals={data.totals} to={to} onOpenAccount={openAccount} />}
            {tab === "pl" && <ProfitLossView totals={data.totals} from={from} to={to} onOpenAccount={openAccount} />}
            {tab === "bs" && <BalanceSheetView totals={data.totals} to={to} onOpenAccount={openAccount} />}
            {tab === "journals" && <GlJournals rows={journals.rows} error={journals.error} formData={formData} />}
            {tab === "tally" && <GlTally from={from} to={to} />}
          </div>
        </>
      )}

      {(editing || adding) && (
        <AccountFormModal
          account={editing}
          kind="general"
          existingCodes={data.accounts.map((a) => a.code)}
          onClose={() => { setEditing(null); setAdding(false); }}
          onSaved={() => { setEditing(null); setAdding(false); router.refresh(); }}
        />
      )}
    </div>
  );
}

/** One account's entries with a running balance, loaded when an account is picked. */
function AccountLedgerTab({
  accounts,
  accountId,
  onAccountChange,
  from,
  to,
  partyNames,
}: {
  accounts: LedgerAccount[];
  accountId: string;
  onAccountChange: (id: string) => void;
  from: string;
  to: string;
  partyNames: Map<string, string>;
}) {
  const [showReversed, setShowReversed] = useState(false);
  const [result, setResult] = useState<{ key: string; lines: ReportLine[]; opening: number; error: string | null } | null>(null);
  const key = `${accountId}|${from}|${to}|${showReversed}`;

  useEffect(() => {
    if (!accountId) return;
    let cancelled = false;
    getAccountLedger(accountId, { from, to }, showReversed).then((r) => {
      if (!cancelled) setResult({ key: `${accountId}|${from}|${to}|${showReversed}`, ...r });
    });
    return () => { cancelled = true; };
  }, [accountId, from, to, showReversed]);

  const loading = !!accountId && result?.key !== key;
  const account = accounts.find((a) => a.id === accountId);
  const isParty = account?.kind === "receivable" || account?.kind === "payable";

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 px-4 py-3 border-b border-slate-100">
        <Select value={accountId} onValueChange={onAccountChange}>
          <SelectTrigger className="h-9 text-xs w-full sm:w-[320px]"><SelectValue placeholder="Pick an account" /></SelectTrigger>
          <SelectContent className="bg-white max-h-80">
            {(Object.keys(ACCOUNT_TYPE_LABELS) as LedgerAccountType[]).map((t) => {
              const list = accounts.filter((a) => a.type === t);
              return list.length ? (
                <SelectGroup key={t}>
                  <SelectLabel className="text-[10px] uppercase tracking-wider text-slate-400">{ACCOUNT_TYPE_LABELS[t]}</SelectLabel>
                  {list.map((a) => (<SelectItem key={a.id} value={a.id} className="text-xs">{a.code} · {a.name}</SelectItem>))}
                </SelectGroup>
              ) : null;
            })}
          </SelectContent>
        </Select>
        <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
          <input type="checkbox" checked={showReversed} onChange={(e) => setShowReversed(e.target.checked)} className="h-4 w-4 accent-[#024AE5]" />
          Show cancelled &amp; edited entries
        </label>
        {loading && <Loader2 className="h-4 w-4 animate-spin text-slate-400" />}
      </div>
      {!accountId ? (
        <p className="py-14 text-center text-xs text-slate-500">Pick an account to see its entries.</p>
      ) : result?.error ? (
        <p className="p-4 text-sm text-amber-900">{result.error}</p>
      ) : result ? (
        <div className={loading ? "opacity-50" : ""}>
          {isParty && <p className="px-4 pt-3 text-[11px] text-slate-500">All customers / manufacturers together. Open the Party Ledger for one party&apos;s statement.</p>}
          <StatementTable lines={result.lines} opening={result.opening} partyNames={partyNames} />
        </div>
      ) : null}
    </div>
  );
}

/** Every voucher in the period, with its lines (cancelled ones included, marked). */
function DayBookTab({ from, to, partyNames }: { from: string; to: string; partyNames: Map<string, string> }) {
  const [result, setResult] = useState<{ key: string; lines: ReportLine[]; error: string | null } | null>(null);
  const key = `${from}|${to}`;
  useEffect(() => {
    let cancelled = false;
    getDayBook({ from, to }).then((r) => { if (!cancelled) setResult({ key: `${from}|${to}`, ...r }); });
    return () => { cancelled = true; };
  }, [from, to]);

  if (result?.key !== key) return <p className="flex items-center justify-center gap-2 py-14 text-xs text-slate-500"><Loader2 className="h-4 w-4 animate-spin" />Loading day book…</p>;
  if (result.error) return <p className="p-4 text-sm text-amber-900">{result.error}</p>;
  const entries = groupByEntry(result.lines);
  if (!entries.length) return <p className="py-14 text-center text-xs text-slate-500">No entries in this period.</p>;

  return (
    <div className="overflow-x-auto [scrollbar-width:thin]">
      <Table className="min-w-[860px]">
        <TableHeader>
          <TableRow className="bg-slate-50/80 whitespace-nowrap">
            <TableHead className={`${head} w-[96px]`}>Date</TableHead>
            <TableHead className={head}>Voucher</TableHead>
            <TableHead className={head}>Account</TableHead>
            <TableHead className={`${head} text-right`}>Debit</TableHead>
            <TableHead className={`${head} text-right`}>Credit</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {entries.map((e) =>
            e.lines.map((l, i) => (
              <TableRow key={l.line_id} className={`${i === 0 ? "border-t-2 border-slate-100" : ""} ${e.is_reversal || e.reversed ? "opacity-60" : ""}`}>
                <TableCell className="text-xs text-slate-600 tabular-nums align-top">{i === 0 ? fmtDate(e.entry_date) : ""}</TableCell>
                <TableCell className="text-xs align-top">
                  {i === 0 && (
                    <>
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono font-semibold text-slate-900">{e.voucher_number}</span>
                        <span className="text-slate-500">{VOUCHER_LABELS[e.voucher_type]}</span>
                        {e.is_reversal && <Badge variant="destructive" className="text-[10px]">Reversal</Badge>}
                        {e.reversed && <Badge variant="outline" className="text-[10px]">Reversed</Badge>}
                      </div>
                      {e.narration && <div className="text-[11px] text-slate-500 line-clamp-2">{e.narration}</div>}
                    </>
                  )}
                </TableCell>
                <TableCell className={`text-xs ${l.credit ? "pl-8" : ""}`}>
                  {l.account_name}
                  {l.party_id && <span className="text-slate-500"> · {partyNames.get(l.party_id) ?? "Party"}</span>}
                </TableCell>
                <TableCell className="text-xs text-right tabular-nums">{l.debit ? amount(l.debit) : ""}</TableCell>
                <TableCell className="text-xs text-right tabular-nums">{l.credit ? amount(l.credit) : ""}</TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
