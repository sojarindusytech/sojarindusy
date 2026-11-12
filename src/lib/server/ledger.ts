import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { ledgerBalances, ledgerReceivableAgeing, ledgerReportLines, type AgeingRow } from "@/lib/server/rpc";
import {
  financialYearRange,
  gstDutyHead,
  partyName,
  todayIst,
  uniqueTallyNames,
  type ReportLine,
  type TallyLedger,
  type TallyVoucher,
  type VoucherType,
} from "@/lib/ledger";
import type { LedgerAccount } from "@/types/database.types";
import { ledgerRangeSchema } from "@/lib/validations/ledger";

export interface LedgerRange {
  from: string;
  to: string;
}

/** A valid range, or this financial year to date. */
export function resolveRange(range?: Partial<LedgerRange> | null): LedgerRange {
  const parsed = ledgerRangeSchema.safeParse(range ?? {});
  if (parsed.success) return parsed.data;
  const fy = financialYearRange();
  const today = todayIst();
  return { from: fy.from, to: today < fy.to ? today : fy.to };
}

/** PostgREST / Postgres codes for "this table does not exist": the ledger migration has not been applied. */
export const isMissingTable = (e: { code?: string } | null | undefined) => !!e && (e.code === "PGRST205" || e.code === "42P01" || e.code === "PGRST202");
export const LEDGER_MIGRATION_HINT = "The ledger tables are missing. Apply supabase/migrations/20261024_ledger.sql, then reload.";

export interface PartyInfo {
  id: string;
  name: string;
  role: "customer" | "manufacturer";
  email: string | null;
  gstin: string | null;
  state: string | null;
  credit_days: number;
}

type PageResult = { data: unknown; error: { code?: string; message: string } | null };

/** Reads every page of a select (Supabase returns at most 1000 rows per request). */
async function selectAll<T>(page: (from: number, to: number) => PromiseLike<PageResult>, label: string): Promise<T[]> {
  const size = 1000;
  const rows: T[] = [];
  for (let from = 0; from < 100_000; from += size) {
    const { data, error } = await page(from, from + size - 1);
    if (error) {
      console.error(`[${label}]`, error.code, error.message);
      throw new Error(isMissingTable(error) ? LEDGER_MIGRATION_HINT : `${label} could not be loaded.`);
    }
    const chunk = (data as T[] | null) ?? [];
    rows.push(...chunk);
    if (chunk.length < size) break;
  }
  return rows;
}

/** Splits a long id list so an "in (...)" filter stays within URL limits. */
function chunks<T>(items: T[], size = 150): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

/** Customers and manufacturers: everyone who can have a Party Ledger. */
export async function loadParties(): Promise<PartyInfo[]> {
  type ProfileRow = {
    id: string; role: string; company_name: string | null; first_name: string | null; last_name: string | null;
    email: string | null; gstin: string | null; state: string | null; credit_days: number | null;
  };
  let data: ProfileRow[];
  try {
    data = await selectAll<ProfileRow>(
      (from, to) => createAdminClient()
        .from("profiles" as never)
        .select("id, role, company_name, first_name, last_name, email, gstin, state, credit_days")
        .in("role", ["customer", "manufacturer"])
        .order("id", { ascending: true })
        .range(from, to),
      "loadParties"
    );
  } catch {
    return [];
  }
  return data
    .map((p) => ({
      id: p.id,
      name: partyName(p),
      role: p.role as "customer" | "manufacturer",
      email: p.email ?? null,
      gstin: p.gstin || null,
      state: p.state && p.state !== "-" ? p.state : null,
      credit_days: Number(p.credit_days ?? 30) || 30,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** The whole chart of accounts, by code. Throws a clear message when the migration is missing. */
export async function loadAccounts(): Promise<LedgerAccount[]> {
  const { data, error } = await createAdminClient()
    .from("ledger_accounts" as never)
    .select("*")
    .order("code", { ascending: true });
  if (error) {
    if (isMissingTable(error)) throw new Error(LEDGER_MIGRATION_HINT);
    throw new Error(`Accounts could not be loaded: ${error.message}`);
  }
  return (data as unknown as LedgerAccount[]) ?? [];
}

export type MoneyAccount = Pick<LedgerAccount, "id" | "name" | "kind" | "is_default" | "bank_name" | "account_no" | "ifsc" | "branch" | "account_holder" | "active">;

/** Active bank and cash accounts for payment forms, default first. Empty before the ledger migration. */
export async function loadMoneyAccounts(): Promise<MoneyAccount[]> {
  const { data, error } = await createAdminClient()
    .from("ledger_accounts" as never)
    .select("id, name, kind, is_default, bank_name, account_no, ifsc, branch, account_holder, active")
    .in("kind", ["bank", "cash"])
    .eq("active", true)
    .order("code", { ascending: true });
  if (error) {
    if (!isMissingTable(error)) console.error("[loadMoneyAccounts]", error.code, error.message);
    return [];
  }
  return ((data as unknown as MoneyAccount[]) ?? []).sort((a, b) => Number(b.is_default) - Number(a.is_default));
}

export interface PartyLedgerTotals {
  opening: number;
  debit: number;
  credit: number;
  closing: number;
}

const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

/** Opening / debit / credit / closing per party (receivable and payable accounts), plus lines with no party. */
export async function partyTotals(from: string, to: string, accounts: LedgerAccount[]) {
  const res = await ledgerBalances(from, to);
  if (res.error) throw new Error(isMissingTable({ code: res.error.code }) ? LEDGER_MIGRATION_HINT : "Balances could not be loaded.");
  const partyAccounts = new Set(accounts.filter((a) => a.kind === "receivable" || a.kind === "payable").map((a) => a.id));
  const byParty = new Map<string, PartyLedgerTotals>();
  let unlinked: PartyLedgerTotals | null = null;
  for (const row of res.data) {
    if (!partyAccounts.has(row.account_id)) continue;
    const t: PartyLedgerTotals = (row.party_id ? byParty.get(row.party_id) : unlinked) ?? { opening: 0, debit: 0, credit: 0, closing: 0 };
    t.opening = r2(t.opening + row.opening);
    t.debit = r2(t.debit + row.debit);
    t.credit = r2(t.credit + row.credit);
    t.closing = r2(t.opening + t.debit - t.credit);
    if (row.party_id) byParty.set(row.party_id, t);
    else unlinked = t;
  }
  if (unlinked && unlinked.opening === 0 && unlinked.debit === 0 && unlinked.credit === 0) unlinked = null;
  return { byParty, unlinked };
}

export async function ageingByParty(asOf: string): Promise<Map<string, AgeingRow>> {
  const res = await ledgerReceivableAgeing(asOf);
  if (res.error) {
    console.error("[ageingByParty]", res.error.raw);
    return new Map();
  }
  return new Map(res.data.map((r) => [r.party_id, r]));
}

export async function reportLines(args: Parameters<typeof ledgerReportLines>[0]): Promise<ReportLine[]> {
  const res = await ledgerReportLines(args);
  if (res.error) throw new Error(isMissingTable({ code: res.error.code }) ? LEDGER_MIGRATION_HINT : "Ledger lines could not be loaded.");
  return res.data;
}

// ---- Tally export ----------------------------------------------------------------------------------

/** Tally ledger name for every account and every party, unique across both. */
async function tallyNames(accounts: LedgerAccount[]) {
  const parties = await loadParties();
  const accountNames = new Map(accounts.map((a) => [a.id, (a.tally_name || a.name).trim()]));
  const partyNames = uniqueTallyNames(
    parties.map((p) => ({ preferred: p.name, suffix: p.email || p.id.slice(0, 8) })),
    accountNames.values()
  );
  return { parties, accountNames, partyNames: new Map(parties.map((p, i) => [p.id, partyNames[i]])) };
}

/** Ledger masters: every account that is a Tally ledger of its own, and every party with entries. */
export async function buildTallyMasters(): Promise<TallyLedger[]> {
  const accounts = await loadAccounts();
  const { parties, accountNames, partyNames } = await tallyNames(accounts);
  // One row per account and party that has ever been posted to.
  const used = await ledgerBalances("2000-01-01", "2999-12-31");
  if (used.error) throw new Error("Ledger usage could not be loaded.");
  const usedRows = used.data;
  const usedParties = new Set(usedRows.map((r) => r.party_id).filter(Boolean) as string[]);
  // A customers / manufacturers control account is a ledger in Tally only when it has lines with no party.
  const unlinkedAccounts = new Set(usedRows.filter((r) => !r.party_id).map((r) => r.account_id));

  const ledgers: TallyLedger[] = [];
  for (const a of accounts) {
    if ((a.kind === "receivable" || a.kind === "payable") && !unlinkedAccounts.has(a.id)) continue;
    // Tally already has a "Cash" ledger in every company.
    if ((accountNames.get(a.id) ?? "").toLowerCase() === "cash") continue;
    if (!a.active && !unlinkedAccounts.has(a.id) && !usedRows.some((r) => r.account_id === a.id)) continue;
    ledgers.push({ name: accountNames.get(a.id)!, parent: a.tally_group, gstDutyHead: gstDutyHead(a.system_key) });
  }
  for (const p of parties) {
    if (!usedParties.has(p.id)) continue;
    ledgers.push({
      name: partyNames.get(p.id)!,
      parent: p.role === "customer" ? "Sundry Debtors" : "Sundry Creditors",
      isParty: true,
      gstin: p.gstin,
      state: p.state,
    });
  }
  return ledgers;
}

/**
 * Live vouchers dated in the range (cancelled and replaced entries are left out; an edited document
 * goes as its latest version under the same id, so Tally replaces it). Also lists documents that
 * were cancelled here, so they can be cancelled in Tally by hand.
 */
export async function buildTallyVouchers(from: string, to: string) {
  const accounts = await loadAccounts();
  const { accountNames, partyNames } = await tallyNames(accounts);
  const all = await reportLines({ from, to, showReversed: true });
  const lines = all.filter((l) => !l.is_reversal && !l.reversed);
  const kindById = new Map(accounts.map((a) => [a.id, a.kind]));

  const vouchers = new Map<string, TallyVoucher>();
  for (const l of lines) {
    let v = vouchers.get(l.entry_id);
    if (!v) {
      v = {
        remoteId: `sojar-${l.voucher_type}-${l.source_id ?? l.entry_id}`,
        type: l.voucher_type,
        date: l.entry_date,
        number: l.voucher_number,
        narration: l.narration,
        lines: [],
      };
      vouchers.set(l.entry_id, v);
    }
    const kind = kindById.get(l.account_id);
    v.lines.push({
      // A line with no party on a customers / manufacturers account goes to that account's own ledger.
      ledger: (l.party_id && partyNames.get(l.party_id)) || accountNames.get(l.account_id) || l.account_name,
      amount: l.debit - l.credit,
      isParty: kind === "receivable" || kind === "payable",
      billRef: l.bill_ref,
      billType: l.bill_type,
    });
  }

  // Documents cancelled in the range: reversed entries whose document has no live entry anywhere
  // (an edited document has one, so it is not listed: it goes out as its new version).
  const reversed = new Map<string, { type: VoucherType; number: string; date: string; source: string | null }>();
  for (const l of all) {
    if (l.is_reversal || !l.reversed) continue;
    reversed.set(`${l.voucher_type}:${l.source_id ?? l.entry_id}`, { type: l.voucher_type, number: l.voucher_number, date: l.entry_date, source: l.source_id });
  }
  const sources = [...new Set([...reversed.values()].map((e) => e.source).filter(Boolean) as string[])];
  const liveSources = new Set<string>();
  for (const ids of chunks(sources)) {
    const rows = await selectAll<{ voucher_type: string; source_id: string }>(
      (f, t) => createAdminClient()
        .from("ledger_entries" as never)
        .select("voucher_type, source_id")
        .in("source_id", ids)
        .eq("is_reversal", false)
        .is("reversed_by", null)
        .range(f, t),
      "Live entries"
    );
    for (const r of rows) liveSources.add(`${r.voucher_type}:${r.source_id}`);
  }
  const cancelled = [...reversed.values()]
    .filter((e) => !e.source || !liveSources.has(`${e.type}:${e.source}`))
    .map(({ type, number, date }) => ({ type, number, date }));

  return { vouchers: [...vouchers.values()], cancelled };
}

// ---- Party statement -----------------------------------------------------------------------------

export interface PendingBill {
  id: string;
  kind: "invoice" | "debit_note";
  number: string;
  date: string;
  total: number;
  balance: number;
  days: number;
}

export interface PartyStatement {
  range: LedgerRange;
  /** null for the "no party" pseudo-party. */
  party: PartyInfo | null;
  totals: PartyLedgerTotals;
  lines: ReportLine[];
  ageing: { due: number; d0_30: number; d31_60: number; d61_90: number; d90_plus: number; overdue: number } | null;
  /** Customers: invoices and debit notes with money still due in Payments Received. */
  pendingBills: PendingBill[];
  error: string | null;
}

/** Invoices and debit notes of a customer that still have a balance in Payments Received, oldest first. */
async function pendingBillsOf(partyId: string): Promise<PendingBill[]> {
  const db = createAdminClient();
  type Inv = { id: string; invoice_number: string; invoice_date: string; total_amount: number | string };
  type Dn = { id: string; debit_note_number: string; debit_note_date: string; total_amount: number | string };
  const [invoices, notes] = await Promise.all([
    selectAll<Inv>((f, t) => db.from("invoices").select("id, invoice_number, invoice_date, total_amount").eq("user_id", partyId).eq("status", "issued").order("id").range(f, t), "Invoices"),
    // Before the debit note migration the table is missing: no notes.
    selectAll<Dn>((f, t) => db.from("debit_notes" as never).select("id, debit_note_number, debit_note_date, total_amount").eq("user_id", partyId).eq("status", "issued").order("id").range(f, t), "Debit notes").catch(() => [] as Dn[]),
  ]);
  const invBal = new Map<string, number>();
  for (const ids of chunks(invoices.map((i) => i.id))) {
    const { data } = await db.from("invoice_payment_summary" as never).select("invoice_id, balance").in("invoice_id", ids);
    for (const x of (data as unknown as { invoice_id: string; balance: number | string }[] | null) ?? []) invBal.set(x.invoice_id, Number(x.balance));
  }
  const dnBal = new Map<string, number>();
  for (const ids of chunks(notes.map((d) => d.id))) {
    const { data } = await db.from("debit_note_payment_summary" as never).select("debit_note_id, balance").in("debit_note_id", ids);
    for (const x of (data as unknown as { debit_note_id: string; balance: number | string }[] | null) ?? []) dnBal.set(x.debit_note_id, Number(x.balance));
  }
  const today = new Date(`${todayIst()}T00:00:00Z`).getTime();
  const days = (d: string) => Math.max(0, Math.round((today - new Date(`${d}T00:00:00Z`).getTime()) / 86400000));
  return [
    ...invoices.map((i) => ({
      id: i.id, kind: "invoice" as const, number: i.invoice_number, date: i.invoice_date, total: Number(i.total_amount),
      balance: invBal.get(i.id) ?? Number(i.total_amount), days: days(i.invoice_date),
    })),
    ...notes.map((d) => ({
      id: d.id, kind: "debit_note" as const, number: d.debit_note_number, date: d.debit_note_date, total: Number(d.total_amount),
      balance: dnBal.get(d.id) ?? Number(d.total_amount), days: days(d.debit_note_date),
    })),
  ]
    .filter((b) => b.balance > 0)
    .sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * A party's statement for the range: opening, every line with a running balance, closing, ageing and
 * pending bills. Callers authorise first (admin, or the customer for their own id).
 * partyId "unlinked" = lines on the customers / manufacturers accounts with no party.
 */
export async function buildStatement(partyId: string | "unlinked", range: LedgerRange, showReversed: boolean, party: PartyInfo | null): Promise<PartyStatement> {
  const empty = { opening: 0, debit: 0, credit: 0, closing: 0 };
  const accounts = await loadAccounts();
  const unlinked = partyId === "unlinked";
  const [totals, lines, ageing, pendingBills] = await Promise.all([
    partyTotals(range.from, range.to, accounts),
    reportLines({ from: range.from, to: range.to, partyId: unlinked ? null : partyId, unlinked, showReversed }),
    party?.role === "customer" ? ageingByParty(range.to) : Promise.resolve(new Map<string, AgeingRow>()),
    party?.role === "customer" ? pendingBillsOf(party.id) : Promise.resolve([] as PendingBill[]),
  ]);
  const t = unlinked ? totals.unlinked ?? empty : totals.byParty.get(partyId) ?? empty;
  const a = party ? ageing.get(party.id) : undefined;
  return {
    range,
    party,
    totals: t,
    lines,
    ageing: a ? { due: a.due, d0_30: a.d0_30, d31_60: a.d31_60, d61_90: a.d61_90, d90_plus: a.d90_plus, overdue: a.overdue } : null,
    pendingBills,
    error: null,
  };
}

