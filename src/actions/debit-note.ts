"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin, requireUser } from "@/lib/auth-guard";
import { loadSalesSettings } from "@/lib/sales-settings";
import { amountInWords, computeInvoice, stateCodeOf } from "@/lib/invoice";
import { issueDebitNoteSchema, type IssueDebitNoteInput } from "@/lib/validations/debit-note";
import { buildDebitNoteLines } from "@/lib/debit-notes";
import { issueDebitNote as issueDebitNoteRpc, cancelDebitNote as cancelDebitNoteRpc } from "@/lib/server/rpc";
import { debitNoteErrorMessage } from "@/lib/server/debit-notes";
import { filterCustomerVisibleInvoices } from "@/lib/server/invoice-access";
import { notifyAll } from "@/lib/server/notifications";
import type { DebitNote, Invoice, SalesSettings } from "@/types/database.types";
import type { InvoicePaymentStatus } from "@/lib/payments";

/** PostgREST / Postgres codes for "this table does not exist": the migration has not been applied. */
const isMissingTable = (e: { code?: string }) => e.code === "PGRST205" || e.code === "42P01";
const MIGRATION_HINT = "The debit notes table is missing. Apply supabase/migrations/20261019_02_debit_notes.sql, then reload.";

type Result<T> = ({ success: true } & T) | { success: false; error: string };

const inr = (n: number) => `₹${n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/** Light row for the list screens (no line items). */
export type DebitNoteListRow = Pick<
  DebitNote,
  | "id" | "debit_note_number" | "debit_note_date" | "invoice_id" | "invoice_number" | "invoice_date"
  | "bill_to" | "reason" | "reason_note" | "gst_enabled" | "total_amount" | "status" | "cancel_reason" | "created_at"
> & {
  /** Money received against it (admin list only; from the debit_note_payment_summary view). */
  paid?: number;
  balance?: number;
  payment_status?: InvoicePaymentStatus;
};

const LIST_COLUMNS =
  "id, debit_note_number, debit_note_date, invoice_id, invoice_number, invoice_date, bill_to, reason, reason_note, gst_enabled, total_amount, status, cancel_reason, created_at";

const toListRow = (r: DebitNoteListRow): DebitNoteListRow => ({ ...r, total_amount: Number(r.total_amount) });

export async function listDebitNotes(): Promise<DebitNoteListRow[]> {
  await requireAdmin();
  const { data, error } = await createAdminClient()
    .from("debit_notes" as never)
    .select(LIST_COLUMNS)
    .order("created_at", { ascending: false });
  if (error) {
    console.error("[listDebitNotes] Query error:", error.code, error.message);
    // An empty list would hide a missing migration; say what is wrong instead.
    if (isMissingTable(error)) throw new Error(MIGRATION_HINT);
    return [];
  }
  const rows = ((data as unknown as DebitNoteListRow[]) ?? []).map(toListRow);

  // Paid / balance / status come from the payments module (20261023). Before that migration the
  // view is missing and the list simply shows no payment columns.
  const { data: sums } = await createAdminClient()
    .from("debit_note_payment_summary" as never)
    .select("debit_note_id, paid, balance, payment_status");
  const byId = new Map(
    ((sums as unknown as { debit_note_id: string; paid: number | string; balance: number | string; payment_status: InvoicePaymentStatus }[] | null) ?? []).map(
      (r) => [r.debit_note_id, r]
    )
  );
  return rows.map((r) => {
    const s = byId.get(r.id);
    return s ? { ...r, paid: Number(s.paid), balance: Number(s.balance), payment_status: s.payment_status } : r;
  });
}

/** An invoice a debit note can be issued against. */
export interface DebitNoteInvoiceOption {
  id: string;
  invoice_number: string;
  invoice_date: string;
  customer: string;
  total: number;
  gst_enabled: boolean;
  place_of_supply: string | null;
}

export interface DebitNoteFormData {
  settings: Pick<
    SalesSettings,
    | "debit_note_prefix" | "debit_note_fy" | "debit_note_next_number" | "debit_note_pad"
    | "default_gst_rate" | "state_code" | "state_name"
  > | null;
  /** Issued invoices, newest first. */
  invoices: DebitNoteInvoiceOption[];
}

/** Everything the Issue Debit Note form needs besides the chosen invoice's lines. */
export async function getDebitNoteFormData(): Promise<DebitNoteFormData> {
  await requireAdmin();
  const [settings, invoicesRes] = await Promise.all([
    loadSalesSettings(),
    createAdminClient()
      .from("invoices" as never)
      .select("id, invoice_number, invoice_date, bill_to, total_amount, gst_enabled, place_of_supply")
      .eq("status", "issued")
      .order("invoice_date", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(2000),
  ]);

  return {
    settings: settings
      ? {
          debit_note_prefix: settings.debit_note_prefix ?? "SI/DN",
          debit_note_fy: settings.debit_note_fy ?? null,
          debit_note_next_number: settings.debit_note_next_number ?? 1,
          debit_note_pad: settings.debit_note_pad ?? 2,
          default_gst_rate: settings.default_gst_rate,
          state_code: settings.state_code,
          state_name: settings.state_name,
        }
      : null,
    invoices: (
      (invoicesRes.data as unknown as Pick<
        Invoice, "id" | "invoice_number" | "invoice_date" | "bill_to" | "total_amount" | "gst_enabled" | "place_of_supply"
      >[]) ?? []
    ).map((i) => ({
      id: i.id,
      invoice_number: i.invoice_number,
      invoice_date: i.invoice_date,
      customer: i.bill_to?.name ?? "",
      total: Number(i.total_amount) || 0,
      gst_enabled: !!i.gst_enabled,
      place_of_supply: i.place_of_supply ?? null,
    })),
  };
}

/**
 * Issues a debit note against an invoice. Amounts use the invoice maths with the
 * invoice's own GST basis (billing on/off, place of supply); the database
 * re-checks the invoice, the date, the GST type and the number, and stores it
 * atomically. A retried submit (same requestId) returns the same note.
 */
export async function issueDebitNote(input: IssueDebitNoteInput): Promise<Result<{ debitNote: DebitNote }>> {
  let actorId: string;
  try {
    actorId = (await requireAdmin()).userId;
  } catch {
    return { success: false, error: "Administrator access required." };
  }

  const parsed = issueDebitNoteSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Check the debit note details." };
  }
  const v = parsed.data;

  try {
    const db = createAdminClient();
    const [settings, invoiceRes] = await Promise.all([
      loadSalesSettings(),
      db
        .from("invoices" as never)
        .select("id, invoice_number, status, gst_enabled, place_of_supply, order_id, user_id, items")
        .eq("id", v.invoiceId)
        .maybeSingle(),
    ]);
    if (!settings) return { success: false, error: "Sales settings are not configured." };
    const invoice = invoiceRes.data as unknown as Pick<
      Invoice, "id" | "invoice_number" | "status" | "gst_enabled" | "place_of_supply" | "order_id" | "user_id" | "items"
    > | null;
    if (!invoice) return { success: false, error: "Invoice not found." };
    if (invoice.status !== "issued") {
      return { success: false, error: `Invoice ${invoice.invoice_number} is cancelled, so a debit note can't be issued against it.` };
    }

    // Lines are priced from the stored invoice (billed rates, quantities, GST), not the browser.
    const built = buildDebitNoteLines(
      { gst_enabled: invoice.gst_enabled, items: Array.isArray(invoice.items) ? invoice.items : [] },
      v.reason,
      v.adjustments
    );
    if (!built.ok) return { success: false, error: built.error };

    // Same GST basis as the invoice it adjusts.
    const placeOfSupply = invoice.place_of_supply || `${settings.state_code}-${settings.state_name}`;
    const computed = computeInvoice({
      items: built.lines,
      gstEnabled: invoice.gst_enabled,
      defaultGstRate: settings.default_gst_rate,
      sellerStateCode: settings.state_code,
      placeOfSupplyStateCode: stateCodeOf(placeOfSupply),
    });
    // The total is rounded to the rupee, like an invoice's.
    if (computed.totals.total < 1) return { success: false, error: "The debit note total must be at least ₹1." };

    const { data, error } = await issueDebitNoteRpc(
      {
        request_id: v.requestId,
        invoice_id: invoice.id,
        debit_note_date: v.debitNoteDate,
        reason: v.reason,
        reason_note: v.reasonNote,
        manual_number: v.manualNumber,
        items: computed.lines,
        totals: computed.totals,
        total_amount: computed.totals.total,
        amount_in_words: amountInWords(computed.totals.total),
      },
      actorId
    );
    if (error) {
      if (error.code === "DATABASE_ERROR") console.error("[issueDebitNote]", error.raw);
      return { success: false, error: debitNoteErrorMessage(error) };
    }

    // Tell the customer, once they can see the invoice it adjusts.
    const visible = (await filterCustomerVisibleInvoices([{ order_id: invoice.order_id }])).length === 1;
    if (data.user_id && visible) {
      await notifyAll([
        {
          userId: data.user_id,
          title: "Debit note issued",
          message: `Debit note ${data.debit_note_number} for ${inr(Number(data.total_amount))} was issued against invoice ${data.invoice_number}.`,
          type: "payment",
          link: "/dashboard/invoices",
          metadata: { debit_note_number: data.debit_note_number, invoice_number: data.invoice_number, amount: Number(data.total_amount) },
        },
      ]);
    }

    revalidatePath("/admin/debit-notes");
    revalidatePath("/admin/invoices");
    revalidatePath("/admin/settings/sales");
    revalidatePath("/dashboard/invoices");
    return { success: true, debitNote: { ...data, total_amount: Number(data.total_amount) } };
  } catch (err) {
    console.error("[issueDebitNote] Exception:", err);
    return { success: false, error: "Could not issue the debit note. Please try again." };
  }
}

/** Cancel, never delete: the number stays in the books. */
export async function cancelDebitNote(debitNoteId: string, reason: string): Promise<{ success: boolean; error?: string }> {
  let actorId: string;
  try {
    actorId = (await requireAdmin()).userId;
  } catch {
    return { success: false, error: "Administrator access required." };
  }

  const { data, error } = await cancelDebitNoteRpc(debitNoteId, String(reason ?? "").slice(0, 500), actorId);
  if (error) return { success: false, error: debitNoteErrorMessage(error) };

  if (!data.already_cancelled && data.user_id) {
    await notifyAll([
      {
        userId: data.user_id,
        title: "Debit note cancelled",
        message: `Debit note ${data.debit_note_number} has been cancelled and is no longer payable.`,
        type: "payment",
        link: "/dashboard/invoices",
        metadata: { debit_note_number: data.debit_note_number },
      },
    ]);
  }

  revalidatePath("/admin/debit-notes");
  revalidatePath("/admin/invoices");
  revalidatePath("/dashboard/invoices");
  return { success: true };
}

/**
 * The signed-in customer's own issued debit notes, only for invoices they can see
 * (an order's invoice once the order is delivered). Never accepts a user id from the client.
 */
export async function fetchCustomerDebitNotes(): Promise<DebitNoteListRow[]> {
  const ctx = await requireUser();
  const { data, error } = await createAdminClient()
    .from("debit_notes" as never)
    .select(`${LIST_COLUMNS}, invoice:invoices(order_id)`)
    .eq("user_id", ctx.userId)
    .eq("status", "issued")
    .order("created_at", { ascending: false });
  if (error) {
    // Before the migration there are simply no debit notes to show.
    if (!isMissingTable(error)) console.error("[fetchCustomerDebitNotes] Query error:", error.code, error.message);
    return [];
  }

  const rows = (data as unknown as (DebitNoteListRow & { invoice: { order_id: string | null } | null })[]) ?? [];
  const visible = new Set(
    (await filterCustomerVisibleInvoices(rows.map((r) => ({ id: r.id, order_id: r.invoice?.order_id ?? null })))).map((r) => r.id)
  );
  return rows
    .filter((r) => visible.has(r.id))
    .map((r) => {
      const { invoice, ...row } = r;
      void invoice; // only needed for the visibility check above
      return toListRow(row);
    });
}
