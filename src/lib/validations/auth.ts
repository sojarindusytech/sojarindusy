import { z } from "zod";
import { USER_TITLES } from "@/lib/constants";

/**
 * Standard Strong Password Regex:
 * - At least 8 characters
 * - At least one uppercase letter (A-Z)
 * - At least one lowercase letter (a-z)
 * - At least one digit (0-9)
 * - At least one special character (!@#$%^&*...)
 */
export const passwordRegex =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]).{8,}$/;

export const passwordValidation = z
  .string()
  .min(8, "Password must be at least 8 characters long.")
  .regex(/[A-Z]/, "Must contain at least one uppercase letter (A-Z).")
  .regex(/[a-z]/, "Must contain at least one lowercase letter (a-z).")
  .regex(/[0-9]/, "Must contain at least one number (0-9).")
  .regex(
    /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/,
    "Must contain at least one special character (e.g. !@#$%^&*)."
  );

// Step 1: User & Contact Information Schema
export const step1Schema = z
  .object({
    title: z.enum(USER_TITLES),
    first_name: z
      .string()
      .trim()
      .min(2, "First name must be at least 2 characters."),
    last_name: z
      .string()
      .trim()
      .min(2, "Last name must be at least 2 characters."),
    department: z
      .string()
      .trim()
      .min(2, "Department is required."),
    designation: z
      .string()
      .trim()
      .min(2, "Designation is required."),
    mobile: z
      .string()
      .trim()
      .regex(/^[0-9]{10,15}$/, "Please enter a valid 10-digit mobile number."),
    landline: z.string().trim().optional(),
    email: z
      .string()
      .trim()
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
    .min(2, "Company name must be at least 2 characters."),
  gstin: z
    .string()
    .trim()
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
    .min(5, "Company address must be at least 5 characters."),
  additional_address: z.string().trim().optional(),
  city: z.string().trim().min(2, "City is required."),
  state: z.string().trim().min(2, "Please select a state."),
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
  password: z.string().min(1, "Password is required."),
});
