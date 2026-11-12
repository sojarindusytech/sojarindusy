"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { Landmark, Pencil, Plus, Star, Wallet } from "lucide-react";
import { makeDefaultMoneyAccount, setLedgerAccountActive } from "@/actions/ledger";
import type { LedgerAccount } from "@/types/database.types";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { IconAction } from "@/components/common/IconAction";
import { AccountFormModal } from "./ledger/AccountFormModal";

/**
 * Bank and cash accounts (Sales Settings). Receipts and payments made pick one of these as
 * "Deposited in" / "Paid from", and the ledger posts the money to it. One bank and one cash
 * account are the defaults.
 */
export function BankAccountsCard({ accounts }: { accounts: LedgerAccount[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState<LedgerAccount | null>(null);
  const [adding, setAdding] = useState<"bank" | "cash" | null>(null);
  const [pending, startTransition] = useTransition();

  const run = (fn: () => Promise<{ success: boolean; error?: string }>, done: string) =>
    startTransition(async () => {
      const res = await fn();
      if (res.success) {
        toast.success(done);
        router.refresh();
      } else {
        toast.error(res.error ?? "Could not update the account.");
      }
    });

  const sorted = [...accounts].sort((a, b) => Number(b.active) - Number(a.active) || a.kind.localeCompare(b.kind) || a.code.localeCompare(b.code));

  return (
    <Card className="p-5 space-y-4 shadow-none border-slate-200 rounded-xl">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-bold text-slate-900">Bank &amp; Cash Accounts</h2>
          <p className="text-[11px] text-slate-500 mt-0.5">
            Where money is received and paid. Payments Received and Payments Made post to the account picked on each one.
          </p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setAdding("bank")}><Plus className="h-3.5 w-3.5" />Bank account</Button>
          <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setAdding("cash")}><Plus className="h-3.5 w-3.5" />Cash account</Button>
        </div>
      </div>

      <div className="divide-y divide-slate-100 rounded-lg border border-slate-200">
        {sorted.map((a) => (
          <div key={a.id} className={`flex flex-wrap items-center gap-3 p-3 ${a.active ? "" : "opacity-60"}`}>
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
              {a.kind === "bank" ? <Landmark className="h-4 w-4" /> : <Wallet className="h-4 w-4" />}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-semibold text-slate-900">{a.name}</span>
                {a.is_default && <Badge variant="blue" className="text-[10px]">Default {a.kind}</Badge>}
                {!a.active && <Badge variant="outline" className="text-[10px]">Inactive</Badge>}
              </div>
              <p className="text-[11px] text-slate-500 truncate">
                {a.kind === "bank"
                  ? [a.bank_name, a.account_no && `A/c ${a.account_no}`, a.ifsc && `IFSC ${a.ifsc}`, a.branch].filter(Boolean).join(" · ") || "No bank details yet"
                  : "Cash book"}
              </p>
            </div>
            <div className="flex items-center gap-1">
              {a.active && !a.is_default && (
                <IconAction label={`Make default ${a.kind} account`} tone="primary" disabled={pending} onClick={() => run(() => makeDefaultMoneyAccount(a.id), `${a.name} is now the default ${a.kind} account.`)}>
                  <Star />
                </IconAction>
              )}
              <IconAction label="Edit" onClick={() => setEditing(a)}><Pencil /></IconAction>
              {!a.is_default && !a.system_key && (
                <Button size="sm" variant="ghost" className="h-7 px-2 text-[11px]" disabled={pending}
                  onClick={() => run(() => setLedgerAccountActive(a.id, !a.active), a.active ? `${a.name} turned off.` : `${a.name} turned on.`)}>
                  {a.active ? "Turn off" : "Turn on"}
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>

      {(editing || adding) && (
        <AccountFormModal
          account={editing}
          kind={adding ?? undefined}
          existingCodes={accounts.map((a) => a.code)}
          onClose={() => { setEditing(null); setAdding(null); }}
          onSaved={() => { setEditing(null); setAdding(null); router.refresh(); }}
        />
      )}
    </Card>
  );
}
