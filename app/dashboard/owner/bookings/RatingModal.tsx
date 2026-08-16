"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { submitRating, type RatingState } from "@/app/actions/submit-rating";

interface RatingModalProps {
  bookingId:     string;
  mechanicName:  string;
  vehicleLabel:  string;
  serviceDate:   string;
  open:          boolean;
  onClose:       () => void;
  onSuccess:     () => void;
}

const STAR_LABELS = ["", "Poor", "Fair", "Good", "Great", "Excellent"];

export function RatingModal({
  bookingId,
  mechanicName,
  vehicleLabel,
  serviceDate,
  open,
  onClose,
  onSuccess,
}: RatingModalProps) {
  const initial: RatingState = { status: "idle" };
  const [state, formAction, pending] = useActionState(submitRating, initial);
  const [hovered, setHovered]  = useState(0);
  const [selected, setSelected] = useState(0);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.status === "success") {
      onSuccess();
      onClose();
    }
  }, [state, onSuccess, onClose]);

  useEffect(() => {
    if (!open) { setHovered(0); setSelected(0); }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const activestar = hovered || selected;

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center sm:items-center justify-center
        bg-black/75 backdrop-blur-sm px-4 pb-4 sm:pb-0"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      role="dialog" aria-modal="true" aria-label="Rate mechanic"
    >
      <div className="w-full max-w-md rounded-3xl border border-white/[0.08]
        bg-[#0e0e0f] shadow-2xl overflow-hidden
        animate-in slide-in-from-bottom-4 duration-300">

        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-6 pb-4
          border-b border-zinc-800/60">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-amber-400/10 border border-amber-400/20
              flex items-center justify-center">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
                  fill="#F59E0B" stroke="#F59E0B" strokeWidth="1.2" />
              </svg>
            </div>
            <h2 className="text-base font-semibold text-zinc-100">Rate Your Mechanic</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="Close"
            className="w-8 h-8 rounded-lg flex items-center justify-center
              text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.05] transition-colors">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M1 1l12 12M13 1L1 13" stroke="currentColor" strokeWidth="1.6"
                strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {/* Booking summary */}
        <div className="mx-6 mt-5 px-4 py-3.5 rounded-2xl bg-white/[0.03] border border-white/[0.07]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-400/10 border border-amber-400/20
              flex items-center justify-center shrink-0">
              <span className="text-xs font-bold text-amber-400">
                {mechanicName.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)}
              </span>
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-zinc-100 truncate">{mechanicName}</p>
              <p className="text-xs text-zinc-500 truncate">{vehicleLabel} · {serviceDate}</p>
            </div>
          </div>
        </div>

        <form ref={formRef} action={formAction} className="px-6 py-5 space-y-5">
          <input type="hidden" name="bookingId" value={bookingId} />
          <input type="hidden" name="rating"    value={selected} />

          {/* Star selector */}
          <div className="flex flex-col items-center gap-3">
            <div className="flex items-center gap-2"
              onMouseLeave={() => setHovered(0)}>
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  aria-label={`${star} star${star > 1 ? "s" : ""}`}
                  onMouseEnter={() => setHovered(star)}
                  onClick={() => setSelected(star)}
                  className="transition-transform active:scale-90 hover:scale-110"
                >
                  <svg width="38" height="38" viewBox="0 0 24 24" aria-hidden="true"
                    className="transition-all duration-100"
                    fill={star <= activestar ? "#F59E0B" : "none"}
                    stroke={star <= activestar ? "#F59E0B" : "#3F3F46"}
                    strokeWidth="1.5">
                    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                  </svg>
                </button>
              ))}
            </div>

            {/* Label under stars */}
            <p className={`text-sm font-semibold transition-all duration-150 h-5 ${
              activestar ? "text-amber-400" : "text-zinc-600"
            }`}>
              {activestar ? STAR_LABELS[activestar] : "Tap a star to rate"}
            </p>
          </div>

          {/* Comment */}
          <div className="space-y-1.5">
            <label htmlFor="comment"
              className="block text-xs font-medium text-zinc-400 uppercase tracking-wide">
              Comments
              <span className="ml-1 text-zinc-600 normal-case font-normal">(optional)</span>
            </label>
            <textarea
              id="comment" name="comment"
              rows={3}
              placeholder="How was your experience with this mechanic?"
              className="w-full px-3.5 py-3 rounded-xl resize-none
                bg-white/[0.04] border border-white/[0.08] text-sm text-zinc-200
                placeholder:text-zinc-600
                focus:outline-none focus:border-amber-400/40 focus:bg-white/[0.06]
                transition-colors"
            />
            <p className="text-[11px] text-zinc-600">
              Your feedback is analyzed to improve mechanic matching.
            </p>
          </div>

          {/* Error */}
          {state.status === "error" && (
            <p className="flex items-center gap-2 text-sm text-red-400
              bg-red-500/10 border border-red-500/20 rounded-xl px-3.5 py-2.5">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.6" />
                <path d="M12 8v4M12 16h.01" stroke="currentColor" strokeWidth="2"
                  strokeLinecap="round" />
              </svg>
              {state.message}
            </p>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 py-2.5 rounded-xl border border-zinc-700 text-sm
                font-medium text-zinc-400 hover:text-zinc-200 hover:border-zinc-600
                transition-colors">
              Cancel
            </button>
            <button
              type="submit"
              disabled={pending || selected === 0}
              className="flex-[2] py-2.5 rounded-xl bg-amber-500 text-sm font-bold
                text-black hover:bg-amber-400 active:scale-[0.98]
                disabled:opacity-40 disabled:cursor-not-allowed
                transition-all flex items-center justify-center gap-2">
              {pending ? (
                <>
                  <svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24"
                    fill="none">
                    <circle cx="12" cy="12" r="10" stroke="#080909"
                      strokeWidth="3" strokeOpacity="0.25" />
                    <path d="M12 2a10 10 0 0 1 10 10" stroke="#080909"
                      strokeWidth="3" strokeLinecap="round" />
                  </svg>
                  Submitting…
                </>
              ) : "Submit Rating"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
