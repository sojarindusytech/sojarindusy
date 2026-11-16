import type { Metadata } from "next";
import { listAuditLogs } from "@/actions/audit";
import { AuditLogClient } from "@/components/admin/AuditLogClient";

export const metadata: Metadata = {
  title: "Audit Log | Sojar Solutions Admin",
  description: "Who changed what and when: administrative changes and sign-ins.",
};

export const dynamic = "force-dynamic";

export default async function AuditLogsAdminPage({ searchParams }: { searchParams: Promise<{ from?: string; to?: string }> }) {
  const { from, to } = await searchParams;
  const data = await listAuditLogs({ from, to });
  return <AuditLogClient {...data} />;
}
