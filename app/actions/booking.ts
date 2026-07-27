"use server";

import { auth }           from "@/lib/auth";
import { prisma }         from "@/lib/prisma";
import { headers }        from "next/headers";
import { revalidatePath } from "next/cache";

interface CreateBookingInput {
  vehicleId:          string;
  mechanicId:         string | null; // null = "Any Available Mechanic" (or a shop pick, see shopId)
  shopId?:            string | null; // set when booking a shop directly — shop assigns a mechanic later
  problemDescription: string;
  scheduledAt?:       string; // ISO string from the datetime-local input
  ownerLat:           number;
  ownerLng:           number;
  address:            string;
}

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
  if (data.ownerLat == null || data.ownerLng == null) {
    throw new Error("Please share your location.");
  }
  if (data.mechanicId && data.shopId) {
    throw new Error("A booking can target a specific mechanic or a shop, not both.");
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
      scheduledAt:        data.scheduledAt ? new Date(data.scheduledAt) : undefined,
      ownerLat:           data.ownerLat,
      ownerLng:           data.ownerLng,
      address:            data.address,
      status:             "PENDING",
    },
  });

  revalidatePath("/dashboard/owner");

  return { success: true, bookingId: booking.id };
}