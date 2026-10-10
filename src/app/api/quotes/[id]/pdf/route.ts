import { createElement } from "react";
import { renderToBuffer } from "@react-pdf/renderer";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAuthContext, isAdminRole } from "@/lib/auth-guard";
import { loadSalesSettings } from "@/lib/sales-settings";
import { InvoicePdf } from "@/components/invoice/InvoicePdf";
import type { CommercialQuote, Invoice } from "@/types/database.types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * GET /api/quotes/:id/pdf[?download=1]
 * Same layout as the invoice PDF. Admins can fetch any quotation; a customer only
 * their own once it has been sent (never a draft). Anything else answers 404.
 */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) return new Response("Not found", { status: 404 });

  const auth = await getAuthContext();
  if (!auth) return new Response("Unauthorized", { status: 401 });

  const { data } = await (createAdminClient().from("quotes") as any).select("*").eq("id", id).maybeSingle();
  const quote = data as CommercialQuote | null;

  const allowed = !!quote && (isAdminRole(auth.role) || (quote.user_id === auth.userId && quote.status !== "draft"));
  if (!quote || !allowed) return new Response("Not found", { status: 404 });

  const settings = await loadSalesSettings();
  if (!settings) return new Response("Sales settings are not configured", { status: 500 });

  // The invoice renderer is document-agnostic; present the quotation in its shape.
  const asInvoice = {
    id: quote.id,
    invoice_number: quote.quote_number,
    invoice_date: quote.quote_date,
    po_number: null,
    place_of_supply: quote.place_of_supply ?? null,
    gst_enabled: quote.gst_enabled,
    bill_to: {
      name: quote.company_name,
      address: quote.address ?? "",
      contact: quote.mobile ?? null,
      gstin: quote.gstin ?? null,
      state: quote.place_of_supply ?? null,
    },
    items: quote.items,
    totals: quote.totals,
    total_amount: quote.total_amount,
    amount_in_words: quote.amount_in_words ?? null,
  } as unknown as Invoice;

  try {
    const buffer = await renderToBuffer(
      createElement(InvoicePdf, {
        invoice: asInvoice,
        settings,
        quote: {
          validUntil: quote.valid_until,
          paymentTerms: quote.payment_terms,
          deliveryTerms: quote.delivery_terms,
        },
      }) as never
    );
    const download = new URL(req.url).searchParams.get("download") === "1";
    const filename = `Quotation-${quote.quote_number.replace(/[^A-Za-z0-9._-]+/g, "-")}.pdf`;

    return new Response(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${filename}"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (err) {
    console.error("[quote pdf] render failed:", err);
    return new Response("Failed to render quotation", { status: 500 });
  }
}
