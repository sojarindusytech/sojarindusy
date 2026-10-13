import { z } from "zod";
import { PAYMENT_MODES } from "@/lib/payments";

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullish()
    .transform((v) => (v ? v : null));

const MODE_VALUES = PAYMENT_MODES.map((m) => m.value) as [string, ...string[]];

/** Everything the Record Payment form submits. Re-validated on the server; the database re-checks the money. */
export const recordPaymentSchema = z.object({
  /** One per form open (crypto.randomUUID()); a retried submit returns the same receipt. */
  requestId: z.uuid(),
  /** null = walk-in / POS payer (then payerName is required). */
  customerId: z.uuid().nullable(),
  payerName: optionalText(200),
  paymentDate: z.iso.date(),
  amount: z.number().positive("Enter the amount received.").max(1_000_000_000),
  mode: z.enum(MODE_VALUES),
  channel: z.enum(["ecom", "offline"]),
  reference: optionalText(100),
  depositAccount: optionalText(150),
  remarks: optionalText(1000),
  manualNumber: optionalText(50),
  allocations: z
    .array(
      z.object({
        kind: z.enum(["invoice", "advance", "other"]),
        invoiceId: z.uuid().optional(),
        amount: z.number().positive(),
        note: optionalText(200),
      })
    )
    .min(1, "Allocate the payment to an invoice, advance or other.")
    .max(200),
});

export type RecordPaymentInput = z.input<typeof recordPaymentSchema>;
