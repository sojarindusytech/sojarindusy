import { fetchCustomerInvoices } from "@/actions/invoice";
import { CustomerInvoicesView } from "@/components/customer/CustomerInvoicesView";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "GST Invoices & Statements | Sojar Solutions",
  description: "View and download official GST tax invoices and accounting records.",
};

export const dynamic = "force-dynamic";

export default async function CustomerInvoicesPage() {
  const invoices = await fetchCustomerInvoices();

  return <CustomerInvoicesView invoices={invoices} />;
}
