import type { DebitNoteReason } from "@/types/database.types";
import { round2, type InvoiceLine, type InvoiceLineInput } from "@/lib/invoice";

/**
 * GST debit note rules shared by the form (live preview), the server (the
 * lines it actually stores) and the PDF.
 *
 * A debit note (CGST Act s.34(3)) is issued to the customer when an invoice
 * charged less than was due. It carries only the difference, never the whole
 * invoice again. Rule 53(1A): its number is at most 16 characters of letters,
 * digits, "-" and "/", unique in the financial year, and it quotes the
 * original invoice's number and date.
 *
 * How the amount is entered depends on the reason (each reason has one kind of line):
 *   price_increase         rate:     new rate per unit; charged (new - billed) x qty
 *   quantity_short_billed  quantity: units supplied but not billed x rate
 *   additional_charges     charge:   a lump sum (freight, packing...), at the goods' GST rate
 *   tax_rate_correction    tax:      the correct GST rate; only the missing tax, no extra value
 *   other                  custom:   free lines
 */

export type DebitNoteLineKind = "rate" | "quantity" | "charge" | "tax" | "custom";

export const DEBIT_NOTE_REASONS: {
  value: DebitNoteReason;
  label: string;
  kind: DebitNoteLineKind;
  /** One line on how the amount is worked out, shown in the form. */
  formula: string;
}[] = [
  {
    value: "price_increase",
    label: "Price revised upward",
    kind: "rate",
    formula: "Enter the new rate. Charged: (new rate − billed rate) × quantity, plus GST at the invoice's rate.",
  },
  {
    value: "quantity_short_billed",
    label: "Quantity under-billed",
    kind: "quantity",
    formula: "Enter the units supplied but not billed. Charged: extra units × rate, plus GST at the invoice's rate.",
  },
  {
    value: "additional_charges",
    label: "Additional charges",
    kind: "charge",
    formula: "Enter each charge (freight, packing…). Billed with the goods, it takes the goods' GST rate.",
  },
  {
    value: "tax_rate_correction",
    label: "GST charged too low",
    kind: "tax",
    formula: "Pick the correct GST rate. Only the missing tax is charged: the extra taxable value is ₹0.",
  },
  {
    value: "other",
    label: "Other",
    kind: "custom",
    formula: "Enter each line's quantity, rate and GST. Describe the reason in the note.",
  },
];

export function debitNoteReasonLabel(reason: DebitNoteReason): string {
  return DEBIT_NOTE_REASONS.find((r) => r.value === reason)?.label ?? reason;
}

export function lineKindFor(reason: DebitNoteReason): DebitNoteLineKind {
  return DEBIT_NOTE_REASONS.find((r) => r.value === reason)?.kind ?? "custom";
}

/** Common charges billed after the invoice, offered as presets. */
export const DEBIT_NOTE_CHARGE_PRESETS = [
  "Freight charges",
  "Packing & forwarding",
  "Loading & unloading",
  "Transit insurance",
  "Installation charges",
] as const;

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

// ---------------------------------------------------------------------------
// From "what changed" to debit note lines
// ---------------------------------------------------------------------------

/** One entry of the form, by reason. `line` is the index of the invoice line it adjusts. */
export type DebitNoteAdjustment =
  | { kind: "rate"; line: number; quantity: number; newRate: number }
  | { kind: "quantity"; line: number; quantity: number; rate: number }
  | { kind: "charge"; label: string; amount: number; gstRate: number | null; hsn?: string | null }
  | { kind: "tax"; line: number; correctRate: number }
  | {
      kind: "custom";
      name: string;
      description?: string | null;
      hsn?: string | null;
      quantity: number;
      unitPrice: number;
      gstRate: number | null;
    };

/** The parts of the invoice a debit note is built from. */
export interface DebitNoteSourceInvoice {
  gst_enabled: boolean;
  items: InvoiceLine[];
}

const amount = (n: number) => n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
/** For messages shown on screen. */
const rupees = (n: number) => `₹${amount(n)}`;
/** For text printed on the PDF: its body font has no ₹ glyph (only the money columns do). */
const docRupees = (n: number) => `Rs. ${amount(n)}`;
const pct = (n: number) => `${Number.isInteger(n) ? n : n.toFixed(2)}%`;

/** What the customer actually paid per unit on an invoice line (after its discount). */
export function billedRate(line: InvoiceLine): number {
  return line.quantity > 0 ? round2(line.taxable / line.quantity) : 0;
}

/**
 * GST rate of the invoice's main item (largest taxable value). Charges billed
 * with the goods are part of one composite supply and take this rate (CGST Act s.8).
 */
export function principalGstRate(items: InvoiceLine[]): number | null {
  const main = [...items].sort((a, b) => b.taxable - a.taxable)[0];
  return main ? main.gstRate : null;
}

/**
 * Turns the form's entries into debit note lines, using the invoice's own
 * billed rates, quantities and GST rates (never the browser's). Returns the
 * first problem in plain words instead.
 */
export function buildDebitNoteLines(
  invoice: DebitNoteSourceInvoice,
  reason: DebitNoteReason,
  adjustments: DebitNoteAdjustment[]
): { ok: true; lines: InvoiceLineInput[] } | { ok: false; error: string } {
  const kind = lineKindFor(reason);
  const fail = (error: string) => ({ ok: false as const, error });
  if (adjustments.length === 0) return fail("Add at least one line.");

  const usedLines = new Set<number>();
  const invoiceLine = (index: number): { line: InvoiceLine } | { error: string } => {
    const l = Number.isInteger(index) ? invoice.items[index] : undefined;
    if (!l) return { error: "One of the lines no longer matches the invoice. Pick the invoice again." };
    if (usedLines.has(index)) return { error: `${l.name} is added twice.` };
    usedLines.add(index);
    return { line: l };
  };

  const lines: InvoiceLineInput[] = [];
  for (const a of adjustments) {
    if (a.kind !== kind) return fail("These lines don't match the selected reason. Change the reason or the lines.");

    switch (a.kind) {
      case "rate": {
        const r = invoiceLine(a.line);
        if ("error" in r) return fail(r.error);
        const l = r.line;
        const billed = billedRate(l);
        if (!(a.quantity > 0) || a.quantity > l.quantity) {
          return fail(`Quantity for ${l.name} must be between 1 and the ${l.quantity} billed.`);
        }
        const diff = round2(a.newRate - billed);
        if (!(diff > 0)) return fail(`The new rate for ${l.name} must be higher than the billed ${rupees(billed)}.`);
        lines.push({
          name: l.name, sku: l.sku, hsn: l.hsn, unit: l.unit,
          description: `Rate revised from ${docRupees(billed)} to ${docRupees(round2(a.newRate))} per ${l.unit || "unit"}`,
          quantity: a.quantity,
          unitPrice: diff,
          gstRate: l.gstRate,
        });
        break;
      }
      case "quantity": {
        const r = invoiceLine(a.line);
        if ("error" in r) return fail(r.error);
        const l = r.line;
        if (!(a.quantity > 0)) return fail(`Enter the extra quantity for ${l.name}.`);
        if (!(a.rate > 0)) return fail(`Enter the rate for ${l.name}.`);
        lines.push({
          name: l.name, sku: l.sku, hsn: l.hsn, unit: l.unit,
          description: "Supplied but not billed on the invoice",
          quantity: a.quantity,
          unitPrice: round2(a.rate),
          gstRate: l.gstRate,
        });
        break;
      }
      case "charge": {
        const label = a.label.trim();
        if (!label) return fail("Every charge needs a name, e.g. Freight charges.");
        if (!(a.amount > 0)) return fail(`Enter the amount for ${label}.`);
        lines.push({
          name: label,
          hsn: a.hsn?.trim() || null,
          unit: "Nos",
          quantity: 1,
          unitPrice: round2(a.amount),
          gstRate: a.gstRate ?? principalGstRate(invoice.items),
        });
        break;
      }
      case "tax": {
        if (!invoice.gst_enabled) return fail("This invoice was billed without GST, so there is no GST rate to correct.");
        const r = invoiceLine(a.line);
        if ("error" in r) return fail(r.error);
        const l = r.line;
        if (!(a.correctRate > l.gstRate) || a.correctRate > 100) {
          return fail(`The correct GST rate for ${l.name} must be higher than the ${pct(l.gstRate)} charged.`);
        }
        if (!(l.taxable > 0)) return fail(`${l.name} has no taxable value on the invoice.`);
        lines.push({
          name: l.name, sku: l.sku, hsn: l.hsn, unit: l.unit,
          description: `GST corrected from ${pct(l.gstRate)} to ${pct(a.correctRate)} on ${docRupees(l.taxable)}`,
          quantity: l.quantity,
          unitPrice: 0,
          gstRate: a.correctRate,
          taxOnly: { base: l.taxable, chargedRate: l.gstRate },
        });
        break;
      }
      case "custom": {
        const name = a.name.trim();
        if (!name) return fail("Every line needs an item name.");
        if (!(a.quantity > 0)) return fail(`Quantity for ${name} must be greater than 0.`);
        if (!(a.unitPrice > 0)) return fail(`Rate for ${name} must be greater than 0.`);
        lines.push({
          name, hsn: a.hsn?.trim() || null, description: a.description?.trim() || null,
          quantity: a.quantity, unitPrice: round2(a.unitPrice), gstRate: a.gstRate,
        });
        break;
      }
    }
  }
  return { ok: true, lines };
}
