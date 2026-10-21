"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/auth-guard";
import { loadSalesSettings } from "@/lib/sales-settings";
import { cancelSupplierPayment, recordSupplierPayment } from "@/lib/server/rpc";
import { ledgerErrorMessage } from "@/lib/server/ledger-errors";
import { isMissingTable, LEDGER_MIGRATION_HINT, loadMoneyAccounts, loadParties, type MoneyAccount } from "@/lib/server/ledger";
import { supplierPaymentSchema, type SupplierPaymentInput } from "@/lib/validations/ledger";
import type { DbAppError } from "@/lib/server/db-error";
import type { SalesSettings, SupplierPayment } from "@/types/database.types";

type Result<T = object> = ({ success: true } & T) | { success: false; error: string };

function supplierPaymentError(error: DbAppError): string {
  switch (error.code) {
    case "PAYMENT_DATE_INVALID":
      return "The payment date cannot be in the future.";
    case "REQUEST_ID_USED":
      return "This form was already submitted by someone else. Close it and start again.";
    case "REASON_REQUIRED":
      return "Enter a reason (at least 3 characters).";
    case "PAYMENT_NOT_FOUND":
      return "Payment not found.";
    case "ADMIN_REQUIRED":
      return "Administrator access required.";
    case "INVALID_REQUEST":
      return "Check the payment details and try again.";
    default:
      return ledgerErrorMessage(error) ?? "Could not save the payment. Please check the details and try again.";
  }
}

const revalidate = () => {
  revalidatePath("/admin/payments-made");
  revalidatePath("/admin/general-ledger");
  revalidatePath("/admin/party-ledger", "layout");
};

export async function listSupplierPayments(): Promise<SupplierPayment[]> {
  await requireAdmin();
  const { data, error } = await createAdminClient()
    .from("supplier_payments" as never)
    .select("*")
    .order("created_at", { ascending: false });
  if (error) {
    console.error("[listSupplierPayments]", error.code, error.message);
    if (isMissingTable(error)) throw new Error(LEDGER_MIGRATION_HINT);
    throw new Error("Payments could not be loaded.");
  }
  return ((data as unknown as SupplierPayment[]) ?? []).map((p) => ({ ...p, amount: Number(p.amount) }));
}

export interface SupplierPaymentFormData {
  manufacturers: { id: string; name: string }[];
  accounts: MoneyAccount[];
  settings: Pick<SalesSettings, "supplier_payment_prefix" | "supplier_payment_fy" | "supplier_payment_next_number" | "supplier_payment_pad"> | null;
}

export async function getSupplierPaymentFormData(): Promise<SupplierPaymentFormData> {
  await requireAdmin();
  const [parties, accounts, settings] = await Promise.all([loadParties(), loadMoneyAccounts(), loadSalesSettings()]);
  return {
    manufacturers: parties.filter((p) => p.role === "manufacturer").map((p) => ({ id: p.id, name: p.name })),
    accounts,
    settings: settings
      ? {
          supplier_payment_prefix: settings.supplier_payment_prefix ?? "SI/PAY",
          supplier_payment_fy: settings.supplier_payment_fy ?? null,
          supplier_payment_next_number: settings.supplier_payment_next_number ?? 1,
          supplier_payment_pad: settings.supplier_payment_pad ?? 2,
        }
      : null,
  };
}

/** Records a payment made to a manufacturer; the database numbers it and posts it to the ledger. */
export async function recordSupplierPaymentAction(input: SupplierPaymentInput): Promise<Result<{ payment: SupplierPayment }>> {
  let actorId: string;
  try {
    actorId = (await requireAdmin()).userId;
  } catch {
    return { success: false, error: "Administrator access required." };
  }
  const parsed = supplierPaymentSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? "Check the payment details." };
  const p = parsed.data;
  const { data, error } = await recordSupplierPayment(
    {
      request_id: p.requestId,
      manufacturer_id: p.manufacturerId,
      payment_date: p.paymentDate,
      amount: p.amount,
      mode: p.mode,
      account_id: p.accountId,
      reference: p.reference,
      bill_reference: p.billReference,
      remarks: p.remarks,
    },
    actorId
  );
  if (error) {
    if (error.code === "DATABASE_ERROR") console.error("[recordSupplierPayment]", error.raw);
    return { success: false, error: supplierPaymentError(error) };
  }
  revalidate();
  return { success: true, payment: { ...data, amount: Number(data.amount) } };
}

/** Cancels a payment made (with a reason). Its ledger entry is reversed; the voucher stays listed. */
export async function cancelSupplierPaymentAction(id: string, reason: string): Promise<Result> {
  let actorId: string;
  try {
    actorId = (await requireAdmin()).userId;
  } catch {
    return { success: false, error: "Administrator access required." };
  }
  if (reason.trim().length < 3) return { success: false, error: "Enter a reason (at least 3 characters)." };
  const { error } = await cancelSupplierPayment(id, reason.trim(), actorId);
  if (error) return { success: false, error: supplierPaymentError(error) };
  revalidate();
  return { success: true };
}
