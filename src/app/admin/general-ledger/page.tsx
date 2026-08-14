import { AdminComingSoon } from "@/components/admin/AdminComingSoon";
import { BookOpen } from "lucide-react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "General Ledger | Sojar Indusy Admin",
  description: "Company accounting general ledger and balance sheet accounts.",
};

export default function GeneralLedgerAdminPage() {
  return (
    <AdminComingSoon
      section="Ledger"
      title="General Ledger"
      description="View double-entry bookkeeping ledgers, journal entries, trial balance accounts, and fiscal year statements."
      icon={BookOpen}
      features={[
        "Automated journal entry posting for sales, purchases, and payments",
        "Interactive Chart of Accounts (Assets, Liabilities, Equity, Revenue, Expense)",
        "Real-time Trial Balance and Balance Sheet calculation",
        "Exportable ledgers for chartered accountants and tax auditors",
      ]}
    />
  );
}
