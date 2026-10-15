"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { Profile } from "@/types/database.types";
import {
  APPROVAL_STATUSES,
  USER_TITLES,
  COMMERCIAL_DEFAULTS,
  ApprovalStatus,
  UserTitle,
} from "@/lib/constants";
import { requireAdmin, requireUser } from "@/lib/auth-guard";
import { createNotification } from "@/lib/server/notifications";
import { revalidatePath } from "next/cache";

export async function fetchCustomersList(): Promise<Profile[]> {
  await requireAdmin();
  const supabase = createAdminClient();

  // 1. Fetch all customer profiles from Supabase database using Service Role
  const { data: dbProfiles, error } = await supabase
    .from("profiles")
    .select("*")
    .not("role", "in", '("admin","platform_owner")') // Exclude administrator accounts
    .order("created_at", { ascending: false });

  if (error) {
    console.warn("Could not fetch customer profiles from database:", error.message);
  }

  const profilesMap = new Map<string, Profile>();

  if (dbProfiles && dbProfiles.length > 0) {
    (dbProfiles as Profile[]).forEach((p) => {
      const isOffline = p.channel === "offline" || p.user_type === "offline" || (p.user_type as unknown as string) === "offline_user";
      const normalizedChannel = isOffline ? "offline" : "online";
      profilesMap.set(p.id, {
        ...p,
        role: "customer",
        approval_status: (p.approval_status as ApprovalStatus) || APPROVAL_STATUSES.PENDING,
        channel: normalizedChannel,
        user_type: normalizedChannel,
        credit_limit: p.credit_limit ?? (isOffline ? COMMERCIAL_DEFAULTS.OFFLINE_DEFAULT_CREDIT_LIMIT : 0),
        credit_days: p.credit_days ?? (isOffline ? COMMERCIAL_DEFAULTS.OFFLINE_DEFAULT_CREDIT_DAYS : 0),
      });
    });
  }

  // 2. Also inspect Auth users to ensure any registered user is guaranteed to appear
  try {
    const { data: authData } = await supabase.auth.admin.listUsers();
    if (authData?.users) {
      authData.users.forEach((u) => {
        const meta = u.user_metadata || {};
        if (meta.role === "admin" || meta.role === "platform_owner" || u.email === "admin@sojarindusy.com" || u.email === "admin@sojarsolutions.com") {
          return; // Skip platform administrator
        }

        // If not already in profilesMap or needs hydration
        if (!profilesMap.has(u.id)) {
          profilesMap.set(u.id, {
            id: u.id,
            role: "customer",
            title: (meta.title as UserTitle) || USER_TITLES[0],
            first_name: meta.first_name || (u.email?.split("@")[0] ?? "Customer"),
            last_name: meta.last_name || "",
            department: meta.department || "Operations",
            designation: meta.designation || "Customer Representative",
            mobile: meta.mobile || "-",
            landline: meta.landline || null,
            email: u.email || "",
            company_name: meta.company_name || "Registered Enterprise",
            company_address: meta.company_address || "Industrial Facility",
            additional_address: meta.additional_address || null,
            gstin: meta.gstin || null,
            city: meta.city || "Mumbai",
            state: meta.state || "Maharashtra",
            pincode: meta.pincode || "400001",
            approval_status: (meta.approval_status as ApprovalStatus) || APPROVAL_STATUSES.PENDING,
            channel: "online",
            user_type: "online",
            credit_limit: null, // Online customers are prepaid by default
            credit_days: null,
            created_at: u.created_at,
            updated_at: u.updated_at,
          });
        }
      });
    }
  } catch (authListErr) {
    console.warn("Notice fetching auth users list:", authListErr);
  }

  return Array.from(profilesMap.values());
}

export async function updateCustomerApprovalStatus(
  customerId: string,
  newStatus: ApprovalStatus
): Promise<{ success: boolean; message: string }> {
  await requireAdmin();

  if (!Object.values(APPROVAL_STATUSES).includes(newStatus)) {
    return { success: false, message: "Invalid approval status." };
  }

  const supabase = createAdminClient();

  try {
    const { error } = await supabase
      .from("profiles")
      .update({
        approval_status: newStatus,
        updated_at: new Date().toISOString(),
      } as never)
      .eq("id", customerId);

    if (error) {
      // Approval drives dashboard access, so a failed write must not report success.
      console.error("Failed to update approval status:", error.message);
      return { success: false, message: "Could not update the customer's status. Please try again." };
    }

    // Also update auth user metadata if auth account exists
    await supabase.auth.admin.updateUserById(customerId, {
      user_metadata: {
        approval_status: newStatus,
      },
    }).catch(() => null);

    // Notify the customer that their account is live.
    //
    // This sends Supabase's "Magic Link" email, whose template has been
    // customised into the approval notification. It is routed through the
    // Brevo SMTP configured in Supabase.
    //
    // Security note: the email therefore contains a single-use sign-in token,
    // so anyone with access to the customer's inbox can enter the dashboard
    // without the password. That is inherent to magic-link delivery and is
    // accepted here; keep the link expiry short in Supabase Auth settings.
    if (newStatus === APPROVAL_STATUSES.APPROVED) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("email")
        .eq("id", customerId)
        .single();

      let targetEmail = (profile as unknown as { email?: string } | null)?.email;

      if (!targetEmail) {
        const { data: authUserData } = await supabase.auth.admin
          .getUserById(customerId)
          .catch(() => ({ data: null }));
        targetEmail = authUserData?.user?.email;
      }

      if (targetEmail) {
        const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
        // Delivery is best-effort: the approval is already committed, so a mail
        // failure is logged rather than reported as a failed approval.
        await supabase.auth
          .signInWithOtp({
            email: targetEmail,
            options: {
              // Never provision an account from this path. Approval only ever
              // targets an existing user, and leaving the default (true) would
              // let a stale or mistyped address create a fresh auth user.
              shouldCreateUser: false,
              emailRedirectTo: `${siteUrl}/auth/callback?next=/dashboard`,
            },
          })
          .catch((emailErr) => {
            console.error("Approval notification email failed:", emailErr);
          });
      }

      // Also create an in-app notification for the customer
      try {
        await createNotification({
          userId: customerId,
          title: "Account Approved",
          message: "Welcome to Sojar Indusy! Your business account is approved. You now have full access to pricing and orders.",
          type: "account",
          link: "/dashboard",
        });
      } catch (nErr) {
        console.warn("Could not dispatch customer approval in-app notification:", nErr);
      }
    } else if (newStatus === APPROVAL_STATUSES.REJECTED) {
      try {
        await createNotification({
          userId: customerId,
          title: "Account Application Status",
          message: "Your account registration was not approved. Please contact our support team for details.",
          type: "account",
          link: "/contact",
        });
      } catch (nErr) {
        console.warn("Could not dispatch customer rejection in-app notification:", nErr);
      }
    }
  } catch (err) {
    console.error("Approval status update failed:", err);
    return { success: false, message: "Could not update the customer's status. Please try again." };
  }

  revalidatePath("/admin/customers");
  return {
    success: true,
    message: `Customer status updated to ${newStatus.toUpperCase()}.`,
  };
}

/**
 * Add a walk-in / phone client created by an admin.
 *
 * profiles.id must be a real auth account (foreign key to auth.users), so the
 * client gets a login account with no password: they cannot sign in until
 * they choose to activate it through "Forgot password". The account is
 * removed again if the profile cannot be saved, so no orphan is left behind.
 */
export async function createOfflineCustomer(formData: FormData): Promise<{
  success?: boolean;
  error?: string;
  message?: string;
  customer?: Profile;
}> {
  await requireAdmin();
  const supabase = createAdminClient();

  const title = (formData.get("title") as UserTitle) || USER_TITLES[0];
  const firstName = (formData.get("first_name") as string)?.trim();
  const lastName = (formData.get("last_name") as string)?.trim();
  const companyName = (formData.get("company_name") as string)?.trim();
  const email = (formData.get("email") as string)?.trim().toLowerCase();
  const mobile = (formData.get("mobile") as string)?.trim();
  const landline = (formData.get("landline") as string)?.trim() || null;
  const designation = (formData.get("designation") as string)?.trim() || "Commercial Contact";
  const department = (formData.get("department") as string)?.trim() || "Procurement";
  const gstin = (formData.get("gstin") as string)?.trim() || null;
  const companyAddress = (formData.get("company_address") as string)?.trim();
  const additionalAddress = (formData.get("additional_address") as string)?.trim() || null;
  const city = (formData.get("city") as string)?.trim();
  const state = (formData.get("state") as string)?.trim();
  const pincode = (formData.get("pincode") as string)?.trim();
  const creditLimit = Number(formData.get("credit_limit")) || COMMERCIAL_DEFAULTS.OFFLINE_DEFAULT_CREDIT_LIMIT;
  const creditDays = Number(formData.get("credit_days")) || COMMERCIAL_DEFAULTS.OFFLINE_DEFAULT_CREDIT_DAYS;
  const notes = (formData.get("notes") as string)?.trim() || null;

  if (!companyName || !firstName || !lastName || !email || !mobile || !companyAddress || !city || !state || !pincode) {
    return { error: "Please fill in all required fields marked with an asterisk (*)." };
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { error: "Please enter a valid email address." };
  }
  if (!Number.isFinite(creditLimit) || creditLimit < 0 || !Number.isFinite(creditDays) || creditDays < 0) {
    return { error: "Credit limit and credit days must be zero or more." };
  }

  // 1. The login account the profile hangs off. No password is set.
  const { data: created, error: authError } = await supabase.auth.admin.createUser({
    email,
    email_confirm: true,
    user_metadata: { title, first_name: firstName, last_name: lastName, company_name: companyName, channel: "offline" },
  });

  if (authError || !created?.user) {
    const exists = authError?.message?.toLowerCase().includes("already") ?? false;
    if (!exists) console.error("Offline customer auth account failed:", authError?.message);
    return {
      error: exists
        ? "A customer with this email address already exists."
        : "Could not create the customer account. Please try again.",
    };
  }

  const newOfflineProfile: Profile = {
    id: created.user.id,
    role: "customer",
    title,
    first_name: firstName,
    last_name: lastName,
    department,
    designation,
    mobile,
    landline,
    email,
    company_name: companyName,
    company_address: companyAddress,
    additional_address: additionalAddress,
    gstin,
    city,
    state,
    pincode,
    approval_status: APPROVAL_STATUSES.APPROVED, // Offline clients added directly by admin are pre-approved
    channel: "offline",
    user_type: "offline",
    credit_limit: creditLimit,
    credit_days: creditDays,
    notes,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  // 2. The profile. Upsert: the on_auth_user_created trigger may already have
  // inserted a pending default row for this account.
  const rollback = async (reason: string) => {
    console.error("Offline customer profile failed, removing auth account:", reason);
    await supabase.auth.admin.deleteUser(created.user.id).catch((err) => {
      console.error("Rollback of auth account failed for", created.user.id, err);
    });
    return { error: "Could not save the customer record. Please try again." };
  };

  try {
    const { error } = await supabase
      .from("profiles")
      .upsert(newOfflineProfile as never, { onConflict: "id" });
    if (error) return rollback(error.message);
  } catch (err) {
    return rollback(err instanceof Error ? err.message : String(err));
  }

  revalidatePath("/admin/customers");
  return {
    success: true,
    message: `Offline customer "${companyName}" added successfully.`,
    customer: newOfflineProfile,
  };
}

export interface AdminCustomerUpdate {
  title: UserTitle;
  first_name: string;
  last_name: string;
  company_name: string;
  designation: string;
  department: string;
  mobile: string;
  landline: string;
  gstin: string;
  company_address: string;
  additional_address: string;
  city: string;
  state: string;
  pincode: string;
  /** Blank = no credit terms (prepaid). */
  credit_limit: string;
  credit_days: string;
  notes: string;
}

const GSTIN_RE = /^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;

/**
 * Admin edit of a customer's profile. Email, account type and approval status are not editable here:
 * the email is the login, and approval has its own action with its own notification.
 */
export async function adminUpdateCustomer(
  customerId: string,
  input: AdminCustomerUpdate
): Promise<{ success: boolean; error?: string; customer?: Profile }> {
  await requireAdmin();
  const supabase = createAdminClient();

  const t = (v: unknown) => (typeof v === "string" ? v.trim() : "");
  const first = t(input.first_name);
  const last = t(input.last_name);
  const company = t(input.company_name);
  const mobile = t(input.mobile);
  const address = t(input.company_address);
  const city = t(input.city);
  const state = t(input.state);
  const pincode = t(input.pincode);
  const gstin = t(input.gstin).toUpperCase();

  if (!(USER_TITLES as readonly string[]).includes(input.title)) return { success: false, error: "Select a valid title." };
  if (!first || !last || !company || !mobile || !address || !city || !state || !pincode) {
    return { success: false, error: "Please fill in all required fields marked with an asterisk (*)." };
  }
  if (!/^[0-9+\-\s()]{7,20}$/.test(mobile)) return { success: false, error: "Enter a valid mobile number." };
  if (gstin && !GSTIN_RE.test(gstin)) return { success: false, error: "Enter a valid 15-character GSTIN, or leave it blank." };

  const parseCredit = (raw: string, label: string): { value: number | null } | { error: string } => {
    const v = t(raw);
    if (v === "") return { value: null };
    const n = Number(v);
    return Number.isFinite(n) && n >= 0 ? { value: n } : { error: `${label} must be zero or more.` };
  };
  const limit = parseCredit(input.credit_limit, "Credit limit");
  if ("error" in limit) return { success: false, error: limit.error };
  const days = parseCredit(input.credit_days, "Credit days");
  if ("error" in days) return { success: false, error: days.error };

  const { data: existing } = await supabase.from("profiles").select("id, role").eq("id", customerId).maybeSingle();
  const target = existing as { id: string; role: string } | null;
  if (!target) return { success: false, error: "Customer not found." };
  if (target.role === "admin" || target.role === "platform_owner") {
    return { success: false, error: "Administrator accounts cannot be edited here." };
  }

  const payload = {
    title: input.title,
    first_name: first,
    last_name: last,
    company_name: company,
    designation: t(input.designation) || "Commercial Contact",
    department: t(input.department) || "Procurement",
    mobile,
    landline: t(input.landline) || null,
    gstin: gstin || null,
    company_address: address,
    additional_address: t(input.additional_address) || null,
    city,
    state,
    pincode,
    credit_limit: limit.value,
    credit_days: days.value,
    notes: t(input.notes) || null,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from("profiles")
    .update(payload as never)
    .eq("id", customerId)
    .select("*")
    .single();
  if (error) {
    console.error("[adminUpdateCustomer]", error.code, error.message);
    // Admin-only action: show the real reason so a database problem is diagnosable from the screen.
    return { success: false, error: `Could not save the changes: ${error.message}` };
  }

  revalidatePath("/admin/customers");
  return { success: true, customer: data as unknown as Profile };
}

/**
 * Update authenticated customer's profile & company data
 */
export async function updateCustomerProfile(
  updates: Partial<Profile>
): Promise<{ success: boolean; error?: string }> {
  const supabase = createAdminClient();

  let user: { userId: string };
  try {
    user = await requireUser();
  } catch {
    return { success: false, error: "You must be logged in to update your profile." };
  }

  try {
    const payload: Partial<Profile> = {
      company_name: updates.company_name,
      first_name: updates.first_name,
      last_name: updates.last_name,
      mobile: updates.mobile,
      landline: updates.landline,
      gstin: updates.gstin,
      company_address: updates.company_address,
      additional_address: updates.additional_address,
      city: updates.city,
      state: updates.state,
      pincode: updates.pincode,
      department: updates.department,
      designation: updates.designation,
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabase
      .from("profiles")
      .update(payload as never)
      .eq("id", user.userId);

    if (error) {
      return { success: false, error: error.message };
    }

    revalidatePath("/dashboard", "layout");
    return { success: true };
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to update profile.",
    };
  }
}
