import { createElement } from "react";
import { renderToBuffer } from "@react-pdf/renderer";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAuthContext, isAdminRole } from "@/lib/auth-guard";
import { InvoicePdf } from "@/components/invoice/InvoicePdf";
import { amountInWords } from "@/lib/invoice";
import type { CreditNote } from "@/lib/credit-note";
import type { Invoice } from "@/types/database.types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) return new Response("Not found", { status: 404 });
  const auth = await getAuthContext();
  if (!auth) return new Response("Unauthorized", { status: 401 });
  const { data, error } = await createAdminClient().from("credit_notes").select("*").eq("id", id).maybeSingle();
  if (error) return new Response("Unable to load credit note", { status: 500 });
  const note = data as CreditNote | null;
  if (!note || (!isAdminRole(auth.role) && note.user_id !== auth.userId)) return new Response("Not found", { status: 404 });
  const invoice: Invoice = {
    id: note.id, invoice_number: note.credit_note_number, invoice_date: note.credit_note_date,
    invoice_fy: note.credit_note_fy, seq: note.seq, order_id: null, user_id: note.user_id,
    po_number: null, place_of_supply: note.place_of_supply, gst_enabled: note.treatment === "gst",
    bill_to: note.bill_to, items: note.items, totals: note.totals, total_amount: note.total_amount,
    amount_in_words: amountInWords(note.total_amount), status: "issued", created_by: null,
    created_at: note.created_at, updated_at: note.created_at,
  };
  try {
    const buffer = await renderToBuffer(createElement(InvoicePdf, { invoice, settings: note.seller_snapshot, creditNote: { invoiceNumber: note.invoice_number, invoiceDate: note.invoice_date, reason: note.reason, treatment: note.treatment } }) as never);
    const filename = `Credit-Note-${note.credit_note_number.replace(/[^A-Za-z0-9._-]+/g, "-")}.pdf`;
    return new Response(new Uint8Array(buffer), { headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${new URL(req.url).searchParams.get("download") === "1" ? "attachment" : "inline"}; filename="${filename}"`,
      "Cache-Control": "private, no-store",
    } });
  } catch (error) {
    console.error("[credit note pdf]", error);
    return new Response("Failed to render credit note", { status: 500 });
  }
}
