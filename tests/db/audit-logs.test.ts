/**
 * 20261028_audit_logs: entries can be added and read, never changed or removed, and customers
 * have no access.
 */
import { beforeEach, describe, expect, it } from "vitest";
import { createTestDb, type Row, type TestDb } from "./test-db";

let t: TestDb;
const q = async (sql: string, params: unknown[] = []) => (await t.db.query<Row>(sql, params)).rows;

beforeEach(async () => {
  t = await createTestDb({ applyNew: true });
});

describe("audit_logs", () => {
  it("accepts new entries", async () => {
    const r = await q(
      `INSERT INTO public.audit_logs (action, entity_type, summary) VALUES ('invoice.cancel', 'invoice', 'Cancelled') RETURNING outcome`
    );
    expect(r[0].outcome).toBe("success");
  });

  it("refuses to change, delete or truncate entries", async () => {
    await q(`INSERT INTO public.audit_logs (action, entity_type, summary) VALUES ('x', 'y', 'z')`);
    await expect(q(`UPDATE public.audit_logs SET summary = 'edited'`)).rejects.toThrow(/AUDIT_LOG_IMMUTABLE/);
    await expect(q(`DELETE FROM public.audit_logs`)).rejects.toThrow(/AUDIT_LOG_IMMUTABLE/);
    await expect(q(`TRUNCATE public.audit_logs`)).rejects.toThrow(/AUDIT_LOG_IMMUTABLE/);
    expect(await q(`SELECT summary FROM public.audit_logs`)).toEqual([{ summary: "z" }]);
  });

  it("gives customers no access and the server only read + add", async () => {
    const rows = (
      await t.db.query<{ grantee: string; privilege_type: string }>(
        `SELECT grantee, privilege_type FROM information_schema.role_table_grants
          WHERE table_schema = 'public' AND table_name = 'audit_logs'`
      )
    ).rows;
    expect(rows.some((r) => r.grantee === "authenticated" || r.grantee === "anon")).toBe(false);
    const service = rows.filter((r) => r.grantee === "service_role").map((r) => r.privilege_type).sort();
    expect(service).toEqual(["INSERT", "SELECT"]);
  });
});
