"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  getNotifications,
  getUnreadNotificationCount,
  markNotificationRead,
  markAllNotificationsRead,
  type DisplayNotification,
} from "@/app/actions/notifications";

const POLL_INTERVAL = 15000; // notifications don't need chat-speed polling

const TYPE_ICON: Record<string, string> = {
  BOOKING_ACCEPTED: "M20 6L9 17l-5-5",
  BOOKING_DECLINED: "M18 6L6 18M6 6l12 12",
  NEW_BOOKING_REQUEST: "M12 5v14M5 12h14",
  ESTIMATE_SENT: "M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2M9 5a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2M9 5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2",
  ESTIMATE_ACCEPTED: "M20 6L9 17l-5-5",
  ESTIMATE_DECLINED: "M18 6L6 18M6 6l12 12",
  EN_ROUTE: "M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z",
  IN_PROGRESS: "M12 2v10l4 2",
  DONE: "M20 6L9 17l-5-5",
  NEW_MESSAGE: "M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z",
};

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  const hours = Math.floor(diff / 3_600_000);
  const days = Math.floor(diff / 86_400_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${days}d ago`;
}

export function NotificationBell() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState<DisplayNotification[]>([]);
  const [loading, setLoading] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  const loadCount = useCallback(async () => {
    try {
      const count = await getUnreadNotificationCount();
      setUnreadCount(count);
    } catch (err) {
      console.error("Failed to load unread count:", err);
    }
  }, []);

  const loadNotifications = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getNotifications();
      setNotifications(data);
    } catch (err) {
      console.error("Failed to load notifications:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Poll the unread count regardless of whether the panel is open — that's
  // what drives the badge. Skips while the tab is backgrounded, same
  // convention as the rest of the app's polling.
  useEffect(() => {
    loadCount();
    const id = setInterval(() => {
      if (document.visibilityState === "visible") loadCount();
    }, POLL_INTERVAL);
    return () => clearInterval(id);
  }, [loadCount]);

  // Load the full list only when the panel opens — no point fetching detail
  // for something the user hasn't asked to see yet.
  useEffect(() => {
    if (open) loadNotifications();
  }, [open, loadNotifications]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  async function handleNotificationClick(n: DisplayNotification) {
    if (!n.isRead) {
      setNotifications((prev) => prev.map((x) => (x.id === n.id ? { ...x, isRead: true } : x)));
      setUnreadCount((prev) => Math.max(0, prev - 1));
      markNotificationRead(n.id).catch(() => {});
    }
    setOpen(false);
    if (n.link) router.push(n.link);
  }

  async function handleMarkAllRead() {
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    setUnreadCount(0);
    try {
      await markAllNotificationsRead();
    } catch (err) {
      console.error("Failed to mark all read:", err);
    }
  }

  return (
    <div className="relative" ref={panelRef}>
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label="Notifications"
        className="relative w-9 h-9 rounded-xl bg-white/[0.04] border border-white/[0.08]
          flex items-center justify-center hover:bg-white/[0.07] transition-colors">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"
            stroke="#A1A1AA" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" stroke="#A1A1AA" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full
            bg-amber-400 flex items-center justify-center text-[10px] font-bold text-[#080909]">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 max-h-[28rem] overflow-hidden
          rounded-2xl bg-[#111318] border border-white/[0.08] shadow-2xl z-50 flex flex-col">
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06]">
            <p className="text-sm font-semibold text-zinc-100">Notifications</p>
            {unreadCount > 0 && (
              <button onClick={handleMarkAllRead} className="text-xs text-amber-400 font-medium">
                Mark all read
              </button>
            )}
          </div>

          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center py-10 gap-2.5">
                <span className="w-4 h-4 rounded-full border-2 border-zinc-600 border-t-amber-400 animate-spin" />
                <p className="text-sm text-zinc-500">Loading…</p>
              </div>
            ) : notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 gap-2 text-center px-6">
                <p className="text-sm text-zinc-500">No notifications yet</p>
              </div>
            ) : (
              notifications.map((n) => (
                <button
                  key={n.id}
                  onClick={() => handleNotificationClick(n)}
                  className={[
                    "w-full flex items-start gap-3 px-4 py-3 text-left border-b border-white/[0.04]",
                    "hover:bg-white/[0.03] transition-colors",
                    !n.isRead ? "bg-amber-400/[0.04]" : "",
                  ].join(" ")}>
                  <div className={[
                    "w-8 h-8 rounded-xl flex items-center justify-center shrink-0 mt-0.5",
                    !n.isRead ? "bg-amber-400/10 border border-amber-400/20" : "bg-white/[0.05] border border-white/[0.08]",
                  ].join(" ")}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                      <path d={TYPE_ICON[n.type] ?? TYPE_ICON.BOOKING_ACCEPTED}
                        stroke={!n.isRead ? "#F59E0B" : "#71717A"} strokeWidth="1.6"
                        strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm ${!n.isRead ? "font-semibold text-zinc-100" : "text-zinc-300"}`}>
                      {n.title}
                    </p>
                    {n.body && <p className="text-xs text-zinc-500 mt-0.5 line-clamp-2">{n.body}</p>}
                    <p className="text-[10px] text-zinc-600 mt-1">{timeAgo(n.createdAt)}</p>
                  </div>
                  {!n.isRead && <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0 mt-2" />}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}