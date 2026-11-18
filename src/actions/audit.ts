"use server";

import { requireAdmin } from "@/lib/auth-guard";
import { createAdminClient } from "@/lib/supabase/admin";
import { selectAll } from "@/lib/server/select-all";
import { resolveRange, type LedgerRange } from "@/lib/server/ledger";
import type { AuditChanges } from "@/lib/audit";

export interface AuditLogRow {
  id: string;
  created_at: string;
  actor_id: string | null;
  actor_email: string | null;
  actor_role: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  summary: string;
  changes: AuditChanges | null;
  metadata: Record<string, unknown> | null;
  ip_address: string | null;
  user_agent: string | null;
  outcome: "success" | "failure";
}

const isMissingTable = (e: { code?: string }) => e.code === "PGRST205" || e.code === "42P01";

/** Audit entries in a date range (India time), newest first. */
export async function listAuditLogs(range?: Partial<LedgerRange>): Promise<{ range: LedgerRange; rows: AuditLogRow[]; error: string | null }> {
  await requireAdmin();
  const r = resolveRange(range);
  try {
    const db = createAdminClient();
    // ponytail: whole range in memory (selectAll caps at 100k rows); move filters to the query if a range gets that big.
    const rows = await selectAll<AuditLogRow>((from, to) =>
      db.from("audit_logs" as never).select("*")
        .gte("created_at", `${r.from}T00:00:00+05:30`)
        .lte("created_at", `${r.to}T23:59:59.999+05:30`)
        .order("created_at", { ascending: false })
        .order("id")
        .range(from, to)
    );
    return { range: r, rows, error: null };
  } catch (err) {
    const e = err as { code?: string; message?: string };
    console.error("[listAuditLogs]", e.code, e.message);
    return {
      range: r,
      rows: [],
      error: isMissingTable(e)
        ? "The audit log table is missing. Apply supabase/migrations/20261028_audit_logs.sql, then reload."
        : "The audit log could not be loaded. Please reload the page.",
    };
  }
}
