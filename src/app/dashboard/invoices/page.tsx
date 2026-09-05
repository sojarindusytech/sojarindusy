import { fetchCustomerOrdersList } from "@/actions/order";
import { CustomerInvoicesView } from "@/components/customer/CustomerInvoicesView";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "GST Invoices & Statements | Sojar Indusy",
  description: "View and download official GST tax invoices and accounting records.",
};

export const dynamic = "force-dynamic";

export default async function CustomerInvoicesPage() {
  const orders = await fetchCustomerOrdersList();

  return <CustomerInvoicesView orders={orders} />;
}
