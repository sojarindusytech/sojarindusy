import { z } from "zod";
import { DEBIT_NOTE_NUMBER_PATTERN, DEBIT_NOTE_REASONS } from "@/lib/debit-notes";
import { normalizeHsn } from "@/lib/invoice";

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullish()
    .transform((v) => (v ? v : null));

const REASON_VALUES = DEBIT_NOTE_REASONS.map((r) => r.value) as [string, ...string[]];

const lineSchema = z.object({
  name: z.string().trim().min(1, "Every line needs an item name.").max(200, "Item name is too long."),
  sku: optionalText(100),
  description: optionalText(300),
  hsn: z
    .string()
    .nullish()
    .transform((v, ctx) => {
      const r = normalizeHsn(v);
      if (!r.ok) {
        ctx.addIssue({ code: "custom", message: "HSN/SAC must be 4 to 8 digits." });
        return z.NEVER;
      }
      return r.value;
    }),
  quantity: z.number().positive("Quantity must be greater than 0.").max(10_000_000),
  unit: optionalText(20),
  /** The amount being added per unit (e.g. the price difference), not the original price. */
  unitPrice: z.number().positive("Rate must be greater than 0.").max(1_000_000_000),
  /** null = the Sales Settings default. Ignored when the invoice has no GST. */
  gstRate: z.number().min(0).max(100).nullable(),
});

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
    lines: z.array(lineSchema).min(1, "Add at least one line.").max(200, "Too many lines."),
  })
  .superRefine((v, ctx) => {
    if (v.reason === "other" && (v.reasonNote?.length ?? 0) < 3) {
      ctx.addIssue({ code: "custom", path: ["reasonNote"], message: "Describe the reason in a few words." });
    }
  });

export type IssueDebitNoteInput = z.input<typeof issueDebitNoteSchema>;
export type IssueDebitNoteValues = z.output<typeof issueDebitNoteSchema>;
