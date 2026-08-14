import { AdminComingSoon } from "@/components/admin/AdminComingSoon";
import { RotateCcw } from "lucide-react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Order Returns | Sojar Indusy Admin",
  description: "RMA and returns management.",
};

export default function OrderReturnsAdminPage() {
  return (
    <AdminComingSoon
      section="Orders"
      title="Order Returns"
      description="Process return merchandise authorizations (RMA), quality defect inspection, and credit replacements."
      icon={RotateCcw}
      features={[
        "Return request verification and QA inspection reports",
        "Automated Credit Note generation for approved returns",
        "Inventory restock / scrap logging workflow",
        "Return rate analytics by SKU and client",
      ]}
    />
  );
}
