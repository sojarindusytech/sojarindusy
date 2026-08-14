import { AdminComingSoon } from "@/components/admin/AdminComingSoon";
import { ListOrdered } from "lucide-react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Order List | Sojar Indusy Admin",
  description: "Unified master order directory.",
};

export default function OrdersListAdminPage() {
  return (
    <AdminComingSoon
      section="Orders"
      title="Order List"
      description="View and filter all historical and active orders across online portal and offline channels."
      icon={ListOrdered}
      features={[
        "Universal order search across order number, client name, and date range",
        "Multi-stage status filter (Pending, Processing, Shipped, Delivered, Cancelled)",
        "Detailed order line item breakdown and invoice downloads",
        "Bulk status updates and customer notification dispatch",
      ]}
    />
  );
}
