import { createElement } from "react";
import { renderToBuffer } from "@react-pdf/renderer";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAuthContext, isAdminRole } from "@/lib/auth-guard";
import { loadSalesSettings } from "@/lib/sales-settings";
import { buildStatement, loadParties, resolveRange } from "@/lib/server/ledger";
import { StatementPdf } from "@/components/ledger/StatementPdf";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * GET /api/party-ledger/:id/pdf?from=YYYY-MM-DD&to=YYYY-MM-DD[&download=1]
 * Statement of account. Admins can fetch any customer's or manufacturer's; a customer only their
 * own. Anything else answers 404 so ids can't be probed.
 */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) return new Response("Not found", { status: 404 });

  const auth = await getAuthContext();
  if (!auth) return new Response("Unauthorized", { status: 401 });
  if (!isAdminRole(auth.role) && auth.userId !== id) return new Response("Not found", { status: 404 });

  const party = (await loadParties()).find((p) => p.id === id);
  // A customer gets their own statement only; manufacturers' statements are for admins.
  if (!party || (!isAdminRole(auth.role) && party.role !== "customer")) return new Response("Not found", { status: 404 });

  const settings = await loadSalesSettings();
  if (!settings) return new Response("Sales settings are not configured", { status: 500 });

  const url = new URL(req.url);
  const range = resolveRange({ from: url.searchParams.get("from") ?? undefined, to: url.searchParams.get("to") ?? undefined });

  try {
    const statement = await buildStatement(id, range, false, party);
    const { data: profile } = await createAdminClient()
      .from("profiles")
      .select("company_address, city, state, pincode")
      .eq("id", id)
      .maybeSingle();
    const p = profile as { company_address?: string; city?: string; state?: string; pincode?: string } | null;
    const clean = (v?: string) => (v && v.trim() && v.trim() !== "-" ? v.trim() : null);
    const address = p ? [clean(p.company_address), clean(p.city), clean(p.state), clean(p.pincode)].filter(Boolean).join(", ") || null : null;

    const buffer = await renderToBuffer(
      createElement(StatementPdf, {
        settings,
        party: { name: party.name, address, gstin: party.gstin, role: party.role },
        from: range.from,
        to: range.to,
        opening: statement.totals.opening,
        lines: statement.lines,
        ageing: statement.ageing,
      }) as never
    );
    const download = url.searchParams.get("download") === "1";
    const filename = `Statement-${party.name.replace(/[^A-Za-z0-9._-]+/g, "-").slice(0, 60)}-${range.from}-to-${range.to}.pdf`;
    return new Response(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${filename}"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (err) {
    console.error("[statement pdf] failed:", err);
    return new Response("Failed to render statement", { status: 500 });
  }
}
