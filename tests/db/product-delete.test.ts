/**
 * Database tests for 20261024_product_delete_safety: deleting a product archives it when it has
 * history and really deletes it when it has none. Real Postgres (PGlite).
 */
import { beforeEach, describe, expect, it } from "vitest";
import { createTestDb, rejectsWithCode, type Row, type TestDb } from "./test-db";

const cust = "00000000-0000-4000-8000-0000000000cc";
let t: TestDb;
const q = async (sql: string, params: unknown[] = []) => (await t.db.query<Row>(sql, params)).rows;
const remove = async (id: string) => (await t.service<{ r: string }>(`SELECT public.remove_product($1) AS r`, [id])).r;

/** A product with two SKUs and the opening-stock ledger rows every real product has. */
async function makeProduct(slug: string) {
  const p = (await q(`INSERT INTO public.products (title, slug) VALUES ($1, $1) RETURNING id`, [slug]))[0].id as string;
  const variants: { id: string; sku: string }[] = [];
  for (const n of [1, 2]) {
    const sku = `${slug}-${n}`.toUpperCase();
    const v = (await q(`INSERT INTO public.product_variants (product_id, sku, stock_quantity) VALUES ($1, $2, 10) RETURNING id`, [p, sku]))[0];
    variants.push({ id: v.id as string, sku });
    await q(
      `INSERT INTO public.inventory_logs (variant_id, product_id, sku_code, product_title, movement_type, quantity_delta, balance_before, balance_after)
       VALUES ($1, $2, $3, $4, 'INITIAL_IMPORT', 10, 0, 10)`,
      [v.id, p, sku, slug]
    );
  }
  return { id: p, variants };
}

beforeEach(async () => {
  t = await createTestDb({ applyNew: true });
  await t.db.query(`INSERT INTO auth.users (id, email) VALUES ($1, 'c@test.in')`, [cust]);
  await t.db.query(`INSERT INTO public.profiles (id, email) VALUES ($1, 'c@test.in') ON CONFLICT (id) DO NOTHING`, [cust]);
});

describe("remove_product", () => {
  it("really deletes a product that only has its opening stock", async () => {
    const p = await makeProduct("clean");
    expect(await remove(p.id)).toBe("deleted");
    expect(await q(`SELECT 1 FROM public.products WHERE id = $1`, [p.id])).toHaveLength(0);
    expect(await q(`SELECT 1 FROM public.product_variants WHERE product_id = $1`, [p.id])).toHaveLength(0);
  });

  it("archives a product that was ordered, keeping the product and SKU rows", async () => {
    const p = await makeProduct("ordered");
    await q(
      `INSERT INTO public.orders (user_id, order_number, total_amount, shipping_address, items)
       VALUES ($1, 'ORD-1', 100, 'x', $2::jsonb)`,
      [cust, JSON.stringify([{ sku: p.variants[0].sku, name: "Ordered", quantity: 1 }])]
    );
    expect(await remove(p.id)).toBe("archived");

    const prod = (await q(`SELECT is_active, archived_at FROM public.products WHERE id = $1`, [p.id]))[0];
    expect(prod.is_active).toBe(false);
    expect(prod.archived_at).not.toBeNull();
    const vs = await q(`SELECT is_archived FROM public.product_variants WHERE product_id = $1`, [p.id]);
    expect(vs).toHaveLength(2);
    expect(vs.every((v) => v.is_archived === true)).toBe(true);
    // one ARCHIVED row per SKU, stock unchanged
    const logs = await q(`SELECT quantity_delta, balance_after FROM public.inventory_logs WHERE product_id = $1 AND movement_type = 'ARCHIVED'`, [p.id]);
    expect(logs).toHaveLength(2);
    expect(logs.every((l) => l.quantity_delta === 0 && l.balance_after === 10)).toBe(true);
    // the order is untouched
    expect((await q(`SELECT items FROM public.orders WHERE order_number = 'ORD-1'`))[0].items).toHaveLength(1);
  });

  it("matches an order by product_id too, not only by SKU", async () => {
    const p = await makeProduct("byid");
    await q(
      `INSERT INTO public.orders (user_id, order_number, total_amount, shipping_address, items)
       VALUES ($1, 'ORD-2', 1, 'x', $2::jsonb)`,
      [cust, JSON.stringify([{ product_id: p.id, sku: "RENAMED-SKU" }])]
    );
    expect(await remove(p.id)).toBe("archived");
  });

  it("archives a product with real stock movements (e.g. a manual adjustment)", async () => {
    const p = await makeProduct("moved");
    await q(
      `INSERT INTO public.inventory_logs (variant_id, product_id, sku_code, product_title, movement_type, quantity_delta, balance_before, balance_after)
       VALUES ($1, $2, 'X', 'moved', 'MANUAL_ADJUSTMENT', -1, 10, 9)`,
      [p.variants[0].id, p.id]
    );
    expect(await remove(p.id)).toBe("archived");
  });

  it("archives a product with a purchase order, and the PO survives", async () => {
    const p = await makeProduct("po");
    await q(
      `INSERT INTO public.purchase_orders (order_number, variant_id, product_id, sku_code, product_title, status)
       VALUES ('PO-1', $1, $2, $3, 'po', 'Received')`,
      [p.variants[0].id, p.id, p.variants[0].sku]
    );
    expect(await remove(p.id)).toBe("archived");
    expect(await q(`SELECT 1 FROM public.purchase_orders WHERE order_number = 'PO-1'`)).toHaveLength(1);
  });

  it("a raw delete of a product with purchase orders is blocked (RESTRICT, no more CASCADE)", async () => {
    const p = await makeProduct("rawpo");
    await q(
      `INSERT INTO public.purchase_orders (order_number, variant_id, product_id, sku_code, product_title)
       VALUES ('PO-2', $1, $2, $3, 'rawpo')`,
      [p.variants[0].id, p.id, p.variants[0].sku]
    );
    await expect(q(`DELETE FROM public.products WHERE id = $1`, [p.id])).rejects.toThrow(/purchase_orders/);
  });

  it("rejects an unknown product", async () => {
    await rejectsWithCode(
      t.service(`SELECT public.remove_product('00000000-0000-4000-8000-000000000999')`),
      "PRODUCT_NOT_FOUND"
    );
  });

  it("clears the category links of a really deleted product", async () => {
    const p = await makeProduct("cat");
    const c = (await q(`INSERT INTO public.categories (name, slug) VALUES ('C', 'c-cat') RETURNING id`))[0].id;
    await q(`INSERT INTO public.product_categories (product_id, category_id) VALUES ($1, $2)`, [p.id, c]);
    expect(await remove(p.id)).toBe("deleted");
    expect(await q(`SELECT 1 FROM public.product_categories WHERE product_id = $1`, [p.id])).toHaveLength(0);
  });
});

describe("restore_product", () => {
  it("brings back the product and only the SKUs that archive hid", async () => {
    const p = await makeProduct("restore");
    // SKU 2 was archived on its own, earlier
    await q(`UPDATE public.product_variants SET is_archived = true, archived_at = now() - interval '5 days' WHERE id = $1`, [p.variants[1].id]);
    await q(
      `INSERT INTO public.orders (user_id, order_number, total_amount, shipping_address, items)
       VALUES ($1, 'ORD-3', 1, 'x', $2::jsonb)`,
      [cust, JSON.stringify([{ sku: p.variants[0].sku }])]
    );
    expect(await remove(p.id)).toBe("archived");

    await t.service(`SELECT public.restore_product($1)`, [p.id]);

    const prod = (await q(`SELECT is_active, archived_at FROM public.products WHERE id = $1`, [p.id]))[0];
    expect(prod.is_active).toBe(true);
    expect(prod.archived_at).toBeNull();
    const state = Object.fromEntries((await q(`SELECT id, is_archived FROM public.product_variants WHERE product_id = $1`, [p.id])).map((v) => [v.id, v.is_archived]));
    expect(state[p.variants[0].id]).toBe(false);
    expect(state[p.variants[1].id]).toBe(true); // stays archived
    expect(await q(`SELECT 1 FROM public.inventory_logs WHERE product_id = $1 AND movement_type = 'RESTORED'`, [p.id])).toHaveLength(1);
  });

  it("a restored product that is archived again is still not deletable by accident", async () => {
    const p = await makeProduct("again");
    await q(
      `INSERT INTO public.orders (user_id, order_number, total_amount, shipping_address, items)
       VALUES ($1, 'ORD-4', 1, 'x', $2::jsonb)`,
      [cust, JSON.stringify([{ sku: p.variants[0].sku }])]
    );
    expect(await remove(p.id)).toBe("archived");
    await t.service(`SELECT public.restore_product($1)`, [p.id]);
    expect(await remove(p.id)).toBe("archived");
  });
});

describe("permissions", () => {
  it("the API roles cannot call the product functions", async () => {
    const p = await makeProduct("perm");
    await expect(
      t.as("authenticated", cust, (tx) => tx.query(`SELECT public.remove_product($1)`, [p.id]))
    ).rejects.toThrow(/permission denied/);
  });
});
