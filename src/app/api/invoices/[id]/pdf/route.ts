import { createElement } from "react";
import { renderToBuffer } from "@react-pdf/renderer";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAuthContext, isAdminRole } from "@/lib/auth-guard";
import { loadSalesSettings } from "@/lib/sales-settings";
import { InvoicePdf } from "@/components/invoice/InvoicePdf";
import type { Invoice } from "@/types/database.types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * GET /api/invoices/:id/pdf[?download=1]
 * Admins can fetch any invoice; a customer only their own issued invoices.
 * Anything else answers 404 so ids can't be probed.
 */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) return new Response("Not found", { status: 404 });

  const auth = await getAuthContext();
  if (!auth) return new Response("Unauthorized", { status: 401 });

  const { data } = await (createAdminClient().from("invoices") as any).select("*").eq("id", id).maybeSingle();
  const invoice = data as Invoice | null;

  const allowed =
    !!invoice && (isAdminRole(auth.role) || (invoice.user_id === auth.userId && invoice.status === "issued"));
  if (!invoice || !allowed) return new Response("Not found", { status: 404 });

  const settings = await loadSalesSettings();
  if (!settings) return new Response("Sales settings are not configured", { status: 500 });

  try {
    const buffer = await renderToBuffer(createElement(InvoicePdf, { invoice, settings }) as never);
    const download = new URL(req.url).searchParams.get("download") === "1";
    // Invoice numbers contain "/", which is illegal in a filename.
    const filename = `Invoice-${invoice.invoice_number.replace(/[^A-Za-z0-9._-]+/g, "-")}.pdf`;

    return new Response(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${filename}"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (err) {
    console.error("[invoice pdf] render failed:", err);
    return new Response("Failed to render invoice", { status: 500 });
  }
}
