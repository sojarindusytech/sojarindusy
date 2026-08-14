import { AdminComingSoon } from "@/components/admin/AdminComingSoon";
import { FileMinus } from "lucide-react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Debit Notes | Sojar Indusy Admin",
  description: "Debit Note registry and vendor adjustments.",
};

export default function DebitNotesAdminPage() {
  return (
    <AdminComingSoon
      section="Sales"
      title="Debit Note"
      description="Issue debit notes for purchase price adjustments, goods returned to suppliers, or additional freight charges."
      icon={FileMinus}
      features={[
        "Linkage with original Purchase Order and GRN entries",
        "GST-compliant Debit Note sequencing and format",
        "Automated vendor balance adjustment in Party Ledger",
        "Exportable reports for accounting audits",
      ]}
    />
  );
}
