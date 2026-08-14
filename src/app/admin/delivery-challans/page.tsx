import { AdminComingSoon } from "@/components/admin/AdminComingSoon";
import { ClipboardCheck } from "lucide-react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Delivery Challans | Sojar Indusy Admin",
  description: "Material dispatch challans and job work vouchers.",
};

export default function DeliveryChallansAdminPage() {
  return (
    <AdminComingSoon
      section="Sales"
      title="Delivery (Challan)"
      description="Create non-taxable Delivery Challans for sample tooling trials, customer demonstrations, or job-work outside processing."
      icon={ClipboardCheck}
      features={[
        "Challan purpose tagging (Job Work, Tooling Sample Trial, Supply on Approval)",
        "Material return tracking and conversion to Tax Invoice",
        "Vehicle and driver detail logs for factory gate security",
        "Official 3-part printable Challan slips (Consignee, Transporter, File)",
      ]}
    />
  );
}
