/**
 * Database tests for 20261018_payments: receipts, allocations across invoices, cancel,
 * numbering, guards on invoices and customer row access. Real Postgres (PGlite).
 */
import { beforeEach, describe, expect, it } from "vitest";
import { createTestDb, rejectsWithCode, type Row, type TestDb } from "./test-db";

const ids = {
  admin: "00000000-0000-4000-8000-000000000001",
  custA: "00000000-0000-4000-8000-00000000000a",
  custB: "00000000-0000-4000-8000-00000000000b",
};

let t: TestDb;
let n = 0;

const q = async (sql: string, params: unknown[] = []) => (await t.db.query<Row>(sql, params)).rows;

async function setup() {
  t = await createTestDb({ applyNew: true });
  for (const [key, role] of [["admin", "admin"], ["custA", "customer"], ["custB", "customer"]] as const) {
    await t.db.query(`INSERT INTO auth.users (id, email) VALUES ($1, $2)`, [ids[key], `${key}@test.in`]);
    await t.db.query(
      `INSERT INTO public.profiles (id, email, role, approval_status, company_name)
       VALUES ($1, $2, $3, 'approved', $4)
       ON CONFLICT (id) DO UPDATE SET role = $3, approval_status = 'approved', company_name = $4`,
      [ids[key], `${key}@test.in`, role, `${key} Pvt Ltd`]);
  }
}

async function invoice(userId: string | null, total: number, status = "issued") {
  const [row] = await q(
    `INSERT INTO public.invoices (invoice_number, invoice_date, bill_to, items, totals, total_amount, user_id, status, stock_owner)
     VALUES ($1, current_date, '{}'::jsonb, '[]'::jsonb, '{}'::jsonb, $2, $3, $4, 'none') RETURNING id, invoice_number`,
    [`INV-T-${++n}`, total, userId, status]);
  return row as { id: string; invoice_number: string };
}

interface Alloc { kind: "invoice" | "advance" | "other"; invoice_id?: string; amount: number; note?: string }
const input = (over: Record<string, unknown> & { allocations: Alloc[] }) => ({
  request_id: crypto.randomUUID(),
  user_id: ids.custA,
  payment_date: new Date().toISOString().slice(0, 10),
  amount: over.allocations.reduce((s, a) => s + a.amount, 0),
  mode: "bank_transfer",
  reference: "UTR123",
  deposit_account: "HDFC 5170",
  channel: "offline",
  remarks: null,
  manual_number: null,
  ...over,
});
const record = async (o: ReturnType<typeof input>, actor = ids.admin) =>
  (await t.service<{ r: Record<string, unknown> }>(`SELECT public.record_payment($1::jsonb, $2) AS r`, [JSON.stringify(o), actor])).r;
const cancel = async (id: string, reason = "Entered by mistake") =>
  (await t.service<{ r: Record<string, unknown> }>(`SELECT public.cancel_payment($1, $2, $3) AS r`, [id, reason, ids.admin])).r;
const summary = async (invoiceId: string) =>
  (await q(`SELECT paid::float AS paid, balance::float AS balance, payment_status FROM public.invoice_payment_summary WHERE invoice_id = $1`, [invoiceId]))[0];

describe("recording payments", () => {
  beforeEach(setup);

  it("records a payment against one invoice and updates its balance and status", async () => {
    const inv = await invoice(ids.custA, 1000);
    const p = await record(input({ allocations: [{ kind: "invoice", invoice_id: inv.id, amount: 400 }] }));
    expect(p.receipt_number).toMatch(/^SI\/RCPT\/\d{2}-\d{2}\/01$/);
    expect(p.numbering_mode).toBe("auto");
    expect(await summary(inv.id)).toEqual({ paid: 400, balance: 600, payment_status: "partial" });

    await record(input({ allocations: [{ kind: "invoice", invoice_id: inv.id, amount: 600 }] }));
    expect(await summary(inv.id)).toEqual({ paid: 1000, balance: 0, payment_status: "paid" });
  });

  it("splits one payment across invoices, with the remainder as an advance", async () => {
    const a = await invoice(ids.custA, 500);
    const b = await invoice(ids.custA, 800);
    const p = await record(input({
      allocations: [
        { kind: "invoice", invoice_id: a.id, amount: 500 },
        { kind: "invoice", invoice_id: b.id, amount: 300 },
        { kind: "advance", amount: 200 },
      ],
    }));
    expect(Number(p.amount)).toBe(1000);
    expect(await summary(a.id)).toMatchObject({ paid: 500, payment_status: "paid" });
    expect(await summary(b.id)).toMatchObject({ paid: 300, balance: 500, payment_status: "partial" });
    const rows = await q(`SELECT kind, invoice_number, amount::float AS amount FROM public.payment_allocations WHERE payment_id = $1 ORDER BY kind, amount`, [p.id]);
    expect(rows.map((r) => [r.kind, r.invoice_number, r.amount])).toEqual([
      ["advance", null, 200], ["invoice", b.invoice_number, 300], ["invoice", a.invoice_number, 500]]);
  });

  it("records advance and other payments with no invoice, and walk-in payers with a name", async () => {
    await record(input({ allocations: [{ kind: "advance", amount: 5000 }] }));
    await record(input({ allocations: [{ kind: "other", amount: 150, note: "Scrap sale" }], mode: "cash", channel: "offline" }));
    const walkIn = await record(input({
      user_id: null, payer_name: "Walk-in buyer", mode: "upi", allocations: [{ kind: "other", amount: 90 }] }));
    expect(walkIn.user_id).toBeNull();
    expect(walkIn.payer_name).toBe("Walk-in buyer");
    await rejectsWithCode(record(input({ user_id: null, allocations: [{ kind: "other", amount: 90 }] })), "PAYER_REQUIRED");
  });

  it("refuses more than the invoice balance, and a mismatched total", async () => {
    const inv = await invoice(ids.custA, 1000);
    await record(input({ allocations: [{ kind: "invoice", invoice_id: inv.id, amount: 700 }] }));
    const e = await rejectsWithCode(
      record(input({ allocations: [{ kind: "invoice", invoice_id: inv.id, amount: 400 }] })), "OVER_ALLOCATED");
    expect(JSON.parse(e.detail ?? "{}")).toMatchObject({ invoice_number: inv.invoice_number, balance: 300, applied: 400 });
    await rejectsWithCode(
      record({ ...input({ allocations: [{ kind: "advance", amount: 100 }] }), amount: 150 }), "ALLOCATION_MISMATCH");
    expect(await summary(inv.id)).toMatchObject({ paid: 700 });
  });

  it("refuses another customer's invoice, a cancelled invoice and a repeated invoice line", async () => {
    const theirs = await invoice(ids.custB, 500);
    const cancelled = await invoice(ids.custA, 500, "cancelled");
    const mine = await invoice(ids.custA, 500);
    await rejectsWithCode(record(input({ allocations: [{ kind: "invoice", invoice_id: theirs.id, amount: 100 }] })), "INVOICE_NOT_PAYABLE");
    await rejectsWithCode(record(input({ allocations: [{ kind: "invoice", invoice_id: cancelled.id, amount: 100 }] })), "INVOICE_NOT_PAYABLE");
    await rejectsWithCode(record(input({ allocations: [
      { kind: "invoice", invoice_id: mine.id, amount: 100 }, { kind: "invoice", invoice_id: mine.id, amount: 100 }] })), "INVALID_REQUEST");
    await rejectsWithCode(record(input({ allocations: [{ kind: "invoice", invoice_id: "00000000-0000-4000-8000-0000000000ee", amount: 1 }] })), "INVOICE_NOT_FOUND");
  });

  it("lets a walk-in payer settle an invoice that has no customer account", async () => {
    const inv = await invoice(null, 300);
    await record(input({ user_id: null, payer_name: "Walk-in buyer", mode: "cash", allocations: [{ kind: "invoice", invoice_id: inv.id, amount: 300 }] }));
    expect(await summary(inv.id)).toMatchObject({ paid: 300, payment_status: "paid" });
  });

  it("validates the request: mode, channel, date, amount and admin", async () => {
    const base = { allocations: [{ kind: "advance", amount: 10 } as Alloc] };
    await rejectsWithCode(record(input({ ...base, mode: "bitcoin" })), "INVALID_REQUEST");
    await rejectsWithCode(record(input({ ...base, channel: "mars" })), "INVALID_REQUEST");
    await rejectsWithCode(record(input({ ...base, payment_date: "2999-01-01" })), "PAYMENT_DATE_INVALID");
    await rejectsWithCode(record({ ...input(base), amount: 0 }), "INVALID_REQUEST");
    await rejectsWithCode(record(input(base), ids.custA), "ADMIN_REQUIRED");
    await rejectsWithCode(record(input({ ...base, user_id: "00000000-0000-4000-8000-0000000000ee" })), "CUSTOMER_NOT_FOUND");
  });

  it("returns the same receipt for a retried submission", async () => {
    const o = input({ allocations: [{ kind: "advance", amount: 10 }] });
    const first = await record(o);
    const again = await record(o);
    expect(again.id).toBe(first.id);
    expect((await q(`SELECT count(*)::int AS c FROM public.payments`))[0].c).toBe(1);
  });
});

describe("receipt numbers", () => {
  beforeEach(setup);

  it("are sequential, a typed number does not move the counter, and duplicates are refused", async () => {
    const a = await record(input({ allocations: [{ kind: "advance", amount: 1 }] }));
    const manual = await record(input({ manual_number: "REC-0001", allocations: [{ kind: "advance", amount: 1 }] }));
    const b = await record(input({ allocations: [{ kind: "advance", amount: 1 }] }));
    expect(manual.receipt_number).toBe("REC-0001");
    expect(manual.numbering_mode).toBe("manual");
    expect(manual.seq).toBeNull();
    expect((a.receipt_number as string).endsWith("/01")).toBe(true);
    expect((b.receipt_number as string).endsWith("/02")).toBe(true);
    await rejectsWithCode(record(input({ manual_number: "REC-0001", allocations: [{ kind: "advance", amount: 1 }] })), "DUPLICATE_RECEIPT_NUMBER");
    await rejectsWithCode(record(input({ manual_number: "bad number!", allocations: [{ kind: "advance", amount: 1 }] })), "INVALID_REQUEST");
  });

  it("restart at 1 in a new financial year and honour an edited counter", async () => {
    await q(`UPDATE public.sales_settings SET receipt_fy = '20-21', receipt_next_number = 57`);
    const p = await record(input({ allocations: [{ kind: "advance", amount: 1 }] }));
    expect((p.receipt_number as string).endsWith("/01")).toBe(true);        // stale FY: counter restarts
    const [s] = await q(`SELECT receipt_next_number AS n FROM public.sales_settings`);
    expect(s.n).toBe(2);
  });
});

describe("cancelling a payment", () => {
  beforeEach(setup);

  it("reopens the invoice balance, only once, and needs a reason", async () => {
    const inv = await invoice(ids.custA, 1000);
    const p = await record(input({ allocations: [{ kind: "invoice", invoice_id: inv.id, amount: 1000 }] }));
    expect((await summary(inv.id)).payment_status).toBe("paid");

    await rejectsWithCode(cancel(p.id as string, " "), "REASON_REQUIRED");
    expect((await cancel(p.id as string)).already_cancelled).toBe(false);
    expect(await summary(inv.id)).toEqual({ paid: 0, balance: 1000, payment_status: "unpaid" });
    expect((await cancel(p.id as string)).already_cancelled).toBe(true);
    // The freed balance can be paid again.
    await record(input({ allocations: [{ kind: "invoice", invoice_id: inv.id, amount: 1000 }] }));
    expect((await summary(inv.id)).payment_status).toBe("paid");
  });

  it("cannot be edited or deleted, only cancelled", async () => {
    const p = await record(input({ allocations: [{ kind: "advance", amount: 10 }] }));
    await expect(q(`UPDATE public.payments SET amount = 99 WHERE id = $1`, [p.id])).rejects.toThrow(/PAYMENT_IMMUTABLE/);
    await expect(q(`DELETE FROM public.payments WHERE id = $1`, [p.id])).rejects.toThrow(/PAYMENT_IMMUTABLE/);
    await expect(q(`UPDATE public.payment_allocations SET amount = 99 WHERE payment_id = $1`, [p.id])).rejects.toThrow(/PAYMENT_IMMUTABLE/);
    await expect(q(`DELETE FROM public.payment_allocations WHERE payment_id = $1`, [p.id])).rejects.toThrow(/PAYMENT_IMMUTABLE/);
    await cancel(p.id as string);
    await expect(q(`UPDATE public.payments SET status = 'received', cancelled_at = NULL WHERE id = $1`, [p.id])).rejects.toThrow(/PAYMENT_IMMUTABLE/);
  });
});

describe("guards on invoices that have been paid", () => {
  beforeEach(setup);

  it("cannot be cancelled or cut below what was received, until the receipt is cancelled", async () => {
    const inv = await invoice(ids.custA, 1000);
    const p = await record(input({ allocations: [{ kind: "invoice", invoice_id: inv.id, amount: 600 }] }));
    await expect(q(`UPDATE public.invoices SET status = 'cancelled' WHERE id = $1`, [inv.id])).rejects.toThrow(/INVOICE_HAS_PAYMENTS/);
    await expect(q(`UPDATE public.invoices SET total_amount = 500 WHERE id = $1`, [inv.id])).rejects.toThrow(/TOTAL_BELOW_PAID/);
    await q(`UPDATE public.invoices SET total_amount = 700 WHERE id = $1`, [inv.id]);   // still covers the 600
    await cancel(p.id as string);
    await q(`UPDATE public.invoices SET status = 'cancelled' WHERE id = $1`, [inv.id]);
    expect((await summary(inv.id)).payment_status).toBe("cancelled");
  });
});

describe("who can read what", () => {
  beforeEach(setup);

  it("customers see only their own received payments and their invoices' balances", async () => {
    const mine = await invoice(ids.custA, 1000);
    const theirs = await invoice(ids.custB, 500);
    const pa = await record(input({ allocations: [{ kind: "invoice", invoice_id: mine.id, amount: 300 }] }));
    await record(input({ user_id: ids.custB, allocations: [{ kind: "invoice", invoice_id: theirs.id, amount: 100 }] }));
    const gone = await record(input({ allocations: [{ kind: "advance", amount: 50 }] }));
    await cancel(gone.id as string);

    const seen = await t.as("authenticated", ids.custA, async (tx) => ({
      payments: (await tx.query<{ id: string }>(`SELECT id FROM public.payments`)).rows.map((r) => r.id),
      allocations: (await tx.query(`SELECT 1 FROM public.payment_allocations`)).rows.length,
      summary: (await tx.query<{ invoice_id: string }>(`SELECT invoice_id FROM public.invoice_payment_summary`)).rows.map((r) => r.invoice_id),
    }));
    expect(seen.payments).toEqual([pa.id]);        // not B's, not the cancelled one
    expect(seen.allocations).toBe(1);
    expect(seen.summary).toEqual([mine.id]);       // the view does not leak B's invoice
  });

  it("customers and anon cannot write or call the functions", async () => {
    await expect(t.as("authenticated", ids.custA, (tx) =>
      tx.query(`INSERT INTO public.payments (request_id, receipt_number, numbering_mode, payment_date, amount, mode, channel, payer_name)
                VALUES (gen_random_uuid(), 'X-1', 'manual', current_date, 1, 'cash', 'offline', 'x')`))).rejects.toThrow();
    await expect(t.as("authenticated", ids.custA, (tx) =>
      tx.query(`SELECT public.record_payment('{}'::jsonb, $1)`, [ids.custA]))).rejects.toThrow();
    await expect(t.as("anon", null, (tx) => tx.query(`SELECT * FROM public.payments`))).rejects.toThrow();
  });
});
