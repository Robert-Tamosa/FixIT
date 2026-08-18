"use client";

import { useEffect, useState } from "react";
import {
  getPayment,
  getDirectPaymentOptions,
  chooseCashPayment,
  chooseOnlinePayment,
  chooseDirectPayment,
  markPaymentSentByOwner,
  type DisplayPayment,
  type DirectPaymentOptions,
} from "@/app/actions/payment";

type TopChoice = "menu" | "direct-submenu";

export function PaymentMethodCard({ bookingId }: { bookingId: string }) {
  const [payment, setPayment] = useState<DisplayPayment | null>(null);
  const [directOptions, setDirectOptions] = useState<DirectPaymentOptions | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [qrFailed, setQrFailed] = useState(false);
  const [view, setView] = useState<TopChoice>("menu");

  async function refresh() {
    try {
      const [p, opts] = await Promise.all([getPayment(bookingId), getDirectPaymentOptions(bookingId)]);
      setPayment(p);
      setDirectOptions(opts);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't load payment status");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookingId]);

  useEffect(() => {
    // Poll while a decision might still be in flight — online payment
    // waiting on the webhook, or a direct-wallet payment waiting on the
    // mechanic/shop's manual confirm.
    if (payment?.status !== "PENDING") return;
    const interval = setInterval(refresh, 6000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [payment?.status]);

  async function handleCash() {
    setBusy(true);
    setError(null);
    try {
      const p = await chooseCashPayment(bookingId);
      setPayment(p);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't set cash payment");
    } finally {
      setBusy(false);
    }
  }

  async function handleOnline(provider: "gcash" | "maya") {
    setBusy(true);
    setError(null);
    setQrFailed(false);
    try {
      const p = await chooseOnlinePayment(bookingId, provider);
      setPayment(p);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't start online payment");
    } finally {
      setBusy(false);
    }
  }

  async function handleDirect(provider: "gcash" | "maya") {
    setBusy(true);
    setError(null);
    try {
      const p = await chooseDirectPayment(bookingId, provider);
      setPayment(p);
      setView("menu");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't start direct payment");
    } finally {
      setBusy(false);
    }
  }

  async function handleMarkSent() {
    setBusy(true);
    setError(null);
    try {
      const p = await markPaymentSentByOwner(bookingId);
      setPayment(p);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't update — try again");
    } finally {
      setBusy(false);
    }
  }

  function handleOpenApp() {
    if (!payment?.checkoutUrl) return;
    window.location.href = payment.checkoutUrl;
  }

  const hasDirectOptions = !!(directOptions?.gcash || directOptions?.maya);

  if (loading) {
    return (
      <div className="rounded-2xl bg-white/[0.02] border border-white/[0.06] p-4 flex items-center gap-2">
        <span className="w-4 h-4 rounded-full border-2 border-zinc-600 border-t-amber-400 animate-spin" />
        <span className="text-sm text-zinc-400">Loading payment status…</span>
      </div>
    );
  }

  return (
    <div className="rounded-2xl bg-white/[0.02] border border-white/[0.06] p-4 space-y-3">
      <h3 className="text-sm font-medium text-zinc-200">Payment</h3>

      {error && (
        <p className="text-xs text-red-400 bg-red-400/10 border border-red-400/20 rounded-lg px-3 py-2">
          {error}
        </p>
      )}

      {payment?.status === "PAID" && (
        <div className="flex items-center gap-2 text-emerald-400 bg-emerald-400/10 border border-emerald-400/20 rounded-lg px-3 py-2 text-sm">
          Paid {paidViaLabel(payment)}
        </div>
      )}

      {payment?.status === "FAILED" && (
        <div className="space-y-2">
          <p className="text-xs text-red-400 bg-red-400/10 border border-red-400/20 rounded-lg px-3 py-2">
            Payment didn't go through. Try again or pick a different method.
          </p>
          <MethodMenu
            view={view}
            setView={setView}
            busy={busy}
            hasDirectOptions={hasDirectOptions}
            directOptions={directOptions}
            onCash={handleCash}
            onOnline={handleOnline}
            onDirect={handleDirect}
          />
        </div>
      )}

      {payment?.status === "PENDING" && payment.method === "ONLINE" && payment.checkoutUrl && (
        <OnlinePendingPanel
          payment={payment}
          busy={busy}
          qrFailed={qrFailed}
          setQrFailed={setQrFailed}
          onOpenApp={handleOpenApp}
          onSwitchToCash={handleCash}
        />
      )}

      {payment?.status === "PENDING" && (payment.method === "GCASH_DIRECT" || payment.method === "MAYA_DIRECT") && (
        <DirectPendingPanel
          payment={payment}
          busy={busy}
          onMarkSent={handleMarkSent}
          onSwitchToCash={handleCash}
        />
      )}

      {payment?.status === "PENDING" && payment.method === "CASH" && (
        <p className="text-xs text-zinc-400 bg-white/[0.02] border border-white/[0.06] rounded-lg px-3 py-2">
          Waiting for the mechanic/shop to confirm cash receipt.
        </p>
      )}

      {(!payment || (payment.status === "PENDING" && !payment.method)) && (
        <MethodMenu
          view={view}
          setView={setView}
          busy={busy}
          hasDirectOptions={hasDirectOptions}
          directOptions={directOptions}
          onCash={handleCash}
          onOnline={handleOnline}
          onDirect={handleDirect}
        />
      )}
    </div>
  );
}

function paidViaLabel(payment: DisplayPayment): string {
  if (payment.method === "CASH") return "in cash";
  if (payment.method === "GCASH_DIRECT") return "directly via GCash";
  if (payment.method === "MAYA_DIRECT") return "directly via Maya";
  return `via ${payment.paidVia ?? "online"}`;
}

// ── Top-level method menu, with a Direct sub-menu ────────────────────────

function MethodMenu({
  view,
  setView,
  busy,
  hasDirectOptions,
  directOptions,
  onCash,
  onOnline,
  onDirect,
}: {
  view: TopChoice;
  setView: (v: TopChoice) => void;
  busy: boolean;
  hasDirectOptions: boolean;
  directOptions: DirectPaymentOptions | null;
  onCash: () => void;
  onOnline: (provider: "gcash" | "maya") => void;
  onDirect: (provider: "gcash" | "maya") => void;
}) {
  if (view === "direct-submenu") {
    return (
      <div className="space-y-2">
        <button
          onClick={() => setView("menu")}
          className="text-xs text-zinc-500 underline underline-offset-2"
        >
          ← Back
        </button>
        <p className="text-xs text-zinc-500">
          Pays straight into their own account — not through FixIT.
        </p>
        <div className="grid grid-cols-2 gap-2">
          {directOptions?.gcash && (
            <button
              onClick={() => onDirect("gcash")}
              disabled={busy}
              className="rounded-xl border border-amber-400/40 text-amber-400 text-sm py-2 disabled:opacity-50"
            >
              GCash Direct
            </button>
          )}
          {directOptions?.maya && (
            <button
              onClick={() => onDirect("maya")}
              disabled={busy}
              className="rounded-xl border border-amber-400/40 text-amber-400 text-sm py-2 disabled:opacity-50"
            >
              Maya Direct
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={`grid gap-2 ${hasDirectOptions ? "grid-cols-3" : "grid-cols-3"}`}>
      <button
        onClick={onCash}
        disabled={busy}
        className="rounded-xl border border-white/[0.08] text-zinc-200 text-sm py-2 disabled:opacity-50"
      >
        Cash
      </button>
      <button
        onClick={() => onOnline("gcash")}
        disabled={busy}
        className="rounded-xl border border-amber-400/40 text-amber-400 text-sm py-2 disabled:opacity-50"
      >
        GCash
      </button>
      <button
        onClick={() => onOnline("maya")}
        disabled={busy}
        className="rounded-xl border border-amber-400/40 text-amber-400 text-sm py-2 disabled:opacity-50"
      >
        Maya
      </button>
      {hasDirectOptions && (
        <button
          onClick={() => setView("direct-submenu")}
          disabled={busy}
          className="col-span-3 rounded-xl border border-white/[0.08] text-zinc-400 text-xs py-2 disabled:opacity-50"
        >
          Pay directly to their own GCash/Maya instead →
        </button>
      )}
    </div>
  );
}

// ── PayMongo online pending — unchanged from before ──────────────────────

function OnlinePendingPanel({
  payment,
  busy,
  qrFailed,
  setQrFailed,
  onOpenApp,
  onSwitchToCash,
}: {
  payment: DisplayPayment;
  busy: boolean;
  qrFailed: boolean;
  setQrFailed: (v: boolean) => void;
  onOpenApp: () => void;
  onSwitchToCash: () => void;
}) {
  return (
    <div className="space-y-3">
      <div className="text-center">
        <p className="text-[11px] text-zinc-500">Amount to pay</p>
        <p className="text-2xl font-bold text-amber-400">
          ₱{payment.amount.toLocaleString("en-PH", { minimumFractionDigits: 2 })}
        </p>
      </div>

      {!qrFailed && payment.checkoutUrl && (
        <div className="flex justify-center">
          <div className="p-2.5 bg-white rounded-xl">
            <img
              src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(payment.checkoutUrl)}`}
              alt="Scan to pay"
              width={200}
              height={200}
              onError={() => setQrFailed(true)}
            />
          </div>
        </div>
      )}

      <button
        onClick={onOpenApp}
        className="w-full text-center text-sm font-semibold rounded-xl bg-amber-400 text-zinc-900 px-4 py-3"
      >
        Pay with {payment.paidVia === "gcash" ? "GCash" : "Maya"}
      </button>

      <p className="text-[11px] text-zinc-600 text-center">
        Scan the code above from another device, or tap the button to open the {payment.paidVia === "gcash" ? "GCash" : "Maya"} app directly.
      </p>

      <button
        onClick={onSwitchToCash}
        disabled={busy}
        className="w-full text-xs text-zinc-400 underline underline-offset-2"
      >
        Pay cash instead
      </button>
    </div>
  );
}

// ── Direct-to-wallet pending — new ────────────────────────────────────────

// ============================================================
// REPLACE the DirectPendingPanel function in PaymentMethodCard.tsx with
// this version — adds a "Save QR to Photos" button above the QR image.
// ============================================================

async function saveQrImage(dataUri: string, filename: string): Promise<"shared" | "downloaded" | "failed"> {
  try {
    const res = await fetch(dataUri);
    const blob = await res.blob();
    const file = new File([blob], filename, { type: blob.type || "image/png" });

    // navigator.share/canShare with a `files` array is Web Share API Level 2
    // — well supported on modern iOS Safari and Chrome Android, which is
    // what actually gives a real native "Save Image" option in the share
    // sheet. Cast to `any` since some TS lib.dom versions don't include the
    // `files` field on ShareData yet — this is a runtime feature-check
    // either way, so the cast doesn't weaken the actual safety here.
    const nav = navigator as any;
    if (typeof nav.share === "function" && nav.canShare?.({ files: [file] })) {
      try {
        await nav.share({ files: [file] });
        return "shared";
      } catch {
        // AbortError (user cancelled the share sheet) or a share failure —
        // either way, don't also trigger a fallback download on top of it;
        // that would be a confusing double-prompt.
        return "shared";
      }
    }
  } catch {
    // blob/file construction failed — fall through to the download link
  }

  // Fallback for browsers without Web Share file support (older iOS Safari,
  // most desktop browsers). Works reliably on Android Chrome and desktop;
  // on unsupported iOS versions this may just open the image in a new tab
  // instead of downloading — the long-press hint in the UI covers that case.
  try {
    const a = document.createElement("a");
    a.href = dataUri;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    return "downloaded";
  } catch {
    return "failed";
  }
}

function DirectPendingPanel({
  payment,
  busy,
  onMarkSent,
  onSwitchToCash,
}: {
  payment: DisplayPayment;
  busy: boolean;
  onMarkSent: () => void;
  onSwitchToCash: () => void;
}) {
  const providerLabel = payment.method === "GCASH_DIRECT" ? "GCash" : "Maya";
  const [saveState, setSaveState] = useState<"idle" | "saving" | "failed">("idle");

  async function handleSave() {
    if (!payment.directQrImage) return;
    setSaveState("saving");
    const filename = `${providerLabel.toLowerCase()}-qr.png`;
    const result = await saveQrImage(payment.directQrImage, filename);
    setSaveState(result === "failed" ? "failed" : "idle");
  }

  return (
    <div className="space-y-3">
      <p className="text-[11px] text-zinc-500 text-center">
        Paying {payment.directAccountName} directly — not through FixIT.
      </p>

      <div className="text-center">
        <p className="text-[11px] text-zinc-500">Amount to pay</p>
        <p className="text-2xl font-bold text-amber-400">
          ₱{payment.amount.toLocaleString("en-PH", { minimumFractionDigits: 2 })}
        </p>
      </div>

      {payment.directQrImage && (
        <div className="flex justify-center">
          <div className="p-2.5 bg-white rounded-xl">
            <img src={payment.directQrImage} alt={`${providerLabel} QR`} className="w-[200px] h-[200px] object-contain" />
          </div>
        </div>
      )}

      {payment.directQrImage && (
        <button
          onClick={handleSave}
          disabled={saveState === "saving"}
          className="w-full flex items-center justify-center gap-2 rounded-xl border border-white/[0.08]
            text-zinc-300 text-xs font-medium py-2.5 disabled:opacity-50"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"
              stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          {saveState === "saving" ? "Saving…" : "Save QR to Photos"}
        </button>
      )}

      {saveState === "failed" && (
        <p className="text-[11px] text-red-400 text-center">
          Couldn't save automatically — press and hold the QR code above and choose "Save Image."
        </p>
      )}

      <p className="text-[11px] text-zinc-600 text-center leading-relaxed">
        Scan this in your {providerLabel} app and enter the exact amount above — this QR doesn't have the amount pre-filled.
        If you're viewing this on the same phone you'll pay from, save the QR first, then use "Scan from Gallery" inside {providerLabel}.
      </p>

      {payment.ownerMarkedSentAt ? (
        <div className="rounded-xl bg-white/[0.02] border border-white/[0.06] px-3 py-2.5 text-center space-y-1">
          <p className="text-xs text-zinc-300">You marked this as sent.</p>
          <p className="text-[11px] text-zinc-600">Waiting for {payment.directAccountName} to confirm receipt.</p>
        </div>
      ) : (
        <button
          onClick={onMarkSent}
          disabled={busy}
          className="w-full text-center text-sm font-semibold rounded-xl bg-amber-400 text-zinc-900 px-4 py-3 disabled:opacity-50"
        >
          I've Sent Payment
        </button>
      )}

      <button
        onClick={onSwitchToCash}
        disabled={busy}
        className="w-full text-xs text-zinc-400 underline underline-offset-2"
      >
        Pay cash instead
      </button>
    </div>
  );
}