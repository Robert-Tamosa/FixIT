"use client";

import { useState }        from "react";
import { approveMechanic, rejectMechanic, approveShop, rejectShop } from "./admin";
// ── Exported display types ────────────────────────────────────────────────────

export interface AdminStats {
  owners:               number;
  approvedMechanics:    number;
  pendingVerifications: number;
  totalBookings:        number;
}

export interface PendingMechanic {
  userId:            string;
  name:              string;
  email:             string;
  phone:             string | null;
  shopName:          string | null;
  specialization:    string;
  yearsExperience:   number | null;
  certificationFile: string | null;
  bio:               string | null;
  appliedAt:         string;
}

export interface PendingShop {
  shopId:     string;
  name:       string;
  ownerName:  string;
  ownerEmail: string;
  address:    string;
  phone:      string | null;
  services:   string[];
  appliedAt:  string;
}

export interface RecentBooking {
  id:                 string;
  status:             string;
  ownerName:          string;
  mechanicName:       string;
  vehicleLabel:       string;
  problemDescription: string;
  createdAt:          string;
}

export interface AdminUser {
  id:        string;
  name:      string;
  email:     string;
  role:      string;
  createdAt: string;
  verified:  boolean;
}

// ── Status badge config ───────────────────────────────────────────────────────

const STATUS_STYLES: Record<string, string> = {
  PENDING:     "bg-amber-400/10  text-amber-400  border-amber-400/20",
  CONFIRMED:   "bg-blue-400/10   text-blue-400   border-blue-400/20",
  EN_ROUTE:    "bg-purple-400/10 text-purple-400 border-purple-400/20",
  IN_PROGRESS: "bg-cyan-400/10   text-cyan-400   border-cyan-400/20",
  DONE:        "bg-emerald-400/10 text-emerald-400 border-emerald-400/20",
  CANCELLED:   "bg-zinc-700      text-zinc-400   border-zinc-600",
};

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-md border ${STATUS_STYLES[status] ?? STATUS_STYLES.PENDING}`}>
      {status.replace("_", " ")}
    </span>
  );
}

// ── Stat Card ─────────────────────────────────────────────────────────────────

function StatCard({
  label, value, highlight = false, icon,
}: {
  label: string; value: number; highlight?: boolean; icon: React.ReactNode;
}) {
  return (
    <div className={[
      "flex items-center gap-3.5 px-4 py-3.5 rounded-2xl border transition-all",
      highlight && value > 0
        ? "bg-amber-400/10 border-amber-400/25"
        : "bg-white/[0.03] border-white/[0.07]",
    ].join(" ")}>
      <div className={[
        "w-10 h-10 rounded-xl flex items-center justify-center shrink-0",
        highlight && value > 0
          ? "bg-amber-400/15 border border-amber-400/25"
          : "bg-white/[0.05] border border-white/[0.08]",
      ].join(" ")}>
        {icon}
      </div>
      <div>
        <p className={`text-xl font-black leading-none ${highlight && value > 0 ? "text-amber-400" : "text-zinc-100"}`}>
          {value}
        </p>
        <p className="text-[11px] text-zinc-500 mt-0.5">{label}</p>
      </div>
    </div>
  );
}

// ── Mechanic Verification Card ────────────────────────────────────────────────

function MechanicVerificationCard({ mechanic }: { mechanic: PendingMechanic }) {
  const [status, setStatus] = useState<"idle" | "approving" | "rejecting">("idle");

  async function handleApprove() {
    setStatus("approving");
    await approveMechanic(mechanic.userId);
  }

  async function handleReject() {
    setStatus("rejecting");
    await rejectMechanic(mechanic.userId);
  }

  const initials = mechanic.name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);

  return (
    <div className="bg-white/[0.03] border border-white/[0.08] rounded-2xl p-5">
      {/* Header */}
      <div className="flex items-start gap-3.5 mb-4">
        <div className="w-12 h-12 rounded-xl bg-amber-400/10 border border-amber-400/20
          flex items-center justify-center shrink-0 text-sm font-bold text-amber-400">
          {initials}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-zinc-100 text-[15px] leading-tight">{mechanic.name}</p>
          <p className="text-xs text-zinc-500 mt-0.5">{mechanic.email}</p>
          {mechanic.phone && (
            <p className="text-xs text-zinc-600 mt-0.5">{mechanic.phone}</p>
          )}
        </div>
        <span className="text-[10px] text-zinc-600 shrink-0">{mechanic.appliedAt}</span>
      </div>

      {/* Details */}
      <div className="grid grid-cols-2 gap-2 mb-4">
        {[
          { label: "Shop",           value: mechanic.shopName       ?? "Not provided" },
          { label: "Specialization", value: mechanic.specialization                   },
          { label: "Experience",     value: mechanic.yearsExperience != null
              ? `${mechanic.yearsExperience} yr${mechanic.yearsExperience !== 1 ? "s" : ""}`
              : "Not specified" },
        ].map(({ label, value }) => (
          <div key={label} className="bg-white/[0.03] rounded-xl px-3 py-2.5 border border-white/[0.06]">
            <p className="text-[10px] text-zinc-600 uppercase tracking-wider mb-0.5">{label}</p>
            <p className="text-xs font-medium text-zinc-200 truncate">{value}</p>
          </div>
        ))}

        {mechanic.certificationFile && (
          <a
            href={mechanic.certificationFile}
            target="_blank"
            rel="noopener noreferrer"
            className="bg-white/[0.03] rounded-xl px-3 py-2.5 border border-white/[0.06]
              flex items-center gap-2 hover:bg-white/[0.06] transition-colors col-span-1"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"
                stroke="#F59E0B" strokeWidth="1.5" strokeLinecap="round" />
              <path d="M14 2v6h6" stroke="#F59E0B" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            <span className="text-[11px] text-amber-400 font-medium">View Certificate</span>
          </a>
        )}
      </div>

      {mechanic.bio && (
        <p className="text-xs text-zinc-500 leading-relaxed mb-4 line-clamp-2">{mechanic.bio}</p>
      )}

      {/* Actions */}
      <div className="flex gap-2.5">
        <button
          onClick={handleReject}
          disabled={status !== "idle"}
          className="flex-1 py-2.5 rounded-xl border border-red-500/20 bg-red-500/5
            text-red-400 text-sm font-semibold
            hover:bg-red-500/10 active:scale-[0.98]
            transition-all disabled:opacity-40 disabled:cursor-not-allowed
            flex items-center justify-center gap-1.5"
        >
          {status === "rejecting" ? (
            <span className="w-4 h-4 rounded-full border-2 border-red-400/30 border-t-red-400 animate-spin" />
          ) : "Reject"}
        </button>
        <button
          onClick={handleApprove}
          disabled={status !== "idle"}
          className="flex-[2] py-2.5 rounded-xl bg-emerald-500/15 border border-emerald-500/25
            text-emerald-400 text-sm font-semibold
            hover:bg-emerald-500/20 active:scale-[0.98]
            transition-all disabled:opacity-40 disabled:cursor-not-allowed
            flex items-center justify-center gap-1.5"
        >
          {status === "approving" ? (
            <span className="w-4 h-4 rounded-full border-2 border-emerald-400/30 border-t-emerald-400 animate-spin" />
          ) : (
            <>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="2.5"
                  strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Approve
            </>
          )}
        </button>
      </div>
    </div>
  );
}

// ── Shop Verification Card ────────────────────────────────────────────────────

function ShopVerificationCard({ shop }: { shop: PendingShop }) {
  const [status, setStatus] = useState<"idle" | "approving" | "rejecting">("idle");

  async function handleApprove() {
    setStatus("approving");
    await approveShop(shop.shopId);
  }

  async function handleReject() {
    setStatus("rejecting");
    await rejectShop(shop.shopId);
  }

  const initials = shop.name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);

  return (
    <div className="bg-white/[0.03] border border-white/[0.08] rounded-2xl p-5">
      {/* Header */}
      <div className="flex items-start gap-3.5 mb-4">
        <div className="w-12 h-12 rounded-xl bg-amber-400/10 border border-amber-400/20
          flex items-center justify-center shrink-0 text-sm font-bold text-amber-400">
          {initials}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-zinc-100 text-[15px] leading-tight">{shop.name}</p>
          <p className="text-xs text-zinc-500 mt-0.5">{shop.ownerName} · {shop.ownerEmail}</p>
          {shop.phone && (
            <p className="text-xs text-zinc-600 mt-0.5">{shop.phone}</p>
          )}
        </div>
        <span className="text-[10px] text-zinc-600 shrink-0">{shop.appliedAt}</span>
      </div>

      {/* Details */}
      <div className="grid grid-cols-2 gap-2 mb-4">
        <div className="bg-white/[0.03] rounded-xl px-3 py-2.5 border border-white/[0.06] col-span-2">
          <p className="text-[10px] text-zinc-600 uppercase tracking-wider mb-0.5">Address</p>
          <p className="text-xs font-medium text-zinc-200 truncate">{shop.address}</p>
        </div>

        {shop.services.length > 0 && (
          <div className="bg-white/[0.03] rounded-xl px-3 py-2.5 border border-white/[0.06] col-span-2">
            <p className="text-[10px] text-zinc-600 uppercase tracking-wider mb-1.5">Services</p>
            <div className="flex flex-wrap gap-1.5">
              {shop.services.map((s) => (
                <span key={s} className="text-[10px] text-zinc-300 bg-white/[0.04]
                  border border-white/[0.06] px-2 py-0.5 rounded-full">
                  {s}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex gap-2.5">
        <button
          onClick={handleReject}
          disabled={status !== "idle"}
          className="flex-1 py-2.5 rounded-xl border border-red-500/20 bg-red-500/5
            text-red-400 text-sm font-semibold
            hover:bg-red-500/10 active:scale-[0.98]
            transition-all disabled:opacity-40 disabled:cursor-not-allowed
            flex items-center justify-center gap-1.5"
        >
          {status === "rejecting" ? (
            <span className="w-4 h-4 rounded-full border-2 border-red-400/30 border-t-red-400 animate-spin" />
          ) : "Reject"}
        </button>
        <button
          onClick={handleApprove}
          disabled={status !== "idle"}
          className="flex-[2] py-2.5 rounded-xl bg-emerald-500/15 border border-emerald-500/25
            text-emerald-400 text-sm font-semibold
            hover:bg-emerald-500/20 active:scale-[0.98]
            transition-all disabled:opacity-40 disabled:cursor-not-allowed
            flex items-center justify-center gap-1.5"
        >
          {status === "approving" ? (
            <span className="w-4 h-4 rounded-full border-2 border-emerald-400/30 border-t-emerald-400 animate-spin" />
          ) : (
            <>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="2.5"
                  strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Approve
            </>
          )}
        </button>
      </div>
    </div>
  );
}

// ── Main dashboard ────────────────────────────────────────────────────────────

interface AdminDashboardProps {
  adminName:         string;
  stats:             AdminStats;
  pendingMechanics:  PendingMechanic[];
  pendingShops:      PendingShop[];
  recentBookings:    RecentBooking[];
  recentUsers:       AdminUser[];
}

export default function AdminDashboardView({
  adminName,
  stats,
  pendingMechanics,
  pendingShops,
  recentBookings,
  recentUsers,
}: AdminDashboardProps) {
  const [activeTab, setActiveTab] = useState<"queue" | "shops" | "bookings" | "users">("queue");
  const firstName = adminName.split(" ")[0];

  return (
    <div className="min-h-screen w-screen bg-[#080909] relative">

      {/* Ambient background */}
      <div aria-hidden="true" className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[700px] h-[400px]
          bg-amber-400/[0.02] rounded-full blur-[120px]" />
      </div>

      <div className="relative z-10 max-w-4xl mx-auto px-4 pt-8 pb-16">

        {/* ── Header ── */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[22px] font-black tracking-tight text-zinc-100 leading-none">
                Fix<span className="text-amber-400">IT</span>
              </span>
              <span className="text-[10px] font-bold text-amber-400 bg-amber-400/10
                border border-amber-400/20 px-2 py-0.5 rounded-md">
                ADMIN
              </span>
            </div>
            <p className="text-sm text-zinc-500">
              Welcome back, <span className="text-zinc-300">{firstName}</span>
            </p>
          </div>

          {/* Pending alert */}
          {stats.pendingVerifications > 0 && (
            <div className="flex items-center gap-2 px-3.5 py-2 rounded-xl
              bg-amber-400/10 border border-amber-400/20">
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
              <span className="text-sm font-semibold text-amber-400">
                {stats.pendingVerifications} pending
              </span>
            </div>
          )}
        </div>

        {/* ── Stats ── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
          <StatCard
            label="Vehicle Owners"
            value={stats.owners}
            icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#71717A" strokeWidth="1.5" strokeLinecap="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>}
          />
          <StatCard
            label="Active Mechanics"
            value={stats.approvedMechanics}
            icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#71717A" strokeWidth="1.5" strokeLinecap="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>}
          />
          <StatCard
            label="Pending Review"
            value={stats.pendingVerifications}
            highlight
            icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={stats.pendingVerifications > 0 ? "#F59E0B" : "#71717A"} strokeWidth="1.5" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>}
          />
          <StatCard
            label="Total Bookings"
            value={stats.totalBookings}
            icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#71717A" strokeWidth="1.5" strokeLinecap="round"><path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2"/><rect x="9" y="3" width="6" height="4" rx="1"/></svg>}
          />
        </div>

        {/* ── Tabs ── */}
        <div className="flex bg-white/[0.04] border border-white/[0.06] rounded-2xl p-1 mb-6">
          {([
            { key: "queue",    label: "Verification Queue", count: stats.pendingVerifications },
            { key: "shops",    label: "Shop Verification",  count: pendingShops.length         },
            { key: "bookings", label: "Bookings",           count: stats.totalBookings        },
            { key: "users",    label: "Recent Users",       count: null                       },
          ] as const).map(({ key, label, count }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={[
                "flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-all",
                activeTab === key
                  ? "bg-amber-400 text-[#080909]"
                  : "text-zinc-500 hover:text-zinc-300",
              ].join(" ")}
            >
              {label}
              {count != null && count > 0 && (
                <span className={[
                  "text-[10px] font-bold px-1.5 py-0.5 rounded-md",
                  activeTab === key ? "bg-black/15 text-[#080909]" : "bg-white/[0.08] text-zinc-400",
                ].join(" ")}>
                  {count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* ── Verification Queue tab ── */}
        {activeTab === "queue" && (
          <div>
            {pendingMechanics.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 gap-3">
                <div className="w-14 h-14 rounded-2xl bg-emerald-400/10 border border-emerald-400/20
                  flex items-center justify-center">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <path d="M20 6L9 17l-5-5" stroke="#34D399" strokeWidth="2"
                      strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
                <p className="text-zinc-300 font-semibold">All caught up!</p>
                <p className="text-sm text-zinc-600">No mechanics pending verification.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {pendingMechanics.map((m) => (
                  <MechanicVerificationCard key={m.userId} mechanic={m} />
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Shop Verification tab ── */}
        {activeTab === "shops" && (
          <div>
            {pendingShops.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 gap-3">
                <div className="w-14 h-14 rounded-2xl bg-emerald-400/10 border border-emerald-400/20
                  flex items-center justify-center">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <path d="M20 6L9 17l-5-5" stroke="#34D399" strokeWidth="2"
                      strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
                <p className="text-zinc-300 font-semibold">All caught up!</p>
                <p className="text-sm text-zinc-600">No shops pending verification.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {pendingShops.map((s) => (
                  <ShopVerificationCard key={s.shopId} shop={s} />
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Bookings tab ── */}
        {activeTab === "bookings" && (
          <div className="space-y-2.5">
            {recentBookings.length === 0 ? (
              <p className="text-zinc-600 text-sm text-center py-12">No bookings yet.</p>
            ) : (
              recentBookings.map((b) => (
                <div key={b.id}
                  className="flex items-center gap-3 bg-white/[0.03] border border-white/[0.07]
                    rounded-2xl px-4 py-3.5">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <p className="text-sm font-semibold text-zinc-100 truncate">
                        {b.ownerName}
                        <span className="text-zinc-600 font-normal mx-1.5">→</span>
                        {b.mechanicName}
                      </p>
                    </div>
                    <p className="text-xs text-zinc-500 truncate">
                      {b.vehicleLabel} · {b.problemDescription}
                    </p>
                  </div>
                  <div className="text-right shrink-0 space-y-1">
                    <StatusBadge status={b.status} />
                    <p className="text-[10px] text-zinc-600">{b.createdAt}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* ── Users tab ── */}
        {activeTab === "users" && (
          <div className="space-y-2.5">
            {recentUsers.map((u) => (
              <div key={u.id}
                className="flex items-center gap-3 bg-white/[0.03] border border-white/[0.07]
                  rounded-2xl px-4 py-3.5">
                <div className="w-10 h-10 rounded-xl bg-white/[0.05] border border-white/[0.08]
                  flex items-center justify-center shrink-0">
                  <span className="text-xs font-bold text-zinc-400">
                    {u.name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2)}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-zinc-100 truncate">{u.name}</p>
                  <p className="text-xs text-zinc-500 truncate">{u.email}</p>
                </div>
                <div className="text-right shrink-0 space-y-1">
                  <span className={[
                    "text-[10px] font-semibold px-2 py-0.5 rounded-md border",
                    u.role === "ADMIN"    ? "bg-purple-400/10 text-purple-400 border-purple-400/20" :
                    u.role === "MECHANIC" ? "bg-amber-400/10  text-amber-400  border-amber-400/20"  :
                                           "bg-zinc-800       text-zinc-400   border-zinc-700",
                  ].join(" ")}>
                    {u.role}
                  </span>
                  <p className="text-[10px] text-zinc-600">{u.createdAt}</p>
                </div>
              </div>
            ))}
          </div>
        )}

      </div>
    </div>
  );
}