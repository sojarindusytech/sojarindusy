/**
 * Database tests for 20261023_debit_note_terms_and_payments: receipts applied to debit notes,
 * their paid / balance / status, the rules record_payment enforces for them, the cancel guard,
 * and the receipt series skipping a hand-typed number. Real Postgres (PGlite).
 */
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { amountInWords, computeInvoice, financialYear } from "@/lib/invoice";
import { createTestDb, rejectsWithCode, type Row, type TestDb } from "./test-db";

const ids = {
  admin: "00000000-0000-4000-8000-000000000001",
  custA: "00000000-0000-4000-8000-00000000000a",
  custB: "00000000-0000-4000-8000-00000000000b",
};

let t: TestDb;
let n = 0;
const fy = financialYear();
const today = () => new Date(Date.now() + 5.5 * 3600 * 1000).toISOString().slice(0, 10);
const q = async (sql: string, params: unknown[] = []) => (await t.db.query<Row>(sql, params)).rows;

// One database for the file (each PGlite instance is memory-heavy).
beforeAll(async () => {
  t = await createTestDb({ applyNew: true });
  for (const [key, role] of [["admin", "admin"], ["custA", "customer"], ["custB", "customer"]] as const) {
    await t.db.query(`INSERT INTO auth.users (id, email) VALUES ($1, $2)`, [ids[key], `${key}@test.in`]);
    await t.db.query(
      `INSERT INTO public.profiles (id, email, role, approval_status, company_name)
       VALUES ($1, $2, $3, 'approved', $4)
       ON CONFLICT (id) DO UPDATE SET role = $3, approval_status = 'approved', company_name = $4`,
      [ids[key], `${key}@test.in`, role, `${key} Pvt Ltd`]);
  }
});

beforeEach(async () => {
  await t.db.exec(`
    TRUNCATE public.payment_allocations, public.payments, public.debit_notes;
    UPDATE public.sales_settings SET receipt_prefix = 'SI/RCPT', receipt_fy = NULL, receipt_next_number = 1, receipt_pad = 2 WHERE id = true;
  `);
});

/** An issued invoice for 10 x ₹100 at 18% GST (₹1,180). */
async function invoice(user: string | null = ids.custA, total = 1180) {
  const c = computeInvoice({
    items: [{ name: "TD-8", sku: "TD-8", quantity: 10, unitPrice: 100, gstRate: 18 }],
    gstEnabled: true, defaultGstRate: 18, sellerStateCode: "24", placeOfSupplyStateCode: "24",
  });
  const [row] = await q(
    `INSERT INTO public.invoices (invoice_number, invoice_date, bill_to, place_of_supply, gst_enabled, items, totals,
                                  total_amount, user_id, status, stock_owner)
     VALUES ($1, current_date - 3, '{"name":"custA Pvt Ltd","address":"Waluj"}'::jsonb, '24-Gujarat', true, $2, $3, $4, $5, 'issued', 'none')
     RETURNING id`,
    [`INV-P-${++n}`, JSON.stringify(c.lines), JSON.stringify(c.totals), total, user]);
  return row.id as string;
}

/** A debit note of ₹590 (₹500 + 18% GST) against `invoiceId`. */
async function debitNote(invoiceId: string) {
  const c = computeInvoice({
    items: [{ name: "Freight charges", quantity: 1, unitPrice: 500, gstRate: 18 }],
    gstEnabled: true, defaultGstRate: 18, sellerStateCode: "24", placeOfSupplyStateCode: "24",
  });
  const input = {
    request_id: crypto.randomUUID(), invoice_id: invoiceId, debit_note_date: today(), reason: "additional_charges",
    reason_note: null, manual_number: null, items: c.lines, totals: c.totals, total_amount: c.totals.total,
    amount_in_words: amountInWords(c.totals.total),
  };
  return (await t.service<{ r: { id: string; debit_note_number: string } }>(
    `SELECT public.issue_debit_note($1::jsonb, $2) AS r`, [JSON.stringify(input), ids.admin])).r;
}

type Alloc =
  | { kind: "invoice"; invoice_id: string; amount: number }
  | { kind: "debit_note"; debit_note_id?: string; amount: number }
  | { kind: "advance" | "other"; amount: number; note?: string };

const pay = async (allocations: Alloc[], over: Record<string, unknown> = {}) =>
  (await t.service<{ r: Record<string, unknown> }>(`SELECT public.record_payment($1::jsonb, $2) AS r`, [
    JSON.stringify({
      request_id: crypto.randomUUID(), user_id: ids.custA, payment_date: today(),
      amount: allocations.reduce((s, a) => s + a.amount, 0), mode: "bank_transfer", reference: "UTR1",
      deposit_account: null, channel: "offline", remarks: null, manual_number: null, allocations, ...over,
    }),
    ids.admin,
  ])).r;

const summary = async (dnId: string) =>
  (await q(`SELECT paid::float AS paid, balance::float AS balance, payment_status FROM public.debit_note_payment_summary WHERE debit_note_id = $1`, [dnId]))[0];

describe("paying a debit note", () => {
  it("records a payment against a debit note and tracks its balance", async () => {
    const dn = await debitNote(await invoice());
    expect(await summary(dn.id)).toEqual({ paid: 0, balance: 590, payment_status: "unpaid" });

    const p = await pay([{ kind: "debit_note", debit_note_id: dn.id, amount: 200 }]);
    expect(await summary(dn.id)).toEqual({ paid: 200, balance: 390, payment_status: "partial" });
    const [alloc] = await q(`SELECT kind, debit_note_id, debit_note_number, invoice_id FROM public.payment_allocations WHERE payment_id = $1`, [p.id]);
    expect(alloc).toMatchObject({ kind: "debit_note", debit_note_id: dn.id, debit_note_number: dn.debit_note_number, invoice_id: null });

    await pay([{ kind: "debit_note", debit_note_id: dn.id, amount: 390 }]);
    expect(await summary(dn.id)).toMatchObject({ balance: 0, payment_status: "paid" });
  });

  it("splits one payment across an invoice, a debit note and an advance", async () => {
    const inv = await invoice();
    const dn = await debitNote(inv);
    await pay([
      { kind: "invoice", invoice_id: inv, amount: 1180 },
      { kind: "debit_note", debit_note_id: dn.id, amount: 590 },
      { kind: "advance", amount: 230 },
    ]);
    expect(await summary(dn.id)).toMatchObject({ payment_status: "paid" });
    const [invSum] = await q(`SELECT payment_status FROM public.invoice_payment_summary WHERE invoice_id = $1`, [inv]);
    expect(invSum.payment_status).toBe("paid");
  });

  it("never takes more than the balance", async () => {
    const dn = await debitNote(await invoice());
    await pay([{ kind: "debit_note", debit_note_id: dn.id, amount: 500 }]);
    const e = await rejectsWithCode(pay([{ kind: "debit_note", debit_note_id: dn.id, amount: 100 }]), "OVER_ALLOCATED");
    expect(JSON.parse(e.detail ?? "{}")).toMatchObject({ debit_note_number: dn.debit_note_number, balance: 90, applied: 100 });
  });

  it("refuses another customer's, a cancelled or an unknown debit note", async () => {
    const dn = await debitNote(await invoice());
    await rejectsWithCode(pay([{ kind: "debit_note", debit_note_id: dn.id, amount: 10 }], { user_id: ids.custB }), "DEBIT_NOTE_NOT_PAYABLE");

    await t.service(`SELECT public.cancel_debit_note($1, 'Raised in error', $2)`, [dn.id, ids.admin]);
    await rejectsWithCode(pay([{ kind: "debit_note", debit_note_id: dn.id, amount: 10 }]), "DEBIT_NOTE_NOT_PAYABLE");

    await rejectsWithCode(pay([{ kind: "debit_note", debit_note_id: crypto.randomUUID(), amount: 10 }]), "DEBIT_NOTE_NOT_FOUND");
  });

  it("validates debit note lines", async () => {
    const dn = await debitNote(await invoice());
    await rejectsWithCode(pay([{ kind: "debit_note", amount: 10 }]), "INVALID_REQUEST");
    await rejectsWithCode(pay([
      { kind: "debit_note", debit_note_id: dn.id, amount: 10 },
      { kind: "debit_note", debit_note_id: dn.id, amount: 10 },
    ]), "INVALID_REQUEST");
  });

  it("can't cancel a debit note that has money against it until the receipt is cancelled", async () => {
    const dn = await debitNote(await invoice());
    const p = await pay([{ kind: "debit_note", debit_note_id: dn.id, amount: 100 }]);
    const e = await rejectsWithCode(
      t.service(`SELECT public.cancel_debit_note($1, 'Raised in error', $2)`, [dn.id, ids.admin]), "DEBIT_NOTE_HAS_PAYMENTS");
    expect(JSON.parse(e.detail ?? "{}")).toMatchObject({ paid: 100 });

    await t.service(`SELECT public.cancel_payment($1, 'Entered by mistake', $2)`, [p.id, ids.admin]);
    expect(await summary(dn.id)).toMatchObject({ paid: 0, payment_status: "unpaid" });
    await t.service(`SELECT public.cancel_debit_note($1, 'Raised in error', $2)`, [dn.id, ids.admin]);
    expect(await summary(dn.id)).toMatchObject({ payment_status: "cancelled" });
  });

  it("lets the customer see their own debit note balance only", async () => {
    const dn = await debitNote(await invoice());
    await pay([{ kind: "debit_note", debit_note_id: dn.id, amount: 90 }]);
    const seen = async (user: string) =>
      (await t.as("authenticated", user, (tx) =>
        tx.query<{ balance: string }>(`SELECT balance FROM public.debit_note_payment_summary`))).rows.map((r) => Number(r.balance));
    expect(await seen(ids.custA)).toEqual([500]);
    expect(await seen(ids.custB)).toEqual([]);
  });
});

describe("receipt numbers", () => {
  it("skip a number already typed by hand on another receipt", async () => {
    const inv = await invoice();
    await t.db.query(`UPDATE public.sales_settings SET receipt_fy = $1, receipt_next_number = 3 WHERE id = true`, [fy]);
    await pay([{ kind: "invoice", invoice_id: inv, amount: 10 }], { manual_number: `SI/RCPT/${fy}/03` });
    const auto = await pay([{ kind: "invoice", invoice_id: inv, amount: 10 }]);
    expect(auto.receipt_number).toBe(`SI/RCPT/${fy}/04`);
  });
});
