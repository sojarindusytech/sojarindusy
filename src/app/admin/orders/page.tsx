import { fetchAdminOrdersList } from "@/actions/order";
import { OrderManagementClient } from "@/components/admin/OrderManagementClient";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Order Management & Logistics | Sojar Indusy Admin",
  description: "Manage purchase orders, fulfillment progress, and carrier tracking links.",
};

export const dynamic = "force-dynamic";

export default async function OrdersListAdminPage() {
  const orders = await fetchAdminOrdersList();

  return (
    <div className="space-y-6">
      <OrderManagementClient initialOrders={orders} />
    </div>
  );
}
