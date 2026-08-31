"use server";

import { headers } from "next/headers";
import { auth } from "@/lib/auth"; // ASSUMPTION — adjust to your actual auth import path
import { prisma } from "@/lib/prisma"; // ASSUMPTION — adjust to your actual prisma import path

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
// "ONLINE" kept in the type union purely so any pre-existing PayMongo
// payment rows from before this change still display sensibly (e.g. in
// booking history) rather than hitting an unhandled case — but nothing in
// this file can CREATE a new ONLINE payment anymore. If you're certain no
// ONLINE rows exist yet, this can be dropped along with the PaymentMethod
// enum value in schema.prisma; left in as the safer default otherwise.
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
// booking's mechanic/shop have configured. The owner's payment picker only
// offers GCash/Maya at all when this returns something — with PayMongo
// gone, there's no fallback e-wallet path if neither is set up.
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
// Shared setup for choosing any payment method.
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
      directQrImage: null,
      directAccountName: null,
      directIsBusiness: null,
      ownerMarkedSentAt: null,
    },
  });
  return toDisplay(payment);
}

// ============================================================
// chooseDirectPayment — owner selects GCash or Maya: money goes straight
// to the mechanic/shop's own personal or business wallet. No PayMongo
// involved at all — this is now the ONLY way to pay via GCash/Maya.
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
      `This ${booking.shopId ? "shop" : "mechanic"} hasn't set up ${provider === "gcash" ? "GCash" : "Maya"} payments yet — choose Cash instead.`,
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
// the direct-wallet QR. Purely informational — does not move status to PAID.
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
// confirmCashPayment — mechanic or shop owner confirms receipt, for CASH
// or GCASH_DIRECT/MAYA_DIRECT. Name kept as-is (predates the direct-wallet
// methods) to avoid renaming across every file that imports it.
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