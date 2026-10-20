import type { SalesSettings } from "@/types/database.types";

export type TermsDocument = "invoice" | "quote" | "receipt" | "credit_note" | "debit_note";

/**
 * Terms & conditions text for a document. Invoices use `terms`; quotations and debit notes use their
 * own (`quote_terms`, `debit_note_terms`) and fall back to the invoice terms while blank; receipts
 * and credit notes print only their own configured text.
 */
export function documentTerms(
  settings: Pick<SalesSettings, "terms"> & {
    quote_terms?: string | null;
    receipt_terms?: string | null;
    credit_note_terms?: string | null;
    debit_note_terms?: string | null;
  },
  doc: TermsDocument
): string {
  const pick = (v: string | null | undefined) => (v ?? "").trim();
  if (doc === "quote") return pick(settings.quote_terms) || pick(settings.terms);
  if (doc === "credit_note") return pick(settings.credit_note_terms);
  if (doc === "debit_note") return pick(settings.debit_note_terms) || pick(settings.terms);
  if (doc === "receipt") return pick(settings.receipt_terms);
  return pick(settings.terms);
}

/** Blank-line separated paragraphs, empties dropped. */
export function termsParagraphs(text: string): string[] {
  return text.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
}
