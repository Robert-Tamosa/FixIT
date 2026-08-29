"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { BottomNav } from "@/components/BottomNav";
import VehicleSummaryCard from "@/components/profile/vehicle-summary-card";
import ContactInfoCard from "@/components/profile/contact-info-card";
import AccountStatusCard from "@/components/profile/account-status-card";
import HomeLocationCard from "@/components/profile/home-location-card";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface OwnerProfileProps {
  name:             string | null;
  email:            string;
  phone:            string | null;
  image:            string | null;
  emailVerified:    boolean;
  twoFactorEnabled: boolean;
  vehicles: {
    id:          string;
    brand:       string;
    model:       string;
    plateNumber: string | null;
  }[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function getInitials(name: string | null): string {
  if (!name) return "?";
  return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
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
      onClick: () => { onClose(); router.push("/dashboard/owner/profile/edit"); },
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
      className="fixed inset-0 z-[60] flex items-center justify-center
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
          <p className="text-[11px] text-zinc-700 text-center">FixIT App · v1.0.0</p>
        </div>
      </div>
    </div>
  );
}

// ── Main view ─────────────────────────────────────────────────────────────────

export default function OwnerProfileView(props: OwnerProfileProps) {
  const router = useRouter();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [signingOut,   setSigningOut]   = useState(false);

  const initials = getInitials(props.name);

  async function handleSignOut() {
    setSigningOut(true);
    await authClient.signOut();
    router.push("/signIn");
  }

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
              <img src={props.image} alt={props.name ?? "Profile"}
                className="w-24 h-24 rounded-full object-cover border-2 border-amber-400/30" />
            ) : (
              <div className="w-24 h-24 rounded-full bg-amber-400/10 border-2 border-amber-400/30
                flex items-center justify-center">
                <span className="text-2xl font-black text-amber-400">{initials}</span>
              </div>
            )}
          </div>

          <h1 className="text-xl font-black text-zinc-100 mb-1">{props.name ?? "Unknown"}</h1>

          <div className="flex items-center gap-2 flex-wrap justify-center mb-2">
            <span className="flex items-center gap-1 text-[11px] font-semibold
              text-amber-400 bg-amber-400/10 border border-amber-400/20
              px-2.5 py-1 rounded-full">
              Vehicle Owner
            </span>
            {props.emailVerified && (
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
          </div>

          <p className="text-sm text-zinc-500">{props.email}</p>
        </div>

        {/* Account + Home location */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
          <AccountStatusCard
            emailVerified={props.emailVerified}
            twoFactorEnabled={props.twoFactorEnabled}
          />
          <HomeLocationCard />
        </div>

        {/* Vehicles */}
        <div className="mb-4">
          <VehicleSummaryCard vehicles={props.vehicles} />
        </div>

        {/* Contact */}
        <div className="mb-4">
          <ContactInfoCard email={props.email} phone={props.phone} />
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

      <BottomNav />
    </div>
  );
}