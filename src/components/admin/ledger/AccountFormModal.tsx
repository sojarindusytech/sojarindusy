"use client";

import { useState, useTransition } from "react";
import toast from "react-hot-toast";
import { saveLedgerAccount } from "@/actions/ledger";
import { ACCOUNT_TYPE_LABELS, DEFAULT_TALLY_GROUP, TALLY_GROUPS, suggestAccountCode } from "@/lib/ledger";
import type { LedgerAccount, LedgerAccountType } from "@/types/database.types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

type NewKind = "general" | "bank" | "cash";

/**
 * Add or edit an account in the chart of accounts. Bank accounts also carry their bank details
 * (like the invoice bank details). System accounts keep their code, type and kind.
 */
export function AccountFormModal({
  account,
  kind: presetKind = "general",
  existingCodes,
  onClose,
  onSaved,
}: {
  /** The account to edit; omit to add a new one. */
  account?: LedgerAccount | null;
  /** Kind of a new account (bank / cash from Sales Settings, general from the chart of accounts). */
  kind?: NewKind;
  existingCodes: string[];
  onClose: () => void;
  onSaved: (account: LedgerAccount) => void;
}) {
  const editing = !!account;
  const kind: NewKind = account ? (account.kind === "bank" || account.kind === "cash" ? account.kind : "general") : presetKind;
  const isSystem = !!account?.system_key;
  const locksStructure = isSystem || account?.kind === "receivable" || account?.kind === "payable";

  const [type, setType] = useState<LedgerAccountType>(account?.type ?? (kind === "general" ? "expense" : "asset"));
  const [code, setCode] = useState(account?.code ?? suggestAccountCode(existingCodes, kind === "general" ? "expense" : "asset", kind));
  const [name, setName] = useState(account?.name ?? "");
  const [tallyName, setTallyName] = useState(account?.tally_name ?? "");
  const [tallyGroup, setTallyGroup] = useState(account?.tally_group ?? (kind === "bank" ? "Bank Accounts" : kind === "cash" ? "Cash-in-Hand" : DEFAULT_TALLY_GROUP.expense));
  const [bankName, setBankName] = useState(account?.bank_name ?? "");
  const [accountNo, setAccountNo] = useState(account?.account_no ?? "");
  const [ifsc, setIfsc] = useState(account?.ifsc ?? "");
  const [branch, setBranch] = useState(account?.branch ?? "");
  const [holder, setHolder] = useState(account?.account_holder ?? "");
  const [pending, startTransition] = useTransition();

  const changeType = (t: LedgerAccountType) => {
    setType(t);
    if (!editing) {
      setCode(suggestAccountCode(existingCodes, t, kind));
      setTallyGroup(DEFAULT_TALLY_GROUP[t]);
    }
  };

  const save = () =>
    startTransition(async () => {
      const res = await saveLedgerAccount({
        id: account?.id ?? null,
        code,
        name,
        type: kind === "general" ? type : "asset",
        kind,
        tallyName,
        tallyGroup,
        bankName,
        accountNo,
        ifsc,
        branch,
        accountHolder: holder,
      });
      if (res.success) {
        toast.success(editing ? "Account saved." : `${res.account.name} added.`);
        onSaved(res.account);
      } else {
        toast.error(res.error);
      }
    });

  const title = editing ? `Edit ${account!.name}` : kind === "bank" ? "Add bank account" : kind === "cash" ? "Add cash account" : "Add account";

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            {kind === "bank"
              ? "Money received or paid through this bank account is posted to it."
              : kind === "cash"
                ? "A cash book, e.g. office cash or petty cash."
                : "A ledger account for journal entries, e.g. rent, salaries or a loan."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="grid grid-cols-[110px_1fr] gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="acc-code">Code</Label>
              <Input id="acc-code" value={code} disabled={locksStructure} onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))} className="h-9 text-xs font-mono" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="acc-name">Name</Label>
              <Input id="acc-name" value={name} onChange={(e) => setName(e.target.value)} placeholder={kind === "bank" ? "e.g. HDFC Current A/c" : kind === "cash" ? "e.g. Petty Cash" : "e.g. Rent"} className="h-9 text-xs" />
            </div>
          </div>

          {kind === "general" && (
            <div className="space-y-1.5">
              <Label>Type</Label>
              <Select value={type} onValueChange={(v) => changeType(v as LedgerAccountType)} disabled={locksStructure}>
                <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent className="bg-white">
                  {(Object.keys(ACCOUNT_TYPE_LABELS) as LedgerAccountType[]).map((t) => (
                    <SelectItem key={t} value={t} className="text-xs">{ACCOUNT_TYPE_LABELS[t]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {kind === "bank" && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="acc-bank">Bank name</Label>
                <Input id="acc-bank" value={bankName} onChange={(e) => setBankName(e.target.value)} className="h-9 text-xs" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="acc-holder">Account holder</Label>
                <Input id="acc-holder" value={holder} onChange={(e) => setHolder(e.target.value)} className="h-9 text-xs" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="acc-no">Account no.</Label>
                <Input id="acc-no" value={accountNo} onChange={(e) => setAccountNo(e.target.value)} className="h-9 text-xs font-mono" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="acc-ifsc">IFSC</Label>
                <Input id="acc-ifsc" value={ifsc} onChange={(e) => setIfsc(e.target.value.toUpperCase())} maxLength={11} className="h-9 text-xs font-mono" />
              </div>
              <div className="col-span-2 space-y-1.5">
                <Label htmlFor="acc-branch">Branch</Label>
                <Input id="acc-branch" value={branch} onChange={(e) => setBranch(e.target.value)} className="h-9 text-xs" />
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3 rounded-lg border border-slate-200 bg-slate-50/60 p-3">
            <div className="space-y-1.5">
              <Label htmlFor="acc-tally">Name in Tally</Label>
              <Input id="acc-tally" value={tallyName} onChange={(e) => setTallyName(e.target.value)} placeholder={name || "Same as name"} className="h-9 text-xs bg-white" />
            </div>
            <div className="space-y-1.5">
              <Label>Tally group</Label>
              <Select value={tallyGroup} onValueChange={setTallyGroup}>
                <SelectTrigger className="h-9 text-xs bg-white"><SelectValue /></SelectTrigger>
                <SelectContent className="bg-white max-h-64">
                  {[...new Set([...TALLY_GROUPS, tallyGroup])].map((g) => (
                    <SelectItem key={g} value={g} className="text-xs">{g}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <p className="col-span-2 text-[11px] text-slate-500">Used by the Tally export. Match the ledger name your accountant uses in Tally.</p>
          </div>
          {locksStructure && <p className="text-[11px] text-slate-500">This account is used by the app itself, so its code and type are fixed. You can rename it.</p>}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={pending}>Cancel</Button>
          <Button onClick={save} disabled={pending || name.trim().length < 2 || code.length < 3}>
            {pending ? "Saving..." : editing ? "Save" : "Add account"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
