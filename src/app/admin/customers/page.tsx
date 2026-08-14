import { AdminComingSoon } from "@/components/admin/AdminComingSoon";
import { Users } from "lucide-react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Customers | Sojar Indusy Admin",
  description: "Customer management and directory.",
};

export default function CustomersAdminPage() {
  return (
    <AdminComingSoon
      section="Directory"
      title="Customers"
      description="Manage verified industrial buyers, credit limits, account statuses, and contact profiles."
      icon={Users}
      features={[
        "Search and filter client profiles by GSTIN, city, and volume",
        "Credit limit adjustment and payment terms management",
        "Activity timelines and historical transaction summaries",
        "Direct communication log and automated invoice dispatching",
      ]}
    />
  );
}
