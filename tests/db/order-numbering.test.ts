/**
 * Database tests for 20261019_order_numbering: Sales Settings order numbers and typed numbers.
 * Real Postgres (PGlite).
 */
import { beforeEach, describe, expect, it } from "vitest";
import { priceOrder, type OrderTaxBasis } from "@/lib/order-pricing";
import { createTestDb, rejectsWithCode, type Row, type TestDb } from "./test-db";

const ids = {
  admin: "00000000-0000-4000-8000-000000000001",
  cust: "00000000-0000-4000-8000-00000000000a",
  p1: "20000000-0000-4000-8000-000000000001",
  v1: "30000000-0000-4000-8000-000000000001",
};
const GUJARAT: OrderTaxBasis = { gstEnabled: true, defaultGstRate: 18, sellerStateCode: "24", placeOfSupply: "24-Gujarat" };

let t: TestDb;
const q = async (sql: string, params: unknown[] = []) => (await t.db.query<Row>(sql, params)).rows;

beforeEach(async () => {
  t = await createTestDb({ applyNew: true });
  for (const [key, role] of [["admin", "admin"], ["cust", "customer"]] as const) {
    await t.db.query(`INSERT INTO auth.users (id, email) VALUES ($1, $2)`, [ids[key], `${key}@test.in`]);
    await t.db.query(
      `INSERT INTO public.profiles (id, email, role, approval_status, company_name)
       VALUES ($1, $2, $3, 'approved', $4)
       ON CONFLICT (id) DO UPDATE SET role = $3, approval_status = 'approved', company_name = $4`,
      [ids[key], `${key}@test.in`, role, `${key} Pvt Ltd`]);
  }
  await t.db.exec(`
    INSERT INTO public.products (id, title, slug) VALUES ('${ids.p1}', 'Twist Drill 8mm', 'twist-drill-8');
    INSERT INTO public.product_variants (id, product_id, sku, list_price, stock_quantity, min_order_quantity)
      VALUES ('${ids.v1}', '${ids.p1}', 'TD-8', 1000, 100, 1);
  `);
});

const placeOrder = async () => {
  const priced = priceOrder([{ quantity: 1, unitPrice: 1000, gstRate: null, couponEligible: true }], 0, GUJARAT);
  const payload = {
    user_id: ids.cust, idempotency_key: crypto.randomUUID(), shipping_address: "Plot 4",
    customer_details: { company_name: "Test Co" }, tax: priced.tax,
    items: [{ variant_id: ids.v1, quantity: 1, unit_price: 1000, name: "Item",
      discount_amount: priced.lines[0].discountAmount, gst_rate: priced.lines[0].gstRate,
      cgst: priced.lines[0].cgst, sgst: priced.lines[0].sgst, igst: priced.lines[0].igst }],
    discount_amount: 0, coupon: null,
  };
  return (await t.service<{ r: { order_id: string; order_number: string } }>(
    `SELECT public.place_order($1::jsonb) AS r`, [JSON.stringify(payload)])).r;
};
const rename = async (orderId: string, number: string, actor = ids.admin) =>
  (await t.service<{ r: Record<string, unknown> }>(`SELECT public.rename_order($1, $2, $3) AS r`, [orderId, number, actor])).r;

describe("automatic order numbers", () => {
  it("come from Sales Settings: prefix / financial year / counter", async () => {
    const a = await placeOrder();
    const b = await placeOrder();
    expect(a.order_number).toMatch(/^SI\/ORD\/\d{2}-\d{2}\/01$/);
    expect(b.order_number).toMatch(/^SI\/ORD\/\d{2}-\d{2}\/02$/);
  });

  it("follow an edited prefix, digits and counter, and restart at 1 in a new financial year", async () => {
    await q(`UPDATE public.sales_settings SET order_prefix = 'WEB', order_pad = 4, order_fy = '20-21', order_next_number = 57`);
    const a = await placeOrder();                              // stale FY: restarts at 1
    expect(a.order_number).toMatch(/^WEB\/\d{2}-\d{2}\/0001$/);
    const [s] = await q(`SELECT order_next_number AS n FROM public.sales_settings`);
    expect(s.n).toBe(2);
  });

  it("are not used up by a checkout that fails", async () => {
    const before = (await q(`SELECT order_next_number AS n FROM public.sales_settings`))[0].n;
    const payload = { user_id: ids.cust, idempotency_key: crypto.randomUUID(), shipping_address: "x",
      tax: { gst_enabled: true, intra_state: true }, items: [{ variant_id: ids.v1, quantity: 1, unit_price: 1, discount_amount: 0, gst_rate: 0, cgst: 0, sgst: 0, igst: 0 }], discount_amount: 0 };
    await rejectsWithCode(t.service(`SELECT public.place_order($1::jsonb)`, [JSON.stringify(payload)]), "PRICE_CHANGED");
    expect((await q(`SELECT order_next_number AS n FROM public.sales_settings`))[0].n).toBe(before);
  });

  it("leave other document types on the old year counter", async () => {
    const year = new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata", year: "numeric" });
    const n = (await t.service<{ n: string }>(`SELECT public.next_document_number('PO') AS n`)).n;
    expect(n).toBe(`PO-${year}-00001`);
  });
});

describe("typed order numbers", () => {
  it("rename an order without moving the counter, and the next automatic number is unaffected", async () => {
    const a = await placeOrder();
    const r = await rename(a.order_id, "ORD-ONLINE-77");
    expect(r).toMatchObject({ changed: true, order_number: "ORD-ONLINE-77", previous: a.order_number });
    expect((await q(`SELECT order_number FROM public.orders WHERE id = $1`, [a.order_id]))[0].order_number).toBe("ORD-ONLINE-77");
    const b = await placeOrder();
    expect(b.order_number).toMatch(/\/02$/);
  });

  it("is a no-op for the same number, and refuses duplicates, bad formats and missing orders", async () => {
    const a = await placeOrder();
    const b = await placeOrder();
    expect((await rename(a.order_id, a.order_number)).changed).toBe(false);
    await rejectsWithCode(rename(b.order_id, a.order_number), "DUPLICATE_ORDER_NUMBER");
    await rejectsWithCode(rename(b.order_id, "bad number!"), "INVALID_ORDER_NUMBER");
    await rejectsWithCode(rename(b.order_id, "  "), "INVALID_ORDER_NUMBER");
    await rejectsWithCode(rename("00000000-0000-4000-8000-0000000000ee", "X-1"), "ORDER_NOT_FOUND");
    expect((await q(`SELECT order_number FROM public.orders WHERE id = $1`, [b.order_id]))[0].order_number).toBe(b.order_number);
  });

  it("can be done by admins only", async () => {
    const a = await placeOrder();
    await rejectsWithCode(rename(a.order_id, "X-2", ids.cust), "ADMIN_REQUIRED");
    await expect(t.as("authenticated", ids.cust, (tx) => tx.query(`SELECT public.rename_order($1, 'X-3', $2)`, [a.order_id, ids.cust]))).rejects.toThrow();
  });
});
