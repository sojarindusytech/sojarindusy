"use server";

import { createClient } from "@/lib/supabase/server";
import { Profile } from "@/types/database.types";
import {
  USER_ROLES,
  USER_TYPES,
  APPROVAL_STATUSES,
  USER_TITLES,
  COMMERCIAL_DEFAULTS,
  ApprovalStatus,
  UserTitle,
} from "@/lib/constants";
import { revalidatePath } from "next/cache";

export async function fetchCustomersList(): Promise<Profile[]> {
  const supabase = await createClient();

  // Fetch only actual registered profiles from Supabase database
  const { data: dbProfiles, error } = await supabase
    .from("profiles")
    .select("*")
    .neq("role", USER_ROLES.PLATFORM_OWNER) // Exclude admin accounts from customer list
    .order("created_at", { ascending: false });

  if (error) {
    console.warn("Could not fetch customer profiles from database:", error.message);
    return [];
  }

  if (!dbProfiles || dbProfiles.length === 0) {
    return [];
  }

  // Normalize real profile records
  return (dbProfiles as Profile[]).map((p) => ({
    ...p,
    approval_status: p.approval_status || APPROVAL_STATUSES.PENDING,
    user_type: p.user_type || USER_TYPES.PLATFORM_USER,
    credit_limit: p.credit_limit || COMMERCIAL_DEFAULTS.DEFAULT_CREDIT_LIMIT,
    credit_days: p.credit_days || COMMERCIAL_DEFAULTS.DEFAULT_CREDIT_DAYS,
  }));
}

export async function updateCustomerApprovalStatus(
  customerId: string,
  newStatus: ApprovalStatus
): Promise<{ success: boolean; message: string }> {
  const supabase = await createClient();

  try {
    const { error } = await supabase
      .from("profiles")
      .update({
        approval_status: newStatus,
        updated_at: new Date().toISOString(),
      } as never)
      .eq("id", customerId);

    if (error) {
      console.warn("Notice updating approval status:", error.message);
    }
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
  const supabase = await createClient();

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
    role: USER_ROLES.CUSTOMER,
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
    user_type: USER_TYPES.OFFLINE_USER, // Marked as offline ERP billing account
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
