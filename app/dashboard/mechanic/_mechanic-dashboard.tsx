"use client";

import { useState, useEffect, useTransition } from "react";
import { usePolling } from "@/app/hooks/usePolling";
import { useRouter } from "next/navigation";
import {
  acceptBooking,
  declineBooking,
  advanceBookingStatus,
} from "@/app/actions/booking-actions";
import { createEstimate, editEstimate } from "@/app/actions/estimate";
import { setAvailability } from "@/app/actions/mechanic-location";
import { generateInvoice } from "@/app/actions/invoice";
import { getPayment, type DisplayPayment } from "@/app/actions/payment";
import { ConfirmCashPaymentButton } from "@/components/payment/ConfirmCashPaymentButton";

// ── Exported types ────────────────────────────────────────────────────────────

export interface SessionMechanic {
  id: string;
  name: string;
  email: string;
  image?: string | null;
  phone?: string | null;
  specialty: string;
  isVerified: boolean;
  isAvailable: boolean;
  hasShop: boolean;
}

export interface IncomingRequest {
  id: string;
  ownerName: string;
  ownerInitials: string;
  vehicleLabel: string;
  problem: string;
  scheduledAt: string | null;
  price: string;
  receivedMinsAgo: number;
}

export interface NeedsEstimateJob {
  id: string;
  ownerName: string;
  ownerInitials: string;
  vehicleLabel: string;
  problem: string;
}

export interface AwaitingEstimateJob {
  id: string;
  ownerName: string;
  ownerInitials: string;
  vehicleLabel: string;
  problem: string;
  laborCost: number;
  partsCost: number;
  totalCost: number;
  notes: string | null;
}

export interface ActiveJob {
  id: string;
  ownerName: string;
  ownerInitials: string;
  ownerPhone?: string | null;
  vehicleLabel: string;
  problem: string;
  // DONE added — these cards now also cover done-but-unpaid jobs, which
  // stay visible on Home until payment clears rather than disappearing the
  // moment status hits DONE. See JobPaymentStrip / ActiveJobCard's isDone
  // branch below for what actually changes in that state.
  status: "ESTIMATE_ACCEPTED" | "EN_ROUTE" | "IN_PROGRESS" | "DONE";
  isEmergency: boolean;
  scheduledAt: string | null;
  price: string;
  notes?: string | null;
}

export interface UpcomingJob {
  id: string;
  ownerName: string;
  ownerInitials: string;
  vehicleLabel: string;
  problem: string;
  scheduledAt: string;
  price: string;
}

export interface RecentReview {
  ownerName: string;
  ownerInitials: string;
  rating: number;
  comment: string | null;
  date: string;
}

export interface MechanicStats {
  todayJobs: number;
  weekEarnings: string;
  avgRating: number;
  completionRate: number;
  totalReviews: number;
}

interface InvoiceLineItem {
  description: string;
  quantity: number;
  unitPrice: number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

// ── StarRating ────────────────────────────────────────────────────────────────

function StarRating({ value, size = 11 }: { value: number; size?: number }) {
  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((i) => (
        <svg
          key={i}
          width={size}
          height={size}
          viewBox="0 0 24 24"
          aria-hidden="true"
          fill={i <= Math.round(value) ? "#F59E0B" : "none"}
          stroke={i <= Math.round(value) ? "#F59E0B" : "#3F3F46"}
          strokeWidth="1.5">
          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
        </svg>
      ))}
      <span className="text-xs font-semibold text-zinc-200 ml-0.5">
        {value > 0 ? value.toFixed(1) : "—"}
      </span>
    </div>
  );
}

// ── Header ────────────────────────────────────────────────────────────────────

// ── Availability Toggle ─────────────────────────────────────────────────────

function AvailabilityToggle({
  initialAvailable,
  hasShop,
}: {
  initialAvailable: boolean;
  hasShop: boolean;
}) {
  const [isAvailable, setIsAvailable] = useState(initialAvailable);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [locating, setLocating] = useState(false);

  function handleToggle() {
    const next = !isAvailable;
    setError(null);

    // Shop-affiliated mechanics don't need their own GPS — emergency matching
    // falls back to the shop's fixed address automatically. Just flip the flag.
    if (hasShop) {
      setIsAvailable(next);
      startTransition(async () => {
        try {
          await setAvailability(next);
        } catch (e) {
          setIsAvailable(!next); // revert on failure
          setError(
            e instanceof Error ? e.message : "Could not update availability",
          );
        }
      });
      return;
    }

    // Independent mechanics have no fixed base — capture live location when
    // going available, same browser API the owner's emergency flow uses.
    if (!next) {
      setIsAvailable(false);
      startTransition(async () => {
        try {
          await setAvailability(false);
        } catch (e) {
          setIsAvailable(true);
          setError(
            e instanceof Error ? e.message : "Could not update availability",
          );
        }
      });
      return;
    }

    if (!navigator.geolocation) {
      setError(
        "Your browser doesn't support location sharing, which independent mechanics need to go available.",
      );
      return;
    }

    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        setIsAvailable(true);
        startTransition(async () => {
          try {
            await setAvailability(
              true,
              pos.coords.latitude,
              pos.coords.longitude,
            );
          } catch (e) {
            setIsAvailable(false);
            setError(
              e instanceof Error ? e.message : "Could not update availability",
            );
          }
        });
      },
      () => {
        setLocating(false);
        setError(
          "Location access was denied. Independent mechanics need to share location to go available.",
        );
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }

  const busy = isPending || locating;

  return (
    <div className="flex items-center gap-3">
      <button
        onClick={handleToggle}
        disabled={busy}
        aria-pressed={isAvailable}
        className={`relative w-12 h-7 rounded-full transition-colors duration-200 disabled:opacity-50 ${
          isAvailable ? "bg-emerald-500" : "bg-white/[0.12]"
        }`}>
        <span
          className={`absolute top-1 left-1 w-5 h-5 rounded-full bg-white transition-transform duration-200 ${
            isAvailable ? "translate-x-5" : "translate-x-0"
          }`}
        />
      </button>
      <div>
        <p className="text-sm font-medium text-zinc-100">
          {locating
            ? "Getting your location…"
            : isAvailable
              ? "Available"
              : "Offline"}
        </p>
        {hasShop ? (
          <p className="text-xs text-zinc-500">Using your shop's location</p>
        ) : (
          <p className="text-xs text-zinc-500">
            Independent — location shared when available
          </p>
        )}
      </div>
      {error && (
        <p className="ml-auto text-xs text-orange-400 bg-orange-500/[0.07] rounded-lg px-2.5 py-1.5 max-w-[180px]">
          {error}
        </p>
      )}
    </div>
  );
}

function Header({ mechanic }: { mechanic: SessionMechanic }) {
  const h = new Date().getHours();
  const greeting =
    h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
  const firstName = mechanic.name.split(" ")[0];
  const initials = getInitials(mechanic.name);

  return (
    <div className="mb-5">
      {/* Top row */}
      <div className="flex items-center justify-between mb-3">
        <div>
          <div className="flex items-center gap-2 mb-0.5">
            <svg
              width="18"
              height="18"
              viewBox="0 0 20 20"
              fill="none"
              aria-hidden="true">
              <path
                d="M10 2L4 4.5V10.5C4 14.7 6.8 18.5 10 19.5C13.2 18.5 16 14.7 16 10.5V4.5L10 2Z"
                fill="#F59E0B"
                fillOpacity="0.25"
                stroke="#F59E0B"
                strokeWidth="1.2"
              />
              <path
                d="M7.5 10.5L9.5 12.5L13.5 8.5"
                stroke="#F59E0B"
                strokeWidth="1.4"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <span className="text-[20px] font-black tracking-tight text-zinc-100 leading-none">
              Fix<span className="text-amber-400">IT</span>
            </span>
          </div>
          <p className="text-sm text-zinc-500">
            {greeting},{" "}
            <span className="text-zinc-300 font-medium">{firstName}</span> 👋
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            aria-label="Notifications"
            className="relative w-10 h-10 rounded-xl bg-white/[0.04] border border-white/[0.08]
              flex items-center justify-center hover:bg-white/[0.07] transition-colors">
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              aria-hidden="true">
              <path
                d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"
                stroke="#71717A"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M13.73 21a2 2 0 0 1-3.46 0"
                stroke="#71717A"
                strokeWidth="1.6"
                strokeLinecap="round"
              />
            </svg>
            <span className="absolute top-2 right-2 w-2 h-2 bg-amber-400 rounded-full border-2 border-[#080909]" />
          </button>
          <div
            className="w-10 h-10 rounded-xl bg-amber-400/10 border border-amber-400/20
            flex items-center justify-center">
            <span className="text-[11px] font-bold text-amber-400">
              {initials}
            </span>
          </div>
        </div>
      </div>

      {/* Specialty + verified badge row */}
      <div
        className="flex items-center gap-3 px-4 py-3 rounded-2xl
        bg-white/[0.03] border border-white/[0.07]">
        <div
          className="w-8 h-8 rounded-xl bg-amber-400/10 border border-amber-400/20
          flex items-center justify-center shrink-0">
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden="true">
            <path
              d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"
              stroke="#F59E0B"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-zinc-100 truncate">
            {mechanic.specialty}
          </p>
          <p className="text-[11px] text-zinc-600">Specialization</p>
        </div>
        {mechanic.isVerified && (
          <div
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg
            bg-emerald-400/10 border border-emerald-400/20 shrink-0">
            <svg
              width="10"
              height="10"
              viewBox="0 0 24 24"
              fill="none"
              aria-hidden="true">
              <path
                d="M20 6L9 17l-5-5"
                stroke="#34D399"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <span className="text-[11px] font-semibold text-emerald-400">
              Verified
            </span>
          </div>
        )}
      </div>

      {/* Availability toggle */}
      <div className="mt-2.5 px-4 py-3 rounded-2xl bg-white/[0.03] border border-white/[0.07]">
        <AvailabilityToggle
          initialAvailable={mechanic.isAvailable}
          hasShop={mechanic.hasShop}
        />
      </div>
    </div>
  );
}

// ── Stats Strip ───────────────────────────────────────────────────────────────

function StatsStrip({ stats }: { stats: MechanicStats }) {
  const items = [
    {
      label: "Today's Jobs",
      value: String(stats.todayJobs),
      icon: "M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2M9 5a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2M9 5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2",
      color: "text-amber-400",
      bg: "bg-amber-400/10",
    },
    {
      label: "This Week",
      value: stats.weekEarnings,
      icon: "M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6",
      color: "text-emerald-400",
      bg: "bg-emerald-400/10",
    },
    {
      label: "Avg Rating",
      value: stats.avgRating > 0 ? stats.avgRating.toFixed(1) : "—",
      icon: "M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z",
      color: "text-amber-400",
      bg: "bg-amber-400/10",
    },
    {
      label: "Completion",
      value: `${stats.completionRate}%`,
      icon: "M22 11.08V12a10 10 0 1 1-5.93-9.14M22 4L12 14.01l-3-3",
      color: "text-sky-400",
      bg: "bg-sky-400/10",
    },
  ];

  return (
    <div className="grid grid-cols-4 gap-2 mb-5">
      {items.map(({ label, value, icon, color, bg }) => (
        <div
          key={label}
          className="flex flex-col items-center gap-1.5 py-3 px-1 rounded-2xl
            bg-white/[0.03] border border-white/[0.07]">
          <div
            className={`w-7 h-7 rounded-lg ${bg} flex items-center justify-center`}>
            <svg
              width="13"
              height="13"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.7"
              strokeLinecap="round"
              strokeLinejoin="round"
              className={color}
              aria-hidden="true">
              <path d={icon} />
            </svg>
          </div>
          <p className="text-sm font-bold text-zinc-100 leading-none">
            {value}
          </p>
          <p className="text-[10px] text-zinc-600 text-center leading-tight">
            {label}
          </p>
        </div>
      ))}
    </div>
  );
}

// ── Incoming Requests ─────────────────────────────────────────────────────────

function IncomingRequestsSection({
  requests,
  onAccept,
  onDecline,
}: {
  requests: IncomingRequest[];
  onAccept: (id: string) => void;
  onDecline: (id: string) => void;
}) {
  if (requests.length === 0) return null;

  return (
    <div className="mb-5">
      <div className="flex items-center gap-2 mb-3">
        <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
        <span className="text-sm font-semibold text-zinc-100">
          Incoming Requests
        </span>
        <span
          className="ml-auto text-[11px] font-medium text-amber-400
          bg-amber-400/10 px-2 py-0.5 rounded-full">
          {requests.length} new
        </span>
      </div>

      <div className="flex flex-col gap-3">
        {requests.map((req) => (
          <div
            key={req.id}
            className="rounded-2xl border border-white/[0.09] bg-white/[0.03] p-4
              ring-1 ring-amber-400/10">
            {/* Top row */}
            <div className="flex items-start gap-3 mb-3">
              <div
                className="w-11 h-11 rounded-xl bg-amber-400/10 border border-amber-400/20
                flex items-center justify-center shrink-0 text-sm font-bold text-amber-400">
                {req.ownerInitials}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <p className="font-semibold text-zinc-100 text-sm">
                    {req.ownerName}
                  </p>
                </div>
                <p className="text-xs text-zinc-500 truncate">
                  {req.vehicleLabel}
                </p>
              </div>
              <span className="text-[10px] text-zinc-600 shrink-0">
                {req.receivedMinsAgo}m ago
              </span>
            </div>

            {/* Problem */}
            <p className="text-xs text-zinc-400 mb-3 leading-relaxed line-clamp-2">
              {req.problem}
            </p>

            {/* Meta row */}
            <div className="flex items-center gap-3 mb-3">
              {req.scheduledAt && (
                <div className="flex items-center gap-1.5">
                  <svg
                    width="11"
                    height="11"
                    viewBox="0 0 24 24"
                    fill="none"
                    aria-hidden="true">
                    <circle
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="#71717A"
                      strokeWidth="1.5"
                    />
                    <path
                      d="M12 6v6l4 2"
                      stroke="#71717A"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                    />
                  </svg>
                  <span className="text-[11px] text-zinc-500">
                    {req.scheduledAt}
                  </span>
                </div>
              )}
              <span className="ml-auto text-sm font-bold text-zinc-100">
                {req.price}
              </span>
            </div>

            {/* Actions */}
            <div className="flex gap-2">
              <button
                onClick={() => onDecline(req.id)}
                className="flex-1 py-2 rounded-xl border border-zinc-700 text-xs font-medium
                  text-zinc-500 hover:text-zinc-300 hover:border-zinc-600 transition-colors">
                Decline
              </button>
              <button
                onClick={() => onAccept(req.id)}
                className="flex-[2] py-2 rounded-xl bg-amber-500 text-xs font-bold
                  text-black hover:bg-amber-400 active:scale-[0.98] transition-all
                  shadow-[0_4px_20px_rgba(245,158,11,0.2)]">
                Accept Job
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Needs Estimate ────────────────────────────────────────────────────────────
// CONFIRMED bookings — the mechanic accepted the request but hasn't sent a
// cost estimate yet. This is what used to jump straight into the travel/
// progress tracker; now it stops here until an estimate goes out.

function NeedsEstimateSection({
  jobs,
  onSubmitted,
}: {
  jobs: NeedsEstimateJob[];
  onSubmitted: () => void;
}) {
  const [openId, setOpenId] = useState<string | null>(null);

  if (jobs.length === 0) return null;

  return (
    <div className="mb-5">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-semibold text-zinc-100">Needs Estimate</span>
        <span className="text-[11px] px-2 py-0.5 rounded-full bg-amber-400/10 text-amber-400 border border-amber-400/20">
          {jobs.length}
        </span>
      </div>

      <div className="flex flex-col gap-2.5">
        {jobs.map((job) =>
          openId === job.id ? (
            <EstimateForm
              key={job.id}
              job={job}
              onDone={() => { setOpenId(null); onSubmitted(); }}
              onCancel={() => setOpenId(null)}
            />
          ) : (
            <div
              key={job.id}
              className="px-4 py-3.5 rounded-2xl bg-white/[0.03] border border-white/[0.07]
                flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-zinc-800 flex items-center justify-center
                text-[11px] font-bold text-zinc-400 shrink-0">
                {job.ownerInitials}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-zinc-200 truncate">{job.ownerName}</p>
                <p className="text-xs text-zinc-500 truncate">{job.vehicleLabel} · {job.problem}</p>
              </div>
              <button
                onClick={() => setOpenId(job.id)}
                className="shrink-0 px-3.5 py-2 rounded-xl bg-amber-400 text-zinc-900
                  text-xs font-bold active:scale-[0.98] transition-all">
                Send Estimate
              </button>
            </div>
          ),
        )}
      </div>
    </div>
  );
}

function EstimateForm({
  job,
  onDone,
  onCancel,
}: {
  job: NeedsEstimateJob;
  onDone: () => void;
  onCancel: () => void;
}) {
  const [laborCost, setLaborCost] = useState("");
  const [partsCost, setPartsCost] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const total = (Number(laborCost) || 0) + (Number(partsCost) || 0);

  async function handleSubmit() {
    const labor = Number(laborCost) || 0;
    const parts = Number(partsCost) || 0;
    if (labor <= 0 && parts <= 0) {
      setError("Add a labor or parts cost.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await createEstimate({ bookingId: job.id, laborCost: labor, partsCost: parts, notes: notes || undefined });
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not send estimate");
      setSubmitting(false);
    }
  }

  return (
    <div className="px-4 py-4 rounded-2xl bg-white/[0.03] border border-amber-400/20 space-y-3">
      <div>
        <p className="text-sm font-semibold text-zinc-200">{job.ownerName}</p>
        <p className="text-xs text-zinc-500">{job.vehicleLabel} · {job.problem}</p>
      </div>

      <div className="flex gap-2">
        <div className="flex-1">
          <label className="text-[11px] text-zinc-500 mb-1 block">Labor (₱)</label>
          <input
            type="number" min="0" step="0.01" value={laborCost}
            onChange={(e) => setLaborCost(e.target.value)}
            placeholder="0.00"
            className="w-full px-3 py-2 rounded-xl bg-white/[0.04] border border-white/[0.08]
              text-zinc-100 text-sm placeholder:text-zinc-600 outline-none focus:border-amber-400/50"
          />
        </div>
        <div className="flex-1">
          <label className="text-[11px] text-zinc-500 mb-1 block">Parts (₱)</label>
          <input
            type="number" min="0" step="0.01" value={partsCost}
            onChange={(e) => setPartsCost(e.target.value)}
            placeholder="0.00"
            className="w-full px-3 py-2 rounded-xl bg-white/[0.04] border border-white/[0.08]
              text-zinc-100 text-sm placeholder:text-zinc-600 outline-none focus:border-amber-400/50"
          />
        </div>
      </div>

      <textarea
        rows={2}
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="Notes for the owner (optional)"
        className="w-full px-3 py-2 rounded-xl bg-white/[0.04] border border-white/[0.08]
          text-zinc-100 text-sm placeholder:text-zinc-600 outline-none resize-none focus:border-amber-400/50"
      />

      <div className="flex justify-between items-center pt-1">
        <span className="text-xs text-zinc-500">Total</span>
        <span className="text-base font-bold text-amber-400">
          ₱{total.toLocaleString("en-PH", { minimumFractionDigits: 2 })}
        </span>
      </div>

      {error && (
        <p className="text-xs text-orange-400 bg-orange-500/[0.07] rounded-lg px-3 py-2">{error}</p>
      )}

      <div className="flex gap-2">
        <button
          onClick={onCancel}
          disabled={submitting}
          className="flex-1 py-2.5 rounded-xl border border-white/[0.08] text-zinc-400
            text-sm font-medium disabled:opacity-40">
          Cancel
        </button>
        <button
          onClick={handleSubmit}
          disabled={submitting}
          className="flex-1 py-2.5 rounded-xl bg-amber-400 text-zinc-900 text-sm font-bold
            active:scale-[0.98] transition-all disabled:opacity-50">
          {submitting ? "Sending…" : "Send Estimate"}
        </button>
      </div>
    </div>
  );
}

// ── Awaiting Owner's Response ────────────────────────────────────────────────
// ESTIMATE_SENT bookings — estimate is out, nothing to do but wait. Polling
// picks up the owner's accept/decline automatically.

function AwaitingEstimateSection({ jobs }: { jobs: AwaitingEstimateJob[] }) {
  const [editingId, setEditingId] = useState<string | null>(null);

  if (jobs.length === 0) return null;

  return (
    <div className="mb-5">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-semibold text-zinc-100">Awaiting Owner's Response</span>
        <span className="text-[11px] px-2 py-0.5 rounded-full bg-blue-400/10 text-blue-400 border border-blue-400/20">
          {jobs.length}
        </span>
      </div>

      <div className="flex flex-col gap-2.5">
        {jobs.map((job) =>
          editingId === job.id ? (
            <EditEstimateForm key={job.id} job={job} onDone={() => setEditingId(null)} onCancel={() => setEditingId(null)} />
          ) : (
            <div
              key={job.id}
              className="px-4 py-3.5 rounded-2xl bg-white/[0.03] border border-blue-400/15 space-y-2">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-zinc-800 flex items-center justify-center
                  text-[11px] font-bold text-zinc-400 shrink-0">
                  {job.ownerInitials}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-zinc-200 truncate">{job.ownerName}</p>
                  <p className="text-xs text-zinc-500 truncate">{job.vehicleLabel} · {job.problem}</p>
                </div>
                <span className="shrink-0 text-[11px] text-blue-400 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
                  Waiting
                </span>
              </div>
              <div className="flex items-center justify-between pl-12">
                <p className="text-xs text-zinc-500">
                  Sent: ₱{job.totalCost.toLocaleString("en-PH", { minimumFractionDigits: 2 })}
                </p>
                <button
                  onClick={() => setEditingId(job.id)}
                  className="text-xs text-amber-400 font-medium">
                  Edit estimate
                </button>
              </div>
            </div>
          ),
        )}
      </div>
    </div>
  );
}

function EditEstimateForm({
  job,
  onDone,
  onCancel,
}: {
  job: AwaitingEstimateJob;
  onDone: () => void;
  onCancel: () => void;
}) {
  const [laborCost, setLaborCost] = useState(String(job.laborCost || ""));
  const [partsCost, setPartsCost] = useState(String(job.partsCost || ""));
  const [notes, setNotes] = useState(job.notes ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const total = (Number(laborCost) || 0) + (Number(partsCost) || 0);

  async function handleSubmit() {
    const labor = Number(laborCost) || 0;
    const parts = Number(partsCost) || 0;
    if (labor <= 0 && parts <= 0) {
      setError("Add a labor or parts cost.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await editEstimate({ bookingId: job.id, laborCost: labor, partsCost: parts, notes: notes || undefined });
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not update estimate");
      setSubmitting(false);
    }
  }

  return (
    <div className="px-4 py-4 rounded-2xl bg-white/[0.03] border border-blue-400/20 space-y-3">
      <div>
        <p className="text-sm font-semibold text-zinc-200">{job.ownerName}</p>
        <p className="text-xs text-zinc-500">{job.vehicleLabel} · {job.problem}</p>
      </div>

      <div className="flex gap-2">
        <div className="flex-1">
          <label className="text-[11px] text-zinc-500 mb-1 block">Labor (₱)</label>
          <input
            type="number" min="0" step="0.01" value={laborCost}
            onChange={(e) => setLaborCost(e.target.value)}
            className="w-full px-3 py-2 rounded-xl bg-white/[0.04] border border-white/[0.08]
              text-zinc-100 text-sm outline-none focus:border-amber-400/50"
          />
        </div>
        <div className="flex-1">
          <label className="text-[11px] text-zinc-500 mb-1 block">Parts (₱)</label>
          <input
            type="number" min="0" step="0.01" value={partsCost}
            onChange={(e) => setPartsCost(e.target.value)}
            className="w-full px-3 py-2 rounded-xl bg-white/[0.04] border border-white/[0.08]
              text-zinc-100 text-sm outline-none focus:border-amber-400/50"
          />
        </div>
      </div>

      <textarea
        rows={2}
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="Notes for the owner (optional)"
        className="w-full px-3 py-2 rounded-xl bg-white/[0.04] border border-white/[0.08]
          text-zinc-100 text-sm placeholder:text-zinc-600 outline-none resize-none focus:border-amber-400/50"
      />

      <div className="flex justify-between items-center pt-1">
        <span className="text-xs text-zinc-500">Total</span>
        <span className="text-base font-bold text-amber-400">
          ₱{total.toLocaleString("en-PH", { minimumFractionDigits: 2 })}
        </span>
      </div>

      <p className="text-[11px] text-zinc-600">
        Editing resets the owner's acceptance — they'll need to confirm the revised price again.
      </p>

      {error && (
        <p className="text-xs text-orange-400 bg-orange-500/[0.07] rounded-lg px-3 py-2">{error}</p>
      )}

      <div className="flex gap-2">
        <button
          onClick={onCancel}
          disabled={submitting}
          className="flex-1 py-2.5 rounded-xl border border-white/[0.08] text-zinc-400
            text-sm font-medium disabled:opacity-40">
          Cancel
        </button>
        <button
          onClick={handleSubmit}
          disabled={submitting}
          className="flex-1 py-2.5 rounded-xl bg-amber-400 text-zinc-900 text-sm font-bold
            active:scale-[0.98] transition-all disabled:opacity-50">
          {submitting ? "Updating…" : "Update Estimate"}
        </button>
      </div>
    </div>
  );
}

// ── Active Job Card ───────────────────────────────────────────────────────────

const JOB_STEPS = ["ESTIMATE_ACCEPTED", "EN_ROUTE", "IN_PROGRESS"] as const;
const JOB_LABELS: Record<string, string> = {
  ESTIMATE_ACCEPTED: "Confirmed",
  EN_ROUTE: "En Route",
  IN_PROGRESS: "Working",
};
const NEXT_LABEL: Record<string, string> = {
  ESTIMATE_ACCEPTED: "Start En Route",
  EN_ROUTE: "Arrived — Start Job",
  IN_PROGRESS: "Mark Complete",
};

// ── Job Payment Strip ─────────────────────────────────────────────────────────
// Self-fetching, same pattern as the shop dashboard's PaymentStatusStrip —
// keeps ActiveJobCard from needing payment fields threaded all the way
// through the props chain. Only rendered for DONE jobs.

const MANUALLY_CONFIRMED = ["CASH", "GCASH_DIRECT", "MAYA_DIRECT"];

function JobPaymentStrip({ bookingId }: { bookingId: string }) {
  const [payment, setPayment] = useState<DisplayPayment | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    getPayment(bookingId)
      .then((p) => { if (!cancelled) setPayment(p); })
      .catch(() => { /* best-effort — leave the card without this strip on error */ })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [bookingId]);

  if (loading) {
    return <p className="text-xs text-zinc-600 text-center py-2">Checking payment status…</p>;
  }

  if (payment?.status === "PAID") {
    return (
      <div className="px-3 py-2.5 rounded-xl bg-emerald-400/10 border border-emerald-400/20
        text-xs font-semibold text-emerald-400 text-center">
        Paid {payment.method === "CASH" ? "in cash" : payment.method === "GCASH_DIRECT" ? "directly via GCash" : payment.method === "MAYA_DIRECT" ? "directly via Maya" : `via ${payment.paidVia ?? "online"}`}
      </div>
    );
  }

  if (payment?.method && MANUALLY_CONFIRMED.includes(payment.method) && payment.status === "PENDING") {
    return (
      <div className="space-y-2">
        {payment.ownerMarkedSentAt && (payment.method === "GCASH_DIRECT" || payment.method === "MAYA_DIRECT") && (
          <p className="text-[11px] text-amber-400 text-center">
            Owner marked this as sent — check your {payment.method === "GCASH_DIRECT" ? "GCash" : "Maya"} account.
          </p>
        )}
        <ConfirmCashPaymentButton bookingId={bookingId} method={payment.method as "CASH" | "GCASH_DIRECT" | "MAYA_DIRECT"} />
      </div>
    );
  }

  if (payment?.method === "ONLINE" && payment.status === "PENDING") {
    return (
      <div className="px-3 py-2.5 rounded-xl bg-white/[0.03] border border-white/[0.07]
        text-xs text-zinc-500 text-center">
        Waiting on the owner's online payment
      </div>
    );
  }

  // No payment row / no method chosen yet — owner hasn't picked cash vs
  // online vs direct in their invoice card.
  return (
    <div className="px-3 py-2.5 rounded-xl bg-white/[0.03] border border-white/[0.07]
      text-xs text-zinc-500 text-center">
      Waiting for the owner to choose a payment method
    </div>
  );
}

function ActiveJobCard({
  job,
  onAdvanceStatus,
}: {
  job: ActiveJob;
  onAdvanceStatus: (id: string) => void;
}) {
  const router = useRouter();
  const isDone = job.status === "DONE";
  const stepIndex = JOB_STEPS.indexOf(job.status as (typeof JOB_STEPS)[number]);

  return (
    <div
      className={`mb-5 rounded-2xl border bg-white/[0.03] p-5 ${
        isDone ? "border-blue-400/25" : "border-white/[0.09] ring-1 ring-emerald-400/10"
      }`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${isDone ? "bg-blue-400" : "bg-emerald-400 animate-pulse"}`} />
          <span className="text-sm font-semibold text-zinc-100">
            {isDone ? "Payment Pending" : "Active Job"}
          </span>
        </div>
        <span
          className="text-[11px] text-zinc-500 font-mono bg-white/[0.04]
          px-2.5 py-1 rounded-lg border border-white/[0.06]">
          {job.id.slice(0, 10).toUpperCase()}
        </span>
      </div>

      {/* Client row */}
      <div className="flex items-center gap-3 mb-5">
        <div
          className="w-12 h-12 rounded-xl bg-amber-400/10 border border-amber-400/20
          flex items-center justify-center shrink-0">
          <span className="text-sm font-bold text-amber-400">
            {job.ownerInitials}
          </span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-zinc-100 text-sm">{job.ownerName}</p>
          <p className="text-xs text-zinc-500 truncate">{job.vehicleLabel}</p>
          <p className="text-xs text-zinc-600 truncate mt-0.5">{job.problem}</p>
        </div>
        <div className="text-right shrink-0">
          <p className="font-bold text-zinc-100">{job.price}</p>
          <p className="text-[11px] text-zinc-500 mt-0.5">{isDone ? "Total" : "Est. price"}</p>
        </div>
      </div>

      {isDone ? (
        // Job is finished — no progress bar, no advance/track buttons. Just
        // the payment state, so this card has a reason to keep existing
        // instead of vanishing the moment status hit DONE.
        <JobPaymentStrip bookingId={job.id} />
      ) : (
        <>
          {/* Progress steps */}
          <div className="mb-5">
            <div className="flex items-center mb-2">
              {JOB_STEPS.map((step, i) => (
                <div
                  key={step}
                  className="flex items-center flex-1 last:flex-none">
                  <div
                    className={[
                      "w-6 h-6 rounded-full flex items-center justify-center shrink-0",
                      "text-[10px] font-bold transition-all",
                      i < stepIndex
                        ? "bg-amber-400 text-[#080909]"
                        : i === stepIndex
                          ? "bg-amber-400/15 border-2 border-amber-400 text-amber-400"
                          : "bg-white/[0.05] text-zinc-600 border border-white/[0.08]",
                    ].join(" ")}>
                    {i < stepIndex ? (
                      <svg
                        width="10"
                        height="10"
                        viewBox="0 0 12 12"
                        fill="none">
                        <path
                          d="M2 6L5 9L10 3"
                          stroke="#080909"
                          strokeWidth="1.8"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    ) : (
                      i + 1
                    )}
                  </div>
                  {i < JOB_STEPS.length - 1 && (
                    <div
                      className={[
                        "flex-1 h-[2px] mx-1 transition-all",
                        i < stepIndex ? "bg-amber-400" : "bg-white/[0.07]",
                      ].join(" ")}
                    />
                  )}
                </div>
              ))}
            </div>
            <div className="flex justify-between">
              {JOB_STEPS.map((step, i) => (
                <span
                  key={step}
                  className={[
                    "text-[9px] leading-tight",
                    i === stepIndex
                      ? "text-amber-400 font-semibold"
                      : "text-zinc-600",
                  ].join(" ")}>
                  {JOB_LABELS[step]}
                </span>
              ))}
            </div>
          </div>

          {/* Notes (optional) */}
          {job.notes && (
            <div
              className="flex items-start gap-2 mb-4 px-3 py-2.5 rounded-xl
              bg-white/[0.03] border border-white/[0.07]">
              <svg
                width="13"
                height="13"
                viewBox="0 0 24 24"
                fill="none"
                className="mt-0.5 shrink-0"
                aria-hidden="true">
                <path
                  d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"
                  stroke="#71717A"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
                <path
                  d="M14 2v6h6M16 13H8M16 17H8"
                  stroke="#71717A"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
              </svg>
              <span className="text-xs text-zinc-400 line-clamp-2">
                {job.notes}
              </span>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex gap-2">
            {/* message client */}
            <button
              aria-label="Message Client"
              className="w-10 h-10 rounded-xl bg-white/[0.04] border border-white/[0.08] flex items-center justify-center hover:bg-white/[0.08] transition-colors shrink-0">
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                aria-hidden="true">
                <path
                  d="M2.003 5.884L10 12.882l7.997-6.998A2 2 0 0 0 16 4H4a2 2 0 0 0-1.997 1.884z M2 6.118v7.764A2 2 0 0 0 4 16h12a2 2 0 0 0 2-2V6.118l-8 7-8-7z"
                  stroke="#71717A"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>

            {/* Track button */}
            <button
              onClick={() => router.push(`/dashboard/mechanic/tracking/${job.id}`)}
              aria-label="Share location"
              className="w-11 h-11 rounded-xl bg-emerald-400/10 border border-emerald-400/20
                flex items-center justify-center hover:bg-emerald-400/15 transition-colors shrink-0">
              <svg
                width="15"
                height="15"
                viewBox="0 0 24 24"
                fill="none"
                aria-hidden="true">
                <path
                  d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"
                  stroke="#34D399"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <circle
                  cx="12"
                  cy="10"
                  r="3"
                  stroke="#34D399"
                  strokeWidth="1.6"
                />
              </svg>
            </button>

            {/* Advance status */}
            {job.status === "IN_PROGRESS" ? (
              <button
                onClick={() => onAdvanceStatus(job.id)}
                className="flex-1 py-2.5 rounded-xl bg-emerald-500 text-sm font-bold text-black
                  hover:bg-emerald-400 active:scale-[0.98] transition-all
                  shadow-[0_4px_20px_rgba(52,211,153,0.2)]">
                Mark Complete ✓
              </button>
            ) : job.status === "EN_ROUTE" && job.isEmergency ? (
              // Emergency jobs auto-advance EN_ROUTE -> IN_PROGRESS via the
              // geofence check on the tracking page once the mechanic is within
              // range — no manual tap needed or offered here for this specific
              // transition. Still shows something (not an empty gap) so it's
              // clear this isn't a missing button, it's intentional.
              <div className="flex-1 py-2.5 rounded-xl bg-orange-500/10 border border-orange-500/25
                flex items-center justify-center gap-1.5">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"
                    stroke="#FB923C" strokeWidth="1.6" />
                  <circle cx="12" cy="10" r="3" stroke="#FB923C" strokeWidth="1.6" />
                </svg>
                <span className="text-xs text-orange-300 font-semibold">Auto-starts on arrival</span>
              </div>
            ) : (
              <button
                onClick={() => onAdvanceStatus(job.id)}
                className="flex-1 py-2.5 rounded-xl bg-amber-500 text-sm font-bold text-black
                  hover:bg-amber-400 active:scale-[0.98] transition-all
                  shadow-[0_4px_20px_rgba(245,158,11,0.2)]">
                {NEXT_LABEL[job.status]}
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function GenerateInvoiceModal({
  isOpen,
  job,
  onClose,
}: {
  isOpen: boolean;
  job: ActiveJob | null;
  onClose: () => void;
}) {
  const [items, setItems] = useState<InvoiceLineItem[]>([
    { description: "Labor", quantity: 1, unitPrice: 0 },
  ]);
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function updateItem(index: number, patch: Partial<InvoiceLineItem>) {
    setItems((prev) =>
      prev.map((item, i) => (i === index ? { ...item, ...patch } : item)),
    );
  }

  function addItem() {
    setItems((prev) => [
      ...prev,
      { description: "", quantity: 1, unitPrice: 0 },
    ]);
  }

  function removeItem(index: number) {
    setItems((prev) => prev.filter((_, i) => i !== index));
  }

  const total = items.reduce((sum, i) => sum + i.quantity * i.unitPrice, 0);

  async function handleSubmit() {
    if (!job) return;
    const validItems = items.filter(
      (i) => i.description.trim() && i.unitPrice > 0,
    );
    if (validItems.length === 0) {
      setError("Add at least one line item with a description and price.");
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      await generateInvoice(job.id, validItems, notes || undefined);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not generate invoice");
    } finally {
      setSubmitting(false);
    }
  }

  if (!isOpen || !job) return null;

  return (
  <div className="fixed inset-0 z-50 flex items-center sm:items-center sm:justify-center">
    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
    <div
      className="relative w-full sm:max-w-md bg-[#0c0d0e] border border-white/[0.08]
      rounded-t-3xl sm:rounded-3xl max-h-[90dvh] flex flex-col">

      {/* Scrollable content */}
      <div className="overflow-y-auto p-6 space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-zinc-100">
            Generate Invoice
          </h2>
          <p className="text-sm text-zinc-500 mt-1">
            {job.vehicleLabel} · {job.ownerName}
          </p>
        </div>

        <div className="space-y-2.5">
          {items.map((item, i) => (
            <div key={i} className="flex gap-2 items-start">
              <input
                placeholder="Description (e.g. Labor, Spark plugs)"
                value={item.description}
                onChange={(e) => updateItem(i, { description: e.target.value })}
                className="flex-1 px-3 py-2 rounded-xl bg-white/[0.04] border border-white/[0.08]
                  text-zinc-100 text-sm placeholder:text-zinc-600 outline-none focus:border-amber-400/50"
              />
              <input
                type="number"
                min="1"
                value={item.quantity}
                onChange={(e) =>
                  updateItem(i, { quantity: Number(e.target.value) || 1 })
                }
                className="w-14 px-2 py-2 rounded-xl bg-white/[0.04] border border-white/[0.08]
                  text-zinc-100 text-sm outline-none focus:border-amber-400/50"
              />
              <input
                type="number"
                min="0"
                step="0.01"
                placeholder="₱"
                value={item.unitPrice || ""}
                onChange={(e) =>
                  updateItem(i, { unitPrice: Number(e.target.value) || 0 })
                }
                className="w-20 px-2 py-2 rounded-xl bg-white/[0.04] border border-white/[0.08]
                  text-zinc-100 text-sm placeholder:text-zinc-600 outline-none focus:border-amber-400/50"
              />
              {items.length > 1 && (
                <button
                  onClick={() => removeItem(i)}
                  className="text-zinc-600 hover:text-red-400 px-1 py-2 text-sm">
                  ✕
                </button>
              )}
            </div>
          ))}
          <button onClick={addItem} className="text-xs text-amber-400 font-medium">
            + Add line item
          </button>
        </div>

        <textarea
          rows={2}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Notes (optional)"
          className="w-full px-3 py-2 rounded-xl bg-white/[0.04] border border-white/[0.08]
            text-zinc-100 text-sm placeholder:text-zinc-600 outline-none resize-none focus:border-amber-400/50"
        />

        {error && (
          <p className="text-xs text-orange-400 bg-orange-500/[0.07] rounded-lg px-3 py-2">
            {error}
          </p>
        )}
      </div>

      {/* Sticky footer — always visible, never scrolls out of reach */}
      <div className="shrink-0 border-t border-white/[0.08] p-6 pt-4 space-y-3 bg-[#0c0d0e]">
        <div className="flex justify-between items-center">
          <span className="text-sm text-zinc-400">Total</span>
          <span className="text-lg font-bold text-amber-400">
            ₱{total.toLocaleString("en-PH", { minimumFractionDigits: 2 })}
          </span>
        </div>
        <button
          onClick={handleSubmit}
          disabled={submitting}
          className="w-full py-3 rounded-2xl bg-amber-400 text-zinc-900 text-sm font-bold
            active:scale-[0.98] transition-all disabled:opacity-50">
          {submitting ? "Generating..." : "Generate Invoice"}
        </button>
      </div>
    </div>
  </div>
);
}

// ── No Active Job ─────────────────────────────────────────────────────────────

function NoActiveJob() {
  return (
    <div
      className="w-full bg-white/[0.02] border border-white/[0.06] border-dashed
      rounded-2xl p-5 mb-5 flex flex-col items-center text-center gap-2">
      <div
        className="w-10 h-10 rounded-xl bg-white/[0.04] border border-white/[0.08]
        flex items-center justify-center mb-1">
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden="true">
          <path
            d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"
            stroke="#52525B"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
          <path
            d="M14 2v6h6M16 13H8M16 17H8M10 9H8"
            stroke="#52525B"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>
      </div>
      <p className="text-sm font-semibold text-zinc-400">No active job</p>
      <p className="text-xs text-zinc-600">Waiting for incoming requests</p>
    </div>
  );
}

// ── Upcoming Jobs ─────────────────────────────────────────────────────────────

function UpcomingJobsSection({ jobs }: { jobs: UpcomingJob[] }) {
  if (jobs.length === 0) return null;

  return (
    <div className="mb-5">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-semibold text-zinc-100">
          Upcoming Jobs
        </span>
        <span className="text-[11px] text-zinc-500">
          {jobs.length} scheduled
        </span>
      </div>

      <div className="flex flex-col gap-2">
        {jobs.map((job, idx) => (
          <div
            key={job.id}
            className="flex items-center gap-3 px-4 py-3.5 rounded-2xl
              bg-white/[0.03] border border-white/[0.07]">
            {/* Index badge */}
            <div
              className="w-7 h-7 rounded-lg bg-white/[0.05] border border-white/[0.08]
              flex items-center justify-center text-[11px] font-bold text-zinc-500 shrink-0">
              {idx + 1}
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-zinc-200 truncate">
                {job.ownerName}
              </p>
              <p className="text-xs text-zinc-500 truncate">
                {job.vehicleLabel} · {job.problem}
              </p>
            </div>

            {/* Time + price */}
            <div className="text-right shrink-0">
              <p className="text-xs font-semibold text-amber-400">
                {job.scheduledAt}
              </p>
              <p className="text-[11px] text-zinc-600 mt-0.5">{job.price}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Earnings Summary ──────────────────────────────────────────────────────────

function EarningsSummary({ stats }: { stats: MechanicStats }) {
  const periods = [
    { label: "Today", value: "₱0", sub: "0 jobs" },
    {
      label: "This Week",
      value: stats.weekEarnings,
      sub: `${stats.todayJobs} jobs`,
    },
    { label: "This Month", value: "₱0", sub: "0 jobs" },
  ];

  return (
    <div className="mb-5">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-semibold text-zinc-100">Earnings</span>
        <button className="text-xs text-amber-400 hover:text-amber-300 transition-colors">
          Full history
        </button>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {periods.map(({ label, value, sub }) => (
          <div
            key={label}
            className="flex flex-col items-center gap-1 py-3.5 rounded-2xl
              bg-white/[0.03] border border-white/[0.07]">
            <p className="text-base font-bold text-zinc-100">{value}</p>
            <p className="text-[10px] text-zinc-600">{label}</p>
            <p className="text-[10px] text-zinc-700">{sub}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Recent Reviews ────────────────────────────────────────────────────────────

function RecentReviewsSection({
  reviews,
  stats,
}: {
  reviews: RecentReview[];
  stats: MechanicStats;
}) {
  return (
    <div className="mb-5">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-zinc-100">
            Ratings & Reviews
          </span>
        </div>
        <button className="text-xs text-amber-400 hover:text-amber-300 transition-colors">
          See all
        </button>
      </div>

      {/* Summary bar */}
      <div
        className="flex items-center gap-4 mb-3 px-4 py-3.5 rounded-2xl
        bg-white/[0.03] border border-white/[0.07]">
        <div className="text-center">
          <p className="text-3xl font-black text-zinc-100 leading-none mb-1">
            {stats.avgRating > 0 ? stats.avgRating.toFixed(1) : "—"}
          </p>
          <StarRating
            value={stats.avgRating}
            size={10}
          />
          <p className="text-[10px] text-zinc-600 mt-1">
            {stats.totalReviews} reviews
          </p>
        </div>

        {/* Mini bar chart */}
        <div className="flex-1 flex flex-col gap-1">
          {[5, 4, 3, 2, 1].map((star) => (
            <div
              key={star}
              className="flex items-center gap-1.5">
              <span className="text-[10px] text-zinc-600 w-2">{star}</span>
              <div className="flex-1 h-1.5 rounded-full bg-white/[0.05] overflow-hidden">
                <div
                  className="h-full rounded-full bg-amber-400/60"
                  style={{
                    width:
                      star === Math.round(stats.avgRating)
                        ? "60%"
                        : star > Math.round(stats.avgRating)
                          ? "10%"
                          : "25%",
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Review list */}
      {reviews.length === 0 ? (
        <p className="text-xs text-zinc-600 text-center py-4">No reviews yet</p>
      ) : (
        <div className="flex flex-col gap-2.5">
          {reviews.map((r, i) => (
            <div
              key={i}
              className="px-4 py-3.5 rounded-2xl bg-white/[0.03] border border-white/[0.07]">
              <div className="flex items-center gap-2.5 mb-2">
                <div
                  className="w-8 h-8 rounded-xl bg-zinc-800 flex items-center justify-center
                  text-[11px] font-bold text-zinc-400 shrink-0">
                  {r.ownerInitials}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-zinc-300 truncate">
                    {r.ownerName}
                  </p>
                  <StarRating
                    value={r.rating}
                    size={9}
                  />
                </div>
                <span className="text-[10px] text-zinc-600 shrink-0">
                  {r.date}
                </span>
              </div>
              {r.comment && (
                <p className="text-xs text-zinc-500 leading-relaxed line-clamp-2">
                  {r.comment}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Bottom Nav ────────────────────────────────────────────────────────────────

const NAV_ITEMS = [
  {
    label: "Home",
    href: "/dashboard/mechanic",
    icon: "M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z M9 22V12h6v10",
  },
  {
    label: "Jobs",
    href: "/dashboard/mechanic/jobs",
    icon: "M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2M9 5a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2M9 5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2m-6 9l2 2 4-4",
  },
  {
    label: "Chats",
    href: "/dashboard/mechanic/chats",
    icon: "M2.003 5.884L10 12.882l7.997-6.998A2 2 0 0 0 16 4H4a2 2 0 0 0-1.997 1.884z M2 6.118v7.764A2 2 0 0 0 4 16h12a2 2 0 0 0 2-2V6.118l-8 7-8-7z",
  },
  {
    label: "Profile",
    href: "/dashboard/mechanic/profile",
    icon: "M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2 M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z",
  },
] as const;

export function BottomNav() {
  const router = useRouter();
  const [active, setActive] = useState<string>("Home");

  function handleNav(label: string, href: string) {
    setActive(label);
    router.push(href);
  }

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50
      bg-[#080909]/95 backdrop-blur-xl border-t border-white/[0.06]">
      <div className="max-w-2xl mx-auto flex items-center justify-around px-2 py-3 pb-5">
        {NAV_ITEMS.map(({ label, href, icon }) => {
          const isActive = active === label;
          return (
            <button
              key={label}
              aria-label={label}
              aria-current={isActive ? "page" : undefined}
              onClick={() => handleNav(label, href)}
              className="flex flex-col items-center gap-1.5 px-4 py-1 rounded-xl
                transition-all active:scale-95">
              <svg
                width="22"
                height="22"
                viewBox="0 0 24 24"
                fill="none"
                stroke={isActive ? "#F59E0B" : "#52525B"}
                strokeWidth="1.7"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true">
                <path d={icon} />
              </svg>
              <span
                className={`text-[10px] font-medium leading-none
                ${isActive ? "text-amber-400" : "text-zinc-600"}`}>
                {label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

interface MechanicDashboardProps {
  mechanic: SessionMechanic;
  stats: MechanicStats;
  incomingRequests: IncomingRequest[];
  needsEstimateJobs: NeedsEstimateJob[];
  awaitingEstimateJobs: AwaitingEstimateJob[];
  activeJob: ActiveJob | null;
  doneUnpaidJobs: ActiveJob[];
  upcomingJobs: UpcomingJob[];
  recentReviews: RecentReview[];
}

export default function MechanicDashboardView({
  mechanic,
  stats,
  incomingRequests: initialRequests,
  needsEstimateJobs,
  awaitingEstimateJobs,
  activeJob: initialActiveJob,
  doneUnpaidJobs: initialDoneUnpaidJobs,
  upcomingJobs,
  recentReviews,
}: MechanicDashboardProps) {
  const router = useRouter();
  const [requests, setRequests] = useState(initialRequests);
  const [activeJob, setActiveJob] = useState(initialActiveJob);
  const [doneUnpaidJobs, setDoneUnpaidJobs] = useState(initialDoneUnpaidJobs);
  const [invoiceModalOpen, setInvoiceModalOpen] = useState(false);
  const [invoicingJob, setInvoicingJob] = useState<ActiveJob | null>(null);
  const [isPending, startTransition] = useTransition();

  // Poll for fresh server data every 6s, so the owner accepting/advancing
  // a booking (or a new emergency request coming in) shows up here without
  // a manual page refresh.
  usePolling(6000);

  // router.refresh() (triggered by polling, or after any action below)
  // re-fetches initialRequests/initialActiveJob from the server, but
  // useState only uses its initial value on mount — these effects re-sync
  // local state to the fresh props whenever they change.
  useEffect(() => {
    setRequests(initialRequests);
  }, [initialRequests]);

  useEffect(() => {
    setActiveJob(initialActiveJob);
  }, [initialActiveJob]);

  useEffect(() => {
    setDoneUnpaidJobs(initialDoneUnpaidJobs);
  }, [initialDoneUnpaidJobs]);

  async function handleAccept(id: string) {
    const req = requests.find((r) => r.id === id);
    if (!req) return;

    // Optimistic: remove from incoming list
    setRequests((prev) => prev.filter((r) => r.id !== id));

    startTransition(async () => {
      try {
        await acceptBooking(id);
        router.refresh(); // re-fetches server data → activeJob appears
      } catch {
        // Roll back on failure
        setRequests((prev) => [req, ...prev]);
      }
    });
  }

  async function handleDecline(id: string) {
    const req = requests.find((r) => r.id === id);
    if (!req) return;

    // Optimistic: remove from incoming list
    setRequests((prev) => prev.filter((r) => r.id !== id));

    startTransition(async () => {
      try {
        await declineBooking(id);
        router.refresh();
      } catch {
        // Roll back on failure
        setRequests((prev) => [req, ...prev]);
      }
    });
  }

  function handleInvoiceModalClose() {
    setInvoiceModalOpen(false);
    setInvoicingJob(null);
    router.refresh(); // now safe — invoice exists (or was skipped), card can clear
  }

  async function handleAdvanceStatus(id: string) {
    const NEXT: Record<string, ActiveJob["status"]> = {
      ESTIMATE_ACCEPTED: "EN_ROUTE",
      EN_ROUTE: "IN_PROGRESS",
      IN_PROGRESS: "IN_PROGRESS",
    };

    // Is this click the final step (IN_PROGRESS → DONE)? Capture the job
    // before any state changes, since we'll need it after activeJob may
    // already be stale/cleared.
    const isFinalStep = activeJob?.status === "IN_PROGRESS";
    const jobSnapshot = activeJob;

    // Optimistic status bump
    setActiveJob((prev) =>
      prev ? { ...prev, status: NEXT[prev.status] ?? prev.status } : prev,
    );

    startTransition(async () => {
      try {
        await advanceBookingStatus(id);

        if (isFinalStep && jobSnapshot) {
          // Job is now DONE. Don't refresh yet — the activeJob query excludes
          // DONE bookings, so refreshing now would clear the card before the
          // mechanic gets a chance to generate an invoice. Open the invoice
          // form instead; refresh happens when that modal closes.
          setInvoicingJob(jobSnapshot);
          setInvoiceModalOpen(true);
        } else {
          router.refresh();
        }
      } catch {
        router.refresh(); // on error, re-sync with DB truth
      }
    });
  }

  return (
    <div className="min-h-screen w-full bg-[#080909] relative">
      {/* Background decoration — identical to owner dashboard */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 overflow-hidden">
        <div
          className="absolute -top-40 left-1/2 -translate-x-1/2 w-[800px] h-[500px]
          bg-amber-400/[0.025] rounded-full blur-[130px]"
        />
        <div
          className="absolute inset-0 opacity-[0.012]"
          style={{
            backgroundImage:
              "radial-gradient(circle, #F59E0B 1px, transparent 1px)",
            backgroundSize: "28px 28px",
          }}
        />
      </div>

      <div className="relative z-10 w-full h-full p-4 pb-28">
        <Header mechanic={mechanic} />
        <StatsStrip stats={stats} />

        <IncomingRequestsSection
          requests={requests}
          onAccept={handleAccept}
          onDecline={handleDecline}
        />

        <NeedsEstimateSection
          jobs={needsEstimateJobs}
          onSubmitted={() => router.refresh()}
        />

        <AwaitingEstimateSection jobs={awaitingEstimateJobs} />

        {activeJob ? (
          <ActiveJobCard
            job={activeJob}
            onAdvanceStatus={handleAdvanceStatus}
          />
        ) : doneUnpaidJobs.length === 0 ? (
          <NoActiveJob />
        ) : null}

        {doneUnpaidJobs.map((job) => (
          <ActiveJobCard
            key={job.id}
            job={job}
            onAdvanceStatus={handleAdvanceStatus}
          />
        ))}

        <UpcomingJobsSection jobs={upcomingJobs} />

        <GenerateInvoiceModal
          isOpen={invoiceModalOpen}
          job={invoicingJob}
          onClose={handleInvoiceModalClose}
        />

        <EarningsSummary stats={stats} />

        <RecentReviewsSection
          reviews={recentReviews}
          stats={stats}
        />
      </div>

      <BottomNav />
    </div>
  );
}