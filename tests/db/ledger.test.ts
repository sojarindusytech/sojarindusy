/**
 * Database tests for 20261024_ledger: every document posts a balanced entry, edits and cancels
 * reverse instead of rewriting, payments made, journals and opening balances, the books lock,
 * the reports (running balance, ageing) and who can see what. Real Postgres (PGlite).
 */
import { beforeAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { computeInvoice } from "@/lib/invoice";
import { createTestDb, rejectsWithCode, type Row, type TestDb } from "./test-db";

const ids = {
  admin: "00000000-0000-4000-8000-000000000001",
  custA: "00000000-0000-4000-8000-00000000000a",
  custB: "00000000-0000-4000-8000-00000000000b",
  custC: "00000000-0000-4000-8000-00000000000c",
  custD: "00000000-0000-4000-8000-00000000000d",
  maker: "00000000-0000-4000-8000-0000000000e1",
};

let t: TestDb;
let n = 0;
const today = () => new Date(Date.now() + 5.5 * 3600 * 1000).toISOString().slice(0, 10);
const daysAgo = (d: number) => new Date(Date.now() + 5.5 * 3600 * 1000 - d * 86400000).toISOString().slice(0, 10);
const q = async (sql: string, params: unknown[] = []) => (await t.db.query<Row>(sql, params)).rows;

beforeAll(async () => {
  t = await createTestDb({ applyNew: true });
  const people = [["admin", "admin"], ["custA", "customer"], ["custB", "customer"], ["custC", "customer"], ["custD", "customer"], ["maker", "manufacturer"]] as const;
  for (const [key, role] of people) {
    await t.db.query(`INSERT INTO auth.users (id, email) VALUES ($1, $2)`, [ids[key], `${key}@test.in`]);
    await t.db.query(
      `INSERT INTO public.profiles (id, email, role, approval_status, company_name)
       VALUES ($1, $2, $3, 'approved', $4)
       ON CONFLICT (id) DO UPDATE SET role = $3, approval_status = 'approved', company_name = $4`,
      [ids[key], `${key}@test.in`, role, `${key} Pvt Ltd`]);
  }
});

/** An issued invoice. Defaults: 10 x ₹100 at 18%, same state (₹1,180). */
async function invoice(opts: { user?: string | null; price?: number; qty?: number; interstate?: boolean; date?: string; gst?: boolean } = {}) {
  const c = computeInvoice({
    items: [{ name: "TD-8", sku: "TD-8", quantity: opts.qty ?? 10, unitPrice: opts.price ?? 100, gstRate: 18 }],
    gstEnabled: opts.gst ?? true, defaultGstRate: 18, sellerStateCode: "24", placeOfSupplyStateCode: opts.interstate ? "27" : "24",
  });
  const [row] = await q(
    `INSERT INTO public.invoices (invoice_number, invoice_date, bill_to, place_of_supply, gst_enabled, items, totals,
                                  total_amount, user_id, status, stock_owner)
     VALUES ($1, $2, '{"name":"Buyer"}'::jsonb, '24-Gujarat', $3, $4, $5, $6, $7, 'issued', 'none')
     RETURNING id, invoice_number`,
    [`INV-L-${++n}`, opts.date ?? daysAgo(3), opts.gst ?? true, JSON.stringify(c.lines), JSON.stringify(c.totals), c.totals.total,
     opts.user === undefined ? ids.custA : opts.user]);
  return { id: row.id as string, number: row.invoice_number as string, totals: c.totals };
}

/** The live entry's lines for a document, keyed by account. */
interface LiveLine { key: string; kind: string; party_id: string | null; debit: number; credit: number; bill_ref: string | null; bill_type: string | null }
async function liveLines(type: string, sourceId: string): Promise<LiveLine[]> {
  return q(
    `SELECT a.system_key AS key, a.kind, l.party_id, l.debit::float AS debit, l.credit::float AS credit, l.bill_ref, l.bill_type
       FROM public.ledger_lines l
       JOIN public.ledger_entries e ON e.id = l.entry_id
       JOIN public.ledger_accounts a ON a.id = l.account_id
      WHERE e.voucher_type = $1 AND e.source_id = $2 AND NOT e.is_reversal AND e.reversed_by IS NULL
      ORDER BY l.line_no`, [type, sourceId]) as unknown as Promise<LiveLine[]>;
}

const entriesOf = async (type: string, sourceId: string) =>
  q(`SELECT is_reversal, reversed_by IS NOT NULL AS reversed, entry_date::text AS date FROM public.ledger_entries
      WHERE voucher_type = $1 AND source_id = $2 ORDER BY seq`, [type, sourceId]);

const partyBalance = async (party: string) =>
  Number((await q(`SELECT coalesce(sum(debit - credit), 0)::float AS b FROM public.ledger_lines WHERE party_id = $1`, [party]))[0].b);

/** Every rupee debited somewhere is credited somewhere: the trial balance difference is zero. */
const trialDifference = async () =>
  Number((await q(`SELECT coalesce(sum(debit - credit), 0)::float AS d FROM public.ledger_lines`))[0].d);

const accountId = async (key: string) => (await q(`SELECT id FROM public.ledger_accounts WHERE system_key = $1`, [key]))[0].id as string;

const pay = async (allocations: Record<string, unknown>[], over: Record<string, unknown> = {}) =>
  (await t.service<{ r: Record<string, unknown> }>(`SELECT public.record_payment($1::jsonb, $2) AS r`, [
    JSON.stringify({
      request_id: randomUUID(), user_id: ids.custA, payment_date: today(),
      amount: allocations.reduce((s, a) => s + Number(a.amount), 0), mode: "bank_transfer", reference: "UTR1",
      deposit_account: null, channel: "offline", remarks: null, manual_number: null, allocations, ...over,
    }),
    ids.admin,
  ])).r;

const journal = async (input: Record<string, unknown>, actor = ids.admin) =>
  (await t.service<{ r: { id: string; voucher_number: string; replayed: boolean } }>(`SELECT public.post_journal($1::jsonb, $2) AS r`, [
    JSON.stringify({ request_id: randomUUID(), kind: "journal", entry_date: today(), ...input }), actor,
  ])).r;

const lockBooks = (date: string | null) => t.db.query(`UPDATE public.sales_settings SET books_locked_until = $1 WHERE id = true`, [date]);

describe("chart of accounts", () => {
  it("has the system accounts and a default bank and cash account", async () => {
    const keys = (await q(`SELECT system_key FROM public.ledger_accounts WHERE system_key IS NOT NULL`)).map((r) => r.system_key);
    for (const k of ["receivables", "payables", "cash", "sales", "sales_returns", "output_cgst", "output_sgst", "output_igst",
                     "round_off", "discount_allowed", "opening_balance", "suspense", "purchases"]) {
      expect(keys).toContain(k);
    }
    const defaults = await q(`SELECT kind FROM public.ledger_accounts WHERE is_default ORDER BY kind`);
    expect(defaults.map((r) => r.kind)).toEqual(["bank", "cash"]);
  });

  it("keeps system accounts and used accounts stable", async () => {
    await rejectsWithCode(t.db.query(`UPDATE public.ledger_accounts SET active = false WHERE system_key = 'sales'`), "ACCOUNT_LOCKED");
    await rejectsWithCode(t.db.query(`UPDATE public.ledger_accounts SET type = 'expense' WHERE system_key = 'sales'`), "ACCOUNT_LOCKED");
    await rejectsWithCode(t.db.query(`DELETE FROM public.ledger_accounts WHERE system_key = 'sales'`), "ACCOUNT_LOCKED");
    // Renaming is fine.
    await t.db.query(`UPDATE public.ledger_accounts SET name = 'Sales (Goods)' WHERE system_key = 'sales'`);
    await t.db.query(`UPDATE public.ledger_accounts SET name = 'Sales' WHERE system_key = 'sales'`);
  });

  it("moves the default bank account in one step", async () => {
    const [acc] = await q(
      `INSERT INTO public.ledger_accounts (code, name, type, kind, tally_group) VALUES ('1211', 'ICICI Current', 'asset', 'bank', 'Bank Accounts') RETURNING id`);
    const before = (await q(`SELECT id FROM public.ledger_accounts WHERE kind = 'bank' AND is_default`))[0].id;
    await t.service(`SELECT public.set_default_money_account($1)`, [acc.id]);
    expect((await q(`SELECT id FROM public.ledger_accounts WHERE kind = 'bank' AND is_default`)).map((r) => r.id)).toEqual([acc.id]);
    await t.service(`SELECT public.set_default_money_account($1)`, [before]);
  });
});

describe("invoices", () => {
  it("debit the customer and credit sales, GST and round off", async () => {
    const inv = await invoice({ price: 99.99, qty: 1 }); // ₹117.99 rounds to ₹118
    const lines = await liveLines("invoice", inv.id);
    const by = Object.fromEntries(lines.map((l) => [l.key, l]));
    expect(by.receivables).toMatchObject({ party_id: ids.custA, debit: inv.totals.total, credit: 0, bill_ref: inv.number, bill_type: "new" });
    expect(by.sales.credit).toBe(inv.totals.taxableTotal);
    expect(by.output_cgst.credit).toBe(inv.totals.cgstTotal);
    expect(by.output_sgst.credit).toBe(inv.totals.sgstTotal);
    expect(by.round_off.credit).toBeCloseTo(inv.totals.roundOff, 2);
    expect(by.output_igst).toBeUndefined(); // zero lines are not written
    expect(await trialDifference()).toBe(0);
  });

  it("use IGST for another state and no GST lines when GST is off", async () => {
    const inter = await invoice({ interstate: true });
    expect((await liveLines("invoice", inter.id)).map((l) => l.key)).toEqual(["receivables", "sales", "output_igst"]);
    const plain = await invoice({ gst: false });
    expect((await liveLines("invoice", plain.id)).map((l) => [l.key, l.debit || -l.credit])).toEqual([["receivables", 1000], ["sales", -1000]]);
  });

  it("an edit reverses the old entry and posts the new one; other updates post nothing", async () => {
    const inv = await invoice();
    await t.db.query(`UPDATE public.invoices SET stock_owner = 'legacy' WHERE id = $1`, [inv.id]);
    expect(await entriesOf("invoice", inv.id)).toHaveLength(1);

    const c = computeInvoice({ items: [{ name: "TD-8", quantity: 5, unitPrice: 100, gstRate: 18 }], gstEnabled: true, defaultGstRate: 18, sellerStateCode: "24", placeOfSupplyStateCode: "24" });
    await t.db.query(`UPDATE public.invoices SET items = $2, totals = $3, total_amount = $4 WHERE id = $1`,
      [inv.id, JSON.stringify(c.lines), JSON.stringify(c.totals), c.totals.total]);
    const entries = await entriesOf("invoice", inv.id);
    expect(entries.map((e) => [e.is_reversal, e.reversed])).toEqual([[false, true], [true, false], [false, false]]);
    expect(entries.every((e) => e.date === daysAgo(3))).toBe(true);
    expect((await liveLines("invoice", inv.id))[0].debit).toBe(590);
    expect(await trialDifference()).toBe(0);
  });

  it("a cancel reverses the entry, so the invoice nets to zero", async () => {
    const before = await partyBalance(ids.custB);
    const inv = await invoice({ user: ids.custB });
    expect(await partyBalance(ids.custB)).toBe(before + 1180);
    await t.db.query(`UPDATE public.invoices SET status = 'cancelled' WHERE id = $1`, [inv.id]);
    expect(await liveLines("invoice", inv.id)).toEqual([]);
    expect(await partyBalance(ids.custB)).toBe(before);
  });

  it("an invoice without a customer still posts, without a party", async () => {
    const inv = await invoice({ user: null });
    const [recv] = await liveLines("invoice", inv.id);
    expect(recv).toMatchObject({ key: "receivables", party_id: null, debit: 1180 });
  });
});

describe("credit and debit notes", () => {
  const issueCredit = async (invoiceId: string, treatment: "gst" | "commercial") =>
    (await t.service<{ note: { id: string; total_amount: number } }>(`SELECT to_jsonb(public.issue_credit_note($1::jsonb, $2::uuid)) AS note`, [
      JSON.stringify({ invoiceId, requestId: randomUUID(), date: today(), reason: "Damaged goods returned", treatment, manualNumber: null,
                       lines: [{ index: 0, quantity: 2 }] }),
      ids.admin,
    ])).note;

  it("a GST credit note credits the customer against Sales Returns and Output GST", async () => {
    const inv = await invoice();
    const cn = await issueCredit(inv.id, "gst");
    const by = Object.fromEntries((await liveLines("credit_note", cn.id)).map((l) => [l.key, l]));
    expect(by.receivables).toMatchObject({ party_id: ids.custA, credit: 236, bill_ref: inv.number, bill_type: "against" });
    expect(by.sales_returns.debit).toBe(200);
    expect(by.output_cgst.debit).toBe(18);
    expect(by.output_sgst.debit).toBe(18);
    // Payments Received is unchanged: a credit note does not reduce the invoice balance there.
    const [sum] = await q(`SELECT balance::float AS balance FROM public.invoice_payment_summary WHERE invoice_id = $1`, [inv.id]);
    expect(sum.balance).toBe(1180);
  });

  it("a commercial credit note is a discount", async () => {
    const inv = await invoice();
    const cn = await issueCredit(inv.id, "commercial");
    expect((await liveLines("credit_note", cn.id)).map((l) => [l.key, l.debit || -l.credit])).toEqual([["receivables", -236], ["discount_allowed", 236]]);
  });

  it("a debit note debits the customer and is reversed when cancelled", async () => {
    const inv = await invoice();
    const c = computeInvoice({ items: [{ name: "Freight", quantity: 1, unitPrice: 500, gstRate: 18 }], gstEnabled: true, defaultGstRate: 18, sellerStateCode: "24", placeOfSupplyStateCode: "24" });
    const dn = (await t.service<{ r: { id: string; debit_note_number: string } }>(`SELECT public.issue_debit_note($1::jsonb, $2) AS r`, [
      JSON.stringify({ request_id: randomUUID(), invoice_id: inv.id, debit_note_date: today(), reason: "additional_charges", reason_note: null,
                       manual_number: null, items: c.lines, totals: c.totals, total_amount: c.totals.total, amount_in_words: "x" }),
      ids.admin,
    ])).r;
    const [recv] = await liveLines("debit_note", dn.id);
    expect(recv).toMatchObject({ key: "receivables", debit: 590, bill_ref: dn.debit_note_number, bill_type: "new" });
    await t.service(`SELECT public.cancel_debit_note($1, 'Raised in error', $2)`, [dn.id, ids.admin]);
    expect(await liveLines("debit_note", dn.id)).toEqual([]);
    expect((await entriesOf("debit_note", dn.id)).map((e) => e.is_reversal)).toEqual([false, true]);
  });
});

describe("receipts", () => {
  it("debit the bank and credit the customer once per allocation", async () => {
    const inv = await invoice();
    const p = await pay([{ kind: "invoice", invoice_id: inv.id, amount: 1000 }, { kind: "advance", amount: 200 }]);
    const lines = await liveLines("receipt", p.id as string);
    expect(lines.map((l) => [l.key ?? l.kind, l.debit || -l.credit, l.bill_ref, l.bill_type])).toEqual([
      ["bank", 1200, null, null],
      ["receivables", -200, null, "advance"],
      ["receivables", -1000, inv.number, "against"],
    ]);
  });

  it("use the bank or cash account named in Deposited in, else cash for cash payments", async () => {
    await q(`INSERT INTO public.ledger_accounts (code, name, type, kind, tally_group) VALUES ('1215', 'HDFC Current', 'asset', 'bank', 'Bank Accounts')`);
    const named = await pay([{ kind: "advance", amount: 50 }], { deposit_account: "hdfc current" });
    const [bank] = await q(`SELECT a.name FROM public.ledger_lines l JOIN public.ledger_entries e ON e.id = l.entry_id
                             JOIN public.ledger_accounts a ON a.id = l.account_id
                            WHERE e.source_id = $1 AND l.debit > 0`, [named.id]);
    expect(bank.name).toBe("HDFC Current");
    const cash = await pay([{ kind: "advance", amount: 50 }], { mode: "cash" });
    expect((await liveLines("receipt", cash.id as string))[0].key).toBe("cash");
  });

  it("a cancelled receipt is reversed", async () => {
    const before = await partyBalance(ids.custA);
    const p = await pay([{ kind: "advance", amount: 75 }]);
    expect(await partyBalance(ids.custA)).toBe(before - 75);
    await t.service(`SELECT public.cancel_payment($1, 'Entered by mistake', $2)`, [p.id, ids.admin]);
    expect(await partyBalance(ids.custA)).toBe(before);
    expect(await trialDifference()).toBe(0);
  });
});

describe("payments made", () => {
  const payMaker = async (over: Record<string, unknown> = {}) =>
    (await t.service<{ r: Record<string, unknown> }>(`SELECT public.record_supplier_payment($1::jsonb, $2) AS r`, [
      JSON.stringify({ request_id: randomUUID(), manufacturer_id: ids.maker, payment_date: today(), amount: 25000, mode: "bank_transfer",
                       account_id: await accountId("cash"), reference: "UTR9", bill_reference: "MFG/12", remarks: null, ...over }),
      ids.admin,
    ])).r;

  it("debit the manufacturer and credit the bank or cash account", async () => {
    const sp = await payMaker();
    expect(sp.voucher_number).toMatch(/^SI\/PAY\/\d{2}-\d{2}\/\d{2,}$/);
    expect((await liveLines("supplier_payment", sp.id as string)).map((l) => [l.key, l.party_id, l.debit || -l.credit])).toEqual([
      ["payables", ids.maker, 25000], ["cash", null, -25000],
    ]);
  });

  it("can be cancelled once, which reverses it", async () => {
    const sp = await payMaker({ amount: 100 });
    const r = await t.service<{ r: { already_cancelled: boolean } }>(`SELECT public.cancel_supplier_payment($1, 'Wrong amount', $2) AS r`, [sp.id, ids.admin]);
    expect(r.r.already_cancelled).toBe(false);
    expect(await liveLines("supplier_payment", sp.id as string)).toEqual([]);
    const again = await t.service<{ r: { already_cancelled: boolean } }>(`SELECT public.cancel_supplier_payment($1, 'Wrong amount', $2) AS r`, [sp.id, ids.admin]);
    expect(again.r.already_cancelled).toBe(true);
  });

  it("only goes to a manufacturer, from an active bank or cash account", async () => {
    await rejectsWithCode(payMaker({ manufacturer_id: ids.custA }), "MANUFACTURER_NOT_FOUND");
    await rejectsWithCode(payMaker({ account_id: await accountId("sales") }), "ACCOUNT_NOT_FOUND");
    await rejectsWithCode(payMaker({ amount: 0 }), "INVALID_REQUEST");
    await rejectsWithCode(payMaker({ payment_date: "2999-01-01" }), "PAYMENT_DATE_INVALID");
    await rejectsWithCode(
      t.service(`SELECT public.record_supplier_payment($1::jsonb, $2)`, [JSON.stringify({ request_id: randomUUID() }), ids.custA]), "ADMIN_REQUIRED");
  });

  it("a retry returns the same payment", async () => {
    const request_id = randomUUID();
    const a = await payMaker({ request_id, amount: 10 });
    const b = await payMaker({ request_id, amount: 10 });
    expect(b.id).toBe(a.id);
  });
});

describe("journals and opening balances", () => {
  it("a journal must balance and keep parties on party accounts", async () => {
    const bankCharges = await accountId("bank_charges");
    const cash = await accountId("cash");
    const recv = await accountId("receivables");
    const ok = await journal({ narration: "Bank charges for October", lines: [
      { account_id: bankCharges, debit: 59 }, { account_id: cash, credit: 59 }] });
    expect(ok.voucher_number).toMatch(/^SI\/JV\//);
    await rejectsWithCode(journal({ narration: "Off by one", lines: [{ account_id: bankCharges, debit: 60 }, { account_id: cash, credit: 59 }] }), "JOURNAL_UNBALANCED");
    await rejectsWithCode(journal({ narration: "No party", lines: [{ account_id: recv, debit: 10 }, { account_id: cash, credit: 10 }] }), "PARTY_REQUIRED");
    await rejectsWithCode(journal({ narration: "Maker in debtors", lines: [{ account_id: recv, party_id: ids.maker, debit: 10 }, { account_id: cash, credit: 10 }] }), "PARTY_MISMATCH");
    await rejectsWithCode(journal({ narration: "Party on cash", lines: [{ account_id: bankCharges, debit: 10 }, { account_id: cash, party_id: ids.custA, credit: 10 }] }), "PARTY_NOT_ALLOWED");
    await rejectsWithCode(journal({ narration: "Both sides", lines: [{ account_id: bankCharges, debit: 10, credit: 10 }, { account_id: cash, credit: 0 }] }), "LINE_AMOUNT_INVALID");
    await rejectsWithCode(journal({ narration: "", lines: [{ account_id: bankCharges, debit: 10 }, { account_id: cash, credit: 10 }] }), "NARRATION_REQUIRED");
  });

  it("an opening balance balances itself against Opening Balance Adjustment", async () => {
    const recv = await accountId("receivables");
    const pay = await accountId("payables");
    const r = await journal({ kind: "opening", entry_date: daysAgo(200), lines: [
      { account_id: recv, party_id: ids.custD, debit: 5000, bill_ref: "OLD/101" },
      { account_id: pay, party_id: ids.maker, credit: 8000 }] });
    const lines = await q(`SELECT a.system_key AS key, l.debit::float AS debit, l.credit::float AS credit, l.bill_type
                             FROM public.ledger_lines l JOIN public.ledger_accounts a ON a.id = l.account_id
                            WHERE l.entry_id = $1 ORDER BY l.line_no`, [r.id]);
    expect(lines).toEqual([
      { key: "receivables", debit: 5000, credit: 0, bill_type: "new" },
      { key: "payables", debit: 0, credit: 8000, bill_type: "on_account" },
      { key: "opening_balance", debit: 3000, credit: 0, bill_type: null },
    ]);
    expect(await partyBalance(ids.custD)).toBe(5000);
  });

  it("a retry returns the same voucher, and cancelling reverses it once", async () => {
    const request_id = randomUUID();
    const lines = [{ account_id: await accountId("bank_charges"), debit: 5 }, { account_id: await accountId("cash"), credit: 5 }];
    const a = await journal({ request_id, narration: "Retry me", lines });
    const b = await journal({ request_id, narration: "Retry me", lines });
    expect(b).toMatchObject({ id: a.id, replayed: true });
    const c1 = await t.service<{ r: { already_cancelled: boolean } }>(`SELECT public.cancel_journal($1, 'Posted twice', $2) AS r`, [a.id, ids.admin]);
    expect(c1.r.already_cancelled).toBe(false);
    const c2 = await t.service<{ r: { already_cancelled: boolean } }>(`SELECT public.cancel_journal($1, 'Posted twice', $2) AS r`, [a.id, ids.admin]);
    expect(c2.r.already_cancelled).toBe(true);
    // Document entries can't be cancelled from here.
    const inv = await invoice();
    const [entry] = await q(`SELECT id FROM public.ledger_entries WHERE source_id = $1`, [inv.id]);
    await rejectsWithCode(t.service(`SELECT public.cancel_journal($1, 'Nope', $2)`, [entry.id, ids.admin]), "ENTRY_NOT_FOUND");
  });
});

describe("books lock", () => {
  it("refuses anything dated on or before the lock date, and allows it after", async () => {
    await lockBooks(daysAgo(1));
    try {
      await rejectsWithCode(invoice({ date: daysAgo(2) }), "BOOKS_LOCKED");
      await rejectsWithCode(journal({ entry_date: daysAgo(1), narration: "Too late", lines: [
        { account_id: await accountId("bank_charges"), debit: 1 }, { account_id: await accountId("cash"), credit: 1 }] }), "BOOKS_LOCKED");
      await rejectsWithCode(pay([{ kind: "advance", amount: 10 }], { payment_date: daysAgo(1) }), "BOOKS_LOCKED");
      const fresh = await invoice({ date: today() });
      expect(await liveLines("invoice", fresh.id)).not.toEqual([]);
    } finally {
      await lockBooks(null);
    }
  });

  it("refuses to cancel or edit a document in a locked period", async () => {
    const inv = await invoice({ date: daysAgo(5) });
    await lockBooks(daysAgo(4));
    try {
      await rejectsWithCode(t.db.query(`UPDATE public.invoices SET status = 'cancelled' WHERE id = $1`, [inv.id]), "BOOKS_LOCKED");
    } finally {
      await lockBooks(null);
    }
  });
});

describe("the books can't be rewritten", () => {
  it("entries and lines can't be changed or deleted, and the server can't write them directly", async () => {
    await rejectsWithCode(t.db.query(`UPDATE public.ledger_lines SET debit = debit WHERE true`), "LEDGER_IMMUTABLE");
    await rejectsWithCode(t.db.query(`DELETE FROM public.ledger_lines WHERE true`), "LEDGER_IMMUTABLE");
    await rejectsWithCode(t.db.query(`UPDATE public.ledger_entries SET narration = 'x' WHERE true`), "LEDGER_IMMUTABLE");
    await rejectsWithCode(t.db.query(`DELETE FROM public.ledger_entries WHERE true`), "LEDGER_IMMUTABLE");
    await expect(t.service(`INSERT INTO public.ledger_entries (entry_date, fy, voucher_type, voucher_number) VALUES (current_date, '26-27', 'journal', 'X')`))
      .rejects.toThrow(/permission denied/);
    await expect(t.service(`SELECT public.ledger_write_entry('journal', 'X', NULL, current_date, NULL, NULL, '[]'::jsonb, NULL)`))
      .rejects.toThrow(/permission denied/);
  });

  it("an unbalanced entry can't be committed", async () => {
    await rejectsWithCode(t.db.query(`SELECT public.ledger_write_entry('journal', 'X', NULL, current_date, NULL, NULL,
      jsonb_build_array(public.ledger_line_json(public.ledger_account_id('cash'), NULL, 10),
                        public.ledger_line_json(public.ledger_account_id('sales'), NULL, -9)), NULL)`), "LEDGER_UNBALANCED");
  });

  it("debits equal credits across the whole ledger", async () => {
    expect(await trialDifference()).toBe(0);
    const [unbalanced] = await q(`SELECT count(*)::int AS n FROM (SELECT entry_id FROM public.ledger_lines GROUP BY entry_id HAVING sum(debit) <> sum(credit)) x`);
    expect(unbalanced.n).toBe(0);
  });
});

describe("reports", () => {
  it("a statement shows a running balance and hides cancelled pairs", async () => {
    const inv = await invoice({ user: ids.custC, date: daysAgo(10) });
    const gone = await invoice({ user: ids.custC, date: daysAgo(8) });
    await t.db.query(`UPDATE public.invoices SET status = 'cancelled' WHERE id = $1`, [gone.id]);
    await pay([{ kind: "invoice", invoice_id: inv.id, amount: 500 }], { user_id: ids.custC });

    const rows = await t.service<{ r: unknown }>(`SELECT jsonb_agg(x) AS r FROM public.ledger_report_lines($1, $2, NULL, $3) x`, [daysAgo(30), today(), ids.custC]);
    const list = rows.r as { voucher_type: string; debit: number; credit: number; balance: number }[];
    expect(list.map((r) => [r.voucher_type, Number(r.debit), Number(r.credit), Number(r.balance)])).toEqual([
      ["invoice", 1180, 0, 1180], ["receipt", 0, 500, 680],
    ]);
    const all = await t.service<{ n: number }>(`SELECT count(*)::int AS n FROM public.ledger_report_lines($1, $2, NULL, $3, false, true)`, [daysAgo(30), today(), ids.custC]);
    expect(all.n).toBe(4);

    // Opening carries everything before the range.
    const later = await t.service<{ r: unknown }>(`SELECT jsonb_agg(x) AS r FROM public.ledger_report_lines($1, $2, NULL, $3) x`, [daysAgo(1), today(), ids.custC]);
    expect((later.r as { balance: number }[]).map((r) => Number(r.balance))).toEqual([680]);
  });

  it("balances add up per account and party", async () => {
    const rows = await q(`SELECT sum(opening + debit - credit)::float AS closing FROM public.ledger_balances('2000-01-01', $1)`, [today()]);
    expect(rows[0].closing).toBe(0);
    const [c] = await q(`SELECT sum(opening + debit - credit)::float AS b FROM public.ledger_balances('2000-01-01', $1) WHERE party_id = $2`, [today(), ids.custC]);
    expect(c.b).toBe(680);
  });

  it("ages what a customer owes oldest-first, by their credit days", async () => {
    // custD: ₹5,000 opening balance 200 days ago, then an invoice 10 days ago and ₹1,000 received.
    await invoice({ user: ids.custD, date: daysAgo(10) });
    await pay([{ kind: "advance", amount: 1000 }], { user_id: ids.custD });
    const [row] = await q(`SELECT due::float, d0_30::float, d31_60::float, d61_90::float, d90_plus::float, overdue::float
                             FROM public.ledger_receivable_ageing($1) WHERE party_id = $2`, [today(), ids.custD]);
    expect(row).toEqual({ due: 5180, d0_30: 1180, d31_60: 0, d61_90: 0, d90_plus: 4000, overdue: 4000 });
  });

  it("lists lines with no party on the receivable account", async () => {
    const inv = await invoice({ user: null });
    const r = await t.service<{ n: number }>(
      `SELECT count(*)::int AS n FROM public.ledger_report_lines($1, $2, NULL, NULL, true) WHERE voucher_number = $3`, [daysAgo(30), today(), inv.number]);
    expect(r.n).toBe(1);
  });
});

describe("customer access", () => {
  it("a customer reads only their own lines and entries", async () => {
    const seen = await t.as("authenticated", ids.custC, async (tx) => ({
      lines: (await tx.query<{ party_id: string }>(`SELECT party_id FROM public.ledger_lines`)).rows,
      entries: (await tx.query<{ n: number }>(`SELECT count(*)::int AS n FROM public.ledger_entries`)).rows[0].n,
    }));
    expect(seen.lines.length).toBeGreaterThan(0);
    expect(seen.lines.every((l) => l.party_id === ids.custC)).toBe(true);
    expect(seen.entries).toBe(4); // two invoices, the cancel reversal, one receipt
    await expect(t.as("authenticated", ids.custC, (tx) => tx.query(`SELECT * FROM public.ledger_accounts`))).rejects.toThrow(/permission denied/);
    await expect(t.as("authenticated", ids.custC, (tx) => tx.query(`SELECT * FROM public.supplier_payments`))).rejects.toThrow(/permission denied/);
  });
});
