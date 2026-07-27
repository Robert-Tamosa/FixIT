"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { haversineKm, estimateEtaMinutes } from "@/lib/geo";
import { analyzeEmergencySymptoms, type EmergencyAnalysis } from "@/lib/groq-emergency";

const SEARCH_RADIUS_KM = 15;
const TOP_N = 5;

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

export interface EmergencyCandidate {
  mechanicId: string;
  name: string;
  specialization: string;
  shopId: string | null;
  shopName: string | null;
  distanceKm: number;
  etaMinutes: number;
  rating: number;
  yearsExperience: number | null;
  specializationMatch: boolean;
  matchScore: number; // 0-100
}

export interface EmergencyMatchResult {
  analysis: EmergencyAnalysis;
  candidates: EmergencyCandidate[];
}

/**
 * Core matching pipeline: AI symptom analysis → merged search (shop-affiliated +
 * independent mechanics) → filter → rank → top 5.
 * Excludes any mechanicIds already declined for a given booking, to support fallback.
 */
export async function findEmergencyCandidates(
  vehicleId: string,
  ownerLat: number,
  ownerLng: number,
  problemDescription: string,
  excludeMechanicIds: string[] = [],
): Promise<EmergencyMatchResult> {
  const user = await requireUser();
  if (user.role !== "OWNER") throw new Error("Only owners can request emergency assistance");

  const vehicle = await prisma.vehicle.findUnique({ where: { id: vehicleId } });
  if (!vehicle || vehicle.ownerId !== user.id) throw new Error("Vehicle not found");

  const analysis = await analyzeEmergencySymptoms(
    { brand: vehicle.brand, model: vehicle.model, yearModel: vehicle.yearModel, mileage: vehicle.mileage },
    problemDescription,
  );

  // Search A: mechanics affiliated with a shop. Search B: independent (shopId null).
  // Both come from the same table — a single query naturally merges them; kept as
  // one call for simplicity, but the shopId presence distinguishes the two pools.
  //
  // Location basis differs by pool: shop-affiliated mechanics fall back to their
  // shop's fixed address if they haven't set (or don't need) their own GPS
  // coordinates — a shop mechanic is reasonably assumed to be at the shop most
  // of the time. Independent mechanics have no fixed base, so they're excluded
  // if they have no coordinates of their own (nothing to fall back to).
  const rawCandidates = await prisma.mechanicProfile.findMany({
    where: {
      isAvailable: true,
      isVerified: true,
      userId: { notIn: excludeMechanicIds },
    },
    include: {
      user: { select: { name: true } },
      shop: { select: { id: true, name: true, isVerified: true, latitude: true, longitude: true } },
    },
  });

  const withResolvedLocation = rawCandidates
    .map((m) => {
      const lat = m.latitude ?? m.shop?.latitude ?? null;
      const lng = m.longitude ?? m.shop?.longitude ?? null;
      return { profile: m, lat, lng };
    })
    .filter((c): c is typeof c & { lat: number; lng: number } => c.lat !== null && c.lng !== null);
  console.log(`[emergency] candidates with a resolved location: ${withResolvedLocation.length}`);

  const withDistance = withResolvedLocation
    .map(({ profile, lat, lng }) => {
      const distanceKm = haversineKm(ownerLat, ownerLng, lat, lng);
      return { profile, distanceKm };
    })
    .filter((c) => c.distanceKm <= SEARCH_RADIUS_KM);
  console.log(`[emergency] candidates within ${SEARCH_RADIUS_KM}km: ${withDistance.length}`,
    withResolvedLocation.map(c => ({ id: c.profile.userId, lat: c.lat, lng: c.lng, viaShop: c.profile.latitude === null })));

  // Pull ratings for all candidates in one query.
  const mechanicIds = withDistance.map((c) => c.profile.userId);
  const ratings = await prisma.mechanicRating.groupBy({
    by: ["mechanicId"],
    where: { mechanicId: { in: mechanicIds } },
    _avg: { rating: true },
  });
  const ratingMap = new Map(ratings.map((r) => [r.mechanicId, r._avg.rating ?? 0]));

  const scored: EmergencyCandidate[] = withDistance.map(({ profile, distanceKm }) => {
    const specializationMatch = profile.specialization === analysis.recommendedSpecialization;
    const rating = ratingMap.get(profile.userId) ?? 0;
    const etaMinutes = estimateEtaMinutes(distanceKm);

    // Weighted scoring, 0-100:
    //   Specialization match: 40 pts
    //   Distance (closer = better, normalized against search radius): 25 pts
    //   ETA is derived from distance, so folded into the same 25 via inverse curve
    //   Rating: 25 pts (out of 5 stars)
    //   Years experience: 10 pts (capped at 10 years)
    const specScore = specializationMatch ? 40 : 15;
    const distanceScore = Math.max(0, 25 * (1 - distanceKm / SEARCH_RADIUS_KM));
    const ratingScore = (rating / 5) * 25;
    const expScore = Math.min((profile.yearsExperience ?? 0) / 10, 1) * 10;
    const matchScore = Math.round(specScore + distanceScore + ratingScore + expScore);

    return {
      mechanicId: profile.userId,
      name: profile.user.name ?? "Unnamed Mechanic",
      specialization: profile.specialization,
      shopId: profile.shop?.id ?? null,
      shopName: profile.shop?.name ?? null,
      distanceKm: Math.round(distanceKm * 10) / 10,
      etaMinutes,
      rating: Math.round(rating * 10) / 10,
      yearsExperience: profile.yearsExperience,
      specializationMatch,
      matchScore,
    };
  });

  scored.sort((a, b) => b.matchScore - a.matchScore);

  return { analysis, candidates: scored.slice(0, TOP_N) };
}

/** Owner selects one of the recommended mechanics to create the emergency booking. */
export async function createEmergencyBooking(
  vehicleId: string,
  mechanicId: string,
  ownerLat: number,
  ownerLng: number,
  problemDescription: string,
  analysis: EmergencyAnalysis,
  matchScore: number,
) {
  const user = await requireUser();
  if (user.role !== "OWNER") throw new Error("Only owners can request emergency assistance");

  const mechanicProfile = await prisma.mechanicProfile.findUnique({
    where: { userId: mechanicId },
    select: { shopId: true },
  });
  if (!mechanicProfile) throw new Error("Mechanic not found");

  const booking = await prisma.booking.create({
    data: {
      ownerId: user.id,
      mechanicId,
      vehicleId,
      problemDescription: `${problemDescription}\n\n[AI diagnosis: ${analysis.diagnosis}]`,
      isEmergency: true,
      ownerLat,
      ownerLng,
      status: "PENDING",
      bookingType: "EMERGENCY",
      shopId: mechanicProfile.shopId,
      aiMatchScore: matchScore,
    },
  });

  revalidatePath("/dashboard/owner");
  revalidatePath("/dashboard/mechanic");
  return { success: true, bookingId: booking.id };
}

/**
 * Mechanic declines an emergency request. The system automatically reassigns to
 * the next-best candidate (re-running the ranking, excluding everyone who has
 * already declined) rather than bouncing the owner back to manual search.
 * If no candidates remain, the booking is marked DECLINED for the owner to
 * handle manually.
 */
export async function declineEmergencyBooking(bookingId: string) {
  const user = await requireUser();
  if (user.role !== "MECHANIC") throw new Error("Only mechanics can decline");

  const booking = await prisma.booking.findUnique({ where: { id: bookingId } });
  if (!booking || booking.mechanicId !== user.id) throw new Error("Booking not found");
  if (booking.status !== "PENDING") throw new Error("Booking is no longer pending");
  if (booking.bookingType !== "EMERGENCY") {
    throw new Error("Use declineBooking for scheduled bookings");
  }
  if (!booking.ownerLat || !booking.ownerLng) throw new Error("Missing owner location");

  const updatedDeclineList = [...booking.declinedByIds, user.id];

  const { candidates } = await findEmergencyCandidates(
    booking.vehicleId,
    booking.ownerLat,
    booking.ownerLng,
    booking.problemDescription,
    updatedDeclineList,
  );

  if (candidates.length === 0) {
    await prisma.booking.update({
      where: { id: bookingId },
      data: { status: "DECLINED", declinedByIds: updatedDeclineList },
    });
    revalidatePath("/dashboard/owner");
    return { success: true, reassigned: false };
  }

  const next = candidates[0];
  await prisma.booking.update({
    where: { id: bookingId },
    data: {
      mechanicId: next.mechanicId,
      shopId: next.shopId,
      aiMatchScore: next.matchScore,
      declinedByIds: updatedDeclineList,
      status: "PENDING", // stays pending, now awaiting the next mechanic
    },
  });

  revalidatePath("/dashboard/owner");
  revalidatePath("/dashboard/mechanic");
  return { success: true, reassigned: true, newMechanicName: next.name };
}