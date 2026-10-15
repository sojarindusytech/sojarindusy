/**
 * Database tests for 20261021_po_manufacturer: the manufacturer that receives purchase orders.
 * Real Postgres (PGlite).
 */
import { beforeEach, describe, expect, it } from "vitest";
import { createTestDb, type Row, type TestDb } from "./test-db";

const mfr = "00000000-0000-4000-8000-0000000000aa";
let t: TestDb;
const q = async (sql: string, params: unknown[] = []) => (await t.db.query<Row>(sql, params)).rows;

beforeEach(async () => {
  t = await createTestDb({ applyNew: true });
  await t.db.query(`INSERT INTO auth.users (id, email) VALUES ($1, 'm@test.in')`, [mfr]);
  await t.db.query(
    `INSERT INTO public.profiles (id, email, role, approval_status, company_name)
     VALUES ($1, 'm@test.in', 'manufacturer', 'approved', 'Acme Tools')
     ON CONFLICT (id) DO UPDATE SET role = 'manufacturer', approval_status = 'approved'`, [mfr]);
});

describe("sales_settings.po_manufacturer_id", () => {
  it("defaults to none, stores a manufacturer, and clears when that account is deleted", async () => {
    expect((await q(`SELECT po_manufacturer_id FROM public.sales_settings`))[0].po_manufacturer_id).toBeNull();

    await t.db.query(`UPDATE public.sales_settings SET po_manufacturer_id = $1`, [mfr]);
    expect((await q(`SELECT po_manufacturer_id FROM public.sales_settings`))[0].po_manufacturer_id).toBe(mfr);

    await t.db.query(`DELETE FROM public.profiles WHERE id = $1`, [mfr]);
    expect((await q(`SELECT po_manufacturer_id FROM public.sales_settings`))[0].po_manufacturer_id).toBeNull();
  });
});
