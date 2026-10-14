import { fetchCustomerInvoices } from "@/actions/invoice";
import { fetchCustomerDebitNotes } from "@/actions/debit-note";
import { CustomerInvoicesView } from "@/components/customer/CustomerInvoicesView";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "GST Invoices & Statements | Sojar Solutions",
  description: "View and download official GST tax invoices and accounting records.",
};

export const dynamic = "force-dynamic";

export default async function CustomerInvoicesPage() {
  const [invoices, debitNotes] = await Promise.all([fetchCustomerInvoices(), fetchCustomerDebitNotes()]);

  return <CustomerInvoicesView invoices={invoices} debitNotes={debitNotes} />;
}
