"use server";

import { auth }           from "@/lib/auth";
import { prisma }         from "@/lib/prisma";
import { headers }        from "next/headers";
import { revalidatePath } from "next/cache";
import { createNotification } from "@/app/actions/notifications";

// ── Accept booking ────────────────────────────────────────────────────────────
// Moves booking from PENDING → CONFIRMED
// Only the assigned mechanic can accept

export async function acceptBooking(bookingId: string) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) throw new Error("Not authenticated.");

  const booking = await prisma.booking.findFirst({
    where: {
      id:         bookingId,
      mechanicId: session.user.id,
      status:     "PENDING",
    },
    select: {
      id: true,
      ownerId: true,
      vehicle: { select: { brand: true, model: true } },
    },
  });

  if (!booking) throw new Error("Booking not found or already actioned.");

  await prisma.booking.update({
    where: { id: bookingId },
    data:  { status: "CONFIRMED" },
  });

  await createNotification({
    userId: booking.ownerId,
    type: "BOOKING_ACCEPTED",
    title: "Mechanic accepted your request",
    body: `Your ${booking.vehicle.brand} ${booking.vehicle.model} booking was accepted. Preparing a cost estimate next.`,
    link: "/dashboard/owner",
  });

  revalidatePath("/dashboard/mechanic");
  revalidatePath("/dashboard/owner");
}

// ── Decline booking ───────────────────────────────────────────────────────────
// Moves booking from PENDING → CANCELLED
// Only the assigned mechanic can decline

export async function declineBooking(bookingId: string) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) throw new Error("Not authenticated.");

  const booking = await prisma.booking.findFirst({
    where: {
      id:         bookingId,
      mechanicId: session.user.id,
      status:     "PENDING",
    },
    select: {
      id: true,
      ownerId: true,
      vehicle: { select: { brand: true, model: true } },
    },
  });

  if (!booking) throw new Error("Booking not found or already actioned.");

  await prisma.booking.update({
    where: { id: bookingId },
    data:  { status: "CANCELLED" },
  });

  await createNotification({
    userId: booking.ownerId,
    type: "BOOKING_DECLINED",
    title: "Booking request declined",
    body: `Your ${booking.vehicle.brand} ${booking.vehicle.model} request wasn't accepted. Try another mechanic or shop.`,
    link: "/dashboard/owner",
  });

  revalidatePath("/dashboard/mechanic");
  revalidatePath("/dashboard/owner");
}

// ── Advance booking status ────────────────────────────────────────────────────
// ESTIMATE_ACCEPTED → EN_ROUTE → IN_PROGRESS → DONE
//
// NOTE: this intentionally does NOT start from CONFIRMED anymore. CONFIRMED
// now means "mechanic accepted the request, needs to send an estimate" —
// see estimate.ts's createEstimate(), which requires status === CONFIRMED
// and moves it to ESTIMATE_SENT. The booking only becomes travel-eligible
// once the owner accepts that estimate (estimate.ts's acceptEstimate(),
// ESTIMATE_SENT → ESTIMATE_ACCEPTED). Previously this map let CONFIRMED
// jump straight to EN_ROUTE, which skipped the estimate step entirely.

const NEXT_STATUS: Record<string, string> = {
  ESTIMATE_ACCEPTED: "EN_ROUTE",
  EN_ROUTE:           "IN_PROGRESS",
  IN_PROGRESS:        "DONE",
};

export async function advanceBookingStatus(bookingId: string) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) throw new Error("Not authenticated.");

  const booking = await prisma.booking.findFirst({
    where: {
      id:         bookingId,
      mechanicId: session.user.id,
      status:     { in: ["ESTIMATE_ACCEPTED", "EN_ROUTE", "IN_PROGRESS"] },
    },
    select: {
      id: true,
      ownerId: true,
      status: true,
      vehicle: { select: { brand: true, model: true } },
    },
  });

  if (!booking) throw new Error("Booking not found.");

  const nextStatus = NEXT_STATUS[booking.status];
  if (!nextStatus) throw new Error("Cannot advance from current status.");

  await prisma.booking.update({
    where: { id: bookingId },
    data: {
      status:      nextStatus as any,
      completedAt: nextStatus === "DONE" ? new Date() : undefined,
    },
  });

  const vehicleLabel = `${booking.vehicle.brand} ${booking.vehicle.model}`;
  const NOTIFY_COPY: Record<string, { title: string; body: string; link: string }> = {
    EN_ROUTE: {
      title: "Mechanic is on the way",
      body: `Your mechanic is heading to you for the ${vehicleLabel} repair.`,
      link: `/dashboard/owner/tracking/${bookingId}`,
    },
    IN_PROGRESS: {
      title: "Repair started",
      body: `Work has begun on your ${vehicleLabel}.`,
      link: `/dashboard/owner/tracking/${bookingId}`,
    },
    DONE: {
      title: "Service completed",
      body: `Your ${vehicleLabel} repair is done. An invoice is on its way.`,
      link: "/dashboard/owner",
    },
  };

  const copy = NOTIFY_COPY[nextStatus];
  if (copy) {
    await createNotification({
      userId: booking.ownerId,
      type: nextStatus,
      title: copy.title,
      body: copy.body,
      link: copy.link,
    });
  }

  revalidatePath("/dashboard/mechanic");
  revalidatePath("/dashboard/owner");
}