/**
 * In-process Postgres for database tests.
 *
 * Boots PGlite (real Postgres compiled to WASM), loads a minimal Supabase
 * stand-in, then applies the repo's migrations in filename order. Legacy
 * migrations that need Supabase-only features (pgcrypto, auth internals) are
 * skipped; they do not touch the tables under test.
 */
import { PGlite, type Transaction } from "@electric-sql/pglite";
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(__dirname, "../..");
const MIGRATIONS = path.join(ROOT, "supabase", "migrations");

export type Row = Record<string, unknown>;
export type ApiRole = "anon" | "authenticated" | "service_role";

export interface TestDb {
  db: PGlite;
  /** Run `fn` in a transaction as an API role, optionally as a signed-in user. */
  as<T>(role: ApiRole, userId: string | null, fn: (tx: Transaction) => Promise<T>): Promise<T>;
  /** First row of a query run as service_role (how the app's server calls the DB). */
  service<T extends Row = Row>(sql: string, params?: unknown[]): Promise<T>;
  /** First row of a query run as the superuser (test setup / inspection). */
  one<T extends Row = Row>(sql: string, params?: unknown[]): Promise<T>;
  applied: string[];
  skipped: string[];
}

export function migrationFiles(filter: (name: string) => boolean): string[] {
  return fs.readdirSync(MIGRATIONS).filter((f) => f.endsWith(".sql") && filter(f)).sort();
}

export function readMigration(name: string): string {
  return fs.readFileSync(path.join(MIGRATIONS, name), "utf8");
}

export async function createTestDb(options: { applyNew: boolean; skipFrom?: string }): Promise<TestDb> {
  const db = new PGlite();
  await db.exec(fs.readFileSync(path.join(__dirname, "supabase-baseline.sql"), "utf8"));

  const applied: string[] = [];
  const skipped: string[] = [];
  const isNew = (f: string) =>
    ["20261015_", "20261017_", "20261018_", "20261019_", "20261020_", "20261021_", "20261022_", "20261023_", "20261024_"].some((p) => f.startsWith(p));

  for (const file of migrationFiles((f) => (!isNew(f) || options.applyNew) && (!options.skipFrom || f < options.skipFrom))) {
    try {
      await db.exec(readMigration(file));
      applied.push(file);
    } catch (err) {
      await db.exec("ROLLBACK").catch(() => undefined);
      if (isNew(file)) throw err; // our migrations must always apply
      skipped.push(file);
    }
  }

  const as: TestDb["as"] = (role, userId, fn) =>
    db.transaction(async (tx) => {
      await tx.exec(`SET LOCAL ROLE ${role}`);
      if (userId) {
        await tx.query(`SELECT set_config('request.jwt.claim.sub', $1, true)`, [userId]);
      }
      return fn(tx);
    });

  return {
    db,
    as,
    service: async <T extends Row>(sql: string, params: unknown[] = []) =>
      as("service_role", null, async (tx) => (await tx.query<T>(sql, params)).rows[0]),
    one: async <T extends Row>(sql: string, params: unknown[] = []) =>
      (await db.query<T>(sql, params)).rows[0],
    applied,
    skipped,
  };
}

/** Asserts that `promise` rejects with an app error whose message is `code`. */
export async function rejectsWithCode(
  promise: Promise<unknown>,
  code: string
): Promise<{ message: string; detail?: string }> {
  try {
    await promise;
  } catch (err) {
    const e = err as { message: string; detail?: string };
    if (e.message !== code) {
      throw new Error(`expected ${code}, got "${e.message}"`);
    }
    return e;
  }
  throw new Error(`expected error ${code}, but the call succeeded`);
}
