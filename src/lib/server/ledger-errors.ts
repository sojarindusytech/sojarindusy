import "server-only";
import type { DbAppError } from "@/lib/server/db-error";

const fmtDate = (v: unknown) => String(v ?? "").slice(0, 10).split("-").reverse().join("-");
const inr = (n: unknown) => `₹${(Number(n) || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/** "Books are locked up to ..." for any document dated in a closed period. */
export function booksLockedMessage(detail: Record<string, unknown>): string {
  return `The books are locked up to ${fmtDate(detail.locked_until)}, so nothing dated ${fmtDate(detail.date)} can be added, changed or cancelled. Change "Books locked up to" in Sales Settings if this is really needed.`;
}

/**
 * User-facing text for the errors raised by the ledger (20261024_ledger): posting rules, journals,
 * payments made and accounts. Returns null for codes that are not the ledger's, so callers can
 * fall back to their own messages.
 */
export function ledgerErrorMessage(error: DbAppError): string | null {
  const d = error.detail;
  switch (error.code) {
    case "BOOKS_LOCKED":
      return booksLockedMessage(d);
    case "JOURNAL_UNBALANCED":
      return `Debits and credits must be equal. They differ by ${inr(Math.abs(Number(d.difference) || 0))}.`;
    case "LINE_AMOUNT_INVALID":
      return `Enter either a debit or a credit on the ${String(d.account ?? "")} line, not both.`;
    case "PARTY_REQUIRED":
      return `Pick the customer or manufacturer for the ${String(d.account ?? "")} line.`;
    case "PARTY_MISMATCH":
      return `${String(d.account ?? "This account")} needs a ${String(d.account ?? "").toLowerCase().includes("payable") ? "manufacturer" : "customer"} as the party.`;
    case "PARTY_NOT_ALLOWED":
      return `${String(d.account ?? "This account")} doesn't take a party. Use Trade Receivables or Trade Payables for customers and manufacturers.`;
    case "NARRATION_REQUIRED":
      return "Write a short narration (what this entry is for).";
    case "ENTRY_DATE_INVALID":
      return "The date can't be in the future.";
    case "ACCOUNT_NOT_FOUND":
      return "That account no longer exists. Refresh and try again.";
    case "ACCOUNT_INACTIVE":
      return `${String(d.name ?? "That account")} is inactive. Turn it on in the chart of accounts first.`;
    case "ACCOUNT_LOCKED":
      return "System accounts and accounts with entries keep their code and type, and system accounts can't be turned off.";
    case "MANUFACTURER_NOT_FOUND":
      return "Pick a manufacturer.";
    case "ENTRY_NOT_FOUND":
      return "Only journal and opening balance entries can be cancelled here. Cancel invoices, notes and payments from their own pages.";
    case "DUPLICATE_VOUCHER_NUMBER":
      return "Could not find a free voucher number. Check the numbering in Sales Settings.";
    case "LEDGER_UNBALANCED":
    case "LEDGER_INVALID_LINE":
    case "LEDGER_ACCOUNT_MISSING":
      return "The accounting entry for this could not be posted. Please contact support.";
    case "LEDGER_IMMUTABLE":
      return "Posted ledger entries can't be changed. Cancel and post again instead.";
    default:
      return null;
  }
}
