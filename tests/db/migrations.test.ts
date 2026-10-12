/**
 * Database tests for the 20261015_* migrations: access rules, order placement,
 * stock, coupons and order status transitions, against real Postgres (PGlite).
 *
 * Concurrency (two checkouts racing for the last coupon use) relies on
 * Postgres row locks and is not reproducible in single-connection PGlite;
 * verify it on staging with scripts in the runbook.
 */
import { beforeAll, describe, expect, it } from "vitest";
import { computeInvoice } from "@/lib/invoice";
import { priceOrder, type OrderTaxBasis } from "@/lib/order-pricing";
import type { OrderItem } from "@/types/database.types";
import { createTestDb, migrationFiles, readMigration, rejectsWithCode, type Row, type TestDb } from "./test-db";

const ids = {
  admin: "00000000-0000-4000-8000-000000000001",
  custA: "00000000-0000-4000-8000-00000000000a",
  custB: "00000000-0000-4000-8000-00000000000b",
  custC: "00000000-0000-4000-8000-00000000000c",
  pending: "00000000-0000-4000-8000-0000000000ff",
  catParent: "10000000-0000-4000-8000-000000000001",
  catChild: "10000000-0000-4000-8000-000000000002",
  p1: "20000000-0000-4000-8000-000000000001",
  p2: "20000000-0000-4000-8000-000000000002",
  p3: "20000000-0000-4000-8000-000000000003",
  v1: "30000000-0000-4000-8000-000000000001",
  v2: "30000000-0000-4000-8000-000000000002",
  v3: "30000000-0000-4000-8000-000000000003",
  v4: "30000000-0000-4000-8000-000000000004",
};

let t: TestDb;

async function seed(db: TestDb) {
  const people: [keyof typeof ids, string, string][] = [
    ["admin", "admin", "approved"],
    ["custA", "customer", "approved"],
    ["custB", "customer", "approved"],
    ["custC", "customer", "approved"],
    ["pending", "customer", "pending"],
  ];
  for (const [key, role, status] of people) {
    await db.db.query(`INSERT INTO auth.users (id, email) VALUES ($1, $2)`, [ids[key], `${key}@test.in`]);
    await db.db.query(
      `INSERT INTO public.profiles (id, email, role, approval_status, company_name)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (id) DO UPDATE SET role = $3, approval_status = $4, company_name = $5`,
      [ids[key], `${key}@test.in`, role, status, `${key} Pvt Ltd`]
    );
  }
  await db.db.exec(`
    INSERT INTO public.categories (id, name, slug) VALUES ('${ids.catParent}', 'Drills', 'drills');
    INSERT INTO public.categories (id, name, slug, parent_id)
      VALUES ('${ids.catChild}', 'Twist Drills', 'twist-drills', '${ids.catParent}');
    INSERT INTO public.products (id, title, slug) VALUES
      ('${ids.p1}', 'Twist Drill 8mm', 'twist-drill-8'),
      ('${ids.p2}', 'End Mill 12mm', 'end-mill-12');
    INSERT INTO public.products (id, title, slug, is_active) VALUES ('${ids.p3}', 'Old Tool', 'old-tool', false);
    INSERT INTO public.product_categories (product_id, category_id) VALUES ('${ids.p1}', '${ids.catChild}');
    INSERT INTO public.product_variants (id, product_id, sku, list_price, stock_quantity, min_order_quantity) VALUES
      ('${ids.v1}', '${ids.p1}', 'TD-8', 1000, 10, 1),
      ('${ids.v2}', '${ids.p2}', 'EM-12', 500, 5, 2),
      ('${ids.v4}', '${ids.p3}', 'OLD-1', 100, 50, 1);
    INSERT INTO public.product_variants (id, product_id, sku, list_price, stock_quantity, is_archived)
      VALUES ('${ids.v3}', '${ids.p2}', 'EM-12-OLD', 400, 5, true);
  `);
}

// ---- helpers ---------------------------------------------------------------
interface ItemSpec {
  variant_id: string;
  quantity: number;
  unit_price: number;
  name?: string;
  /** The SKU's own GST %; omitted = settings default. */
  gst_rate?: number | null;
  /** Whether the coupon applies to this line (default true). */
  eligible?: boolean;
}
interface OrderSpec {
  user_id?: string;
  idempotency_key?: string;
  items?: ItemSpec[];
  discount_amount?: number;
  coupon?: { coupon_id: string; version: number } | null;
  tax?: Partial<OrderTaxBasis>;
}
interface OrderResult {
  order_id: string;
  order_number: string;
  subtotal: string;
  discount_amount: string;
  gst_amount: string;
  total_amount: string;
  replayed: boolean;
  stock: { variant_id: string; stock_after: number; backordered: number }[];
}
interface Coupon { id: string; version: number }

/** Seller in Gujarat, customer in Gujarat: CGST + SGST at the 18% default. */
const GUJARAT: OrderTaxBasis = { gstEnabled: true, defaultGstRate: 18, sellerStateCode: "24", placeOfSupply: "24-Gujarat" };

/** The payload the app sends: per-line discount and GST from the app's own pricing. */
const order = (spec: OrderSpec = {}) => {
  const items = spec.items ?? [{ variant_id: ids.v1, quantity: 2, unit_price: 1000, name: "Twist Drill 8mm" }];
  const priced = priceOrder(
    items.map((i) => ({
      quantity: i.quantity,
      unitPrice: i.unit_price,
      gstRate: i.gst_rate ?? null,
      couponEligible: i.eligible ?? true,
    })),
    spec.discount_amount ?? 0,
    { ...GUJARAT, ...spec.tax }
  );
  return {
    user_id: spec.user_id ?? ids.custA,
    idempotency_key: spec.idempotency_key ?? crypto.randomUUID(),
    shipping_address: "Plot 4, MIDC Waluj",
    customer_details: { company_name: "custA Pvt Ltd" },
    tax: priced.tax,
    items: items.map((i, k) => ({
      variant_id: i.variant_id,
      quantity: i.quantity,
      unit_price: i.unit_price,
      name: i.name,
      discount_amount: priced.lines[k].discountAmount,
      gst_rate: priced.lines[k].gstRate,
      cgst: priced.lines[k].cgst,
      sgst: priced.lines[k].sgst,
      igst: priced.lines[k].igst,
    })),
    discount_amount: priced.totals.discount,
    coupon: spec.coupon ?? null,
  };
};
type OrderInput = ReturnType<typeof order>;
const place = async (o: OrderInput) =>
  (await t.service<{ r: OrderResult }>(`SELECT public.place_order($1::jsonb) AS r`, [JSON.stringify(o)])).r;
const stockOf = async (variantId: string) =>
  (await t.one<{ s: number }>(`SELECT stock_quantity AS s FROM public.product_variants WHERE id = $1`, [variantId])).s;
const save = async (coupon: Record<string, unknown>, products: string[] = [], cats: string[] = [], custs: string[] = []) =>
  (await t.service<{ r: Coupon }>(
    `SELECT public.save_coupon($1::jsonb, $2::uuid[], $3::uuid[], $4::uuid[], $5) AS r`,
    [JSON.stringify(coupon), products, cats, custs, ids.admin]
  )).r;
interface CouponContext {
  coupon: { id: string; code: string; version: number };
  total_uses: number;
  customer_allowed: boolean;
  category_ids: string[];
}
const ctx = async (code: string, user: string) =>
  (await t.service<{ r: CouponContext | null }>(`SELECT public.coupon_checkout_context($1, $2) AS r`, [code, user])).r;
const withCoupon = (c: Coupon, discount: number, over: OrderSpec = {}) =>
  order({ discount_amount: discount, coupon: { coupon_id: c.id, version: c.version }, ...over });
const transition = async (orderId: string, status: string, changes: Record<string, unknown> = {}) =>
  (await t.service<{ r: Record<string, unknown> }>(
    `SELECT public.transition_order_status($1, $2, $3::jsonb, $4) AS r`,
    [orderId, status, JSON.stringify(changes), ids.admin]
  )).r;
const rows = async (sql: string, params: unknown[] = []) => (await t.db.query<Row>(sql, params)).rows;
const storedOrder = async (orderId: string) =>
  (await rows(`SELECT * FROM public.orders WHERE id = $1`, [orderId]))[0] as Row & {
    items: OrderItem[];
    tax_snapshot: Record<string, unknown>;
  };

beforeAll(async () => {
  t = await createTestDb({ applyNew: true });
  // Apply the new migrations a second time: they must be idempotent.
  for (const f of migrationFiles((name) => name.startsWith("20261015_"))) {
    await t.db.exec(readMigration(f));
  }
  await seed(t);
});

// ---------------------------------------------------------------------------
describe("migration set", () => {
  it("applies every migration, including invoices/quotes, except the two needing Supabase internals", () => {
    expect(t.skipped).toEqual(["20260814_create_platform_admin.sql", "20260926_backfill_auth_identities.sql"]);
    expect(t.applied).toEqual(expect.arrayContaining([
      "20261010_invoices_and_sales_settings.sql",
      "20261013_quotes.sql",
      "20261014_quote_status_history.sql",
    ]));
  });
});

describe("access rules", () => {
  it("anon can read products but not SKU prices", async () => {
    const products = await t.as("anon", null, (tx) => tx.query(`SELECT count(*)::int AS n FROM public.products`));
    expect((products.rows[0] as { n: number }).n).toBe(3);
    const skus = await t.as("anon", null, (tx) => tx.query(`SELECT * FROM public.product_variants`));
    expect(skus.rows).toHaveLength(0);
  });

  it("anon and customers cannot change a price", async () => {
    for (const [role, user] of [["anon", null], ["authenticated", ids.custA]] as const) {
      const r = await t.as(role, user, (tx) =>
        tx.query(`UPDATE public.product_variants SET list_price = 1 WHERE id = $1 RETURNING id`, [ids.v1]));
      expect(r.rows).toHaveLength(0);
    }
    expect(Number((await t.one(`SELECT list_price FROM public.product_variants WHERE id = $1`, [ids.v1])).list_price)).toBe(1000);
  });

  it("an admin session can still edit the catalogue", async () => {
    const r = await t.as("authenticated", ids.admin, (tx) =>
      tx.query(`UPDATE public.products SET title = title WHERE id = $1 RETURNING id`, [ids.p1]));
    expect(r.rows).toHaveLength(1);
  });

  it("customers cannot write orders or call server functions", async () => {
    await expect(t.as("authenticated", ids.custA, (tx) =>
      tx.query(`INSERT INTO public.orders (user_id, order_number, total_amount, shipping_address)
                VALUES ($1, 'HACK', 1, 'x')`, [ids.custA]))).rejects.toThrow(/permission denied/);
    await expect(t.as("authenticated", ids.custA, (tx) =>
      tx.query(`SELECT public.place_order('{}'::jsonb)`))).rejects.toThrow(/permission denied/);
  });

  it("customers cannot read coupons or stock logs", async () => {
    await expect(t.as("authenticated", ids.custA, (tx) => tx.query(`SELECT * FROM public.coupons`)))
      .rejects.toThrow(/permission denied/);
    await t.db.query(`INSERT INTO public.inventory_logs (sku_code, product_title, movement_type, quantity_delta, balance_before, balance_after)
                      VALUES ('X', 'X', 'MANUAL_ADJUSTMENT', 1, 0, 1)`);
    const r = await t.as("authenticated", ids.custA, (tx) => tx.query(`SELECT * FROM public.inventory_logs`));
    expect(r.rows).toHaveLength(0);
  });

  it("lets only the server record failed coupon attempts", async () => {
    await expect(t.as("authenticated", ids.custA, (tx) =>
      tx.query(`INSERT INTO public.coupon_attempts (user_id, code) VALUES ($1, 'GUESS')`, [ids.custA])))
      .rejects.toThrow(/permission denied/);
    const row = await t.service<{ n: number }>(
      `WITH ins AS (INSERT INTO public.coupon_attempts (user_id, code) VALUES ($1, 'GUESS') RETURNING 1)
       SELECT count(*)::int AS n FROM ins`, [ids.custA]);
    expect(row.n).toBe(1);
  });

  it("only admins can upload catalogue files", async () => {
    await expect(t.as("anon", null, (tx) =>
      tx.query(`INSERT INTO storage.objects (bucket_id, name) VALUES ('category-images', 'x.png')`)))
      .rejects.toThrow(/row-level security/);
    await t.as("authenticated", ids.admin, (tx) =>
      tx.query(`INSERT INTO storage.objects (bucket_id, name) VALUES ('category-images', 'ok.png')`));
  });
});

describe("document numbers", () => {
  it("are sequential, per type, 5+ digits", async () => {
    const next = async () => (await t.service<{ n: string }>(`SELECT public.next_document_number('PO') AS n`)).n;
    const year = new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata", year: "numeric" });
    expect(await next()).toBe(`PO-${year}-00001`);
    expect(await next()).toBe(`PO-${year}-00002`);
  });
});

describe("place_order", () => {
  let first: { input: OrderInput; result: OrderResult };

  it("places an order with real prices, GST and a stock log", async () => {
    const input = order();
    first = { input, result: await place(input) };
    expect(first.result.order_number).toMatch(/^ORD-\d{4}-00001$/);
    expect(Number(first.result.subtotal)).toBe(2000);
    expect(Number(first.result.gst_amount)).toBe(360);
    expect(Number(first.result.total_amount)).toBe(2360);
    expect(await stockOf(ids.v1)).toBe(8);
    const [log] = await rows(`SELECT quantity_delta, balance_after FROM public.inventory_logs WHERE reference_id = $1`,
      [first.result.order_number]);
    expect(log).toMatchObject({ quantity_delta: -2, balance_after: 8 });
  });

  it("returns the same order for a repeated checkout attempt", async () => {
    const again = await place(first.input);
    expect(again.replayed).toBe(true);
    expect(again.order_id).toBe(first.result.order_id);
    expect(await stockOf(ids.v1)).toBe(8);
  });

  it("refuses a price the server did not quote", async () => {
    const e = await rejectsWithCode(place(order({ items: [{ variant_id: ids.v1, quantity: 1, unit_price: 1 }] })), "PRICE_CHANGED");
    expect(JSON.parse(e.detail ?? "{}")).toMatchObject({ sku: "TD-8", price: 1000 });
  });

  it("rolls back the whole order when one line fails", async () => {
    await rejectsWithCode(place(order({ items: [
      { variant_id: ids.v1, quantity: 1, unit_price: 1000 },
      { variant_id: ids.v2, quantity: 2, unit_price: 1 },
    ] })), "PRICE_CHANGED");
    expect(await stockOf(ids.v1)).toBe(8);
  });

  it("allows backorders: reserves what is on hand, records the rest", async () => {
    const r = await place(order({ user_id: ids.custB, items: [{ variant_id: ids.v2, quantity: 7, unit_price: 500 }] }));
    expect(await stockOf(ids.v2)).toBe(0);
    expect(r.stock[0]).toMatchObject({ stock_after: 0, backordered: 2 });
    const [o] = await rows(`SELECT items FROM public.orders WHERE id = $1`, [r.order_id]);
    expect((o as { items: Row[] }).items[0]).toMatchObject({ quantity: 7, reserved_quantity: 5, backordered_quantity: 2 });

    await transition(r.order_id, "cancelled");
    expect(await stockOf(ids.v2)).toBe(5); // only the 5 reserved units come back
  });

  it("stores each line's GST and the tax basis (IGST, per-SKU rate)", async () => {
    await t.db.query(`UPDATE public.product_variants SET gst_rate = 12 WHERE id = $1`, [ids.v2]);
    const r = await place(order({
      tax: { placeOfSupply: "27-Maharashtra" },
      items: [
        { variant_id: ids.v1, quantity: 1, unit_price: 1000 }, // settings default, 18%
        { variant_id: ids.v2, quantity: 2, unit_price: 500, gst_rate: 12 },
      ],
    }));
    expect(Number(r.gst_amount)).toBe(300);
    expect(Number(r.total_amount)).toBe(2300);

    const o = await storedOrder(r.order_id);
    expect(o.tax_snapshot).toMatchObject({
      gst_enabled: true, intra_state: false, place_of_supply: "27-Maharashtra", cgst: 0, sgst: 0, igst: 300,
    });
    expect(o.items[0]).toMatchObject({ gst_rate: 18, gst_amount: 180, taxable_amount: 1000, discount_amount: 0 });
    expect(o.items[1]).toMatchObject({ gst_rate: 12, gst_amount: 120, taxable_amount: 1000, discount_amount: 0 });
  });

  it("charges no GST when GST billing is off", async () => {
    const r = await place(order({ tax: { gstEnabled: false } }));
    expect(Number(r.gst_amount)).toBe(0);
    expect(Number(r.total_amount)).toBe(2000);
    expect((await storedOrder(r.order_id)).tax_snapshot).toMatchObject({ gst_enabled: false });
  });

  it("refuses GST amounts that don't match the rate or the place of supply", async () => {
    const wrongAmount = order();
    wrongAmount.items[0].cgst += 5;
    await rejectsWithCode(place(wrongAmount), "INVALID_TAX");

    const igstWithinState = order();
    igstWithinState.items[0].igst = 360;
    await rejectsWithCode(place(igstWithinState), "INVALID_TAX");

    const taxWhileOff = order({ tax: { gstEnabled: false } });
    taxWhileOff.items[0].gst_rate = 18;
    await rejectsWithCode(place(taxWhileOff), "INVALID_TAX");

    const missingBasis = { ...order(), tax: undefined };
    await rejectsWithCode(place(missingBasis as unknown as OrderInput), "INVALID_REQUEST");
  });

  it.each([
    ["BELOW_MIN_ORDER_QUANTITY", { variant_id: ids.v2, quantity: 1, unit_price: 500 }],
    ["ITEM_UNAVAILABLE", { variant_id: ids.v3, quantity: 1, unit_price: 400 }], // archived SKU
    ["ITEM_UNAVAILABLE", { variant_id: ids.v4, quantity: 1, unit_price: 100 }], // inactive product
  ])("refuses with %s", async (code, item) => {
    await rejectsWithCode(place(order({ items: [item] })), code);
  });

  it("refuses unapproved accounts, empty carts and couponless discounts", async () => {
    await rejectsWithCode(place(order({ user_id: ids.pending })), "ACCOUNT_NOT_APPROVED");
    await rejectsWithCode(place(order({ items: [] })), "CART_EMPTY");
    await rejectsWithCode(place(order({ discount_amount: 100 })), "INVALID_REQUEST");
  });

  it("never lets stock go below zero at the table level", async () => {
    await expect(t.db.query(`UPDATE public.product_variants SET stock_quantity = -1 WHERE id = $1`, [ids.v1]))
      .rejects.toThrow(/stock_non_negative/);
  });
});


describe("coupons", () => {
  let once: Coupon;
  let couponOrder: OrderResult;

  it("creates a coupon and reads its checkout context (code is case-insensitive)", async () => {
    once = await save({ code: "once10", discount_type: "percent", discount_value: 10, max_discount: 150, max_total_uses: 1 });
    expect(once.version).toBe(1);
    const c = await ctx(" Once10 ", ids.custA);
    expect(c).toMatchObject({ total_uses: 0, customer_allowed: true, coupon: { code: "ONCE10" } });
    expect(await ctx("NOPE", ids.custA)).toBeNull();
  });

  it("rejects invalid coupons at the table level", async () => {
    await expect(save({ code: "a!", discount_type: "fixed", discount_value: 10 })).rejects.toThrow(/coupons_code_format/);
    await expect(save({ code: "BIG", discount_type: "percent", discount_value: 150 })).rejects.toThrow(/coupons_discount_value/);
    await expect(save({ code: "ONCE10", discount_type: "fixed", discount_value: 10 })).rejects.toThrow(/coupons_code_live_key/);
  });

  it("applies the discount before GST and keeps a snapshot", async () => {
    couponOrder = await place(withCoupon(once, 150, { user_id: ids.custB }));
    expect(Number(couponOrder.discount_amount)).toBe(150);
    expect(Number(couponOrder.gst_amount)).toBe(333); // 18% of 1850
    expect(Number(couponOrder.total_amount)).toBe(2183);
    const o = await storedOrder(couponOrder.order_id);
    expect(o).toMatchObject({ coupon_code: "ONCE10", coupon_snapshot: { discount_value: 10 } });
    expect(o.items[0]).toMatchObject({ discount_amount: 150, taxable_amount: 1850, gst_amount: 333 });
    const [r] = await rows(`SELECT status FROM public.coupon_redemptions WHERE order_id = $1`, [couponOrder.order_id]);
    expect(r).toMatchObject({ status: "applied" });
  });

  it("enforces the total limit without touching stock", async () => {
    const before = await stockOf(ids.v1);
    await rejectsWithCode(place(withCoupon(once, 100, { user_id: ids.custC })), "COUPON_LIMIT_REACHED");
    expect(await stockOf(ids.v1)).toBe(before);
  });

  it("refuses a discount above what the coupon allows", async () => {
    const c = await save({ code: "CAP50", discount_type: "fixed", discount_value: 50 });
    await rejectsWithCode(place(withCoupon(c, 60)), "INVALID_DISCOUNT");
  });

  it("refuses line discounts that don't add up to the order discount", async () => {
    const c = await save({ code: "SPLIT20", discount_type: "fixed", discount_value: 20 });
    const input = withCoupon(c, 20, { items: [
      { variant_id: ids.v1, quantity: 1, unit_price: 1000 },
      { variant_id: ids.v2, quantity: 2, unit_price: 500 },
    ] });
    expect(input.items.map((i) => i.discount_amount)).toEqual([10, 10]); // split by line value
    input.items[1].discount_amount = 0;
    input.items[1].cgst = input.items[1].sgst = 90; // GST consistent with the tampered line
    await rejectsWithCode(place(input), "INVALID_DISCOUNT");
  });

  it("puts the whole discount on the lines the coupon applies to", async () => {
    const c = await save({ code: "MILLS100", discount_type: "fixed", discount_value: 100 });
    const r = await place(withCoupon(c, 100, { user_id: ids.custB, items: [
      { variant_id: ids.v1, quantity: 1, unit_price: 1000, eligible: false },
      { variant_id: ids.v2, quantity: 2, unit_price: 500, gst_rate: 12 },
    ] }));
    const o = await storedOrder(r.order_id);
    expect(o.items.map((i) => i.discount_amount)).toEqual([0, 100]);
    expect(Number(r.gst_amount)).toBe(180 + 108); // 12% of (1000 - 100)
    expect(Number(r.total_amount)).toBe(2000 - 100 + 288);
  });

  it("produces an invoice that matches the order to the paisa", async () => {
    const c = await save({ code: "ODD7", discount_type: "percent", discount_value: 7 });
    // An awkward price so every amount has paise: 7% of (3 x 333.33 + 1000) = 139.99
    await t.db.query(`UPDATE public.product_variants SET list_price = 333.33 WHERE id = $1`, [ids.v2]);
    const r = await place(withCoupon(c, 139.99, { user_id: ids.custB, tax: { placeOfSupply: "27-Maharashtra" }, items: [
      { variant_id: ids.v2, quantity: 3, unit_price: 333.33, gst_rate: 12 },
      { variant_id: ids.v1, quantity: 1, unit_price: 1000 },
    ] }));
    await t.db.query(`UPDATE public.product_variants SET list_price = 500 WHERE id = $1`, [ids.v2]);

    // What createInvoiceFromOrder does with an order that has a tax snapshot.
    const o = await storedOrder(r.order_id);
    const invoice = computeInvoice({
      items: o.items.map((i) => ({
        name: i.sku, quantity: i.quantity, unitPrice: i.unit_price, discountAmount: i.discount_amount, gstRate: i.gst_rate,
      })),
      gstEnabled: o.tax_snapshot.gst_enabled as boolean,
      defaultGstRate: 18,
      sellerStateCode: "24",
      placeOfSupplyStateCode: "27",
    });
    expect(invoice.totals.discountTotal).toBe(Number(o.discount_amount));
    expect(invoice.totals.igstTotal).toBe(Number(o.gst_amount));
    expect(invoice.totals.subTotal).toBe(Number(o.total_amount));
  });

  it("enforces the per-customer limit", async () => {
    const c = await save({ code: "TWICE", discount_type: "fixed", discount_value: 10, max_uses_per_customer: 2 });
    const one = { items: [{ variant_id: ids.v1, quantity: 1, unit_price: 1000 }] };
    await place(withCoupon(c, 10, one));
    await place(withCoupon(c, 10, one));
    await rejectsWithCode(place(withCoupon(c, 10, one)), "COUPON_CUSTOMER_LIMIT_REACHED");
  });

  it("enforces first-order-only", async () => {
    const c = await save({ code: "WELCOME", discount_type: "fixed", discount_value: 10, first_order_only: true });
    await rejectsWithCode(place(withCoupon(c, 10)), "COUPON_FIRST_ORDER_ONLY");
    const ok = await place(withCoupon(c, 10, { user_id: ids.custC, items: [{ variant_id: ids.v1, quantity: 1, unit_price: 1000 }] }));
    expect(Number(ok.discount_amount)).toBe(10);
  });

  it("enforces validity dates, minimum order, customer list and active flag", async () => {
    const expired = await save({ code: "OLD", discount_type: "fixed", discount_value: 10,
      valid_from: "2020-01-01T00:00:00Z", valid_until: "2020-12-31T18:29:59Z" });
    await rejectsWithCode(place(withCoupon(expired, 10)), "COUPON_EXPIRED");

    const future = await save({ code: "SOON", discount_type: "fixed", discount_value: 10, valid_from: "2099-01-01T00:00:00Z" });
    await rejectsWithCode(place(withCoupon(future, 10)), "COUPON_NOT_STARTED");

    const min = await save({ code: "MIN5K", discount_type: "fixed", discount_value: 10, min_order_value: 5000 });
    await rejectsWithCode(place(withCoupon(min, 10, { items: [{ variant_id: ids.v1, quantity: 1, unit_price: 1000 }] })),
      "COUPON_MIN_ORDER_NOT_MET");

    const vip = await save({ code: "VIPB", discount_type: "fixed", discount_value: 10, customer_scope: "selected" }, [], [], [ids.custB]);
    await rejectsWithCode(place(withCoupon(vip, 10)), "COUPON_INVALID");
    expect((await ctx("VIPB", ids.custA))?.customer_allowed).toBe(false);
    expect((await ctx("VIPB", ids.custB))?.customer_allowed).toBe(true);

    const off = await save({ code: "OFF", discount_type: "fixed", discount_value: 10, is_active: false });
    await rejectsWithCode(place(withCoupon(off, 10)), "COUPON_INVALID");
  });

  it("refuses an order when an admin edited the coupon after it was applied", async () => {
    const c = await save({ code: "EDITME", discount_type: "fixed", discount_value: 10 });
    const edited = await save({ id: c.id, version: c.version, code: "EDITME", discount_type: "fixed", discount_value: 20 });
    expect(edited.version).toBe(2);
    await rejectsWithCode(place(withCoupon(c, 10)), "COUPON_CHANGED");
    // A second admin saving a stale copy is refused too.
    await expect(save({ id: c.id, version: 1, code: "EDITME", discount_type: "fixed", discount_value: 30 }))
      .rejects.toThrow(/COUPON_CHANGED/);
  });

  it("expands category coupons to sub-categories", async () => {
    await save({ code: "DRILLS", discount_type: "percent", discount_value: 5, applies_to: "categories" }, [], [ids.catParent]);
    expect([...(await ctx("DRILLS", ids.custA))!.category_ids].sort()).toEqual([ids.catParent, ids.catChild].sort());
  });

  it("releases the use when the order is cancelled, so it can be used again", async () => {
    const r = await transition(couponOrder.order_id, "cancelled");
    expect(r.coupons_released).toBe(1);
    expect((await ctx("ONCE10", ids.custC))?.total_uses).toBe(0);
    const fresh = (await ctx("ONCE10", ids.custC))!.coupon;
    const again = await place(withCoupon(fresh, 100, { user_id: ids.custC, items: [{ variant_id: ids.v1, quantity: 1, unit_price: 1000 }] }));
    expect(Number(again.discount_amount)).toBe(100);
  });

  it("deletes an unused coupon and archives a used one, freeing its code", async () => {
    const temp = await save({ code: "TEMP", discount_type: "fixed", discount_value: 10 });
    expect((await t.service<{ r: string }>(`SELECT public.remove_coupon($1) AS r`, [temp.id])).r).toBe("deleted");

    const usedId = (await ctx("ONCE10", ids.custA))!.coupon.id;
    expect((await t.service<{ r: string }>(`SELECT public.remove_coupon($1) AS r`, [usedId])).r).toBe("archived");
    expect(await ctx("ONCE10", ids.custA)).toBeNull();
    const reused = await save({ code: "ONCE10", discount_type: "fixed", discount_value: 5 });
    expect(reused.id).not.toBe(usedId);

    const usage = await t.service<{ active_uses: string; released_uses: string }>(
      `SELECT * FROM public.coupon_usage_summary(ARRAY[$1]::uuid[])`, [usedId]);
    expect(Number(usage.active_uses)).toBe(1);
    expect(Number(usage.released_uses)).toBe(1);
  });
});

describe("transition_order_status", () => {
  let orderId: string;
  let orderNumber: string;

  beforeAll(async () => {
    const r = await place(order({ user_id: ids.custA }));
    orderId = r.order_id;
    orderNumber = r.order_number;
  });

  it("refuses returned before shipping", async () => {
    await rejectsWithCode(transition(orderId, "returned"), "INVALID_TRANSITION");
  });

  it("stamps dispatch and delivery; the tax invoice is raised by the app, not here", async () => {
    await transition(orderId, "shipped", { courier_partner: "Blue Dart", awb_number: "BD123" });
    const r = await transition(orderId, "delivered");
    expect(r.order_number).toBe(orderNumber);
    expect(r.invoice_number).toBeNull();
    const [o] = await rows(`SELECT dispatched_at, delivered_at, awb_number FROM public.orders WHERE id = $1`, [orderId]);
    expect(o.dispatched_at).toBeTruthy();
    expect(o.delivered_at).toBeTruthy();
    expect(o.awb_number).toBe("BD123");
  });

  it("refuses moving a delivered order back", async () => {
    await rejectsWithCode(transition(orderId, "processing"), "INVALID_TRANSITION");
  });

  it("restocks a return exactly once and closes the order", async () => {
    const before = await stockOf(ids.v1);
    await transition(orderId, "returned", { notes: "Wrong size" });
    expect(await stockOf(ids.v1)).toBe(before + 2);
    await transition(orderId, "returned", { notes: "QC note" }); // details-only update
    expect(await stockOf(ids.v1)).toBe(before + 2);
    await rejectsWithCode(transition(orderId, "delivered"), "ORDER_CLOSED");
    const [o] = await rows(`SELECT return_reason FROM public.orders WHERE id = $1`, [orderId]);
    expect(o.return_reason).toBe("Wrong size");
  });

  it("matches the app's copy of the rules (src/lib/order-status.ts) for every status pair", async () => {
    const { canTransition } = await import("@/lib/order-status");
    const statuses = ["pending", "confirmed", "processing", "shipped", "delivered", "returned", "cancelled"] as const;
    const [row] = await rows(
      `INSERT INTO public.orders (user_id, order_number, total_amount, items, shipping_address)
       VALUES ($1, 'ORD-MATRIX', 1, '[]', 'x') RETURNING id`, [ids.custA]);

    const mismatches: string[] = [];
    for (const from of statuses) {
      for (const to of statuses) {
        const dbAllows = await t.db.transaction(async (tx) => {
          await tx.query(`UPDATE public.orders SET status = $1 WHERE id = $2`, [from, row.id]);
          await tx.exec("SET LOCAL ROLE service_role");
          let ok = true;
          try {
            await tx.query(`SELECT public.transition_order_status($1, $2, '{}'::jsonb, NULL)`, [row.id, to]);
          } catch {
            ok = false;
          }
          await tx.rollback();
          return ok;
        });
        if (dbAllows !== canTransition(from, to)) mismatches.push(`${from} -> ${to}: db=${dbAllows}`);
      }
    }
    expect(mismatches).toEqual([]);
  });

  it("skips legacy order lines that have no SKU id", async () => {
    const [row] = await rows(
      `INSERT INTO public.orders (user_id, order_number, total_amount, items, shipping_address)
       VALUES ($1, 'ORD-2026-4821', 100, '[{"id":"item-1","quantity":1,"name":"Legacy"}]', 'x') RETURNING id`,
      [ids.custA]);
    expect((await transition(row.id as string, "cancelled")).status).toBe("cancelled");
  });
});

describe("stock adjustments and purchase orders", () => {
  it("supports ADD, SUBTRACT (floored at 0) and SET", async () => {
    const adj = async (mode: string, q: number) =>
      (await t.service<{ r: { balance_after: number } }>(
        `SELECT public.adjust_variant_stock($1, $2, $3, 'MANUAL_ADJUSTMENT', 'REF', 'note', $4) AS r`,
        [ids.v2, mode, q, ids.admin])).r.balance_after;
    expect(await adj("SET", 7)).toBe(7);
    expect(await adj("ADD", 3)).toBe(10);
    expect(await adj("SUBTRACT", 99)).toBe(0);
  });

  it("credits a received purchase order exactly once", async () => {
    const po = await t.one<{ id: string }>(
      `INSERT INTO public.purchase_orders (order_number, variant_id, product_id, sku_code, product_title, order_quantity)
       VALUES ('PO-T-1', $1, $2, 'EM-12', 'End Mill 12mm', 20) RETURNING id`, [ids.v2, ids.p2]);
    const receive = async () => (await t.service<{ r: Record<string, unknown> }>(
      `SELECT public.receive_purchase_order($1, NULL, $2) AS r`, [po.id, ids.admin])).r;
    expect((await receive()).stock_after).toBe(20);
    expect((await receive()).already_received).toBe(true);
    expect(await stockOf(ids.v2)).toBe(20);
  });

  it("allows only one open automatic purchase order per SKU; manual ones are not limited", async () => {
    const insert = (n: string, isAuto: boolean) => t.db.query(
      `INSERT INTO public.purchase_orders (order_number, variant_id, product_id, sku_code, product_title, order_quantity, is_auto)
       VALUES ($1, $2, $3, 'EM-12', 'x', 5, $4)`, [n, ids.v2, ids.p2, isAuto]);
    await insert("PO-T-2", true);
    await expect(insert("PO-T-3", true)).rejects.toThrow(/one_open_auto_per_variant/);
    await insert("PO-T-4", false);
    await insert("PO-T-5", false);
  });
});

describe("rollback script", () => {
  it("refuses to drop coupon tables once coupons were used", async () => {
    const fs = await import("node:fs");
    const path = await import("node:path");
    const sql = fs.readFileSync(path.resolve(__dirname, "../../supabase/rollbacks/20261015_rollback.sql"), "utf8");
    await expect(t.db.exec(sql)).rejects.toThrow(/Coupons have been used/);
    await t.db.exec("ROLLBACK").catch(() => undefined);
  });
});
