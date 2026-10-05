"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { toPlainNumber } from "@/lib/invoice-format";
import { createNotification } from "@/app/actions/notifications";

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

  const [
    totalBookings,
    activeJobs,
    availableRealMechanics,
    availableMockMechanics,
    pendingRequests,
    todaysDone,
    rawRecent,
  ] = await Promise.all([
    prisma.booking.count({ where: { shopId } }),
    prisma.booking.count({ where: { shopId, status: { in: ["EN_ROUTE", "IN_PROGRESS"] } } }),
    prisma.mechanicProfile.count({ where: { shopId, isAvailable: true } }),
    // Mock roster entries count toward "available mechanics" too now that
    // they're a real part of the shop's roster — not just real accounts.
    prisma.mockMechanic.count({ where: { shopId, isAvailable: true } }),
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
    // Falls back to mechanic.name (real accounts) since that's what this
    // query already joins; assignedMechanicName (mock-aware) is used in
    // getShopBookings below instead, where it matters more.
    mechanicName: b.mechanic?.name ?? null,
    createdAt: b.createdAt.toLocaleDateString("en-PH", { month: "short", day: "numeric" }),
  }));

  return {
    stats: {
      totalBookings,
      activeJobs,
      availableMechanics: availableRealMechanics + availableMockMechanics,
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
  assignedMechanicName: string | null;
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
    assignedMechanicName: b.assignedMechanicName,
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

// ── Assignment (display-only, combined real + mock roster) ──────────────────
//
// Scope decision (confirmed): assigning ANY mechanic — real or mock — to a
// booking through this picker is PURELY COSMETIC. It writes a name snapshot
// to Booking.assignedMechanicName and nothing else. It does NOT set
// Booking.mechanicId, does NOT trigger notifications, chat, or tracking —
// even for real mechanics with real accounts. That mechanicId-based system
// stays exactly as dormant as it was before (deliberately turned off — "the
// shop now handles the whole lifecycle itself"). Real and mock mechanics are
// intentionally indistinguishable in behavior here; the only difference is
// where their name comes from.
//
// Combined ids are prefixed ("real:<userId>" / "mock:<mockMechanicId>") so
// the picker can carry one string value without a separate type field, and
// assignMechanicToBooking() below parses that prefix to know which table to
// read the name from.

export interface DisplayAssignableMechanic {
  id: string; // "real:<userId>" or "mock:<mockMechanicId>"
  name: string;
  specialization: string;
  isAvailable: boolean;
  isMock: boolean;
}

/** Combined roster (real + mock) for the assignment picker. */
export async function getAssignableMechanics(): Promise<DisplayAssignableMechanic[]> {
  const { shopId } = await requireShopOwner();

  const [realMechanics, mockMechanics] = await Promise.all([
    prisma.mechanicProfile.findMany({
      where: { shopId },
      include: { user: { select: { id: true, name: true } } },
    }),
    prisma.mockMechanic.findMany({ where: { shopId } }),
  ]);

  const real: DisplayAssignableMechanic[] = realMechanics.map((m) => ({
    id: `real:${m.userId}`,
    name: m.user.name ?? "Unnamed",
    specialization: m.specialization,
    isAvailable: m.isAvailable,
    isMock: false,
  }));

  const mock: DisplayAssignableMechanic[] = mockMechanics.map((m) => ({
    id: `mock:${m.id}`,
    name: m.name,
    specialization: m.specialization,
    isAvailable: m.isAvailable,
    isMock: true,
  }));

  return [...real, ...mock];
}

/**
 * Assigns a mechanic (real or mock) to a booking — display-only, see the
 * scope note above the interface. combinedId is whatever
 * getAssignableMechanics() returned as that mechanic's `id`
 * ("real:<userId>" or "mock:<mockMechanicId>").
 */
export async function assignMechanicToBooking(bookingId: string, combinedId: string) {
  const { shopId } = await requireShopOwner();

  const booking = await prisma.booking.findUnique({ where: { id: bookingId } });
  if (!booking || booking.shopId !== shopId) throw new Error("Booking not found for this shop");
  if (booking.status === "PENDING") {
    throw new Error("Accept this booking before assigning a mechanic");
  }
  if (booking.status === "DONE" || booking.status === "CANCELLED") {
    throw new Error("Cannot assign a mechanic to a finished or cancelled booking");
  }

  const [prefix, refId] = combinedId.split(":");
  let name: string;

  if (prefix === "real") {
    const profile = await prisma.mechanicProfile.findUnique({
      where: { userId: refId },
      include: { user: { select: { name: true } } },
    });
    if (!profile || profile.shopId !== shopId) {
      throw new Error("That mechanic doesn't belong to your shop");
    }
    name = profile.user.name ?? "Unnamed";
  } else if (prefix === "mock") {
    const mock = await prisma.mockMechanic.findUnique({ where: { id: refId } });
    if (!mock || mock.shopId !== shopId) {
      throw new Error("That mechanic doesn't belong to your shop");
    }
    name = mock.name;
  } else {
    throw new Error("Invalid mechanic reference");
  }

  await prisma.booking.update({
    where: { id: bookingId },
    data: { assignedMechanicName: name },
  });

  revalidatePath("/dashboard/shop");
  return { success: true };
}

// ── Mock mechanic roster (create / list / remove) ────────────────────────────
// Roster-only entries — NOT real accounts. No User row, no MechanicProfile
// row, no login, no email, no password. Just a name/specialization/phone the
// shop owner can reference and assign to bookings for display. Replaces the
// old createShopMechanic, which used to call auth.api.signUpEmail() and
// create a full real account for every shop staff member added.

export interface DisplayMockMechanic {
  id: string;
  name: string;
  specialization: string;
  phone: string | null;
  isAvailable: boolean;
}

export async function getShopMockMechanics(): Promise<DisplayMockMechanic[]> {
  const { shopId } = await requireShopOwner();

  const mechanics = await prisma.mockMechanic.findMany({
    where: { shopId },
    orderBy: { createdAt: "desc" },
  });

  return mechanics.map((m) => ({
    id: m.id,
    name: m.name,
    specialization: m.specialization,
    phone: m.phone,
    isAvailable: m.isAvailable,
  }));
}

export async function createShopMechanic(input: {
  name: string;
  specialization: string;
  phone?: string;
}) {
  const { shopId } = await requireShopOwner();

  if (!input.name.trim()) throw new Error("Name is required.");
  if (!input.specialization.trim()) throw new Error("Specialization is required.");

  const mechanic = await prisma.mockMechanic.create({
    data: {
      shopId,
      name: input.name.trim(),
      specialization: input.specialization.trim(),
      phone: input.phone?.trim() || null,
    },
  });

  revalidatePath("/dashboard/shop");
  revalidatePath("/dashboard/shop/mechanics");
  return { success: true, mechanicId: mechanic.id };
}

export async function setMockMechanicAvailability(mockMechanicId: string, isAvailable: boolean) {
  const { shopId } = await requireShopOwner();

  const mechanic = await prisma.mockMechanic.findUnique({ where: { id: mockMechanicId } });
  if (!mechanic || mechanic.shopId !== shopId) throw new Error("Mechanic not found for this shop");

  await prisma.mockMechanic.update({
    where: { id: mockMechanicId },
    data: { isAvailable },
  });

  revalidatePath("/dashboard/shop");
  revalidatePath("/dashboard/shop/mechanics");
  return { success: true };
}

export async function removeMockMechanic(mockMechanicId: string) {
  const { shopId } = await requireShopOwner();

  const mechanic = await prisma.mockMechanic.findUnique({ where: { id: mockMechanicId } });
  if (!mechanic || mechanic.shopId !== shopId) throw new Error("Mechanic not found for this shop");

  // Bookings that already captured this mechanic's name via
  // assignedMechanicName are untouched — that's the point of it being a
  // snapshot rather than a live relation (see the schema comment). Only the
  // roster entry itself is removed.
  await prisma.mockMechanic.delete({ where: { id: mockMechanicId } });

  revalidatePath("/dashboard/shop");
  revalidatePath("/dashboard/shop/mechanics");
  return { success: true };
}

// ── Independent mechanic invite (real accounts, now with real consent) ──────
// Separate feature from the mock roster above — for mechanics who already
// have their own real, independent accounts and are joining a shop, not
// shop staff who've never registered.
//
// Previously inviteMechanicToShop added the mechanic immediately, with the
// code comment admitting "no notification system exists to ask the
// mechanic first." That's fixed now: this creates a real PENDING
// ShopInvitation and notifies the mechanic, who accepts or declines via a
// modal triggered from that specific notification (see NotificationBell.tsx
// and ShopInvitationModal.tsx). mechanicProfile.shopId is only set once
// they actually accept.

export interface DisplayInviteCandidate {
  userId: string;
  name: string;
  email: string;
  specialization: string;
  yearsExperience: number | null;
}

/**
 * Looks up an independent, verified mechanic by exact email — the basis for
 * inviting them to the shop.
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

/**
 * Sends a shop invitation — creates a PENDING ShopInvitation and notifies
 * the mechanic. Does NOT touch mechanicProfile.shopId; that only happens if
 * they accept via respondToShopInvitation().
 */
export async function inviteMechanicToShop(mechanicUserId: string) {
  const { shopId } = await requireShopOwner();

  const profile = await prisma.mechanicProfile.findUnique({ where: { userId: mechanicUserId } });
  if (!profile) throw new Error("Mechanic not found");
  if (profile.shopId !== null) throw new Error("This mechanic already belongs to a shop");

  const existingPending = await prisma.shopInvitation.findFirst({
    where: { shopId, mechanicId: mechanicUserId, status: "PENDING" },
  });
  if (existingPending) throw new Error("You've already invited this mechanic — waiting on their response");

  const [shop, invitation] = await Promise.all([
    prisma.repairShop.findUnique({ where: { id: shopId }, select: { name: true } }),
    prisma.shopInvitation.create({
      data: { shopId, mechanicId: mechanicUserId },
    }),
  ]);

  await createNotification({
    userId: mechanicUserId,
    type: "SHOP_INVITATION",
    title: "Shop invitation",
    body: `${shop?.name ?? "A shop"} invited you to join as a mechanic.`,
    // Looks like a route, but NotificationBell.tsx intercepts this specific
    // type before ever navigating — it opens a modal instead, using the
    // invitation id parsed from the end of this string. See that file's
    // handleNotificationClick.
    link: `/dashboard/mechanic/shop-invitations/${invitation.id}`,
  });

  revalidatePath("/dashboard/shop");
  revalidatePath("/dashboard/shop/mechanics");
  return { success: true, invitationId: invitation.id };
}

export interface DisplayShopInvitation {
  id: string;
  mechanicName: string;
  mechanicEmail: string;
  status: "PENDING" | "ACCEPTED" | "DECLINED";
  createdAt: string;
}

/** Invitations this shop has sent, for the roster page's "Pending Invitations" list. */
export async function getPendingShopInvitations(): Promise<DisplayShopInvitation[]> {
  const { shopId } = await requireShopOwner();

  const invitations = await prisma.shopInvitation.findMany({
    where: { shopId, status: "PENDING" },
    include: { mechanic: { select: { name: true, email: true } } },
    orderBy: { createdAt: "desc" },
  });

  return invitations.map((i) => ({
    id: i.id,
    mechanicName: i.mechanic.name ?? "Unnamed",
    mechanicEmail: i.mechanic.email,
    status: i.status,
    createdAt: i.createdAt.toLocaleDateString("en-PH", { month: "short", day: "numeric" }),
  }));
}

/** Real mechanics who have actually joined this shop (accepted, not just invited). */
export async function getShopRealMechanics(): Promise<
  { userId: string; name: string; specialization: string; isAvailable: boolean }[]
> {
  const { shopId } = await requireShopOwner();

  const mechanics = await prisma.mechanicProfile.findMany({
    where: { shopId },
    include: { user: { select: { name: true } } },
  });

  return mechanics.map((m) => ({
    userId: m.userId,
    name: m.user.name ?? "Unnamed",
    specialization: m.specialization,
    isAvailable: m.isAvailable,
  }));
}

// ── Mechanic-side: responding to a shop invitation ───────────────────────────
// Called from ShopInvitationModal.tsx, triggered by clicking a
// SHOP_INVITATION notification. Scoped to the CURRENT mechanic (not
// requireShopOwner — the mechanic, not the shop, is the actor here).

export interface DisplayShopInvitationDetail {
  id: string;
  shopName: string;
  shopAddress: string;
  status: "PENDING" | "ACCEPTED" | "DECLINED";
}

/** Fetches one invitation's detail for the modal — must belong to the current mechanic. */
export async function getShopInvitationDetail(invitationId: string): Promise<DisplayShopInvitationDetail> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) throw new Error("Unauthorized");

  const invitation = await prisma.shopInvitation.findUnique({
    where: { id: invitationId },
    include: { shop: { select: { name: true, address: true } } },
  });
  if (!invitation || invitation.mechanicId !== session.user.id) {
    throw new Error("Invitation not found");
  }

  return {
    id: invitation.id,
    shopName: invitation.shop.name,
    shopAddress: invitation.shop.address,
    status: invitation.status,
  };
}

/**
 * Mechanic accepts or declines. Accept sets mechanicProfile.shopId (the
 * actual join — this is the only place that happens now) and requires the
 * mechanic not already belong to another shop. Either way, notifies the
 * shop owner of the outcome.
 */
export async function respondToShopInvitation(invitationId: string, accept: boolean) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) throw new Error("Unauthorized");

  const invitation = await prisma.shopInvitation.findUnique({
    where: { id: invitationId },
    include: {
      shop: { select: { name: true, ownerId: true } },
    },
  });
  if (!invitation || invitation.mechanicId !== session.user.id) {
    throw new Error("Invitation not found");
  }
  if (invitation.status !== "PENDING") {
    throw new Error("This invitation has already been responded to");
  }

  if (accept) {
    const profile = await prisma.mechanicProfile.findUnique({ where: { userId: session.user.id } });
    if (profile?.shopId) {
      throw new Error("You already belong to a shop — leave it before accepting a new invitation");
    }

    await prisma.$transaction([
      prisma.mechanicProfile.update({
        where: { userId: session.user.id },
        data: { shopId: invitation.shopId },
      }),
      prisma.shopInvitation.update({
        where: { id: invitationId },
        data: { status: "ACCEPTED", respondedAt: new Date() },
      }),
    ]);
  } else {
    await prisma.shopInvitation.update({
      where: { id: invitationId },
      data: { status: "DECLINED", respondedAt: new Date() },
    });
  }

  const mechanicUser = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { name: true },
  });

  await createNotification({
    userId: invitation.shop.ownerId,
    type: accept ? "SHOP_INVITATION_ACCEPTED" : "SHOP_INVITATION_DECLINED",
    title: accept ? "Invitation accepted" : "Invitation declined",
    body: `${mechanicUser?.name ?? "The mechanic"} ${accept ? "joined your shop." : "declined your invitation."}`,
    link: "/dashboard/shop/mechanics",
  });

  revalidatePath("/dashboard/mechanic");
  revalidatePath("/dashboard/shop");
  revalidatePath("/dashboard/shop/mechanics");
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
  revalidatePath("/dashboard/shop/mechanics");
  return { success: true };
}