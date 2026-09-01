"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { BottomNav } from "../_mechanic-dashboard";
import { getPayment, type DisplayPayment } from "@/app/actions/payment";
import { ConfirmCashPaymentButton } from "@/components/payment/ConfirmCashPaymentButton";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface JobItem {
  id:            string;
  ownerName:     string;
  ownerInitials: string;
  vehicleLabel:  string;
  problem:       string;
  status:        "PENDING" | "CONFIRMED" | "EN_ROUTE" | "IN_PROGRESS" | "DONE" | "CANCELLED";
  scheduledAt:   string | null;
  price:         string;
  isEmergency:   boolean;
  createdAt:     string;
  rating:        number | null;
}

export interface MechanicJobsProps {
  jobs:         JobItem[];
  totalEarnings: string;
  doneCount:    number;
  cancelCount:  number;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<string, {
  label: string;
  cls:   string;
  dot:   string;
}> = {
  PENDING:     { label: "Pending",     cls: "text-amber-400   bg-amber-400/10   border-amber-400/20",   dot: "bg-amber-400"   },
  CONFIRMED:   { label: "Confirmed",   cls: "text-sky-400     bg-sky-400/10     border-sky-400/20",     dot: "bg-sky-400"     },
  EN_ROUTE:    { label: "En Route",    cls: "text-blue-400    bg-blue-400/10    border-blue-400/20",    dot: "bg-blue-400 animate-pulse"    },
  IN_PROGRESS: { label: "In Progress", cls: "text-orange-400  bg-orange-400/10  border-orange-400/20",  dot: "bg-orange-400 animate-pulse"  },
  DONE:        { label: "Completed",   cls: "text-emerald-400 bg-emerald-400/10 border-emerald-400/20", dot: "bg-emerald-400" },
  CANCELLED:   { label: "Cancelled",   cls: "text-red-400     bg-red-400/10     border-red-400/20",     dot: "bg-red-400"     },
};

const FILTERS = ["All", "Active", "Pending", "Completed", "Cancelled"] as const;
type Filter = typeof FILTERS[number];

// ── Sub-components ────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const c = STATUS_CONFIG[status] ?? STATUS_CONFIG.PENDING;
  return (
    <span className={`flex items-center gap-1.5 text-[10px] font-semibold
      px-2 py-0.5 rounded-md border ${c.cls}`}>
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${c.dot}`} />
      {c.label}
    </span>
  );
}

function StarRating({ value }: { value: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1,2,3,4,5].map((s) => (
        <svg key={s} width="10" height="10" viewBox="0 0 24 24" aria-hidden="true"
          fill={s <= value ? "#F59E0B" : "none"}
          stroke={s <= value ? "#F59E0B" : "#3F3F46"} strokeWidth="1.5">
          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
        </svg>
      ))}
    </div>
  );
}

// Fetches its own payment status rather than requiring JobItem to carry  
// payment fields — keeps this self-contained without needing to touch
// whatever page.tsx currently populates the jobs list server-side.
// Only rendered for DONE jobs (see JobCard below), so the extra fetch only
// fires for a small, already-filtered subset of the list.

const MANUALLY_CONFIRMED = ["CASH", "GCASH_DIRECT", "MAYA_DIRECT"];

function PaymentStatusStrip({ bookingId }: { bookingId: string }) {
  const [payment, setPayment] = useState<DisplayPayment | null>(null);
  const [loading, setLoading] = useState(true);
  const paymentRef = useRef<DisplayPayment | null>(null);

  useEffect(() => {
    let cancelled = false;

    function load() {
      getPayment(bookingId)
        .then((p) => {
          if (cancelled) return;
          setPayment(p);
          paymentRef.current = p;
        })
        .catch(() => { /* best-effort — leave the card without this strip on error */ })
        .finally(() => { if (!cancelled) setLoading(false); });
    }

    load();
    const interval = setInterval(() => {
      if (paymentRef.current?.status === "PAID") { clearInterval(interval); return; }
      load();
    }, 6000);

    return () => { cancelled = true; clearInterval(interval); };
  }, [bookingId]);

  if (loading) return null;
  if (!payment || !payment.method) return null; // owner hasn't reached payment yet

  if (payment.status === "PAID") {
    return (
      <div className="mb-3 px-3 py-2 rounded-xl bg-emerald-400/10 border border-emerald-400/20
        text-[11px] font-semibold text-emerald-400 text-center">
        Paid {payment.method === "CASH" ? "in cash" : payment.method === "GCASH_DIRECT" ? "directly via GCash" : payment.method === "MAYA_DIRECT" ? "directly via Maya" : `via ${payment.paidVia ?? "online"}`}
      </div>
    );
  }

  if (MANUALLY_CONFIRMED.includes(payment.method) && payment.status === "PENDING") {
    return (
      <div className="mb-3 space-y-2">
        {payment.ownerMarkedSentAt && (payment.method === "GCASH_DIRECT" || payment.method === "MAYA_DIRECT") && (
          <p className="text-[11px] text-amber-400 text-center">
            Owner marked this as sent — check your {payment.method === "GCASH_DIRECT" ? "GCash" : "Maya"} account.
          </p>
        )}
        <ConfirmCashPaymentButton bookingId={bookingId} method={payment.method as "CASH" | "GCASH_DIRECT" | "MAYA_DIRECT"} />
      </div>
    );
  }

  if (payment.method === "ONLINE" && payment.status === "PENDING") {
    return (
      <div className="mb-3 px-3 py-2 rounded-xl bg-white/[0.02] border border-white/[0.06]
        text-[11px] text-zinc-500 text-center">
        Waiting on owner's online payment
      </div>
    );
  }

  return null;
}

function JobCard({ job }: { job: JobItem }) {
  const router  = useRouter();
  const isActive = ["CONFIRMED", "EN_ROUTE", "IN_PROGRESS"].includes(job.status);

  return (
    <div className={`rounded-2xl border bg-white/[0.03] p-4 transition-all ${
      isActive
        ? "border-amber-400/20 ring-1 ring-amber-400/10"
        : "border-white/[0.08]"
    }`}>
      {/* Top row */}
      <div className="flex items-start gap-3 mb-3">
        <div className="w-10 h-10 rounded-xl bg-zinc-800 border border-white/[0.08]
          flex items-center justify-center shrink-0 text-xs font-bold text-zinc-300">
          {job.ownerInitials}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <p className="text-sm font-semibold text-zinc-100 truncate">{job.ownerName}</p>
            {job.isEmergency && (
              <span className="text-[9px] font-bold text-red-400
                bg-red-400/10 border border-red-400/20 px-1.5 py-0.5 rounded-md shrink-0">
                Emergency
              </span>
            )}
          </div>
          <p className="text-xs text-zinc-500 truncate">{job.vehicleLabel}</p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-sm font-bold text-zinc-100">{job.price}</p>
          <p className="text-[10px] text-zinc-600 mt-0.5">{job.createdAt}</p>
        </div>
      </div>

      {/* Problem */}
      <p className="text-xs text-zinc-400 leading-relaxed line-clamp-2 mb-3">
        {job.problem}
      </p>

      {/* Meta row */}
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <StatusBadge status={job.status} />
        {job.scheduledAt && (
          <div className="flex items-center gap-1 ml-auto">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <circle cx="12" cy="12" r="10" stroke="#52525B" strokeWidth="1.5" />
              <path d="M12 6v6l4 2" stroke="#52525B" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            <span className="text-[11px] text-zinc-500">{job.scheduledAt}</span>
          </div>
        )}
      </div>

      {/* Rating (if completed) */}
      {job.status === "DONE" && job.rating !== null && (
        <div className="flex items-center gap-2 mb-3 px-3 py-2 rounded-xl
          bg-amber-400/[0.05] border border-amber-400/10">
          <StarRating value={job.rating} />
          <span className="text-xs font-semibold text-amber-400 ml-1">{job.rating}/5</span>
          <span className="text-[11px] text-zinc-600 ml-auto">Owner's rating</span>
        </div>
      )}

      {job.status === "DONE" && job.rating === null && (
        <div className="flex items-center gap-2 mb-3 px-3 py-2 rounded-xl
          bg-white/[0.02] border border-white/[0.06]">
          <span className="text-[11px] text-zinc-600">Not yet rated by owner</span>
        </div>
      )}

      {job.status === "DONE" && <PaymentStatusStrip bookingId={job.id} />}

      {/* Action buttons */}
      <div className="flex gap-2">
        {/* Booking ID */}
        <span className="flex-1 flex items-center px-3 py-2 rounded-xl
          bg-white/[0.02] border border-white/[0.06]
          text-[10px] font-mono text-zinc-600 truncate">
          {job.id.slice(0, 16).toUpperCase()}
        </span>

        {/* Track button — only for active jobs */}
        {isActive && (
          <button
            onClick={() => router.push(`/dashboard/mechanic/tracking/${job.id}`)}
            className="px-3 py-2 rounded-xl bg-emerald-400/10 border border-emerald-400/20
              text-xs font-semibold text-emerald-400
              hover:bg-emerald-400/15 transition-colors flex items-center gap-1.5 shrink-0">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"
                stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              <circle cx="12" cy="10" r="3"
                stroke="currentColor" strokeWidth="1.8" />
            </svg>
            Track
          </button>
        )}
      </div>
    </div>
  );
}

// ── Main View ─────────────────────────────────────────────────────────────────

export default function MechanicJobsView({
  jobs,
  totalEarnings,
  doneCount,
  cancelCount,
}: MechanicJobsProps) {
  const router = useRouter();
  const [filter, setFilter] = useState<Filter>("All");
  const [search, setSearch] = useState("");

  const filtered = jobs.filter((j) => {
    const matchesFilter =
      filter === "All"       ? true :
      filter === "Active"    ? ["CONFIRMED", "EN_ROUTE", "IN_PROGRESS"].includes(j.status) :
      filter === "Pending"   ? j.status === "PENDING" :
      filter === "Completed" ? j.status === "DONE" :
      filter === "Cancelled" ? j.status === "CANCELLED" :
      true;

    const matchesSearch = search.trim() === "" ||
      j.ownerName.toLowerCase().includes(search.toLowerCase()) ||
      j.vehicleLabel.toLowerCase().includes(search.toLowerCase()) ||
      j.problem.toLowerCase().includes(search.toLowerCase());

    return matchesFilter && matchesSearch;
  });

  const activeCount  = jobs.filter((j) => ["CONFIRMED","EN_ROUTE","IN_PROGRESS"].includes(j.status)).length;
  const pendingCount = jobs.filter((j) => j.status === "PENDING").length;

  return (
    <div className="min-h-screen w-full bg-[#080909] relative">
      {/* Background */}
      <div aria-hidden="true" className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[700px] h-[450px]
          bg-amber-400/[0.025] rounded-full blur-[130px]" />
        <div className="absolute inset-0 opacity-[0.012]"
          style={{
            backgroundImage: "radial-gradient(circle, #F59E0B 1px, transparent 1px)",
            backgroundSize:  "28px 28px",
          }} />
      </div>

      <div className="relative z-10 w-full p-4 pb-28">

        {/* Header */}
        <div className="flex items-center gap-3 mb-5">
          <button
            onClick={() => router.back()}
            aria-label="Go back"
            className="w-9 h-9 rounded-xl bg-white/[0.04] border border-white/[0.08]
              flex items-center justify-center hover:bg-white/[0.07] transition-colors shrink-0">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M19 12H5M12 5l-7 7 7 7" stroke="#71717A" strokeWidth="1.8"
                strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <div className="flex-1">
            <h1 className="text-lg font-bold text-zinc-100">My Jobs</h1>
            <p className="text-xs text-zinc-500">{jobs.length} total bookings</p>
          </div>
          {activeCount > 0 && (
            <span className="flex items-center gap-1.5 text-xs font-semibold
              text-emerald-400 bg-emerald-400/10 border border-emerald-400/20
              px-2.5 py-1 rounded-xl">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              {activeCount} active
            </span>
          )}
        </div>

        {/* Stats strip */}
        <div className="grid grid-cols-4 gap-2 mb-5">
          {[
            { label: "Total",      value: String(jobs.length),  color: "text-zinc-100"    },
            { label: "Pending",    value: String(pendingCount),  color: "text-amber-400"   },
            { label: "Completed",  value: String(doneCount),     color: "text-emerald-400" },
            { label: "Earnings",   value: totalEarnings,         color: "text-amber-400"   },
          ].map(({ label, value, color }) => (
            <div key={label}
              className="flex flex-col items-center gap-1 py-3 rounded-2xl
                bg-white/[0.03] border border-white/[0.07]">
              <p className={`text-sm font-bold ${color}`}>{value}</p>
              <p className="text-[10px] text-zinc-600">{label}</p>
            </div>
          ))}
        </div>

        {/* Search */}
        <div className="relative mb-3">
          <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
            width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <circle cx="11" cy="11" r="8" stroke="#52525B" strokeWidth="1.8" />
            <path d="M21 21l-4.35-4.35" stroke="#52525B" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
          <input
            type="search" value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search owner, vehicle, problem…"
            className="w-full pl-10 pr-4 py-2.5 rounded-xl
              bg-white/[0.04] border border-white/[0.08]
              text-sm text-zinc-200 placeholder:text-zinc-600
              focus:outline-none focus:border-amber-400/40 focus:bg-white/[0.06]
              transition-colors"
          />
        </div>

        {/* Filter tabs */}
        <div className="flex gap-1.5 mb-5 overflow-x-auto pb-1 scrollbar-none">
          {FILTERS.map((f) => (
            <button key={f} onClick={() => setFilter(f)}
              className={[
                "shrink-0 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all",
                filter === f
                  ? "bg-amber-400 text-[#080909]"
                  : "bg-white/[0.04] border border-white/[0.08] text-zinc-500 hover:text-zinc-300",
              ].join(" ")}>
              {f}
              {f === "Pending" && pendingCount > 0 && (
                <span className={`ml-1.5 px-1.5 py-0.5 rounded-full text-[9px] font-bold ${
                  filter === f ? "bg-black/20 text-[#080909]" : "bg-amber-400/20 text-amber-400"
                }`}>
                  {pendingCount}
                </span>
              )}
              {f === "Active" && activeCount > 0 && (
                <span className={`ml-1.5 px-1.5 py-0.5 rounded-full text-[9px] font-bold ${
                  filter === f ? "bg-black/20 text-[#080909]" : "bg-emerald-400/20 text-emerald-400"
                }`}>
                  {activeCount}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Job list */}
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
            <p className="text-sm text-zinc-500">
              {search ? "No jobs match your search" : `No ${filter.toLowerCase()} jobs`}
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {filtered.map((job) => (
              <JobCard key={job.id} job={job} />
            ))}
          </div>
        )}
      </div>

      <BottomNav/>
    </div>
  );
}