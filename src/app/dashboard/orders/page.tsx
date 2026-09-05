import { fetchCustomerOrdersList } from "@/actions/order";
import { CustomerOrdersView } from "@/components/customer/CustomerOrdersView";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Orders & Logistics Tracking | Sojar Indusy",
  description: "Track your industrial orders, carrier AWB consignments, and live delivery status.",
};

export const dynamic = "force-dynamic";

export default async function CustomerOrdersPage() {
  const orders = await fetchCustomerOrdersList();

  return <CustomerOrdersView orders={orders} />;
}
