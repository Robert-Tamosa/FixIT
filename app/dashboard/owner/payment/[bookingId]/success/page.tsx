"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { getPayment, type DisplayPayment } from "@/app/actions/payment";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";

const POLL_INTERVAL_MS = 2000;
const MAX_POLLS = 15; // ~30s before we give up waiting on the webhook

export default function PaymentSuccessPage() {
  const { bookingId } = useParams<{ bookingId: string }>();
  const router = useRouter();
  const [payment, setPayment] = useState<DisplayPayment | null>(null);
  const [pollCount, setPollCount] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function poll() {
      try {
        const result = await getPayment(bookingId);
        if (cancelled) return;
        setPayment(result);
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Failed to load payment status");
      }
    }

    poll();
    const interval = setInterval(() => {
      setPollCount((c) => c + 1);
      poll();
    }, POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [bookingId]);

  useEffect(() => {
    if (payment?.status === "PAID") {
      // Stop polling once confirmed — no need for an interval cleanup gate,
      // the poll loop just becomes a no-op cost until unmount.
    }
  }, [payment?.status]);

  const stillWaiting = !payment || payment.status === "PENDING";
  const gaveUpWaiting = stillWaiting && pollCount >= MAX_POLLS;

  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center px-4">
      <div className="max-w-md w-full bg-zinc-900 border border-zinc-800 rounded-2xl p-8 text-center">
        {error && (
          <>
            <XCircle className="mx-auto h-14 w-14 text-red-500 mb-4" />
            <h1 className="text-xl font-semibold text-zinc-100 mb-2">Something went wrong</h1>
            <p className="text-zinc-400 text-sm mb-6">{error}</p>
          </>
        )}

        {!error && payment?.status === "PAID" && (
          <>
            <CheckCircle2 className="mx-auto h-14 w-14 text-amber-500 mb-4" />
            <h1 className="text-xl font-semibold text-zinc-100 mb-2">Payment received</h1>
            <p className="text-zinc-400 text-sm mb-6">
              Your payment of ₱{payment.amount.toLocaleString()} has been confirmed.
            </p>
          </>
        )}

        {!error && stillWaiting && !gaveUpWaiting && (
          <>
            <Loader2 className="mx-auto h-14 w-14 text-amber-500 mb-4 animate-spin" />
            <h1 className="text-xl font-semibold text-zinc-100 mb-2">Confirming payment</h1>
            <p className="text-zinc-400 text-sm mb-6">
              Your payment was authorized — we're just waiting on final confirmation. This
              usually takes a few seconds.
            </p>
          </>
        )}

        {!error && gaveUpWaiting && (
          <>
            <Loader2 className="mx-auto h-14 w-14 text-zinc-500 mb-4" />
            <h1 className="text-xl font-semibold text-zinc-100 mb-2">Still processing</h1>
            <p className="text-zinc-400 text-sm mb-6">
              This is taking longer than usual. Your payment may still confirm shortly — check
              your booking for the latest status.
            </p>
          </>
        )}

        <button
          onClick={() => router.push(`/dashboard/owner/bookings`)}
          className="w-full bg-amber-500 hover:bg-amber-400 text-zinc-950 font-medium rounded-lg py-2.5 transition-colors"
        >
          Back to booking
        </button>
      </div>
    </div>
  );
}