import { AdminPaymentsClient } from "@/components/admin/AdminPaymentsClient";
import { listPayments } from "@/actions/payment";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Payments Received | Sojar Solutions Admin",
  description: "Receipts for payments received across eCom and offline channels.",
};

export const dynamic = "force-dynamic";

export default async function PaymentsReceivedPage() {
  const payments = await listPayments();
  return <AdminPaymentsClient initialPayments={payments} />;
}
