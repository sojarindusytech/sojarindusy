"use server";

import { requireAdmin, requireUser } from "@/lib/auth-guard";
import { createAdminClient } from "@/lib/supabase/admin";
import { loadSalesSettings } from "@/lib/sales-settings";
import { creditNoteInputSchema, type CreditNote, type CreditNoteInput } from "@/lib/credit-note";
import type { Invoice } from "@/types/database.types";
import { revalidatePath } from "next/cache";

export async function listCreditNotes(customer = false): Promise<CreditNote[]> {
  const auth = customer ? await requireUser() : await requireAdmin();
  let query = createAdminClient().from("credit_notes").select("*").order("created_at", { ascending: false });
  if (customer) query = query.eq("user_id", auth.userId);
  const { data, error } = await query;
  if (error) throw new Error("Credit notes could not be loaded. Check that the credit note migration has been applied.");
  return data ?? [];
}

export async function getCreditNoteFormData() {
  await requireAdmin();
  const [settings, result] = await Promise.all([
    loadSalesSettings(),
    createAdminClient().from("invoices").select("*").eq("status", "issued").order("invoice_date", { ascending: false }),
  ]);
  if (result.error) throw new Error("Invoices could not be loaded.");
  if (!settings?.credit_note_prefix) throw new Error("Apply the credit note migration before issuing notes.");
  if (typeof settings.credit_note_restores_stock !== "boolean") throw new Error("Apply the credit note stock migration before issuing notes.");
  return { settings: { credit_note_restores_stock: settings.credit_note_restores_stock, credit_note_prefix: settings.credit_note_prefix, credit_note_fy: settings.credit_note_fy, credit_note_next_number: settings.credit_note_next_number, credit_note_pad: settings.credit_note_pad }, invoices: (result.data ?? []) as Invoice[] };
}
export type CreditNoteFormData = Awaited<ReturnType<typeof getCreditNoteFormData>>;

export async function issueCreditNote(input: CreditNoteInput): Promise<{ success: true; note: CreditNote } | { success: false; error: string }> {
  try {
    const auth = await requireAdmin();
    const parsed = creditNoteInputSchema.safeParse(input);
    if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? "Check the form." };
    // The legacy hand-written Database interfaces do not satisfy the SDK's
    // Record constraint. Keep the bridge typed, as in lib/server/rpc.ts.
    const client = createAdminClient();
    const rpc = client.rpc.bind(client) as unknown as (
      name: "issue_credit_note", args: { p_input: CreditNoteInput; p_actor: string }
    ) => PromiseLike<{ data: CreditNote | null; error: { code: string; message: string } | null }>;
    const { data, error } = await rpc("issue_credit_note", { p_input: parsed.data, p_actor: auth.userId });
    if (error) {
      console.error("[issueCreditNote]", error);
      return { success: false, error: error.code === "23505" ? "That credit note number or submission has already been used." : error.code === "P0001" ? error.message : "Credit note could not be issued. Check the migration and submitted details." };
    }
    if (!data) return { success: false, error: "The credit note response was empty. Retry the same submission." };
    for (const path of ["/admin/credit-notes", "/admin/invoices", "/admin/settings/sales", "/dashboard/credit-notes", "/admin/products", "/", "/products"]) revalidatePath(path);
    return { success: true, note: data as CreditNote };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Credit note could not be issued." };
  }
}
