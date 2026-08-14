import { AdminComingSoon } from "@/components/admin/AdminComingSoon";
import { BookMarked } from "lucide-react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Party Ledger | Sojar Indusy Admin",
  description: "Debtors and creditors individual statement of accounts.",
};

export default function PartyLedgerAdminPage() {
  return (
    <AdminComingSoon
      section="Ledger"
      title="Party Ledger"
      description="Individual client and supplier running statement of accounts, payments received, and outstanding dues."
      icon={BookMarked}
      features={[
        "Client-by-client running balance statement with drill-down into original bills",
        "Aging analysis buckets (0-30 days, 31-60 days, 61-90 days, 90+ days)",
        "Automated statement email / WhatsApp PDF dispatching",
        "Payment reconciliation with bank transaction references (UTR / Cheque)",
      ]}
    />
  );
}
