"use server";

import { auth }           from "@/lib/auth";
import { prisma }         from "@/lib/prisma";
import { headers }        from "next/headers";
import { revalidatePath } from "next/cache";
import { createNotification } from "@/app/actions/notifications";

// ── Accept booking ────────────────────────────────────────────────────────────
// Moves booking from PENDING → CONFIRMED
// Only the assigned mechanic can accept. NOTE: this is the independent-
// mechanic path only — shop bookings use acceptShopBooking/declineShopBooking
// in shop-dashboard.ts instead, since a shop booking has no mechanicId to
// match against at this stage.

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
// Only the assigned mechanic can decline (see note above — shop bookings
// use their own accept/decline in shop-dashboard.ts).

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
// Now authorizes either the assigned mechanic OR the owner of the booking's
// shop — shop bookings never get a mechanicId at all (no assignment step
// anymore), so the shop owner has to be able to drive this progression
// themselves. mechanicId stays permanently null for shop-handled bookings;
// that's expected, not a missing-data bug.
//
// Two separate progressions: an independent mechanic travels to the owner
// (ESTIMATE_ACCEPTED -> EN_ROUTE -> IN_PROGRESS -> DONE), but a shop booking
// has the location auto-set to the SHOP's own address (the owner brings the
// vehicle there — see bookingModal.tsx's step-5 skip logic) — nobody is
// traveling to anybody, so EN_ROUTE never made sense for shop bookings and
// is skipped entirely (ESTIMATE_ACCEPTED -> IN_PROGRESS -> DONE).

const MECHANIC_NEXT_STATUS: Record<string, string> = {
  ESTIMATE_ACCEPTED: "EN_ROUTE",
  EN_ROUTE:           "IN_PROGRESS",
  IN_PROGRESS:        "DONE",
};

const SHOP_NEXT_STATUS: Record<string, string> = {
  ESTIMATE_ACCEPTED: "IN_PROGRESS",
  IN_PROGRESS:        "DONE",
};

export async function advanceBookingStatus(bookingId: string) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) throw new Error("Not authenticated.");

  const booking = await prisma.booking.findFirst({
    where: {
      id:     bookingId,
      status: { in: ["ESTIMATE_ACCEPTED", "EN_ROUTE", "IN_PROGRESS"] },
    },
    select: {
      id: true,
      ownerId: true,
      mechanicId: true,
      shopId: true,
      status: true,
      vehicle: { select: { brand: true, model: true } },
    },
  });

  if (!booking) throw new Error("Booking not found.");

  const isMechanic = booking.mechanicId === session.user.id;
  let isShopOwner = false;
  if (booking.shopId) {
    const shop = await prisma.repairShop.findUnique({
      where: { id: booking.shopId },
      select: { ownerId: true },
    });
    isShopOwner = shop?.ownerId === session.user.id;
  }
  if (!isMechanic && !isShopOwner) {
    throw new Error("Not authorized to update this booking.");
  }

  const isShopBooking = booking.shopId != null;
  const nextStatus = (isShopBooking ? SHOP_NEXT_STATUS : MECHANIC_NEXT_STATUS)[booking.status];
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
      title: "Help is on the way",
      body: `Heading to you now for the ${vehicleLabel} repair.`,
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
  revalidatePath("/dashboard/shop");
  revalidatePath("/dashboard/owner");
}