"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { BottomNav } from "../_mechanic-dashboard";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface MechanicProfileProps {
  id:                 string;
  name:               string;
  email:              string;
  phone:              string | null;
  image:              string | null;
  shopName:           string | null;
  bio:                string | null;
  specialization:     string;
  yearsExperience:    number | null;
  isVerified:         boolean;
  isAvailable:        boolean;
  verificationStatus: "PENDING" | "APPROVED" | "REJECTED";
  // Stats
  totalJobs:          number;
  completedJobs:      number;
  avgRating:          number;
  totalReviews:       number;
  totalEarnings:      string;
  memberSince:        string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function getInitials(name: string): string {
  return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
}

// ── Star rating ───────────────────────────────────────────────────────────────

function Stars({ value, size = 14 }: { value: number; size?: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1,2,3,4,5].map((s) => (
        <svg key={s} width={size} height={size} viewBox="0 0 24 24" aria-hidden="true"
          fill={s <= Math.round(value) ? "#F59E0B" : "none"}
          stroke={s <= Math.round(value) ? "#F59E0B" : "#3F3F46"} strokeWidth="1.5">
          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
        </svg>
      ))}
    </div>
  );
}

// ── Settings Drawer ───────────────────────────────────────────────────────────

function SettingsDrawer({
  open,
  onClose,
  onSignOut,
}: {
  open:      boolean;
  onClose:   () => void;
  onSignOut: () => void;
}) {
  const router = useRouter();

  const items = [
    {
      label: "Edit Profile",
      icon:  "M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z",
      color: "text-zinc-300",
      onClick: () => { onClose(); router.push("/dashboard/mechanic/profile/edit"); },
    },
    {
      label: "Notifications",
      icon:  "M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 0 1-3.46 0",
      color: "text-zinc-300",
      onClick: () => { onClose(); },
    },
    {
      label: "Privacy & Security",
      icon:  "M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z",
      color: "text-zinc-300",
      onClick: () => { onClose(); },
    },
    {
      label: "Help & Support",
      icon:  "M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3M12 17h.01",
      color: "text-zinc-300",
      onClick: () => { onClose(); },
    },
    {
      label: "Sign Out",
      icon:  "M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9",
      color: "text-red-400",
      onClick: onSignOut,
    },
  ];

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center
        bg-black/70 backdrop-blur-sm px-4 pb-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      role="dialog" aria-modal="true" aria-label="Settings"
    >
      <div className="w-full max-w-md rounded-3xl border border-white/[0.08]
        bg-[#0e0e0f] shadow-2xl overflow-hidden
        animate-in slide-in-from-bottom-4 duration-300">

        {/* Drawer header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-4
          border-b border-zinc-800/60">
          <h2 className="text-base font-semibold text-zinc-100">Settings</h2>
          <button onClick={onClose} aria-label="Close"
            className="w-8 h-8 rounded-lg flex items-center justify-center
              text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.05] transition-colors">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M1 1l12 12M13 1L1 13" stroke="currentColor"
                strokeWidth="1.6" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {/* Items */}
        <div className="py-2">
          {items.map(({ label, icon, color, onClick }) => (
            <button
              key={label}
              onClick={onClick}
              className={`w-full flex items-center gap-3.5 px-5 py-3.5
                hover:bg-white/[0.04] transition-colors text-left ${color}`}>
              <div className="w-9 h-9 rounded-xl bg-white/[0.04] border border-white/[0.07]
                flex items-center justify-center shrink-0">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
                  stroke="currentColor" strokeWidth="1.6"
                  strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d={icon} />
                </svg>
              </div>
              <span className="text-sm font-medium">{label}</span>
              {label !== "Sign Out" && (
                <svg className="ml-auto" width="14" height="14" viewBox="0 0 24 24"
                  fill="none" stroke="#3F3F46" strokeWidth="1.8"
                  strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M9 18l6-6-6-6" />
                </svg>
              )}
            </button>
          ))}
        </div>

        {/* Version */}
        <div className="px-5 py-3 border-t border-zinc-800/60">
          <p className="text-[11px] text-zinc-700 text-center">FixIT Mechanic App · v1.0.0</p>
        </div>
      </div>
    </div>
  );
}

// ── Stat card ─────────────────────────────────────────────────────────────────

function StatCard({ label, value, sub, icon }: {
  label: string; value: string; sub?: string; icon: string;
}) {
  return (
    <div className="flex flex-col gap-2 p-4 rounded-2xl bg-white/[0.03] border border-white/[0.07]">
      <div className="w-8 h-8 rounded-xl bg-amber-400/10 border border-amber-400/20
        flex items-center justify-center">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
          stroke="#F59E0B" strokeWidth="1.6" strokeLinecap="round"
          strokeLinejoin="round" aria-hidden="true">
          <path d={icon} />
        </svg>
      </div>
      <div>
        <p className="text-lg font-black text-zinc-100 leading-none">{value}</p>
        {sub && <p className="text-[11px] text-zinc-600 mt-0.5">{sub}</p>}
        <p className="text-xs text-zinc-500 mt-0.5">{label}</p>
      </div>
    </div>
  );
}

// ── Main view ─────────────────────────────────────────────────────────────────

export default function MechanicProfileView(props: MechanicProfileProps) {
  const router   = useRouter();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [signingOut,   setSigningOut]   = useState(false);

  const initials = getInitials(props.name);
  const completionRate = props.totalJobs > 0
    ? Math.round((props.completedJobs / props.totalJobs) * 100)
    : 100;

  async function handleSignOut() {
    setSigningOut(true);
    await authClient.signOut();
    router.push("/signIn");
  }

  const specializations = props.specialization
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  const SPECIALTY_LABELS: Record<string, string> = {
    ENGINE_REPAIR: "Engine Repair",
    ELECTRICAL:    "Electrical",
    BRAKES:        "Brakes",
    TIRES:         "Tires",
    AIRCON:        "Air Conditioning",
    DIAGNOSTICS:   "Diagnostics",
  };

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

        {/* Top bar */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden="true">
              <path d="M10 2L4 4.5V10.5C4 14.7 6.8 18.5 10 19.5C13.2 18.5 16 14.7 16 10.5V4.5L10 2Z"
                fill="#F59E0B" fillOpacity="0.25" stroke="#F59E0B" strokeWidth="1.2" />
              <path d="M7.5 10.5L9.5 12.5L13.5 8.5"
                stroke="#F59E0B" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span className="text-[18px] font-black tracking-tight text-zinc-100">
              Fix<span className="text-amber-400">IT</span>
            </span>
          </div>
          <button
            onClick={() => setSettingsOpen(true)}
            aria-label="Open settings"
            className="w-10 h-10 rounded-xl bg-white/[0.04] border border-white/[0.08]
              flex items-center justify-center hover:bg-white/[0.07] transition-colors">
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <circle cx="12" cy="12" r="3" stroke="#71717A" strokeWidth="1.6" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"
                stroke="#71717A" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>

        {/* Avatar + name */}
        <div className="flex flex-col items-center mb-6">
          <div className="relative mb-3">
            {props.image ? (
              <img src={props.image} alt={props.name}
                className="w-24 h-24 rounded-full object-cover border-2 border-amber-400/30" />
            ) : (
              <div className="w-24 h-24 rounded-full bg-amber-400/10 border-2 border-amber-400/30
                flex items-center justify-center">
                <span className="text-2xl font-black text-amber-400">{initials}</span>
              </div>
            )}
            {/* Online indicator */}
            <span className={`absolute bottom-1 right-1 w-4 h-4 rounded-full border-2 border-[#080909]
              ${props.isAvailable ? "bg-emerald-400" : "bg-zinc-600"}`} />
          </div>

          <h1 className="text-xl font-black text-zinc-100 mb-1">{props.name}</h1>

          <div className="flex items-center gap-2 flex-wrap justify-center mb-2">
            {/* Verified badge */}
            {props.isVerified && (
              <span className="flex items-center gap-1 text-[11px] font-semibold
                text-emerald-400 bg-emerald-400/10 border border-emerald-400/20
                px-2.5 py-1 rounded-full">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none">
                  <path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="2.5"
                    strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                Verified
              </span>
            )}
            {/* Availability */}
            <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-full border ${
              props.isAvailable
                ? "text-emerald-400 bg-emerald-400/10 border-emerald-400/20"
                : "text-zinc-500 bg-zinc-800 border-zinc-700"
            }`}>
              {props.isAvailable ? "Available" : "Unavailable"}
            </span>
          </div>

          {/* Rating */}
          {props.avgRating > 0 && (
            <div className="flex items-center gap-2">
              <Stars value={props.avgRating} />
              <span className="text-sm font-bold text-zinc-200">{props.avgRating.toFixed(1)}</span>
              <span className="text-xs text-zinc-500">({props.totalReviews} reviews)</span>
            </div>
          )}
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-2 gap-2.5 mb-5">
          <StatCard
            label="Total Jobs"
            value={String(props.totalJobs)}
            icon="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2M9 5a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2M9 5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2"
          />
          <StatCard
            label="Completion Rate"
            value={`${completionRate}%`}
            sub={`${props.completedJobs} completed`}
            icon="M22 11.08V12a10 10 0 1 1-5.93-9.14M22 4L12 14.01l-3-3"
          />
          <StatCard
            label="Total Earnings"
            value={props.totalEarnings}
            icon="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"
          />
          <StatCard
            label="Member Since"
            value={props.memberSince}
            icon="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2z"
          />
        </div>

        {/* About */}
        <div className="mb-4 rounded-2xl border border-white/[0.08] bg-white/[0.03] p-4">
          <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wide mb-3">
            About
          </p>
          <div className="space-y-2.5">
            {props.bio && (
              <p className="text-sm text-zinc-300 leading-relaxed">{props.bio}</p>
            )}
            {props.shopName && (
              <div className="flex items-center gap-2.5">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"
                    stroke="#71717A" strokeWidth="1.5" strokeLinecap="round" />
                  <path d="M9 22V12h6v10" stroke="#71717A" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
                <span className="text-sm text-zinc-400">{props.shopName}</span>
              </div>
            )}
            {props.yearsExperience !== null && (
              <div className="flex items-center gap-2.5">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <circle cx="12" cy="8" r="4" stroke="#71717A" strokeWidth="1.5" />
                  <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" stroke="#71717A" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
                <span className="text-sm text-zinc-400">
                  {props.yearsExperience} year{props.yearsExperience !== 1 ? "s" : ""} of experience
                </span>
              </div>
            )}
            <div className="flex items-center gap-2.5">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"
                  stroke="#71717A" strokeWidth="1.5" />
                <path d="M22 6l-10 7L2 6" stroke="#71717A" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
              <span className="text-sm text-zinc-400">{props.email}</span>
            </div>
            {props.phone && (
              <div className="flex items-center gap-2.5">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.63 3.4 2 2 0 0 1 3.6 1.22h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.9a16 16 0 0 0 6 6l.95-.96a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"
                    stroke="#71717A" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
                <span className="text-sm text-zinc-400">{props.phone}</span>
              </div>
            )}
          </div>
        </div>

        {/* Specializations */}
        <div className="mb-4 rounded-2xl border border-white/[0.08] bg-white/[0.03] p-4">
          <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wide mb-3">
            Specializations
          </p>
          <div className="flex flex-wrap gap-2">
            {specializations.length > 0 ? specializations.map((s) => (
              <span key={s}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl
                  bg-amber-400/10 border border-amber-400/20 text-xs font-medium text-amber-300">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"
                    stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                {SPECIALTY_LABELS[s] ?? s}
              </span>
            )) : (
              <p className="text-xs text-zinc-600">No specializations set</p>
            )}
          </div>
        </div>

        {/* Quick actions */}
        <div className="grid grid-cols-2 gap-2.5">
          <button
            onClick={() => router.push("/dashboard/mechanic/jobs")}
            className="flex items-center gap-2.5 px-4 py-3.5 rounded-2xl
              bg-white/[0.03] border border-white/[0.08]
              hover:bg-white/[0.06] transition-colors text-left">
            <div className="w-8 h-8 rounded-xl bg-amber-400/10 border border-amber-400/20
              flex items-center justify-center shrink-0">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2M9 5a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2M9 5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2"
                  stroke="#F59E0B" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </div>
            <div>
              <p className="text-xs font-semibold text-zinc-200">My Jobs</p>
              <p className="text-[10px] text-zinc-600">View all bookings</p>
            </div>
          </button>
          <button
            onClick={() => router.push("/dashboard/mechanic/earnings")}
            className="flex items-center gap-2.5 px-4 py-3.5 rounded-2xl
              bg-white/[0.03] border border-white/[0.08]
              hover:bg-white/[0.06] transition-colors text-left">
            <div className="w-8 h-8 rounded-xl bg-emerald-400/10 border border-emerald-400/20
              flex items-center justify-center shrink-0">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"
                  stroke="#34D399" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </div>
            <div>
              <p className="text-xs font-semibold text-zinc-200">Earnings</p>
              <p className="text-[10px] text-zinc-600">View history</p>
            </div>
          </button>
        </div>
      </div>

      {/* Settings drawer */}
      <SettingsDrawer
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        onSignOut={handleSignOut}
      />

      {/* Sign out loading overlay */}
      {signingOut && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center
          bg-[#080909]/80 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-3">
            <svg className="animate-spin" width="28" height="28" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" stroke="#F59E0B" strokeWidth="3" strokeOpacity="0.25" />
              <path d="M12 2a10 10 0 0 1 10 10" stroke="#F59E0B" strokeWidth="3" strokeLinecap="round" />
            </svg>
            <p className="text-sm text-zinc-400">Signing out…</p>
          </div>
        </div>
      )}

      <BottomNav/>
    </div>
  );
}