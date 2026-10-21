import { fetchMyStatement } from "@/actions/ledger";
import { PartyStatementView } from "@/components/admin/ledger/PartyStatementView";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Account Statement | Sojar Solutions",
  description: "Your statement of account: invoices, payments and notes with a running balance.",
};

export const dynamic = "force-dynamic";

export default async function CustomerStatementPage({ searchParams }: { searchParams: Promise<{ from?: string; to?: string }> }) {
  const { from, to } = await searchParams;
  const statement = await fetchMyStatement({ from, to });
  const pdfHref = statement.party
    ? `/api/party-ledger/${statement.party.id}/pdf?from=${statement.range.from}&to=${statement.range.to}&download=1`
    : "";
  return <PartyStatementView statement={statement} admin={false} pdfHref={pdfHref} />;
}
