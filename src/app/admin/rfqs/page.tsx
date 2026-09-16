import { fetchAllRfqsList } from "@/actions/rfq";
import { AdminRfqsClient } from "@/components/admin/AdminRfqsClient";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Customer RFQs | Sojar Indusy Admin",
  description: "Review incoming customer custom tooling and fastener RFQs, inspect CAD drawings, and prepare estimates.",
};

export const dynamic = "force-dynamic";

export default async function RfqsAdminPage() {
  const rfqs = await fetchAllRfqsList();

  return <AdminRfqsClient initialRfqs={rfqs} />;
}
