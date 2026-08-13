"use client";

import { useParams, useRouter } from "next/navigation";
import { XCircle } from "lucide-react";

export default function PaymentFailedPage() {
  const { bookingId } = useParams<{ bookingId: string }>();
  const router = useRouter();

  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center px-4">
      <div className="max-w-md w-full bg-zinc-900 border border-zinc-800 rounded-2xl p-8 text-center">
        <XCircle className="mx-auto h-14 w-14 text-red-500 mb-4" />
        <h1 className="text-xl font-semibold text-zinc-100 mb-2">Payment didn't go through</h1>
        <p className="text-zinc-400 text-sm mb-6">
          The payment wasn't completed. No charge was made — you can try again or pay with cash
          instead.
        </p>

        <div className="flex flex-col gap-2">
          <button
            onClick={() => router.push(`/dashboard/owner/bookings/${bookingId}`)}
            className="w-full bg-amber-600 hover:bg-amber-500 text-zinc-950 font-medium rounded-lg py-2.5 transition-colors"
          >
            Try again
          </button>
        </div>
      </div>
    </div>
  );
}