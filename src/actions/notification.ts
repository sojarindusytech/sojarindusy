"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUserProfile } from "@/actions/auth";
import { AppNotification, NotificationType, UserRole } from "@/types/database.types";
import { revalidatePath } from "next/cache";

/**
 * Fetch all relevant notifications for the current authenticated user.
 * Supports role-based broadcasting (admin, manufacturer, customer) and direct user targeting.
 */
export async function getUserNotifications(limit: number = 40): Promise<{
  data: AppNotification[];
  unreadCount: number;
  error?: string | null;
}> {
  try {
    const { user, profile } = await getCurrentUserProfile();
    if (!user) {
      return { data: [], unreadCount: 0, error: null };
    }

    const supabase = await createClient();
    const role = profile?.role || "customer";

    let query = (supabase
      .from("notifications") as any)
      .select("*")
      .order("created_at", { ascending: false })
      .limit(limit);

    // Apply role-based visibility filter
    if (role === "admin" || role === "platform_owner") {
      query = query.or(
        `user_id.eq.${user.id},role.eq.admin,role.eq.platform_owner`
      );
    } else if (role === "manufacturer") {
      query = query.or(`user_id.eq.${user.id},role.eq.manufacturer`);
    } else {
      // Customer
      query = query.or(`user_id.eq.${user.id},role.eq.customer`);
    }

    const { data, error } = await query;

    if (error) {
      console.error("Error fetching notifications:", error);
      return { data: [], unreadCount: 0, error: error.message };
    }

    const notifications = (data || []) as AppNotification[];
    const unreadCount = notifications.filter((n) => !n.is_read).length;

    return { data: notifications, unreadCount, error: null };
  } catch (err: any) {
    console.error("getUserNotifications exception:", err);
    return { data: [], unreadCount: 0, error: err.message };
  }
}

/**
 * Mark a single notification as read.
 */
export async function markNotificationAsRead(id: string): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient();
    const { error } = await (supabase
      .from("notifications") as any)
      .update({ is_read: true, updated_at: new Date().toISOString() })
      .eq("id", id);

    if (error) {
      return { success: false, error: error.message };
    }

    revalidatePath("/admin");
    revalidatePath("/dashboard");
    revalidatePath("/manufacturer");
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

/**
 * Mark all notifications as read for current user.
 */
export async function markAllNotificationsAsRead(): Promise<{ success: boolean; error?: string }> {
  try {
    const { user, profile } = await getCurrentUserProfile();
    if (!user) return { success: false, error: "Not authenticated" };

    const supabase = await createClient();
    const role = profile?.role || "customer";

    let query = (supabase
      .from("notifications") as any)
      .update({ is_read: true, updated_at: new Date().toISOString() })
      .eq("is_read", false);

    if (role === "admin" || role === "platform_owner") {
      query = query.or(`user_id.eq.${user.id},role.eq.admin,role.eq.platform_owner`);
    } else if (role === "manufacturer") {
      query = query.or(`user_id.eq.${user.id},role.eq.manufacturer`);
    } else {
      query = query.or(`user_id.eq.${user.id},role.eq.customer`);
    }

    const { error } = await query;
    if (error) return { success: false, error: error.message };

    revalidatePath("/admin");
    revalidatePath("/dashboard");
    revalidatePath("/manufacturer");
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

/**
 * Internal/Service action to create a notification.
 * Uses service role to reliably insert notifications across processes.
 */
export async function createNotification(params: {
  userId?: string | null;
  role?: UserRole | null;
  title: string;
  message: string;
  type: NotificationType;
  link?: string | null;
  metadata?: Record<string, any>;
}): Promise<{ success: boolean; id?: string; error?: string }> {
  try {
    const adminSupabase = createAdminClient();

    const { data, error } = await (adminSupabase
      .from("notifications") as any)
      .insert({
        user_id: params.userId || null,
        role: params.role || null,
        title: params.title,
        message: params.message,
        type: params.type,
        link: params.link || null,
        metadata: params.metadata || {},
        is_read: false,
      })
      .select("id")
      .single();

    if (error) {
      console.error("Failed to create notification:", error);
      return { success: false, error: error.message };
    }

    return { success: true, id: (data as any)?.id };
  } catch (err: any) {
    console.error("createNotification error:", err);
    return { success: false, error: err.message };
  }
}

/**
 * Delete a notification.
 */
export async function deleteNotification(id: string): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient();
    const { error } = await (supabase.from("notifications") as any).delete().eq("id", id);
    if (error) return { success: false, error: error.message };

    revalidatePath("/admin");
    revalidatePath("/dashboard");
    revalidatePath("/manufacturer");
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}
