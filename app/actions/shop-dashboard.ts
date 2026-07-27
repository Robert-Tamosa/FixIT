"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { toPlainNumber } from "@/lib/invoice-format";

async function requireShopOwner() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) throw new Error("Unauthorized");
  const dbUser = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, role: true },
  });
  if (!dbUser || dbUser.role !== "SHOP_OWNER") throw new Error("Shop-owner accounts only");

  const shop = await prisma.repairShop.findUnique({ where: { ownerId: dbUser.id } });
  if (!shop) throw new Error("You don't have a shop registered yet");

  return { user: dbUser, shopId: shop.id };
}

// ── Overview ─────────────────────────────────────────────────────────────────

export interface ShopOverviewStats {
  totalBookings: number;
  activeJobs: number;
  availableMechanics: number;
  todaysRevenue: number;
  pendingRequests: number;
}

export interface DisplayShopBookingRow {
  id: string;
  ownerName: string;
  vehicleLabel: string;
  status: string;
  mechanicName: string | null;
  createdAt: string;
}

export async function getShopOverview(): Promise<{
  stats: ShopOverviewStats;
  recentBookings: DisplayShopBookingRow[];
}> {
  const { shopId } = await requireShopOwner();

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const [totalBookings, activeJobs, availableMechanics, pendingRequests, todaysDone, rawRecent] =
    await Promise.all([
      prisma.booking.count({ where: { shopId } }),
      prisma.booking.count({ where: { shopId, status: { in: ["EN_ROUTE", "IN_PROGRESS"] } } }),
      prisma.mechanicProfile.count({ where: { shopId, isAvailable: true } }),
      prisma.booking.count({ where: { shopId, status: { in: ["PENDING", "CONFIRMED"] } } }),
      prisma.booking.findMany({
        where: { shopId, status: "DONE", updatedAt: { gte: todayStart } },
        select: { price: true },
      }),
      prisma.booking.findMany({
        where: { shopId },
        include: {
          owner: { select: { name: true } },
          mechanic: { select: { name: true } },
          vehicle: { select: { brand: true, model: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 8,
      }),
    ]);

  const todaysRevenue = todaysDone.reduce((sum, b) => sum + (b.price ? toPlainNumber(b.price) : 0), 0);

  const recentBookings: DisplayShopBookingRow[] = rawRecent.map((b) => ({
    id: b.id,
    ownerName: b.owner.name ?? "Unknown",
    vehicleLabel: `${b.vehicle.brand} ${b.vehicle.model}`,
    status: b.status,
    mechanicName: b.mechanic?.name ?? null,
    createdAt: b.createdAt.toLocaleDateString("en-PH", { month: "short", day: "numeric" }),
  }));

  return {
    stats: {
      totalBookings,
      activeJobs,
      availableMechanics,
      todaysRevenue,
      pendingRequests,
    },
    recentBookings,
  };
}

// ── Bookings ─────────────────────────────────────────────────────────────────

export interface DisplayShopBooking {
  id: string;
  ownerName: string;
  vehicleLabel: string;
  problem: string;
  status: string;
  mechanicId: string | null;
  mechanicName: string | null;
  isEmergency: boolean;
  createdAt: string;
}

/** All bookings tied to this shop, optionally filtered by status. */
export async function getShopBookings(statusFilter?: string): Promise<DisplayShopBooking[]> {
  const { shopId } = await requireShopOwner();

  const bookings = await prisma.booking.findMany({
    where: {
      shopId,
      ...(statusFilter ? { status: statusFilter as never } : {}),
    },
    include: {
      owner: { select: { name: true } },
      mechanic: { select: { id: true, name: true } },
      vehicle: { select: { brand: true, model: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return bookings.map((b) => ({
    id: b.id,
    ownerName: b.owner.name ?? "Unknown",
    vehicleLabel: `${b.vehicle.brand} ${b.vehicle.model}`,
    problem: b.problemDescription,
    status: b.status,
    mechanicId: b.mechanic?.id ?? null,
    mechanicName: b.mechanic?.name ?? null,
    isEmergency: b.isEmergency ?? false,
    createdAt: b.createdAt.toLocaleDateString("en-PH", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }),
  }));
}

export interface DisplayAssignableMechanic {
  id: string;
  name: string;
  specialization: string;
  isAvailable: boolean;
}

/** Roster of this shop's mechanics, for the assignment picker. */
export async function getAssignableMechanics(): Promise<DisplayAssignableMechanic[]> {
  const { shopId } = await requireShopOwner();

  const mechanics = await prisma.mechanicProfile.findMany({
    where: { shopId },
    include: { user: { select: { id: true, name: true } } },
  });

  return mechanics.map((m) => ({
    id: m.userId,
    name: m.user.name ?? "Unnamed",
    specialization: m.specialization,
    isAvailable: m.isAvailable,
  }));
}

/**
 * Assigns a mechanic to a booking that came in as "Any Available Mechanic"
 * (booked directly to the shop, mechanicId null). Also covers reassignment —
 * changing an already-assigned mechanic to a different one on the same shop,
 * as long as the job hasn't finished.
 */
export async function assignMechanicToBooking(bookingId: string, mechanicId: string) {
  const { shopId } = await requireShopOwner();

  const booking = await prisma.booking.findUnique({ where: { id: bookingId } });
  if (!booking || booking.shopId !== shopId) throw new Error("Booking not found for this shop");
  if (booking.status === "DONE" || booking.status === "CANCELLED") {
    throw new Error("Cannot assign a mechanic to a finished or cancelled booking");
  }

  const mechanicProfile = await prisma.mechanicProfile.findUnique({ where: { userId: mechanicId } });
  if (!mechanicProfile || mechanicProfile.shopId !== shopId) {
    throw new Error("That mechanic doesn't belong to your shop");
  }

  await prisma.booking.update({
    where: { id: bookingId },
    data: { mechanicId, status: booking.mechanicId ? booking.status : "PENDING" },
  });

  revalidatePath("/dashboard/shop");
  return { success: true };
}

// ── Mechanic invite ──────────────────────────────────────────────────────────

export interface DisplayInviteCandidate {
  userId: string;
  name: string;
  email: string;
  specialization: string;
  yearsExperience: number | null;
}

/**
 * Looks up an independent, verified mechanic by exact email — the basis for
 * "inviting" them to the shop. There's no accept/decline step here (no
 * notification system exists to ask the mechanic first), so this directly
 * adds them; treat the email lookup as the confirmation step instead.
 */
export async function findIndependentMechanicByEmail(email: string): Promise<DisplayInviteCandidate | null> {
  await requireShopOwner();

  const user = await prisma.user.findUnique({
    where: { email },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      mechanicProfile: {
        select: { shopId: true, isVerified: true, specialization: true, yearsExperience: true },
      },
    },
  });

  if (!user || user.role !== "MECHANIC" || !user.mechanicProfile) return null;
  if (user.mechanicProfile.shopId !== null) return null; // already affiliated elsewhere
  if (!user.mechanicProfile.isVerified) return null; // don't surface unverified accounts

  return {
    userId: user.id,
    name: user.name ?? "Unnamed",
    email: user.email,
    specialization: user.mechanicProfile.specialization,
    yearsExperience: user.mechanicProfile.yearsExperience,
  };
}

/** Adds an independent mechanic (found via findIndependentMechanicByEmail) to this shop. */
export async function inviteMechanicToShop(mechanicUserId: string) {
  const { shopId } = await requireShopOwner();

  const profile = await prisma.mechanicProfile.findUnique({ where: { userId: mechanicUserId } });
  if (!profile) throw new Error("Mechanic not found");
  if (profile.shopId !== null) throw new Error("This mechanic already belongs to a shop");

  await prisma.mechanicProfile.update({
    where: { userId: mechanicUserId },
    data: { shopId },
  });

  revalidatePath("/dashboard/shop");
  return { success: true };
}

/** Removes a mechanic from this shop, making them independent again. */
export async function removeMechanicFromShop(mechanicUserId: string) {
  const { shopId } = await requireShopOwner();

  const profile = await prisma.mechanicProfile.findUnique({ where: { userId: mechanicUserId } });
  if (!profile || profile.shopId !== shopId) throw new Error("This mechanic doesn't belong to your shop");

  await prisma.mechanicProfile.update({
    where: { userId: mechanicUserId },
    data: { shopId: null },
  });

  revalidatePath("/dashboard/shop");
  return { success: true };
}