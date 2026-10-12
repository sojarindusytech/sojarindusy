import { z } from "zod";

/** Same rule as the coupons_code_format check constraint. */
export const COUPON_CODE_PATTERN = /^[A-Z0-9][A-Z0-9_-]{2,31}$/;

const money = (label: string) =>
  z.number({ error: `Enter the ${label.toLowerCase()} as a number.` }).finite().max(100_000_000, `${label} is too large.`);

/**
 * The admin coupon form. Validated in the browser for instant feedback and
 * again on the server, which is the authority. Dates are calendar days in IST.
 */
export const couponFormSchema = z
  .object({
    id: z.uuid().optional(),
    /** The version the admin loaded; a save on a stale copy is refused. */
    version: z.number().int().positive().optional(),
    code: z
      .string()
      .trim()
      .toUpperCase()
      .regex(COUPON_CODE_PATTERN, "Use 3-32 letters, numbers, hyphens or underscores, starting with a letter or number."),
    description: z.string().trim().max(500, "Keep the description under 500 characters."),
    discountType: z.enum(["percent", "fixed"]),
    discountValue: money("Discount").positive("Discount must be more than 0."),
    maxDiscount: money("Maximum discount").positive("Maximum discount must be more than 0.").nullable(),
    minOrderValue: money("Minimum order value").min(0, "Minimum order value can't be negative."),
    validFrom: z.iso.date("Choose a start date."),
    validUntil: z.iso.date("Choose a valid end date.").nullable(),
    maxTotalUses: z.number().int().positive("Total uses must be at least 1.").max(10_000_000).nullable(),
    maxUsesPerCustomer: z.number().int().positive("Uses per customer must be at least 1.").max(10_000).nullable(),
    firstOrderOnly: z.boolean(),
    canCombine: z.boolean(),
    appliesTo: z.enum(["all", "products", "categories"]),
    productIds: z.array(z.uuid()).max(2000),
    categoryIds: z.array(z.uuid()).max(500),
    customerScope: z.enum(["all", "selected"]),
    customerIds: z.array(z.uuid()).max(10_000),
    isActive: z.boolean(),
  })
  .superRefine((v, ctx) => {
    const issue = (path: string, message: string) => ctx.addIssue({ code: "custom", path: [path], message });

    if (v.discountType === "percent" && v.discountValue > 100) {
      issue("discountValue", "A percentage discount can't be more than 100%.");
    }
    if (v.validUntil && v.validUntil < v.validFrom) {
      issue("validUntil", "The end date must be on or after the start date.");
    }
    if (v.appliesTo === "products" && v.productIds.length === 0) {
      issue("productIds", "Choose at least one product.");
    }
    if (v.appliesTo === "categories" && v.categoryIds.length === 0) {
      issue("categoryIds", "Choose at least one category.");
    }
    if (v.customerScope === "selected" && v.customerIds.length === 0) {
      issue("customerIds", "Choose at least one customer.");
    }
    if (
      v.maxTotalUses !== null &&
      v.maxUsesPerCustomer !== null &&
      v.maxUsesPerCustomer > v.maxTotalUses
    ) {
      issue("maxUsesPerCustomer", "Uses per customer can't be more than the total uses.");
    }
  });

export type CouponFormInput = z.input<typeof couponFormSchema>;
export type CouponFormData = z.output<typeof couponFormSchema>;

/** First error message per field, for showing under form inputs. */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form");
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}

/** A random, unambiguous code (no 0/O or 1/I), e.g. "SOJ-7KQ2M9". */
export function generateCouponCode(prefix = "SOJ", length = 6): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  const body = Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("");
  return `${prefix}-${body}`;
}
