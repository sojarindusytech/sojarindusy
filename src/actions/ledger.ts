"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin, requireUser } from "@/lib/auth-guard";
import { parseDbError } from "@/lib/server/db-error";
import { ledgerErrorMessage } from "@/lib/server/ledger-errors";
import { cancelJournal, ledgerBalances, postJournal, setDefaultMoneyAccount } from "@/lib/server/rpc";
import {
  ageingByParty,
  buildStatement,
  buildTallyVouchers,
  isMissingTable,
  LEDGER_MIGRATION_HINT,
  loadAccounts,
  loadParties,
  partyTotals,
  reportLines,
  resolveRange,
  type LedgerRange,
  type PartyInfo,
  type PartyLedgerTotals,
  type PartyStatement,
} from "@/lib/server/ledger";
import { accountTotals, type AccountTotals, type ReportLine, type VoucherType } from "@/lib/ledger";
import { journalSchema, ledgerAccountSchema, type JournalInput, type LedgerAccountInput } from "@/lib/validations/ledger";
import type { LedgerAccount } from "@/types/database.types";

type Result<T = object> = ({ success: true } & T) | { success: false; error: string };

export type { LedgerRange, PartyInfo, PartyStatement, PendingBill } from "@/lib/server/ledger";

const revalidateLedger = () => {
  revalidatePath("/admin/general-ledger");
  revalidatePath("/admin/party-ledger", "layout");
  revalidatePath("/dashboard/statement");
};

// ---- Party Ledger ------------------------------------------------------------------------------

export interface PartyLedgerRow extends PartyLedgerTotals {
  party: PartyInfo;
  /** Customers only: what is owed aged first-in-first-out, and the part past their credit days. */
  due: number;
  overdue: number;
}

export interface PartyLedgerData {
  range: LedgerRange;
  rows: PartyLedgerRow[];
  /** Entries on the customers / manufacturers accounts with no party (old documents without a customer). */
  unlinked: PartyLedgerTotals | null;
  error: string | null;
}

/** Every customer and manufacturer with their balances for the range. */
export async function getPartyLedger(range?: Partial<LedgerRange>): Promise<PartyLedgerData> {
  await requireAdmin();
  const r = resolveRange(range);
  try {
    const accounts = await loadAccounts();
    const [parties, totals, ageing] = await Promise.all([loadParties(), partyTotals(r.from, r.to, accounts), ageingByParty(r.to)]);
    const zero = { opening: 0, debit: 0, credit: 0, closing: 0 };
    const rows = parties.map((party) => {
      const t = totals.byParty.get(party.id) ?? zero;
      const a = ageing.get(party.id);
      return { party, ...t, due: a?.due ?? 0, overdue: a?.overdue ?? 0 };
    });
    return { range: r, rows, unlinked: totals.unlinked, error: null };
  } catch (err) {
    return { range: r, rows: [], unlinked: null, error: err instanceof Error ? err.message : "Could not load the party ledger." };
  }
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** One party's statement: opening balance, every entry with a running balance, ageing and pending bills. */
export async function getPartyStatement(partyId: string, range?: Partial<LedgerRange>, showReversed = false): Promise<PartyStatement> {
  await requireAdmin();
  const r = resolveRange(range);
  const empty: PartyStatement = { range: r, party: null, totals: { opening: 0, debit: 0, credit: 0, closing: 0 }, lines: [], ageing: null, pendingBills: [], error: null };
  try {
    if (partyId !== "unlinked" && !UUID.test(partyId)) return { ...empty, error: "Party not found." };
    const party = partyId === "unlinked" ? null : (await loadParties()).find((p) => p.id === partyId) ?? null;
    if (partyId !== "unlinked" && !party) return { ...empty, error: "Party not found." };
    return await buildStatement(partyId, r, showReversed, party);
  } catch (err) {
    return { ...empty, error: err instanceof Error ? err.message : "Could not load the statement." };
  }
}

/** The signed-in customer's own statement. Never accepts a party id from the client. */
export async function fetchMyStatement(range?: Partial<LedgerRange>): Promise<PartyStatement> {
  const ctx = await requireUser();
  const r = resolveRange(range);
  const empty: PartyStatement = { range: r, party: null, totals: { opening: 0, debit: 0, credit: 0, closing: 0 }, lines: [], ageing: null, pendingBills: [], error: null };
  try {
    const party = (await loadParties()).find((p) => p.id === ctx.userId && p.role === "customer") ?? null;
    if (!party) return { ...empty, error: "Statements are available for customer accounts." };
    return await buildStatement(party.id, r, false, party);
  } catch (err) {
    console.error("[fetchMyStatement]", err);
    return { ...empty, error: "Your statement could not be loaded. Please try again later." };
  }
}

// ---- General Ledger ------------------------------------------------------------------------------

export interface GeneralLedgerData {
  range: LedgerRange;
  accounts: LedgerAccount[];
  /** Per account: opening (before the range), debits and credits in it, closing. */
  totals: AccountTotals[];
  error: string | null;
}

export async function getGeneralLedger(range?: Partial<LedgerRange>): Promise<GeneralLedgerData> {
  await requireAdmin();
  const r = resolveRange(range);
  try {
    const accounts = await loadAccounts();
    const res = await ledgerBalances(r.from, r.to);
    if (res.error) throw new Error(isMissingTable({ code: res.error.code }) ? LEDGER_MIGRATION_HINT : "Balances could not be loaded.");
    return { range: r, accounts, totals: accountTotals(accounts, res.data), error: null };
  } catch (err) {
    return { range: r, accounts: [], totals: [], error: err instanceof Error ? err.message : "Could not load the general ledger." };
  }
}

/** One account's entries with a running balance. */
export async function getAccountLedger(accountId: string, range?: Partial<LedgerRange>, showReversed = false): Promise<{ lines: ReportLine[]; opening: number; error: string | null }> {
  await requireAdmin();
  const r = resolveRange(range);
  if (!UUID.test(accountId)) return { lines: [], opening: 0, error: "Account not found." };
  try {
    const [lines, balances] = await Promise.all([
      reportLines({ from: r.from, to: r.to, accountId, showReversed }),
      ledgerBalances(r.from, r.to),
    ]);
    const opening = balances.error ? 0 : balances.data.filter((b) => b.account_id === accountId).reduce((s, b) => s + b.opening, 0);
    return { lines, opening: Math.round(opening * 100) / 100, error: null };
  } catch (err) {
    return { lines: [], opening: 0, error: err instanceof Error ? err.message : "Could not load the account." };
  }
}

/** Every entry in the range, cancelled ones included (Day Book). */
export async function getDayBook(range?: Partial<LedgerRange>): Promise<{ lines: ReportLine[]; error: string | null }> {
  await requireAdmin();
  const r = resolveRange(range);
  try {
    return { lines: await reportLines({ from: r.from, to: r.to, showReversed: true }), error: null };
  } catch (err) {
    return { lines: [], error: err instanceof Error ? err.message : "Could not load the day book." };
  }
}

// ---- Journals and opening balances -------------------------------------------------------------------

export interface JournalRow {
  id: string;
  voucher_type: "journal" | "opening";
  voucher_number: string;
  entry_date: string;
  narration: string | null;
  cancelled: boolean;
  reversal_reason: string | null;
  lines: { account: string; party: string | null; debit: number; credit: number; bill_ref: string | null }[];
  total: number;
}

/** A journal / opening entry as selected for the Journals list. */
interface JournalEntryRow {
  id: string;
  voucher_type: "journal" | "opening";
  voucher_number: string;
  entry_date: string;
  narration: string | null;
  reversed_by: string | null;
  lines: { line_no: number; debit: number | string; credit: number | string; bill_ref: string | null; party_id: string | null; account: { name: string } | null }[] | null;
}

export async function listJournals(range?: Partial<LedgerRange>): Promise<{ rows: JournalRow[]; error: string | null }> {
  await requireAdmin();
  const r = resolveRange(range);
  try {
    const db = createAdminClient();
    const { data, error } = await db
      .from("ledger_entries" as never)
      .select("id, voucher_type, voucher_number, entry_date, narration, reversed_by, lines:ledger_lines(line_no, debit, credit, bill_ref, party_id, account:ledger_accounts(name))")
      .in("voucher_type", ["journal", "opening"])
      .eq("is_reversal", false)
      .gte("entry_date", r.from)
      .lte("entry_date", r.to)
      .order("entry_date", { ascending: false })
      .order("seq", { ascending: false })
      .limit(1000);
    if (error) throw new Error(isMissingTable(error) ? LEDGER_MIGRATION_HINT : error.message);
    const rows = (data as unknown as JournalEntryRow[] | null) ?? [];

    // Why each cancelled one was cancelled (the reason sits on its reversal).
    const reversedIds = rows.filter((e) => e.reversed_by).map((e) => e.reversed_by as string);
    const reasons = new Map<string, string | null>();
    if (reversedIds.length) {
      const { data: revs } = await db.from("ledger_entries" as never).select("id, reversal_reason").in("id", reversedIds);
      for (const rv of (revs as unknown as { id: string; reversal_reason: string | null }[] | null) ?? []) reasons.set(rv.id, rv.reversal_reason);
    }
    const names = new Map((await loadParties()).map((p) => [p.id, p.name]));
    return {
      rows: rows.map((e) => {
        const lines = (e.lines ?? [])
          .sort((a, b) => a.line_no - b.line_no)
          .map((l) => ({ account: l.account?.name ?? "", party: l.party_id ? names.get(l.party_id) ?? "Unknown party" : null, debit: Number(l.debit), credit: Number(l.credit), bill_ref: l.bill_ref ?? null }));
        return {
          id: e.id,
          voucher_type: e.voucher_type,
          voucher_number: e.voucher_number,
          entry_date: e.entry_date,
          narration: e.narration,
          cancelled: !!e.reversed_by,
          reversal_reason: e.reversed_by ? reasons.get(e.reversed_by) ?? null : null,
          lines,
          total: Math.round(lines.reduce((s, l) => s + l.debit, 0) * 100) / 100,
        };
      }),
      error: null,
    };
  } catch (err) {
    return { rows: [], error: err instanceof Error ? err.message : "Could not load journals." };
  }
}

export interface JournalFormData {
  accounts: Pick<LedgerAccount, "id" | "code" | "name" | "type" | "kind" | "system_key">[];
  parties: { id: string; name: string; role: "customer" | "manufacturer" }[];
}

export async function getJournalFormData(): Promise<JournalFormData> {
  await requireAdmin();
  try {
    const [accounts, parties] = await Promise.all([loadAccounts(), loadParties()]);
    return {
      accounts: accounts.filter((a) => a.active).map((a) => ({ id: a.id, code: a.code, name: a.name, type: a.type, kind: a.kind, system_key: a.system_key })),
      parties: parties.map((p) => ({ id: p.id, name: p.name, role: p.role })),
    };
  } catch {
    return { accounts: [], parties: [] };
  }
}

/** Posts a journal voucher or an opening balance. The rules are enforced again by the database. */
export async function postJournalEntry(input: JournalInput): Promise<Result<{ voucherNumber: string }>> {
  let actorId: string;
  try {
    actorId = (await requireAdmin()).userId;
  } catch {
    return { success: false, error: "Administrator access required." };
  }
  const parsed = journalSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? "Check the entry." };
  const v = parsed.data;
  const { data, error } = await postJournal(
    {
      request_id: v.requestId,
      kind: v.kind,
      entry_date: v.entryDate,
      narration: v.narration,
      lines: v.lines.map((l) => ({ account_id: l.accountId, party_id: l.partyId, debit: l.debit, credit: l.credit, bill_ref: l.billRef, narration: l.narration })),
    },
    actorId
  );
  if (error) return { success: false, error: ledgerErrorMessage(error) ?? journalError(error.code) };
  revalidateLedger();
  return { success: true, voucherNumber: data.voucher_number };
}

function journalError(code: string): string {
  switch (code) {
    case "REQUEST_ID_USED":
      return "This form was already submitted by someone else. Close it and start again.";
    case "ADMIN_REQUIRED":
      return "Administrator access required.";
    case "REASON_REQUIRED":
      return "Enter a reason (at least 3 characters).";
    default:
      return "Could not save the entry. Please check the details and try again.";
  }
}

/** Cancels a journal or opening balance by posting its reversal (the voucher stays in the books). */
export async function cancelJournalEntry(entryId: string, reason: string): Promise<Result> {
  let actorId: string;
  try {
    actorId = (await requireAdmin()).userId;
  } catch {
    return { success: false, error: "Administrator access required." };
  }
  if (!UUID.test(entryId)) return { success: false, error: "Entry not found." };
  if (reason.trim().length < 3) return { success: false, error: "Enter a reason (at least 3 characters)." };
  const { error } = await cancelJournal(entryId, reason.trim(), actorId);
  if (error) return { success: false, error: ledgerErrorMessage(error) ?? journalError(error.code) };
  revalidateLedger();
  return { success: true };
}

// ---- Accounts ----------------------------------------------------------------------------------------

export async function listLedgerAccounts(): Promise<{ accounts: LedgerAccount[]; error: string | null }> {
  await requireAdmin();
  try {
    return { accounts: await loadAccounts(), error: null };
  } catch (err) {
    return { accounts: [], error: err instanceof Error ? err.message : "Could not load accounts." };
  }
}

/** Creates or edits an account. System accounts keep their code, type and kind (the database refuses changes). */
export async function saveLedgerAccount(input: LedgerAccountInput): Promise<Result<{ account: LedgerAccount }>> {
  try {
    await requireAdmin();
  } catch {
    return { success: false, error: "Administrator access required." };
  }
  const parsed = ledgerAccountSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? "Check the account details." };
  const a = parsed.data;
  const isMoney = a.kind === "bank" || a.kind === "cash";
  const values = {
    code: a.code,
    name: a.name,
    tally_name: a.tallyName,
    tally_group: a.tallyGroup,
    bank_name: a.kind === "bank" ? a.bankName : null,
    account_no: a.kind === "bank" ? a.accountNo : null,
    ifsc: a.kind === "bank" ? a.ifsc : null,
    branch: a.kind === "bank" ? a.branch : null,
    account_holder: a.kind === "bank" ? a.accountHolder : null,
  };
  const db = createAdminClient();
  let res;
  if (a.id) {
    const { data: current } = await db.from("ledger_accounts" as never).select("system_key, kind, type").eq("id", a.id).maybeSingle();
    const cur = current as unknown as { system_key: string | null; kind: string; type: string } | null;
    if (!cur) return { success: false, error: "Account not found." };
    // System accounts: only names, Tally fields and bank details change.
    const update = cur.system_key ? { name: values.name, tally_name: values.tally_name, tally_group: values.tally_group, ...(cur.kind === "bank" ? {
      bank_name: values.bank_name, account_no: values.account_no, ifsc: values.ifsc, branch: values.branch, account_holder: values.account_holder } : {}) }
      : { ...values, type: a.type, kind: a.kind };
    res = await db.from("ledger_accounts" as never).update(update as never).eq("id", a.id).select("*").single();
  } else {
    res = await db.from("ledger_accounts" as never)
      .insert({ ...values, type: isMoney ? "asset" : a.type, kind: a.kind } as never)
      .select("*")
      .single();
  }
  if (res.error) {
    const e = parseDbError(res.error);
    if (e.code === "UNIQUE_VIOLATION") {
      const c = String(e.detail.constraint ?? "");
      return { success: false, error: c.includes("code") ? "Another account already uses this code." : "Another account already has this name." };
    }
    return { success: false, error: ledgerErrorMessage(e) ?? "Could not save the account." };
  }
  revalidateLedger();
  revalidatePath("/admin/settings/sales");
  revalidatePath("/admin/payments-received");
  revalidatePath("/admin/payments-made");
  return { success: true, account: res.data as unknown as LedgerAccount };
}

export async function setLedgerAccountActive(accountId: string, active: boolean): Promise<Result> {
  try {
    await requireAdmin();
  } catch {
    return { success: false, error: "Administrator access required." };
  }
  if (!UUID.test(accountId)) return { success: false, error: "Account not found." };
  const db = createAdminClient();
  const { data } = await db.from("ledger_accounts" as never).select("is_default, system_key").eq("id", accountId).maybeSingle();
  const acc = data as unknown as { is_default: boolean; system_key: string | null } | null;
  if (!acc) return { success: false, error: "Account not found." };
  if (!active && acc.is_default) return { success: false, error: "This is the default account. Make another account the default first." };
  if (!active && acc.system_key) return { success: false, error: "System accounts are always active." };
  const { error } = await db.from("ledger_accounts" as never).update({ active } as never).eq("id", accountId);
  if (error) return { success: false, error: ledgerErrorMessage(parseDbError(error)) ?? "Could not update the account." };
  revalidateLedger();
  revalidatePath("/admin/settings/sales");
  return { success: true };
}

export async function makeDefaultMoneyAccount(accountId: string): Promise<Result> {
  try {
    await requireAdmin();
  } catch {
    return { success: false, error: "Administrator access required." };
  }
  if (!UUID.test(accountId)) return { success: false, error: "Account not found." };
  const { error } = await setDefaultMoneyAccount(accountId);
  if (error) return { success: false, error: ledgerErrorMessage(error) ?? "Could not change the default account." };
  revalidatePath("/admin/settings/sales");
  revalidateLedger();
  return { success: true };
}

// ---- Tally export ------------------------------------------------------------------------------------

export interface TallyExportSummary {
  range: LedgerRange;
  /** Vouchers per type that the export will contain. */
  counts: { type: VoucherType; count: number }[];
  /** Documents cancelled here in the range: cancel them in Tally by hand if they were imported before. */
  cancelled: { type: VoucherType; number: string; date: string }[];
  error: string | null;
}

export async function getTallyExportSummary(range?: Partial<LedgerRange>): Promise<TallyExportSummary> {
  await requireAdmin();
  const r = resolveRange(range);
  try {
    const { vouchers, cancelled } = await buildTallyVouchers(r.from, r.to);
    const counts = new Map<VoucherType, number>();
    for (const v of vouchers) counts.set(v.type, (counts.get(v.type) ?? 0) + 1);
    return { range: r, counts: [...counts.entries()].map(([type, count]) => ({ type, count })), cancelled, error: null };
  } catch (err) {
    return { range: r, counts: [], cancelled: [], error: err instanceof Error ? err.message : "Could not prepare the export." };
  }
}
