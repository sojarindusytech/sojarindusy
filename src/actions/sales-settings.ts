"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/auth-guard";
import { salesSettingsSchema, type SalesSettingsInput } from "@/lib/validations/sales-settings";
import type { SalesSettings } from "@/types/database.types";
import { financialYear } from "@/lib/invoice";
import { loadSalesSettings } from "@/lib/sales-settings";
import { isManufacturer } from "@/lib/server/purchase-orders";
import { revalidatePath } from "next/cache";

const ASSET_BUCKET = "invoice-assets";
const ASSET_KINDS = ["logo", "signature"] as const;
type AssetKind = (typeof ASSET_KINDS)[number];

export async function getSalesSettings(): Promise<SalesSettings | null> {
  await requireAdmin();
  return loadSalesSettings();
}

export async function updateSalesSettings(
  input: SalesSettingsInput,
  originalCreditCounter?: number
): Promise<{ success: boolean; error?: string; fieldErrors?: Record<string, string> }> {
  try {
    await requireAdmin();

    const parsed = salesSettingsSchema.safeParse(input);
    if (!parsed.success) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const key = String(issue.path[0] ?? "form");
        fieldErrors[key] ??= issue.message;
      }
      return { success: false, error: "Please fix the highlighted fields.", fieldErrors };
    }

    if (parsed.data.po_manufacturer_id && !(await isManufacturer(parsed.data.po_manufacturer_id))) {
      return {
        success: false,
        error: "Please fix the highlighted fields.",
        fieldErrors: { po_manufacturer_id: "That account is not a manufacturer." },
      };
    }

    // An edited counter is meant for the current financial year. Stamp the FY so
    // next_invoice_number() doesn't see a stale FY and reset it to 1. An
    // unchanged counter is left alone so an untouched new year still starts at 1.
    const current = await loadSalesSettings();
    if (!current) return { success: false, error: "Sales settings are not configured." };
    const counterEdited = current?.invoice_next_number !== parsed.data.invoice_next_number;
    const rfqCounterEdited = current?.rfq_next_number !== parsed.data.rfq_next_number;
    const quoteCounterEdited = current?.quote_next_number !== parsed.data.quote_next_number;
    const creditCounterEdited = originalCreditCounter === undefined
      ? current?.credit_note_next_number !== parsed.data.credit_note_next_number
      : originalCreditCounter !== parsed.data.credit_note_next_number;
    if (creditCounterEdited && originalCreditCounter !== undefined && current?.credit_note_next_number !== originalCreditCounter) {
      return { success: false, error: "The credit note counter changed. Reload Sales Settings before editing it." };
    }
    const { credit_note_next_number, ...values } = parsed.data;
    const receiptCounterEdited = current?.receipt_next_number !== parsed.data.receipt_next_number;
    const orderCounterEdited = current?.order_next_number !== parsed.data.order_next_number;
    const poCounterEdited = current?.po_next_number !== parsed.data.po_next_number;
    const debitNoteCounterEdited = current?.debit_note_next_number !== parsed.data.debit_note_next_number;

    let update = createAdminClient().from("sales_settings")
      .update({
        ...values,
        ...(creditCounterEdited ? { credit_note_next_number, credit_note_fy: financialYear() } : {}),
        ...(counterEdited ? { invoice_fy: financialYear() } : {}),
        ...(poCounterEdited ? { po_fy: financialYear() } : {}),
        ...(orderCounterEdited ? { order_fy: financialYear() } : {}),
        ...(receiptCounterEdited ? { receipt_fy: financialYear() } : {}),
        ...(quoteCounterEdited ? { quote_fy: financialYear() } : {}),
        ...(rfqCounterEdited ? { rfq_fy: financialYear() } : {}),
        ...(debitNoteCounterEdited ? { debit_note_fy: financialYear() } : {}),
        updated_at: new Date().toISOString(),
      } as never)
      .eq("id", true);
    if (creditCounterEdited) {
      // Check again inside UPDATE so issuance between the read and write cannot rewind the counter.
      update = update.eq("credit_note_next_number", current.credit_note_next_number);
      update = current.credit_note_fy === null ? update.is("credit_note_fy", null) : update.eq("credit_note_fy", current.credit_note_fy);
    }
    const { data: saved, error } = await update.select("id").maybeSingle();

    if (error) {
      console.error("[updateSalesSettings] Update error:", error);
      return { success: false, error: error.message };
    }

    if (!saved) return { success: false, error: "Sales settings changed while saving. Reload and try again." };

    revalidatePath("/admin/settings/sales");
    revalidatePath("/admin/invoices");
    revalidatePath("/admin/credit-notes");
    revalidatePath("/admin/debit-notes");
    return { success: true };
  } catch (err) {
    console.error("[updateSalesSettings] Exception:", err);
    return { success: false, error: err instanceof Error ? err.message : "Failed to save settings." };
  }
}

/**
 * Upload the invoice logo or signature. Returns the public URL; the caller
 * puts it in the form and persists it with the normal Save.
 */
export async function uploadInvoiceAsset(
  formData: FormData
): Promise<{ publicUrl?: string; error?: string }> {
  try {
    await requireAdmin();

    const kind = formData.get("kind") as AssetKind | null;
    const file = formData.get("file") as File | null;
    if (!kind || !ASSET_KINDS.includes(kind)) return { error: "Unknown asset type." };
    if (!file || file.size === 0) return { error: "No file provided." };
    // @react-pdf/renderer can only draw PNG/JPEG.
    if (file.type !== "image/png" && file.type !== "image/jpeg") {
      return { error: "Only PNG or JPG images are supported on invoices." };
    }
    if (file.size > 2 * 1024 * 1024) return { error: "Image must be 2 MB or smaller." };

    const ext = file.type === "image/png" ? "png" : "jpg";
    const filePath = `${kind}_${Date.now()}.${ext}`;
    const supabase = createAdminClient();

    const { error } = await supabase.storage
      .from(ASSET_BUCKET)
      .upload(filePath, Buffer.from(await file.arrayBuffer()), { contentType: file.type, upsert: true });

    if (error) {
      if (error.message.includes("Bucket not found")) {
        return { error: `Storage bucket '${ASSET_BUCKET}' does not exist yet. Run the 20261010 SQL migration.` };
      }
      return { error: error.message };
    }

    return { publicUrl: supabase.storage.from(ASSET_BUCKET).getPublicUrl(filePath).data.publicUrl };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to upload image." };
  }
}
