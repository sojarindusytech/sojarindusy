import { z } from "zod";
import { round2 as invoiceRound, type InvoiceLine, type InvoiceTotals } from "@/lib/invoice";
import type { Invoice, SalesSettings } from "@/types/database.types";

// PostgreSQL numeric rounds ties away from zero, including negative round-off.
const round2 = (value: number) => Math.sign(value) * invoiceRound(Math.abs(value));

export const creditNoteInputSchema = z.object({
  invoiceId: z.uuid(),
  requestId: z.uuid(),
  date: z.iso.date(),
  reason: z.string().trim().min(3, "Enter a reason (at least 3 characters).").max(1000),
  treatment: z.enum(["gst", "commercial"]),
  manualNumber: z.string().trim().regex(/^[A-Za-z0-9/-]{1,16}$/, "Use 1-16 letters, numbers, / or -.").nullable(),
  lines: z.array(z.object({ index: z.number().int().min(0), quantity: z.number().positive().finite() })).min(1).max(500),
});
export type CreditNoteInput = z.infer<typeof creditNoteInputSchema>;
export type CreditLine = InvoiceLine & { sourceIndex: number };
export interface CreditNote {
  id: string;
  credit_note_number: string;
  credit_note_fy: string | null;
  seq: number | null;
  numbering_mode: "auto" | "manual";
  invoice_id: string;
  invoice_number: string;
  invoice_date: string;
  credit_note_date: string;
  user_id: string | null;
  reason: string;
  treatment: "gst" | "commercial";
  bill_to: Invoice["bill_to"];
  place_of_supply: string | null;
  items: CreditLine[];
  totals: InvoiceTotals;
  total_amount: number;
  seller_snapshot: SalesSettings;
  stock_returns?: { variantId: string; sourceIndex: number; creditedQuantity: number; quantity: number }[];
  status: "issued";
  created_at: string;
}

/** Cumulative allocation makes the final partial credit recover rounding remainders. */
export function computeCreditNote(invoice: Invoice, previous: CreditNote[], selections: CreditNoteInput["lines"], treatment: CreditNoteInput["treatment"]) {
  const used = new Map<number, number>();
  for (const note of previous) for (const line of note.items) used.set(line.sourceIndex, (used.get(line.sourceIndex) ?? 0) + line.quantity);
  const seen = new Set<number>();
  const lines: CreditLine[] = selections.map(({ index, quantity }) => {
    const source = invoice.items[index];
    const before = used.get(index) ?? 0;
    if (!source || seen.has(index) || !Number.isFinite(quantity) || quantity <= 0 || before + quantity > source.quantity + 1e-9) {
      throw new Error("Select valid quantities within the remaining invoice quantities.");
    }
    seen.add(index);
    const share = (value: number) => round2(round2(value * (before + quantity) / source.quantity) - round2(value * before / source.quantity));
    const taxable = share(source.taxable), cgst = share(source.cgst), sgst = share(source.sgst), igst = share(source.igst);
    const amount = round2(taxable + cgst + sgst + igst);
    return treatment === "commercial" ? {
      ...source, sourceIndex: index, quantity, unitPrice: amount / quantity, discountPct: 0, discountAmount: 0,
      gstRate: 0, taxable: amount, cgst: 0, sgst: 0, igst: 0, amount,
    } : {
      ...source, sourceIndex: index, quantity, discountAmount: share(source.discountAmount), taxable, cgst, sgst, igst, amount,
    };
  });
  if (!lines.length) throw new Error("Select at least one invoice line.");
  const sum = (key: keyof InvoiceLine) => round2(lines.reduce((n, l) => n + Number(l[key]), 0));
  const subTotal = sum("amount");
  // Allocate invoice round-off cumulatively against the source's unrounded value.
  const priorSubtotal = previous.reduce((n, note) => n + note.totals.subTotal, 0);
  const roundShare = (n: number) => invoice.totals.subTotal ? round2(invoice.totals.roundOff * n / invoice.totals.subTotal) : 0;
  const roundOff = round2(roundShare(priorSubtotal + subTotal) - roundShare(priorSubtotal));
  const taxSummary: InvoiceTotals["taxSummary"] = [];
  for (const line of lines) {
    let row = taxSummary.find((r) => r.rate === line.gstRate);
    if (!row) { row = { rate: line.gstRate, taxable: 0, cgst: 0, sgst: 0, igst: 0 }; taxSummary.push(row); }
    for (const key of ["taxable", "cgst", "sgst", "igst"] as const) row[key] = round2(row[key] + line[key]);
  }
  const totals: InvoiceTotals = {
    quantity: sum("quantity"), discountTotal: sum("discountAmount"), taxableTotal: sum("taxable"),
    cgstTotal: sum("cgst"), sgstTotal: sum("sgst"), igstTotal: sum("igst"),
    subTotal, roundOff, total: round2(subTotal + roundOff), youSaved: 0, taxSummary,
  };
  return { lines, totals };
}
