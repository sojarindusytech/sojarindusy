import { AdminComingSoon } from "@/components/admin/AdminComingSoon";
import { ShieldAlert } from "lucide-react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Audit Log & Security | Sojar Indusy Admin",
  description: "System audit trail, change tracking, and login logs.",
};

export default function AuditLogsAdminPage() {
  return (
    <AdminComingSoon
      section="Analytics & Logs"
      title="Audit Log"
      description="Immutable security log capturing administrative data mutations, pricing updates, user logins, and permissions changes."
      icon={ShieldAlert}
      features={[
        "Granular timestamped records with actor IP address and user ID",
        "Before / After diff inspection for pricing and order status changes",
        "Failed login attempt alerts and anomaly detection",
        "Tamper-proof compliance archive for regulatory reporting",
      ]}
    />
  );
}
