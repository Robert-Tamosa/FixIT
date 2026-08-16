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
// Auth helpers
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
  method: "CASH" | "ONLINE" | "GCASH_DIRECT" | "MAYA_DIRECT" | null;
  status: "PENDING" | "PAID" | "FAILED";
  checkoutUrl: string | null;
  paidVia: string | null;
  cashConfirmedAt: string | null;
  paidAt: string | null;
  // Direct-wallet fields — only populated when method is GCASH_DIRECT/MAYA_DIRECT
  directQrImage: string | null;
  directAccountName: string | null;
  directIsBusiness: boolean | null;
  ownerMarkedSentAt: string | null;
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
  directQrImage?: string | null;
  directAccountName?: string | null;
  directIsBusiness?: boolean | null;
  ownerMarkedSentAt?: Date | null;
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
    directQrImage: p.directQrImage ?? null,
    directAccountName: p.directAccountName ?? null,
    directIsBusiness: p.directIsBusiness ?? null,
    ownerMarkedSentAt: p.ownerMarkedSentAt?.toISOString() ?? null,
  };
}

// ============================================================
// PayMongo API helper (unchanged — only used by the ONLINE/PayMongo path)
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

function pesosToCentavos(amount: number) {
  return Math.round(amount * 100);
}

// ============================================================
// getPayment — fetch the payment row for a booking, or null if the owner
// hasn't picked a method yet.
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
// getDirectPaymentOptions — what direct-wallet options (if any) does THIS
// booking's mechanic/shop actually have configured. Called by the owner's
// payment picker before any method is chosen, so it only offers "Direct"
// as an option when something real exists to show.
// ============================================================
export type DirectPaymentOptions = {
  gcash: { accountName: string; qrImage: string; isBusiness: boolean | null } | null;
  maya: { accountName: string; qrImage: string; isBusiness: boolean | null } | null;
};

export async function getDirectPaymentOptions(bookingId: string): Promise<DirectPaymentOptions> {
  const user = await requireUser();
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    select: {
      ownerId: true,
      mechanicId: true,
      shopId: true,
      mechanic: {
        select: {
          mechanicProfile: {
            select: {
              gcashQrImage: true, gcashAccountName: true, gcashIsBusiness: true,
              mayaQrImage: true, mayaAccountName: true, mayaIsBusiness: true,
            },
          },
        },
      },
      shop: {
        select: {
          gcashQrImage: true, gcashAccountName: true, gcashIsBusiness: true,
          mayaQrImage: true, mayaAccountName: true, mayaIsBusiness: true,
        },
      },
    },
  });
  if (!booking) throw new Error("Booking not found");
  if (booking.ownerId !== user.id) throw new Error("Unauthorized");

  // Shop bookings never have a mechanicId (no assignment step exists), so
  // this is naturally exclusive — exactly one of these two is ever
  // relevant for a given booking.
  const source = booking.shopId ? booking.shop : booking.mechanic?.mechanicProfile;

  const gcash = source?.gcashQrImage && source?.gcashAccountName
    ? { accountName: source.gcashAccountName, qrImage: source.gcashQrImage, isBusiness: source.gcashIsBusiness ?? null }
    : null;
  const maya = source?.mayaQrImage && source?.mayaAccountName
    ? { accountName: source.mayaAccountName, qrImage: source.mayaQrImage, isBusiness: source.mayaIsBusiness ?? null }
    : null;

  return { gcash, maya };
}

// ============================================================
// Shared setup for choosing any payment method: loads the booking +
// invoice, checks owner access, checks the invoice exists, and blocks
// re-choosing once a payment already succeeded or failed.
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
      providerSourceId: null,
      checkoutUrl: null,
      paidVia: null,
      failureReason: null,
      // Clear any prior direct-wallet snapshot/owner-sent marker when
      // switching methods — those only mean something for the method they
      // were set under.
      directQrImage: null,
      directAccountName: null,
      directIsBusiness: null,
      ownerMarkedSentAt: null,
    },
  });
  return toDisplay(payment);
}

// ============================================================
// chooseOnlinePayment — owner selects GCash or Maya via PayMongo (money
// collected by the platform first, payout tracked manually — unchanged
// from before).
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
      directQrImage: null,
      directAccountName: null,
      directIsBusiness: null,
      ownerMarkedSentAt: null,
    },
  });
  return toDisplay(payment);
}

// ============================================================
// chooseDirectPayment — owner selects GCash-direct or Maya-direct: money
// goes straight to the mechanic/shop's own personal or business wallet,
// bypassing the platform entirely. No PayMongo call — this just snapshots
// the mechanic/shop's own QR onto the Payment row and waits for a manual
// confirm, same trust model as cash.
// ============================================================
export async function chooseDirectPayment(
  bookingId: string,
  provider: "gcash" | "maya",
): Promise<DisplayPayment> {
  const booking = await loadBookingForPaymentChoice(bookingId);
  const options = await getDirectPaymentOptions(bookingId);
  const chosen = provider === "gcash" ? options.gcash : options.maya;
  if (!chosen) {
    throw new Error(
      `This ${booking.shopId ? "shop" : "mechanic"} hasn't set up direct ${provider === "gcash" ? "GCash" : "Maya"} payments yet — choose another method.`,
    );
  }

  const payment = await prisma.payment.upsert({
    where: { bookingId },
    create: {
      bookingId,
      amount: booking.invoice!.totalAmount,
      method: provider === "gcash" ? "GCASH_DIRECT" : "MAYA_DIRECT",
      status: "PENDING",
      directQrImage: chosen.qrImage,
      directAccountName: chosen.accountName,
      directIsBusiness: chosen.isBusiness,
    },
    update: {
      method: provider === "gcash" ? "GCASH_DIRECT" : "MAYA_DIRECT",
      status: "PENDING",
      directQrImage: chosen.qrImage,
      directAccountName: chosen.accountName,
      directIsBusiness: chosen.isBusiness,
      ownerMarkedSentAt: null,
      // Clear any prior PayMongo-online fields — irrelevant to this method.
      providerSourceId: null,
      checkoutUrl: null,
      paidVia: null,
      failureReason: null,
    },
  });
  return toDisplay(payment);
}

// ============================================================
// markPaymentSentByOwner — owner taps "I've Sent Payment" after paying via
// the direct-wallet QR. Purely informational (see schema note on
// ownerMarkedSentAt) — does not move status to PAID. Gives the
// mechanic/shop a heads-up signal instead of a cold PENDING state.
// ============================================================
export async function markPaymentSentByOwner(bookingId: string): Promise<DisplayPayment> {
  const user = await requireUser();
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    select: { id: true, ownerId: true, payment: true },
  });
  if (!booking) throw new Error("Booking not found");
  if (booking.ownerId !== user.id) throw new Error("Unauthorized");
  if (!booking.payment || !["GCASH_DIRECT", "MAYA_DIRECT"].includes(booking.payment.method ?? "")) {
    throw new Error("This booking isn't set to a direct-wallet payment method");
  }

  const payment = await prisma.payment.update({
    where: { bookingId },
    data: { ownerMarkedSentAt: new Date() },
  });
  return toDisplay(payment);
}

// ============================================================
// confirmCashPayment — mechanic or shop owner confirms receipt in person
// (CASH) or after checking their own GCash/Maya wallet (GCASH_DIRECT /
// MAYA_DIRECT). Name kept as-is despite now covering more than literal
// cash, to avoid renaming across every file that already imports it
// (ConfirmCashPaymentButton and its call sites) — the underlying action is
// identical for all three: a human manually confirms money actually
// arrived, since none of these methods have an automated webhook the way
// ONLINE/PayMongo does.
// ============================================================
const MANUALLY_CONFIRMED_METHODS = ["CASH", "GCASH_DIRECT", "MAYA_DIRECT"];

export async function confirmCashPayment(bookingId: string): Promise<DisplayPayment> {
  const user = await requireUser();
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    select: { id: true, ownerId: true, mechanicId: true, shopId: true, payment: true },
  });
  if (!booking) throw new Error("Booking not found");
  const { isMechanic, isShopOwner } = await resolvePaymentAccess(booking, user);
  if (!isMechanic && !isShopOwner) throw new Error("Unauthorized");
  if (!booking.payment || !MANUALLY_CONFIRMED_METHODS.includes(booking.payment.method ?? "")) {
    throw new Error("This booking isn't set to a manually-confirmed payment method");
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
    prisma.invoice.update({
      where: { bookingId },
      data: { paymentStatus: "PAID", paidAt: new Date() },
    }),
  ]);

  return toDisplay(payment);
}

// ============================================================
// handlePaymongoEvent — unchanged, only ever applies to ONLINE payments.
// ============================================================
export async function handlePaymongoEvent(event: {
  type: string;
  data: { id: string; attributes: Record<string, unknown> };
}) {
  async function markPaid(sourceId: string) {
    const payment = await prisma.payment.findUnique({ where: { providerSourceId: sourceId } });
    if (!payment) return;
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
    const status = paymentRes.data.attributes.status;
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
}