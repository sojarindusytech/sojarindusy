import { getAuthContext, isAdminRole } from "@/lib/auth-guard";
import { loadSalesSettings } from "@/lib/sales-settings";
import { buildTallyMasters, buildTallyVouchers, resolveRange } from "@/lib/server/ledger";
import { tallyMastersXml, tallyVouchersXml } from "@/lib/ledger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/ledger/tally?kind=masters
 * GET /api/ledger/tally?kind=vouchers&from=YYYY-MM-DD&to=YYYY-MM-DD
 * Tally import files (Gateway of Tally > Import > Masters / Transactions). Admins only.
 */
export async function GET(req: Request) {
  const auth = await getAuthContext();
  if (!auth) return new Response("Unauthorized", { status: 401 });
  if (!isAdminRole(auth.role)) return new Response("Not found", { status: 404 });

  const url = new URL(req.url);
  const kind = url.searchParams.get("kind");
  if (kind !== "masters" && kind !== "vouchers") return new Response("kind must be masters or vouchers", { status: 400 });

  try {
    const settings = await loadSalesSettings();
    const company = settings?.tally_company_name ?? null;
    let xml: string;
    let filename: string;
    if (kind === "masters") {
      xml = tallyMastersXml(await buildTallyMasters(), company);
      filename = "Tally-Masters.xml";
    } else {
      const range = resolveRange({ from: url.searchParams.get("from") ?? undefined, to: url.searchParams.get("to") ?? undefined });
      const { vouchers } = await buildTallyVouchers(range.from, range.to);
      xml = tallyVouchersXml(vouchers, company);
      filename = `Tally-Vouchers-${range.from}-to-${range.to}.xml`;
    }
    return new Response(xml, {
      headers: {
        "Content-Type": "application/xml; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (err) {
    console.error("[tally export] failed:", err);
    return new Response(err instanceof Error ? err.message : "Export failed", { status: 500 });
  }
}
