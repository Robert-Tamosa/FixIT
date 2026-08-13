"use server";

import { headers } from "next/headers";
import { auth } from "@/lib/auth"; // ASSUMPTION — adjust to your actual auth import path
import { prisma } from "@/lib/prisma"; // ASSUMPTION — adjust to your actual prisma import path

// ============================================================
// Config — set these in .env
//   PAYMONGO_SECRET_KEY=sk_test_xxx (or sk_live_xxx)
//   PAYMONGO_WEBHOOK_SECRET=whsec_xxx
//   NEXT_PUBLIC_APP_URL=https://your-domain.com
// ============================================================
const PAYMONGO_SECRET_KEY = process.env.PAYMONGO_SECRET_KEY!;
const APP_URL = process.env.NEXT_PUBLIC_APP_URL!;

// ============================================================
// Auth helpers — same per-file pattern as the rest of the project
// ============================================================
async function requireUser() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) throw new Error("Unauthorized");
  const dbUser = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, role: true },
  });
  if (!dbUser) throw new Error("Unauthorized");
  return dbUser;
}

/** Same shape as resolveEstimateAccess (estimate.ts) / resolveBookingAccess (invoice.ts) */
async function resolvePaymentAccess(
  booking: { ownerId: string; mechanicId: string | null; shopId: string | null },
  user: { id: string; role: string },
) {
  const isOwner = booking.ownerId === user.id;
  const isMechanic = user.role === "MECHANIC" && booking.mechanicId === user.id;
  let isShopOwner = false;
  if (user.role === "SHOP_OWNER" && booking.shopId) {
    const shop = await prisma.repairShop.findUnique({
      where: { id: booking.shopId },
      select: { ownerId: true },
    });
    isShopOwner = shop?.ownerId === user.id;
  }
  return { isOwner, isMechanic, isShopOwner };
}

// ============================================================
// Display type
// ============================================================
export type DisplayPayment = {
  id: string;
  bookingId: string;
  amount: number;
  method: "CASH" | "ONLINE" | null;
  status: "PENDING" | "PAID" | "FAILED";
  checkoutUrl: string | null;
  paidVia: string | null;
  cashConfirmedAt: string | null;
  paidAt: string | null;
};

function toDisplay(p: {
  id: string;
  bookingId: string;
  amount: unknown;
  method: string | null;
  status: string;
  checkoutUrl: string | null;
  paidVia: string | null;
  cashConfirmedAt: Date | null;
  paidAt: Date | null;
}): DisplayPayment {
  return {
    id: p.id,
    bookingId: p.bookingId,
    amount: Number(p.amount),
    method: p.method as DisplayPayment["method"],
    status: p.status as DisplayPayment["status"],
    checkoutUrl: p.checkoutUrl,
    paidVia: p.paidVia,
    cashConfirmedAt: p.cashConfirmedAt?.toISOString() ?? null,
    paidAt: p.paidAt?.toISOString() ?? null,
  };
}

// ============================================================
// PayMongo API helper
// ============================================================
async function paymongoFetch(path: string, init: RequestInit) {
  const res = await fetch(`https://api.paymongo.com/v1${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Basic ${Buffer.from(`${PAYMONGO_SECRET_KEY}:`).toString("base64")}`,
      ...init.headers,
    },
  });
  const json = await res.json();
  if (!res.ok) {
    const msg = json?.errors?.[0]?.detail ?? "PayMongo request failed";
    throw new Error(msg);
  }
  return json;
}

/** amount comes in as pesos (e.g. 1500.00) — PayMongo wants integer centavos */
function pesosToCentavos(amount: number) {
  return Math.round(amount * 100);
}

// ============================================================
// getPayment — fetch the payment row for a booking, or null if the owner
// hasn't picked a method yet. Doesn't create anything — read-only.
// ============================================================
export async function getPayment(bookingId: string): Promise<DisplayPayment | null> {
  const user = await requireUser();
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    select: { id: true, ownerId: true, mechanicId: true, shopId: true, payment: true },
  });
  if (!booking) throw new Error("Booking not found");

  const { isOwner, isMechanic, isShopOwner } = await resolvePaymentAccess(booking, user);
  if (!isOwner && !isMechanic && !isShopOwner) throw new Error("Unauthorized");

  if (!booking.payment) return null;
  return toDisplay(booking.payment);
}

// ============================================================
// Shared setup for both chooseCashPayment / chooseOnlinePayment:
// loads the booking + invoice, checks owner access, checks the invoice
// exists (payment can't happen before the invoice is generated), and
// blocks re-choosing once a payment already succeeded or failed.
// ============================================================
async function loadBookingForPaymentChoice(bookingId: string) {
  const user = await requireUser();
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    select: {
      id: true,
      ownerId: true,
      mechanicId: true,
      shopId: true,
      payment: true,
      invoice: { select: { totalAmount: true } },
    },
  });
  if (!booking) throw new Error("Booking not found");
  const { isOwner } = await resolvePaymentAccess(booking, user);
  if (!isOwner) throw new Error("Unauthorized");
  if (!booking.invoice) throw new Error("No invoice has been generated for this booking yet");
  if (booking.payment && booking.payment.status !== "PENDING") {
    throw new Error("Payment already finalized — can't switch method");
  }
  return booking;
}

// ============================================================
// chooseCashPayment — owner selects cash
// ============================================================
export async function chooseCashPayment(bookingId: string): Promise<DisplayPayment> {
  const booking = await loadBookingForPaymentChoice(bookingId);

  const payment = await prisma.payment.upsert({
    where: { bookingId },
    create: {
      bookingId,
      amount: booking.invoice!.totalAmount,
      method: "CASH",
      status: "PENDING",
    },
    update: {
      method: "CASH",
      // Clear out any in-progress online attempt when switching to cash.
      providerSourceId: null,
      checkoutUrl: null,
      paidVia: null,
      failureReason: null,
    },
  });
  return toDisplay(payment);
}

// ============================================================
// chooseOnlinePayment — owner selects GCash or Maya, creates a PayMongo Source
// ============================================================
export async function chooseOnlinePayment(
  bookingId: string,
  provider: "gcash" | "maya",
): Promise<DisplayPayment> {
  const booking = await loadBookingForPaymentChoice(bookingId);
  const amount = Number(booking.invoice!.totalAmount);
  if (amount <= 0) throw new Error("Invoice has no payable amount");

  // ASSUMPTION, verify against the PayMongo dashboard/API reference before
  // going live: source `type` for Maya may be "paymaya" rather than "maya".
  // GCash's type ("gcash") is confirmed from current PayMongo docs.
  const sourceType = provider === "gcash" ? "gcash" : "paymaya";

  const sourceRes = await paymongoFetch("/sources", {
    method: "POST",
    body: JSON.stringify({
      data: {
        attributes: {
          type: sourceType,
          amount: pesosToCentavos(amount),
          currency: "PHP",
          redirect: {
            success: `${APP_URL}/dashboard/owner/payment/${bookingId}/success`,
            failed: `${APP_URL}/dashboard/owner/payment/${bookingId}/failed`,
          },
        },
      },
    }),
  });

  const sourceId: string = sourceRes.data.id;
  const checkoutUrl: string = sourceRes.data.attributes.redirect.checkout_url;

  const payment = await prisma.payment.upsert({
    where: { bookingId },
    create: {
      bookingId,
      amount,
      method: "ONLINE",
      status: "PENDING",
      providerSourceId: sourceId,
      checkoutUrl,
      paidVia: provider,
    },
    update: {
      method: "ONLINE",
      status: "PENDING",
      providerSourceId: sourceId,
      checkoutUrl,
      paidVia: provider,
      failureReason: null,
    },
  });
  return toDisplay(payment);
}

// ============================================================
// confirmCashPayment — mechanic or shop owner confirms receipt in person
// ============================================================
export async function confirmCashPayment(bookingId: string): Promise<DisplayPayment> {
  const user = await requireUser();
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    select: { id: true, ownerId: true, mechanicId: true, shopId: true, payment: true },
  });
  if (!booking) throw new Error("Booking not found");
  const { isMechanic, isShopOwner } = await resolvePaymentAccess(booking, user);
  if (!isMechanic && !isShopOwner) throw new Error("Unauthorized");
  if (!booking.payment || booking.payment.method !== "CASH") {
    throw new Error("This booking isn't set to cash payment");
  }
  if (booking.payment.status === "PAID") return toDisplay(booking.payment);

  const [payment] = await prisma.$transaction([
    prisma.payment.update({
      where: { bookingId },
      data: {
        status: "PAID",
        confirmedById: user.id,
        cashConfirmedAt: new Date(),
        paidAt: new Date(),
      },
    }),
    // Keep Invoice.paymentStatus in sync — the existing "Paid"/"Unpaid" badge
    // in the owner's invoice modal reads this field directly and shouldn't
    // need to change.
    prisma.invoice.update({
      where: { bookingId },
      data: { paymentStatus: "PAID", paidAt: new Date() },
    }),
  ]);

  // TODO: createNotification(booking.ownerId, "PAYMENT_CONFIRMED", ...) —
  // wire in alongside the rest of this project's notification call sites
  // once the exact event-name convention for this file is confirmed.

  return toDisplay(payment);
}

// ============================================================
// handlePaymongoEvent — called by the webhook route handler, not directly
// by the client.
// ============================================================
export async function handlePaymongoEvent(event: {
  type: string;
  data: { id: string; attributes: Record<string, unknown> };
}) {
  async function markPaid(sourceId: string) {
    const payment = await prisma.payment.findUnique({ where: { providerSourceId: sourceId } });
    if (!payment) return; // not one of ours, or already handled — ignore
    await prisma.$transaction([
      prisma.payment.update({
        where: { id: payment.id },
        data: { status: "PAID", paidAt: new Date() },
      }),
      prisma.invoice.update({
        where: { bookingId: payment.bookingId },
        data: { paymentStatus: "PAID", paidAt: new Date() },
      }),
    ]);
  }

  async function markFailed(sourceId: string, reason: string) {
    await prisma.payment.updateMany({
      where: { providerSourceId: sourceId },
      data: { status: "FAILED", failureReason: reason },
    });
  }

  if (event.type === "source.chargeable") {
    const sourceId = event.data.id;
    const payment = await prisma.payment.findUnique({ where: { providerSourceId: sourceId } });
    if (!payment) return;

    const paymentRes = await paymongoFetch("/payments", {
      method: "POST",
      body: JSON.stringify({
        data: {
          attributes: {
            amount: pesosToCentavos(Number(payment.amount)),
            currency: "PHP",
            source: { id: sourceId, type: "source" },
          },
        },
      }),
    });
    const status = paymentRes.data.attributes.status; // "paid" | "failed"
    if (status === "paid") await markPaid(sourceId);
    else await markFailed(sourceId, "Charge failed after source became chargeable");
    return;
  }

  if (event.type === "payment.paid") {
    const sourceId = (event.data.attributes as any)?.source?.id as string | undefined;
    if (sourceId) await markPaid(sourceId);
    return;
  }

  if (event.type === "payment.failed") {
    const sourceId = (event.data.attributes as any)?.source?.id as string | undefined;
    if (sourceId) await markFailed(sourceId, "PayMongo reported payment.failed");
    return;
  }

  // Other event types (refund.*, dispute.*, payout.*) intentionally ignored —
  // out of scope per spec (payouts are tracked manually by an admin).
}