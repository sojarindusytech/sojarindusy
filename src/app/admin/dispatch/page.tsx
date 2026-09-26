import { fetchAdminOrdersList } from "@/actions/order";
import { DispatchManagementClient } from "@/components/admin/DispatchManagementClient";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Dispatch & Logistics | Sojar Solutions Admin",
  description: "Manage warehouse dispatches, carrier consignments, and delivery milestones.",
};

export const dynamic = "force-dynamic";

export default async function DispatchAdminPage() {
  const orders = await fetchAdminOrdersList();

  return (
    <div className="space-y-6">
      <DispatchManagementClient initialOrders={orders} />
    </div>
  );
}
