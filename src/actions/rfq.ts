"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/auth-guard";
import { RFQ, RFQStatus, RFQInsert, RFQUpdate, Profile } from "@/types/database.types";
import { createNotification } from "@/lib/server/notifications";
import { revalidatePath } from "next/cache";

/**
 * Next RFQ number from the DB counter (Sales Settings: prefix / FY / next number).
 * A customer submitting an RFQ must never fail over numbering, so if the counter is
 * unavailable (e.g. migration not applied) fall back to the old random number and log it.
 */
async function allocateRfqNumber(adminDb: ReturnType<typeof createAdminClient>): Promise<string> {
  const { data, error } = await (adminDb as any).rpc("next_rfq_number");
  if (!error && data) return data as string;
  console.error("[allocateRfqNumber] next_rfq_number failed, using fallback number:", error);
  const now = new Date();
  return `RFQ-${now.getFullYear().toString().slice(-2)}${(now.getMonth() + 1).toString().padStart(2, "0")}-${Math.floor(1000 + Math.random() * 9000)}`;
}

export async function fetchCustomerRfqsList(): Promise<RFQ[]> {
  try {
    const authClient = await createClient();
    const {
      data: { user },
    } = await authClient.auth.getUser();

    if (!user) {
      return [];
    }

    const adminDb = createAdminClient();
    const { data, error } = await adminDb
      .from("rfqs")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (error) {
      console.warn("Notice fetching RFQs from database:", error.message);
      return [];
    }

    return (data || []) as RFQ[];
  } catch (err) {
    console.error("Failed to fetch customer RFQs:", err);
    return [];
  }
}

export async function submitCustomerRfq(payload: {
  item_name: string;
  quantity: string;
  required_by_date?: string;
  specifications?: string;
  drawing_url?: string;
}): Promise<{ success: boolean; error?: string; rfq?: RFQ }> {
  try {
    const authClient = await createClient();
    const {
      data: { user },
    } = await authClient.auth.getUser();

    if (!user) {
      return { success: false, error: "Please log in to submit a Request for Quotation." };
    }

    if (!payload.item_name || !payload.item_name.trim()) {
      return { success: false, error: "Product / tooling description is required." };
    }

    if (!payload.quantity || !payload.quantity.trim()) {
      return { success: false, error: "Estimated quantity is required." };
    }

    if (
      payload.item_name.length > 300 ||
      payload.quantity.length > 100 ||
      (payload.specifications?.length ?? 0) > 5000 ||
      (payload.drawing_url?.length ?? 0) > 2000
    ) {
      return { success: false, error: "Some fields are too long. Please shorten them and try again." };
    }
    // The link is shown to admins: only allow web links (never javascript: or data:).
    if (payload.drawing_url?.trim() && !/^https?:\/\//i.test(payload.drawing_url.trim())) {
      return { success: false, error: "The drawing link must start with http:// or https://." };
    }

    const adminDb = createAdminClient();

    // Fetch user profile for company and contact info
    const { data: profile } = await adminDb
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single();

    const profileData = profile as Profile | null;

    const rfqNumber = await allocateRfqNumber(adminDb);

    const newRfqData: RFQInsert = {
      rfq_number: rfqNumber,
      user_id: user.id,
      company_name: profileData?.company_name || user.user_metadata?.company_name || "Enterprise Client",
      contact_person: profileData ? `${profileData.title || "Mr"} ${profileData.first_name} ${profileData.last_name}` : "Authorized Contact",
      email: user.email,
      mobile: profileData?.mobile || user.user_metadata?.mobile || null,
      item_name: payload.item_name.trim(),
      quantity: payload.quantity.trim(),
      required_by_date: payload.required_by_date || null,
      specifications: payload.specifications?.trim() || null,
      drawing_url: payload.drawing_url?.trim() || null,
      status: "pending",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await (adminDb
      .from("rfqs") as any)
      .insert(newRfqData)
      .select()
      .single();

    if (error) {
      return { success: false, error: error.message };
    }

    // Send notifications for RFQ
    try {
      // Notify Admin
      await createNotification({
        role: "admin",
        title: "New RFQ Received",
        message: `RFQ submitted by ${newRfqData.company_name} for "${newRfqData.item_name}" (${newRfqData.quantity}).`,
        type: "rfq",
        link: "/admin/rfqs",
        metadata: { rfq_id: data.id, item: newRfqData.item_name },
      });

      // Notify Customer
      await createNotification({
        userId: user.id,
        title: "RFQ Submitted Successfully",
        message: `Your Request for Quotation for "${newRfqData.item_name}" has been received. Our sales engineering team will review it.`,
        type: "rfq",
        link: "/dashboard/rfqs",
        metadata: { rfq_id: data.id },
      });
    } catch (notifErr) {
      console.warn("[submitCustomerRfq] Notification error:", notifErr);
    }

    revalidatePath("/dashboard/rfqs");
    revalidatePath("/admin/rfqs");
    revalidatePath("/admin/quotes");

    return { success: true, rfq: data as RFQ };
  } catch (err: any) {
    return { success: false, error: err?.message || "Failed to submit RFQ." };
  }
}

/**
 * Record an RFQ on a customer's behalf (phone / email / walk-in). The RFQ number is
 * the next one from Sales Settings unless `manualNumber` is given, in which case it
 * is checked for duplicates and does not move the counter.
 */
export async function createManualRfq(payload: {
  customerId?: string | null;
  company_name: string;
  contact_person?: string | null;
  email?: string | null;
  mobile?: string | null;
  item_name: string;
  quantity: string;
  required_by_date?: string | null;
  specifications?: string | null;
  manualNumber?: string | null;
}): Promise<{ success: boolean; error?: string; rfq?: RFQ }> {
  try {
    await requireAdmin();
    const adminDb = createAdminClient();

    const company = payload.company_name?.trim();
    const item = payload.item_name?.trim();
    const quantity = payload.quantity?.trim();
    if (!company) return { success: false, error: "Company / customer name is required." };
    if (!item) return { success: false, error: "Product / tooling description is required." };
    if (!quantity) return { success: false, error: "Quantity is required." };
    if (payload.required_by_date && !/^\d{4}-\d{2}-\d{2}$/.test(payload.required_by_date)) {
      return { success: false, error: "Required-by date is invalid." };
    }
    const manualNumber = payload.manualNumber?.trim() || null;
    if (manualNumber && manualNumber.length > 50) return { success: false, error: "RFQ number is too long." };

    let rfqNumber: string;
    if (manualNumber) {
      const { data: dup } = await (adminDb.from("rfqs") as any).select("id").eq("rfq_number", manualNumber).maybeSingle();
      if (dup) return { success: false, error: `RFQ number "${manualNumber}" already exists.` };
      rfqNumber = manualNumber;
    } else {
      rfqNumber = await allocateRfqNumber(adminDb);
    }

    const now = new Date().toISOString();
    const row = {
      rfq_number: rfqNumber,
      // Linking a customer makes the RFQ appear in their dashboard; walk-ins stay unlinked.
      user_id: payload.customerId || null,
      company_name: company,
      contact_person: payload.contact_person?.trim() || null,
      email: payload.email?.trim() || null,
      mobile: payload.mobile?.trim() || null,
      item_name: item,
      quantity,
      required_by_date: payload.required_by_date || null,
      specifications: payload.specifications?.trim() || null,
      status: "pending",
      created_at: now,
      updated_at: now,
    };

    const { data, error } = await (adminDb.from("rfqs") as any).insert(row).select().single();
    if (error) {
      if (error.code === "23505") return { success: false, error: `RFQ number "${rfqNumber}" already exists.` };
      return { success: false, error: error.message };
    }

    revalidatePath("/admin/rfqs");
    revalidatePath("/dashboard/rfqs");
    revalidatePath("/admin/quotes");
    return { success: true, rfq: data as RFQ };
  } catch (err) {
    console.error("[createManualRfq] Exception:", err);
    return { success: false, error: err instanceof Error ? err.message : "Failed to create RFQ." };
  }
}

export async function fetchAllRfqsList(): Promise<RFQ[]> {
  await requireAdmin();
  try {
    const adminDb = createAdminClient();
    const { data, error } = await adminDb
      .from("rfqs")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.warn("Notice fetching all RFQs for admin:", error.message);
      return [];
    }

    return (data || []) as RFQ[];
  } catch (err) {
    console.error("Failed to fetch all RFQs:", err);
    return [];
  }
}

export async function updateRfqQuotation(
  rfqId: string,
  updates: {
    status: RFQStatus;
    quoted_amount?: number | null;
    admin_notes?: string | null;
  }
): Promise<{ success: boolean; error?: string }> {
  await requireAdmin();
  try {
    const adminDb = createAdminClient();

    const payload: RFQUpdate = {
      status: updates.status,
      quoted_amount: updates.quoted_amount !== undefined ? updates.quoted_amount : undefined,
      admin_notes: updates.admin_notes !== undefined ? updates.admin_notes : undefined,
      updated_at: new Date().toISOString(),
    };

    const { error } = await adminDb
      .from("rfqs")
      .update(payload as never)
      .eq("id", rfqId);

    if (error) {
      return { success: false, error: error.message };
    }

    revalidatePath("/admin/rfqs");
    revalidatePath("/admin/quotes");
    revalidatePath("/dashboard/rfqs");

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || "Failed to update quotation." };
  }
}
