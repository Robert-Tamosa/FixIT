"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { toPlainNumber } from "@/lib/invoice-format";
import { createNotification } from "@/app/actions/notifications";

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

export interface EstimateInput {
  bookingId: string;
  laborCost: number;
  partsCost: number;
  notes?: string;
}

/**
 * Mechanic creates the cost estimate for a CONFIRMED booking.
 * Booking → ESTIMATE_SENT.
 */
export async function createEstimate(input: EstimateInput) {
  const user = await requireUser();
  if (user.role !== "MECHANIC") throw new Error("Only mechanics can create estimates");

  const booking = await prisma.booking.findUnique({
    where: { id: input.bookingId },
    include: { vehicle: { select: { brand: true, model: true } } },
  });
  if (!booking || booking.mechanicId !== user.id) throw new Error("Booking not found");
  if (booking.status !== "CONFIRMED") {
    throw new Error("Booking must be confirmed before sending an estimate");
  }

  const totalCost = input.laborCost + input.partsCost;

  await prisma.$transaction([
    prisma.costEstimate.create({
      data: {
        bookingId: input.bookingId,
        laborCost: input.laborCost,
        partsCost: input.partsCost,
        totalCost,
        notes: input.notes,
      },
    }),
    prisma.booking.update({
      where: { id: input.bookingId },
      data: { status: "ESTIMATE_SENT" },
    }),
  ]);

  await createNotification({
    userId: booking.ownerId,
    type: "ESTIMATE_SENT",
    title: "Repair estimate ready",
    body: `₱${totalCost.toLocaleString("en-PH")} for your ${booking.vehicle.brand} ${booking.vehicle.model} — review and accept to confirm.`,
    link: "/dashboard/owner",
  });

  revalidatePath("/dashboard/mechanic");
  revalidatePath("/dashboard/owner");
  return { success: true };
}

/**
 * Mechanic (before completion) or admin edits an existing estimate.
 * Does not change booking status — owner re-reviews the same ESTIMATE_SENT state.
 */
export async function editEstimate(input: EstimateInput) {
  const user = await requireUser();

  const booking = await prisma.booking.findUnique({ where: { id: input.bookingId } });
  if (!booking) throw new Error("Booking not found");

  const isOwnerMechanic = user.role === "MECHANIC" && booking.mechanicId === user.id;
  const isAdmin = user.role === "ADMIN";
  if (!isOwnerMechanic && !isAdmin) throw new Error("Not authorized to edit this estimate");
  if (booking.status === "DONE" || booking.status === "CANCELLED") {
    throw new Error("Cannot edit an estimate after the job is completed or cancelled");
  }

  const totalCost = input.laborCost + input.partsCost;

  await prisma.costEstimate.update({
    where: { bookingId: input.bookingId },
    data: {
      laborCost: input.laborCost,
      partsCost: input.partsCost,
      totalCost,
      notes: input.notes,
      isAccepted: false,
      acceptedAt: null,
    },
  });

  if (booking.status === "ESTIMATE_ACCEPTED") {
    await prisma.booking.update({
      where: { id: input.bookingId },
      data: { status: "ESTIMATE_SENT" },
    });
  }

  revalidatePath("/dashboard/mechanic");
  revalidatePath("/dashboard/owner");
  revalidatePath("/dashboard/admin/invoices");
  return { success: true };
}

/**
 * Owner accepts the estimate → booking moves to ESTIMATE_ACCEPTED,
 * unlocking the mechanic's "Start Travel" step.
 */
export async function acceptEstimate(bookingId: string) {
  const user = await requireUser();
  if (user.role !== "OWNER") throw new Error("Only the owner can accept an estimate");

  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: { vehicle: { select: { brand: true, model: true } } },
  });
  if (!booking || booking.ownerId !== user.id) throw new Error("Booking not found");
  if (booking.status !== "ESTIMATE_SENT") throw new Error("No pending estimate to accept");

  await prisma.$transaction([
    prisma.costEstimate.update({
      where: { bookingId },
      data: { isAccepted: true, acceptedAt: new Date() },
    }),
    prisma.booking.update({
      where: { id: bookingId },
      data: { status: "ESTIMATE_ACCEPTED" },
    }),
  ]);

  if (booking.mechanicId) {
    await createNotification({
      userId: booking.mechanicId,
      type: "ESTIMATE_ACCEPTED",
      title: "Estimate accepted",
      body: `The owner accepted your estimate for the ${booking.vehicle.brand} ${booking.vehicle.model}. You're clear to head out.`,
      link: "/dashboard/mechanic",
    });
  }

  revalidatePath("/dashboard/owner");
  revalidatePath("/dashboard/mechanic");
  return { success: true };
}

/**
 * Owner declines the estimate → booking moves to CANCELLED, matching the
 * "Decline → Booking Cancelled" branch of the flow (mirrors acceptEstimate
 * above, which only handles the Accept branch).
 */
export async function declineEstimate(bookingId: string) {
  const user = await requireUser();
  if (user.role !== "OWNER") throw new Error("Only the owner can decline an estimate");

  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: { vehicle: { select: { brand: true, model: true } } },
  });
  if (!booking || booking.ownerId !== user.id) throw new Error("Booking not found");
  if (booking.status !== "ESTIMATE_SENT") throw new Error("No pending estimate to decline");

  await prisma.booking.update({
    where: { id: bookingId },
    data: { status: "CANCELLED" },
  });

  if (booking.mechanicId) {
    await createNotification({
      userId: booking.mechanicId,
      type: "ESTIMATE_DECLINED",
      title: "Estimate declined",
      body: `The owner declined your estimate for the ${booking.vehicle.brand} ${booking.vehicle.model}. Booking cancelled.`,
      link: "/dashboard/mechanic",
    });
  }

  revalidatePath("/dashboard/owner");
  revalidatePath("/dashboard/mechanic");
  return { success: true };
}

export interface DisplayEstimate {
  id: string;
  laborCost: number;
  partsCost: number;
  totalCost: number;
  notes: string | null;
  isAccepted: boolean;
  acceptedAt: string | null;
}

/** Fetches the estimate for a booking, scoped to owner/mechanic (own bookings) or admin. */
export async function getEstimate(bookingId: string): Promise<DisplayEstimate | null> {
  const user = await requireUser();

  const booking = await prisma.booking.findUnique({ where: { id: bookingId } });
  if (!booking) throw new Error("Booking not found");

  const isOwner = user.role === "OWNER" && booking.ownerId === user.id;
  const isMechanic = user.role === "MECHANIC" && booking.mechanicId === user.id;
  const isAdmin = user.role === "ADMIN";
  if (!isOwner && !isMechanic && !isAdmin) throw new Error("Not authorized");

  const estimate = await prisma.costEstimate.findUnique({ where: { bookingId } });
  if (!estimate) return null;

  return {
    id: estimate.id,
    laborCost: toPlainNumber(estimate.laborCost),
    partsCost: toPlainNumber(estimate.partsCost),
    totalCost: toPlainNumber(estimate.totalCost),
    notes: estimate.notes,
    isAccepted: estimate.isAccepted,
    acceptedAt: estimate.acceptedAt ? estimate.acceptedAt.toISOString() : null,
  };
}