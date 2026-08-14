import { AdminComingSoon } from "@/components/admin/AdminComingSoon";
import { ShoppingCart } from "lucide-react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sales Orders | Sojar Indusy Admin",
  description: "Manage client sales orders and contract fulfillments.",
};

export default function SalesOrdersAdminPage() {
  return (
    <AdminComingSoon
      section="Orders"
      title="Sales Orders"
      description="Track customer orders from quote confirmation through fulfillment and revenue recognition."
      icon={ShoppingCart}
      features={[
        "Automated PO-to-Sales Order conversion workflow",
        "Line-item production tracking and estimated delivery dates",
        "Payment milestone management and credit limit checks",
        "Direct export to GST-compliant commercial invoices",
      ]}
    />
  );
}
