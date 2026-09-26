import { getPurchaseOrders } from "@/actions/purchase-order";
import { ManufacturerDashboardClient } from "@/components/manufacturer/ManufacturerDashboardClient";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Manufacturer Orders | Sojar Solutions",
  description: "Manufacturer production replenishments and purchase orders portal",
};

export default async function ManufacturerPage() {
  const orders = await getPurchaseOrders();

  return <ManufacturerDashboardClient orders={orders} />;
}
