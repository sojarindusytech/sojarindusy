import { AdminComingSoon } from "@/components/admin/AdminComingSoon";
import { DollarSign } from "lucide-react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Operating Expenses | Sojar Indusy Admin",
  description: "Plant overheads, operational expenses, and vendor bills.",
};

export default function ExpensesAdminPage() {
  return (
    <AdminComingSoon
      section="Sales"
      title="Expense"
      description="Track manufacturing plant overheads, CNC tooling consumables, machine maintenance, and courier expenses."
      icon={DollarSign}
      features={[
        "Expense category classification (Electricity, Coolants, Packaging, Logistics)",
        "Receipt / bill attachment upload and OCR parsing",
        "Expense approval workflows with departmental caps",
        "P&L cost center mapping and budget vs actual analytics",
      ]}
    />
  );
}
