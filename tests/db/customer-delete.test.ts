/**
 * Database tests for 20261025_customer_deactivation: a customer with history must be
 * detected (so the app deactivates instead of deleting), and a raw delete of one is refused.
 */
import { beforeEach, describe, expect, it } from "vitest";
import { createTestDb, type Row, type TestDb } from "./test-db";

const cust = "00000000-0000-4000-8000-0000000000cc";
let t: TestDb;
const q = async (sql: string, params: unknown[] = []) => (await t.db.query<Row>(sql, params)).rows;
const hasHistory = async (id: string) =>
  (await t.service<{ h: boolean }>(`SELECT public.customer_has_history($1) AS h`, [id])).h;

beforeEach(async () => {
  t = await createTestDb({ applyNew: true });
  await t.db.query(`INSERT INTO auth.users (id, email) VALUES ($1, 'c@test.in')`, [cust]);
  await t.db.query(`INSERT INTO public.profiles (id, email) VALUES ($1, 'c@test.in') ON CONFLICT (id) DO NOTHING`, [cust]);
});

describe("customer_has_history", () => {
  it("is false for a fresh signup, which can be deleted with its login", async () => {
    expect(await hasHistory(cust)).toBe(false);
    await q(`DELETE FROM auth.users WHERE id = $1`, [cust]);
    expect(await q(`SELECT 1 FROM public.profiles WHERE id = $1`, [cust])).toHaveLength(0);
  });

  it("is true once the customer has an order, and a raw delete is refused", async () => {
    await q(
      `INSERT INTO public.orders (user_id, order_number, total_amount, shipping_address, items)
       VALUES ($1, 'ORD-1', 100, 'x', '[]'::jsonb)`,
      [cust]
    );
    expect(await hasHistory(cust)).toBe(true);
    await expect(q(`DELETE FROM auth.users WHERE id = $1`, [cust])).rejects.toThrow();
  });

  it("is true for a customer who only has a quote (that FK is SET NULL, so the check must catch it)", async () => {
    await q(`INSERT INTO public.quotes (user_id, quote_number, valid_until, company_name) VALUES ($1, 'Q-1', current_date + 30, 'Acme')`, [cust]);
    expect(await hasHistory(cust)).toBe(true);
  });

  it("adds deactivated_at to profiles", async () => {
    await q(`UPDATE public.profiles SET deactivated_at = now() WHERE id = $1`, [cust]);
    expect((await q(`SELECT deactivated_at FROM public.profiles WHERE id = $1`, [cust]))[0].deactivated_at).not.toBeNull();
  });
});
