import { z } from "zod";
import { PAYMENT_MODES } from "@/lib/payments";
import { round2 } from "@/lib/ledger";

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullish()
    .transform((v) => (v ? v : null));

const money = z.number().min(0).max(1_000_000_000).transform(round2);

const MODE_VALUES = PAYMENT_MODES.map((m) => m.value) as [string, ...string[]];

/** One line of a journal or opening balance: a debit or a credit on one account. */
const journalLine = z
  .object({
    accountId: z.uuid("Pick an account on every line."),
    /** Customer or manufacturer, on Trade Receivables / Trade Payables lines only. */
    partyId: z.uuid().nullish().transform((v) => v ?? null),
    debit: money,
    credit: money,
    /** Bill number this line is for (e.g. an old invoice on an opening balance). */
    billRef: optionalText(50),
    narration: optionalText(200),
  })
  .refine((l) => (l.debit > 0) !== (l.credit > 0), { message: "Enter either a debit or a credit on each line." });

/** Journal voucher or opening balance as submitted by the form. The database re-checks everything. */
export const journalSchema = z
  .object({
    /** One per form open: a retried submit returns the same voucher. */
    requestId: z.uuid(),
    kind: z.enum(["journal", "opening"]),
    entryDate: z.iso.date("Pick a date."),
    narration: optionalText(500),
    lines: z.array(journalLine).min(1, "Add at least one line.").max(100, "At most 100 lines."),
  })
  .superRefine((v, ctx) => {
    if (v.kind === "journal") {
      if (v.lines.length < 2) ctx.addIssue({ code: "custom", path: ["lines"], message: "A journal needs at least two lines." });
      const dr = round2(v.lines.reduce((s, l) => s + l.debit, 0));
      const cr = round2(v.lines.reduce((s, l) => s + l.credit, 0));
      if (dr !== cr) ctx.addIssue({ code: "custom", path: ["lines"], message: "Total debit must equal total credit." });
      if (!v.narration || v.narration.length < 3) ctx.addIssue({ code: "custom", path: ["narration"], message: "Write a short narration." });
    }
  });

export type JournalInput = z.input<typeof journalSchema>;

/** A payment made to a manufacturer. */
export const supplierPaymentSchema = z.object({
  requestId: z.uuid(),
  manufacturerId: z.uuid("Pick a manufacturer."),
  paymentDate: z.iso.date("Pick the payment date."),
  amount: z.number().positive("Enter the amount paid.").max(1_000_000_000).transform(round2),
  mode: z.enum(MODE_VALUES),
  accountId: z.uuid("Pick the bank or cash account it was paid from."),
  reference: optionalText(100),
  billReference: optionalText(200),
  remarks: optionalText(1000),
});

export type SupplierPaymentInput = z.input<typeof supplierPaymentSchema>;

/** Create or edit an account in the chart of accounts (bank / cash accounts included). */
export const ledgerAccountSchema = z
  .object({
    id: z.uuid().nullish().transform((v) => v ?? null),
    code: z.string().trim().regex(/^[0-9]{3,6}$/, "Use a 3 to 6 digit code."),
    name: z.string().trim().min(2, "Enter a name.").max(100),
    type: z.enum(["asset", "liability", "equity", "income", "expense"]),
    /** Customers / manufacturers accounts exist already; new accounts are general, bank or cash. */
    kind: z.enum(["general", "bank", "cash"]),
    tallyName: optionalText(100),
    tallyGroup: z.string().trim().min(2, "Pick the Tally group.").max(60),
    bankName: optionalText(100),
    accountNo: optionalText(40),
    ifsc: z
      .string()
      .trim()
      .toUpperCase()
      .nullish()
      .transform((v) => (v ? v : null))
      .refine((v) => v === null || /^[A-Z]{4}0[A-Z0-9]{6}$/.test(v), "Enter a valid 11-character IFSC."),
    branch: optionalText(200),
    accountHolder: optionalText(100),
  })
  .refine((a) => a.kind === "general" || a.type === "asset", { path: ["type"], message: "Bank and cash accounts are assets." });

export type LedgerAccountInput = z.input<typeof ledgerAccountSchema>;

/** Date range of a ledger report. */
export const ledgerRangeSchema = z
  .object({ from: z.iso.date(), to: z.iso.date() })
  .refine((r) => r.from <= r.to, { message: "The start date must be on or before the end date." });
