import { AdminInvoicesClient } from "@/components/admin/AdminInvoicesClient";
import { listInvoices } from "@/actions/invoice";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Tax Invoices | Sojar Solutions Admin",
  description: "GST Tax Invoices and billing registry.",
};

export const dynamic = "force-dynamic";

export default async function InvoicesAdminPage() {
  const invoices = await listInvoices();
  return <AdminInvoicesClient initialInvoices={invoices} />;
}
