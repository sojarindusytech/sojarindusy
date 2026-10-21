"use client";

import { FileText } from "lucide-react";
import { VOUCHER_LABELS, amount, documentPdfHref, drCr, fmtDate, round2, type ReportLine } from "@/lib/ledger";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

/** A signed balance as "1,180.00 Dr" with the side in a quieter colour. */
export function DrCr({ value, className = "" }: { value: number; className?: string }) {
  const { amount: a, side } = drCr(value);
  return (
    <span className={`whitespace-nowrap tabular-nums ${className}`}>
      {a}
      {side && <span className={`ml-1 text-[10px] font-semibold ${side === "Dr" ? "text-[#024AE5]" : "text-amber-700"}`}>{side}</span>}
    </span>
  );
}

const VOUCHER_TONE: Record<string, "blue" | "success" | "warning" | "secondary" | "outline"> = {
  invoice: "blue",
  debit_note: "blue",
  receipt: "success",
  credit_note: "warning",
  supplier_payment: "success",
  journal: "secondary",
  opening: "outline",
};

/**
 * Ledger lines with opening and closing rows and a running balance. Used for a party's statement
 * and for one account's ledger. Document numbers open their PDF.
 */
export function StatementTable({
  lines,
  opening,
  showAccount = false,
  partyNames,
  emptyText = "No entries in this period.",
}: {
  lines: ReportLine[];
  opening: number;
  /** Show which account each line is on (account ledger shows the party instead). */
  showAccount?: boolean;
  /** Party names by id: shown for lines that carry a party (account ledger). */
  partyNames?: Map<string, string>;
  emptyText?: string;
}) {
  const debit = round2(lines.reduce((s, l) => s + l.debit, 0));
  const credit = round2(lines.reduce((s, l) => s + l.credit, 0));
  const closing = round2(opening + debit - credit);

  return (
    <div className="overflow-x-auto [scrollbar-width:thin]">
      <Table className="min-w-[860px]">
        <TableHeader>
          <TableRow className="bg-slate-50/80 whitespace-nowrap">
            <TableHead className="text-[11px] font-bold uppercase tracking-wider w-[96px]">Date</TableHead>
            <TableHead className="text-[11px] font-bold uppercase tracking-wider">Voucher</TableHead>
            <TableHead className="text-[11px] font-bold uppercase tracking-wider">Particulars</TableHead>
            <TableHead className="text-[11px] font-bold uppercase tracking-wider text-right">Debit</TableHead>
            <TableHead className="text-[11px] font-bold uppercase tracking-wider text-right">Credit</TableHead>
            <TableHead className="text-[11px] font-bold uppercase tracking-wider text-right">Balance</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow className="bg-slate-50/40">
            <TableCell colSpan={5} className="text-xs font-semibold text-slate-700">Opening balance</TableCell>
            <TableCell className="text-xs font-semibold text-right"><DrCr value={opening} /></TableCell>
          </TableRow>
          {lines.length === 0 ? (
            <TableRow>
              <TableCell colSpan={6} className="py-10 text-center text-xs text-slate-500">{emptyText}</TableCell>
            </TableRow>
          ) : (
            lines.map((l) => {
              const href = documentPdfHref(l.voucher_type, l.source_id);
              const muted = l.is_reversal || l.reversed;
              const party = l.party_id ? partyNames?.get(l.party_id) : null;
              return (
                <TableRow key={l.line_id} className={muted ? "opacity-60" : ""}>
                  <TableCell className="text-xs text-slate-600 whitespace-nowrap tabular-nums">{fmtDate(l.entry_date)}</TableCell>
                  <TableCell className="whitespace-nowrap">
                    <div className="flex items-center gap-1.5">
                      <Badge variant={VOUCHER_TONE[l.voucher_type] ?? "outline"} className="text-[10px]">{VOUCHER_LABELS[l.voucher_type]}</Badge>
                      {href ? (
                        // A plain link: the PDF routes are not pages, so they must not be prefetched.
                        <a href={href} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-mono text-xs font-semibold text-slate-900 hover:text-[#024AE5]">
                          {l.voucher_number}
                          <FileText className="h-3 w-3 text-slate-400" />
                        </a>
                      ) : (
                        <span className="font-mono text-xs font-semibold text-slate-900">{l.voucher_number}</span>
                      )}
                    </div>
                    {l.is_reversal && <span className="text-[10px] font-semibold text-red-700">Reversal</span>}
                    {l.reversed && <span className="text-[10px] font-semibold text-slate-500">Cancelled / replaced</span>}
                  </TableCell>
                  <TableCell className="text-xs text-slate-700 max-w-[380px]">
                    {showAccount && <div className="font-semibold text-slate-900">{l.account_name}</div>}
                    {party && <div className="font-semibold text-slate-900">{party}</div>}
                    <div className="text-slate-600 line-clamp-2" title={l.narration ?? undefined}>{l.narration}</div>
                    {(l.line_narration || (l.bill_ref && l.voucher_type === "receipt")) && (
                      <div className="text-[11px] text-slate-500">
                        {l.voucher_type === "receipt" && l.bill_ref ? `Against ${l.bill_ref}` : l.voucher_type === "receipt" && l.bill_type === "advance" ? "Advance" : ""}
                        {l.line_narration ? ` ${l.line_narration}` : ""}
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="text-xs text-right tabular-nums whitespace-nowrap">{l.debit ? amount(l.debit) : ""}</TableCell>
                  <TableCell className="text-xs text-right tabular-nums whitespace-nowrap">{l.credit ? amount(l.credit) : ""}</TableCell>
                  <TableCell className="text-xs text-right font-medium"><DrCr value={l.balance} /></TableCell>
                </TableRow>
              );
            })
          )}
          <TableRow className="bg-slate-50/80 border-t-2 border-slate-200">
            <TableCell colSpan={3} className="text-xs font-bold text-slate-900">Closing balance</TableCell>
            <TableCell className="text-xs font-bold text-right tabular-nums">{amount(debit)}</TableCell>
            <TableCell className="text-xs font-bold text-right tabular-nums">{amount(credit)}</TableCell>
            <TableCell className="text-xs font-bold text-right"><DrCr value={closing} /></TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>
  );
}
