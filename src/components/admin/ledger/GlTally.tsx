"use client";

import { useEffect, useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { getTallyExportSummary, type TallyExportSummary } from "@/actions/ledger";
import { TALLY_VOUCHER_TYPES, VOUCHER_LABELS, fmtDate } from "@/lib/ledger";
import { Button } from "@/components/ui/button";

/** Download the books as Tally import files: ledger masters once, then vouchers for a period. */
export function GlTally({ from, to }: { from: string; to: string }) {
  const [summary, setSummary] = useState<TallyExportSummary | null>(null);
  const key = `${from}|${to}`;
  const [loadedKey, setLoadedKey] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getTallyExportSummary({ from, to }).then((s) => {
      if (!cancelled) {
        setSummary(s);
        setLoadedKey(`${from}|${to}`);
      }
    });
    return () => { cancelled = true; };
  }, [from, to]);

  const loading = loadedKey !== key;
  const total = summary?.counts.reduce((s, c) => s + c.count, 0) ?? 0;

  return (
    <div className="p-4 space-y-5">
      <div className="grid md:grid-cols-2 gap-4">
        <div className="rounded-lg border border-slate-200 p-4 space-y-2">
          <h3 className="text-sm font-bold text-slate-900">1. Ledgers (masters)</h3>
          <p className="text-xs text-slate-600">
            Every account and every customer / manufacturer with entries, under the Tally group set on each account.
            Import this first, and again when new customers or accounts are added.
          </p>
          <Button asChild variant="outline" className="gap-1.5">
            <a href="/api/ledger/tally?kind=masters"><Download className="h-4 w-4" />Download masters</a>
          </Button>
        </div>
        <div className="rounded-lg border border-slate-200 p-4 space-y-2">
          <h3 className="text-sm font-bold text-slate-900">2. Vouchers</h3>
          <p className="text-xs text-slate-600">
            Entries dated {fmtDate(from)} to {fmtDate(to)}. Each voucher has a fixed ID, so importing the same dates again replaces those
            vouchers in Tally instead of adding copies.
          </p>
          {loading || total === 0 ? (
            <Button className="gap-1.5" disabled><Download className="h-4 w-4" />Download vouchers</Button>
          ) : (
            <Button asChild className="gap-1.5">
              <a href={`/api/ledger/tally?kind=vouchers&from=${from}&to=${to}`}><Download className="h-4 w-4" />Download vouchers</a>
            </Button>
          )}
        </div>
      </div>

      <div className="rounded-lg border border-slate-200 p-4 space-y-2">
        <h3 className="text-sm font-bold text-slate-900">In this period</h3>
        {loading ? (
          <p className="flex items-center gap-2 text-xs text-slate-500"><Loader2 className="h-3.5 w-3.5 animate-spin" />Counting vouchers…</p>
        ) : summary?.error ? (
          <p className="text-xs text-amber-800">{summary.error}</p>
        ) : total === 0 ? (
          <p className="text-xs text-slate-500">No vouchers in this period.</p>
        ) : (
          <ul className="grid sm:grid-cols-3 gap-2 text-xs">
            {summary!.counts.map((c) => (
              <li key={c.type} className="rounded-md bg-slate-50 px-3 py-2">
                <span className="font-bold tabular-nums">{c.count}</span> {VOUCHER_LABELS[c.type]}
                <span className="text-slate-400"> → Tally &ldquo;{TALLY_VOUCHER_TYPES[c.type]}&rdquo;</span>
              </li>
            ))}
          </ul>
        )}
        {!loading && summary && summary.cancelled.length > 0 && (
          <div className="mt-3 rounded-md border border-amber-200 bg-amber-50 p-3">
            <p className="text-xs font-semibold text-amber-900">Cancelled here: if these were imported into Tally before, cancel them there too.</p>
            <ul className="mt-1 space-y-0.5 text-xs text-amber-900">
              {summary.cancelled.map((c) => (
                <li key={`${c.type}:${c.number}`}><span className="font-mono">{c.number}</span> · {VOUCHER_LABELS[c.type]} · {fmtDate(c.date)}</li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <div className="rounded-lg bg-slate-50 p-4 text-xs text-slate-700 space-y-1">
        <p className="font-semibold text-slate-900">How to import in Tally</p>
        <p>Open the company (the name in Sales Settings &gt; Company name in Tally), then Gateway of Tally &gt; Import &gt; Masters, and pick the masters file.</p>
        <p>Then Import &gt; Transactions and pick the vouchers file. Tally shows how many vouchers were created and any errors.</p>
        <p>Try the first import on a backup of the company. Ledger names must match: set &ldquo;Name in Tally&rdquo; on each account to your accountant&apos;s ledger names.</p>
      </div>
    </div>
  );
}
