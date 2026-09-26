"use client";

import { useState, useEffect, useRef, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Bell,
  CheckCheck,
  Package,
  Truck,
  UserCheck,
  FileText,
  AlertTriangle,
  Clock,
  ExternalLink,
  Loader2,
  CheckCircle2,
} from "lucide-react";
import {
  getUserNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
} from "@/actions/notification";
import { AppNotification, NotificationType } from "@/types/database.types";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

interface NotificationBellProps {
  className?: string;
  align?: "left" | "right";
}

function getNotificationIcon(type: NotificationType) {
  switch (type) {
    case "order":
      return <Package className="h-4 w-4 text-blue-600" />;
    case "purchase_order":
      return <Truck className="h-4 w-4 text-amber-600" />;
    case "inventory":
      return <CheckCircle2 className="h-4 w-4 text-emerald-600" />;
    case "account":
      return <UserCheck className="h-4 w-4 text-indigo-600" />;
    case "rfq":
      return <FileText className="h-4 w-4 text-purple-600" />;
    default:
      return <Bell className="h-4 w-4 text-slate-600" />;
  }
}

function getIconBg(type: NotificationType) {
  switch (type) {
    case "order":
      return "bg-blue-50 border-blue-100";
    case "purchase_order":
      return "bg-amber-50 border-amber-100";
    case "inventory":
      return "bg-emerald-50 border-emerald-100";
    case "account":
      return "bg-indigo-50 border-indigo-100";
    case "rfq":
      return "bg-purple-50 border-purple-100";
    default:
      return "bg-slate-50 border-slate-200";
  }
}

function formatTimeAgo(isoDate: string): string {
  try {
    const diffSeconds = Math.floor((Date.now() - new Date(isoDate).getTime()) / 1000);
    if (diffSeconds < 60) return "Just now";
    const diffMinutes = Math.floor(diffSeconds / 60);
    if (diffMinutes < 60) return `${diffMinutes}m ago`;
    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7) return `${diffDays}d ago`;
    return new Date(isoDate).toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
    });
  } catch {
    return "";
  }
}

export function NotificationBell({
  className,
  align = "right",
}: NotificationBellProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"all" | "unread">("all");
  const [isPending, startTransition] = useTransition();

  const router = useRouter();
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Fetch notifications
  const loadNotifications = async () => {
    try {
      const res = await getUserNotifications();
      if (!res.error && res.data) {
        setNotifications(res.data);
        setUnreadCount(res.unreadCount);
      }
    } catch (err) {
      console.error("Failed to load notifications:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadNotifications();

    // Setup Supabase Realtime subscription for instant alerts
    const supabase = createClient();
    const channel = supabase
      .channel("app_notifications_feed")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "notifications",
        },
        () => {
          loadNotifications();
        }
      )
      .subscribe();

    // Auto-polling fallback every 30s
    const interval = setInterval(loadNotifications, 30000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(interval);
    };
  }, []);

  // Handle click outside to close dropdown
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    } else {
      document.removeEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  const handleMarkAsRead = async (n: AppNotification) => {
    if (!n.is_read) {
      // Optimistic update
      setNotifications((prev) =>
        prev.map((item) => (item.id === n.id ? { ...item, is_read: true } : item))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));

      await markNotificationAsRead(n.id);
    }

    if (n.link) {
      setIsOpen(false);
      router.push(n.link);
    }
  };

  const handleMarkAllRead = async () => {
    if (unreadCount === 0) return;

    // Optimistic update
    setNotifications((prev) => prev.map((item) => ({ ...item, is_read: true })));
    setUnreadCount(0);

    startTransition(async () => {
      await markAllNotificationsAsRead();
    });
  };

  const displayedNotifications =
    activeTab === "unread"
      ? notifications.filter((n) => !n.is_read)
      : notifications;

  return (
    <div className={cn("relative inline-block", className)} ref={dropdownRef}>
      {/* Bell Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="relative p-2 text-slate-500 hover:text-slate-900 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer focus:outline-hidden"
        aria-label="Notifications"
        title="View Notifications"
      >
        <Bell className="h-5 w-5" />

        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#024AE5] px-1 text-[10px] font-bold text-white leading-none shadow-xs animate-in zoom-in-50">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown Popover */}
      {isOpen && (
        <div
          className={cn(
            "absolute top-full mt-2 w-80 sm:w-96 bg-white rounded-xl shadow-xl border border-slate-200 z-50 overflow-hidden animate-in fade-in-50 zoom-in-95",
            align === "right" ? "right-0" : "left-0"
          )}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 bg-slate-50/70">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-slate-900">Notifications</h3>
              {unreadCount > 0 && (
                <span className="px-2 py-0.5 text-[10px] font-bold bg-blue-100 text-[#024AE5] rounded-full">
                  {unreadCount} new
                </span>
              )}
            </div>

            {unreadCount > 0 && (
              <button
                type="button"
                onClick={handleMarkAllRead}
                disabled={isPending}
                className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-600 hover:text-[#024AE5] cursor-pointer transition-colors"
                title="Mark all notifications as read"
              >
                <CheckCheck className="h-3.5 w-3.5" />
                <span>Mark all read</span>
              </button>
            )}
          </div>

          {/* Filter Tabs */}
          <div className="flex border-b border-slate-100 px-4 pt-1 bg-white text-xs">
            <button
              onClick={() => setActiveTab("all")}
              className={cn(
                "py-2 px-3 font-semibold border-b-2 transition-colors cursor-pointer",
                activeTab === "all"
                  ? "border-[#024AE5] text-[#024AE5]"
                  : "border-transparent text-slate-500 hover:text-slate-800"
              )}
            >
              All ({notifications.length})
            </button>
            <button
              onClick={() => setActiveTab("unread")}
              className={cn(
                "py-2 px-3 font-semibold border-b-2 transition-colors cursor-pointer",
                activeTab === "unread"
                  ? "border-[#024AE5] text-[#024AE5]"
                  : "border-transparent text-slate-500 hover:text-slate-800"
              )}
            >
              Unread ({unreadCount})
            </button>
          </div>

          {/* Notifications List */}
          <div className="max-h-[360px] overflow-y-auto divide-y divide-slate-100">
            {loading ? (
              <div className="py-12 flex flex-col items-center justify-center text-slate-400 gap-2">
                <Loader2 className="h-5 w-5 animate-spin text-[#024AE5]" />
                <span className="text-xs">Loading notifications...</span>
              </div>
            ) : displayedNotifications.length === 0 ? (
              <div className="py-12 px-4 text-center">
                <div className="h-10 w-10 mx-auto rounded-full bg-slate-100 flex items-center justify-center text-slate-400 mb-2">
                  <CheckCheck className="h-5 w-5 text-emerald-600" />
                </div>
                <p className="text-xs font-semibold text-slate-700">
                  {activeTab === "unread"
                    ? "No unread notifications"
                    : "No notifications yet"}
                </p>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  {activeTab === "unread"
                    ? "You have reviewed all incoming updates."
                    : "All updates about orders, inventory, and status will appear here."}
                </p>
              </div>
            ) : (
              displayedNotifications.map((n) => (
                <div
                  key={n.id}
                  onClick={() => handleMarkAsRead(n)}
                  className={cn(
                    "flex items-start gap-3 p-3.5 transition-colors cursor-pointer text-left hover:bg-slate-50",
                    !n.is_read ? "bg-blue-50/40" : "bg-white"
                  )}
                >
                  {/* Icon */}
                  <div
                    className={cn(
                      "h-8 w-8 rounded-lg flex items-center justify-center shrink-0 border mt-0.5",
                      getIconBg(n.type)
                    )}
                  >
                    {getNotificationIcon(n.type)}
                  </div>

                  {/* Body */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <p
                        className={cn(
                          "text-xs font-semibold truncate",
                          !n.is_read ? "text-slate-900 font-bold" : "text-slate-700"
                        )}
                      >
                        {n.title}
                      </p>
                      <span className="text-[10px] text-slate-400 shrink-0 font-medium">
                        {formatTimeAgo(n.created_at)}
                      </span>
                    </div>

                    <p className="text-[11px] text-slate-600 line-clamp-2 mt-0.5 leading-relaxed">
                      {n.message}
                    </p>

                    {n.link && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-[#024AE5] mt-1 hover:underline">
                        <span>View Details</span>
                        <ExternalLink className="h-2.5 w-2.5" />
                      </span>
                    )}
                  </div>

                  {/* Unread Indicator */}
                  {!n.is_read && (
                    <span
                      className="h-2 w-2 rounded-full bg-[#024AE5] shrink-0 mt-1.5"
                      title="Unread"
                    />
                  )}
                </div>
              ))
            )}
          </div>

          {/* Footer */}
          {notifications.length > 0 && (
            <div className="p-2 border-t border-slate-100 bg-slate-50/50 text-center">
              <span className="text-[11px] text-slate-400">
                Live updates powered by Sojar Indusy
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
