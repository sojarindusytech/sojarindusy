import { AdminComingSoon } from "@/components/admin/AdminComingSoon";
import { FilePlus } from "lucide-react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Credit Notes | Sojar Indusy Admin",
  description: "Credit Note registry and customer balance adjustments.",
};

export default function CreditNotesAdminPage() {
  return (
    <AdminComingSoon
      section="Sales"
      title="Credit Note"
      description="Issue credit notes for customer order returns, post-sale volume rebates, or pricing error rectifications."
      icon={FilePlus}
      features={[
        "Direct connection to Sales Invoices and Order Returns (RMA)",
        "Automatic GST tax credit computation and GSTR-1 sync",
        "Customer wallet/credit balance updates for future purchases",
        "Audit trail for managerial approvals and cancellations",
      ]}
    />
  );
}
