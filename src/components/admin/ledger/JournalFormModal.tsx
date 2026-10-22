"use client";

import { useMemo, useState, useTransition } from "react";
import toast from "react-hot-toast";
import { Plus, Trash2 } from "lucide-react";
import { postJournalEntry, type JournalFormData } from "@/actions/ledger";
import { ACCOUNT_TYPE_LABELS, amount, round2, todayIst } from "@/lib/ledger";
import type { LedgerAccountType } from "@/types/database.types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

/** Hides the up/down spinner arrows on number inputs. */
const NO_SPINNER = "[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none";

interface Line {
  key: string;
  accountId: string;
  partyId: string;
  debit: string;
  credit: string;
  billRef: string;
}

const newLine = (accountId = "", partyId = ""): Line => ({ key: crypto.randomUUID(), accountId, partyId, debit: "", credit: "", billRef: "" });

/**
 * A journal voucher (any accounts, debit = credit) or an opening balance (what each party or
 * account had on a date; the difference goes to Opening Balance Adjustment automatically).
 */
export function JournalFormModal({
  kind,
  data,
  partyId,
  onClose,
  onSaved,
}: {
  kind: "journal" | "opening";
  data: JournalFormData;
  /** Opening balance for this party (Party Ledger). */
  partyId?: string | null;
  onClose: () => void;
  onSaved: (voucherNumber: string) => void;
}) {
  const [requestId] = useState(() => crypto.randomUUID());
  const accountsById = useMemo(() => new Map(data.accounts.map((a) => [a.id, a])), [data.accounts]);
  const receivables = data.accounts.find((a) => a.kind === "receivable");
  const payables = data.accounts.find((a) => a.kind === "payable");
  const presetParty = partyId ? data.parties.find((p) => p.id === partyId) : undefined;
  const presetAccount = presetParty ? (presetParty.role === "customer" ? receivables : payables) : kind === "opening" ? receivables : undefined;

  const [date, setDate] = useState(todayIst());
  const [narration, setNarration] = useState("");
  const [lines, setLines] = useState<Line[]>(() =>
    kind === "opening" ? [newLine(presetAccount?.id ?? "", presetParty?.id ?? "")] : [newLine(), newLine()]
  );
  const [pending, startTransition] = useTransition();

  const update = (key: string, patch: Partial<Line>) => setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  const accountOptions = data.accounts.filter((a) => !(kind === "opening" && a.system_key === "opening_balance"));
  const groups = (Object.keys(ACCOUNT_TYPE_LABELS) as LedgerAccountType[])
    .map((t) => ({ type: t, accounts: accountOptions.filter((a) => a.type === t) }))
    .filter((g) => g.accounts.length);

  const totalDr = round2(lines.reduce((s, l) => s + (Number(l.debit) || 0), 0));
  const totalCr = round2(lines.reduce((s, l) => s + (Number(l.credit) || 0), 0));
  const difference = round2(totalDr - totalCr);

  const problems: string[] = [];
  for (const l of lines) {
    const acc = accountsById.get(l.accountId);
    const dr = Number(l.debit) || 0;
    const cr = Number(l.credit) || 0;
    if (!acc) problems.push("Pick an account on every line.");
    else if ((acc.kind === "receivable" || acc.kind === "payable") && !l.partyId) problems.push(`Pick the ${acc.kind === "receivable" ? "customer" : "manufacturer"} for ${acc.name}.`);
    if ((dr > 0) === (cr > 0)) problems.push("Enter either a debit or a credit on each line.");
  }
  if (kind === "journal") {
    if (lines.length < 2) problems.push("A journal needs at least two lines.");
    if (difference !== 0) problems.push(`Debits and credits differ by ${amount(Math.abs(difference))}.`);
    if (narration.trim().length < 3) problems.push("Write a short narration.");
  }
  const firstProblem = [...new Set(problems)][0];

  const save = () =>
    startTransition(async () => {
      const res = await postJournalEntry({
        requestId,
        kind,
        entryDate: date,
        narration,
        lines: lines.map((l) => {
          const acc = accountsById.get(l.accountId);
          const party = acc && (acc.kind === "receivable" || acc.kind === "payable") ? l.partyId || null : null;
          return { accountId: l.accountId, partyId: party, debit: Number(l.debit) || 0, credit: Number(l.credit) || 0, billRef: l.billRef, narration: null };
        }),
      });
      if (res.success) {
        toast.success(`${kind === "opening" ? "Opening balance" : "Journal"} ${res.voucherNumber} posted.`);
        onSaved(res.voucherNumber);
      } else {
        toast.error(res.error);
      }
    });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>{kind === "opening" ? "Add opening balance" : "New journal voucher"}</DialogTitle>
          <DialogDescription>
            {kind === "opening"
              ? "Past balances from before this app: what a customer owed you (debit), what you owed a manufacturer (credit), or a bank / cash balance. The other side goes to Opening Balance Adjustment."
              : "For entries no document makes: bank charges, TDS deducted by a customer, write-offs, corrections. Total debit must equal total credit."}
          </DialogDescription>
        </DialogHeader>

        <div className="grid sm:grid-cols-[180px_1fr] gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="jv-date">{kind === "opening" ? "Balance as on" : "Date"}</Label>
            <Input id="jv-date" type="date" max={todayIst()} value={date} onChange={(e) => setDate(e.target.value)} className="h-9 text-xs" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="jv-narration">Narration{kind === "opening" ? " (optional)" : ""}</Label>
            <Textarea id="jv-narration" rows={1} value={narration} onChange={(e) => setNarration(e.target.value)}
              placeholder={kind === "opening" ? "e.g. Balances carried forward from Tally as on 31-03-2026" : "e.g. Bank charges for October"} className="text-xs min-h-9" />
          </div>
        </div>

        <div className="rounded-lg border border-slate-200 overflow-x-auto">
          <table className="w-full min-w-[760px] text-xs">
            <thead className="bg-slate-50 text-[11px] uppercase tracking-wider text-slate-500">
              <tr>
                <th className="text-left p-2 font-bold">Account</th>
                <th className="text-left p-2 font-bold w-[210px]">Customer / manufacturer</th>
                <th className="text-left p-2 font-bold w-[110px]">Bill no.</th>
                <th className="text-right p-2 font-bold w-[120px]">Debit (₹)</th>
                <th className="text-right p-2 font-bold w-[120px]">Credit (₹)</th>
                <th className="w-9" />
              </tr>
            </thead>
            <tbody>
              {lines.map((l) => {
                const acc = accountsById.get(l.accountId);
                const partyRole = acc?.kind === "receivable" ? "customer" : acc?.kind === "payable" ? "manufacturer" : null;
                return (
                  <tr key={l.key} className="border-t border-slate-100 align-top">
                    <td className="p-1.5">
                      <Select value={l.accountId} onValueChange={(v) => update(l.key, { accountId: v, partyId: "" })}>
                        <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Pick account" /></SelectTrigger>
                        <SelectContent className="bg-white max-h-72">
                          {groups.map((g) => (
                            <SelectGroup key={g.type}>
                              <SelectLabel className="text-[10px] uppercase tracking-wider text-slate-400">{ACCOUNT_TYPE_LABELS[g.type]}</SelectLabel>
                              {g.accounts.map((a) => (
                                <SelectItem key={a.id} value={a.id} className="text-xs">{a.code} · {a.name}</SelectItem>
                              ))}
                            </SelectGroup>
                          ))}
                        </SelectContent>
                      </Select>
                    </td>
                    <td className="p-1.5">
                      {partyRole ? (
                        <Select value={l.partyId} onValueChange={(v) => update(l.key, { partyId: v })}>
                          <SelectTrigger className="h-8 text-xs"><SelectValue placeholder={`Pick ${partyRole}`} /></SelectTrigger>
                          <SelectContent className="bg-white max-h-72">
                            {data.parties.filter((p) => p.role === partyRole).map((p) => (
                              <SelectItem key={p.id} value={p.id} className="text-xs">{p.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <span className="block px-2 py-2 text-slate-400">—</span>
                      )}
                    </td>
                    <td className="p-1.5">
                      <Input value={l.billRef} disabled={!partyRole} maxLength={50} onChange={(e) => update(l.key, { billRef: e.target.value })} placeholder={partyRole ? "Optional" : ""} className="h-8 text-xs font-mono" />
                    </td>
                    <td className="p-1.5">
                      <Input type="number" min={0} step="0.01" value={l.debit} onChange={(e) => update(l.key, { debit: e.target.value, credit: e.target.value ? "" : l.credit })} className={`h-8 text-xs text-right ${NO_SPINNER}`} />
                    </td>
                    <td className="p-1.5">
                      <Input type="number" min={0} step="0.01" value={l.credit} onChange={(e) => update(l.key, { credit: e.target.value, debit: e.target.value ? "" : l.debit })} className={`h-8 text-xs text-right ${NO_SPINNER}`} />
                    </td>
                    <td className="p-1.5">
                      <button type="button" aria-label="Remove line" disabled={lines.length <= 1}
                        onClick={() => setLines((ls) => ls.filter((x) => x.key !== l.key))}
                        className="h-8 w-8 inline-flex items-center justify-center rounded-md text-slate-400 hover:text-red-600 disabled:opacity-30">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot className="border-t border-slate-200 bg-slate-50/60">
              <tr>
                <td className="p-2" colSpan={3}>
                  <Button type="button" size="sm" variant="ghost" className="gap-1 h-7 text-xs" onClick={() => setLines((ls) => [...ls, newLine()])} disabled={lines.length >= 100}>
                    <Plus className="h-3.5 w-3.5" />Add line
                  </Button>
                </td>
                <td className="p-2 text-right font-bold tabular-nums">{amount(totalDr)}</td>
                <td className="p-2 text-right font-bold tabular-nums">{amount(totalCr)}</td>
                <td />
              </tr>
              {kind === "opening" && difference !== 0 && (
                <tr>
                  <td colSpan={3} className="px-2 pb-2 text-[11px] text-slate-500">Opening Balance Adjustment (added automatically)</td>
                  <td className="px-2 pb-2 text-right text-[11px] text-slate-500 tabular-nums">{difference < 0 ? amount(-difference) : ""}</td>
                  <td className="px-2 pb-2 text-right text-[11px] text-slate-500 tabular-nums">{difference > 0 ? amount(difference) : ""}</td>
                  <td />
                </tr>
              )}
            </tfoot>
          </table>
        </div>
        {kind === "opening" && (
          <p className="text-[11px] text-slate-500">
            Customer owed you money: <strong>Debit</strong>. You owed a manufacturer: <strong>Credit</strong>. Add the old bill number to track it (optional).
          </p>
        )}

        <DialogFooter className="items-center">
          {firstProblem && <p className="mr-auto text-[11px] text-amber-700">{firstProblem}</p>}
          <Button variant="outline" onClick={onClose} disabled={pending}>Cancel</Button>
          <Button onClick={save} disabled={pending || !!firstProblem}>{pending ? "Posting..." : "Post entry"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
