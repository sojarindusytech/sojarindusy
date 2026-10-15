import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type { DbAppError } from "@/lib/server/db-error";

const fmtDate = (v: unknown) => String(v ?? "").split("-").reverse().join("-");

/** User-facing text for the errors raised by issue_debit_note / cancel_debit_note and the invoice guard. */
export function debitNoteErrorMessage(error: DbAppError): string {
  const d = error.detail;
  switch (error.code) {
    case "INVOICE_NOT_FOUND":
      return "The invoice could not be found. Refresh and try again.";
    case "INVOICE_NOT_ISSUED":
      return `Invoice ${String(d.invoice_number ?? "")} is cancelled, so a debit note can't be issued against it.`;
    case "DEBIT_NOTE_DATE_INVALID":
      return `The debit note date must be between the invoice date (${fmtDate(d.invoice_date)}) and today.`;
    case "REASON_NOTE_REQUIRED":
      return "Describe the reason in a few words.";
    case "TAX_MISMATCH":
      return "The GST on this debit note doesn't match the invoice (GST type or GST billing). Refresh and try again.";
    case "INVALID_NUMBER":
      return "Debit note numbers are up to 16 letters, digits, / and - (GST rule).";
    case "DUPLICATE_DEBIT_NOTE_NUMBER":
      return "That debit note number already exists.";
    case "DEBIT_NOTE_NUMBER_TOO_LONG":
      return `The next number (${String(d.number ?? "")}) would be longer than the 16 characters GST allows. Shorten the debit note prefix in Sales Settings.`;
    case "REQUEST_ID_USED":
      return "This form was already submitted by someone else. Close it and start again.";
    case "REASON_REQUIRED":
      return "Enter a reason (at least 3 characters).";
    case "DEBIT_NOTE_NOT_FOUND":
      return "Debit note not found.";
    case "ADMIN_REQUIRED":
      return "Administrator access required.";
    case "INVOICE_HAS_DEBIT_NOTES":
      return invoiceHasDebitNotesMessage(String(d.debit_notes ?? ""));
    default:
      return "Could not save the debit note. Please check the details and try again.";
  }
}

export function invoiceHasDebitNotesMessage(numbers: string): string {
  return `This invoice has debit note${numbers.includes(",") ? "s" : ""} ${numbers} against it, so it can't be changed or cancelled. Cancel the debit note${numbers.includes(",") ? "s" : ""} first.`;
}

/**
 * Numbers of the issued (not cancelled) debit notes against an invoice. Checked before
 * editing or cancelling an invoice, so a refused change never touches stock first;
 * the database enforces the same rule (guard_invoice_with_debit_notes).
 */
export async function liveDebitNoteNumbers(invoiceId: string): Promise<string[]> {
  const { data, error } = await createAdminClient()
    .from("debit_notes" as never)
    .select("debit_note_number")
    .eq("invoice_id", invoiceId)
    .eq("status", "issued")
    .order("debit_note_number", { ascending: true });
  if (error) {
    // Before the migration the table doesn't exist, so there can be no notes.
    if (error.code === "PGRST205" || error.code === "42P01") return [];
    throw new Error(`Could not check debit notes: ${error.message}`);
  }
  return ((data as unknown as { debit_note_number: string }[]) ?? []).map((r) => r.debit_note_number);
}
