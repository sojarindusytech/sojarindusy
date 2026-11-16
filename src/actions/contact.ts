"use server";
import { recordAudit } from "@/lib/server/audit";

import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/auth-guard";
import {
  ContactSubmission,
  ContactSubmissionStatus,
  ContactSubmissionInsert,
  ContactSubmissionUpdate,
} from "@/types/database.types";
import { revalidatePath } from "next/cache";
import { CONTACT_RATE_LIMIT, validateInquiry, type InquiryInput } from "@/lib/contact";
import { createNotification } from "@/lib/server/notifications";

export interface ContactInquiryPayload extends InquiryInput {
  /** Honeypot: a hidden field people never fill in. Bots that do are silently dropped. */
  website?: string;
}

const GENERIC_SUBMIT_ERROR = "We could not send your message right now. Please try again in a few minutes.";
const STATUSES: ContactSubmissionStatus[] = ["unread", "read", "replied", "archived"];
const ADMIN_NOTES_MAX = 5000;

export interface FetchSubmissionsResult {
  data: ContactSubmission[];
  error?: string;
  tableMissing?: boolean;
}

/**
 * Public Server Action for the storefront contact form. Runs with the service role (the table
 * has no public insert policy), so every check here is the only gate.
 */
export async function submitContactInquiry(payload: ContactInquiryPayload): Promise<{
  success: boolean;
  error?: string;
}> {
  // Honeypot filled in: pretend it worked so the bot learns nothing, store nothing.
  if (typeof payload?.website === "string" && payload.website.trim() !== "") {
    return { success: true };
  }

  const checked = validateInquiry(payload ?? ({} as InquiryInput));
  if ("error" in checked) return { success: false, error: checked.error };
  const clean = checked.data;

  try {
    const supabase = createAdminClient();

    // Rate limit per email address.
    const since = new Date(Date.now() - CONTACT_RATE_LIMIT.windowMinutes * 60_000).toISOString();
    const { count, error: countError } = await supabase
      .from("contact_submissions")
      .select("id", { count: "exact", head: true })
      .eq("email", clean.email)
      .gte("created_at", since);
    if (countError) {
      console.error("[submitContactInquiry] rate-limit lookup:", countError.message);
      return { success: false, error: GENERIC_SUBMIT_ERROR };
    }
    if ((count ?? 0) >= CONTACT_RATE_LIMIT.max) {
      return {
        success: false,
        error: "You have already sent us several messages. Please wait an hour before sending another.",
      };
    }

    const insertData: ContactSubmissionInsert = {
      ...clean,
      status: "unread",
      privacy_accepted: true,
      admin_notes: null,
    };
    const { error } = await supabase.from("contact_submissions").insert(insertData as never);
    if (error) {
      // Details stay in the server log; visitors get a generic message.
      console.error("[submitContactInquiry] insert:", error.code, error.message);
      return { success: false, error: GENERIC_SUBMIT_ERROR };
    }

    await createNotification({
      role: "admin",
      title: "New website inquiry",
      message: `${clean.full_name} (${clean.email}) sent a message from the contact form.`,
      type: "info",
      link: "/admin/inquiries",
    }).catch((err) => console.warn("[submitContactInquiry] admin notification skipped:", err));

    return { success: true };
  } catch (err) {
    console.error("[submitContactInquiry] unexpected:", err);
    return { success: false, error: GENERIC_SUBMIT_ERROR };
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
    if (updates.status !== undefined && !STATUSES.includes(updates.status)) {
      return { success: false, error: "Invalid status." };
    }
    if (updates.admin_notes && updates.admin_notes.length > ADMIN_NOTES_MAX) {
      return { success: false, error: `Admin notes cannot exceed ${ADMIN_NOTES_MAX} characters.` };
    }

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

    await recordAudit({ action: "inquiry.delete", entity: "inquiry", entityId: id, summary: "Deleted website inquiry" });
    revalidatePath("/admin/inquiries");
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || "Failed to delete inquiry." };
  }
}
