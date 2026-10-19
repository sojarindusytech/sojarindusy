/**
 * Database tests for 20261019_02_debit_notes: issuing against an invoice, numbering
 * (auto, manual, GST 16-character limit), GST basis checks, immutability, cancel,
 * the invoice freeze and customer row access. Real Postgres (PGlite).
 */
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { amountInWords, computeInvoice, financialYear, type InvoiceLineInput } from "@/lib/invoice";
import { createTestDb, rejectsWithCode, type Row, type TestDb } from "./test-db";

const ids = {
  admin: "00000000-0000-4000-8000-000000000001",
  admin2: "00000000-0000-4000-8000-000000000002",
  custA: "00000000-0000-4000-8000-00000000000a",
  custB: "00000000-0000-4000-8000-00000000000b",
};

let t: TestDb;
let n = 0;
const fy = financialYear();
const today = () => new Date(Date.now() + 5.5 * 3600 * 1000).toISOString().slice(0, 10);
const daysAgo = (d: number) => new Date(Date.now() + 5.5 * 3600 * 1000 - d * 86400000).toISOString().slice(0, 10);

const q = async (sql: string, params: unknown[] = []) => (await t.db.query<Row>(sql, params)).rows;

// One database for the file (each PGlite instance is memory-heavy); tests reset the
// debit note state instead.
beforeAll(async () => {
  t = await createTestDb({ applyNew: true });
  const people = [["admin", "admin"], ["admin2", "admin"], ["custA", "customer"], ["custB", "customer"]] as const;
  for (const [key, role] of people) {
    await t.db.query(`INSERT INTO auth.users (id, email) VALUES ($1, $2)`, [ids[key], `${key}@test.in`]);
    await t.db.query(
      `INSERT INTO public.profiles (id, email, role, approval_status, company_name)
       VALUES ($1, $2, $3, 'approved', $4)
       ON CONFLICT (id) DO UPDATE SET role = $3, approval_status = 'approved', company_name = $4`,
      [ids[key], `${key}@test.in`, role, `${key} Pvt Ltd`]);
  }
});

/**
 * No debit notes and a fresh series. TRUNCATE skips the row trigger that makes notes undeletable;
 * payments go too, since a receipt can point at a debit note (20261023).
 */
async function reset() {
  await t.db.exec(`
    TRUNCATE public.payment_allocations, public.payments, public.debit_notes;
    UPDATE public.sales_settings
       SET debit_note_prefix = 'SI/DN', debit_note_fy = NULL, debit_note_next_number = 1, debit_note_pad = 2
     WHERE id = true;
  `);
}

/** An issued invoice like the app writes one: GST lines from the invoice maths. */
async function invoice(opts: { user?: string | null; gst?: boolean; interState?: boolean; status?: string; date?: string; orderId?: string } = {}) {
  const gst = opts.gst ?? true;
  const supply = opts.interState ? "27-Maharashtra" : "24-Gujarat";
  const computed = computeInvoice({
    items: [{ name: "TD-8", sku: "TD-8", quantity: 10, unitPrice: 100, gstRate: 18 }],
    gstEnabled: gst,
    defaultGstRate: 18,
    sellerStateCode: "24",
    placeOfSupplyStateCode: opts.interState ? "27" : "24",
  });
  const [row] = await q(
    `INSERT INTO public.invoices (invoice_number, invoice_date, bill_to, place_of_supply, gst_enabled, items, totals,
                                  total_amount, user_id, status, stock_owner, order_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'none', $11) RETURNING id, invoice_number`,
    [`INV-T-${++n}`, opts.date ?? daysAgo(5), JSON.stringify({ name: "custA Pvt Ltd", address: "Waluj" }), supply, gst,
     JSON.stringify(computed.lines), JSON.stringify(computed.totals), computed.totals.total,
     opts.user === undefined ? ids.custA : opts.user, opts.status ?? "issued", opts.orderId ?? null]);
  return row as { id: string; invoice_number: string };
}

/** The payload the app sends: lines priced with the invoice's GST basis. */
function input(invoiceId: string, over: Record<string, unknown> = {}, opts: { gst?: boolean; interState?: boolean; lines?: InvoiceLineInput[] } = {}) {
  const computed = computeInvoice({
    items: opts.lines ?? [{ name: "TD-8", sku: "TD-8", quantity: 10, unitPrice: 5, gstRate: 18 }],
    gstEnabled: opts.gst ?? true,
    defaultGstRate: 18,
    sellerStateCode: "24",
    placeOfSupplyStateCode: opts.interState ? "27" : "24",
  });
  return {
    request_id: crypto.randomUUID(),
    invoice_id: invoiceId,
    debit_note_date: today(),
    reason: "price_increase",
    reason_note: "Rate revised as per PO amendment",
    manual_number: null,
    items: computed.lines,
    totals: computed.totals,
    total_amount: computed.totals.total,
    amount_in_words: amountInWords(computed.totals.total),
    ...over,
  };
}

const issue = async (o: ReturnType<typeof input>, actor = ids.admin) =>
  (await t.service<{ r: Record<string, unknown> }>(`SELECT public.issue_debit_note($1::jsonb, $2) AS r`, [JSON.stringify(o), actor])).r;
const cancel = async (id: string, reason = "Raised in error", actor = ids.admin) =>
  (await t.service<{ r: Record<string, unknown> }>(`SELECT public.cancel_debit_note($1, $2, $3) AS r`, [id, reason, actor])).r;
const counter = async () => Number((await q(`SELECT debit_note_next_number AS c FROM public.sales_settings WHERE id = true`))[0].c);

describe("issuing debit notes", () => {
  beforeEach(reset);

  it("issues a numbered note that copies the invoice's details", async () => {
    const inv = await invoice();
    const dn = await issue(input(inv.id));
    expect(dn.debit_note_number).toBe(`SI/DN/${fy}/01`);
    expect(dn).toMatchObject({
      numbering_mode: "auto", debit_note_fy: fy, seq: 1, status: "issued",
      invoice_id: inv.id, invoice_number: inv.invoice_number, user_id: ids.custA,
      place_of_supply: "24-Gujarat", gst_enabled: true, reason: "price_increase",
    });
    // 10 x ₹5 + 18% GST = ₹59
    expect(Number(dn.total_amount)).toBe(59);
    expect((await issue(input(inv.id))).debit_note_number).toBe(`SI/DN/${fy}/02`);
  });

  it("returns the same note for a retried submit, and refuses another admin reusing the id", async () => {
    const inv = await invoice();
    const body = input(inv.id);
    const first = await issue(body);
    const again = await issue(body);
    expect(again.id).toBe(first.id);
    expect(Number((await q(`SELECT count(*) AS c FROM public.debit_notes`))[0].c)).toBe(1);
    await rejectsWithCode(issue(body, ids.admin2), "REQUEST_ID_USED");
  });

  it("accepts a typed number without moving the counter, and the series skips it later", async () => {
    const inv = await invoice();
    const manual = await issue(input(inv.id, { manual_number: `SI/DN/${fy}/01` }));
    expect(manual).toMatchObject({ numbering_mode: "manual", seq: null });
    expect(await counter()).toBe(1);
    // The next auto number would be .../01, which is taken: it moves on to .../02.
    expect((await issue(input(inv.id))).debit_note_number).toBe(`SI/DN/${fy}/02`);
  });

  it("enforces the GST number rules: 16 characters, letters, digits, / and - only, no duplicates", async () => {
    const inv = await invoice();
    await rejectsWithCode(issue(input(inv.id, { manual_number: "DN_2025_01" })), "INVALID_NUMBER");
    await rejectsWithCode(issue(input(inv.id, { manual_number: "SOJAR/DN/2025-26/1" })), "INVALID_NUMBER"); // 18 chars
    await issue(input(inv.id, { manual_number: "DN-7" }));
    await rejectsWithCode(issue(input(inv.id, { manual_number: "DN-7" })), "DUPLICATE_DEBIT_NOTE_NUMBER");
  });

  it("refuses an auto number longer than 16 characters without using up the counter", async () => {
    const inv = await invoice();
    await t.db.query(`UPDATE public.sales_settings SET debit_note_prefix = 'SOJAR/DEBIT' WHERE id = true`);
    const e = await rejectsWithCode(issue(input(inv.id)), "DEBIT_NOTE_NUMBER_TOO_LONG");
    expect(JSON.parse(e.detail ?? "{}").number).toBe(`SOJAR/DEBIT/${fy}/01`);
    expect(await counter()).toBe(1);
  });

  it("only against an issued invoice, dated between the invoice and today", async () => {
    const cancelled = await invoice({ status: "cancelled" });
    await rejectsWithCode(issue(input(cancelled.id)), "INVOICE_NOT_ISSUED");
    await rejectsWithCode(issue(input(crypto.randomUUID())), "INVOICE_NOT_FOUND");

    const inv = await invoice({ date: daysAgo(3) });
    await rejectsWithCode(issue(input(inv.id, { debit_note_date: daysAgo(4) })), "DEBIT_NOTE_DATE_INVALID");
    await rejectsWithCode(issue(input(inv.id, { debit_note_date: "2999-01-01" })), "DEBIT_NOTE_DATE_INVALID");
    expect((await issue(input(inv.id, { debit_note_date: daysAgo(3) }))).status).toBe("issued");
  });

  it("accepts a GST-correction note that adds only tax (taxable value 0), but never an empty line", async () => {
    const inv = await invoice();
    const taxOnly = [{ name: "TD-8", quantity: 10, unitPrice: 0, gstRate: 28, taxOnly: { base: 1000, chargedRate: 18 } }];
    const dn = await issue(input(inv.id, { reason: "tax_rate_correction" }, { lines: taxOnly }));
    expect(Number(dn.total_amount)).toBe(100); // 10% of 1000
    expect((dn.items as { taxable: number; cgst: number }[])[0]).toMatchObject({ taxable: 0, cgst: 50 });

    const empty = [{ name: "TD-8", quantity: 1, unitPrice: 0, gstRate: 18 }, { name: "Freight", quantity: 1, unitPrice: 100, gstRate: 18 }];
    await rejectsWithCode(issue(input(inv.id, {}, { lines: empty })), "INVALID_REQUEST");
  });

  it("follows the invoice's GST: none on a non-GST invoice, IGST stays IGST", async () => {
    const plain = await invoice({ gst: false });
    await rejectsWithCode(issue(input(plain.id)), "TAX_MISMATCH");
    expect(Number((await issue(input(plain.id, {}, { gst: false }))).total_amount)).toBe(50);

    const inter = await invoice({ interState: true });
    await rejectsWithCode(issue(input(inter.id)), "TAX_MISMATCH"); // CGST+SGST on an IGST invoice
    const ok = await issue(input(inter.id, {}, { interState: true }));
    expect((ok.items as { igst: number }[])[0].igst).toBe(9);
  });

  it("validates the request", async () => {
    const inv = await invoice();
    await rejectsWithCode(issue(input(inv.id, { reason: "because" })), "INVALID_REQUEST");
    await rejectsWithCode(issue(input(inv.id, { reason: "other", reason_note: "" })), "REASON_NOTE_REQUIRED");
    await rejectsWithCode(issue(input(inv.id, { total_amount: 1 })), "INVALID_REQUEST"); // not the lines' total
    await rejectsWithCode(issue(input(inv.id, { items: [] })), "INVALID_REQUEST");
    await rejectsWithCode(issue(input(inv.id), ids.custA), "ADMIN_REQUIRED");
  });
});

describe("after issue", () => {
  beforeEach(reset);

  it("can't be edited or deleted, only cancelled once with a reason", async () => {
    const inv = await invoice();
    const dn = await issue(input(inv.id));
    await expect(t.db.query(`UPDATE public.debit_notes SET total_amount = 1 WHERE id = $1`, [dn.id])).rejects.toThrow(/DEBIT_NOTE_IMMUTABLE/);
    await expect(t.db.query(`DELETE FROM public.debit_notes WHERE id = $1`, [dn.id])).rejects.toThrow(/DEBIT_NOTE_IMMUTABLE/);

    await rejectsWithCode(cancel(dn.id as string, " "), "REASON_REQUIRED");
    expect(await cancel(dn.id as string)).toMatchObject({ already_cancelled: false, debit_note_number: dn.debit_note_number });
    expect(await cancel(dn.id as string)).toMatchObject({ already_cancelled: true });
    const [row] = await q(`SELECT status, cancel_reason, cancelled_at FROM public.debit_notes WHERE id = $1`, [dn.id]);
    expect(row).toMatchObject({ status: "cancelled", cancel_reason: "Raised in error" });
    await expect(t.db.query(`UPDATE public.debit_notes SET status = 'issued', cancelled_at = NULL WHERE id = $1`, [dn.id]))
      .rejects.toThrow(/DEBIT_NOTE_IMMUTABLE/);
  });

  it("freezes its invoice until every note on it is cancelled", async () => {
    const inv = await invoice();
    const dn = await issue(input(inv.id));

    await expect(t.db.query(`UPDATE public.invoices SET total_amount = 1 WHERE id = $1`, [inv.id])).rejects.toThrow(/INVOICE_HAS_DEBIT_NOTES/);
    await expect(t.db.query(`UPDATE public.invoices SET status = 'cancelled' WHERE id = $1`, [inv.id])).rejects.toThrow(/INVOICE_HAS_DEBIT_NOTES/);
    // Stock bookkeeping is still allowed.
    await t.db.query(`UPDATE public.invoices SET stock_posted_at = now(), updated_at = now() WHERE id = $1`, [inv.id]);

    await cancel(dn.id as string);
    await t.db.query(`UPDATE public.invoices SET status = 'cancelled' WHERE id = $1`, [inv.id]);
    expect((await q(`SELECT status FROM public.invoices WHERE id = $1`, [inv.id]))[0].status).toBe("cancelled");
  });
});

describe("customer access", () => {
  beforeEach(reset);

  const visibleTo = async (user: string) =>
    (await t.as("authenticated", user, (tx) => tx.query<{ debit_note_number: string }>(`SELECT debit_note_number FROM public.debit_notes`)))
      .rows.map((r) => r.debit_note_number);

  it("sees only their own issued notes, and nobody can write them directly", async () => {
    const inv = await invoice();
    const dn = await issue(input(inv.id));
    expect(await visibleTo(ids.custA)).toEqual([dn.debit_note_number]);
    expect(await visibleTo(ids.custB)).toEqual([]);

    await cancel(dn.id as string);
    expect(await visibleTo(ids.custA)).toEqual([]);

    await expect(t.as("anon", null, (tx) => tx.query(`SELECT * FROM public.debit_notes`))).rejects.toThrow(/permission denied/);
    await expect(t.as("authenticated", ids.custA, (tx) => tx.query(`DELETE FROM public.debit_notes`))).rejects.toThrow(/permission denied/);
    await expect(t.as("authenticated", ids.custA, (tx) =>
      tx.query(`SELECT public.issue_debit_note('{}'::jsonb, $1)`, [ids.custA]))).rejects.toThrow(/permission denied/);
  });

  it("doesn't see a note on an order invoice before the order is delivered", async () => {
    const [order] = await q(
      `INSERT INTO public.orders (user_id, order_number, total_amount, shipping_address, status)
       VALUES ($1, 'ORD-T-1', 1180, 'Waluj', 'shipped') RETURNING id`, [ids.custA]);
    const inv = await invoice({ orderId: order.id as string });
    const dn = await issue(input(inv.id));
    expect(await visibleTo(ids.custA)).toEqual([]);

    await t.db.query(`UPDATE public.orders SET status = 'delivered' WHERE id = $1`, [order.id]);
    expect(await visibleTo(ids.custA)).toEqual([dn.debit_note_number]);
  });
});
