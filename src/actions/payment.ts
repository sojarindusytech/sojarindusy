"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin, requireUser } from "@/lib/auth-guard";
import { loadSalesSettings } from "@/lib/sales-settings";
import { recordPaymentSchema, type RecordPaymentInput } from "@/lib/validations/payment";
import { recordPayment as recordPaymentRpc, cancelPayment as cancelPaymentRpc } from "@/lib/server/rpc";
import { paymentErrorMessage } from "@/lib/server/payment-errors";
import { notifyAll } from "@/lib/server/notifications";
import { modeLabel, type OpenInvoice } from "@/lib/payments";
import type { Payment, SalesSettings } from "@/types/database.types";
import { loadMoneyAccounts, type MoneyAccount } from "@/lib/server/ledger";
import { revalidatePath } from "next/cache";

/** PostgREST / Postgres codes for "this table does not exist": the payments migration has not been applied. */
const isMissingTable = (e: { code?: string }) => e.code === "PGRST205" || e.code === "42P01";
const MIGRATION_HINT = "The payments tables are missing. Apply supabase/migrations/20261018_payments.sql, then reload.";

type Result<T> = ({ success: true } & T) | { success: false; error: string };

/** Admin list: every receipt with where its money went. */
export async function listPayments(): Promise<Payment[]> {
  await requireAdmin();
  const { data, error } = await createAdminClient()
    .from("payments" as never)
    .select("*, allocations:payment_allocations(*)")
    .order("created_at", { ascending: false });
  if (error) {
    console.error("[listPayments] Query error:", error.code, error.message);
    // An empty list would hide a missing migration; say what is wrong instead.
    if (isMissingTable(error)) throw new Error(MIGRATION_HINT);
    return [];
  }
  return ((data as unknown as Payment[]) ?? []).map((p) => ({ ...p, amount: Number(p.amount) }));
}

export interface PaymentFormCustomer {
  id: string;
  company_name: string;
  /** online / offline: drives the channel preselected in the form. */
  channel: string | null;
}

export interface PaymentFormInvoice extends OpenInvoice {
  /** null = a walk-in invoice with no customer account. */
  user_id: string | null;
  /** Name on the invoice (used for walk-in invoices). */
  bill_to_name: string;
}

export interface PaymentFormData {
  settings: Pick<SalesSettings, "receipt_prefix" | "receipt_fy" | "receipt_next_number" | "receipt_pad"> | null;
  customers: PaymentFormCustomer[];
  /** Issued invoices and debit notes that still have a balance (kind tells them apart). */
  invoices: PaymentFormInvoice[];
  /** Bank and cash accounts (Sales Settings) for "Deposited in". Empty before the ledger migration. */
  accounts: MoneyAccount[];
}

/** Everything the Record Payment form needs; the page fetches it ahead of the click. */
export async function getPaymentFormData(): Promise<PaymentFormData> {
  await requireAdmin();
  const db = createAdminClient();
  const [settings, customersRes, invoicesRes, summaryRes, debitNotesRes, dnSummaryRes, accounts] = await Promise.all([
    loadSalesSettings(),
    (db.from("profiles") as any)
      .select("id, company_name, channel")
      .eq("role", "customer")
      .order("company_name", { ascending: true }),
    (db.from("invoices") as any)
      .select("id, invoice_number, invoice_date, total_amount, user_id, order_id, bill_to")
      .eq("status", "issued")
      .order("invoice_date", { ascending: true }),
    (db.from("invoice_payment_summary" as never) as any).select("invoice_id, balance, payment_status"),
    // Debit notes are paid like invoices. Before the 20261019/20261023 migrations these queries fail
    // and simply return no rows.
    db
      .from("debit_notes" as never)
      .select("id, debit_note_number, debit_note_date, total_amount, user_id, bill_to")
      .eq("status", "issued")
      .order("debit_note_date", { ascending: true }),
    db.from("debit_note_payment_summary" as never).select("debit_note_id, balance"),
    loadMoneyAccounts(),
  ]);

  const balance = new Map<string, number>(
    ((summaryRes.data as { invoice_id: string; balance: number | string }[] | null) ?? []).map((s) => [s.invoice_id, Number(s.balance)])
  );
  const invoices: PaymentFormInvoice[] = ((invoicesRes.data as any[]) ?? [])
    .map((i) => ({
      id: i.id as string,
      invoice_number: i.invoice_number as string,
      invoice_date: i.invoice_date as string,
      total: Number(i.total_amount),
      balance: balance.get(i.id) ?? Number(i.total_amount),
      order_id: (i.order_id as string | null) ?? null,
      user_id: (i.user_id as string | null) ?? null,
      bill_to_name: (i.bill_to?.name as string) ?? "",
    }))
    .filter((i) => i.balance > 0);

  const dnBalance = new Map<string, number>(
    ((dnSummaryRes.data as unknown as { debit_note_id: string; balance: number | string }[] | null) ?? []).map((s) => [
      s.debit_note_id,
      Number(s.balance),
    ])
  );
  const debitNotes: PaymentFormInvoice[] = (
    (debitNotesRes.data as unknown as {
      id: string;
      debit_note_number: string;
      debit_note_date: string;
      total_amount: number | string;
      user_id: string | null;
      bill_to: { name?: string } | null;
    }[] | null) ?? []
  )
    .map((d) => ({
      id: d.id,
      kind: "debit_note" as const,
      invoice_number: d.debit_note_number,
      invoice_date: d.debit_note_date,
      total: Number(d.total_amount),
      balance: dnBalance.get(d.id) ?? Number(d.total_amount),
      order_id: null,
      user_id: d.user_id ?? null,
      bill_to_name: d.bill_to?.name ?? "",
    }))
    .filter((d) => d.balance > 0);

  return {
    settings: settings
      ? {
          receipt_prefix: settings.receipt_prefix ?? "SI/RCPT",
          receipt_fy: settings.receipt_fy ?? null,
          receipt_next_number: settings.receipt_next_number ?? 1,
          receipt_pad: settings.receipt_pad ?? 2,
        }
      : null,
    customers: ((customersRes.data as PaymentFormCustomer[] | null) ?? []).map((c) => ({
      id: c.id,
      company_name: c.company_name,
      channel: c.channel ?? null,
    })),
    invoices: [...invoices.map((i) => ({ ...i, kind: "invoice" as const })), ...debitNotes],
    accounts,
  };
}

/** Records a receipt. The money rules (balances, totals, numbering) are enforced in the database. */
export async function recordPayment(input: RecordPaymentInput): Promise<Result<{ payment: Payment }>> {
  let actorId: string;
  try {
    actorId = (await requireAdmin()).userId;
  } catch {
    return { success: false, error: "Administrator access required." };
  }

  const parsed = recordPaymentSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Check the payment details." };
  }
  const p = parsed.data;
  if (!p.customerId && !p.payerName) {
    return { success: false, error: "Select a customer, or enter the payer's name for a walk-in payment." };
  }

  const { data, error } = await recordPaymentRpc(
    {
      request_id: p.requestId,
      user_id: p.customerId,
      payer_name: p.payerName,
      payment_date: p.paymentDate,
      amount: p.amount,
      mode: p.mode,
      channel: p.channel,
      reference: p.reference,
      deposit_account: p.depositAccount,
      remarks: p.remarks,
      manual_number: p.manualNumber,
      allocations: p.allocations.map((a) => ({
        kind: a.kind,
        ...(a.invoiceId ? { invoice_id: a.invoiceId } : {}),
        ...(a.debitNoteId ? { debit_note_id: a.debitNoteId } : {}),
        amount: a.amount,
        note: a.note,
      })),
    },
    actorId
  );
  if (error) {
    if (error.code === "DATABASE_ERROR") console.error("[recordPayment]", error.raw);
    return { success: false, error: paymentErrorMessage(error) };
  }

  if (data.user_id) {
    await notifyAll([
      {
        userId: data.user_id,
        title: "Payment received",
        message: `We received ₹${Number(data.amount).toLocaleString("en-IN", { minimumFractionDigits: 2 })} by ${modeLabel(data.mode)}. Receipt ${data.receipt_number}.`,
        type: "payment",
        link: "/dashboard/payments",
        metadata: { receipt_number: data.receipt_number, amount: Number(data.amount) },
      },
    ]);
  }

  revalidatePath("/admin/payments-received");
  revalidatePath("/admin/party-ledger", "layout");
  revalidatePath("/admin/general-ledger");
  revalidatePath("/admin/invoices");
  revalidatePath("/admin/debit-notes");
  revalidatePath("/dashboard/payments");
  return { success: true, payment: { ...data, amount: Number(data.amount) } };
}

export async function cancelPayment(paymentId: string, reason: string): Promise<{ success: boolean; error?: string }> {
  let actorId: string;
  try {
    actorId = (await requireAdmin()).userId;
  } catch {
    return { success: false, error: "Administrator access required." };
  }
  const { error } = await cancelPaymentRpc(paymentId, reason, actorId);
  if (error) return { success: false, error: paymentErrorMessage(error) };

  revalidatePath("/admin/payments-received");
  revalidatePath("/admin/party-ledger", "layout");
  revalidatePath("/admin/general-ledger");
  revalidatePath("/admin/invoices");
  revalidatePath("/admin/debit-notes");
  revalidatePath("/dashboard/payments");
  return { success: true };
}

/** The signed-in customer's own received payments. Never accepts a user id from the client. */
export async function fetchCustomerPayments(): Promise<Payment[]> {
  const ctx = await requireUser();
  const { data, error } = await createAdminClient()
    .from("payments" as never)
    .select("*, allocations:payment_allocations(*)")
    .eq("user_id", ctx.userId)
    .eq("status", "received")
    .order("created_at", { ascending: false });
  if (error) {
    console.error("[fetchCustomerPayments] Query error:", error.code, error.message);
    return [];
  }
  return ((data as unknown as Payment[]) ?? []).map((p) => ({ ...p, amount: Number(p.amount) }));
}
