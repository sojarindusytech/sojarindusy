import { createElement } from "react";
import { renderToBuffer } from "@react-pdf/renderer";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAuthContext, isAdminRole } from "@/lib/auth-guard";
import { loadSalesSettings } from "@/lib/sales-settings";
import { filterCustomerVisibleInvoices } from "@/lib/server/invoice-access";
import { debitNoteReasonLabel } from "@/lib/debit-notes";
import { InvoicePdf } from "@/components/invoice/InvoicePdf";
import type { DebitNote, Invoice } from "@/types/database.types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * GET /api/debit-notes/:id/pdf[?download=1]
 * Same layout as the invoice PDF. Admins can fetch any debit note; a customer only
 * their own issued ones, and only while they can see the invoice it adjusts.
 * Anything else answers 404 so ids can't be probed.
 */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) return new Response("Not found", { status: 404 });

  const auth = await getAuthContext();
  if (!auth) return new Response("Unauthorized", { status: 401 });

  const db = createAdminClient();
  const { data } = await db
    .from("debit_notes" as never)
    .select("*, invoice:invoices(order_id)")
    .eq("id", id)
    .maybeSingle();
  const row = data as unknown as (DebitNote & { invoice: { order_id: string | null } | null }) | null;

  const allowed =
    !!row &&
    (isAdminRole(auth.role) ||
      (row.user_id === auth.userId &&
        row.status === "issued" &&
        (await filterCustomerVisibleInvoices([{ order_id: row.invoice?.order_id ?? null }])).length === 1));
  if (!row || !allowed) return new Response("Not found", { status: 404 });

  const settings = await loadSalesSettings();
  if (!settings) return new Response("Sales settings are not configured", { status: 500 });

  // The invoice renderer is document-agnostic; present the debit note in its shape.
  const asInvoice = {
    id: row.id,
    invoice_number: row.debit_note_number,
    invoice_date: row.debit_note_date,
    po_number: null,
    place_of_supply: row.place_of_supply,
    gst_enabled: row.gst_enabled,
    bill_to: row.bill_to,
    items: row.items,
    totals: row.totals,
    total_amount: Number(row.total_amount),
    amount_in_words: row.amount_in_words,
  } as unknown as Invoice;

  try {
    const buffer = await renderToBuffer(
      createElement(InvoicePdf, {
        invoice: asInvoice,
        settings,
        debitNote: {
          invoiceNumber: row.invoice_number,
          invoiceDate: row.invoice_date,
          reason: debitNoteReasonLabel(row.reason),
          note: row.reason_note,
        },
      }) as never
    );
    const download = new URL(req.url).searchParams.get("download") === "1";
    // Numbers contain "/", which is illegal in a filename.
    const filename = `Debit-Note-${row.debit_note_number.replace(/[^A-Za-z0-9._-]+/g, "-")}.pdf`;

    return new Response(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${filename}"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (err) {
    console.error("[debit note pdf] render failed:", err);
    return new Response("Failed to render debit note", { status: 500 });
  }
}
