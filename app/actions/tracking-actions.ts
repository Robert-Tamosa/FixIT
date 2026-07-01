"use server";

import { auth }           from "@/lib/auth";
import { prisma }         from "@/lib/prisma";
import { headers }        from "next/headers";
import { revalidatePath } from "next/cache";

// ── Update mechanic's live location ──────────────────────────────────────────
// Called every N seconds from the mechanic's device while EN_ROUTE/IN_PROGRESS

export async function updateMechanicLocation(lat: number, lng: number) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) throw new Error("Not authenticated.");

  await prisma.mechanicProfile.update({
    where: { userId: session.user.id },
    data: {
      latitude:          lat,
      longitude:         lng,
      locationUpdatedAt: new Date(),
    },
  });
}

// ── Get mechanic location for a booking ──────────────────────────────────────
// Called by the owner's polling interval

export async function getMechanicLocation(bookingId: string) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) throw new Error("Not authenticated.");

  const booking = await prisma.booking.findFirst({
    where: {
      id:      bookingId,
      ownerId: session.user.id,
      status:  { in: ["CONFIRMED", "EN_ROUTE", "IN_PROGRESS"] },
    },
    select: {
      status:     true,
      ownerLat:   true,
      ownerLng:   true,
      mechanic: {
        select: {
          name: true,
          mechanicProfile: {
            select: {
              latitude:          true,
              longitude:         true,
              locationUpdatedAt: true,
            },
          },
        },
      },
    },
  });

  if (!booking) return null;

  const profile = booking.mechanic.mechanicProfile;
  return {
    status:       booking.status,
    mechanicName: booking.mechanic.name ?? "Mechanic",
    mechanic: profile ? {
      lat:       profile.latitude,
      lng:       profile.longitude,
      updatedAt: profile.locationUpdatedAt,
    } : null,
    owner: {
      lat: booking.ownerLat,
      lng: booking.ownerLng,
    },
  };
}

// ── Save owner's pinned location on a booking ─────────────────────────────────

export async function saveOwnerLocation(
  bookingId: string,
  lat: number,
  lng: number,
  address: string
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) throw new Error("Not authenticated.");

  await prisma.booking.update({
    where: { id: bookingId, ownerId: session.user.id },
    data:  { ownerLat: lat, ownerLng: lng, address },
  });

  revalidatePath("/dashboard/owner");
}

// ── Geofence check ────────────────────────────────────────────────────────────
// Returns true if mechanic is within radiusMeters of the owner's pinned location

export async function checkGeofence(
  bookingId: string,
  radiusMeters: number = 200
): Promise<{ inside: boolean; distanceMeters: number | null }> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return { inside: false, distanceMeters: null };

  const booking = await prisma.booking.findFirst({
    where: { id: bookingId, ownerId: session.user.id },
    select: {
      ownerLat:   true,
      ownerLng:   true,
      mechanic: {
        select: {
          mechanicProfile: {
            select: { latitude: true, longitude: true },
          },
        },
      },
    },
  });

  if (
    !booking?.ownerLat || !booking?.ownerLng ||
    !booking.mechanic.mechanicProfile?.latitude ||
    !booking.mechanic.mechanicProfile?.longitude
  ) {
    return { inside: false, distanceMeters: null };
  }

  const dist = haversineMeters(
    booking.ownerLat,
    booking.ownerLng,
    booking.mechanic.mechanicProfile.latitude,
    booking.mechanic.mechanicProfile.longitude
  );

  return { inside: dist <= radiusMeters, distanceMeters: Math.round(dist) };
}

// ── Haversine formula ─────────────────────────────────────────────────────────

function haversineMeters(
  lat1: number, lng1: number,
  lat2: number, lng2: number
): number {
  const R    = 6_371_000; // earth radius in metres
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a    =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function toRad(deg: number) { return (deg * Math.PI) / 180; }