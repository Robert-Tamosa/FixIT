"use client";

import { useState, useEffect, useTransition } from "react";
import {
  getShopBookings,
  getAssignableMechanics,
  assignMechanicToBooking,
  findIndependentMechanicByEmail,
  inviteMechanicToShop,
  removeMechanicFromShop,
  type ShopOverviewStats,
  type DisplayShopBookingRow,
  type DisplayShopBooking,
  type DisplayAssignableMechanic,
  type DisplayInviteCandidate,
} from "@/app/actions/shop-dashboard";
import { shareShopLocation } from "@/app/actions/shop";

interface ShopMechanicRow {
  id: string;
  name: string;
  specialization: string;
  isAvailable: boolean;
  isVerified: boolean;
  avgRating: number;
}

interface ShopDashboardProps {
  shopName: string;
  shopAddress: string;
  isVerified: boolean;
  stats: ShopOverviewStats;
  recentBookings: DisplayShopBookingRow[];
  mechanics: ShopMechanicRow[];
}

const STATUS_LABELS: Record<string, string> = {
  PENDING: "Pending",
  DECLINED: "Declined",
  CONFIRMED: "Confirmed",
  ESTIMATE_SENT: "Estimate Sent",
  ESTIMATE_ACCEPTED: "Estimate Accepted",
  EN_ROUTE: "En Route",
  IN_PROGRESS: "In Progress",
  DONE: "Completed",
  CANCELLED: "Cancelled",
};

const STATUS_COLORS: Record<string, string> = {
  PENDING: "text-amber-400 bg-amber-400/10 border-amber-400/20",
  CONFIRMED: "text-blue-400 bg-blue-400/10 border-blue-400/20",
  EN_ROUTE: "text-blue-400 bg-blue-400/10 border-blue-400/20",
  IN_PROGRESS: "text-amber-400 bg-amber-400/10 border-amber-400/20",
  DONE: "text-emerald-400 bg-emerald-400/10 border-emerald-400/20",
  CANCELLED: "text-zinc-500 bg-zinc-800/40 border-zinc-800",
  DECLINED: "text-red-400 bg-red-400/10 border-red-400/20",
};

function formatPHP(n: number) {
  return `₱${n.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function ShopDashboardView({
  shopName,
  shopAddress,
  isVerified,
  stats,
  recentBookings,
  mechanics,
}: ShopDashboardProps) {
  const [tab, setTab] = useState<"overview" | "bookings" | "mechanics">("overview");

  return (
    <div className="min-h-screen bg-[#080909]">
      <div className="max-w-full mx-auto px-6 py-8 space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-amber-400/10 border border-amber-400/20
            flex items-center justify-center shrink-0">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M3 21h18M5 21V7l7-4 7 4v14M9 21v-6h6v6" stroke="#FBBF24" strokeWidth="1.8"
                strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-semibold text-zinc-100">{shopName}</h1>
              {isVerified && (
                <span className="text-[10px] text-emerald-400 bg-emerald-400/10 border border-emerald-400/20
                  px-2 py-0.5 rounded-full">
                  Verified
                </span>
              )}
            </div>
            <p className="text-sm text-zinc-500 mt-0.5">{shopAddress}</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 border-b border-zinc-800 pb-px">
          {([
            { key: "overview", label: "Overview" },
            { key: "bookings", label: "Bookings" },
            { key: "mechanics", label: `Mechanics (${mechanics.length})` },
          ] as const).map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
                tab === key
                  ? "border-amber-400 text-amber-400"
                  : "border-transparent text-zinc-500 hover:text-zinc-300"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {tab === "overview" && <OverviewTab stats={stats} recentBookings={recentBookings} />}
        {tab === "bookings" && <BookingsTab mechanics={mechanics} />}
        {tab === "mechanics" && <MechanicsTab initialMechanics={mechanics} />}
      </div>
    </div>
  );
}

// ── Share Location Button ───────────────────────────────────────────────────

function ShareShopLocationButton() {
  const [status, setStatus] = useState<"idle" | "locating" | "done">("idle");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleShare() {
    setError(null);
    if (!navigator.geolocation) {
      setError("Your browser doesn't support location sharing.");
      return;
    }

    setStatus("locating");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        startTransition(async () => {
          try {
            await shareShopLocation(pos.coords.latitude, pos.coords.longitude);
            setStatus("done");
          } catch (e) {
            setStatus("idle");
            setError(e instanceof Error ? e.message : "Could not save location");
          }
        });
      },
      () => {
        setStatus("idle");
        setError("Location access was denied.");
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }

  if (status === "done") {
    return (
      <div className="flex items-center gap-2 text-sm text-emerald-400">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M20 6L9 17l-5-5" stroke="#34D399" strokeWidth="2.5"
            strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        Location updated
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4 space-y-2.5">
      <div>
        <p className="text-sm font-medium text-zinc-100">Share your shop's exact location</p>
        <p className="text-xs text-zinc-500 mt-0.5">
          Stand at your shop and tap this to set precise GPS coordinates — more
          accurate than the address lookup used at signup, and what emergency
          matching relies on for distance to customers.
        </p>
      </div>
      {error && <p className="text-xs text-orange-400 bg-orange-500/[0.07] rounded-lg px-3 py-2">{error}</p>}
      <button
        onClick={handleShare}
        disabled={status === "locating" || isPending}
        className="w-full py-2.5 rounded-xl bg-amber-400 text-zinc-900 text-sm font-medium
          active:scale-[0.98] transition-all disabled:opacity-50"
      >
        {status === "locating" || isPending ? "Getting location…" : "Share current location"}
      </button>
    </div>
  );
}

// ── Overview ─────────────────────────────────────────────────────────────────

function OverviewTab({
  stats,
  recentBookings,
}: {
  stats: ShopOverviewStats;
  recentBookings: DisplayShopBookingRow[];
}) {
  const cards = [
    { label: "Total Bookings", value: stats.totalBookings },
    { label: "Active Jobs", value: stats.activeJobs },
    { label: "Available Mechanics", value: stats.availableMechanics },
    { label: "Today's Revenue", value: formatPHP(stats.todaysRevenue) },
    { label: "Pending Requests", value: stats.pendingRequests },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {cards.map((c) => (
          <div key={c.label} className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4
            border-l-2 border-l-amber-400/40">
            <p className="text-xl font-semibold text-zinc-100">{c.value}</p>
            <p className="text-xs text-zinc-500 mt-0.5">{c.label}</p>
          </div>
        ))}
      </div>

      <ShareShopLocationButton />

      <div>
        <p className="text-sm font-medium text-zinc-300 mb-2">Recent Bookings</p>
        {recentBookings.length === 0 ? (
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6 text-center">
            <p className="text-sm text-zinc-500">No bookings yet.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {recentBookings.map((b) => (
              <div key={b.id} className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-3.5
                flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm text-zinc-100 truncate">{b.ownerName} · {b.vehicleLabel}</p>
                  <p className="text-xs text-zinc-500">
                    {b.mechanicName ?? "Unassigned"} · {b.createdAt}
                  </p>
                </div>
                <span className={`text-[10px] px-2 py-0.5 rounded-full border shrink-0 ${STATUS_COLORS[b.status] ?? ""}`}>
                  {STATUS_LABELS[b.status] ?? b.status}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Bookings ─────────────────────────────────────────────────────────────────

const STATUS_FILTERS = ["ALL", "PENDING", "CONFIRMED", "IN_PROGRESS", "DONE", "CANCELLED"] as const;

function BookingsTab({ mechanics }: { mechanics: ShopMechanicRow[] }) {
  const [filter, setFilter] = useState<(typeof STATUS_FILTERS)[number]>("ALL");
  const [bookings, setBookings] = useState<DisplayShopBooking[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [assigningId, setAssigningId] = useState<string | null>(null);

  async function load(nextFilter: typeof filter) {
    setLoading(true);
    try {
      const data = await getShopBookings(nextFilter === "ALL" ? undefined : nextFilter);
      setBookings(data);
    } finally {
      setLoading(false);
    }
  }

  // NOTE: this must be useEffect, not useState. useState's initializer runs
  // synchronously during render — calling an async function that eventually
  // calls setState from inside it triggers a "Cannot update a component
  // while rendering a different component" warning/crash, because React is
  // still mid-render for BookingsTab when the update lands. useEffect defers
  // the call until after the render has committed.
  useEffect(() => {
    load("ALL");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleFilterChange(next: typeof filter) {
    setFilter(next);
    await load(next);
  }

  async function handleAssigned() {
    setAssigningId(null);
    await load(filter);
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-1.5 flex-wrap">
        {STATUS_FILTERS.map((f) => (
          <button
            key={f}
            onClick={() => handleFilterChange(f)}
            className={`px-3 py-1.5 rounded-full text-xs border transition-all active:scale-[0.98] ${
              filter === f
                ? "bg-amber-400 text-zinc-900 border-amber-400"
                : "bg-zinc-900/60 text-zinc-400 border-zinc-800"
            }`}
          >
            {f === "ALL" ? "All" : STATUS_LABELS[f] ?? f}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-sm text-zinc-500 py-8 text-center">Loading…</p>
      ) : !bookings || bookings.length === 0 ? (
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-8 text-center">
          <p className="text-sm text-zinc-500">No bookings match this filter.</p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {bookings.map((b) => (
            <div key={b.id} className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4 space-y-2.5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-zinc-100">{b.ownerName}</p>
                    {b.isEmergency && (
                      <span className="text-[10px] text-red-400 bg-red-400/10 border border-red-400/20
                        px-1.5 py-0.5 rounded-full">Emergency</span>
                    )}
                  </div>
                  <p className="text-xs text-zinc-500 mt-0.5">{b.vehicleLabel} · {b.createdAt}</p>
                </div>
                <span className={`text-[10px] px-2 py-0.5 rounded-full border shrink-0 ${STATUS_COLORS[b.status] ?? ""}`}>
                  {STATUS_LABELS[b.status] ?? b.status}
                </span>
              </div>

              <p className="text-xs text-zinc-400 line-clamp-2">{b.problem}</p>

              <div className="flex items-center justify-between pt-1 border-t border-zinc-800">
                <p className="text-xs text-zinc-500">
                  {b.mechanicName ? `Assigned: ${b.mechanicName}` : "Any Available Mechanic — unassigned"}
                </p>
                {b.status !== "DONE" && b.status !== "CANCELLED" && (
                  assigningId === b.id ? (
                    <MechanicPicker
                      mechanics={mechanics}
                      onCancel={() => setAssigningId(null)}
                      onSelect={async (mechanicId) => {
                        await assignMechanicToBooking(b.id, mechanicId);
                        await handleAssigned();
                      }}
                    />
                  ) : (
                    <button
                      onClick={() => setAssigningId(b.id)}
                      className="text-xs text-amber-400 font-medium"
                    >
                      {b.mechanicName ? "Reassign" : "Assign mechanic"}
                    </button>
                  )
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function MechanicPicker({
  mechanics,
  onSelect,
  onCancel,
}: {
  mechanics: ShopMechanicRow[];
  onSelect: (mechanicId: string) => void;
  onCancel: () => void;
}) {
  const [isPending, startTransition] = useTransition();

  return (
    <div className="flex items-center gap-1.5">
      <select
        disabled={isPending}
        defaultValue=""
        onChange={(e) => {
          if (!e.target.value) return;
          startTransition(() => onSelect(e.target.value));
        }}
        className="text-xs bg-zinc-800/60 border border-zinc-700 text-zinc-200 rounded-lg px-2 py-1"
      >
        <option value="" disabled>Select mechanic…</option>
        {mechanics.map((m) => (
          <option key={m.id} value={m.id}>
            {m.name} {m.isAvailable ? "" : "(offline)"}
          </option>
        ))}
      </select>
      <button onClick={onCancel} className="text-xs text-zinc-600">Cancel</button>
    </div>
  );
}

// ── Mechanics ────────────────────────────────────────────────────────────────

function MechanicsTab({ initialMechanics }: { initialMechanics: ShopMechanicRow[] }) {
  const [mechanics, setMechanics] = useState(initialMechanics);
  const [inviteEmail, setInviteEmail] = useState("");
  const [candidate, setCandidate] = useState<DisplayInviteCandidate | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSearch() {
    setError(null);
    setCandidate(null);
    startTransition(async () => {
      const result = await findIndependentMechanicByEmail(inviteEmail.trim());
      if (!result) {
        setError("No independent, verified mechanic found with that email.");
        return;
      }
      setCandidate(result);
    });
  }

  function handleAdd() {
    if (!candidate) return;
    startTransition(async () => {
      await inviteMechanicToShop(candidate.userId);
      setMechanics((prev) => [
        ...prev,
        {
          id: candidate.userId,
          name: candidate.name,
          specialization: candidate.specialization,
          isAvailable: false,
          isVerified: true,
          avgRating: 0,
        },
      ]);
      setCandidate(null);
      setInviteEmail("");
    });
  }

  function handleRemove(mechanicId: string) {
    startTransition(async () => {
      await removeMechanicFromShop(mechanicId);
      setMechanics((prev) => prev.filter((m) => m.id !== mechanicId));
    });
  }

  return (
    <div className="space-y-5">
      {/* Invite */}
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4 space-y-3">
        <p className="text-sm font-medium text-zinc-100">Invite a mechanic</p>
        <p className="text-xs text-zinc-500">
          Search by email — only independent, verified mechanics not already at another shop can be added.
        </p>
        <div className="flex gap-2">
          <input
            type="email"
            value={inviteEmail}
            onChange={(e) => setInviteEmail(e.target.value)}
            placeholder="mechanic@email.com"
            className="flex-1 px-3 py-2 rounded-xl bg-zinc-800/60 border border-zinc-700
              text-zinc-100 text-sm placeholder:text-zinc-600 outline-none focus:border-amber-400/50"
          />
          <button
            onClick={handleSearch}
            disabled={isPending || !inviteEmail}
            className="px-4 py-2 rounded-xl bg-amber-400 text-zinc-900 text-sm font-medium
              active:scale-[0.98] transition-all disabled:opacity-50"
          >
            Search
          </button>
        </div>
        {error && <p className="text-xs text-orange-400 bg-orange-500/[0.07] rounded-lg px-3 py-2">{error}</p>}
        {candidate && (
          <div className="flex items-center justify-between rounded-xl bg-zinc-800/40 border border-zinc-700 p-3">
            <div>
              <p className="text-sm text-zinc-100">{candidate.name}</p>
              <p className="text-xs text-zinc-500">{candidate.specialization} · {candidate.yearsExperience ?? 0} yrs</p>
            </div>
            <button
              onClick={handleAdd}
              disabled={isPending}
              className="text-xs text-zinc-900 bg-amber-400 px-3 py-1.5 rounded-lg font-medium
                active:scale-[0.98] transition-all disabled:opacity-50"
            >
              Add to shop
            </button>
          </div>
        )}
      </div>

      {/* Roster */}
      {mechanics.length === 0 ? (
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-8 text-center">
          <p className="text-sm text-zinc-500">No mechanics on your roster yet.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {mechanics.map((m) => (
            <div key={m.id} className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-3.5
              flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm text-zinc-100 truncate">{m.name}</p>
                <p className="text-xs text-zinc-500">{m.specialization}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {m.avgRating > 0 && <span className="text-xs text-amber-400">★ {m.avgRating}</span>}
                <span className={`text-[10px] px-2 py-0.5 rounded-full border ${
                  m.isAvailable
                    ? "text-emerald-400 bg-emerald-400/10 border-emerald-400/20"
                    : "text-zinc-500 bg-zinc-800/40 border-zinc-800"
                }`}>
                  {m.isAvailable ? "Available" : "Offline"}
                </span>
                <button
                  onClick={() => handleRemove(m.id)}
                  disabled={isPending}
                  className="text-xs text-red-400 disabled:opacity-50"
                >
                  Remove
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}