/**
 * 20261024_ledger on a database that already has invoices and receipts: the migration posts
 * every live document once, skips cancelled ones, and a second run changes nothing.
 */
import { beforeAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { computeInvoice } from "@/lib/invoice";
import { createTestDb, readMigration, type Row, type TestDb } from "./test-db";

const admin = "00000000-0000-4000-8000-000000000001";
const cust = "00000000-0000-4000-8000-00000000000a";
let t: TestDb;
const q = async (sql: string, params: unknown[] = []) => (await t.db.query<Row>(sql, params)).rows;
const today = () => new Date(Date.now() + 5.5 * 3600 * 1000).toISOString().slice(0, 10);

async function invoice(number: string, status: "issued" | "cancelled") {
  const c = computeInvoice({
    items: [{ name: "TD-8", quantity: 10, unitPrice: 100, gstRate: 18 }],
    gstEnabled: true, defaultGstRate: 18, sellerStateCode: "24", placeOfSupplyStateCode: "24",
  });
  const [row] = await q(
    `INSERT INTO public.invoices (invoice_number, invoice_date, bill_to, gst_enabled, items, totals, total_amount, user_id, status, stock_owner)
     VALUES ($1, current_date - 5, '{"name":"Buyer"}'::jsonb, true, $2, $3, $4, $5, $6, 'none') RETURNING id`,
    [number, JSON.stringify(c.lines), JSON.stringify(c.totals), c.totals.total, cust, status]);
  return row.id as string;
}

beforeAll(async () => {
  t = await createTestDb({ applyNew: true, skipFrom: "20261024" });
  for (const [id, role] of [[admin, "admin"], [cust, "customer"]]) {
    await t.db.query(`INSERT INTO auth.users (id, email) VALUES ($1, $2)`, [id, `${role}@test.in`]);
    await t.db.query(
      `INSERT INTO public.profiles (id, email, role, approval_status, company_name) VALUES ($1, $2, $3, 'approved', 'Buyer Pvt Ltd')
       ON CONFLICT (id) DO UPDATE SET role = $3`, [id, `${role}@test.in`, role]);
  }
  await t.db.query(`UPDATE public.sales_settings SET bank_name = 'HDFC Bank', account_no = '50200012345678', ifsc = 'HDFC0001234' WHERE id = true`);
});

describe("ledger backfill", () => {
  it("posts existing documents once and is safe to run again", async () => {
    const live = await invoice("OLD/1", "issued");
    await invoice("OLD/2", "cancelled");
    await t.service(`SELECT public.record_payment($1::jsonb, $2)`, [
      JSON.stringify({ request_id: randomUUID(), user_id: cust, payment_date: today(), amount: 500, mode: "upi", reference: null,
                       deposit_account: null, channel: "offline", remarks: null, manual_number: null,
                       allocations: [{ kind: "invoice", invoice_id: live, amount: 500 }] }),
      admin,
    ]);

    await t.db.exec(readMigration("20261024_ledger.sql"));
    const count = async () => (await q(`SELECT voucher_type, count(*)::int AS n FROM public.ledger_entries GROUP BY 1 ORDER BY 1`));
    expect(await count()).toEqual([{ voucher_type: "invoice", n: 1 }, { voucher_type: "receipt", n: 1 }]);
    const [bal] = await q(`SELECT sum(debit - credit)::float AS b FROM public.ledger_lines WHERE party_id = $1`, [cust]);
    expect(bal.b).toBe(680);

    // The invoice bank details became the default bank account, and the receipt went there.
    const [bank] = await q(`SELECT name, account_no, ifsc, is_default FROM public.ledger_accounts WHERE kind = 'bank'`);
    expect(bank).toEqual({ name: "HDFC Bank", account_no: "50200012345678", ifsc: "HDFC0001234", is_default: true });

    await t.db.exec(readMigration("20261024_ledger.sql"));
    expect(await count()).toEqual([{ voucher_type: "invoice", n: 1 }, { voucher_type: "receipt", n: 1 }]);
    expect((await q(`SELECT count(*)::int AS n FROM public.ledger_accounts WHERE kind = 'bank'`))[0].n).toBe(1);
  });
});
