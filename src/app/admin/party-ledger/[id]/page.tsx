import { getJournalFormData, getPartyStatement } from "@/actions/ledger";
import { PartyStatementView } from "@/components/admin/ledger/PartyStatementView";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Statement of Account | Sojar Solutions Admin",
  description: "A customer's or manufacturer's ledger with running balance, pending bills and ageing.",
};

export const dynamic = "force-dynamic";

export default async function PartyStatementPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ from?: string; to?: string; all?: string }>;
}) {
  const { id } = await params;
  const { from, to, all } = await searchParams;
  const showReversed = all === "1";
  const [statement, formData] = await Promise.all([getPartyStatement(id, { from, to }, showReversed), getJournalFormData()]);
  const pdfHref = `/api/party-ledger/${id}/pdf?from=${statement.range.from}&to=${statement.range.to}&download=1`;
  return <PartyStatementView statement={statement} admin showReversed={showReversed} formData={formData} pdfHref={pdfHref} />;
}
