import { AdminComingSoon } from "@/components/admin/AdminComingSoon";
import { ShoppingBag } from "lucide-react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Purchase Orders | Sojar Indusy Admin",
  description: "Manage raw material and procurement purchase orders.",
};

export default function PurchaseOrdersAdminPage() {
  return (
    <AdminComingSoon
      section="Orders"
      title="Purchase Orders"
      description="Manage vendor purchase orders, tungsten carbide rod procurements, and coating contractor POs."
      icon={ShoppingBag}
      features={[
        "Vendor quote comparison and automatic cost estimation",
        "Raw material batch reception and QC inspection logging",
        "Vendor performance and on-time delivery metrics",
        "Automated GRN (Goods Receipt Note) generation",
      ]}
    />
  );
}
