"use client";

import { useState } from "react";
import { confirmCashPayment } from "@/app/actions/payment";

const METHOD_LABEL: Record<string, string> = {
  CASH: "cash",
  GCASH_DIRECT: "GCash",
  MAYA_DIRECT: "Maya",
};

export function ConfirmCashPaymentButton({
  bookingId,
  method = "CASH",
  onConfirmed,
}: {
  bookingId: string;
  /** Optional — defaults to "CASH" so existing call sites that don't pass
   * this keep working unchanged. Pass the real payment.method
   * ("GCASH_DIRECT" | "MAYA_DIRECT") when known, for accurate button text. */
  method?: "CASH" | "GCASH_DIRECT" | "MAYA_DIRECT";
  onConfirmed?: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState(false);

  const label = METHOD_LABEL[method] ?? "cash";

  async function handleConfirm() {
    setBusy(true);
    setError(null);
    try {
      // Same action underneath for all three methods — see the comment on
      // confirmCashPayment in payment.ts for why the name wasn't changed.
      await confirmCashPayment(bookingId);
      setConfirmed(true);
      onConfirmed?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't confirm payment");
    } finally {
      setBusy(false);
    }
  }

  if (confirmed) {
    return (
      <div className="text-xs text-emerald-400 bg-emerald-400/10 border border-emerald-400/20 rounded-lg px-3 py-2 text-center">
        {label} payment confirmed
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {error && (
        <p className="text-xs text-red-400 bg-red-400/10 border border-red-400/20 rounded-lg px-3 py-2">
          {error}
        </p>
      )}
      <button
        onClick={handleConfirm}
        disabled={busy}
        className="w-full flex items-center justify-center gap-2 rounded-xl bg-amber-400 text-zinc-900 text-xs font-semibold py-2 disabled:opacity-50"
      >
        {busy && <span className="w-3.5 h-3.5 rounded-full border-2 border-zinc-600 border-t-zinc-900 animate-spin" />}
        Confirm {label} received
      </button>
    </div>
  );
}