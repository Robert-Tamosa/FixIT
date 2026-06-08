"use client";

import { useState } from "react";

// ── Types ─────────────────────────────────────────────────────────────────────

interface Booking {
  id: string;
  mechanicName: string;
  mechanicInitials: string;
  mechanicRating: number;
  service: string;
  status: "pending" | "confirmed" | "en_route" | "in_progress" | "done";
  eta: string;
  price: string;
}

interface Vehicle {
  make: string;
  model: string;
  year: number;
  plate: string;
  color: string;
  health: "good" | "fair" | "needs_attention";
  lastService: string;
  mileage: string;
}

interface Mechanic {
  id: string;
  name: string;
  initials: string;
  specialty: string;
  rating: number;
  reviews: number;
  distance: string;
  available: boolean;
}

// ── Mock data (replace with real Prisma queries) ──────────────────────────────

const mockBooking: Booking = {
  id: "BK-2024-001",
  mechanicName: "Miguel Santos",
  mechanicInitials: "MS",
  mechanicRating: 4.8,
  service: "Engine Diagnostic",
  status: "in_progress",
  eta: "20 mins",
  price: "₱850",
};

const mockVehicle: Vehicle = {
  make: "Toyota",
  model: "Vios",
  year: 2019,
  plate: "ABC 1234",
  color: "Silver",
  health: "good",
  lastService: "2 months ago",
  mileage: "48,200 km",
};

const mockMechanics: Mechanic[] = [
  { id: "1", name: "Miguel Santos", initials: "MS", specialty: "Engine & Transmission", rating: 4.8, reviews: 124, distance: "1.2 km", available: true },
  { id: "2", name: "Jose Reyes",    initials: "JR", specialty: "Electrical Systems",    rating: 4.5, reviews: 89,  distance: "2.4 km", available: false },
  { id: "3", name: "Maria Cruz",    initials: "MC", specialty: "Brakes & Suspension",   rating: 4.9, reviews: 201, distance: "3.1 km", available: true },
  { id: "4", name: "Roberto Tan",   initials: "RT", specialty: "AC & Cooling",          rating: 4.6, reviews: 67,  distance: "3.8 km", available: true },
];

// ── Step config ───────────────────────────────────────────────────────────────

const STEPS  = ["pending", "confirmed", "en_route", "in_progress", "done"] as const;
const LABELS: Record<string, string> = {
  pending: "Pending", confirmed: "Confirmed", en_route: "En Route",
  in_progress: "Active", done: "Done",
};

// ── StarRating ────────────────────────────────────────────────────────────────

function StarRating({ value }: { value: number }) {
  return (
    <div className="flex items-center gap-1">
      <svg width="11" height="11" viewBox="0 0 24 24" fill="#F59E0B" aria-hidden="true">
        <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
      </svg>
      <span className="text-xs font-semibold text-zinc-200">{value}</span>
    </div>
  );
}

// ── Header ────────────────────────────────────────────────────────────────────

function Header({ userName }: { userName: string }) {
  const h = new Date().getHours();
  const greeting = h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";

  return (
    <div className="flex items-center justify-between mb-6">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden="true">
            <path d="M10 2L4 4.5V10.5C4 14.7 6.8 18.5 10 19.5C13.2 18.5 16 14.7 16 10.5V4.5L10 2Z"
              fill="#F59E0B" fillOpacity="0.25" stroke="#F59E0B" strokeWidth="1.2" />
            <path d="M7.5 10.5L9.5 12.5L13.5 8.5" stroke="#F59E0B" strokeWidth="1.4"
              strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span className="text-[20px] font-black tracking-tight text-zinc-100 leading-none">
            Fix<span className="text-amber-400">IT</span>
          </span>
        </div>
        <p className="text-sm text-zinc-500">
          {greeting},{" "}
          <span className="text-zinc-300 font-medium">{session?.user?.name}</span> 👋
        </p>
      </div>

      <div className="flex items-center gap-2.5">
        {/* Notification bell */}
        <button
          aria-label="Notifications"
          className="relative w-10 h-10 rounded-xl bg-white/[0.04] border border-white/[0.08]
            flex items-center justify-center hover:bg-white/[0.07] transition-colors"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" stroke="#71717A" strokeWidth="1.6"
              strokeLinecap="round" strokeLinejoin="round" />
            <path d="M13.73 21a2 2 0 0 1-3.46 0" stroke="#71717A" strokeWidth="1.6"
              strokeLinecap="round" />
          </svg>
          <span className="absolute top-2 right-2 w-2 h-2 bg-amber-400 rounded-full border-2 border-[#080909]" />
        </button>

        {/* Avatar */}
        <div className="w-10 h-10 rounded-xl bg-amber-400/10 border border-amber-400/20
          flex items-center justify-center">
          <span className="text-[11px] font-bold text-amber-400">JD</span>
        </div>
      </div>
    </div>
  );
}

// ── Emergency Button ──────────────────────────────────────────────────────────

function EmergencyButton() {
  const [dispatched, setDispatched] = useState(false);

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
          <p className="text-xs text-zinc-500">Nearest mechanic dispatched · Est. 8 mins</p>
        </div>
        <button
          onClick={() => setDispatched(false)}
          className="ml-auto text-xs text-zinc-600 hover:text-zinc-400 transition-colors"
        >
          Cancel
        </button>
      </div>
    );
  }

  return (
    <div className="relative mb-5">
      {/* Pulsing ring */}
      <div
        aria-hidden="true"
        className="absolute inset-0 rounded-2xl bg-red-500/15 animate-ping"
        style={{ animationDuration: "2.5s" }}
      />
      <button
        onClick={() => setDispatched(true)}
        className="relative w-full py-[18px] rounded-2xl
          bg-gradient-to-r from-red-600 to-rose-500
          border border-red-500/30
          flex items-center justify-center gap-3.5
          active:scale-[0.98] transition-transform duration-100
          shadow-[0_6px_36px_rgba(239,68,68,0.28)]"
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path
            d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"
            fill="white" fillOpacity="0.15" stroke="white" strokeWidth="1.5"
            strokeLinecap="round" strokeLinejoin="round"
          />
          <line x1="12" y1="9" x2="12" y2="13" stroke="white" strokeWidth="2" strokeLinecap="round" />
          <line x1="12" y1="17" x2="12.01" y2="17" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
        </svg>
        <div className="text-left">
          <p className="text-white font-bold text-[15px] leading-tight">Emergency — Get Help Now</p>
          <p className="text-white/55 text-xs mt-0.5">Dispatch nearest available mechanic</p>
        </div>
      </button>
    </div>
  );
}

// ── Active Booking ────────────────────────────────────────────────────────────

function ActiveBookingCard({ booking }: { booking: Booking }) {
  const stepIndex = STEPS.indexOf(booking.status as typeof STEPS[number]);

  return (
    <div className="bg-white/[0.03] border border-white/[0.08] rounded-2xl p-5 mb-4">
      {/* Title row */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
          <span className="text-sm font-semibold text-zinc-100">Active Booking</span>
        </div>
        <span className="text-[11px] text-zinc-500 font-mono bg-white/[0.04]
          px-2.5 py-1 rounded-lg border border-white/[0.06]">
          {booking.id}
        </span>
      </div>

      {/* Mechanic row */}
      <div className="flex items-center gap-3 mb-5">
        <div className="w-12 h-12 rounded-xl bg-amber-400/10 border border-amber-400/20
          flex items-center justify-center shrink-0">
          <span className="text-sm font-bold text-amber-400">{booking.mechanicInitials}</span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-zinc-100 text-sm">{booking.mechanicName}</p>
          <p className="text-xs text-zinc-500 mt-0.5">{booking.service}</p>
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
            <div key={step} className="flex items-center flex-1 last:flex-none">
              {/* Circle */}
              <div className={[
                "w-6 h-6 rounded-full flex items-center justify-center shrink-0",
                "text-[10px] font-bold transition-all",
                i < stepIndex
                  ? "bg-amber-400 text-[#080909]"
                  : i === stepIndex
                  ? "bg-amber-400/15 border-2 border-amber-400 text-amber-400"
                  : "bg-white/[0.05] text-zinc-600 border border-white/[0.08]",
              ].join(" ")}>
                {i < stepIndex ? (
                  <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
                    <path d="M2 6L5 9L10 3" stroke="#080909" strokeWidth="1.8"
                      strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                ) : (
                  i + 1
                )}
              </div>
              {/* Connector */}
              {i < STEPS.length - 1 && (
                <div className={[
                  "flex-1 h-[2px] mx-1 transition-all",
                  i < stepIndex ? "bg-amber-400" : "bg-white/[0.07]",
                ].join(" ")} />
              )}
            </div>
          ))}
        </div>
        {/* Labels */}
        <div className="flex justify-between">
          {STEPS.map((step, i) => (
            <span key={step} className={[
              "text-[9px] leading-tight",
              i === stepIndex ? "text-amber-400 font-semibold" : "text-zinc-600",
            ].join(" ")}>
              {LABELS[step]}
            </span>
          ))}
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1.5 flex-1 px-3 py-2.5 rounded-xl
          bg-white/[0.03] border border-white/[0.07]">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <circle cx="12" cy="12" r="10" stroke="#71717A" strokeWidth="1.5" />
            <path d="M12 6v6l4 2" stroke="#71717A" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          <span className="text-xs text-zinc-400">
            ETA <span className="text-zinc-200 font-semibold">{booking.eta}</span>
          </span>
        </div>
        <button className="flex-1 py-2.5 px-3 rounded-xl bg-amber-400/10 border border-amber-400/20
          text-amber-400 text-xs font-semibold hover:bg-amber-400/15 transition-colors text-center">
          Track Live
        </button>
        <button
          aria-label="Call mechanic"
          className="w-10 h-10 rounded-xl bg-white/[0.04] border border-white/[0.08]
            flex items-center justify-center hover:bg-white/[0.08] transition-colors shrink-0"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.63 3.4 2 2 0 0 1 3.6 1.22h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L7.91 8.9a16 16 0 0 0 6 6l.95-.96a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"
              stroke="#71717A" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>
    </div>
  );
}

// ── Vehicle Summary ───────────────────────────────────────────────────────────

function VehicleSummaryCard({ vehicle }: { vehicle: Vehicle }) {
  const health = {
    good:            { label: "Good",            cls: "text-emerald-400 bg-emerald-400/10 border-emerald-400/20", dot: "bg-emerald-400" },
    fair:            { label: "Fair",            cls: "text-amber-400   bg-amber-400/10   border-amber-400/20",   dot: "bg-amber-400" },
    needs_attention: { label: "Needs Attention", cls: "text-red-400     bg-red-400/10     border-red-400/20",     dot: "bg-red-400" },
  }[vehicle.health];

  return (
    <div className="bg-white/[0.03] border border-white/[0.08] rounded-2xl p-5 mb-4">
      <div className="flex items-center justify-between mb-4">
        <span className="text-sm font-semibold text-zinc-100">My Vehicle</span>
        <button className="text-xs text-amber-400 hover:text-amber-300 transition-colors">
          Edit
        </button>
      </div>

      <div className="flex items-center gap-4 mb-4">
        {/* Car illustration */}
        <div className="w-[72px] h-[72px] rounded-2xl bg-white/[0.04] border border-white/[0.08]
          flex items-center justify-center shrink-0">
          <svg width="44" height="44" viewBox="0 0 48 48" fill="none" aria-hidden="true">
            <path d="M8 32V36C8 37.1 8.9 38 10 38H14C15.1 38 16 37.1 16 36V34H32V36C32 37.1 32.9 38 34 38H38C39.1 38 40 37.1 40 36V32L36 20H12L8 32Z"
              fill="#F59E0B" fillOpacity="0.1" stroke="#F59E0B" strokeWidth="1.4" strokeLinejoin="round" />
            <rect x="14" y="22" width="20" height="8" rx="1"
              fill="#F59E0B" fillOpacity="0.08" stroke="#F59E0B" strokeWidth="1" />
            <circle cx="16" cy="32" r="3" fill="#F59E0B" fillOpacity="0.25" stroke="#F59E0B" strokeWidth="1.2" />
            <circle cx="32" cy="32" r="3" fill="#F59E0B" fillOpacity="0.25" stroke="#F59E0B" strokeWidth="1.2" />
          </svg>
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <p className="font-bold text-zinc-100 text-[16px] leading-tight">
            {vehicle.make} {vehicle.model}
          </p>
          <p className="text-xs text-zinc-500 mt-0.5">{vehicle.year} · {vehicle.color}</p>
          <div className="flex items-center gap-2 mt-2.5 flex-wrap">
            <span className="text-[11px] text-zinc-300 bg-white/[0.05] border border-white/[0.08]
              px-2 py-0.5 rounded-lg font-mono">
              {vehicle.plate}
            </span>
            <span className={`text-[11px] px-2 py-0.5 rounded-lg border flex items-center gap-1.5 ${health.cls}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${health.dot}`} />
              {health.label}
            </span>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-2.5">
        <div className="bg-white/[0.03] rounded-xl px-3 py-2.5 border border-white/[0.06]">
          <p className="text-[10px] text-zinc-600 uppercase tracking-wider mb-1">Mileage</p>
          <p className="text-sm font-semibold text-zinc-100">{vehicle.mileage}</p>
        </div>
        <div className="bg-white/[0.03] rounded-xl px-3 py-2.5 border border-white/[0.06]">
          <p className="text-[10px] text-zinc-600 uppercase tracking-wider mb-1">Last Service</p>
          <p className="text-sm font-semibold text-zinc-100">{vehicle.lastService}</p>
        </div>
      </div>
    </div>
  );
}

// ── Nearby Mechanics ──────────────────────────────────────────────────────────

function NearbyMechanicsSection({ mechanics }: { mechanics: Mechanic[] }) {
  return (
    <div className="mb-4">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-semibold text-zinc-100">
          Nearby Mechanics
          <span className="ml-2 text-[11px] font-normal text-zinc-500">
            {mechanics.filter(m => m.available).length} available
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
              active:scale-[0.99] transition-all"
          >
            {/* Avatar */}
            <div className={[
              "w-11 h-11 rounded-xl flex items-center justify-center shrink-0 text-sm font-bold",
              m.available
                ? "bg-amber-400/10 border border-amber-400/20 text-amber-400"
                : "bg-white/[0.04] border border-white/[0.07] text-zinc-500",
            ].join(" ")}>
              {m.initials}
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <p className="font-semibold text-zinc-100 text-sm truncate">{m.name}</p>
                <span className={[
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

            {/* Right */}
            <div className="text-right shrink-0">
              <div className="mb-0.5 flex justify-end">
                <StarRating value={m.rating} />
              </div>
              <p className="text-[11px] text-zinc-500">{m.distance}</p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Bottom Nav ────────────────────────────────────────────────────────────────

const NAV_ITEMS = [
  { label: "Home",     active: true,  icon: "M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z M9 22V12h6v10" },
  { label: "Bookings", active: false, icon: "M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2M9 5a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2M9 5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2m-6 9l2 2 4-4" },
  { label: "Search",   active: false, icon: "M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" },
  { label: "Profile",  active: false, icon: "M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2 M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z" },
];

function BottomNav() {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50
      bg-[#080909]/95 backdrop-blur-xl border-t border-white/[0.06]">
      <div className="max-w-2xl mx-auto flex items-center justify-around px-2 py-3 pb-5">
        {NAV_ITEMS.map(({ label, active, icon }) => (
          <button key={label}
            aria-label={label}
            aria-current={active ? "page" : undefined}
            className="flex flex-col items-center gap-1.5 px-4 py-1 rounded-xl
              transition-all active:scale-95"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
              stroke={active ? "#F59E0B" : "#52525B"}
              strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"
              aria-hidden="true">
              <path d={icon} />
            </svg>
            <span className={`text-[10px] font-medium leading-none ${
              active ? "text-amber-400" : "text-zinc-600"
            }`}>
              {label}
            </span>
          </button>
        ))}
      </div>
    </nav>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function OwnerDashboardPage() {
  // TODO: Replace mock data with real data, e.g.:
  // const session = await auth.api.getSession({ headers: await headers() });
  // const booking = await prisma.booking.findFirst({ where: { ownerId: session.user.id, status: { not: "done" } } });
  // const vehicle = await prisma.vehicle.findFirst({ where: { ownerId: session.user.id } });

  return (
    <div className="min-h-screen w-full bg-[#080909] relative">

      {/* Ambient background */}
      <div aria-hidden="true" className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[800px] h-[500px]
          bg-amber-400/[0.025] rounded-full blur-[130px]" />
        <div className="absolute inset-0 opacity-[0.012]"
          style={{
            backgroundImage: "radial-gradient(circle, #F59E0B 1px, transparent 1px)",
            backgroundSize: "28px 28px",
          }} />
      </div>

      {/* Content */}
      <div className="relative z-10 max-w-2xl mx-auto px-4 pt-8 pb-32">
        <Header userName="Juan" />
        <EmergencyButton />
        <ActiveBookingCard booking={mockBooking} />
        <VehicleSummaryCard vehicle={mockVehicle} />
        <NearbyMechanicsSection mechanics={mockMechanics} />
      </div>

      <BottomNav />
    </div>
  );
}