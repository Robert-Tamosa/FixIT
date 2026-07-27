"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useEffect, useRef, useCallback, useTransition } from "react";
import { usePolling } from "@/app/hooks/usePolling";

const BookingModalLazy = dynamic(
  () => import("./bookingModal").then((m) => m.BookingModal),
  { ssr: false }
);

const EmergencyModalLazy = dynamic(
  () => import("./emergencyModal").then((m) => m.EmergencyModal),
  { ssr: false }
);

// ── Exported types (imported by page.tsx for transformation) ──────────────────

export interface SessionUser {
  id: string;
  name: string;
  email: string;
  image?: string | null;
  phone?: string | null;
}

export interface DisplayBooking {
  id: string;
  mechanicName: string;
  mechanicInitials: string | null;
  mechanicRating: number;
  service: string; // problemDescription from DB
  status: "PENDING" | "CONFIRMED" | "ESTIMATE_ACCEPTED" | "EN_ROUTE" | "IN_PROGRESS" | "DONE";
  scheduledAt: string | null; // pre-formatted string from page.tsx
  price: string; // e.g. "₱850" or "TBD"
  vehicleLabel: string; // e.g. "Toyota Vios"
}

export interface DisplayEstimateReview {
  id: string;
  mechanicName: string;
  mechanicInitials: string | null;
  vehicleLabel: string;
  service: string;
  laborCost: number;
  partsCost: number;
  totalCost: number;
  notes: string | null;
}

export interface DisplayMechanic {
  id: string;
  name: string;
  initials: string;
  specialty: string;
  rating: number;
  reviews: number;
  available: boolean;
}

export interface DisplayVehicle {
  id:    string;
  label: string;
}

interface SearchResult {
  id:             string;
  name:           string;
  initials:       string;
  specialization: string;
  rating:         number;
  reviews:        number;
  available:      boolean;
}

// ── Step config (drives ActiveBookingCard's progress bar only — PENDING and
//    CONFIRMED never reach this component, they render as PendingBookingCard
//    instead, so they don't belong in this progression) ─────────────────────

const STEPS = [
  "ESTIMATE_ACCEPTED",
  "EN_ROUTE",
  "IN_PROGRESS",
  "DONE",
] as const;
const LABELS: Record<string, string> = {
  ESTIMATE_ACCEPTED: "Confirmed",
  EN_ROUTE: "En Route",
  IN_PROGRESS: "Active",
  DONE: "Done",
};

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

function StarRating({ value }: { value: number }) {
  return (
    <div className="flex items-center gap-1">
      <svg
        width="11"
        height="11"
        viewBox="0 0 24 24"
        fill="#F59E0B"
        aria-hidden="true">
        <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
      </svg>
      <span className="text-xs font-semibold text-zinc-200">
        {value > 0 ? value.toFixed(1) : "—"}
      </span>
    </div>
  );
}

// ── Header ────────────────────────────────────────────────────────────────────

function Header({
  user,
  onBookMechanic,
}: {
  user:           SessionUser;
  onBookMechanic: (mechanicId: string, mechanicName: string) => void;
}) {
  const h         = new Date().getHours();
  const greeting  = h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
  const firstName = user.name.split(" ")[0];
  const initials  = getInitials(user.name);

  const [query,   setQuery]   = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [isOpen,  setIsOpen]  = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef  = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchResults = useCallback(async (q: string) => {
    setLoading(true);
    try {
      const res  = await fetch(`/api/mechanic/search?q=${encodeURIComponent(q)}&available=false`);
      const data = (await res.json()) as { results?: SearchResult[] };
      setResults(data.results ?? []);
      setIsOpen(true);
    } catch { setResults([]); }
    finally  { setLoading(false); }
  }, []);

  useEffect(() => {
    if (!query.trim()) { setResults([]); setIsOpen(false); return; }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => { void fetchResults(query); }, 350);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query, fetchResults]);

  useEffect(() => {
    function onOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", onOutside);
    return () => document.removeEventListener("mousedown", onOutside);
  }, []);

  return (
    <div className="mb-6">
      {/* Top row */}
      <div className="flex items-center justify-between mb-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden="true">
              <path d="M10 2L4 4.5V10.5C4 14.7 6.8 18.5 10 19.5C13.2 18.5 16 14.7 16 10.5V4.5L10 2Z"
                fill="#F59E0B" fillOpacity="0.25" stroke="#F59E0B" strokeWidth="1.2" />
              <path d="M7.5 10.5L9.5 12.5L13.5 8.5"
                stroke="#F59E0B" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
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
          <button aria-label="Notifications"
            className="relative w-10 h-10 rounded-xl bg-white/[0.04] border border-white/[0.08]
              flex items-center justify-center hover:bg-white/[0.07] transition-colors">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"
                stroke="#71717A" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M13.73 21a2 2 0 0 1-3.46 0"
                stroke="#71717A" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
            <span className="absolute top-2 right-2 w-2 h-2 bg-amber-400 rounded-full border-2 border-[#080909]" />
          </button>
          <div className="w-10 h-10 rounded-xl bg-amber-400/10 border border-amber-400/20
            flex items-center justify-center">
            <span className="text-[11px] font-bold text-amber-400">{initials}</span>
          </div>
        </div>
      </div>
      {/* Search bar + dropdown */}
      <div className="relative w-full" ref={containerRef}>
        <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none z-10"
          width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <circle cx="11" cy="11" r="8" stroke="#52525B" strokeWidth="1.8" />
          <path d="M21 21l-4.35-4.35" stroke="#52525B" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => { if (results.length > 0) setIsOpen(true); }}
          placeholder="Search mechanics, services…"
          className="w-full pl-10 pr-4 py-2.5 rounded-xl
            bg-white/[0.04] border border-white/[0.08]
            text-sm text-zinc-200 placeholder:text-zinc-600
            focus:outline-none focus:border-amber-400/40 focus:bg-white/[0.06]
            transition-colors"
        />

        {/* ── Dropdown ── */}
        {isOpen && (
          <div className="absolute top-full left-0 right-0 mt-2 z-50
            bg-[#12141A] border border-white/[0.09] rounded-2xl
            shadow-[0_8px_40px_rgba(0,0,0,0.6)] overflow-hidden">
            {loading ? (
              <div className="divide-y divide-white/[0.05]">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="flex items-center gap-3 px-4 py-3.5 animate-pulse">
                    <div className="w-9 h-9 rounded-xl bg-white/[0.06] shrink-0" />
                    <div className="flex-1 space-y-1.5">
                      <div className="h-3 w-28 bg-white/[0.06] rounded" />
                      <div className="h-2.5 w-20 bg-white/[0.04] rounded" />
                    </div>
                  </div>
                ))}
              </div>
            ) : results.length === 0 ? (
              <p className="px-4 py-5 text-sm text-zinc-500 text-center">
                No mechanics found for &quot;{query}&quot;
              </p>
            ) : (
              <div>
                <div className="divide-y divide-white/[0.05]">
                  {results.slice(0, 5).map((m) => (
                    <div key={m.id}
                      className="flex items-center gap-3 px-4 py-3
                        hover:bg-white/[0.04] transition-colors">
                      {/* Avatar */}
                      <div className={[
                        "w-9 h-9 rounded-xl flex items-center justify-center shrink-0 text-xs font-bold",
                        m.available
                          ? "bg-amber-400/10 border border-amber-400/20 text-amber-400"
                          : "bg-white/[0.05] border border-white/[0.08] text-zinc-500",
                      ].join(" ")}>
                        {m.initials}
                      </div>
                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <p className="text-sm font-semibold text-zinc-100 truncate">{m.name}</p>
                          <span className={`shrink-0 w-1.5 h-1.5 rounded-full ${
                            m.available ? "bg-emerald-400" : "bg-zinc-600"
                          }`} />
                        </div>
                        <p className="text-xs text-zinc-500 truncate">{m.specialization}</p>
                      </div>
                      {/* Rating + Book */}
                      <div className="flex items-center gap-2 shrink-0">
                        {m.rating > 0 && (
                          <span className="text-[11px] text-zinc-400 flex items-center gap-0.5">
                            <svg width="10" height="10" viewBox="0 0 24 24"
                              fill="#F59E0B" aria-hidden="true">
                              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                            </svg>
                            {m.rating}
                          </span>
                        )}
                        <button
                          onClick={() => {
                            setIsOpen(false);
                            setQuery("");
                            onBookMechanic(m.id, m.name);
                          }}
                          className="text-[11px] font-bold text-[#080909]
                            bg-amber-400 hover:bg-amber-300
                            px-2.5 py-1 rounded-lg
                            transition-colors active:scale-95"
                        >
                          Book
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
                {results.length > 5 && (
                  <div className="border-t border-white/[0.05] px-4 py-3">
                    <a
                      href={`/dashboard/owner/search?q=${encodeURIComponent(query)}`}
                      className="text-xs text-amber-400 hover:text-amber-300 font-semibold"
                      onClick={() => setIsOpen(false)}
                    >
                      View all {results.length} results →
                    </a>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Action Buttons Row ────────────────────────────────────────────────────────

interface DispatchedInfo {
  mechanicName: string;
  etaMinutes: number;
  bookingId: string;
}

function ActionButtonsRow({
  onEmergency,
  onBookService,
  dispatched,
  onDismissDispatched,
}: {
  onEmergency: () => void;
  onBookService: () => void;
  dispatched: DispatchedInfo | null;
  onDismissDispatched: () => void;
}) {
  if (dispatched) {
    return (
      <div className="mb-5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 px-5 py-4
        flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-emerald-500/20 flex items-center justify-center shrink-0">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M20 6L9 17l-5-5" stroke="#34D399" strokeWidth="2"
              strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <div>
          <p className="text-sm font-semibold text-emerald-400">Help is on the way</p>
          <p className="text-xs text-zinc-500">
            {dispatched.mechanicName} dispatched · Est. {dispatched.etaMinutes} mins
          </p>
        </div>
        <button onClick={onDismissDispatched}
          className="ml-auto text-xs text-zinc-600 hover:text-zinc-400 transition-colors">
          Dismiss
        </button>
      </div>
    );
  }

  return (
    <div className="relative mb-5 flex gap-3">
      {/* Ping glow scoped to emergency half only */}
      <div aria-hidden="true"
        className="absolute inset-y-0 left-0 right-[calc(50%+6px)] rounded-2xl bg-red-500/15 animate-ping"
        style={{ animationDuration: "2.5s" }} />

      {/* Emergency */}
      <button
        onClick={onEmergency}
        className="relative flex-1 py-[18px] rounded-2xl
          bg-gradient-to-r from-red-600 to-rose-500 border border-red-500/30
          flex items-center justify-center gap-2.5
          active:scale-[0.98] transition-transform duration-100
          shadow-[0_6px_36px_rgba(239,68,68,0.28)]">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"
            fill="white" fillOpacity="0.15" stroke="white" strokeWidth="1.5"
            strokeLinecap="round" strokeLinejoin="round" />
          <line x1="12" y1="9"  x2="12"   y2="13"   stroke="white" strokeWidth="2"   strokeLinecap="round" />
          <line x1="12" y1="17" x2="12.01" y2="17"   stroke="white" strokeWidth="2.5" strokeLinecap="round" />
        </svg>
        <div className="text-left">
          <p className="text-white font-bold text-[13px] leading-tight">Emergency</p>
          <p className="text-white/55 text-[11px] mt-0.5">Get Help Now</p>
        </div>
      </button>

      {/* Book a Service */}
      <button
        onClick={onBookService}
        className="relative flex-1 py-[18px] rounded-2xl
          bg-gradient-to-r from-amber-500 to-yellow-400 border border-amber-400/30
          flex items-center justify-center gap-2.5
          active:scale-[0.98] transition-transform duration-100
          shadow-[0_6px_36px_rgba(245,158,11,0.22)]">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <rect x="3" y="4" width="18" height="18" rx="2"
            stroke="#080909" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          <line x1="16" y1="2"  x2="16" y2="6"  stroke="#080909" strokeWidth="1.6" strokeLinecap="round" />
          <line x1="8"  y1="2"  x2="8"  y2="6"  stroke="#080909" strokeWidth="1.6" strokeLinecap="round" />
          <line x1="3"  y1="10" x2="21" y2="10" stroke="#080909" strokeWidth="1.6" strokeLinecap="round" />
          <line x1="12" y1="14" x2="12" y2="18" stroke="#080909" strokeWidth="1.6" strokeLinecap="round" />
          <line x1="10" y1="16" x2="14" y2="16" stroke="#080909" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
        <div className="text-left">
          <p className="text-[#080909] font-bold text-[13px] leading-tight">Book a Service</p>
          <p className="text-black/50 text-[11px] mt-0.5">Schedule a mechanic</p>
        </div>
      </button>
    </div>
  );
}

// ── Active Booking Card ───────────────────────────────────────────────────────

function ActiveBookingCard({ booking }: { booking: DisplayBooking }) {
  const stepIndex = STEPS.indexOf(booking.status as (typeof STEPS)[number]);
  const router = useRouter();

  return (
    <div className="w-full bg-white/[0.03] border border-white/[0.08] rounded-2xl p-5 mb-4">
      {/* Title row */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
          <span className="text-sm font-semibold text-zinc-100">
            Active Booking
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-zinc-400">
            {booking.vehicleLabel}
          </span>
          <span
            className="text-[11px] text-zinc-500 font-mono bg-white/[0.04]
            px-2.5 py-1 rounded-lg border border-white/[0.06]">
            {booking.id.slice(0, 10).toUpperCase()}
          </span>
        </div>
      </div>

      {/* Mechanic row */}
      <div className="flex items-center gap-3 mb-5">
        <div
          className="w-12 h-12 rounded-xl bg-amber-400/10 border border-amber-400/20
          flex items-center justify-center shrink-0">
          <span className="text-sm font-bold text-amber-400">
            {booking.mechanicInitials}
          </span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-zinc-100 text-sm">
            {booking.mechanicName}
          </p>
          <p className="text-xs text-zinc-500 mt-0.5 truncate">
            {booking.service}
          </p>
        </div>
        <div className="text-right shrink-0">
          <p className="font-bold text-zinc-100">{booking.price}</p>
          <StarRating value={booking.mechanicRating} />
        </div>
      </div>

      {/* Progress steps */}
      <div className="mb-5">
        <div className="flex items-center mb-2">
          {STEPS.map((step, i) => (
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
              {i < STEPS.length - 1 && (
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
          {STEPS.map((step, i) => (
            <span
              key={step}
              className={[
                "text-[9px] leading-tight",
                i === stepIndex
                  ? "text-amber-400 font-semibold"
                  : "text-zinc-600",
              ].join(" ")}>
              {LABELS[step]}
            </span>
          ))}
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2">
        <div
          className="flex items-center gap-1.5 flex-1 px-3 py-2.5 rounded-xl
          bg-white/[0.03] border border-white/[0.07]">
          <svg
            width="13"
            height="13"
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
          <span className="text-xs text-zinc-400 truncate">
            {booking.scheduledAt ? (
              <>
                <span className="text-zinc-500">Sched </span>
                <span className="text-zinc-200 font-semibold">
                  {booking.scheduledAt}
                </span>
              </>
            ) : (
              <span className="text-zinc-500">Pending confirmation</span>
            )}
          </span>
        </div>
        <button
          onClick={() => router.push(`/dashboard/owner/tracking/${booking.id}`)}
          className="flex-1 py-2.5 px-3 rounded-xl bg-amber-400/10 border border-amber-400/20
          text-amber-400 text-xs font-semibold hover:bg-amber-400/15 transition-colors text-center">
          Track Live
        </button>
        <button
          aria-label="Call mechanic"
          className="w-10 h-10 rounded-xl bg-white/[0.04] border border-white/[0.08]
            flex items-center justify-center hover:bg-white/[0.08] transition-colors shrink-0">
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden="true">
            <path
              d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.63 3.4 2 2 0 0 1 3.6 1.22h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L7.91 8.9a16 16 0 0 0 6 6l.95-.96a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"
              stroke="#71717A"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      </div>
    </div>
  );
}

// ── No Booking State ──────────────────────────────────────────────────────────

function NoActiveBooking() {
  return (
    <div
      className="w-full bg-white/[0.02] border border-white/[0.06] border-dashed
      rounded-2xl p-5 mb-4 flex flex-col items-center text-center gap-2">
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
            d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2"
            stroke="#52525B"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
          <rect
            x="9"
            y="3"
            width="6"
            height="4"
            rx="1"
            stroke="#52525B"
            strokeWidth="1.5"
          />
        </svg>
      </div>
      <p className="text-sm font-semibold text-zinc-400">No active bookings</p>
      <p className="text-xs text-zinc-600">
        Use the button above to book a mechanic
      </p>
    </div>
  );
}

// ── Nearby Mechanics ──────────────────────────────────────────────────────────

function NearbyMechanicsSection({
  mechanics,
}: {
  mechanics: DisplayMechanic[];
}) {
  if (mechanics.length === 0) {
    return (
      <div className="mb-4">
        <span className="text-sm font-semibold text-zinc-100 block mb-3">
          Nearby Mechanics
        </span>
        <p className="text-sm text-zinc-600 text-center py-6">
          No mechanics found.
        </p>
      </div>
    );
  }

  return (
    <div className="mb-4">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-semibold text-zinc-100">
          Nearby Mechanics
          <span className="ml-2 text-[11px] font-normal text-zinc-500">
            {mechanics.filter((m) => m.available).length} available
          </span>
        </span>
        <button className="text-xs text-amber-400 hover:text-amber-300 transition-colors">
          See all
        </button>
      </div>

      <div className="flex flex-col gap-2.5">
        {mechanics.map((m) => (
          <button
            key={m.id}
            className="flex items-center gap-3.5 w-full text-left
              bg-white/[0.03] border border-white/[0.08] rounded-2xl px-4 py-3.5
              hover:bg-white/[0.05] hover:border-white/[0.12]
              active:scale-[0.99] transition-all">
            <div
              className={[
                "w-11 h-11 rounded-xl flex items-center justify-center shrink-0 text-sm font-bold",
                m.available
                  ? "bg-amber-400/10 border border-amber-400/20 text-amber-400"
                  : "bg-white/[0.04] border border-white/[0.07] text-zinc-500",
              ].join(" ")}>
              {m.initials}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <p className="font-semibold text-zinc-100 text-sm truncate">
                  {m.name}
                </p>
                <span
                  className={[
                    "shrink-0 text-[10px] px-1.5 py-0.5 rounded-md font-medium",
                    m.available
                      ? "bg-emerald-400/10 text-emerald-400"
                      : "bg-zinc-800 text-zinc-500",
                  ].join(" ")}>
                  {m.available ? "Available" : "Busy"}
                </span>
              </div>
              <p className="text-xs text-zinc-500 truncate">{m.specialty}</p>
            </div>

            <div className="text-right shrink-0">
              <div className="mb-0.5 flex justify-end">
                <StarRating value={m.rating} />
              </div>
              <p className="text-[11px] text-zinc-500">
                {m.reviews} {m.reviews === 1 ? "review" : "reviews"}
              </p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Bottom Nav ────────────────────────────────────────────────────────────────

const NAV_ITEMS = [
  {
    label: "Home",
    href: "/dashboard/owner",
    active: true,
    icon: "M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z M9 22V12h6v10",
  },
  {
    label: "Bookings",
    href: "/dashboard/owner/bookings",
    active: false,
    icon: "M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2M9 5a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2M9 5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2m-6 9l2 2 4-4",
  },
  {
  label: "Chats",
  href: "/dashboard/owner/chats",
  active: false,
  icon: "M2.003 5.884L10 12.882l7.997-6.998A2 2 0 0 0 16 4H4a2 2 0 0 0-1.997 1.884z M2 6.118v7.764A2 2 0 0 0 4 16h12a2 2 0 0 0 2-2V6.118l-8 7-8-7z",
},
  {
    label: "Profile",
    href: "/dashboard/owner/profile",
    active: false,
    icon: "M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2 M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z",
  },
];

function BottomNav() {
  const router = useRouter();
  const [active, setActive] = useState("Home");

  function handleNav(label: string, href: string) {
    setActive(label);
    router.push(href);
  }

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50
      bg-[#080909]/95 backdrop-blur-xl border-t border-white/[0.06]"
    >
      <div className="max-w-2xl mx-auto flex items-center justify-around px-2 py-3 pb-5">
        {NAV_ITEMS.map(({ label, href, icon }) =>
          label === "Messages" ? (
            <Link
              key={label}
              href="/dashboard/owner/chats"
              className="flex flex-col items-center gap-1.5 px-4 py-1 rounded-xl transition-all active:scale-95"
            >
              <svg
                width="22"
                height="22"
                viewBox="0 0 24 24"
                fill="none"
                stroke={active === label ? "#F59E0B" : "#52525B"}
                strokeWidth="1.7"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d={icon} />
              </svg>
              <span
                className={`text-[10px] font-medium leading-none ${
                  active === label ? "text-amber-400" : "text-zinc-600"
                }`}
              >
                {label}
              </span>
            </Link>
          ) : (
            <button
              key={label}
              aria-label={label}
              aria-current={active === label ? "page" : undefined}
              onClick={() => handleNav(label, href)}
              className="flex flex-col items-center gap-1.5 px-4 py-1 rounded-xl transition-all active:scale-95"
            >
              <svg
                width="22"
                height="22"
                viewBox="0 0 24 24"
                fill="none"
                stroke={active === label ? "#F59E0B" : "#52525B"}
                strokeWidth="1.7"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d={icon} />
              </svg>
              <span
                className={`text-[10px] font-medium leading-none ${
                  active === label ? "text-amber-400" : "text-zinc-600"
                }`}
              >
                {label}
              </span>
            </button>
          )
        )}
      </div>
    </nav>
  );
}

// ── AI Diagnostic Chathead ────────────────────────────────────────────────────

export function AIDiagnosticChathead() {
  const router = useRouter();
  const [pulse, setPulse] = useState(true);

  return (
    <div className="fixed bottom-24 right-4 z-50 flex flex-col items-end gap-2">
      {/* Tooltip label */}
      {pulse && (
        <div className="flex items-center gap-2 bg-[#111112] border border-white/[0.09]
          rounded-2xl px-3 py-2 shadow-xl animate-in fade-in slide-in-from-right-2 duration-300">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse shrink-0" />
          <p className="text-xs font-medium text-zinc-300 whitespace-nowrap">
            AI Diagnosis — Ask me anything
          </p>
          <button
            onClick={() => setPulse(false)}
            className="ml-1 text-zinc-600 hover:text-zinc-400 transition-colors"
            aria-label="Dismiss">
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
              <path d="M1 1l8 8M9 1L1 9" stroke="currentColor" strokeWidth="1.4"
                strokeLinecap="round" />
            </svg>
          </button>
        </div>
      )}

      {/* Chathead button */}
      <button
        onClick={() => router.push("/dashboard/owner/chats/ai")}
        aria-label="Open AI Diagnostics"
        className="relative w-14 h-14 rounded-full
          bg-gradient-to-br from-amber-400 to-yellow-500
          shadow-[0_8px_32px_rgba(245,158,11,0.4)]
          flex items-center justify-center
          active:scale-95 transition-transform duration-150
          hover:shadow-[0_8px_40px_rgba(245,158,11,0.55)]">
        {/* Outer ring pulse */}
        <span className="absolute inset-0 rounded-full bg-amber-400/30 animate-ping"
          style={{ animationDuration: "2s" }} />
        {/* Brain / AI icon */}
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path
            d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96-.44 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24 2.5 2.5 0 0 1 4.44-1.66z"
            stroke="#080909" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          <path
            d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96-.44 2.5 2.5 0 0 0 2.96-3.08 3 3 0 0 0 .34-5.58 2.5 2.5 0 0 0-1.32-4.24 2.5 2.5 0 0 0-4.44-1.66z"
            stroke="#080909" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        {/* Online dot */}
        <span className="absolute top-0.5 right-0.5 w-3.5 h-3.5 rounded-full
          bg-emerald-400 border-2 border-[#080909]" />
      </button>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

interface OwnerDashboardProps {
  user:           SessionUser;
  activeBooking:  DisplayBooking | null;
  pendingBooking: DisplayBooking | null;
  estimateReview: DisplayEstimateReview | null;
  mechanics:      DisplayMechanic[];
  vehicles?:      DisplayVehicle[];
}

// ── Pending Booking Card ──────────────────────────────────────────────────────

function PendingBookingCard({ booking }: { booking: DisplayBooking }) {
  const isAwaitingEstimate = booking.status === "CONFIRMED";

  return (
    <div className="mb-5 rounded-2xl border border-amber-400/20 bg-amber-400/[0.04] p-5">
      <div className="flex items-center gap-2 mb-4">
        <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
        <span className="text-sm font-semibold text-zinc-100">
          {isAwaitingEstimate ? "Mechanic Reviewing Your Request" : "Awaiting Mechanic Response"}
        </span>
      </div>
      <div className="flex items-center gap-3 mb-4">
        <div className="w-11 h-11 rounded-xl bg-amber-400/10 border border-amber-400/20
          flex items-center justify-center shrink-0">
          <span className="text-sm font-bold text-amber-400">{booking.mechanicInitials}</span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-zinc-100 text-sm">{booking.mechanicName}</p>
          <p className="text-xs text-zinc-500 truncate">{booking.vehicleLabel}</p>
        </div>
        <span className="text-sm font-bold text-zinc-100">{booking.price}</span>
      </div>
      <p className="text-xs text-zinc-400 mb-4 leading-relaxed line-clamp-2">{booking.service}</p>
      <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl
        bg-amber-400/[0.06] border border-amber-400/15">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <circle cx="12" cy="12" r="10" stroke="#F59E0B" strokeWidth="1.5" />
          <path d="M12 6v6l4 2" stroke="#F59E0B" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
        <p className="text-xs text-amber-400/80">
          {isAwaitingEstimate
            ? "The mechanic accepted your request and is preparing a cost estimate."
            : <>Request sent{booking.scheduledAt ? ` · Scheduled: ${booking.scheduledAt}` : ""}. Waiting for mechanic to accept.</>}
        </p>
      </div>
    </div>
  );
}

// ── Estimate Review Card ─────────────────────────────────────────────────────
// ESTIMATE_SENT — the piece that was previously missing entirely. The owner
// needs to Accept or Decline before anything else can happen.

function EstimateReviewCard({ booking }: { booking: DisplayEstimateReview }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [declining, setDeclining] = useState(false);

  function handleAccept() {
    setError(null);
    startTransition(async () => {
      try {
        const { acceptEstimate } = await import("@/app/actions/estimate");
        await acceptEstimate(booking.id);
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not accept the estimate");
      }
    });
  }

  function handleDecline() {
    setError(null);
    startTransition(async () => {
      try {
        const { declineEstimate } = await import("@/app/actions/estimate");
        await declineEstimate(booking.id);
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not decline the estimate");
      }
    });
  }

  return (
    <div className="mb-5 rounded-2xl border border-blue-400/25 bg-blue-400/[0.05] p-5">
      <div className="flex items-center gap-2 mb-4">
        <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
        <span className="text-sm font-semibold text-zinc-100">Repair Estimate Ready</span>
      </div>

      <div className="flex items-center gap-3 mb-4">
        <div className="w-11 h-11 rounded-xl bg-blue-400/10 border border-blue-400/20
          flex items-center justify-center shrink-0">
          <span className="text-sm font-bold text-blue-400">{booking.mechanicInitials}</span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-zinc-100 text-sm">{booking.mechanicName}</p>
          <p className="text-xs text-zinc-500 truncate">{booking.vehicleLabel}</p>
        </div>
      </div>

      <p className="text-xs text-zinc-400 mb-4 leading-relaxed line-clamp-2">{booking.service}</p>

      <div className="rounded-xl bg-white/[0.03] border border-white/[0.07] p-3.5 mb-4 space-y-1.5">
        <div className="flex justify-between text-xs">
          <span className="text-zinc-500">Labor</span>
          <span className="text-zinc-300">₱{booking.laborCost.toLocaleString("en-PH", { minimumFractionDigits: 2 })}</span>
        </div>
        <div className="flex justify-between text-xs">
          <span className="text-zinc-500">Parts</span>
          <span className="text-zinc-300">₱{booking.partsCost.toLocaleString("en-PH", { minimumFractionDigits: 2 })}</span>
        </div>
        {booking.notes && (
          <p className="text-xs text-zinc-500 pt-1.5 border-t border-white/[0.06] leading-relaxed">
            {booking.notes}
          </p>
        )}
        <div className="flex justify-between items-center pt-1.5 border-t border-white/[0.06]">
          <span className="text-xs font-semibold text-zinc-300">Total</span>
          <span className="text-base font-bold text-amber-400">
            ₱{booking.totalCost.toLocaleString("en-PH", { minimumFractionDigits: 2 })}
          </span>
        </div>
      </div>

      {error && (
        <p className="text-xs text-orange-400 bg-orange-500/[0.07] rounded-lg px-3 py-2 mb-3">{error}</p>
      )}

      {declining ? (
        <div className="space-y-2">
          <p className="text-xs text-zinc-400">Decline this estimate and cancel the booking?</p>
          <div className="flex gap-2">
            <button
              onClick={() => setDeclining(false)}
              disabled={isPending}
              className="flex-1 py-2.5 rounded-xl border border-white/[0.08] text-zinc-400
                text-sm font-medium disabled:opacity-40">
              Never mind
            </button>
            <button
              onClick={handleDecline}
              disabled={isPending}
              className="flex-1 py-2.5 rounded-xl bg-red-500/15 border border-red-500/30 text-red-400
                text-sm font-semibold active:scale-[0.98] transition-all disabled:opacity-50">
              {isPending ? "Cancelling…" : "Confirm Decline"}
            </button>
          </div>
        </div>
      ) : (
        <div className="flex gap-2">
          <button
            onClick={() => setDeclining(true)}
            disabled={isPending}
            className="flex-1 py-2.5 rounded-xl border border-white/[0.08] text-zinc-400
              text-sm font-medium disabled:opacity-40">
            Decline
          </button>
          <button
            onClick={handleAccept}
            disabled={isPending}
            className="flex-1 py-2.5 rounded-xl bg-amber-400 text-zinc-900 text-sm font-bold
              active:scale-[0.98] transition-all disabled:opacity-50">
            {isPending ? "Accepting…" : "Accept Estimate"}
          </button>
        </div>
      )}
    </div>
  );
}

export default function OwnerDashboardView({
  user,
  activeBooking,
  pendingBooking,
  estimateReview,
  mechanics = [],
  vehicles  = [],
}: OwnerDashboardProps) {
  const [bookingModalOpen,    setBookingModalOpen]    = useState(false);
  const [preSelectedMechanic, setPreSelectedMechanic] = useState<{ id: string; name: string } | null>(null);
  const [emergencyModalOpen,  setEmergencyModalOpen]  = useState(false);
  const [dispatched,          setDispatched]          = useState<DispatchedInfo | null>(null);

  // Poll for fresh server data every 6s, so a mechanic accepting/declining
  // or advancing status shows up here without a manual page refresh.
  // No state-sync effect needed here — unlike the mechanic dashboard,
  // activeBooking/pendingBooking are rendered directly from props rather
  // than copied into useState, so a fresh prop from router.refresh()
  // updates the UI automatically.
  usePolling(6000);

  function handleBookMechanic(mechanicId: string, mechanicName: string) {
    setPreSelectedMechanic({ id: mechanicId, name: mechanicName });
    setBookingModalOpen(true);
  }

  return (
    <div className="min-h-screen w-screen bg-[#080909] relative">
      <div aria-hidden="true" className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[800px] h-[500px]
          bg-amber-400/[0.025] rounded-full blur-[130px]" />
        <div className="absolute inset-0 opacity-[0.012]"
          style={{
            backgroundImage: "radial-gradient(circle, #F59E0B 1px, transparent 1px)",
            backgroundSize: "28px 28px",
          }} />
      </div>

      <div className="relative z-10 w-full h-full p-4 pb-28">
        <Header user={user} onBookMechanic={handleBookMechanic} />
        <ActionButtonsRow
          onEmergency={() => setEmergencyModalOpen(true)}
          onBookService={() => setBookingModalOpen(true)}
          dispatched={dispatched}
          onDismissDispatched={() => setDispatched(null)}
        />
        {activeBooking ? (
          <ActiveBookingCard booking={activeBooking} />
        ) : estimateReview ? (
          <EstimateReviewCard booking={estimateReview} />
        ) : pendingBooking ? (
          <PendingBookingCard booking={pendingBooking} />
        ) : (
          <NoActiveBooking />
        )}
        <NearbyMechanicsSection mechanics={mechanics} />
      </div>

      {/* AI Diagnostic floating chathead */}
      <AIDiagnosticChathead />

      <BottomNav />

      {bookingModalOpen && (
        <BookingModalLazy
          isOpen={bookingModalOpen}
          onClose={() => { setBookingModalOpen(false); setPreSelectedMechanic(null); }}
          mechanics={mechanics}
          preSelectedMechanicId={preSelectedMechanic?.id ?? null}
        />
      )}  

      {emergencyModalOpen && (
        <EmergencyModalLazy
          isOpen={emergencyModalOpen}
          onClose={() => setEmergencyModalOpen(false)}
          onDispatched={(info: DispatchedInfo) => setDispatched(info)}
        />
      )}
    </div>
  );
}