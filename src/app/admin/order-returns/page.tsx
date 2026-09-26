import { fetchAdminOrdersList } from "@/actions/order";
import { OrderReturnsManagementClient } from "@/components/admin/OrderReturnsManagementClient";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Order Returns & RMA | Sojar Solutions Admin",
  description: "Process order returns, inspect returned items, and verify inventory restock.",
};

export const dynamic = "force-dynamic";

export default async function OrderReturnsAdminPage() {
  const orders = await fetchAdminOrdersList();

  return (
    <div className="space-y-6">
      <OrderReturnsManagementClient initialOrders={orders} />
    </div>
  );
}
