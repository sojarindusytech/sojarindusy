/**
 * Database tests for 20261017_stock_ledger: reserve at order, deduct at shipment/invoice.
 * Real Postgres (PGlite); one fresh database per describe so scenarios don't leak.
 */
import { beforeEach, describe, expect, it } from "vitest";
import { priceOrder, type OrderTaxBasis } from "@/lib/order-pricing";
import { createTestDb, migrationFiles, readMigration, rejectsWithCode, type Row, type TestDb } from "./test-db";

const ids = {
  admin: "00000000-0000-4000-8000-000000000001",
  cust: "00000000-0000-4000-8000-00000000000a",
  other: "00000000-0000-4000-8000-00000000000b",
  p1: "20000000-0000-4000-8000-000000000001",
  v1: "30000000-0000-4000-8000-000000000001",
  v2: "30000000-0000-4000-8000-000000000002",
};
const GUJARAT: OrderTaxBasis = { gstEnabled: true, defaultGstRate: 18, sellerStateCode: "24", placeOfSupply: "24-Gujarat" };

let t: TestDb;

async function seed(db: TestDb, v1Stock = 10, v2Stock = 5) {
  for (const [key, role] of [["admin", "admin"], ["cust", "customer"], ["other", "customer"]] as const) {
    await db.db.query(`INSERT INTO auth.users (id, email) VALUES ($1, $2)`, [ids[key], `${key}@test.in`]);
    await db.db.query(
      `INSERT INTO public.profiles (id, email, role, approval_status, company_name)
       VALUES ($1, $2, $3, 'approved', $4)
       ON CONFLICT (id) DO UPDATE SET role = $3, approval_status = 'approved', company_name = $4`,
      [ids[key], `${key}@test.in`, role, `${key} Pvt Ltd`]
    );
  }
  await db.db.exec(`
    INSERT INTO public.products (id, title, slug) VALUES ('${ids.p1}', 'Twist Drill 8mm', 'twist-drill-8');
    INSERT INTO public.product_variants (id, product_id, sku, list_price, stock_quantity, min_order_quantity) VALUES
      ('${ids.v1}', '${ids.p1}', 'TD-8', 1000, ${v1Stock}, 1),
      ('${ids.v2}', '${ids.p1}', 'TD-10', 500, ${v2Stock}, 1);
  `);
}

const placeOrder = async (userId: string, lines: { variant: string; qty: number; price: number }[]) => {
  const priced = priceOrder(
    lines.map((l) => ({ quantity: l.qty, unitPrice: l.price, gstRate: null, couponEligible: true })),
    0,
    GUJARAT
  );
  const payload = {
    user_id: userId,
    idempotency_key: crypto.randomUUID(),
    shipping_address: "Plot 4",
    customer_details: { company_name: "Test Co" },
    tax: priced.tax,
    items: lines.map((l, k) => ({
      variant_id: l.variant, quantity: l.qty, unit_price: l.price, name: "Item",
      discount_amount: priced.lines[k].discountAmount, gst_rate: priced.lines[k].gstRate,
      cgst: priced.lines[k].cgst, sgst: priced.lines[k].sgst, igst: priced.lines[k].igst,
    })),
    discount_amount: 0,
    coupon: null,
  };
  return (await t.service<{ r: { order_id: string; order_number: string } }>(
    `SELECT public.place_order($1::jsonb) AS r`, [JSON.stringify(payload)])).r;
};
const transition = async (orderId: string, status: string) =>
  (await t.service<{ r: Record<string, unknown> }>(
    `SELECT public.transition_order_status($1, $2, '{}'::jsonb, $3) AS r`, [orderId, status, ids.admin])).r;
const q = async (sql: string, params: unknown[] = []) => (await t.db.query<Row>(sql, params)).rows;
const stock = async (v: string) => {
  const [r] = await q(`SELECT stock_quantity AS s, reserved_quantity AS r FROM public.product_variants WHERE id = $1`, [v]);
  return { onHand: r.s as number, reserved: r.r as number, available: (r.s as number) - (r.r as number) };
};
const logs = async (ref: string) =>
  q(`SELECT movement_type, quantity_delta, reserved_delta FROM public.inventory_logs WHERE reference_id = $1 ORDER BY created_at, id`, [ref]);

describe("order lifecycle: reserve, ship, cancel, return", () => {
  beforeEach(async () => {
    t = await createTestDb({ applyNew: true });
    await seed(t);
  });

  it("reserves on order, deducts on shipment, restocks on return", async () => {
    const o = await placeOrder(ids.cust, [{ variant: ids.v1, qty: 3, price: 1000 }]);
    expect(await stock(ids.v1)).toEqual({ onHand: 10, reserved: 3, available: 7 });

    await transition(o.order_id, "shipped");
    expect(await stock(ids.v1)).toEqual({ onHand: 7, reserved: 0, available: 7 });
    expect((await q(`SELECT stock_fulfilled_at FROM public.orders WHERE id = $1`, [o.order_id]))[0].stock_fulfilled_at).toBeTruthy();

    await transition(o.order_id, "delivered");           // no second deduction
    await transition(o.order_id, "delivered");           // details-only save, still none
    expect(await stock(ids.v1)).toEqual({ onHand: 7, reserved: 0, available: 7 });

    await transition(o.order_id, "returned");
    expect(await stock(ids.v1)).toEqual({ onHand: 10, reserved: 0, available: 10 });

    expect((await logs(o.order_number)).map((l) => [l.movement_type, l.quantity_delta, l.reserved_delta])).toEqual([
      ["ORDER_RESERVATION", 0, 3],
      ["ORDER_FULFILLED", -3, -3],
      ["RETURN_RESTOCK", 3, 0],
    ]);
  });

  it("shipping straight to delivered still deducts exactly once", async () => {
    const o = await placeOrder(ids.cust, [{ variant: ids.v1, qty: 2, price: 1000 }]);
    await transition(o.order_id, "delivered");
    expect(await stock(ids.v1)).toEqual({ onHand: 8, reserved: 0, available: 8 });
  });

  it("cancelling before shipment releases the reservation and leaves on-hand alone", async () => {
    const o = await placeOrder(ids.cust, [{ variant: ids.v1, qty: 4, price: 1000 }]);
    await transition(o.order_id, "cancelled");
    expect(await stock(ids.v1)).toEqual({ onHand: 10, reserved: 0, available: 10 });
  });

  it("refuses to cancel or move back an order that already shipped", async () => {
    const o = await placeOrder(ids.cust, [{ variant: ids.v1, qty: 1, price: 1000 }]);
    await transition(o.order_id, "shipped");
    await rejectsWithCode(transition(o.order_id, "cancelled"), "INVALID_TRANSITION");
    await rejectsWithCode(transition(o.order_id, "processing"), "INVALID_TRANSITION");
    expect(await stock(ids.v1)).toEqual({ onHand: 9, reserved: 0, available: 9 });
  });

  it("blocks shipping a backordered line until stock is received, then ships it", async () => {
    // 5 on hand, order 7: 5 reserved, 2 on backorder.
    const o = await placeOrder(ids.cust, [{ variant: ids.v2, qty: 7, price: 500 }]);
    expect(await stock(ids.v2)).toEqual({ onHand: 5, reserved: 5, available: 0 });

    const e = await rejectsWithCode(transition(o.order_id, "shipped"), "INSUFFICIENT_STOCK");
    expect(JSON.parse(e.detail ?? "{}")).toMatchObject({ sku: "TD-10", required: 7, short: 2 });
    // Refused means nothing changed.
    expect(await stock(ids.v2)).toEqual({ onHand: 5, reserved: 5, available: 0 });
    expect((await q(`SELECT status FROM public.orders WHERE id = $1`, [o.order_id]))[0].status).toBe("pending");

    // A purchase order arrives: 2 more on hand.
    await t.service(`SELECT public.adjust_variant_stock($1, 'ADD', 2, 'RESTOCK', 'PO', NULL, $2)`, [ids.v2, ids.admin]);
    await transition(o.order_id, "shipped");
    expect(await stock(ids.v2)).toEqual({ onHand: 0, reserved: 0, available: 0 });
  });

  it("will not ship goods that are reserved for another order", async () => {
    const first = await placeOrder(ids.cust, [{ variant: ids.v2, qty: 5, price: 500 }]);  // takes all 5
    const second = await placeOrder(ids.other, [{ variant: ids.v2, qty: 2, price: 500 }]); // pure backorder
    await rejectsWithCode(transition(second.order_id, "shipped"), "INSUFFICIENT_STOCK");
    await transition(first.order_id, "shipped");
    expect(await stock(ids.v2)).toEqual({ onHand: 0, reserved: 0, available: 0 });
  });

  it("never lets a manual adjustment drop on-hand below what orders reserved", async () => {
    await placeOrder(ids.cust, [{ variant: ids.v1, qty: 6, price: 1000 }]);
    const e = await rejectsWithCode(
      t.service(`SELECT public.adjust_variant_stock($1, 'SET', 4, 'MANUAL_ADJUSTMENT', NULL, NULL, $2)`, [ids.v1, ids.admin]),
      "BELOW_RESERVED");
    expect(JSON.parse(e.detail ?? "{}")).toMatchObject({ reserved: 6, requested: 4 });
    // And the table itself refuses a direct edit (bulk update, CSV import).
    await expect(t.db.query(`UPDATE public.product_variants SET stock_quantity = 4 WHERE id = $1`, [ids.v1]))
      .rejects.toThrow(/stock_covers_reserved/);
  });
});

describe("hand-made invoices own their stock", () => {
  async function invoice(items: { sku: string; quantity: number }[], owner = "invoice") {
    const [row] = await q(
      `INSERT INTO public.invoices (invoice_number, invoice_date, bill_to, items, totals, total_amount, stock_owner)
       VALUES ($1, current_date, '{}'::jsonb, $2::jsonb, '{}'::jsonb, 100, $3) RETURNING id, invoice_number`,
      [`SI/INV/T/${Math.random().toString(36).slice(2, 8)}`, JSON.stringify(items), owner]);
    return row as { id: string; invoice_number: string };
  }
  const post = (id: string) => t.service<{ r: Record<string, unknown> }>(`SELECT public.post_invoice_stock($1, $2) AS r`, [id, ids.admin]).then((x) => x.r);
  const reverse = (id: string) => t.service<{ r: Record<string, unknown> }>(`SELECT public.reverse_invoice_stock($1, $2, 'test') AS r`, [id, ids.admin]).then((x) => x.r);
  const repost = (id: string, oldItems: unknown[], newItems: unknown[]) =>
    t.service<{ r: Record<string, unknown> }>(
      `SELECT public.repost_invoice_stock($1, $2, $3::jsonb, $4::jsonb) AS r`,
      [id, ids.admin, JSON.stringify(oldItems), JSON.stringify(newItems)]).then((x) => x.r);

  beforeEach(async () => {
    t = await createTestDb({ applyNew: true });
    await seed(t);
  });

  it("deducts once, ignores custom lines, and refuses double posting", async () => {
    const inv = await invoice([{ sku: "TD-8", quantity: 3 }, { sku: "", quantity: 9 }, { sku: "NOT-A-SKU", quantity: 1 }]);
    expect((await post(inv.id)).posted).toBe(true);
    expect(await stock(ids.v1)).toEqual({ onHand: 7, reserved: 0, available: 7 });
    expect((await post(inv.id)).posted).toBe(false);        // idempotent
    expect((await stock(ids.v1)).onHand).toBe(7);
    expect((await logs(inv.invoice_number)).map((l) => [l.movement_type, l.quantity_delta])).toEqual([["INVOICE_ISSUED", -3]]);
  });

  it("reports shortfalls before any number is used, and refuses when available is short", async () => {
    await placeOrder(ids.cust, [{ variant: ids.v1, qty: 8, price: 1000 }]);        // 8 reserved, 2 available
    const short = await t.service<{ r: { sku: string; required: number; available: number }[] }>(
      `SELECT public.check_invoice_stock($1::jsonb) AS r`, [JSON.stringify([{ sku: "TD-8", quantity: 5 }, { sku: "TD-10", quantity: 1 }])]);
    expect(short.r).toEqual([{ sku: "TD-8", required: 5, available: 2 }]);

    const inv = await invoice([{ sku: "TD-8", quantity: 5 }]);
    const e = await rejectsWithCode(post(inv.id), "INSUFFICIENT_STOCK");
    expect(JSON.parse(e.detail ?? "{}")).toMatchObject({ sku: "TD-8", required: 5, available: 2, short: 3 });
    expect((await stock(ids.v1)).onHand).toBe(10);
  });

  it("an edit changes stock by the difference only", async () => {
    const inv = await invoice([{ sku: "TD-8", quantity: 3 }]);
    await post(inv.id);                                                  // on hand 7
    const v2 = [{ sku: "TD-8", quantity: 5 }, { sku: "TD-10", quantity: 2 }];
    await repost(inv.id, [{ sku: "TD-8", quantity: 3 }], v2);
    expect((await stock(ids.v1)).onHand).toBe(5);
    expect((await stock(ids.v2)).onHand).toBe(3);
    await repost(inv.id, v2, [{ sku: "TD-8", quantity: 1 }]);          // down to 1, TD-10 removed
    expect((await stock(ids.v1)).onHand).toBe(9);
    expect((await stock(ids.v2)).onHand).toBe(5);
    // Undo = the same call with old and new swapped.
    await repost(inv.id, [{ sku: "TD-8", quantity: 1 }], v2);
    await repost(inv.id, v2, [{ sku: "TD-8", quantity: 1 }]);
    expect((await stock(ids.v1)).onHand).toBe(9);
  });

  it("an edit that needs more than is available fails and changes nothing", async () => {
    const inv = await invoice([{ sku: "TD-8", quantity: 3 }]);
    await post(inv.id);
    await rejectsWithCode(repost(inv.id, [{ sku: "TD-8", quantity: 3 }], [{ sku: "TD-8", quantity: 50 }]), "INSUFFICIENT_STOCK");
    expect((await stock(ids.v1)).onHand).toBe(7);
  });

  it("cancelling gives the units back once", async () => {
    const inv = await invoice([{ sku: "TD-8", quantity: 4 }]);
    await post(inv.id);
    expect((await reverse(inv.id)).reversed).toBe(true);
    expect((await reverse(inv.id)).reversed).toBe(false);
    expect((await stock(ids.v1)).onHand).toBe(10);
    // Re-posting after a cancel is allowed (e.g. cancelled by mistake and re-issued).
    expect((await post(inv.id)).posted).toBe(true);
    expect((await stock(ids.v1)).onHand).toBe(6);
  });

  it("order, legacy and no-stock invoices never touch stock", async () => {
    for (const owner of ["order", "legacy", "none"]) {
      const inv = await invoice([{ sku: "TD-8", quantity: 4 }], owner);
      expect((await post(inv.id)).posted).toBe(false);
      expect((await reverse(inv.id)).reversed).toBe(false);
    }
    expect((await stock(ids.v1)).onHand).toBe(10);
  });
});

describe("customers see an order's invoice only once it is delivered", () => {
  beforeEach(async () => {
    t = await createTestDb({ applyNew: true });
    await seed(t);
  });

  it("hides shipped-order invoices, shows delivered ones and hand-made ones", async () => {
    const shipped = await placeOrder(ids.cust, [{ variant: ids.v1, qty: 1, price: 1000 }]);
    const delivered = await placeOrder(ids.cust, [{ variant: ids.v1, qty: 1, price: 1000 }]);
    await transition(shipped.order_id, "shipped");
    await transition(delivered.order_id, "delivered");

    const mk = (n: string, orderId: string | null) =>
      q(`INSERT INTO public.invoices (invoice_number, invoice_date, bill_to, items, totals, total_amount, user_id, order_id, stock_owner)
         VALUES ($1, current_date, '{}'::jsonb, '[]'::jsonb, '{}'::jsonb, 1, $2, $3, 'none')`, [n, ids.cust, orderId]);
    await mk("INV-SHIPPED", shipped.order_id);
    await mk("INV-DELIVERED", delivered.order_id);
    await mk("INV-MANUAL", null);

    const seen = await t.as("authenticated", ids.cust, async (tx) =>
      (await tx.query<{ invoice_number: string }>(`SELECT invoice_number FROM public.invoices ORDER BY invoice_number`)).rows.map((r) => r.invoice_number));
    expect(seen).toEqual(["INV-DELIVERED", "INV-MANUAL"]);

    const other = await t.as("authenticated", ids.other, async (tx) =>
      (await tx.query(`SELECT 1 FROM public.invoices`)).rows.length);
    expect(other).toBe(0);
  });
});

describe("backfill of existing data", () => {
  it("moves legacy reservations back on hand and flags shipped orders as already fulfilled", async () => {
    // Database as it was before this migration: the old place_order deducted stock at order time.
    t = await createTestDb({ applyNew: true, skipFrom: "20261017_" });
    await seed(t, 10, 5);
    const open = await placeOrder(ids.cust, [{ variant: ids.v1, qty: 3, price: 1000 }]);   // old: stock 10 -> 7
    const shipped = await placeOrder(ids.cust, [{ variant: ids.v1, qty: 2, price: 1000 }]); // old: 7 -> 5
    await q(`UPDATE public.orders SET status = 'shipped', dispatched_at = now() WHERE id = $1`, [shipped.order_id]);
    expect((await q(`SELECT stock_quantity AS s FROM public.product_variants WHERE id = $1`, [ids.v1]))[0].s).toBe(5);
    await q(`INSERT INTO public.invoices (invoice_number, invoice_date, bill_to, items, totals, total_amount)
             VALUES ('OLD-1', current_date, '{}'::jsonb, '[]'::jsonb, '{}'::jsonb, 1)`);

    await t.db.exec(readMigration(migrationFiles((f) => f.startsWith("20261017_"))[0]));

    // Open order's 3 units are reserved again (and back on hand); the shipped order's 2 are gone for good.
    expect(await stock(ids.v1)).toEqual({ onHand: 8, reserved: 3, available: 5 });
    const [ship] = await q(`SELECT stock_fulfilled_at FROM public.orders WHERE id = $1`, [shipped.order_id]);
    const [opn] = await q(`SELECT stock_fulfilled_at FROM public.orders WHERE id = $1`, [open.order_id]);
    expect(ship.stock_fulfilled_at).toBeTruthy();
    expect(opn.stock_fulfilled_at).toBeNull();
    expect((await q(`SELECT stock_owner FROM public.invoices WHERE invoice_number = 'OLD-1'`))[0].stock_owner).toBe("legacy");

    // The open order now ships normally, and re-running the migration changes nothing.
    await t.db.exec(readMigration(migrationFiles((f) => f.startsWith("20261017_"))[0]));
    expect(await stock(ids.v1)).toEqual({ onHand: 8, reserved: 3, available: 5 });
    await transition(open.order_id, "shipped");
    expect(await stock(ids.v1)).toEqual({ onHand: 5, reserved: 0, available: 5 });
  });
});

describe("rollback script", () => {
  it("puts stock back to 'available' and restores the old order functions", async () => {
    t = await createTestDb({ applyNew: true });
    await seed(t);
    await placeOrder(ids.cust, [{ variant: ids.v1, qty: 3, price: 1000 }]);           // on hand 10, reserved 3
    const fs = await import("node:fs");
    const path = await import("node:path");
    await t.db.exec(fs.readFileSync(path.resolve(__dirname, "../../supabase/rollbacks/20261017_rollback.sql"), "utf8"));
    await t.db.exec(readMigration("20261015_04_order_and_coupon_functions.sql"));

    const [v] = await q(`SELECT stock_quantity AS s FROM public.product_variants WHERE id = $1`, [ids.v1]);
    expect(v.s).toBe(7);                                                              // the old "available" meaning
    await expect(q(`SELECT reserved_quantity FROM public.product_variants LIMIT 1`)).rejects.toThrow(/reserved_quantity/);
    // The old function deducts at order time again.
    await placeOrder(ids.other, [{ variant: ids.v1, qty: 2, price: 1000 }]);
    expect((await q(`SELECT stock_quantity AS s FROM public.product_variants WHERE id = $1`, [ids.v1]))[0].s).toBe(5);
  });
});
