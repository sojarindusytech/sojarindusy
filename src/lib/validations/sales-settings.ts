import { z } from "zod";
import { INVOICE_COPIES } from "@/lib/invoice";

const GSTIN_REGEX = /^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;

const optionalText = z
  .string()
  .trim()
  .transform((v) => (v === "" ? null : v))
  .nullable()
  .optional();

/** Fields editable on the Sales settings page. Invoice counter lives here too. */
export const salesSettingsSchema = z.object({
  company_name: z.string().trim().min(2, "Company name is required."),
  address: z.string().trim().min(5, "Address is required."),
  gstin: z
    .string()
    .trim()
    .toUpperCase()
    .transform((v) => (v === "" ? null : v))
    .nullable()
    .refine((v) => v === null || GSTIN_REGEX.test(v), "Enter a valid 15-character GSTIN."),
  state_code: z.string().trim().regex(/^\d{1,2}$/, "State code must be 1-2 digits (e.g. 24)."),
  state_name: z.string().trim().min(2, "State name is required."),
  msme: optionalText,
  website: optionalText,
  phone: optionalText,
  email: z
    .string()
    .trim()
    .transform((v) => (v === "" ? null : v))
    .nullable()
    .refine((v) => v === null || z.email().safeParse(v).success, "Enter a valid email."),
  logo_url: optionalText,
  signature_url: optionalText,

  bank_name: optionalText,
  bank_address: optionalText,
  account_no: optionalText,
  ifsc: optionalText,
  account_holder: optionalText,
  terms: optionalText,
  credit_note_terms: optionalText,
  quote_terms: optionalText,
  receipt_terms: optionalText,

  gst_billing_enabled: z.boolean(),
  invoice_reduces_stock: z.boolean(),
  credit_note_restores_stock: z.boolean(),
  default_gst_rate: z.coerce.number().min(0, "GST % cannot be negative.").max(100, "GST % cannot exceed 100."),

  invoice_prefix: z
    .string()
    .trim()
    .min(1, "Prefix is required.")
    .max(20, "Prefix is too long.")
    // Becomes part of the number; keep it printable and slash/dash friendly.
    .regex(/^[A-Za-z0-9/\-_.]+$/, "Use letters, numbers, / - _ . only."),
  invoice_next_number: z.coerce.number().int("Must be a whole number.").min(1, "Counter must be at least 1."),
  invoice_pad: z.coerce.number().int().min(1).max(8),
  po_prefix: z
    .string()
    .trim()
    .min(1, "Prefix is required.")
    .max(20, "Prefix is too long.")
    .regex(/^[A-Za-z0-9/\-_.]+$/, "Use letters, numbers, / - _ . only."),
  po_next_number: z.coerce.number().int("Must be a whole number.").min(1, "Counter must be at least 1."),
  po_pad: z.coerce.number().int().min(1).max(8),
  po_manufacturer_id: z
    .string()
    .trim()
    .transform((v) => (v === "" ? null : v))
    .nullable()
    .refine((v) => v === null || z.uuid().safeParse(v).success, "Select a manufacturer.")
    .optional(),
  rfq_prefix: z
    .string()
    .trim()
    .min(1, "Prefix is required.")
    .max(20, "Prefix is too long.")
    .regex(/^[A-Za-z0-9/\-_.]+$/, "Use letters, numbers, / - _ . only."),
  rfq_next_number: z.coerce.number().int("Must be a whole number.").min(1, "Counter must be at least 1."),
  rfq_pad: z.coerce.number().int().min(1).max(8),
  quote_prefix: z
    .string()
    .trim()
    .min(1, "Prefix is required.")
    .max(20, "Prefix is too long.")
    .regex(/^[A-Za-z0-9/\-_.]+$/, "Use letters, numbers, / - _ . only."),
  quote_next_number: z.coerce.number().int("Must be a whole number.").min(1, "Counter must be at least 1."),
  quote_pad: z.coerce.number().int().min(1).max(8),
  credit_note_prefix: z.string().trim().min(1, "Prefix is required.").max(7, "Use at most 7 characters.")
    .regex(/^[A-Za-z0-9/\-]+$/, "Use letters, numbers, / and - only."),
  credit_note_next_number: z.coerce.number().int().min(1).max(99999999),
  credit_note_pad: z.coerce.number().int().min(1).max(8),
  quote_validity_days: z.coerce.number().int("Must be a whole number.").min(1, "At least 1 day.").max(365, "At most 365 days."),
  quote_payment_terms: optionalText,
  quote_delivery_terms: optionalText,
  receipt_prefix: z
    .string()
    .trim()
    .min(1, "Prefix is required.")
    .max(20, "Prefix is too long.")
    .regex(/^[A-Za-z0-9/\-_.]+$/, "Use letters, numbers, / - _ . only."),
  receipt_next_number: z.coerce.number().int("Must be a whole number.").min(1, "Counter must be at least 1."),
  receipt_pad: z.coerce.number().int().min(1).max(8),
  order_prefix: z
    .string()
    .trim()
    .min(1, "Prefix is required.")
    .max(20, "Prefix is too long.")
    .regex(/^[A-Za-z0-9/\-_.]+$/, "Use letters, numbers, / - _ . only."),
  order_next_number: z.coerce.number().int("Must be a whole number.").min(1, "Counter must be at least 1."),
  order_pad: z.coerce.number().int().min(1).max(8),
  invoice_copies: z.array(z.enum(INVOICE_COPIES)).min(1, "Select at least one copy to print."),
}).superRefine((value, ctx) => {
  if (value.credit_note_prefix.length + 7 + Math.max(value.credit_note_pad, String(value.credit_note_next_number).length) > 16) {
    ctx.addIssue({ code: "custom", path: ["credit_note_prefix"], message: "The complete credit note number must fit within 16 characters. Shorten the prefix or digits." });
  }
});

export type SalesSettingsInput = z.input<typeof salesSettingsSchema>;
export type SalesSettingsValues = z.output<typeof salesSettingsSchema>;
