import { fetchCustomerPayments } from "@/actions/payment";
import { CustomerPaymentsView } from "@/components/customer/CustomerPaymentsView";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Payments & Receipts | Sojar Solutions",
  description: "Payments received and your receipts.",
};

export const dynamic = "force-dynamic";

export default async function CustomerPaymentsPage() {
  const payments = await fetchCustomerPayments();
  return <CustomerPaymentsView payments={payments} />;
}
