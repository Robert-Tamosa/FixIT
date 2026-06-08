"use server";

import { auth }           from "@/lib/auth";
import { prisma }         from "@/lib/prisma";
import { headers }        from "next/headers";
import { revalidatePath } from "next/cache";

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
  });

  if (!booking) throw new Error("Booking not found or already actioned.");

  await prisma.booking.update({
    where: { id: bookingId },
    data:  { status: "CONFIRMED" },
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
  });

  if (!booking) throw new Error("Booking not found or already actioned.");

  await prisma.booking.update({
    where: { id: bookingId },
    data:  { status: "CANCELLED" },
  });

  revalidatePath("/dashboard/mechanic");
  revalidatePath("/dashboard/owner");
}

// ── Advance booking status ────────────────────────────────────────────────────
// CONFIRMED → EN_ROUTE → IN_PROGRESS → DONE

const NEXT_STATUS: Record<string, string> = {
  CONFIRMED:   "EN_ROUTE",
  EN_ROUTE:    "IN_PROGRESS",
  IN_PROGRESS: "DONE",
};

export async function advanceBookingStatus(bookingId: string) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) throw new Error("Not authenticated.");

  const booking = await prisma.booking.findFirst({
    where: {
      id:         bookingId,
      mechanicId: session.user.id,
      status:     { in: ["CONFIRMED", "EN_ROUTE", "IN_PROGRESS"] },
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

  revalidatePath("/dashboard/mechanic");
  revalidatePath("/dashboard/owner");
}