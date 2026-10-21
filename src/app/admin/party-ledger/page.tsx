import { getJournalFormData, getPartyLedger } from "@/actions/ledger";
import { PartyLedgerClient } from "@/components/admin/ledger/PartyLedgerClient";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Party Ledger | Sojar Solutions Admin",
  description: "Statements of account for every customer and manufacturer.",
};

export const dynamic = "force-dynamic";

export default async function PartyLedgerAdminPage({ searchParams }: { searchParams: Promise<{ from?: string; to?: string }> }) {
  const { from, to } = await searchParams;
  const [data, formData] = await Promise.all([getPartyLedger({ from, to }), getJournalFormData()]);
  return <PartyLedgerClient data={data} formData={formData} />;
}
