"use client";

import { useEffect, useState } from "react";
import { getPayment, chooseCashPayment, chooseOnlinePayment, type DisplayPayment } from "@/app/actions/payment";

export function PaymentMethodCard({ bookingId }: { bookingId: string }) {
  const [payment, setPayment] = useState<DisplayPayment | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    try {
      const p = await getPayment(bookingId);
      setPayment(p);
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
    // Poll while a decision might still be in flight (PENDING online payment
    // waiting on the webhook), matching the app's existing polling pattern.
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
    try {
      const p = await chooseOnlinePayment(bookingId, provider);
      setPayment(p);
      if (p.checkoutUrl) window.location.href = p.checkoutUrl;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't start online payment");
    } finally {
      setBusy(false);
    }
  }

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
          Paid {payment.method === "CASH" ? "in cash" : `via ${payment.paidVia ?? "online"}`}
        </div>
      )}

      {payment?.status === "FAILED" && (
        <div className="space-y-2">
          <p className="text-xs text-red-400 bg-red-400/10 border border-red-400/20 rounded-lg px-3 py-2">
            Payment didn't go through. Try again or pay cash instead.
          </p>
          <MethodButtons busy={busy} onCash={handleCash} onOnline={handleOnline} />
        </div>
      )}

      {payment?.status === "PENDING" && payment.method === "ONLINE" && (
        <div className="space-y-2">
          <p className="text-xs text-zinc-400">
            Waiting on your {payment.paidVia ?? "online"} payment to complete.
          </p>
          {payment.checkoutUrl && (
            <a
              href={payment.checkoutUrl}
              className="block text-center text-sm font-medium rounded-xl bg-amber-400 text-zinc-900 px-4 py-2"
            >
              Continue to {payment.paidVia === "gcash" ? "GCash" : "Maya"}
            </a>
          )}
          <button
            onClick={handleCash}
            disabled={busy}
            className="w-full text-xs text-zinc-400 underline underline-offset-2"
          >
            Pay cash instead
          </button>
        </div>
      )}

      {payment?.status === "PENDING" && payment.method === "CASH" && (
        <p className="text-xs text-zinc-400 bg-white/[0.02] border border-white/[0.06] rounded-lg px-3 py-2">
          Waiting for the mechanic/shop to confirm cash receipt.
        </p>
      )}

      {(!payment || (payment.status === "PENDING" && !payment.method)) && (
        <MethodButtons busy={busy} onCash={handleCash} onOnline={handleOnline} />
      )}
    </div>
  );
}

function MethodButtons({
  busy,
  onCash,
  onOnline,
}: {
  busy: boolean;
  onCash: () => void;
  onOnline: (provider: "gcash" | "maya") => void;
}) {
  return (
    <div className="grid grid-cols-3 gap-2">
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
    </div>
  );
}