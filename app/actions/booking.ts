"use server";

import { auth }           from "@/lib/auth";
import { prisma }         from "@/lib/prisma";
import { headers }        from "next/headers";
import { revalidatePath } from "next/cache";
import { createNotification } from "@/app/actions/notifications";

interface CreateBookingInput {
  vehicleId:          string;
  mechanicId:         string | null; // null = "Any Available Mechanic" (or a shop pick, see shopId)
  shopId?:            string | null; // set when booking a shop directly — shop assigns a mechanic later
  problemDescription: string;
  scheduledAt:        string; // ISO string from the slot picker — required now, no more "As soon as possible" path
  ownerLat:           number;
  ownerLng:           number;
  address:            string;
}

const CONFLICT_BUFFER_MS = 60 * 60 * 1000; // ±1 hour — matches scheduling.ts's getAvailableSlots

/**
 * Picks a mechanic for an "Any Available Mechanic" booking (no shop
 * involved). Deliberately simple — available, verified, not currently on an
 * active job, picked at random among matches. This is NOT the weighted
 * distance/rating/AI ranking emergency bookings use (findEmergencyCandidates)
 * — that's overkill for a non-emergency booking; this just closes the gap
 * where such bookings previously had no dispatcher at all and sat PENDING
 * forever. Can graduate to real ranking later if it matters.
 */
async function findAnyAvailableMechanicId(): Promise<string | null> {
  const candidates = await prisma.mechanicProfile.findMany({
    where: {
      shopId:             null, // independent only — shop-affiliated mechanics are dispatched by their shop, not this pool
      isAvailable:        true,
      verificationStatus: "APPROVED",
      user: {
        bookingsAsMechanic: {
          none: { status: { in: ["CONFIRMED", "EN_ROUTE", "IN_PROGRESS"] } },
        },
      },
    },
    select: { userId: true },
  });

  if (candidates.length === 0) return null;
  return candidates[Math.floor(Math.random() * candidates.length)].userId;
}

export async function createBooking(data: CreateBookingInput) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) throw new Error("Unauthorized");

  if (!data.vehicleId)          throw new Error("Please select a vehicle.");
  if (!data.problemDescription) throw new Error("Please describe the problem.");
  if (!data.scheduledAt)        throw new Error("Please pick a date & time.");
  if (data.ownerLat == null || data.ownerLng == null) {
    throw new Error("Please share your location.");
  }
  if (data.mechanicId && data.shopId) {
    throw new Error("A booking can target a specific mechanic or a shop, not both.");
  }

  // Server-side re-check, not just trusting the client-side slot picker —
  // the picker's data could be stale (left open a while before submitting)
  // or a client could skip calling getAvailableSlots entirely. Only
  // meaningful for a specific mechanic pick; shop bookings and the auto-
  // assign path below have no single calendar to check against yet (same
  // gap as scheduling.ts's getAvailableSlots).
  if (data.mechanicId) {
    const requestedTime = new Date(data.scheduledAt).getTime();
    const conflict = await prisma.booking.findFirst({
      where: {
        mechanicId: data.mechanicId,
        status: { notIn: ["CANCELLED", "DECLINED"] },
        scheduledAt: {
          gte: new Date(requestedTime - CONFLICT_BUFFER_MS),
          lte: new Date(requestedTime + CONFLICT_BUFFER_MS),
        },
      },
      select: { id: true },
    });
    if (conflict) {
      throw new Error("This mechanic already has a job scheduled around that time — pick a different slot.");
    }
  }

  let mechanicId = data.mechanicId;

  // "Any Available Mechanic" with no shop — auto-assign right now instead of
  // leaving mechanicId null with nothing to ever pick it up.
  if (!mechanicId && !data.shopId) {
    mechanicId = await findAnyAvailableMechanicId();
    if (!mechanicId) {
      throw new Error("No independent mechanics are available right now — try selecting a shop instead.");
    }
  }

  const booking = await prisma.booking.create({
    data: {
      ownerId:            session.user.id,
      vehicleId:          data.vehicleId,
      mechanicId,
      shopId:             data.shopId ?? null,
      problemDescription: data.problemDescription,
      scheduledAt:        new Date(data.scheduledAt),
      ownerLat:           data.ownerLat,
      ownerLng:           data.ownerLng,
      address:            data.address,
      status:             "PENDING",
    },
    include: {
      vehicle: { select: { brand: true, model: true } },
    },
  });

  const vehicleLabel = `${booking.vehicle.brand} ${booking.vehicle.model}`;

  if (mechanicId) {
    // Covers both an explicit mechanic pick and the auto-assigned "Any
    // Available Mechanic" case above — either way, someone specific now
    // needs to see this in their Incoming Requests.
    await createNotification({
      userId: mechanicId,
      type: "NEW_BOOKING_REQUEST",
      title: "New booking request",
      body: `A new request for a ${vehicleLabel} is waiting for your response.`,
      link: "/dashboard/mechanic",
    });
  } else if (data.shopId) {
    // Shop-direct booking — no specific mechanic yet, so notify the shop
    // owner instead; they're the one who'll assign someone via
    // assignMechanicToBooking().
    const shop = await prisma.repairShop.findUnique({
      where: { id: data.shopId },
      select: { ownerId: true },
    });
    if (shop) {
      await createNotification({
        userId: shop.ownerId,
        type: "NEW_BOOKING_REQUEST",
        title: "New booking request",
        body: `A new request for a ${vehicleLabel} needs a mechanic assigned.`,
        link: "/dashboard/shop",
      });
    }
  }

  revalidatePath("/dashboard/owner");

  return { success: true, bookingId: booking.id };
}