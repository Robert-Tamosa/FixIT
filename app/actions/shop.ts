"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { toPlainNumber } from "@/lib/invoice-format";
import { geocodeAddress } from "@/lib/geocode";

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

export interface ShopInput {
  name: string;
  description?: string;
  address: string;
  latitude?: number;
  longitude?: number;
  phone?: string;
  email?: string;
  operatingHours?: Record<string, string>;
  services: string[];
}

export async function createShop(input: ShopInput) {
  const user = await requireUser();
  if (user.role !== "SHOP_OWNER") {
    throw new Error("Only shop-owner accounts can register a shop");
  }

  const existing = await prisma.repairShop.findUnique({ where: { ownerId: user.id } });
  if (existing) throw new Error("You already own a shop");

  const geocoded = input.latitude && input.longitude
    ? { lat: input.latitude, lng: input.longitude }
    : await geocodeAddress(input.address);

  const shop = await prisma.repairShop.create({
    data: {
      ownerId: user.id,
      name: input.name,
      description: input.description,
      address: input.address,
      latitude: geocoded?.lat ?? null,
      longitude: geocoded?.lng ?? null,
      phone: input.phone,
      email: input.email,
      operatingHours: input.operatingHours,
      services: input.services,
    },
  });

  revalidatePath("/dashboard/shop");
  return { success: true, shopId: shop.id, geocoded: geocoded !== null };
}

export async function updateShop(shopId: string, input: Partial<ShopInput>) {
  const user = await requireUser();
  const shop = await prisma.repairShop.findUnique({ where: { id: shopId } });
  if (!shop) throw new Error("Shop not found");
  if (shop.ownerId !== user.id && user.role !== "ADMIN") throw new Error("Not authorized");

  await prisma.repairShop.update({ where: { id: shopId }, data: input });
  revalidatePath(`/shops/${shopId}`);
  return { success: true };
}

export async function setMechanicShop(mechanicUserId: string, shopId: string | null) {
  const user = await requireUser();

  if (shopId) {
    const shop = await prisma.repairShop.findUnique({ where: { id: shopId } });
    if (!shop) throw new Error("Shop not found");
    if (shop.ownerId !== user.id && user.role !== "ADMIN") {
      throw new Error("Only the shop owner or an admin can add a mechanic to a shop");
    }
  } else {
    const isSelfRemoval = user.role === "MECHANIC" && user.id === mechanicUserId;
    const isAdmin = user.role === "ADMIN";
    const isShopOwnerOfCurrentShop =
      user.role === "SHOP_OWNER" &&
      (await prisma.repairShop.findFirst({
        where: { ownerId: user.id, mechanics: { some: { userId: mechanicUserId } } },
      })) !== null;
    if (!isSelfRemoval && !isAdmin && !isShopOwnerOfCurrentShop) {
      throw new Error("Not authorized to remove this mechanic from their shop");
    }
  }

  await prisma.mechanicProfile.update({
    where: { userId: mechanicUserId },
    data: { shopId },
  });

  revalidatePath("/dashboard/mechanic");
  revalidatePath("/dashboard/shop");
  return { success: true };
}

export interface DisplayShopMechanic {
  id: string;
  name: string;
  specialization: string;
  isAvailable: boolean;
  isVerified: boolean;
  avgRating: number;
}

export interface DisplayShopProfile {
  id: string;
  name: string;
  description: string | null;
  address: string;
  phone: string | null;
  email: string | null;
  logoUrl: string | null;
  operatingHours: Record<string, string> | null;
  services: string[];
  isVerified: boolean;
  avgRating: number;
  totalReviews: number;
  mechanics: DisplayShopMechanic[];
}

export async function getShopProfile(shopId: string): Promise<DisplayShopProfile | null> {
  const shop = await prisma.repairShop.findUnique({
    where: { id: shopId },
    include: {
      mechanics: {
        include: {
          user: { select: { name: true } },
          _count: true,
        },
      },
      ratings: { select: { rating: true } },
    },
  });
  if (!shop) return null;

  const avgRating = shop.ratings.length
    ? shop.ratings.reduce((sum, r) => sum + r.rating, 0) / shop.ratings.length
    : 0;

  const mechanicsWithRatings = await Promise.all(
    shop.mechanics.map(async (m) => {
      const ratings = await prisma.mechanicRating.findMany({
        where: { mechanicId: m.userId },
        select: { rating: true },
      });
      const avg = ratings.length
        ? ratings.reduce((s, r) => s + r.rating, 0) / ratings.length
        : 0;
      return {
        id: m.userId,
        name: m.user.name ?? "Unnamed",
        specialization: m.specialization,
        isAvailable: m.isAvailable,
        isVerified: m.isVerified,
        avgRating: Math.round(avg * 10) / 10,
      };
    }),
  );

  return {
    id: shop.id,
    name: shop.name,
    description: shop.description,
    address: shop.address,
    phone: shop.phone,
    email: shop.email,
    logoUrl: shop.logoUrl,
    operatingHours: (shop.operatingHours as Record<string, string> | null) ?? null,
    services: shop.services,
    isVerified: shop.isVerified,
    avgRating: Math.round(avgRating * 10) / 10,
    totalReviews: shop.ratings.length,
    mechanics: mechanicsWithRatings,
  };
}

export async function approveShop(shopId: string) {
  const user = await requireUser();
  if (user.role !== "ADMIN") throw new Error("Admin only");

  await prisma.repairShop.update({
    where: { id: shopId },
    data: { verificationStatus: "APPROVED", isVerified: true },
  });

  revalidatePath("/dashboard/admin");
  revalidatePath("/shop/pending");
  return { success: true };
}

export async function rejectShop(shopId: string, reason?: string) {
  const user = await requireUser();
  if (user.role !== "ADMIN") throw new Error("Admin only");

  await prisma.repairShop.update({
    where: { id: shopId },
    data: {
      verificationStatus: "REJECTED",
      isVerified: false,
      description: reason ? `[Rejected: ${reason}]` : undefined,
    },
  });

  revalidatePath("/dashboard/admin");
  revalidatePath("/shop/pending");
  return { success: true };
}

export interface DisplayPendingShop {
  id: string;
  name: string;
  address: string;
  ownerName: string;
  ownerEmail: string;
  services: string[];
  createdAt: string;
}

export async function getPendingShops(): Promise<DisplayPendingShop[]> {
  const user = await requireUser();
  if (user.role !== "ADMIN") throw new Error("Admin only");

  const shops = await prisma.repairShop.findMany({
    where: { verificationStatus: "PENDING" },
    include: { owner: { select: { name: true, email: true } } },
    orderBy: { createdAt: "asc" },
  });

  return shops.map((s) => ({
    id: s.id,
    name: s.name,
    address: s.address,
    ownerName: s.owner.name ?? "Unnamed",
    ownerEmail: s.owner.email,
    services: s.services,
    createdAt: s.createdAt.toISOString(),
  }));
}

export async function getMyShop(): Promise<DisplayShopProfile | null> {
  const user = await requireUser();
  if (user.role !== "SHOP_OWNER") throw new Error("Shop-owner accounts only");

  const shop = await prisma.repairShop.findUnique({ where: { ownerId: user.id } });
  if (!shop) return null;
  return getShopProfile(shop.id);
}

/**
 * One-time-feeling GPS location share for a shop owner physically standing
 * at their shop — mirrors the owner's saveHomeLocation pattern. Now also
 * updates `address` (reverse-geocoded), not just latitude/longitude — the
 * previous version only touched coordinates, so the dashboard's displayed
 * address stayed frozen at whatever was set (or geocoded) at signup, even
 * as the actual GPS location changed. That mismatch was the bug: distance/
 * geofence math was correct the whole time (it uses lat/lng), but the text
 * shown on screen never caught up.
 */
export async function shareShopLocation(latitude: number, longitude: number, address?: string) {
  const user = await requireUser();
  if (user.role !== "SHOP_OWNER") throw new Error("Shop-owner accounts only");

  const shop = await prisma.repairShop.findUnique({ where: { ownerId: user.id } });
  if (!shop) throw new Error("You don't have a shop registered yet");

  await prisma.repairShop.update({
    where: { id: shop.id },
    data: {
      latitude,
      longitude,
      ...(address ? { address } : {}),
    },
  });

  revalidatePath("/dashboard/shop");
  return { success: true };
}

// ── Sentiment analysis via Gemini ────────────────────────────────────────────
// Duplicated from submit-rating.ts rather than shared — each actions file in
// this project stays self-contained, matching the existing pattern (e.g.
// requireUser()/requireShopOwner() are separately defined per-file too,
// not imported from one shared auth-helpers module).

async function analyzeSentiment(comment: string): Promise<string> {
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          system_instruction: {
            parts: [{ text: "Classify the sentiment of this shop review as exactly one word: POSITIVE, NEUTRAL, or NEGATIVE. Reply with only that word, nothing else." }],
          },
          contents: [{ role: "user", parts: [{ text: comment }] }],
          generationConfig: { maxOutputTokens: 5, temperature: 0 },
        }),
      }
    );
    const data = await res.json();
    const word = (data.candidates?.[0]?.content?.parts?.[0]?.text ?? "")
      .trim()
      .toUpperCase();
    if (["POSITIVE", "NEUTRAL", "NEGATIVE"].includes(word)) return word;
    return "NEUTRAL";
  } catch {
    return "NEUTRAL";
  }
}

/**
 * Direct shop-rating entry point (separate from submit-rating.ts's
 * submitRating(), which branches between MechanicRating/ShopRating based on
 * the booking). Now runs the same sentiment analysis submit-rating.ts's
 * mechanic-rating path already did — previously this always fell back to
 * ShopRating's schema default ("NEUTRAL") regardless of what the comment
 * actually said, since nothing here ever computed a real value.
 */
export async function rateShop(bookingId: string, shopId: string, rating: number, comment?: string) {
  const user = await requireUser();
  if (user.role !== "OWNER") throw new Error("Only owners can rate shops");
  if (rating < 1 || rating > 5) throw new Error("Rating must be between 1 and 5");

  const booking = await prisma.booking.findUnique({ where: { id: bookingId } });
  if (!booking || booking.ownerId !== user.id) throw new Error("Booking not found");
  if (booking.status !== "DONE") throw new Error("Can only rate after the job is done");

  const sentiment = comment ? await analyzeSentiment(comment) : "NEUTRAL";

  await prisma.shopRating.create({
    data: { shopId, ownerId: user.id, bookingId, rating, comment, sentiment },
  });

  revalidatePath(`/shops/${shopId}`);
  return { success: true };
}