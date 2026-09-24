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

export async function createOfflineCustomer(formData: FormData): Promise<{
  success?: boolean;
  error?: string;
  message?: string;
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

  const newOfflineProfile: Profile = {
    id: `off-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`,
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

  try {
    const { error } = await supabase
      .from("profiles")
      .insert(newOfflineProfile as never);

    if (error) {
      console.error("Failed to insert offline customer profile:", error.message);
      return { error: "Could not save the customer record. Please try again." };
    }
  } catch (err) {
    console.error("Offline customer insert failed:", err);
    return { error: "Could not save the customer record. Please try again." };
  }

  revalidatePath("/admin/customers");
  return {
    success: true,
    message: `Offline customer "${companyName}" added successfully.`,
  };
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
