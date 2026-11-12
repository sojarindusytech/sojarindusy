import { AdminSupplierPaymentsClient } from "@/components/admin/AdminSupplierPaymentsClient";
import { listSupplierPayments } from "@/actions/supplier-payment";
import type { SupplierPayment } from "@/types/database.types";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Payments Made | Sojar Solutions Admin",
  description: "Payments made to manufacturers.",
};

export const dynamic = "force-dynamic";

export default async function PaymentsMadePage() {
  let payments: SupplierPayment[] = [];
  let loadError: string | null = null;
  try {
    payments = await listSupplierPayments();
  } catch (err) {
    // e.g. the ledger migration hasn't been applied: say so on the page instead of a generic error.
    loadError = err instanceof Error ? err.message : "Could not load payments.";
  }
  return <AdminSupplierPaymentsClient initialPayments={payments} loadError={loadError} />;
}
