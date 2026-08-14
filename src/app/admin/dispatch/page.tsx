import { AdminComingSoon } from "@/components/admin/AdminComingSoon";
import { Truck } from "lucide-react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Dispatch & Delivery | Sojar Indusy Admin",
  description: "Logistics, courier manifests, and delivery tracking.",
};

export default function DispatchAdminPage() {
  return (
    <AdminComingSoon
      section="Orders"
      title="Dispatch / Delivery"
      description="Manage warehouse packing slips, courier partnerships, tracking numbers, and proof of delivery."
      icon={Truck}
      features={[
        "Integration with major industrial logistics partners (VRL, BlueDart, Delhivery)",
        "Barcode / QR scanner based box packing and manifest creation",
        "Automated customer SMS/email tracking updates",
        "Digital Proof of Delivery (POD) archive",
      ]}
    />
  );
}
