"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { toPlainNumber } from "@/lib/invoice-format";
import { createNotification } from "@/app/actions/notifications";
import crypto from "crypto";

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

/**
 * Shop accepts a PENDING booking request as a business — a distinct step
 * from assigning a specific mechanic. PENDING -> CONFIRMED. The shop can
 * assign (or wait to assign) a mechanic separately afterward via
 * assignMechanicToBooking(); createEstimate() only needs mechanicId to be
 * set by the time an estimate is actually submitted, not at acceptance time,
 * so accept-then-assign-later is a valid sequence.
 */
export async function acceptShopBooking(bookingId: string) {
  const { shopId } = await requireShopOwner();

  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: { vehicle: { select: { brand: true, model: true } } },
  });
  if (!booking || booking.shopId !== shopId) throw new Error("Booking not found for this shop");
  if (booking.status !== "PENDING") throw new Error("Booking already actioned");

  await prisma.booking.update({
    where: { id: bookingId },
    data: { status: "CONFIRMED" },
  });

  await createNotification({
    userId: booking.ownerId,
    type: "BOOKING_ACCEPTED",
    title: "Shop accepted your request",
    body: `Your ${booking.vehicle.brand} ${booking.vehicle.model} booking was accepted. A mechanic will be assigned shortly.`,
    link: "/dashboard/owner",
  });

  revalidatePath("/dashboard/shop");
  revalidatePath("/dashboard/owner");
  return { success: true };
}

/** Shop declines a PENDING booking request. PENDING -> CANCELLED. */
export async function declineShopBooking(bookingId: string) {
  const { shopId } = await requireShopOwner();

  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: { vehicle: { select: { brand: true, model: true } } },
  });
  if (!booking || booking.shopId !== shopId) throw new Error("Booking not found for this shop");
  if (booking.status !== "PENDING") throw new Error("Booking already actioned");

  await prisma.booking.update({
    where: { id: bookingId },
    data: { status: "CANCELLED" },
  });

  await createNotification({
    userId: booking.ownerId,
    type: "BOOKING_DECLINED",
    title: "Booking request declined",
    body: `Your ${booking.vehicle.brand} ${booking.vehicle.model} request wasn't accepted by the shop. Try another mechanic or shop.`,
    link: "/dashboard/owner",
  });

  revalidatePath("/dashboard/shop");
  revalidatePath("/dashboard/owner");
  return { success: true };
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
 * Assigns a mechanic to a booking. Kept in the backend even though the shop
 * dashboard UI no longer calls this (see "no assigning to mechanics" — the
 * shop now handles the whole lifecycle itself). Not deleted in case it's
 * needed again later; just dormant.
 */
export async function assignMechanicToBooking(bookingId: string, mechanicId: string) {
  const { shopId } = await requireShopOwner();

  const booking = await prisma.booking.findUnique({ where: { id: bookingId } });
  if (!booking || booking.shopId !== shopId) throw new Error("Booking not found for this shop");
  if (booking.status === "PENDING") {
    throw new Error("Accept this booking before assigning a mechanic");
  }
  if (booking.status === "DONE" || booking.status === "CANCELLED") {
    throw new Error("Cannot assign a mechanic to a finished or cancelled booking");
  }

  const mechanicProfile = await prisma.mechanicProfile.findUnique({ where: { userId: mechanicId } });
  if (!mechanicProfile || mechanicProfile.shopId !== shopId) {
    throw new Error("That mechanic doesn't belong to your shop");
  }

  await prisma.booking.update({
    where: { id: bookingId },
    data: { mechanicId },
  });

  revalidatePath("/dashboard/shop");
  return { success: true };
}

// ── Mechanic invite / creation ───────────────────────────────────────────────

/**
 * Shop creates a real mechanic account directly — not the independent-
 * mechanic invite flow (findIndependentMechanicByEmail/inviteMechanicToShop
 * below, which is for already-registered independent mechanics). This is
 * for shop staff who've never registered on the platform at all.
 *
 * Verification is inherited from the shop's own verified status, not
 * independently admin-reviewed — an unverified shop creating mechanics
 * gets PENDING mechanics, not an automatic bypass of the trust chain.
 *
 * SECURITY NOTE on signUpEmail: this uses `asResponse: true` and never
 * touches next/headers' cookies() anywhere in this function. Next.js
 * Server Actions only ever set a cookie on the caller's browser if the
 * action explicitly calls cookies().set() — since this never does, there
 * is no way for the newly created mechanic's session to leak into the
 * shop owner's browser, regardless of what Better Auth internally
 * attempts. Confirmed separately: auth.ts has no nextCookies() plugin
 * registered either, so there's no ambient cookie-forwarding happening at
 * the framework level, but that's a secondary safeguard, not the primary
 * one — the primary one is architectural (this function just never calls
 * the one API that could set a cookie).
 */
export async function createShopMechanic(input: {
  name: string;
  email: string;
  specialization: string;
  phone?: string;
}) {
  const { shopId } = await requireShopOwner();

  const shop = await prisma.repairShop.findUnique({
    where: { id: shopId },
    select: { isVerified: true },
  });

  const existing = await prisma.user.findUnique({ where: { email: input.email } });
  if (existing) throw new Error("An account with this email already exists.");

  // Random 12-char temp password — Better Auth's default minimum is 8.
  // Handed back once to the shop owner to relay to their new mechanic;
  // there's no forced-change-on-first-login flow yet, so recommend they
  // ask the mechanic to change it soon after logging in.
  const tempPassword = crypto.randomBytes(9).toString("base64url");

  const signUpResponse = await auth.api.signUpEmail({
    body: { name: input.name, email: input.email, password: tempPassword },
    asResponse: true,
  });

  if (!signUpResponse.ok) {
    const err = await signUpResponse.json().catch(() => null);
    throw new Error(err?.message ?? "Could not create the mechanic's account.");
  }

  const signUpData = await signUpResponse.json();
  const newUserId: string | undefined = signUpData?.user?.id;
  if (!newUserId) {
    // Flagging this explicitly rather than failing silently — if Better
    // Auth's response shape ever changes, this is where it'd surface.
    throw new Error("Account was created but its ID could not be read from the response.");
  }

  await prisma.$transaction([
    prisma.user.update({
      where: { id: newUserId },
      data: { role: "MECHANIC", phone: input.phone },
    }),
    prisma.mechanicProfile.create({
      data: {
        userId: newUserId,
        shopId,
        specialization: input.specialization,
        isVerified: shop?.isVerified ?? false,
        verificationStatus: shop?.isVerified ? "APPROVED" : "PENDING",
        isAvailable: false,
      },
    }),
  ]);

  revalidatePath("/dashboard/shop");
  return { success: true, mechanicId: newUserId, tempPassword };
}

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
  if (user.mechanicProfile.shopId !== null) return null;
  if (!user.mechanicProfile.isVerified) return null;

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