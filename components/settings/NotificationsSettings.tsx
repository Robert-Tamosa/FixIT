"use client";

import { useState, useTransition, useEffect } from "react";
import { getAccountSettings, setNotificationsEnabled } from "@/app/actions/account-settings";
import { SettingsPageShell } from "./SettingsPageShell";

export function NotificationsSettings({ backHref }: { backHref: string }) {
  const [enabled, setEnabled] = useState<boolean | null>(null); // null = loading
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getAccountSettings()
      .then((s) => setEnabled(s.notificationsEnabled))
      .catch(() => setError("Couldn't load your settings."));
  }, []);

  function handleToggle() {
    if (enabled === null) return;
    const next = !enabled;
    setEnabled(next); // optimistic
    setError(null);
    startTransition(async () => {
      try {
        await setNotificationsEnabled(next);
      } catch {
        setEnabled(!next); // revert on failure
        setError("Couldn't save that — try again.");
      }
    });
  }

  return (
    <SettingsPageShell title="Notifications" backHref={backHref}>
      <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-zinc-100">Push notifications</p>
            <p className="text-xs text-zinc-500 mt-0.5">
              Booking updates, messages, and status changes.
            </p>
          </div>
          <button
            onClick={handleToggle}
            disabled={enabled === null || isPending}
            aria-pressed={!!enabled}
            aria-label="Toggle push notifications"
            className={`relative w-12 h-7 rounded-full transition-colors duration-200
              disabled:opacity-40 shrink-0 ${enabled ? "bg-emerald-500" : "bg-white/[0.12]"}`}>
            <span className={`absolute top-1 left-1 w-5 h-5 rounded-full bg-white
              transition-transform duration-200 ${enabled ? "translate-x-5" : "translate-x-0"}`} />
          </button>
        </div>
      </div>

      {error && <p className="text-xs text-orange-400 mt-3">{error}</p>}

      <p className="text-xs text-zinc-600 mt-4 leading-relaxed">
        This is a single master switch for now — per-category controls
        (bookings, messages, promos) may come later.
      </p>
    </SettingsPageShell>
  );
}