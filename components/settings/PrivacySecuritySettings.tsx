"use client";

import { useState, useTransition, useEffect } from "react";
import { authClient } from "@/lib/auth-client";
import {
  getAccountSettings,
  requestAccountDeletion,
  cancelAccountDeletion,
} from "@/app/actions/account-settings";
import { SettingsPageShell } from "./SettingsPageShell";

export function PrivacySecuritySettings({ backHref }: { backHref: string }) {
  // ── Change password ────────────────────────────────────────────────────
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword,     setNewPassword]     = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [pwError,   setPwError]   = useState<string | null>(null);
  const [pwSuccess, setPwSuccess] = useState(false);
  const [pwPending, setPwPending] = useState(false);

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    setPwError(null);
    setPwSuccess(false);

    if (newPassword.length < 8) {
      setPwError("New password must be at least 8 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPwError("New passwords don't match.");
      return;
    }

    setPwPending(true);
    const { error } = await authClient.changePassword({
      currentPassword,
      newPassword,
      revokeOtherSessions: true,
    });
    setPwPending(false);

    if (error) {
      // Better Auth errors here if the account has no credential password at
      // all (Google/Facebook-only sign-in). The exact error text/code for
      // that case isn't confirmed against your Better Auth version — if this
      // substring check doesn't catch it, the generic message below still
      // shows, just less specifically worded. Worth a quick manual test with
      // an OAuth-only test account.
      setPwError(
        error.message?.toLowerCase().includes("credential")
          ? "This account signed in with Google/Facebook and has no password to change."
          : error.message ?? "Couldn't change your password — check your current password.",
      );
      return;
    }

    setPwSuccess(true);
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
  }

  // ── Delete account request ─────────────────────────────────────────────
  const [deletionRequestedAt, setDeletionRequestedAt] =
    useState<Date | string | null | undefined>(undefined); // undefined = loading
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [delError, setDelError] = useState<string | null>(null);

  useEffect(() => {
    getAccountSettings()
      .then((s) => setDeletionRequestedAt(s.deletionRequestedAt))
      .catch(() => setDelError("Couldn't load your account status."));
  }, []);

  function handleRequestDeletion() {
    setDelError(null);
    startTransition(async () => {
      try {
        await requestAccountDeletion();
        setDeletionRequestedAt(new Date());
        setConfirmingDelete(false);
      } catch {
        setDelError("Couldn't submit the request — try again.");
      }
    });
  }

  function handleCancelDeletion() {
    setDelError(null);
    startTransition(async () => {
      try {
        await cancelAccountDeletion();
        setDeletionRequestedAt(null);
      } catch {
        setDelError("Couldn't cancel the request — try again.");
      }
    });
  }

  return (
    <SettingsPageShell title="Privacy & Security" backHref={backHref}>
      {/* Change password */}
      <form onSubmit={handleChangePassword}
        className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-4 mb-4 space-y-3">
        <p className="text-sm font-semibold text-zinc-100 mb-1">Change Password</p>

        <input
          type="password"
          placeholder="Current password"
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
          required
          className="w-full rounded-xl bg-white/[0.04] border border-white/[0.08] px-3.5 py-2.5
            text-sm text-zinc-100 placeholder:text-zinc-600 outline-none focus:border-amber-400/40"
        />
        <input
          type="password"
          placeholder="New password (min. 8 characters)"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          required
          minLength={8}
          className="w-full rounded-xl bg-white/[0.04] border border-white/[0.08] px-3.5 py-2.5
            text-sm text-zinc-100 placeholder:text-zinc-600 outline-none focus:border-amber-400/40"
        />
        <input
          type="password"
          placeholder="Confirm new password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          required
          className="w-full rounded-xl bg-white/[0.04] border border-white/[0.08] px-3.5 py-2.5
            text-sm text-zinc-100 placeholder:text-zinc-600 outline-none focus:border-amber-400/40"
        />

        {pwError && <p className="text-xs text-orange-400">{pwError}</p>}
        {pwSuccess && (
          <p className="text-xs text-emerald-400">
            Password updated. Other sessions were signed out.
          </p>
        )}

        <button
          type="submit"
          disabled={pwPending}
          className="w-full py-2.5 rounded-xl bg-amber-400 text-zinc-900 text-sm font-bold
            active:scale-[0.98] transition-all disabled:opacity-50">
          {pwPending ? "Updating…" : "Update Password"}
        </button>
      </form>

      {/* Delete account */}
      <div className="rounded-2xl border border-red-500/25 bg-red-500/[0.05] p-4">
        <p className="text-sm font-semibold text-red-300 mb-1">Delete Account</p>

        {deletionRequestedAt === undefined ? (
          <p className="text-xs text-zinc-500">Loading…</p>
        ) : deletionRequestedAt ? (
          <>
            <p className="text-xs text-zinc-400 mb-3 leading-relaxed">
              A deletion request was submitted on{" "}
              {new Date(deletionRequestedAt).toLocaleDateString("en-PH", {
                month: "short", day: "numeric", year: "numeric",
              })}. Your account is still active until this is processed.
            </p>
            <button
              onClick={handleCancelDeletion}
              disabled={isPending}
              className="w-full py-2.5 rounded-xl border border-white/[0.08] text-zinc-300
                text-sm font-medium disabled:opacity-50">
              {isPending ? "Cancelling…" : "Cancel Deletion Request"}
            </button>
          </>
        ) : confirmingDelete ? (
          <>
            <p className="text-xs text-zinc-400 mb-3 leading-relaxed">
              This submits a request to permanently delete your account. It
              won't happen immediately — you can cancel any time before it's
              processed.
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setConfirmingDelete(false)}
                disabled={isPending}
                className="flex-1 py-2.5 rounded-xl border border-white/[0.08] text-zinc-400
                  text-sm font-medium disabled:opacity-40">
                Never mind
              </button>
              <button
                onClick={handleRequestDeletion}
                disabled={isPending}
                className="flex-1 py-2.5 rounded-xl bg-red-500/20 border border-red-500/40
                  text-red-300 text-sm font-semibold disabled:opacity-50">
                {isPending ? "Submitting…" : "Confirm Request"}
              </button>
            </div>
          </>
        ) : (
          <>
            <p className="text-xs text-zinc-400 mb-3 leading-relaxed">
              Permanently delete your account and data. This can't be undone
              once processed.
            </p>
            <button
              onClick={() => setConfirmingDelete(true)}
              className="w-full py-2.5 rounded-xl border border-red-500/30 text-red-400
                text-sm font-semibold hover:bg-red-500/10 transition-colors">
              Request Account Deletion
            </button>
          </>
        )}

        {delError && <p className="text-xs text-orange-400 mt-3">{delError}</p>}
      </div>
    </SettingsPageShell>
  );
}