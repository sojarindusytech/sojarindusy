/**
 * Database tests for 20261022_auth_hardening: one profile per email, profile follows its login.
 * Real Postgres (PGlite).
 */
import { beforeEach, describe, expect, it } from "vitest";
import { createTestDb, type Row, type TestDb } from "./test-db";

const a = "00000000-0000-4000-8000-0000000000a1";
const b = "00000000-0000-4000-8000-0000000000a2";
let t: TestDb;
const q = async (sql: string, params: unknown[] = []) => (await t.db.query<Row>(sql, params)).rows;

const addUser = async (id: string, email: string) => {
  await t.db.query(`INSERT INTO auth.users (id, email) VALUES ($1, $2)`, [id, email]);
  await t.db.query(
    `INSERT INTO public.profiles (id, email, role, approval_status, company_name)
     VALUES ($1, $2, 'customer', 'pending', 'Co')
     ON CONFLICT (id) DO UPDATE SET email = $2`, [id, email]);
};

beforeEach(async () => {
  t = await createTestDb({ applyNew: true });
});

describe("profiles.email", () => {
  it("is unique regardless of case", async () => {
    await addUser(a, "Buyer@Acme.in");
    await t.db.query(`INSERT INTO auth.users (id, email) VALUES ($1, 'other@acme.in')`, [b]);
    await expect(
      t.db.query(
        `INSERT INTO public.profiles (id, email, role, approval_status, company_name)
         VALUES ($1, 'buyer@acme.in', 'customer', 'pending', 'Co2')
         ON CONFLICT (id) DO UPDATE SET email = 'buyer@acme.in'`, [b])
    ).rejects.toThrow(/profiles_email_lower_key|duplicate key/);
  });
});

describe("profiles_id_fkey", () => {
  it("removes the profile with its auth user when it has no history", async () => {
    await addUser(a, "x@acme.in");
    await t.db.query(`DELETE FROM auth.users WHERE id = $1`, [a]);
    expect(await q(`SELECT id FROM public.profiles WHERE id = $1`, [a])).toHaveLength(0);
  });
});
