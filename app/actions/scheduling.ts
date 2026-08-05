"use server";

import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const CONFLICT_BUFFER_MS = 60 * 60 * 1000; // ±1 hour
const SLOT_HOURS = [8, 9, 10, 11, 13, 14, 15, 16, 17]; // 8am–5pm, skipping the 12pm lunch hour

export interface TimeSlot {
  label: string;    // "9:00 AM"
  iso: string;      // full ISO datetime for that slot on the selected date
  available: boolean;
}

/**
 * Generates hourly slots for a given date. If mechanicId is provided, slots
 * within ±1hr of that mechanic's existing scheduled bookings are marked
 * unavailable — a hard-block conflict check against their actual calendar.
 *
 * Shop bookings and any case without a specific mechanicId can't be
 * conflict-checked this way — there's no single calendar to check against
 * until a specific mechanic is assigned (a shop has multiple mechanics, any
 * one of whom might be free even if others aren't). All slots show as
 * available in that case; this is a known, deliberate gap, not silently
 * wrong data — the UI should say so rather than imply a guarantee that
 * doesn't exist yet.
 */
export async function getAvailableSlots(dateISO: string, mechanicId?: string | null): Promise<TimeSlot[]> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) throw new Error("Unauthorized");

  const dayStart = new Date(dateISO);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(dayStart);
  dayEnd.setDate(dayEnd.getDate() + 1);

  let existingTimes: Date[] = [];

  if (mechanicId) {
    const existing = await prisma.booking.findMany({
      where: {
        mechanicId,
        scheduledAt: { gte: dayStart, lt: dayEnd },
        status: { notIn: ["CANCELLED", "DECLINED"] },
      },
      select: { scheduledAt: true },
    });
    existingTimes = existing.map((b) => b.scheduledAt).filter((d): d is Date => d !== null);
  }

  return SLOT_HOURS.map((hour) => {
    const slotDate = new Date(dayStart);
    slotDate.setHours(hour, 0, 0, 0);

    const conflicts = existingTimes.some(
      (t) => Math.abs(t.getTime() - slotDate.getTime()) < CONFLICT_BUFFER_MS
    );

    const displayHour = hour % 12 === 0 ? 12 : hour % 12;
    const period = hour < 12 ? "AM" : "PM";

    return {
      label: `${displayHour}:00 ${period}`,
      iso: slotDate.toISOString(),
      available: !conflicts,
    };
  });
}

export interface LocationOption {
  lat: number;
  lng: number;
  address: string;
}

/**
 * Fetches a specific mechanic's current known location, for the "mechanic's
 * location" option in the booking flow's location-sharing step. Reuses
 * MechanicProfile.latitude/longitude — the same field updateMechanicLocation
 * writes to during live tracking. Caveat worth knowing: this is "wherever
 * they were last recorded," not a fixed home base — it could be mid-job, at
 * home, anywhere. Good enough for "roughly where this mechanic operates,"
 * not a guaranteed fixed address the way a shop's registered address is.
 */
export async function getMechanicLocationForBooking(mechanicId: string): Promise<LocationOption | null> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) throw new Error("Unauthorized");

  const profile = await prisma.mechanicProfile.findUnique({
    where: { userId: mechanicId },
    select: {
      latitude: true,
      longitude: true,
      user: { select: { name: true } },
    },
  });

  if (!profile?.latitude || !profile?.longitude) return null;

  return {
    lat: profile.latitude,
    lng: profile.longitude,
    address: `${profile.user.name ?? "Mechanic"}'s current location`,
  };
}