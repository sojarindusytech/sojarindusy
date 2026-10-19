import { z } from "zod";
import { DEBIT_NOTE_NUMBER_PATTERN, DEBIT_NOTE_REASONS, lineKindFor } from "@/lib/debit-notes";
import { normalizeHsn } from "@/lib/invoice";
import type { DebitNoteReason } from "@/types/database.types";

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullish()
    .transform((v) => (v ? v : null));

const hsn = z
  .string()
  .nullish()
  .transform((v, ctx) => {
    const r = normalizeHsn(v);
    if (!r.ok) {
      ctx.addIssue({ code: "custom", message: "HSN/SAC must be 4 to 8 digits." });
      return z.NEVER;
    }
    return r.value;
  });

const REASON_VALUES = DEBIT_NOTE_REASONS.map((r) => r.value) as [DebitNoteReason, ...DebitNoteReason[]];
const lineIndex = z.number().int().min(0).max(999);
const money = z.number().max(1_000_000_000);
const quantity = z.number().positive("Quantity must be greater than 0.").max(10_000_000);
const gstRate = z.number().min(0).max(100);

/**
 * One entry of the form. Lines that adjust an invoice line point at it by index;
 * the server prices them from the stored invoice (src/lib/debit-notes.ts).
 */
const adjustmentSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("rate"), line: lineIndex, quantity, newRate: money.positive("Enter the new rate.") }),
  z.object({ kind: z.literal("quantity"), line: lineIndex, quantity, rate: money.positive("Enter the rate.") }),
  z.object({
    kind: z.literal("charge"),
    label: z.string().trim().min(1, "Every charge needs a name, e.g. Freight charges.").max(200),
    amount: money.positive("Enter the charge amount."),
    gstRate: gstRate.nullable(),
    hsn,
  }),
  z.object({ kind: z.literal("tax"), line: lineIndex, correctRate: gstRate }),
  z.object({
    kind: z.literal("custom"),
    name: z.string().trim().min(1, "Every line needs an item name.").max(200, "Item name is too long."),
    description: optionalText(300),
    hsn,
    quantity,
    unitPrice: money.positive("Rate must be greater than 0."),
    gstRate: gstRate.nullable(),
  }),
]);

/** Everything the Issue Debit Note form submits. Re-validated in the database. */
export const issueDebitNoteSchema = z
  .object({
    /** One per form open (crypto.randomUUID()); a retried submit returns the same note. */
    requestId: z.uuid(),
    invoiceId: z.uuid("Select the invoice this debit note is for."),
    debitNoteDate: z.iso.date("Enter a valid date."),
    reason: z.enum(REASON_VALUES, "Select a reason."),
    reasonNote: optionalText(500),
    /** Typed number. Blank = next number in the series. */
    manualNumber: optionalText(16).refine(
      (v) => v === null || DEBIT_NOTE_NUMBER_PATTERN.test(v),
      "Debit note numbers are up to 16 letters, digits, / and - (GST rule)."
    ),
    adjustments: z.array(adjustmentSchema).min(1, "Add at least one line.").max(200, "Too many lines."),
  })
  .superRefine((v, ctx) => {
    if (v.reason === "other" && (v.reasonNote?.length ?? 0) < 3) {
      ctx.addIssue({ code: "custom", path: ["reasonNote"], message: "Describe the reason in a few words." });
    }
    const kind = lineKindFor(v.reason);
    if (v.adjustments.some((a) => a.kind !== kind)) {
      ctx.addIssue({ code: "custom", path: ["adjustments"], message: "These lines don't match the selected reason." });
    }
  });

export type IssueDebitNoteInput = z.input<typeof issueDebitNoteSchema>;
export type IssueDebitNoteValues = z.output<typeof issueDebitNoteSchema>;
