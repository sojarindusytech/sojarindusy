import { fetchAllRfqsList } from "@/actions/rfq";
import { AdminQuotesClient } from "@/components/admin/AdminQuotesClient";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Quotes & RFQ Management | Sojar Indusy Admin",
  description: "Review customer RFQs, analyze drawings, and issue commercial tooling quotations.",
};

export const dynamic = "force-dynamic";

export default async function QuotesAdminPage() {
  const rfqs = await fetchAllRfqsList();

  return <AdminQuotesClient initialRfqs={rfqs} />;
}
