import { createElement } from "react";
import { renderToBuffer } from "@react-pdf/renderer";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAuthContext, isAdminRole } from "@/lib/auth-guard";
import { loadSalesSettings } from "@/lib/sales-settings";
import { ReceiptPdf, type ReceiptInvoiceInfo } from "@/components/payment/ReceiptPdf";
import type { Payment } from "@/types/database.types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * GET /api/payments/:id/pdf[?download=1]
 * Same family as the invoice PDF. Admins can fetch any receipt; a customer only their own received
 * ones (never a cancelled one). Anything else answers 404 so ids can't be probed.
 */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) return new Response("Not found", { status: 404 });

  const auth = await getAuthContext();
  if (!auth) return new Response("Unauthorized", { status: 401 });

  const db = createAdminClient();
  const { data } = await db
    .from("payments" as never)
    .select("*, allocations:payment_allocations(*)")
    .eq("id", id)
    .maybeSingle();
  const payment = data as unknown as Payment | null;

  const allowed =
    !!payment && (isAdminRole(auth.role) || (payment.user_id === auth.userId && payment.status === "received"));
  if (!payment || !allowed) return new Response("Not found", { status: 404 });

  const settings = await loadSalesSettings();
  if (!settings) return new Response("Sales settings are not configured", { status: 500 });

  // Invoice details and what is still outstanding on each, for the "applied to" table.
  const invoiceIds = (payment.allocations ?? []).map((a) => a.invoice_id).filter((v): v is string => !!v);
  const invoices: Record<string, ReceiptInvoiceInfo> = {};
  if (invoiceIds.length > 0) {
    const [{ data: invRows }, { data: sumRows }] = await Promise.all([
      db.from("invoices").select("id, invoice_date, total_amount").in("id", invoiceIds),
      db.from("invoice_payment_summary" as never).select("invoice_id, balance").in("invoice_id", invoiceIds),
    ]);
    const balance = new Map(((sumRows as { invoice_id: string; balance: number | string }[] | null) ?? []).map((r) => [r.invoice_id, Number(r.balance)]));
    for (const r of (invRows as { id: string; invoice_date: string; total_amount: number | string }[] | null) ?? []) {
      invoices[r.id] = { invoice_date: r.invoice_date, total: Number(r.total_amount), balance: balance.get(r.id) ?? 0 };
    }
  }

  let payer: { address?: string | null; gstin?: string | null } = {};
  if (payment.user_id) {
    const { data: profile } = await db
      .from("profiles")
      .select("company_address, city, pincode, gstin")
      .eq("id", payment.user_id)
      .maybeSingle();
    const p = profile as { company_address?: string; city?: string; pincode?: string; gstin?: string | null } | null;
    if (p) payer = { address: [p.company_address, p.city, p.pincode].filter(Boolean).join(", ") || null, gstin: p.gstin ?? null };
  }

  try {
    const buffer = await renderToBuffer(
      createElement(ReceiptPdf, { payment: { ...payment, amount: Number(payment.amount) }, settings, invoices, payer }) as never
    );
    const download = new URL(req.url).searchParams.get("download") === "1";
    const filename = `Receipt-${payment.receipt_number.replace(/[^A-Za-z0-9._-]+/g, "-")}.pdf`;

    return new Response(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${filename}"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (err) {
    console.error("[receipt pdf] render failed:", err);
    return new Response("Failed to render receipt", { status: 500 });
  }
}
