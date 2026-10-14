import type { DebitNoteReason } from "@/types/database.types";

/**
 * GST debit note rules shared by the forms, the server and the PDF.
 *
 * A debit note (CGST Act s.34(3)) is issued to the customer when an invoice
 * charged less than was due. Rule 53(1A): its number is at most 16 characters
 * of letters, digits, "-" and "/", unique in the financial year, and it quotes
 * the original invoice's number and date.
 */

export const DEBIT_NOTE_REASONS: { value: DebitNoteReason; label: string; hint: string }[] = [
  { value: "price_increase", label: "Price revised upward", hint: "Enter the extra amount per unit as the rate." },
  { value: "quantity_short_billed", label: "Quantity short-billed", hint: "Enter the units that were supplied but not billed." },
  { value: "additional_charges", label: "Additional charges", hint: "Freight, packing, handling or other charges not on the invoice." },
  { value: "tax_rate_correction", label: "GST charged too low", hint: "Use the line's value with the difference in GST rate." },
  { value: "other", label: "Other", hint: "Describe the reason in the note." },
];

export function debitNoteReasonLabel(reason: DebitNoteReason): string {
  return DEBIT_NOTE_REASONS.find((r) => r.value === reason)?.label ?? reason;
}

/** GST limit on a debit note's number (Rule 53(1A)(c)). */
export const MAX_DEBIT_NOTE_NUMBER_LENGTH = 16;

/** Letters, digits, "-" and "/" only, 1-16 characters. */
export const DEBIT_NOTE_NUMBER_PATTERN = /^[A-Za-z0-9/-]{1,16}$/;

/** Allowed in the prefix of the auto series (it becomes part of the number). */
export const DEBIT_NOTE_PREFIX_PATTERN = /^[A-Za-z0-9/-]+$/;

/**
 * Length of an auto number "PREFIX/25-26/01" for a prefix and digit count, at
 * its shortest (the counter can only make it longer once it outgrows the digits).
 */
export function debitNoteNumberLength(prefix: string, pad: number): number {
  return prefix.length + "/25-26/".length + Math.max(1, pad);
}
