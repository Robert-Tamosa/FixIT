"use client";

import { useState } from "react";
import { RatingModal } from "./RatingModal";
import { BottomNav } from "@/components/BottomNav";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface CompletedBooking {
  id:              string;
  mechanicId:      string;
  mechanicName:    string;
  mechanicInitials:string;
  vehicleLabel:    string;
  problem:         string;
  price:           string;
  completedAt:     string;
  rating:          number | null;       // null = not yet rated
  comment:         string | null;
  sentiment:       string | null;       // POSITIVE | NEUTRAL | NEGATIVE | null
}

// ── Sentiment badge ───────────────────────────────────────────────────────────

function SentimentBadge({ sentiment }: { sentiment: string | null }) {
  if (!sentiment) return null;
  const map: Record<string, { label: string; cls: string }> = {
    POSITIVE: { label: "Positive",  cls: "bg-emerald-400/10 border-emerald-400/20 text-emerald-400" },
    NEUTRAL:  { label: "Neutral",   cls: "bg-zinc-400/10   border-zinc-400/20   text-zinc-400"   },
    NEGATIVE: { label: "Negative",  cls: "bg-red-400/10    border-red-400/20    text-red-400"    },
  };
  const s = map[sentiment];
  if (!s) return null;
  return (
    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-md border ${s.cls}`}>
      {s.label}
    </span>
  );
}

// ── Star display ──────────────────────────────────────────────────────────────

function Stars({ value }: { value: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1,2,3,4,5].map((s) => (
        <svg key={s} width="13" height="13" viewBox="0 0 24 24" aria-hidden="true"
          fill={s <= value ? "#F59E0B" : "none"}
          stroke={s <= value ? "#F59E0B" : "#3F3F46"}
          strokeWidth="1.5">
          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
        </svg>
      ))}
    </div>
  );
}

// ── Booking card ──────────────────────────────────────────────────────────────

function BookingCard({
  booking,
  onRate,
}: {
  booking: CompletedBooking;
  onRate:  (b: CompletedBooking) => void;
}) {
  const rated = booking.rating !== null;

  return (
    <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-5">
      {/* Top row */}
      <div className="flex items-start gap-3 mb-4">
        <div className="w-11 h-11 rounded-xl bg-amber-400/10 border border-amber-400/20
          flex items-center justify-center shrink-0">
          <span className="text-sm font-bold text-amber-400">{booking.mechanicInitials}</span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-zinc-100 text-sm truncate">{booking.mechanicName}</p>
          <p className="text-xs text-zinc-500 truncate">{booking.vehicleLabel}</p>
          <p className="text-xs text-zinc-600 truncate mt-0.5">{booking.problem}</p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-sm font-bold text-zinc-100">{booking.price}</p>
          <p className="text-[11px] text-zinc-600 mt-0.5">{booking.completedAt}</p>
        </div>
      </div>

      {/* Divider */}
      <div className="border-t border-white/[0.06] mb-4" />

      {/* Rating section */}
      {rated ? (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Stars value={booking.rating!} />
            <span className="text-xs font-semibold text-zinc-300">{booking.rating}/5</span>
            <SentimentBadge sentiment={booking.sentiment} />
            <span className="ml-auto text-[11px] text-zinc-600">Your review</span>
          </div>
          {booking.comment && (
            <p className="text-xs text-zinc-500 leading-relaxed bg-white/[0.02]
              border border-white/[0.06] rounded-xl px-3 py-2.5">
              "{booking.comment}"
            </p>
          )}
        </div>
      ) : (
        <button
          onClick={() => onRate(booking)}
          className="w-full py-2.5 rounded-xl border border-amber-400/30 bg-amber-400/[0.06]
            text-sm font-semibold text-amber-400 hover:bg-amber-400/10 hover:border-amber-400/50
            active:scale-[0.98] transition-all flex items-center justify-center gap-2"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
              stroke="#F59E0B" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Rate this service
        </button>
      )}
    </div>
  );
}

// ── Main view ─────────────────────────────────────────────────────────────────

export default function CompletedBookingsView({
  bookings: initialBookings,
}: {
  bookings: CompletedBooking[];
}) {
  const [bookings, setBookings]     = useState(initialBookings);
  const [selected, setSelected]     = useState<CompletedBooking | null>(null);
  const [filter, setFilter]         = useState<"ALL" | "RATED" | "UNRATED">("ALL");

  const filtered = bookings.filter((b) => {
    if (filter === "RATED")   return b.rating !== null;
    if (filter === "UNRATED") return b.rating === null;
    return true;
  });

  const ratedCount   = bookings.filter((b) => b.rating !== null).length;
  const unratedCount = bookings.filter((b) => b.rating === null).length;
  const avgRating    = ratedCount > 0
    ? (bookings.reduce((s, b) => s + (b.rating ?? 0), 0) / ratedCount).toFixed(1)
    : "—";

  function handleSuccess() {
    // The server revalidates — just close; page refresh via revalidatePath
    // will update ratings. Optimistically mark as rated with a placeholder.
    setSelected(null);
  }

  function handleRateSuccess(bookingId: string, rating: number, comment: string | null) {
    setBookings((prev) =>
      prev.map((b) =>
        b.id === bookingId
          ? { ...b, rating, comment, sentiment: null }
          : b
      )
    );
  }

  return (
    <div className="min-h-screen w-full bg-[#080909] relative">
      {/* Background */}
      <div aria-hidden="true" className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[800px] h-[500px]
          bg-amber-400/[0.025] rounded-full blur-[130px]" />
        <div className="absolute inset-0 opacity-[0.012]"
          style={{
            backgroundImage: "radial-gradient(circle, #F59E0B 1px, transparent 1px)",
            backgroundSize: "28px 28px",
          }} />
      </div>

      <div className="relative z-10 w-full p-4 pb-28">
        {/* Page header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="w-9 h-9 rounded-xl bg-amber-400/10 border border-amber-400/20
            flex items-center justify-center shrink-0">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
                fill="#F59E0B" stroke="#F59E0B" strokeWidth="1.2" />
            </svg>
          </div>
          <div>
            <h1 className="text-lg font-bold text-zinc-100">Service History</h1>
            <p className="text-xs text-zinc-500">Rate completed services</p>
          </div>
        </div>

        {/* Stats strip */}
        <div className="grid grid-cols-3 gap-2.5 mb-5">
          {[
            { label: "Completed",  value: String(bookings.length) },
            { label: "Avg Rating", value: avgRating               },
            { label: "Pending Review", value: String(unratedCount)},
          ].map(({ label, value }) => (
            <div key={label}
              className="flex flex-col items-center gap-1 py-3.5 rounded-2xl
                bg-white/[0.03] border border-white/[0.07]">
              <p className="text-base font-bold text-zinc-100">{value}</p>
              <p className="text-[10px] text-zinc-600 text-center">{label}</p>
            </div>
          ))}
        </div>

        {/* Filter tabs */}
        <div className="flex gap-2 mb-4 p-1 rounded-2xl bg-white/[0.03] border border-white/[0.07]">
          {(["ALL", "UNRATED", "RATED"] as const).map((f) => (
            <button key={f} onClick={() => setFilter(f)}
              className={[
                "flex-1 py-2 rounded-xl text-xs font-semibold transition-all",
                filter === f
                  ? "bg-amber-400 text-[#080909]"
                  : "text-zinc-500 hover:text-zinc-300",
              ].join(" ")}>
              {f === "ALL"     ? `All (${bookings.length})`   : null}
              {f === "UNRATED" ? `To Rate (${unratedCount})`  : null}
              {f === "RATED"   ? `Rated (${ratedCount})`      : null}
            </button>
          ))}
        </div>

        {/* Booking list */}
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <div className="w-12 h-12 rounded-2xl bg-white/[0.04] border border-white/[0.08]
              flex items-center justify-center">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2
                  M9 5a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2M9 5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2"
                  stroke="#52525B" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </div>
            <p className="text-sm text-zinc-500">No completed bookings yet</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {filtered.map((b) => (
              <BookingCard key={b.id} booking={b} onRate={setSelected} />
            ))}
          </div>
        )}
      </div>

      {/* Rating modal */}
      {selected && (
        <RatingModal
          open={!!selected}
          bookingId={selected.id}
          mechanicName={selected.mechanicName}
          vehicleLabel={selected.vehicleLabel}
          serviceDate={selected.completedAt}
          onClose={() => setSelected(null)}
          onSuccess={handleSuccess}
        />
      )}
      <BottomNav/>  
    </div>
  );
}
