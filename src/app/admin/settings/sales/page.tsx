import { SalesSettingsClient } from "@/components/admin/SalesSettingsClient";
import { getSalesSettings } from "@/actions/sales-settings";
import { getPoManufacturerOptions } from "@/actions/purchase-order";
import { listLedgerAccounts } from "@/actions/ledger";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sales Settings | Sojar Solutions Admin",
  description: "Invoice numbering, GST billing, company and bank details.",
};

export const dynamic = "force-dynamic";

export default async function SalesSettingsPage() {
  const [settings, { manufacturers }, ledger] = await Promise.all([getSalesSettings(), getPoManufacturerOptions(), listLedgerAccounts()]);
  // Before the ledger migration there are no accounts to manage: the card is hidden.
  const moneyAccounts = ledger.error ? null : ledger.accounts.filter((a) => a.kind === "bank" || a.kind === "cash");

  if (!settings) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-900">
        Sales settings are not initialised. Run the <code>20261010_invoices_and_sales_settings.sql</code> migration.
      </div>
    );
  }

  return <SalesSettingsClient key={settings.updated_at} initial={settings} manufacturers={manufacturers} moneyAccounts={moneyAccounts} />;
}
