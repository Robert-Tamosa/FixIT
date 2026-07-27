import { redirect } from "next/navigation";
import { auth }    from "@/lib/auth";
import { prisma }  from "@/lib/prisma";
import { headers }  from "next/headers";
import OwnerDashboardView, {
  type SessionUser,
  type DisplayBooking,
  type DisplayMechanic,
  type DisplayEstimateReview,
} from "./_dashboard";
import { toPlainNumber } from "@/lib/invoice-format";

function getInitials(name: string | null): string {
  if (!name) return "?";
  return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
}

export default async function OwnerDashboardPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/signIn");

  // ── 1. Active booking ──────────────────────────────────────────────────────
  const rawBooking = await prisma.booking.findFirst({
    where: {
      ownerId: session.user.id,
      status: { in: ["ESTIMATE_ACCEPTED", "EN_ROUTE", "IN_PROGRESS"] },
    },
    include: {
      mechanic: { select: { id: true, name: true } },
      vehicle:  { select: { brand: true, model: true, plateNumber: true } },
      rating:   { select: { rating: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  // ── 1b. Pending booking (awaiting mechanic acceptance OR awaiting an estimate)
  const pendingBooking = await prisma.booking.findFirst({
    where: {
      ownerId: session.user.id,
      status:  { in: ["PENDING", "CONFIRMED"] },
    },
    include: {
      mechanic: { select: { id: true, name: true } },
      vehicle:  { select: { brand: true, model: true, plateNumber: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  // ── 1c. Estimate review (ESTIMATE_SENT)
  const rawEstimateReview = await prisma.booking.findFirst({
    where: {
      ownerId: session.user.id,
      status:  "ESTIMATE_SENT",
    },
    include: {
      mechanic: { select: { id: true, name: true } },
      vehicle:  { select: { brand: true, model: true } },
      estimate: { select: { laborCost: true, partsCost: true, totalCost: true, notes: true } },
    },
    orderBy: { updatedAt: "desc" },
  });

  const estimateReview: DisplayEstimateReview | null = rawEstimateReview
    ? {
        id:               rawEstimateReview.id,
        mechanicName:     rawEstimateReview.mechanic?.name ?? "Unknown Mechanic",
        mechanicInitials: getInitials(rawEstimateReview.mechanic?.name ?? null),
        vehicleLabel:     `${rawEstimateReview.vehicle.brand} ${rawEstimateReview.vehicle.model}`,
        service:          rawEstimateReview.problemDescription,
        laborCost:        rawEstimateReview.estimate ? toPlainNumber(rawEstimateReview.estimate.laborCost) : 0,
        partsCost:        rawEstimateReview.estimate ? toPlainNumber(rawEstimateReview.estimate.partsCost) : 0,
        totalCost:        rawEstimateReview.estimate ? toPlainNumber(rawEstimateReview.estimate.totalCost) : 0,
        notes:            rawEstimateReview.estimate?.notes ?? null,
      }
    : null;

  // ── 2. Mechanics list ──────────────────────────────────────────────────────
  const rawMechanics = await prisma.user.findMany({
    where: { role: "MECHANIC" },
    select: {
      id:   true,
      name: true,
      mechanicProfile: {
        select: { specialization: true, isVerified: true },
      },
      _count: { select: { ratingsReceived: true } },
    },
    take: 6,
  });

  // ── 3. Average ratings per mechanic ───────────────────────────────────────
  const mechanicIds = rawMechanics.map((m) => m.id);

  const avgRatings = await prisma.mechanicRating.groupBy({
    by: ["mechanicId"],
    where: { mechanicId: { in: mechanicIds } },
    _avg: { rating: true },
  });
  const ratingMap = new Map(avgRatings.map((r) => [r.mechanicId, r._avg.rating ?? 0]));

  // ── 4. Which mechanics are currently busy ──────────────────────────────────
  const busyIds = await prisma.booking
    .findMany({
      where: {
        mechanicId: { in: mechanicIds },
        status: { in: ["ESTIMATE_ACCEPTED", "EN_ROUTE", "IN_PROGRESS"] },
      },
      select: { mechanicId: true },
    })
    .then((rows) => new Set(rows.map((r) => r.mechanicId)));

  // ── Transform → display types ──────────────────────────────────────────────

  const activeBooking: DisplayBooking | null = rawBooking
    ? {
        id:               rawBooking.id,
        mechanicName:     rawBooking.mechanic?.name ?? "Unknown Mechanic",
        mechanicInitials: getInitials(rawBooking.mechanic?.name ?? null),
        mechanicRating:   Math.round((ratingMap.get(rawBooking.mechanicId ?? "") ?? 0) * 10) / 10,
        service:          rawBooking.problemDescription,
        status:           rawBooking.status as DisplayBooking["status"],
        scheduledAt:      rawBooking.scheduledAt
          ? rawBooking.scheduledAt.toLocaleDateString("en-PH", {
              month: "short", day: "numeric",
              hour: "2-digit", minute: "2-digit",
            })
          : null,
        price:            rawBooking.price
          ? `₱${Number(rawBooking.price).toLocaleString()}`
          : "TBD",
        vehicleLabel:     `${rawBooking.vehicle.brand} ${rawBooking.vehicle.model}`,
      }
    : null;

  const mechanics: DisplayMechanic[] = rawMechanics.map((m) => ({
    id:        m.id,
    name:      m.name ?? "Unknown",
    initials:  getInitials(m.name),
    specialty: m.mechanicProfile?.specialization ?? "General Mechanic",
    rating:    Math.round((ratingMap.get(m.id) ?? 0) * 10) / 10,
    reviews:   m._count.ratingsReceived,
    available: !busyIds.has(m.id),
  }));

  const pendingDisplay: DisplayBooking | null = pendingBooking
    ? {
        id:               pendingBooking.id,
        mechanicName:     pendingBooking.mechanic?.name ?? "Unknown Mechanic",
        mechanicInitials: getInitials(pendingBooking.mechanic?.name ?? null),
        mechanicRating:   Math.round((ratingMap.get(pendingBooking.mechanicId ?? "") ?? 0) * 10) / 10,
        service:          pendingBooking.problemDescription,
        status:           pendingBooking.status as DisplayBooking["status"],
        scheduledAt:      pendingBooking.scheduledAt
          ? pendingBooking.scheduledAt.toLocaleDateString("en-PH", {
              month: "short", day: "numeric",
              hour: "2-digit", minute: "2-digit",
            })
          : null,
        price:            pendingBooking.price
          ? `₱${Number(pendingBooking.price).toLocaleString()}`
          : "TBD",
        vehicleLabel:     `${pendingBooking.vehicle.brand} ${pendingBooking.vehicle.model}`,
      }
    : null;

  const user: SessionUser = {
    id:    session.user.id,
    name:  session.user.name  ?? "User",
    email: session.user.email,
    image: session.user.image,
    phone: (session.user as { phone?: string | null }).phone,
  };

  return (
    <OwnerDashboardView
      user={user}
      activeBooking={activeBooking}
      pendingBooking={pendingDisplay}
      estimateReview={estimateReview}
      mechanics={mechanics}
    />
  );
}