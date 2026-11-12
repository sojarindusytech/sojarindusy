import { getGeneralLedger, getJournalFormData, listJournals } from "@/actions/ledger";
import { GeneralLedgerClient } from "@/components/admin/ledger/GeneralLedgerClient";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "General Ledger | Sojar Solutions Admin",
  description: "Chart of accounts, account ledgers, day book, trial balance, profit & loss, balance sheet, journals and Tally export.",
};

export const dynamic = "force-dynamic";

export default async function GeneralLedgerAdminPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; tab?: string; account?: string }>;
}) {
  const { from, to, tab, account } = await searchParams;
  const [data, journals, formData] = await Promise.all([
    getGeneralLedger({ from, to }),
    listJournals({ from, to }),
    getJournalFormData(),
  ]);
  return <GeneralLedgerClient data={data} journals={journals} formData={formData} initialTab={tab} initialAccountId={account} />;
}
