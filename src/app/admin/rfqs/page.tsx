import { loadOrError } from "@/components/common/LoadErrorCard";
import { fetchAllRfqsList } from "@/actions/rfq";
import { AdminRfqsClient } from "@/components/admin/AdminRfqsClient";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Customer RFQs | Sojar Solutions Admin",
  description: "Review incoming customer custom tooling and fastener RFQs, inspect CAD drawings, and prepare estimates.",
};

export const dynamic = "force-dynamic";

export default async function RfqsAdminPage() {
  const { data: rfqs, loadError } = await loadOrError(fetchAllRfqsList, []);

  return <AdminRfqsClient initialRfqs={rfqs} loadError={loadError} />;
}
