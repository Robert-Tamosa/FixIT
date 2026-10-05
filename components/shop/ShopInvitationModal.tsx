"use client";

import { useState, useEffect } from "react";
import {
  getShopInvitationDetail,
  respondToShopInvitation,
  type DisplayShopInvitationDetail,
} from "@/app/actions/shop-dashboard";

export function ShopInvitationModal({
  invitationId,
  onClose,
}: {
  invitationId: string;
  onClose: () => void;
}) {
  const [detail, setDetail] = useState<DisplayShopInvitationDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [outcome, setOutcome] = useState<"accepted" | "declined" | null>(null);

  useEffect(() => {
    getShopInvitationDetail(invitationId)
      .then(setDetail)
      .catch((e) => setError(e instanceof Error ? e.message : "Couldn't load this invitation."));
  }, [invitationId]);

  async function respond(accept: boolean) {
    setSubmitting(true);
    setError(null);
    try {
      await respondToShopInvitation(invitationId, accept);
      setOutcome(accept ? "accepted" : "declined");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't submit your response.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center
        bg-black/70 backdrop-blur-sm px-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      role="dialog" aria-modal="true" aria-label="Shop invitation"
    >
      <div className="w-full max-w-sm rounded-3xl border border-white/[0.08]
        bg-[#0e0e0f] shadow-2xl p-6">

        {error ? (
          <>
            <p className="text-sm text-orange-400 mb-4">{error}</p>
            <button onClick={onClose}
              className="w-full py-2.5 rounded-xl border border-white/[0.08] text-zinc-300 text-sm font-medium">
              Close
            </button>
          </>
        ) : outcome ? (
          <>
            <div className="w-12 h-12 rounded-2xl bg-emerald-400/10 border border-emerald-400/20
              flex items-center justify-center mb-4 mx-auto">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M20 6L9 17l-5-5" stroke="#34D399" strokeWidth="2.5"
                  strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <p className="text-sm text-zinc-100 text-center font-medium mb-1">
              {outcome === "accepted" ? "You've joined the shop" : "Invitation declined"}
            </p>
            <p className="text-xs text-zinc-500 text-center mb-5">
              {outcome === "accepted"
                ? "You'll now show up in their mechanic roster."
                : "No further action needed."}
            </p>
            <button onClick={onClose}
              className="w-full py-2.5 rounded-xl bg-amber-400 text-zinc-900 text-sm font-bold
                active:scale-[0.98] transition-all">
              Done
            </button>
          </>
        ) : !detail ? (
          <p className="text-sm text-zinc-500 text-center py-6">Loading…</p>
        ) : detail.status !== "PENDING" ? (
          <>
            <p className="text-sm text-zinc-100 text-center font-medium mb-1">
              Already {detail.status === "ACCEPTED" ? "accepted" : "declined"}
            </p>
            <p className="text-xs text-zinc-500 text-center mb-5">
              This invitation from {detail.shopName} was already responded to.
            </p>
            <button onClick={onClose}
              className="w-full py-2.5 rounded-xl border border-white/[0.08] text-zinc-300 text-sm font-medium">
              Close
            </button>
          </>
        ) : (
          <>
            <h2 className="text-base font-semibold text-zinc-100 mb-1">Shop Invitation</h2>
            <p className="text-sm text-zinc-400 mb-1">
              <span className="text-zinc-100 font-medium">{detail.shopName}</span> wants you to join as a mechanic.
            </p>
            <p className="text-xs text-zinc-600 mb-5">{detail.shopAddress}</p>

            <div className="flex gap-2.5">
              <button
                onClick={() => respond(false)}
                disabled={submitting}
                className="flex-1 py-2.5 rounded-xl border border-white/[0.08] text-zinc-300
                  text-sm font-medium disabled:opacity-50">
                Decline
              </button>
              <button
                onClick={() => respond(true)}
                disabled={submitting}
                className="flex-1 py-2.5 rounded-xl bg-amber-400 text-zinc-900 text-sm font-bold
                  active:scale-[0.98] transition-all disabled:opacity-50">
                {submitting ? "…" : "Accept"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}