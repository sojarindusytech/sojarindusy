"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { RFQ, RFQStatus, Profile } from "@/types/database.types";
import { revalidatePath } from "next/cache";

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

    const adminDb = createAdminClient();

    // Fetch user profile for company and contact info
    const { data: profile } = await adminDb
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single();

    const profileData = profile as Profile | null;

    const rfqNumber = `RFQ-${new Date().getFullYear().toString().slice(-2)}${(new Date().getMonth() + 1).toString().padStart(2, "0")}-${Math.floor(1000 + Math.random() * 9000)}`;

    const newRfqData = {
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
      status: "pending" as RFQStatus,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await adminDb
      .from("rfqs")
      .insert(newRfqData as never)
      .select()
      .single();

    if (error) {
      return { success: false, error: error.message };
    }

    revalidatePath("/dashboard/rfqs");
    revalidatePath("/admin/quotes");

    return { success: true, rfq: data as RFQ };
  } catch (err: any) {
    return { success: false, error: err?.message || "Failed to submit RFQ." };
  }
}

export async function fetchAllRfqsList(): Promise<RFQ[]> {
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
  try {
    const adminDb = createAdminClient();

    const payload = {
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

    revalidatePath("/admin/quotes");
    revalidatePath("/dashboard/rfqs");

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || "Failed to update quotation." };
  }
}
