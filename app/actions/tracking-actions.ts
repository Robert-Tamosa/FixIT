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

// ── Get mechanic (or shop) location for a booking ────────────────────────────
// Called by the owner's polling interval. Shop bookings have no assigned
// mechanic at all now (no assignment step exists anymore) — booking.mechanic
// is null in that case, so this falls back to the shop's own registered
// latitude/longitude/name instead. That's a static point, not live GPS
// movement — the shop's location doesn't move as the job progresses, unlike
// a real mechanic's watchPosition feed. Same return shape either way, so
// the owner tracking UI doesn't need to know which case it's in.

export async function getMechanicLocation(bookingId: string) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) throw new Error("Not authenticated.");

  const booking = await prisma.booking.findFirst({
    where: {
      id:      bookingId,
      ownerId: session.user.id,
      status:  { in: ["ESTIMATE_ACCEPTED", "EN_ROUTE", "IN_PROGRESS"] },
    },
    select: {
      status:     true,
      ownerLat:   true,
      ownerLng:   true,
      mechanicId: true,
      shopId:     true,
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
      shop: {
        select: {
          name:      true,
          latitude:  true,
          longitude: true,
        },
      },
    },
  });

  if (!booking) return null;

  let mechanicName: string;
  let mechanicLocation: { lat: number | null; lng: number | null; updatedAt: Date | null } | null;

  if (booking.mechanicId && booking.mechanic) {
    // Independent mechanic — real, live-updating position.
    const profile = booking.mechanic.mechanicProfile;
    mechanicName = booking.mechanic.name ?? "Mechanic";
    mechanicLocation = profile
      ? { lat: profile.latitude, lng: profile.longitude, updatedAt: profile.locationUpdatedAt }
      : null;
  } else if (booking.shopId && booking.shop) {
    // Shop booking, no mechanic assigned — static point at the shop's own
    // registered location. updatedAt is null since this never "updates"
    // the way live GPS does; the owner tracking UI should treat a null
    // updatedAt here as expected, not as stale/missing data.
    mechanicName = booking.shop.name;
    mechanicLocation = { lat: booking.shop.latitude, lng: booking.shop.longitude, updatedAt: null };
  } else {
    mechanicName = "Mechanic";
    mechanicLocation = null;
  }

  return {
    status:       booking.status,
    mechanicName,
    mechanic: mechanicLocation,
    owner: {
      lat: booking.ownerLat,
      lng: booking.ownerLng,
    },
  };
}

// Derived from getMechanicLocation's actual return type rather than hand-
// duplicated on the client — if the shape above ever changes, every
// consumer gets a compile error at the point of use instead of a silent
// runtime mismatch. Used by _owner-tracking.tsx.
export type MechanicLocationResult = Awaited<ReturnType<typeof getMechanicLocation>>;

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
      mechanicId: true,
      shopId:     true,
      mechanic: {
        select: {
          mechanicProfile: {
            select: { latitude: true, longitude: true },
          },
        },
      },
      shop: {
        select: { latitude: true, longitude: true },
      },
    },
  });

  if (!booking?.ownerLat || !booking?.ownerLng) {
    return { inside: false, distanceMeters: null };
  }

  // Same mechanic-or-shop fallback as getMechanicLocation above.
  const targetLat = booking.mechanicId
    ? booking.mechanic?.mechanicProfile?.latitude
    : booking.shop?.latitude;
  const targetLng = booking.mechanicId
    ? booking.mechanic?.mechanicProfile?.longitude
    : booking.shop?.longitude;

  if (!targetLat || !targetLng) {
    return { inside: false, distanceMeters: null };
  }

  const dist = haversineMeters(booking.ownerLat, booking.ownerLng, targetLat, targetLng);

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