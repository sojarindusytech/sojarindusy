/**
 * Database tests for 20261026_contact_hardening: no direct public inserts, consent is not
 * assumed, and sizes are limited in the database.
 */
import { beforeEach, describe, expect, it } from "vitest";
import { createTestDb, type Row, type TestDb } from "./test-db";

let t: TestDb;
const q = async (sql: string, params: unknown[] = []) => (await t.db.query<Row>(sql, params)).rows;

beforeEach(async () => {
  t = await createTestDb({ applyNew: true });
});

describe("contact_submissions hardening", () => {
  it("has no public insert policy left", async () => {
    const policies = await q(
      `SELECT policyname FROM pg_policies WHERE tablename = 'contact_submissions' AND cmd = 'INSERT'`
    );
    expect(policies).toHaveLength(0);
  });

  it("does not assume privacy consent", async () => {
    const r = await q(
      `INSERT INTO public.contact_submissions (full_name, email, message) VALUES ('A B', 'a@b.in', 'hello there') RETURNING privacy_accepted`
    );
    expect(r[0].privacy_accepted).toBe(false);
  });

  it("refuses oversized messages", async () => {
    await expect(
      q(`INSERT INTO public.contact_submissions (full_name, email, message) VALUES ('A B', 'a@b.in', repeat('x', 2001))`)
    ).rejects.toThrow(/contact_submissions_lengths/);
  });
});
