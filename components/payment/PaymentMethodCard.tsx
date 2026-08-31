"use client";

import { useEffect, useState } from "react";
import {
  getPayment,
  getDirectPaymentOptions,
  chooseCashPayment,
  chooseDirectPayment,
  markPaymentSentByOwner,
  type DisplayPayment,
  type DirectPaymentOptions,
} from "@/app/actions/payment";

export function PaymentMethodCard({ bookingId }: { bookingId: string }) {
  const [payment, setPayment] = useState<DisplayPayment | null>(null);
  const [directOptions, setDirectOptions] = useState<DirectPaymentOptions | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  async function handleDirect(provider: "gcash" | "maya") {
    setBusy(true);
    setError(null);
    try {
      const p = await chooseDirectPayment(bookingId, provider);
      setPayment(p);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't start payment");
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

  const hasGcash = !!directOptions?.gcash;
  const hasMaya = !!directOptions?.maya;

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
          <MethodButtons
            busy={busy}
            hasGcash={hasGcash}
            hasMaya={hasMaya}
            onCash={handleCash}
            onDirect={handleDirect}
          />
        </div>
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
        <MethodButtons
          busy={busy}
          hasGcash={hasGcash}
          hasMaya={hasMaya}
          onCash={handleCash}
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
  return `via ${payment.paidVia ?? "online"}`; // legacy ONLINE rows, if any predate this change
}

// ── Method picker — Cash always available; GCash/Maya only when THIS
// mechanic/shop has actually configured one, since there's no PayMongo
// fallback anymore. ────────────────────────────────────────────────────────

function MethodButtons({
  busy,
  hasGcash,
  hasMaya,
  onCash,
  onDirect,
}: {
  busy: boolean;
  hasGcash: boolean;
  hasMaya: boolean;
  onCash: () => void;
  onDirect: (provider: "gcash" | "maya") => void;
}) {
  const walletCount = (hasGcash ? 1 : 0) + (hasMaya ? 1 : 0);

  return (
    <div className="space-y-2">
      <div className={`grid gap-2 ${walletCount === 0 ? "grid-cols-1" : walletCount === 1 ? "grid-cols-2" : "grid-cols-3"}`}>
        <button
          onClick={onCash}
          disabled={busy}
          className="rounded-xl border border-white/[0.08] text-zinc-200 text-sm py-2 disabled:opacity-50"
        >
          Cash
        </button>
        {hasGcash && (
          <button
            onClick={() => onDirect("gcash")}
            disabled={busy}
            className="rounded-xl border border-amber-400/40 text-amber-400 text-sm py-2 disabled:opacity-50"
          >
            GCash
          </button>
        )}
        {hasMaya && (
          <button
            onClick={() => onDirect("maya")}
            disabled={busy}
            className="rounded-xl border border-amber-400/40 text-amber-400 text-sm py-2 disabled:opacity-50"
          >
            Maya
          </button>
        )}
      </div>
      {walletCount > 0 && (
        <p className="text-[11px] text-zinc-600 text-center">
          GCash/Maya pay directly into their own account — not through FixIT.
        </p>
      )}
      {walletCount === 0 && (
        <p className="text-[11px] text-zinc-600 text-center">
          This mechanic/shop hasn't set up GCash or Maya yet — cash only for now.
        </p>
      )}
    </div>
  );
}

// ── Direct-to-wallet pending ──────────────────────────────────────────────

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

// ── QR save helper — unchanged from before ───────────────────────────────

async function saveQrImage(dataUri: string, filename: string): Promise<"shared" | "downloaded" | "failed"> {
  try {
    const res = await fetch(dataUri);
    const blob = await res.blob();
    const file = new File([blob], filename, { type: blob.type || "image/png" });

    const nav = navigator as any;
    if (typeof nav.share === "function" && nav.canShare?.({ files: [file] })) {
      try {
        await nav.share({ files: [file] });
        return "shared";
      } catch {
        return "shared";
      }
    }
  } catch {
    // fall through to the download link
  }

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