import { getPurchaseOrders } from "@/actions/purchase-order";
import { AdminPurchaseOrdersClient } from "@/components/admin/AdminPurchaseOrdersClient";
import { requireAdmin } from "@/lib/auth-guard";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Purchase Orders | Admin Dashboard | Sojar Solutions",
  description: "Manage automated manufacturer replenishment orders",
};

export default async function AdminPurchaseOrdersPage() {
  await requireAdmin();
  const orders = await getPurchaseOrders();

  return <AdminPurchaseOrdersClient initialOrders={orders} />;
}
