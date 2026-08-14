import { AdminComingSoon } from "@/components/admin/AdminComingSoon";
import { Package } from "lucide-react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Products | Sojar Indusy Admin",
  description: "Product catalog management.",
};

export default function ProductsAdminPage() {
  return (
    <AdminComingSoon
      section="Product Management"
      title="Products"
      description="Manage industrial SKUs, stock levels, CNC tooling variants, and pricing structures."
      icon={Package}
      features={[
        "Real-time inventory level tracking and low-stock alerts",
        "SKU parameter matrix (Diameter, Flute Length, Shank Dia, HRC Series)",
        "Dynamic pricing rules and tiered B2B discount tables",
        "Batch catalog synchronization with ERP databases",
      ]}
    />
  );
}
