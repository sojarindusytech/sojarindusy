/**
 * 20261027_order_admin_notes: internal order notes are reachable by the service role only.
 */
import { beforeEach, describe, expect, it } from "vitest";
import { createTestDb, type TestDb } from "./test-db";

let t: TestDb;

beforeEach(async () => {
  t = await createTestDb({ applyNew: true });
});

describe("order_admin_notes", () => {
  it("gives customers (authenticated / anon) no access at all", async () => {
    const rows = await t.db.query<{ grantee: string; privilege_type: string }>(
      `SELECT grantee, privilege_type FROM information_schema.role_table_grants
        WHERE table_schema = 'public' AND table_name = 'order_admin_notes'`
    );
    const grantees = new Set(rows.rows.map((r) => r.grantee));
    expect(grantees.has("authenticated")).toBe(false);
    expect(grantees.has("anon")).toBe(false);
    expect(grantees.has("service_role")).toBe(true);
  });

  it("has row level security on with no policies", async () => {
    const rls = await t.db.query<{ relrowsecurity: boolean }>(
      `SELECT relrowsecurity FROM pg_class WHERE oid = 'public.order_admin_notes'::regclass`
    );
    expect(rls.rows[0].relrowsecurity).toBe(true);
    const policies = await t.db.query(`SELECT 1 FROM pg_policies WHERE tablename = 'order_admin_notes'`);
    expect(policies.rows).toHaveLength(0);
  });
});
