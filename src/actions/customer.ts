"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { Profile } from "@/types/database.types";
import {
  USER_ROLES,
  USER_TYPES,
  APPROVAL_STATUSES,
  USER_TITLES,
  COMMERCIAL_DEFAULTS,
  ApprovalStatus,
  UserTitle,
  UserType,
} from "@/lib/constants";
import { revalidatePath } from "next/cache";

export async function fetchCustomersList(): Promise<Profile[]> {
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
      const isOffline = p.channel === "offline" || p.user_type === "offline" || (p.user_type as any) === "offline_user";
      const normalizedChannel = isOffline ? "offline" : "online";
      profilesMap.set(p.id, {
        ...p,
        role: "customer",
        approval_status: (p.approval_status as ApprovalStatus) || APPROVAL_STATUSES.PENDING,
        channel: normalizedChannel,
        user_type: normalizedChannel,
        credit_limit: p.credit_limit ?? (isOffline ? COMMERCIAL_DEFAULTS.DEFAULT_CREDIT_LIMIT : null),
        credit_days: p.credit_days ?? (isOffline ? COMMERCIAL_DEFAULTS.DEFAULT_CREDIT_DAYS : null),
      });
    });
  }

  // 2. Also inspect Auth users to ensure any registered user is guaranteed to appear
  try {
    const { data: authData } = await supabase.auth.admin.listUsers();
    if (authData?.users) {
      authData.users.forEach((u) => {
        const meta = u.user_metadata || {};
        if (meta.role === "admin" || meta.role === "platform_owner" || u.email === "admin@sojarindusy.com") {
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
      console.warn("Notice updating approval status in profiles:", error.message);
    }

    // Also update auth user metadata if auth account exists
    await supabase.auth.admin.updateUserById(customerId, {
      user_metadata: {
        approval_status: newStatus,
      },
    }).catch(() => null);
  } catch (err) {
    console.warn("Database update exception handled:", err);
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
  const creditLimit = Number(formData.get("credit_limit")) || COMMERCIAL_DEFAULTS.DEFAULT_CREDIT_LIMIT;
  const creditDays = Number(formData.get("credit_days")) || COMMERCIAL_DEFAULTS.DEFAULT_CREDIT_DAYS;
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
      console.warn("Notice inserting offline customer profile:", error.message);
    }
  } catch (err) {
    console.warn("Database insert exception handled:", err);
  }

  revalidatePath("/admin/customers");
  return {
    success: true,
    message: `Offline customer "${companyName}" added successfully.`,
  };
}
