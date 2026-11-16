import "server-only";
import { headers } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAuthContext } from "@/lib/auth-guard";
import type { AuditChanges } from "@/lib/audit";

export interface AuditActor {
  userId: string;
  email?: string | null;
  role?: string | null;
}

export interface AuditEntry {
  /** e.g. "invoice.cancel", "customer.approve", "auth.sign_in". */
  action: string;
  /** Key of AUDIT_ENTITY_LABELS, e.g. "invoice". */
  entity: string;
  entityId?: string | null;
  /** One readable line: "Cancelled invoice SI/INV/25-26/04: wrong customer". */
  summary: string;
  changes?: AuditChanges | null;
  metadata?: Record<string, unknown> | null;
  outcome?: "success" | "failure";
  /** Who did it. Omit to use the signed-in user; pass null for anonymous (e.g. a failed sign-in). */
  actor?: AuditActor | null;
}

const clip = (v: string | null | undefined, n: number) => (v ? v.slice(0, n) : null);

/**
 * Appends one entry to the audit trail. Never throws: a logging problem must not undo or fail
 * the change it describes (it is reported in the server log instead).
 */
export async function recordAudit(entry: AuditEntry): Promise<void> {
  try {
    let actor = entry.actor;
    if (actor === undefined) {
      const ctx = await getAuthContext().catch(() => null);
      actor = ctx ? { userId: ctx.userId, email: ctx.email, role: ctx.role } : null;
    }

    let ip: string | null = null;
    let userAgent: string | null = null;
    try {
      const h = await headers();
      ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || null;
      userAgent = h.get("user-agent");
    } catch {
      // Outside a request (tests, scripts): no network details.
    }

    const { error } = await createAdminClient()
      .from("audit_logs" as never)
      .insert({
        actor_id: actor?.userId ?? null,
        actor_email: clip(actor?.email, 254),
        actor_role: clip(actor?.role, 40),
        action: entry.action.slice(0, 80),
        entity_type: entry.entity.slice(0, 60),
        entity_id: clip(entry.entityId, 200),
        summary: entry.summary.slice(0, 500),
        changes: entry.changes ?? null,
        metadata: entry.metadata ?? null,
        ip_address: clip(ip, 64),
        user_agent: clip(userAgent, 300),
        outcome: entry.outcome ?? "success",
      } as never);
    if (error) console.warn("[recordAudit] not recorded:", entry.action, error.message);
  } catch (err) {
    console.warn("[recordAudit] not recorded:", entry.action, err);
  }
}
