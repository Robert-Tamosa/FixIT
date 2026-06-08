import { auth }    from "@/lib/auth";
import { prisma }  from "@/lib/prisma";
import { headers } from "next/headers";
import MechanicDashboardView, {
  type SessionMechanic,
  type IncomingRequest,
  type ActiveJob,
  type UpcomingJob,
  type RecentReview,
  type MechanicStats,
} from "./_mechanic-dashboard";

// ── Helpers ───────────────────────────────────────────────────────────────────

function getInitials(name: string | null): string {
  if (!name) return "?";
  return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
}

function formatPrice(price: unknown): string {
  if (!price) return "TBD";
  return `₱${Number(price).toLocaleString("en-PH")}`;
}

function formatDate(date: Date | null): string | null {
  if (!date) return null;
  return date.toLocaleDateString("en-PH", {
    month:  "short",
    day:    "numeric",
    hour:   "2-digit",
    minute: "2-digit",
  });
}

function minsAgo(date: Date): number {
  return Math.floor((Date.now() - date.getTime()) / 60_000);
}

// ── Page ──────────────────────────────────────────────────────────────────────
// Auth, role, and verificationStatus are already guarded by layout.tsx.
// This page only fetches data.

export default async function MechanicDashboardPage() {
  const session = await auth.api.getSession({ headers: await headers() });

  // Layout guarantees session exists — this is just for TypeScript narrowing
  if (!session) return null;

  // ── 1. Mechanic profile ────────────────────────────────────────────────────
  const rawMechanic = await prisma.user.findUniqueOrThrow({
    where: { id: session.user.id },
    select: {
      id:    true,
      name:  true,
      email: true,
      image: true,
      mechanicProfile: {
        select: {
          specialization: true,
          isVerified:     true,
          isAvailable:    true,
        },
      },
    },
  });

  const mechanic: SessionMechanic = {
    id:          rawMechanic.id,
    name:        rawMechanic.name                              ?? "Mechanic",
    email:       rawMechanic.email,
    image:       rawMechanic.image,
    phone:       (session.user as { phone?: string | null }).phone,
    specialty:   rawMechanic.mechanicProfile?.specialization  ?? "General Mechanic",
    isVerified:  rawMechanic.mechanicProfile?.isVerified      ?? false,
    isAvailable: rawMechanic.mechanicProfile?.isAvailable     ?? false,
  };

  // ── 2. Incoming requests (PENDING bookings assigned to this mechanic) ──────
  const rawIncoming = await prisma.booking.findMany({
    where: {
      mechanicId: session.user.id,
      status:     "PENDING",
    },
    include: {
      owner:   { select: { name: true } },
      vehicle: { select: { brand: true, model: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 10,
  });

  const incomingRequests: IncomingRequest[] = rawIncoming.map((b) => ({
    id:              b.id,
    ownerName:       b.owner.name     ?? "Unknown",
    ownerInitials:   getInitials(b.owner.name),
    vehicleLabel:    `${b.vehicle.brand} ${b.vehicle.model}`,
    problem:         b.problemDescription,
    scheduledAt:     formatDate(b.scheduledAt),
    price:           formatPrice(b.price),
    isEmergency:     b.isEmergency    ?? false,
    receivedMinsAgo: minsAgo(b.createdAt),
  }));

  // ── 3. Active job (CONFIRMED | EN_ROUTE | IN_PROGRESS) ────────────────────
  const rawActive = await prisma.booking.findFirst({
    where: {
      mechanicId: session.user.id,
      status:     { in: ["CONFIRMED", "EN_ROUTE", "IN_PROGRESS"] },
    },
    include: {
      owner:   { select: { name: true } },
      vehicle: { select: { brand: true, model: true } },
    },
    orderBy: { updatedAt: "desc" },
  });

  const activeJob: ActiveJob | null = rawActive
    ? {
        id:            rawActive.id,
        ownerName:     rawActive.owner.name   ?? "Unknown",
        ownerInitials: getInitials(rawActive.owner.name),
        vehicleLabel:  `${rawActive.vehicle.brand} ${rawActive.vehicle.model}`,
        problem:       rawActive.problemDescription,
        status:        rawActive.status as ActiveJob["status"],
        scheduledAt:   formatDate(rawActive.scheduledAt),
        price:         formatPrice(rawActive.price),
        address:       rawActive.address      ?? "Address not provided",
      }
    : null;

  // ── 4. Upcoming confirmed jobs (future, beyond the active one) ─────────────
  const rawUpcoming = await prisma.booking.findMany({
    where: {
      mechanicId:  session.user.id,
      status:      "CONFIRMED",
      scheduledAt: { gt: new Date() },
      ...(rawActive ? { id: { not: rawActive.id } } : {}),
    },
    include: {
      owner:   { select: { name: true } },
      vehicle: { select: { brand: true, model: true } },
    },
    orderBy: { scheduledAt: "asc" },
    take: 5,
  });

  const upcomingJobs: UpcomingJob[] = rawUpcoming.map((b) => ({
    id:            b.id,
    ownerName:     b.owner.name   ?? "Unknown",
    ownerInitials: getInitials(b.owner.name),
    vehicleLabel:  `${b.vehicle.brand} ${b.vehicle.model}`,
    problem:       b.problemDescription,
    scheduledAt:   formatDate(b.scheduledAt) ?? "TBD",
    price:         formatPrice(b.price),
  }));

  // ── 5. Stats ───────────────────────────────────────────────────────────────

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const weekStart = new Date();
  weekStart.setDate(weekStart.getDate() - weekStart.getDay());
  weekStart.setHours(0, 0, 0, 0);

  const [todayJobs, weekBookings, ratingAgg, done, cancelled] = await Promise.all([
    // Today's completed jobs
    prisma.booking.count({
      where: {
        mechanicId: session.user.id,
        status:     "DONE",
        updatedAt:  { gte: todayStart },
      },
    }),
    // This week's completed bookings (for earnings sum)
    prisma.booking.findMany({
      where: {
        mechanicId: session.user.id,
        status:     "DONE",
        updatedAt:  { gte: weekStart },
      },
      select: { price: true },
    }),
    // Rating aggregate
    prisma.mechanicRating.aggregate({
      where:  { mechanicId: session.user.id },
      _avg:   { rating: true },
      _count: { rating: true },
    }),
    // Completion rate numerator
    prisma.booking.count({  
      where: { mechanicId: session.user.id, status: "DONE" },
    }),
    // Completion rate denominator addend
    prisma.booking.count({
      where: { mechanicId: session.user.id, status: "CANCELLED" },
    }),
  ]);

  const weekTotal      = weekBookings.reduce((sum, b) => sum + (b.price ? Number(b.price) : 0), 0);
  const total          = done + cancelled;
  const completionRate = total > 0 ? Math.round((done / total) * 100) : 100;
  const avgRating      = Math.round((ratingAgg._avg.rating ?? 0) * 10) / 10;

  const stats: MechanicStats = {
    todayJobs,
    weekEarnings:  `₱${weekTotal.toLocaleString("en-PH")}`,
    avgRating,
    completionRate,
    totalReviews:  ratingAgg._count.rating,
  };

  // ── 6. Recent reviews ──────────────────────────────────────────────────────
  const rawReviews = await prisma.mechanicRating.findMany({
    where:   { mechanicId: session.user.id },
    include: { owner: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
    take: 3,
  });

  const recentReviews: RecentReview[] = rawReviews.map((r) => ({
    ownerName:     r.owner.name ?? "Anonymous",
    ownerInitials: getInitials(r.owner.name),
    rating:        r.rating,
    comment:       r.comment    ?? null,
    date:          r.createdAt.toLocaleDateString("en-PH", {
      month: "short",
      day:   "numeric",
    }),
  }));

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <MechanicDashboardView
      mechanic={mechanic}
      stats={stats}
      incomingRequests={incomingRequests}
      activeJob={activeJob}
      upcomingJobs={upcomingJobs}
      recentReviews={recentReviews}
    />
  );
}