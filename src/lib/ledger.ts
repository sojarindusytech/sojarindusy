/**
 * General Ledger / Party Ledger: labels, report maths and the Tally export, shared by the
 * server actions, the admin screens and the PDF. Pure (no I/O) so it is unit-tested; the
 * postings themselves are made by the database (supabase/migrations/20261024_ledger.sql).
 */
import type { LedgerAccount, LedgerAccountKind, LedgerAccountType } from "@/types/database.types";

export type VoucherType = "invoice" | "credit_note" | "debit_note" | "receipt" | "supplier_payment" | "journal" | "opening";
export type BillType = "new" | "against" | "advance" | "on_account";

export const VOUCHER_LABELS: Record<VoucherType, string> = {
  invoice: "Invoice",
  credit_note: "Credit Note",
  debit_note: "Debit Note",
  receipt: "Receipt",
  supplier_payment: "Payment Made",
  journal: "Journal",
  opening: "Opening Balance",
};

export const ACCOUNT_TYPE_LABELS: Record<LedgerAccountType, string> = {
  asset: "Asset",
  liability: "Liability",
  equity: "Equity",
  income: "Income",
  expense: "Expense",
};

export const ACCOUNT_KIND_LABELS: Record<LedgerAccountKind, string> = {
  general: "General",
  receivable: "Customers",
  payable: "Manufacturers",
  bank: "Bank",
  cash: "Cash",
};

/** Tally's built-in groups, for the "Tally group" of an account (the parent of its ledger in Tally). */
export const TALLY_GROUPS = [
  "Bank Accounts", "Capital Account", "Cash-in-Hand", "Current Assets", "Current Liabilities", "Deposits (Asset)",
  "Direct Expenses", "Direct Incomes", "Duties & Taxes", "Fixed Assets", "Indirect Expenses", "Indirect Incomes",
  "Investments", "Loans & Advances (Asset)", "Loans (Liability)", "Provisions", "Purchase Accounts", "Reserves & Surplus",
  "Sales Accounts", "Secured Loans", "Stock-in-Hand", "Sundry Creditors", "Sundry Debtors", "Suspense A/c", "Unsecured Loans",
] as const;

/** The Tally group a new account of this type starts with. */
export const DEFAULT_TALLY_GROUP: Record<LedgerAccountType, string> = {
  asset: "Current Assets",
  liability: "Current Liabilities",
  equity: "Capital Account",
  income: "Indirect Incomes",
  expense: "Indirect Expenses",
};

// ---- Dates ---------------------------------------------------------------------------------------

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

/** Today in India as YYYY-MM-DD. */
export function todayIst(now: Date = new Date()): string {
  return new Date(now.getTime() + IST_OFFSET_MS).toISOString().slice(0, 10);
}

/** The April-to-March financial year containing `date` (YYYY-MM-DD, default today in India). */
export function financialYearRange(date: string = todayIst()): { from: string; to: string; label: string } {
  const [y, m] = date.split("-").map(Number);
  const start = m < 4 ? y - 1 : y;
  return { from: `${start}-04-01`, to: `${start + 1}-03-31`, label: `FY ${start}-${String((start + 1) % 100).padStart(2, "0")}` };
}

/** Date-range shortcuts for the ledger screens. */
export function ledgerRangePresets(today: string = todayIst()) {
  const fy = financialYearRange(today);
  const lastFy = financialYearRange(`${Number(fy.from.slice(0, 4)) - 1}-06-01`);
  const monthStart = `${today.slice(0, 8)}01`;
  const prevMonthEnd = new Date(`${monthStart}T00:00:00Z`);
  prevMonthEnd.setUTCDate(0);
  const prevMonthTo = prevMonthEnd.toISOString().slice(0, 10);
  return [
    { key: "fy", label: `This year (${fy.label})`, from: fy.from, to: today < fy.to ? today : fy.to },
    { key: "last_fy", label: `Last year (${lastFy.label})`, from: lastFy.from, to: lastFy.to },
    { key: "month", label: "This month", from: monthStart, to: today },
    { key: "last_month", label: "Last month", from: `${prevMonthTo.slice(0, 8)}01`, to: prevMonthTo },
  ];
}

export const isIsoDate = (v: unknown): v is string => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v));

/** "2026-10-03" -> "03-10-2026". */
export const fmtDate = (iso: string) => iso.split("-").reverse().join("-");

// ---- Money ---------------------------------------------------------------------------------------

export const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

export const inr = (n: number) => `₹${round2(n).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/** Plain amount without the rupee sign (PDF body font has no ₹ glyph). */
export const amount = (n: number) => round2(n).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** A signed balance (debit positive) as an absolute amount and its side: 1180 -> "1,180.00 Dr". */
export function drCr(balance: number): { amount: string; side: "Dr" | "Cr" | "" } {
  const b = round2(balance);
  return { amount: amount(Math.abs(b)), side: b > 0 ? "Dr" : b < 0 ? "Cr" : "" };
}

export const drCrText = (balance: number) => {
  const { amount: a, side } = drCr(balance);
  return side ? `${a} ${side}` : a;
};

// ---- Reports -------------------------------------------------------------------------------------

/** One row of public.ledger_balances: per account (and party), before the range and within it. */
export interface BalanceRow {
  account_id: string;
  party_id: string | null;
  opening: number;
  debit: number;
  credit: number;
}

/** One row of public.ledger_report_lines. */
export interface ReportLine {
  line_id: string;
  entry_id: string;
  entry_seq: number;
  line_no: number;
  entry_date: string;
  voucher_type: VoucherType;
  voucher_number: string;
  source_id: string | null;
  is_reversal: boolean;
  reversed: boolean;
  narration: string | null;
  line_narration: string | null;
  account_id: string;
  account_code: string;
  account_name: string;
  party_id: string | null;
  debit: number;
  credit: number;
  bill_ref: string | null;
  bill_type: BillType | null;
  balance: number;
}

export interface AccountTotals {
  account: Pick<LedgerAccount, "id" | "code" | "name" | "type" | "kind">;
  opening: number;
  debit: number;
  credit: number;
  closing: number;
}

type AccountMeta = Pick<LedgerAccount, "id" | "code" | "name" | "type" | "kind">;

/** Balances per account (parties summed), every account that has a balance or movement, by code. */
export function accountTotals(accounts: AccountMeta[], rows: BalanceRow[]): AccountTotals[] {
  const byId = new Map<string, AccountTotals>();
  for (const a of accounts) byId.set(a.id, { account: a, opening: 0, debit: 0, credit: 0, closing: 0 });
  for (const r of rows) {
    const t = byId.get(r.account_id);
    if (!t) continue;
    t.opening += Number(r.opening);
    t.debit += Number(r.debit);
    t.credit += Number(r.credit);
  }
  return [...byId.values()]
    .map((t) => ({ ...t, opening: round2(t.opening), debit: round2(t.debit), credit: round2(t.credit), closing: round2(t.opening + t.debit - t.credit) }))
    .filter((t) => t.opening !== 0 || t.debit !== 0 || t.credit !== 0)
    .sort((a, b) => a.account.code.localeCompare(b.account.code));
}

/** Trial Balance: each account's closing balance on its side. The two totals always match. */
export function trialBalance(totals: AccountTotals[]) {
  const rows = totals.filter((t) => t.closing !== 0).map((t) => ({
    account: t.account,
    debit: t.closing > 0 ? t.closing : 0,
    credit: t.closing < 0 ? -t.closing : 0,
  }));
  return {
    rows,
    debit: round2(rows.reduce((s, r) => s + r.debit, 0)),
    credit: round2(rows.reduce((s, r) => s + r.credit, 0)),
  };
}

/** Profit & Loss for the range: income earned and expenses incurred within it. */
export function profitAndLoss(totals: AccountTotals[]) {
  const movement = (t: AccountTotals) => round2(t.debit - t.credit);
  const income = totals.filter((t) => t.account.type === "income" && movement(t) !== 0)
    .map((t) => ({ account: t.account, amount: -movement(t) }));
  const expense = totals.filter((t) => t.account.type === "expense" && movement(t) !== 0)
    .map((t) => ({ account: t.account, amount: movement(t) }));
  const totalIncome = round2(income.reduce((s, r) => s + r.amount, 0));
  const totalExpense = round2(expense.reduce((s, r) => s + r.amount, 0));
  return { income, expense, totalIncome, totalExpense, net: round2(totalIncome - totalExpense) };
}

/**
 * Balance Sheet on the last day of the range. Profit or loss to date (all income and expense
 * ever posted, there being no year-end closing entry) is shown under equity, so assets always
 * equal liabilities + equity.
 */
export function balanceSheet(totals: AccountTotals[]) {
  const pick = (type: LedgerAccountType, sign: 1 | -1) =>
    totals.filter((t) => t.account.type === type && t.closing !== 0).map((t) => ({ account: t.account, amount: round2(sign * t.closing) }));
  const assets = pick("asset", 1);
  const liabilities = pick("liability", -1);
  const equity = pick("equity", -1);
  const profit = round2(-totals.filter((t) => t.account.type === "income" || t.account.type === "expense")
    .reduce((s, t) => s + t.closing, 0));
  const sum = (rows: { amount: number }[]) => round2(rows.reduce((s, r) => s + r.amount, 0));
  const totalAssets = sum(assets);
  const totalLiabilities = round2(sum(liabilities) + sum(equity) + profit);
  return { assets, liabilities, equity, profit, totalAssets, totalLiabilities };
}

/** Report lines grouped into their vouchers (Day Book), in posting order. */
export function groupByEntry(lines: ReportLine[]) {
  const groups = new Map<string, { entry_id: string; entry_date: string; voucher_type: VoucherType; voucher_number: string; narration: string | null; is_reversal: boolean; reversed: boolean; lines: ReportLine[] }>();
  for (const l of lines) {
    let g = groups.get(l.entry_id);
    if (!g) {
      g = { entry_id: l.entry_id, entry_date: l.entry_date, voucher_type: l.voucher_type, voucher_number: l.voucher_number, narration: l.narration, is_reversal: l.is_reversal, reversed: l.reversed, lines: [] };
      groups.set(l.entry_id, g);
    }
    g.lines.push(l);
  }
  return [...groups.values()];
}

/** Where a document number on a statement line opens its PDF (null for vouchers with no PDF). */
export function documentPdfHref(type: VoucherType, sourceId: string | null): string | null {
  if (!sourceId) return null;
  switch (type) {
    case "invoice": return `/api/invoices/${sourceId}/pdf`;
    case "credit_note": return `/api/credit-notes/${sourceId}/pdf`;
    case "debit_note": return `/api/debit-notes/${sourceId}/pdf`;
    case "receipt": return `/api/payments/${sourceId}/pdf`;
    default: return null;
  }
}

// ---- Tally export -----------------------------------------------------------------------------------

/** Tally voucher type for each of our vouchers (Tally's built-in voucher types). */
export const TALLY_VOUCHER_TYPES: Record<VoucherType, string> = {
  invoice: "Sales",
  credit_note: "Credit Note",
  debit_note: "Debit Note",
  receipt: "Receipt",
  supplier_payment: "Payment",
  journal: "Journal",
  opening: "Journal",
};

const TALLY_BILL_TYPES: Record<BillType, string> = {
  new: "New Ref",
  against: "Agst Ref",
  advance: "Advance",
  on_account: "On Account",
};

export interface TallyVoucherLine {
  /** Tally ledger name (an account's Tally name, or the party's name). */
  ledger: string;
  /** Positive = debit, negative = credit. */
  amount: number;
  isParty: boolean;
  billRef?: string | null;
  billType?: BillType | null;
}

export interface TallyVoucher {
  /** Stable id: importing the same voucher again replaces it in Tally instead of adding a copy. */
  remoteId: string;
  type: VoucherType;
  date: string;
  number: string;
  narration: string | null;
  lines: TallyVoucherLine[];
}

export interface TallyLedger {
  name: string;
  parent: string;
  isParty?: boolean;
  gstin?: string | null;
  state?: string | null;
  /** GST ledgers under Duties & Taxes: Central Tax, State Tax or Integrated Tax. */
  gstDutyHead?: string | null;
}

export const xmlEscape = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;")
    // Control characters are not allowed in XML 1.0.
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "");

const tallyDate = (iso: string) => iso.replace(/-/g, "");
/** Tally signs: a debit is a negative amount with ISDEEMEDPOSITIVE Yes, a credit positive with No. */
const tallyAmount = (debitPositive: number) => (-round2(debitPositive)).toFixed(2);

function envelope(report: "All Masters" | "Vouchers", company: string | null | undefined, body: string): string {
  const vars = company && company.trim()
    ? `<STATICVARIABLES><SVCURRENTCOMPANY>${xmlEscape(company.trim())}</SVCURRENTCOMPANY></STATICVARIABLES>`
    : "";
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    "<ENVELOPE>",
    "<HEADER><TALLYREQUEST>Import Data</TALLYREQUEST></HEADER>",
    "<BODY><IMPORTDATA>",
    `<REQUESTDESC><REPORTNAME>${report}</REPORTNAME>${vars}</REQUESTDESC>`,
    "<REQUESTDATA>",
    body,
    "</REQUESTDATA>",
    "</IMPORTDATA></BODY>",
    "</ENVELOPE>",
    "",
  ].join("\n");
}

/** Ledger masters (accounts and parties) for Tally's Import Data > Masters. */
export function tallyMastersXml(ledgers: TallyLedger[], company?: string | null): string {
  const body = ledgers.map((l) => {
    const parts = [
      `<LEDGER NAME="${xmlEscape(l.name)}" ACTION="Create">`,
      `<NAME.LIST TYPE="String"><NAME>${xmlEscape(l.name)}</NAME></NAME.LIST>`,
      `<PARENT>${xmlEscape(l.parent)}</PARENT>`,
    ];
    if (l.isParty) parts.push("<ISBILLWISEON>Yes</ISBILLWISEON>");
    if (l.gstin) parts.push(`<GSTREGISTRATIONTYPE>Regular</GSTREGISTRATIONTYPE><PARTYGSTIN>${xmlEscape(l.gstin)}</PARTYGSTIN>`);
    if (l.state) parts.push(`<LEDSTATENAME>${xmlEscape(l.state)}</LEDSTATENAME>`);
    if (l.gstDutyHead) parts.push(`<TAXTYPE>GST</TAXTYPE><GSTDUTYHEAD>${xmlEscape(l.gstDutyHead)}</GSTDUTYHEAD>`);
    parts.push("</LEDGER>");
    return `<TALLYMESSAGE xmlns:UDF="TallyUDF">${parts.join("")}</TALLYMESSAGE>`;
  });
  return envelope("All Masters", company, body.join("\n"));
}

/**
 * Accounting vouchers for Tally's Import Data > Vouchers. Lines on the same ledger are merged
 * into one entry (Tally keeps one entry per ledger) with one bill allocation per bill.
 */
export function tallyVouchersXml(vouchers: TallyVoucher[], company?: string | null): string {
  const body = vouchers.map((v) => {
    const type = TALLY_VOUCHER_TYPES[v.type];
    const merged = new Map<string, { ledger: string; amount: number; isParty: boolean; bills: { name: string; type: string; amount: number }[] }>();
    for (const l of v.lines) {
      const m = merged.get(l.ledger) ?? { ledger: l.ledger, amount: 0, isParty: l.isParty, bills: [] };
      m.amount = round2(m.amount + l.amount);
      if (l.isParty) {
        const billType = l.billType && (l.billType === "on_account" || l.billRef || l.billType === "advance") ? l.billType : "on_account";
        const name = billType === "on_account" ? "" : (l.billRef || v.number);
        const existing = m.bills.find((b) => b.name === name && b.type === TALLY_BILL_TYPES[billType]);
        if (existing) existing.amount = round2(existing.amount + l.amount);
        else m.bills.push({ name, type: TALLY_BILL_TYPES[billType], amount: l.amount });
      }
      merged.set(l.ledger, m);
    }
    const entries = [...merged.values()].filter((m) => m.amount !== 0);
    const party = entries.find((m) => m.isParty);
    const lines = entries.map((m) => {
      const bills = m.isParty
        ? m.bills.filter((b) => b.amount !== 0).map((b) =>
            `<BILLALLOCATIONS.LIST>${b.name ? `<NAME>${xmlEscape(b.name)}</NAME>` : ""}<BILLTYPE>${b.type}</BILLTYPE><AMOUNT>${tallyAmount(b.amount)}</AMOUNT></BILLALLOCATIONS.LIST>`).join("")
        : "";
      return `<LEDGERENTRIES.LIST><LEDGERNAME>${xmlEscape(m.ledger)}</LEDGERNAME>`
        + `<ISDEEMEDPOSITIVE>${m.amount > 0 ? "Yes" : "No"}</ISDEEMEDPOSITIVE>`
        + `<ISPARTYLEDGER>${m.isParty ? "Yes" : "No"}</ISPARTYLEDGER>`
        + `<AMOUNT>${tallyAmount(m.amount)}</AMOUNT>${bills}</LEDGERENTRIES.LIST>`;
    });
    return `<TALLYMESSAGE xmlns:UDF="TallyUDF">`
      + `<VOUCHER REMOTEID="${xmlEscape(v.remoteId)}" VCHTYPE="${type}" ACTION="Create" OBJVIEW="Accounting Voucher View">`
      + `<DATE>${tallyDate(v.date)}</DATE><EFFECTIVEDATE>${tallyDate(v.date)}</EFFECTIVEDATE>`
      + `<VOUCHERTYPENAME>${type}</VOUCHERTYPENAME><VOUCHERNUMBER>${xmlEscape(v.number)}</VOUCHERNUMBER>`
      + (party ? `<PARTYLEDGERNAME>${xmlEscape(party.ledger)}</PARTYLEDGERNAME>` : "")
      + (v.narration ? `<NARRATION>${xmlEscape(v.narration)}</NARRATION>` : "")
      + `<PERSISTEDVIEW>Accounting Voucher View</PERSISTEDVIEW><ISINVOICE>No</ISINVOICE>`
      + lines.join("")
      + `</VOUCHER></TALLYMESSAGE>`;
  });
  return envelope("Vouchers", company, body.join("\n"));
}

/**
 * Tally ledger names must be unique. Give each item its preferred name, adding a suffix
 * (e.g. the email) when another item already took it. Returns names in input order.
 */
export function uniqueTallyNames(items: { preferred: string; suffix: string }[], taken: Iterable<string> = []): string[] {
  const used = new Set([...taken].map((n) => n.toLowerCase()));
  return items.map(({ preferred, suffix }) => {
    const base = preferred.trim() || suffix;
    let name = base;
    if (used.has(name.toLowerCase())) name = `${base} (${suffix})`;
    for (let i = 2; used.has(name.toLowerCase()); i++) name = `${base} (${suffix} ${i})`;
    used.add(name.toLowerCase());
    return name;
  });
}

/** GST duty head of a GST ledger, from its system key. */
export function gstDutyHead(systemKey: string | null): string | null {
  if (!systemKey) return null;
  if (/_cgst$/.test(systemKey)) return "Central Tax";
  if (/_sgst$/.test(systemKey)) return "State Tax";
  if (/_igst$/.test(systemKey)) return "Integrated Tax";
  return null;
}

/** Display name of a party from its profile. */
export function partyName(p: { company_name?: string | null; first_name?: string | null; last_name?: string | null; email?: string | null }): string {
  const clean = (v?: string | null) => (v && v.trim() && v.trim() !== "-" ? v.trim() : "");
  return clean(p.company_name) || [clean(p.first_name), clean(p.last_name)].filter(Boolean).join(" ") || clean(p.email) || "Unnamed party";
}

/** A free account code for a new account: bank / cash in the 12xx range, others after the system accounts of their type. */
export function suggestAccountCode(existing: string[], type: LedgerAccountType, kind: "general" | "bank" | "cash"): string {
  const starts: Record<LedgerAccountType, number> = { asset: 1500, liability: 2200, equity: 3200, income: 4200, expense: 5400 };
  const taken = new Set(existing);
  let code = kind === "general" ? starts[type] : 1210;
  while (taken.has(String(code))) code++;
  return String(code);
}
