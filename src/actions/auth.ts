"use server";

import { createClient } from "@/lib/supabase/server";
import { Profile } from "@/types/database.types";
import {
  USER_ROLES,
  USER_TYPES,
  APPROVAL_STATUSES,
  USER_TITLES,
  COMMERCIAL_DEFAULTS,
  UserRole,
  UserTitle,
} from "@/lib/constants";
import { fullSignUpSchema, loginSchema, forgotPasswordSchema, resetPasswordSchema } from "@/lib/validations/auth";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export interface SignUpState {
  error?: string;
  success?: boolean;
  message?: string;
  needsEmailVerification?: boolean;
  email?: string;
}

export async function signUpUser(formData: FormData): Promise<SignUpState> {
  const supabase = await createClient();

  // Extract raw fields
  const rawData = {
    title: (formData.get("title") as string) || USER_TITLES[0],
    first_name: (formData.get("first_name") as string)?.trim(),
    last_name: (formData.get("last_name") as string)?.trim(),
    department: (formData.get("department") as string)?.trim(),
    designation: (formData.get("designation") as string)?.trim(),
    mobile: (formData.get("mobile") as string)?.trim(),
    landline: (formData.get("landline") as string)?.trim() || undefined,
    email: (formData.get("email") as string)?.trim().toLowerCase(),
    password: formData.get("password") as string,
    confirm_password: formData.get("confirm_password") as string,
    company_name: (formData.get("company_name") as string)?.trim(),
    company_address: (formData.get("company_address") as string)?.trim(),
    additional_address: (formData.get("additional_address") as string)?.trim() || undefined,
    gstin: (formData.get("gstin") as string)?.trim() || undefined,
    city: (formData.get("city") as string)?.trim(),
    state: (formData.get("state") as string)?.trim(),
    pincode: (formData.get("pincode") as string)?.trim(),
  };

  // Self-service registration always creates a customer. The role is NEVER
  // read from the request: an attacker could otherwise post role=admin and
  // provision themselves an administrator account.
  const role: UserRole = USER_ROLES.CUSTOMER;

  // Zod Server Validation
  const validationResult = fullSignUpSchema.safeParse(rawData);
  if (!validationResult.success) {
    return {
      error: validationResult.error.issues[0]?.message || "Validation failed.",
    };
  }

  const validated = validationResult.data;

  const userMetadata = {
    role,
    title: validated.title as UserTitle,
    first_name: validated.first_name,
    last_name: validated.last_name,
    department: validated.department,
    designation: validated.designation,
    mobile: validated.mobile,
    landline: validated.landline || null,
    company_name: validated.company_name,
    company_address: validated.company_address,
    additional_address: validated.additional_address || null,
    gstin: validated.gstin || null,
    city: validated.city,
    state: validated.state,
    pincode: validated.pincode,
    approval_status: APPROVAL_STATUSES.PENDING,
    channel: "online",
    user_type: "online",
  };

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

  // 1. Sign up user with Supabase Auth
  const { data: authData, error: authError } = await supabase.auth.signUp({
    email: validated.email,
    password: validated.password,
    options: {
      data: userMetadata,
      emailRedirectTo: `${siteUrl}/auth/callback?next=/pending-approval`,
    },
  });

  if (authError) {
    return { error: authError.message };
  }

  if (!authData.user) {
    return { error: "Signup could not be completed. Please try again." };
  }

  // Supabase identity check: if identities is empty array, account exists
  if (authData.user.identities && authData.user.identities.length === 0) {
    return {
      error: "An account with this email address already exists. Please sign in or reset your password.",
    };
  }

  // 2. Insert profile record in database using Admin client to ensure RLS bypass on creation
  const { createAdminClient } = await import("@/lib/supabase/admin");
  const adminDb = createAdminClient();

  const profileRecord: Profile = {
    id: authData.user.id,
    role,
    title: validated.title as UserTitle,
    first_name: validated.first_name,
    last_name: validated.last_name,
    department: validated.department,
    designation: validated.designation,
    mobile: validated.mobile,
    landline: validated.landline || null,
    email: validated.email,
    company_name: validated.company_name,
    company_address: validated.company_address,
    additional_address: validated.additional_address || null,
    gstin: validated.gstin || null,
    city: validated.city,
    state: validated.state,
    pincode: validated.pincode,
    approval_status: APPROVAL_STATUSES.PENDING,
    channel: "online",
    user_type: "online",
    credit_limit: COMMERCIAL_DEFAULTS.DEFAULT_CREDIT_LIMIT,
    credit_days: COMMERCIAL_DEFAULTS.DEFAULT_CREDIT_DAYS,
  };

  const { error: profileError } = await adminDb
    .from("profiles")
    .upsert(profileRecord as never, { onConflict: "id" });

  if (profileError) {
    // The profile row is the sole source of truth for role and approval
    // status. If it is missing the account would fall through to defaults, so
    // roll the auth user back rather than leaving an unguarded orphan.
    console.error("Profile creation failed, rolling back auth user:", profileError.message);
    await adminDb.auth.admin.deleteUser(authData.user.id).catch((rollbackErr) => {
      console.error("Auth rollback failed for", authData.user!.id, rollbackErr);
    });
    return {
      error: "We could not complete your registration. Please try again or contact support.",
    };
  }

  revalidatePath("/", "layout");
  return {
    success: true,
    needsEmailVerification: true,
    email: validated.email,
    message: "Registration initiated! We have sent a confirmation email to verify your email address.",
  };
}

export async function signInUser(
  emailInput: string,
  passwordInput: string
): Promise<{
  error?: string;
  redirectUrl?: string;
  isEmailUnconfirmed?: boolean;
  unconfirmedEmail?: string;
}> {
  const supabase = await createClient();

  const validationResult = loginSchema.safeParse({
    email: emailInput?.trim().toLowerCase(),
    password: passwordInput,
  });

  if (!validationResult.success) {
    return { error: validationResult.error.issues[0]?.message || "Invalid credentials." };
  }

  const { email, password } = validationResult.data;

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    if (error.message.toLowerCase().includes("email not confirmed")) {
      return {
        error: "Your email address has not been verified yet. Please check your inbox for the confirmation email.",
        isEmailUnconfirmed: true,
        unconfirmedEmail: email,
      };
    }
    // Generic message: a distinct "user not found" reply would let an attacker
    // enumerate which email addresses are registered.
    console.warn("[auth] Sign-in failed:", error.message);
    return { error: "Invalid email or password. Please try again." };
  }

  if (!data.user) {
    return { error: "Unable to sign in. Please try again." };
  }

  // Fetch profile to determine role & approval status.
  // Read through the admin client so a restrictive RLS policy cannot silently
  // return no row, and never fall back to `user_metadata` — that object is
  // writable by the account holder and must not drive authorization.
  const { createAdminClient } = await import("@/lib/supabase/admin");
  const { data: profile } = await createAdminClient()
    .from("profiles")
    .select("role, approval_status")
    .eq("id", data.user.id)
    .single();

  const profileData = profile as { role?: UserRole; approval_status?: string } | null;
  const userRole = profileData?.role ?? USER_ROLES.CUSTOMER;
  const approvalStatus = profileData?.approval_status ?? APPROVAL_STATUSES.PENDING;

  // Route based on role & approval status
  revalidatePath("/", "layout");

  if (userRole === "admin" || userRole === "platform_owner") {
    return { redirectUrl: "/admin/products" };
  }

  if (approvalStatus !== APPROVAL_STATUSES.APPROVED) {
    if (approvalStatus === APPROVAL_STATUSES.REJECTED) {
      await supabase.auth.signOut();
      return {
        error: "Your enterprise account application has been rejected. Please contact support@sojarsolutions.com for assistance.",
      };
    }
    return { redirectUrl: "/pending-approval" };
  }

  return { redirectUrl: "/dashboard" };
}

/**
 * Sends a password reset recovery link to the user's email address
 */
export async function sendPasswordResetEmail(emailInput: string): Promise<{
  success?: boolean;
  error?: string;
  message?: string;
}> {
  const validation = forgotPasswordSchema.safeParse({ email: emailInput?.trim().toLowerCase() });
  if (!validation.success) {
    return { error: validation.error.issues[0]?.message || "Please enter a valid email address." };
  }

  const { email } = validation.data;
  const supabase = await createClient();
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${siteUrl}/auth/callback?next=/reset-password`,
  });

  if (error) {
    return { error: error.message };
  }

  return {
    success: true,
    message: "A password reset link has been dispatched to your email address. Please check your inbox and spam folder.",
  };
}

/**
 * Updates the user's password once authenticated through the recovery session
 */
export async function updateUserPassword(
  passwordInput: string,
  confirmPasswordInput: string
): Promise<{
  success?: boolean;
  error?: string;
  message?: string;
}> {
  const validation = resetPasswordSchema.safeParse({
    password: passwordInput,
    confirm_password: confirmPasswordInput,
  });

  if (!validation.success) {
    return { error: validation.error.issues[0]?.message || "Password validation failed." };
  }

  const { password } = validation.data;
  const supabase = await createClient();

  const { error } = await supabase.auth.updateUser({
    password,
  });

  if (error) {
    return { error: error.message };
  }

  // Sign out the recovery session so user can log in fresh
  await supabase.auth.signOut();
  revalidatePath("/", "layout");

  return {
    success: true,
    message: "Your password has been updated successfully. Please log in with your new password.",
  };
}

/**
 * Resends the signup email confirmation
 */
export async function resendVerificationEmail(emailInput: string): Promise<{
  success?: boolean;
  error?: string;
  message?: string;
}> {
  const validation = forgotPasswordSchema.safeParse({ email: emailInput?.trim().toLowerCase() });
  if (!validation.success) {
    return { error: "Please provide a valid email address." };
  }

  const { email } = validation.data;
  const supabase = await createClient();
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

  const { error } = await supabase.auth.resend({
    type: "signup",
    email,
    options: {
      emailRedirectTo: `${siteUrl}/auth/callback?next=/pending-approval`,
    },
  });

  if (error) {
    return { error: error.message };
  }

  return {
    success: true,
    message: "Verification email sent. Please check your inbox.",
  };
}

export async function signOutUser() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/login");
}

export async function getCurrentUserProfile(): Promise<{
  user: { id: string; email: string } | null;
  profile: Profile | null;
}> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { user: null, profile: null };
  }

  // Fetch profile directly from database using Admin client to bypass RLS read restrictions
  const { createAdminClient } = await import("@/lib/supabase/admin");
  const adminDb = createAdminClient();

  const { data: profile } = await adminDb
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  if (!profile) {
    // Display-only fallback for an account whose profile row is missing.
    // Role and approval status are hardcoded to the least-privileged values:
    // `user_metadata` is writable by the account holder, so trusting it here
    // would let any user mint themselves an approved admin profile.
    const meta = user.user_metadata || {};
    const fallbackProfile: Profile = {
      id: user.id,
      role: USER_ROLES.CUSTOMER,
      title: (meta.title as UserTitle) || USER_TITLES[0],
      first_name: meta.first_name || "User",
      last_name: meta.last_name || "",
      department: meta.department || "Operations",
      designation: meta.designation || "Member",
      mobile: meta.mobile || "-",
      landline: meta.landline || null,
      email: user.email || "",
      company_name: meta.company_name || "Sojar Solutions Partner",
      company_address: meta.company_address || "Industrial Area",
      additional_address: meta.additional_address || null,
      gstin: meta.gstin || null,
      city: meta.city || "Mumbai",
      state: meta.state || "Maharashtra",
      pincode: meta.pincode || "400001",
      approval_status: APPROVAL_STATUSES.PENDING,
      user_type: (meta.user_type as typeof USER_TYPES[keyof typeof USER_TYPES]) || USER_TYPES.PLATFORM_USER,
      credit_limit: COMMERCIAL_DEFAULTS.DEFAULT_CREDIT_LIMIT,
      credit_days: COMMERCIAL_DEFAULTS.DEFAULT_CREDIT_DAYS,
      created_at: user.created_at,
      updated_at: user.created_at,
    };
    return {
      user: { id: user.id, email: user.email || "" },
      profile: fallbackProfile,
    };
  }

  return {
    user: { id: user.id, email: user.email || "" },
    profile: profile as unknown as Profile,
  };
}
