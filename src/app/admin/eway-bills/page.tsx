import { AdminComingSoon } from "@/components/admin/AdminComingSoon";
import { FileCheck } from "lucide-react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "E-Way Bills | Sojar Indusy Admin",
  description: "Government GST E-Way Bill generation and tracking.",
};

export default function EwayBillsAdminPage() {
  return (
    <AdminComingSoon
      section="Sales"
      title="E-Way Bill"
      description="Generate and manage government GST E-Way Bills for inter-state and intra-state goods consignments exceeding ₹50,000."
      icon={FileCheck}
      features={[
        "One-click E-Way Bill generation from existing Tax Invoices",
        "Vehicle number and transporter ID updating (Part B)",
        "E-Way bill expiry monitoring and extension requests",
        "Printable government format with official QR codes",
      ]}
    />
  );
}
