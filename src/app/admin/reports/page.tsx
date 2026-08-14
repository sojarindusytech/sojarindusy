import { AdminComingSoon } from "@/components/admin/AdminComingSoon";
import { BarChart3 } from "lucide-react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Analytics & Reports | Sojar Indusy Admin",
  description: "Executive business intelligence, sales trends, and production metrics.",
};

export default function ReportsAdminPage() {
  return (
    <AdminComingSoon
      section="Analytics & Logs"
      title="Reports"
      description="Comprehensive analytical dashboards covering monthly sales growth, SKU velocity, and regional revenue."
      icon={BarChart3}
      features={[
        "Interactive revenue forecasting charts by HRC grade and tool geometry",
        "Top-performing customers and distributor concentration metrics",
        "Inventory turnover rates and slow-moving SKU detection",
        "One-click multi-page executive summary PDF exports",
      ]}
    />
  );
}
