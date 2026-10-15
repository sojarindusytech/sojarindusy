/**
 * Database tests for 20261019_01_document_number_padding and 20261022_order_number_padding:
 * every FY series pads its counter but never cuts a longer number (Postgres lpad
 * truncates), restarts each April, and only known series are accepted; order numbers
 * also skip numbers already typed by hand. Real Postgres (PGlite).
 */
import { beforeAll, describe, expect, it } from "vitest";
import { financialYear } from "@/lib/invoice";
import { createTestDb, rejectsWithCode, type TestDb } from "./test-db";

let t: TestDb;
const fy = financialYear();

const next = async (fn: string) => (await t.service<{ n: string }>(`SELECT public.${fn}() AS n`)).n;

beforeAll(async () => {
  t = await createTestDb({ applyNew: true });
});

describe("FY document numbers", () => {
  it.each([
    ["next_invoice_number", "invoice", "SI/INV"],
    ["next_quote_number", "quote", "SI/QT"],
    ["next_receipt_number", "receipt", "SI/RCPT"],
    ["next_po_number", "po", "SI/PO"],
    ["next_rfq_number", "rfq", "SI/RFQ"],
    ["next_order_number", "order", "SI/ORD"],
  ])("%s keeps counting past 99 instead of repeating .../10", async (fn, series, prefix) => {
    await t.db.query(
      `UPDATE public.sales_settings SET ${series}_prefix = $1, ${series}_fy = $2, ${series}_next_number = 99, ${series}_pad = 2 WHERE id = true`,
      [prefix, fy]
    );
    expect(await next(fn)).toBe(`${prefix}/${fy}/99`);
    expect(await next(fn)).toBe(`${prefix}/${fy}/100`);
    expect(await next(fn)).toBe(`${prefix}/${fy}/101`);
  });

  it("still pads short numbers to the configured digits", async () => {
    await t.db.query(`UPDATE public.sales_settings SET invoice_fy = $1, invoice_next_number = 7, invoice_pad = 3 WHERE id = true`, [fy]);
    expect(await next("next_invoice_number")).toBe(`SI/INV/${fy}/007`);
  });

  it("restarts at 1 in a new financial year", async () => {
    await t.db.query(`UPDATE public.sales_settings SET quote_fy = '00-01', quote_next_number = 57, quote_pad = 2 WHERE id = true`);
    expect(await next("next_quote_number")).toBe(`SI/QT/${fy}/01`);
    expect(await next("next_quote_number")).toBe(`SI/QT/${fy}/02`);
  });

  it("refuses an unknown series (column names are built from it)", async () => {
    await rejectsWithCode(t.service(`SELECT public.next_series_number('id = true; --')`), "INVALID_SERIES");
  });

  it("is not callable by customers", async () => {
    await expect(t.as("authenticated", null, (tx) => tx.query(`SELECT public.next_invoice_number()`)))
      .rejects.toThrow(/permission denied/);
  });
});

describe("order numbers", () => {
  it("skip a number an admin already gave an order by hand", async () => {
    await t.db.query(`UPDATE public.sales_settings SET order_prefix = 'SI/ORD', order_fy = $1, order_next_number = 5, order_pad = 2 WHERE id = true`, [fy]);
    await t.db.query(`INSERT INTO auth.users (id, email) VALUES ('00000000-0000-4000-8000-0000000000c1', 'c1@test.in')`);
    await t.db.query(
      `INSERT INTO public.profiles (id, email, role, approval_status, company_name)
       VALUES ('00000000-0000-4000-8000-0000000000c1', 'c1@test.in', 'customer', 'approved', 'C1')
       ON CONFLICT (id) DO NOTHING`);
    await t.db.query(
      `INSERT INTO public.orders (user_id, order_number, total_amount, shipping_address)
       VALUES ('00000000-0000-4000-8000-0000000000c1', $1, 100, 'x')`, [`SI/ORD/${fy}/05`]);
    expect(await next("next_order_number")).toBe(`SI/ORD/${fy}/06`);
    // place_order asks next_document_number('ORD'), which uses the same series.
    expect((await t.service<{ n: string }>(`SELECT public.next_document_number('ORD') AS n`)).n).toBe(`SI/ORD/${fy}/07`);
  });
});

describe("year-counter fallback", () => {
  it("goes past 5 digits instead of cutting the number", async () => {
    const year = new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata", year: "numeric" });
    await t.db.query(
      `INSERT INTO public.document_counters (doc_type, period_year, last_value) VALUES ('PO', $1, 99998)
       ON CONFLICT (doc_type, period_year) DO UPDATE SET last_value = 99998`,
      [Number(year)]
    );
    const n = async () => (await t.service<{ n: string }>(`SELECT public.next_document_number('PO') AS n`)).n;
    expect(await n()).toBe(`PO-${year}-99999`);
    expect(await n()).toBe(`PO-${year}-100000`);
  });
});
