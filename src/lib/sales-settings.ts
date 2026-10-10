import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type { SalesSettings } from "@/types/database.types";

/**
 * The single sales_settings row. Plain server module (not a Server Action) so
 * it is never exposed as a public endpoint; callers are admin-gated actions or
 * the invoice PDF route.
 */
export async function loadSalesSettings(): Promise<SalesSettings | null> {
  const { data, error } = await (createAdminClient().from("sales_settings") as any)
    .select("*")
    .eq("id", true)
    .maybeSingle();
  if (error) {
    console.error("[loadSalesSettings] Query error:", error);
    return null;
  }
  return (data as SalesSettings | null) ?? null;
}
