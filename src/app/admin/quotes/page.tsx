import { loadOrError } from "@/components/common/LoadErrorCard";
import { fetchCommercialQuotesList } from "@/actions/quote";
import { AdminQuotesClient } from "@/components/admin/AdminQuotesClient";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Commercial Quotations | Sojar Solutions Admin",
  description: "Manage commercial quotations, itemized pricing, GST calculations, and official PDF generation.",
};

export const dynamic = "force-dynamic";

export default async function QuotesAdminPage() {
  const { data: quotes, loadError } = await loadOrError(fetchCommercialQuotesList, []);

  return <AdminQuotesClient initialQuotes={quotes} loadError={loadError} />;
}
