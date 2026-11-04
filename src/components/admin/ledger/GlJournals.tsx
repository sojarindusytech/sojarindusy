"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { Ban, NotebookPen, Plus } from "lucide-react";
import { cancelJournalEntry, type JournalFormData, type JournalRow } from "@/actions/ledger";
import { amount, fmtDate } from "@/lib/ledger";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { IconAction } from "@/components/common/IconAction";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { JournalFormModal } from "./JournalFormModal";

/** Journal vouchers and opening balances in the period, with the lines of each. */
export function GlJournals({ rows, error, formData }: { rows: JournalRow[]; error: string | null; formData: JournalFormData }) {
  const router = useRouter();
  const [creating, setCreating] = useState<"journal" | "opening" | null>(null);
  const [cancelling, setCancelling] = useState<JournalRow | null>(null);
  const [reason, setReason] = useState("");
  const [pending, startTransition] = useTransition();

  const confirmCancel = () => {
    const target = cancelling;
    if (!target) return;
    startTransition(async () => {
      const res = await cancelJournalEntry(target.id, reason);
      if (res.success) {
        toast.success(`${target.voucher_number} cancelled.`);
        setCancelling(null);
        setReason("");
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  };

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 border-b border-slate-100">
        <p className="text-xs text-slate-600">Entries made by hand. Invoices, notes and payments post themselves.</p>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setCreating("opening")}><Plus className="h-3.5 w-3.5" />Opening balance</Button>
          <Button size="sm" className="gap-1.5" onClick={() => setCreating("journal")}><Plus className="h-3.5 w-3.5" />New journal</Button>
        </div>
      </div>

      {error ? (
        <p className="p-4 text-sm text-amber-900">{error}</p>
      ) : rows.length === 0 ? (
        <div className="py-14 text-center">
          <NotebookPen className="h-8 w-8 mx-auto text-slate-300 mb-2" />
          <p className="text-sm font-semibold text-slate-700">No journals in this period</p>
          <p className="text-xs text-slate-500 mt-1">Use a journal for bank charges, TDS, write-offs or manufacturer bills.</p>
        </div>
      ) : (
        <div className="divide-y divide-slate-100">
          {rows.map((j) => (
            <div key={j.id} className={`p-4 ${j.cancelled ? "opacity-60" : ""}`}>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-xs font-bold text-slate-900">{j.voucher_number}</span>
                    <Badge variant={j.voucher_type === "opening" ? "outline" : "secondary"} className="text-[10px]">{j.voucher_type === "opening" ? "Opening balance" : "Journal"}</Badge>
                    <span className="text-xs text-slate-500 tabular-nums">{fmtDate(j.entry_date)}</span>
                    {j.cancelled && <Badge variant="destructive" className="text-[10px]" title={j.reversal_reason ?? undefined}>Cancelled</Badge>}
                  </div>
                  {j.narration && <p className="text-xs text-slate-600 mt-1">{j.narration}</p>}
                  {j.cancelled && j.reversal_reason && <p className="text-[11px] text-red-700 mt-0.5">Reason: {j.reversal_reason}</p>}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold tabular-nums">₹{amount(j.total)}</span>
                  {!j.cancelled && (
                    <IconAction label="Cancel entry" tone="danger" onClick={() => setCancelling(j)}><Ban /></IconAction>
                  )}
                </div>
              </div>
              <div className="mt-2 overflow-x-auto">
                <table className="w-full min-w-[520px] text-xs">
                  <tbody>
                    {j.lines.map((l, i) => (
                      <tr key={i} className="border-t border-slate-50">
                        <td className={`py-1 ${l.credit ? "pl-8" : ""} text-slate-800`}>
                          {l.account}{l.party ? <span className="text-slate-500"> · {l.party}</span> : null}
                          {l.bill_ref ? <span className="font-mono text-[11px] text-slate-400"> ({l.bill_ref})</span> : null}
                        </td>
                        <td className="py-1 text-right tabular-nums w-28">{l.debit ? `${amount(l.debit)} Dr` : ""}</td>
                        <td className="py-1 text-right tabular-nums w-28">{l.credit ? `${amount(l.credit)} Cr` : ""}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}

      {creating && (
        <JournalFormModal kind={creating} data={formData} onClose={() => setCreating(null)} onSaved={() => { setCreating(null); router.refresh(); }} />
      )}

      <AlertDialog open={!!cancelling} onOpenChange={(o) => { if (!o) { setCancelling(null); setReason(""); } }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel {cancelling?.voucher_number}?</AlertDialogTitle>
            <AlertDialogDescription>
              A reversal entry is posted on the same date, so its effect is undone. The entry stays listed as Cancelled.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Textarea rows={2} placeholder="Reason (required)" value={reason} onChange={(e) => setReason(e.target.value)} className="text-xs" />
          <AlertDialogFooter>
            <AlertDialogCancel>Keep entry</AlertDialogCancel>
            <Button onClick={confirmCancel} disabled={pending || reason.trim().length < 3} className="bg-red-600 hover:bg-red-700 text-white">
              {pending ? "Cancelling..." : "Cancel entry"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
