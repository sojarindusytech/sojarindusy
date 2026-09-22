"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/auth-guard";
import {
  ContactSubmission,
  ContactSubmissionStatus,
  ContactSubmissionInsert,
  ContactSubmissionUpdate,
} from "@/types/database.types";
import { revalidatePath } from "next/cache";

export interface ContactInquiryPayload {
  fullName: string;
  email: string;
  mobile?: string;
  message: string;
  privacyAccepted?: boolean;
}

export interface FetchSubmissionsResult {
  data: ContactSubmission[];
  error?: string;
  tableMissing?: boolean;
}

/**
 * Public Server Action to submit an inquiry from the storefront contact form
 */
export async function submitContactInquiry(payload: ContactInquiryPayload): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const { fullName, email, mobile, message, privacyAccepted } = payload;

    // 0. Privacy Policy acceptance validation
    if (privacyAccepted === false) {
      return { success: false, error: "You must agree to our Privacy Policy to submit your message." };
    }

    // 1. Full Name validation
    const trimmedName = fullName?.trim();
    if (!trimmedName) {
      return { success: false, error: "Please enter your full name." };
    }
    if (trimmedName.length < 2) {
      return { success: false, error: "Name must be at least 2 characters long." };
    }
    if (trimmedName.length > 100) {
      return { success: false, error: "Name must not exceed 100 characters." };
    }
    if (!/^[a-zA-Z\s.'-]+$/.test(trimmedName)) {
      return { success: false, error: "Name should only contain letters and standard characters." };
    }

    // 2. Email validation
    const trimmedEmail = email?.trim().toLowerCase();
    if (!trimmedEmail) {
      return { success: false, error: "Please enter your email address." };
    }
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!emailRegex.test(trimmedEmail) || trimmedEmail.length > 254) {
      return { success: false, error: "Please provide a valid email address (e.g. name@example.com)." };
    }

    // 3. Mobile validation (optional, but if provided must be valid)
    let cleanedMobile: string | null = null;
    if (mobile && mobile.trim()) {
      const rawMobile = mobile.trim().replace(/[\s-]/g, "");
      const indianPhoneRegex = /^(?:\+91|91)?[6-9]\d{9}$/;
      const generalPhoneRegex = /^\+?\d{10,14}$/;

      if (!indianPhoneRegex.test(rawMobile) && !generalPhoneRegex.test(rawMobile)) {
        return { success: false, error: "Please enter a valid 10-digit mobile number." };
      }
      cleanedMobile = rawMobile.startsWith("+") ? rawMobile : (rawMobile.length === 10 ? `+91${rawMobile}` : rawMobile);
    }

    // 4. Message validation
    const trimmedMessage = message?.trim();
    if (!trimmedMessage) {
      return { success: false, error: "Please enter your message or requirements." };
    }
    if (trimmedMessage.length < 10) {
      return { success: false, error: "Message must be at least 10 characters long so we can assist you better." };
    }
    if (trimmedMessage.length > 2000) {
      return { success: false, error: "Message cannot exceed 2000 characters." };
    }

    const supabase = createAdminClient();

    const insertData: ContactSubmissionInsert = {
      full_name: trimmedName,
      email: trimmedEmail,
      mobile: cleanedMobile,
      message: trimmedMessage,
      status: "unread",
      privacy_accepted: true,
      admin_notes: null,
    };

    let { error } = await supabase
      .from("contact_submissions")
      .insert(insertData as never);

    // Graceful fallback if database table does not yet have privacy_accepted column
    if (error && (error.code === "42703" || error.message?.includes("privacy_accepted"))) {
      const fallbackData = { ...insertData };
      delete fallbackData.privacy_accepted;
      const retry = await supabase
        .from("contact_submissions")
        .insert(fallbackData as never);
      error = retry.error;
    }

    if (error) {
      console.error("Supabase error submitting contact inquiry:", error);
      if (error.code === "42P01" || error.message?.includes("does not exist")) {
        return {
          success: false,
          error: "The contact submissions table is pending migration in Supabase. Please apply the migration first.",
        };
      }
      return { success: false, error: error.message || "Failed to submit your message." };
    }

    return { success: true };
  } catch (err: any) {
    console.error("Unexpected error submitting contact inquiry:", err);
    return {
      success: false,
      error: err?.message || "An unexpected error occurred. Please try again.",
    };
  }
}

/**
 * Administrative action to fetch all contact submissions
 */
export async function fetchContactSubmissions(): Promise<FetchSubmissionsResult> {
  await requireAdmin();
  try {
    const supabase = createAdminClient();

    const { data, error } = await supabase
      .from("contact_submissions")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.warn("Error fetching contact submissions:", error.message);
      if (error.code === "42P01" || error.message?.includes("does not exist")) {
        return {
          data: [],
          tableMissing: true,
          error: "Table 'contact_submissions' does not exist yet. Please run the SQL migration.",
        };
      }
      return { data: [], error: error.message };
    }

    return { data: (data as ContactSubmission[]) || [] };
  } catch (err: any) {
    console.error("Unexpected error in fetchContactSubmissions:", err);
    return { data: [], error: err?.message || "Failed to fetch contact submissions." };
  }
}

/**
 * Administrative action to update status or internal admin notes for an inquiry
 */
export async function updateContactSubmission(
  id: string,
  updates: {
    status?: ContactSubmissionStatus;
    admin_notes?: string | null;
  }
): Promise<{ success: boolean; error?: string }> {
  await requireAdmin();
  try {
    if (!id) return { success: false, error: "Missing submission ID" };

    const supabase = createAdminClient();

    const updatePayload: ContactSubmissionUpdate = {
      updated_at: new Date().toISOString(),
    };

    if (updates.status !== undefined) {
      updatePayload.status = updates.status;
    }
    if (updates.admin_notes !== undefined) {
      updatePayload.admin_notes = updates.admin_notes;
    }

    const { error } = await supabase
      .from("contact_submissions")
      .update(updatePayload as never)
      .eq("id", id);

    if (error) {
      return { success: false, error: error.message };
    }

    revalidatePath("/admin/inquiries");
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || "Failed to update inquiry." };
  }
}

/**
 * Administrative action to delete an inquiry
 */
export async function deleteContactSubmission(
  id: string
): Promise<{ success: boolean; error?: string }> {
  await requireAdmin();
  try {
    if (!id) return { success: false, error: "Missing submission ID" };

    const supabase = createAdminClient();

    const { error } = await supabase.from("contact_submissions").delete().eq("id", id);

    if (error) {
      return { success: false, error: error.message };
    }

    revalidatePath("/admin/inquiries");
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || "Failed to delete inquiry." };
  }
}
