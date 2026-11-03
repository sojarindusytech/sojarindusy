import { z } from "zod";
import { USER_TITLES, INDIAN_STATES } from "@/lib/constants";

/**
 * Strong password policy, enforced on both client and server:
 * - At least 8 characters
 * - At least one uppercase letter (A-Z)
 * - At least one lowercase letter (a-z)
 * - At least one digit (0-9)
 * - At least one special character (any symbol or space)
 * - At most 72 bytes: bcrypt ignores everything after byte 72, so a longer password would be
 *   accepted but only partly checked at login.
 */
const byteLength = (v: string) => new TextEncoder().encode(v).length;

export const passwordValidation = z
  .string()
  .min(8, "Password must be at least 8 characters long.")
  .regex(/[A-Z]/, "Must contain at least one uppercase letter (A-Z).")
  .regex(/[a-z]/, "Must contain at least one lowercase letter (a-z).")
  .regex(/[0-9]/, "Must contain at least one number (0-9).")
  .regex(/[^A-Za-z0-9]/, "Must contain at least one special character (e.g. !@#$%^&*).")
  .refine((v) => byteLength(v) <= 72, "Password is too long (72 bytes at most).");

// Step 1: User & Contact Information Schema
export const step1Schema = z
  .object({
    title: z.enum(USER_TITLES),
    first_name: z
      .string()
      .trim()
      .min(2, "First name must be at least 2 characters.")
      .max(60, "First name is too long."),
    last_name: z
      .string()
      .trim()
      .min(2, "Last name must be at least 2 characters.")
      .max(60, "Last name is too long."),
    department: z
      .string()
      .trim()
      .min(2, "Department is required.")
      .max(80, "Department is too long."),
    designation: z
      .string()
      .trim()
      .min(2, "Designation is required.")
      .max(80, "Designation is too long."),
    mobile: z
      .string()
      .trim()
      .regex(/^[0-9]{10}$/, "Please enter a valid 10-digit mobile number."),
    landline: z
      .string()
      .trim()
      .max(20, "Landline number is too long.")
      .regex(/^[0-9+() -]*$/, "Landline may contain digits, spaces, + - ( ) only.")
      .optional(),
    email: z
      .string()
      .trim()
      .max(254, "Email address is too long.")
      .email("Please enter a valid official email address."),
    password: passwordValidation,
    confirm_password: z.string(),
  })
  .refine((data) => data.password === data.confirm_password, {
    message: "Passwords do not match.",
    path: ["confirm_password"],
  });

// Step 2: Company Details Schema
export const step2Schema = z.object({
  company_name: z
    .string()
    .trim()
    .min(2, "Company name must be at least 2 characters.")
    .max(150, "Company name is too long."),
  gstin: z
    .string()
    .trim()
    .toUpperCase()
    .optional()
    .refine(
      (val) => !val || /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/i.test(val),
      {
        message: "Invalid GSTIN format (e.g., 27AAAAA0000A1Z5).",
      }
    ),
  company_address: z
    .string()
    .trim()
    .min(5, "Company address must be at least 5 characters.")
    .max(300, "Company address is too long."),
  additional_address: z.string().trim().max(300, "Additional address is too long.").optional(),
  city: z.string().trim().min(2, "City is required.").max(80, "City is too long."),
  state: z
    .string()
    .trim()
    .refine((v) => (INDIAN_STATES as readonly string[]).includes(v), "Please select a valid state."),
  pincode: z
    .string()
    .trim()
    .regex(/^[1-9][0-9]{5}$/, "Please enter a valid 6-digit Pincode."),
});

// Full Signup Schema (Combines Step 1 + Step 2)
export const fullSignUpSchema = step1Schema.and(step2Schema);

export type Step1FormData = z.infer<typeof step1Schema>;
export type Step2FormData = z.infer<typeof step2Schema>;
export type FullSignUpFormData = z.infer<typeof fullSignUpSchema>;

// Login Validation Schema
export const loginSchema = z.object({
  email: z.string().trim().email("Please enter a valid email address."),
  password: z.string().min(1, "Password is required.").max(256, "Invalid email or password."),
});

// Forgot Password Request Schema
export const forgotPasswordSchema = z.object({
  email: z.string().trim().email("Please enter a valid official email address."),
});

// Reset / Set Password Schema
export const resetPasswordSchema = z
  .object({
    password: passwordValidation,
    confirm_password: z.string(),
  })
  .refine((data) => data.password === data.confirm_password, {
    message: "Passwords do not match.",
    path: ["confirm_password"],
  });

export type ForgotPasswordFormData = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordFormData = z.infer<typeof resetPasswordSchema>;
