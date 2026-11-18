import { LoadErrorCard, loadOrError } from "@/components/common/LoadErrorCard";
import { getPurchaseOrders } from "@/actions/purchase-order";
import { ManufacturerDashboardClient } from "@/components/manufacturer/ManufacturerDashboardClient";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Manufacturer Orders | Sojar Solutions",
  description: "Manufacturer production replenishments and purchase orders portal",
};

export default async function ManufacturerPage() {
  const { data: orders, loadError } = await loadOrError(() => getPurchaseOrders(), []);
  if (loadError) return <div className="p-6"><LoadErrorCard message={loadError} /></div>;

  return <ManufacturerDashboardClient orders={orders} />;
}
