import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Stops customers guessing coupon codes: after MAX_FAILURES unknown codes in
 * WINDOW_MINUTES, Apply is refused until the window has passed.
 *
 * Only unknown / invalid codes count. A real code that fails a rule (minimum
 * order not met, expired) is not a guess and must not lock the customer out.
 */
export const MAX_FAILURES = 10;
export const WINDOW_MINUTES = 15;

const windowStart = () => new Date(Date.now() - WINDOW_MINUTES * 60_000).toISOString();

export async function isCouponEntryLocked(userId: string): Promise<boolean> {
  const { count, error } = await createAdminClient()
    .from("coupon_attempts" as never)
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("created_at", windowStart());

  if (error) {
    // Fail open: a broken counter must not block every checkout.
    console.warn("[coupon rate limit] count failed:", error.message);
    return false;
  }
  return (count ?? 0) >= MAX_FAILURES;
}

export async function recordFailedCouponAttempt(userId: string, code: string): Promise<void> {
  const adminDb = createAdminClient();
  const { error } = await adminDb
    .from("coupon_attempts" as never)
    .insert({ user_id: userId, code: code.slice(0, 64) } as never);
  if (error) console.warn("[coupon rate limit] insert failed:", error.message);

  // Keep the table small: this customer's attempts older than a day are useless.
  await adminDb
    .from("coupon_attempts" as never)
    .delete()
    .eq("user_id", userId)
    .lt("created_at", new Date(Date.now() - 24 * 60 * 60_000).toISOString());
}
