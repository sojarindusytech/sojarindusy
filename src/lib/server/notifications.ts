import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type { NotificationType, UserRole } from "@/types/database.types";

export interface NewNotification {
  /** Send to one user ... */
  userId?: string | null;
  /** ... or broadcast to everyone with this role. */
  role?: UserRole | null;
  title: string;
  message: string;
  type: NotificationType;
  link?: string | null;
  metadata?: Record<string, unknown>;
}

/**
 * Inserts an in-app notification.
 *
 * Server-only on purpose: it was previously an exported Server Action, which
 * made it a public endpoint anyone could call to message any user or role.
 */
export async function createNotification(
  params: NewNotification
): Promise<{ success: boolean; id?: string; error?: string }> {
  try {
    const { data, error } = await createAdminClient()
      .from("notifications" as never)
      .insert({
        user_id: params.userId || null,
        role: params.role || null,
        title: params.title,
        message: params.message,
        type: params.type,
        link: params.link || null,
        metadata: params.metadata || {},
        is_read: false,
      } as never)
      .select("id")
      .single();

    if (error) {
      console.error("Failed to create notification:", error.message);
      return { success: false, error: error.message };
    }
    return { success: true, id: (data as { id: string } | null)?.id };
  } catch (err) {
    console.error("createNotification error:", err);
    return { success: false, error: err instanceof Error ? err.message : "Unknown error" };
  }
}

/**
 * Sends several notifications without letting a failure affect the caller:
 * notifications are a side effect of work that has already been committed.
 */
export async function notifyAll(notifications: NewNotification[]): Promise<void> {
  await Promise.all(
    notifications.map((n) =>
      createNotification(n).catch((err) => console.warn("[notifyAll] skipped:", err))
    )
  );
}
