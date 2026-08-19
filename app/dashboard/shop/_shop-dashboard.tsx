"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  getShopBookings,
  acceptShopBooking,
  declineShopBooking,
  type ShopOverviewStats,
  type DisplayShopBooking,
} from "@/app/actions/shop-dashboard";
import { advanceBookingStatus } from "@/app/actions/booking-actions";
import { createEstimate, editEstimate } from "@/app/actions/estimate";
import { generateInvoice } from "@/app/actions/invoice";
import { getPayment, type DisplayPayment } from "@/app/actions/payment";
import { ConfirmCashPaymentButton } from "@/components/payment/ConfirmCashPaymentButton";
import { usePolling } from "@/app/hooks/usePolling";

interface ShopDashboardProps {
  shopName: string;
  shopAddress: string;
  isVerified: boolean;
  stats: ShopOverviewStats;
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
}: ShopDashboardProps) {
  const cards = [
    { label: "Total Bookings", value: stats.totalBookings },
    { label: "Active Jobs", value: stats.activeJobs },
    { label: "Available Mechanics", value: stats.availableMechanics },
    { label: "Today's Revenue", value: formatPHP(stats.todaysRevenue) },
    { label: "Pending Requests", value: stats.pendingRequests },
  ];

  usePolling(6000);

  return (
    <div className="min-h-screen bg-[#080909]">
      <div className="max-w-full mx-auto px-6 py-8 pb-28 space-y-6">
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

        {/* Stat cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {cards.map((c) => (
            <div key={c.label} className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4
              border-l-2 border-l-amber-400/40">
              <p className="text-xl font-semibold text-zinc-100">{c.value}</p>
              <p className="text-xs text-zinc-500 mt-0.5">{c.label}</p>
            </div>
          ))}
        </div>

        {/* Pending requests + active bookings — previously the "Bookings"
            tab; now live directly on Home since full history has its own
            page (Jobs, in BottomNav) and doesn't need a redundant in-page
            tab wrapper. */}
        <BookingActionSections />
      </div>
      <BottomNav />
    </div>
  );
}

// ── Bottom nav — mirrors the mechanic dashboard's BottomNav exactly, one
// extra item ("Roster") since shops manage a mechanic roster and the
// individual-mechanic side has no equivalent concern. Exported so
// jobs/chats/profile pages can import it the same way mechanic pages import
// BottomNav from "../_mechanic-dashboard".

const NAV_ITEMS = [
  {
    label: "Home",
    href: "/dashboard/shop",
    icon: "M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z M9 22V12h6v10",
  },
  {
    label: "Jobs",
    href: "/dashboard/shop/jobs",
    icon: "M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2M9 5a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2M9 5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2m-6 9l2 2 4-4",
  },
  {
    label: "Chats",
    href: "/dashboard/shop/chats",
    icon: "M2.003 5.884L10 12.882l7.997-6.998A2 2 0 0 0 16 4H4a2 2 0 0 0-1.997 1.884z M2 6.118v7.764A2 2 0 0 0 4 16h12a2 2 0 0 0 2-2V6.118l-8 7-8-7z",
  },
  {
    label: "Roster",
    href: "/dashboard/shop/mechanics",
    icon: "M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2 M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z M23 21v-2a4 4 0 0 0-3-3.87 M16 3.13a4 4 0 0 1 0 7.75",
  },
  {
    label: "Profile",
    href: "/dashboard/shop/profile",
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

// ── Booking action sections (Pending Requests + Active Bookings) ────────────

// What the advance button should say/do next, keyed by current status —
// mirrors booking-actions.ts's SHOP_NEXT_STATUS map (every booking in this
// dashboard is a shop booking by definition, so no EN_ROUTE step — the
// owner brings the vehicle to the shop, nobody is traveling to them).
const NEXT_STATUS_LABEL: Record<string, string> = {
  ESTIMATE_ACCEPTED: "Start Job",
  IN_PROGRESS:        "Mark Complete",
};

const ACTIVE_STATUSES = new Set(["CONFIRMED", "ESTIMATE_SENT", "ESTIMATE_ACCEPTED", "IN_PROGRESS"]);

// Fetches its own payment status rather than requiring DisplayShopBooking to
// carry payment fields — keeps this self-contained without needing to touch
// shop-dashboard.ts's query. Only rendered for DONE bookings, so the extra
// fetch only fires for an already-filtered subset.

const MANUALLY_CONFIRMED = ["CASH", "GCASH_DIRECT", "MAYA_DIRECT"];

function PaymentStatusStrip({ bookingId }: { bookingId: string }) {
  const [payment, setPayment] = useState<DisplayPayment | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    getPayment(bookingId)
      .then((p) => { if (!cancelled) setPayment(p); })
      .catch(() => { /* best-effort — leave the row without this strip on error */ })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [bookingId]);

  if (loading) return null;
  if (!payment || !payment.method) return null; // owner hasn't reached payment yet

  if (payment.status === "PAID") {
    return (
      <div className="px-3 py-2 rounded-xl bg-emerald-400/10 border border-emerald-400/20
        text-[11px] font-semibold text-emerald-400 text-center">
        Paid {payment.method === "CASH" ? "in cash" : payment.method === "GCASH_DIRECT" ? "directly via GCash" : payment.method === "MAYA_DIRECT" ? "directly via Maya" : `via ${payment.paidVia ?? "online"}`}
      </div>
    );
  }

  if (MANUALLY_CONFIRMED.includes(payment.method) && payment.status === "PENDING") {
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

  if (payment.method === "ONLINE" && payment.status === "PENDING") {
    return (
      <div className="px-3 py-2 rounded-xl bg-zinc-900/60 border border-zinc-800
        text-[11px] text-zinc-500 text-center">
        Waiting on owner's online payment
      </div>
    );
  }

  return null;
}

// Shared card, used by both the Pending Requests and Active Bookings groups
// below — previously duplicated implicitly inside BookingsTab's single flat
// list; pulled out explicitly now that there are two separate groups, so a
// future change to the card only needs to happen once.
function BookingActionCard({
  booking,
  estimatingId,
  setEstimatingId,
  actioningId,
  actionError,
  onAccept,
  onDecline,
  onAdvance,
  onEstimateDone,
}: {
  booking: DisplayShopBooking;
  estimatingId: string | null;
  setEstimatingId: (id: string | null) => void;
  actioningId: string | null;
  actionError: { id: string; message: string } | null;
  onAccept: (id: string) => void;
  onDecline: (id: string) => void;
  onAdvance: (id: string, status: string) => void;
  onEstimateDone: () => void;
}) {
  const b = booking;
  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4 space-y-2.5">
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

      {estimatingId === b.id ? (
        <ShopEstimateForm
          bookingId={b.id}
          isEdit={b.status === "ESTIMATE_SENT"}
          onDone={async () => { setEstimatingId(null); onEstimateDone(); }}
          onCancel={() => setEstimatingId(null)}
        />
      ) : (
        <div className="flex items-center justify-between pt-1 border-t border-zinc-800 gap-2">
          <p className="text-xs text-zinc-500">
            {STATUS_LABELS[b.status] ?? b.status}
          </p>
          <div className="flex items-center gap-3 shrink-0">
            {b.status === "PENDING" ? (
              <>
                <button
                  onClick={() => onDecline(b.id)}
                  disabled={actioningId === b.id}
                  className="text-xs text-red-400 font-medium disabled:opacity-50"
                >
                  Decline
                </button>
                <button
                  onClick={() => onAccept(b.id)}
                  disabled={actioningId === b.id}
                  className="text-xs text-zinc-900 bg-amber-400 px-3 py-1.5 rounded-lg font-medium
                    active:scale-[0.98] transition-all disabled:opacity-50"
                >
                  {actioningId === b.id ? "Accepting…" : "Accept"}
                </button>
              </>
            ) : b.status === "CONFIRMED" ? (
              <button
                onClick={() => setEstimatingId(b.id)}
                className="text-xs text-zinc-900 bg-amber-400 px-3 py-1.5 rounded-lg font-medium
                  active:scale-[0.98] transition-all"
              >
                Send Estimate
              </button>
            ) : b.status === "ESTIMATE_SENT" ? (
              <button
                onClick={() => setEstimatingId(b.id)}
                className="text-xs text-amber-400 font-medium"
              >
                Edit estimate
              </button>
            ) : NEXT_STATUS_LABEL[b.status] ? (
              <button
                onClick={() => onAdvance(b.id, b.status)}
                disabled={actioningId === b.id}
                className="text-xs text-zinc-900 bg-amber-400 px-3 py-1.5 rounded-lg font-medium
                  active:scale-[0.98] transition-all disabled:opacity-50"
              >
                {actioningId === b.id ? "Updating…" : NEXT_STATUS_LABEL[b.status]}
              </button>
            ) : null}
          </div>
        </div>
      )}
      {actionError && actionError.id === b.id && (
        <p className="text-xs text-orange-400 bg-orange-500/[0.07] rounded-lg px-3 py-2 -mt-1">
          {actionError.message}
        </p>
      )}
      {b.status === "DONE" && <PaymentStatusStrip bookingId={b.id} />}
    </div>
  );
}

function BookingActionSections() {
  const [bookings, setBookings] = useState<DisplayShopBooking[] | null>(null);
  const [doneUnpaidIds, setDoneUnpaidIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [estimatingId, setEstimatingId] = useState<string | null>(null);
  const [invoicingBookingId, setInvoicingBookingId] = useState<string | null>(null);
  const [actioningId, setActioningId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<{ id: string; message: string } | null>(null);

  // Fetches everything (no status filter — full history is /jobs' job now)
  // and splits into Pending / Active client-side. Also checks payment
  // status for any DONE booking — previously these were fetched but then
  // silently dropped (not PENDING, not in ACTIVE_STATUSES, so they matched
  // neither group and just vanished). Now a DONE-but-unpaid booking joins
  // Active instead, same treatment as the owner/mechanic dashboards.
  async function load() {
    setLoading(true);
    try {
      const data = await getShopBookings(undefined);
      setBookings(data);

      const doneBookings = data.filter((b) => b.status === "DONE");
      if (doneBookings.length > 0) {
        const results = await Promise.all(
          doneBookings.map(async (b) => {
            try {
              const p = await getPayment(b.id);
              return { id: b.id, unpaid: !p || p.status !== "PAID" };
            } catch {
              // Best-effort — if we can't confirm payment status, don't
              // claim it's unpaid; leave it out of Active rather than risk
              // a false "payment pending" on something already settled.
              return { id: b.id, unpaid: false };
            }
          }),
        );
        setDoneUnpaidIds(new Set(results.filter((r) => r.unpaid).map((r) => r.id)));
      } else {
        setDoneUnpaidIds(new Set());
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleAdvance(bookingId: string, currentStatus: string) {
    setActionError(null);
    setActioningId(bookingId);
    try {
      await advanceBookingStatus(bookingId);
      if (currentStatus === "IN_PROGRESS") {
        // This call just moved IN_PROGRESS -> DONE — auto-open the invoice
        // modal instead of just refreshing silently, mirroring how the
        // mechanic dashboard's GenerateInvoiceModal auto-opens on the same
        // transition. Don't reload the list yet; the modal's onDone/onCancel
        // handles that once the shop is finished with it.
        setInvoicingBookingId(bookingId);
      } else {
        await load();
      }
    } catch (e) {
      setActionError({ id: bookingId, message: e instanceof Error ? e.message : "Could not update this booking" });
    } finally {
      setActioningId(null);
    }
  }

  async function handleAccept(bookingId: string) {
    setActionError(null);
    setActioningId(bookingId);
    try {
      await acceptShopBooking(bookingId);
      await load();
    } catch (e) {
      setActionError({ id: bookingId, message: e instanceof Error ? e.message : "Could not accept this booking" });
    } finally {
      setActioningId(null);
    }
  }

  async function handleDecline(bookingId: string) {
    setActionError(null);
    setActioningId(bookingId);
    try {
      await declineShopBooking(bookingId);
      await load();
    } catch (e) {
      setActionError({ id: bookingId, message: e instanceof Error ? e.message : "Could not decline this booking" });
    } finally {
      setActioningId(null);
    }
  }

  if (loading) {
    return <p className="text-sm text-zinc-500 py-8 text-center">Loading…</p>;
  }

  const pending = (bookings ?? []).filter((b) => b.status === "PENDING");
  const active  = (bookings ?? []).filter(
    (b) => ACTIVE_STATUSES.has(b.status) || (b.status === "DONE" && doneUnpaidIds.has(b.id)),
  );

  const cardProps = {
    estimatingId,
    setEstimatingId,
    actioningId,
    actionError,
    onAccept: handleAccept,
    onDecline: handleDecline,
    onAdvance: handleAdvance,
    onEstimateDone: load,
  };

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-medium text-zinc-300 mb-2">
          Pending Requests {pending.length > 0 && `(${pending.length})`}
        </p>
        {pending.length === 0 ? (
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6 text-center">
            <p className="text-sm text-zinc-500">No pending requests.</p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {pending.map((b) => (
              <BookingActionCard key={b.id} booking={b} {...cardProps} />
            ))}
          </div>
        )}
      </div>

      <div>
        <p className="text-sm font-medium text-zinc-300 mb-2">
          Active Bookings {active.length > 0 && `(${active.length})`}
        </p>
        {active.length === 0 ? (
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6 text-center">
            <p className="text-sm text-zinc-500">No active bookings right now.</p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {active.map((b) => (
              <BookingActionCard key={b.id} booking={b} {...cardProps} />
            ))}
          </div>
        )}
      </div>

      {invoicingBookingId && (
        <ShopInvoiceModal
          bookingId={invoicingBookingId}
          onDone={async () => { setInvoicingBookingId(null); await load(); }}
          onSkip={async () => { setInvoicingBookingId(null); await load(); }}
        />
      )}
    </div>
  );
}

// ── Shop Invoice Modal ───────────────────────────────────────────────────────
// Auto-opens the moment a job moves IN_PROGRESS -> DONE (see handleAdvance
// above) — mirrors the mechanic dashboard's GenerateInvoiceModal pattern,
// now callable by the shop since generateInvoice() accepts either the
// assigned mechanic or the booking's shop owner. "Skip for now" doesn't
// cancel anything — the job stays DONE either way, this just closes the
// modal without generating an invoice; getInvoice() will still return null
// until one is actually created, from here or elsewhere.

function ShopInvoiceModal({
  bookingId,
  onDone,
  onSkip,
}: {
  bookingId: string;
  onDone: () => void;
  onSkip: () => void;
}) {
  const [items, setItems] = useState([
    { description: "Labor", quantity: 1, unitPrice: "" },
    { description: "Parts", quantity: 1, unitPrice: "" },
  ]);
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function updateItem(idx: number, field: "description" | "quantity" | "unitPrice", value: string) {
    setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, [field]: value } : it)));
  }
  function addItem() {
    setItems((prev) => [...prev, { description: "", quantity: 1, unitPrice: "" }]);
  }
  function removeItem(idx: number) {
    setItems((prev) => prev.filter((_, i) => i !== idx));
  }

  const total = items.reduce(
    (sum, it) => sum + (Number(it.quantity) || 0) * (Number(it.unitPrice) || 0),
    0,
  );

  async function handleSubmit() {
    const cleaned = items
      .filter((it) => it.description.trim() && Number(it.unitPrice) > 0)
      .map((it) => ({
        description: it.description.trim(),
        quantity: Number(it.quantity) || 1,
        unitPrice: Number(it.unitPrice),
      }));
    if (cleaned.length === 0) {
      setError("Add at least one line item with a price.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await generateInvoice(bookingId, cleaned, notes || undefined);
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not generate invoice");
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4">
      <div className="w-full sm:max-w-md bg-[#111318] border border-white/[0.08] rounded-t-3xl sm:rounded-3xl
        p-5 space-y-4 max-h-[85vh] overflow-y-auto">
        <div>
          <p className="text-sm font-semibold text-zinc-100">Generate Invoice</p>
          <p className="text-xs text-zinc-500 mt-0.5">
            Job marked complete — finalize the bill before the owner sees it.
          </p>
        </div>

        <div className="space-y-2">
          {items.map((it, idx) => (
            <div key={idx} className="flex gap-2 items-center">
              <input
                value={it.description}
                onChange={(e) => updateItem(idx, "description", e.target.value)}
                placeholder="Description"
                className="flex-1 min-w-0 px-2.5 py-2 rounded-lg bg-zinc-800/60 border border-zinc-700
                  text-zinc-100 text-xs placeholder:text-zinc-600 outline-none focus:border-amber-400/50"
              />
              <input
                type="number" min="1" value={it.quantity}
                onChange={(e) => updateItem(idx, "quantity", e.target.value)}
                className="w-14 shrink-0 px-2 py-2 rounded-lg bg-zinc-800/60 border border-zinc-700
                  text-zinc-100 text-xs outline-none focus:border-amber-400/50"
              />
              <input
                type="number" min="0" step="0.01" value={it.unitPrice}
                onChange={(e) => updateItem(idx, "unitPrice", e.target.value)}
                placeholder="₱0.00"
                className="w-20 shrink-0 px-2 py-2 rounded-lg bg-zinc-800/60 border border-zinc-700
                  text-zinc-100 text-xs placeholder:text-zinc-600 outline-none focus:border-amber-400/50"
              />
              <button onClick={() => removeItem(idx)} className="shrink-0 text-zinc-600 text-xs px-1">✕</button>
            </div>
          ))}
          <button onClick={addItem} className="text-xs text-amber-400 font-medium">+ Add line item</button>
        </div>

        <textarea
          rows={2}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Notes for the owner (optional)"
          className="w-full px-3 py-2 rounded-xl bg-zinc-800/60 border border-zinc-700
            text-zinc-100 text-sm placeholder:text-zinc-600 outline-none resize-none focus:border-amber-400/50"
        />

        <div className="flex justify-between items-center pt-2 border-t border-zinc-800">
          <span className="text-xs text-zinc-500">Total</span>
          <span className="text-lg font-bold text-amber-400">
            ₱{total.toLocaleString("en-PH", { minimumFractionDigits: 2 })}
          </span>
        </div>

        {error && <p className="text-xs text-orange-400 bg-orange-500/[0.07] rounded-lg px-3 py-2">{error}</p>}

        <div className="flex gap-2">
          <button
            onClick={onSkip}
            disabled={submitting}
            className="flex-1 py-2.5 rounded-xl border border-zinc-700 text-zinc-400
              text-sm font-medium disabled:opacity-40"
          >
            Skip for now
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="flex-1 py-2.5 rounded-xl bg-amber-400 text-zinc-900 text-sm font-bold
              active:scale-[0.98] transition-all disabled:opacity-50"
          >
            {submitting ? "Generating…" : "Generate Invoice"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Shop Estimate Form ───────────────────────────────────────────────────────
// Same shape as the mechanic dashboard's estimate form, but callable by the
// shop owner directly — createEstimate/editEstimate now accept either the
// assigned mechanic or the owner of the booking's shop.

function ShopEstimateForm({
  bookingId,
  isEdit,
  onDone,
  onCancel,
}: {
  bookingId: string;
  isEdit: boolean;
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
      const fn = isEdit ? editEstimate : createEstimate;
      await fn({ bookingId, laborCost: labor, partsCost: parts, notes: notes || undefined });
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not send estimate");
      setSubmitting(false);
    }
  }

  return (
    <div className="pt-2 border-t border-zinc-800 space-y-3">
      <div className="flex gap-2">
        <div className="flex-1">
          <label className="text-[11px] text-zinc-500 mb-1 block">Labor (₱)</label>
          <input
            type="number" min="0" step="0.01" value={laborCost}
            onChange={(e) => setLaborCost(e.target.value)}
            placeholder="0.00"
            className="w-full px-3 py-2 rounded-xl bg-zinc-800/60 border border-zinc-700
              text-zinc-100 text-sm placeholder:text-zinc-600 outline-none focus:border-amber-400/50"
          />
        </div>
        <div className="flex-1">
          <label className="text-[11px] text-zinc-500 mb-1 block">Parts (₱)</label>
          <input
            type="number" min="0" step="0.01" value={partsCost}
            onChange={(e) => setPartsCost(e.target.value)}
            placeholder="0.00"
            className="w-full px-3 py-2 rounded-xl bg-zinc-800/60 border border-zinc-700
              text-zinc-100 text-sm placeholder:text-zinc-600 outline-none focus:border-amber-400/50"
          />
        </div>
      </div>

      <textarea
        rows={2}
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="Notes for the owner (optional)"
        className="w-full px-3 py-2 rounded-xl bg-zinc-800/60 border border-zinc-700
          text-zinc-100 text-sm placeholder:text-zinc-600 outline-none resize-none focus:border-amber-400/50"
      />

      <div className="flex justify-between items-center">
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
          className="flex-1 py-2 rounded-xl border border-zinc-700 text-zinc-400
            text-xs font-medium disabled:opacity-40"
        >
          Cancel
        </button>
        <button
          onClick={handleSubmit}
          disabled={submitting}
          className="flex-1 py-2 rounded-xl bg-amber-400 text-zinc-900 text-xs font-bold
            active:scale-[0.98] transition-all disabled:opacity-50"
        >
          {submitting ? "Sending…" : isEdit ? "Update Estimate" : "Send Estimate"}
        </button>
      </div>
    </div>
  );
}