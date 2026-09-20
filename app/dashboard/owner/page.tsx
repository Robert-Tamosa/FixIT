import { redirect } from "next/navigation";
import { auth }    from "@/lib/auth";
import { prisma }  from "@/lib/prisma";
import { headers }  from "next/headers";
import OwnerDashboardView, {
  type SessionUser,
  type DisplayBooking,
  type DisplayMechanic,
  type DisplayShop,
  type DisplayEstimateReview,
} from "./_dashboard";
import { toPlainNumber } from "@/lib/invoice-format";

function getInitials(name: string | null): string {
  if (!name) return "?";
  return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
}

// Shared shape/select for turning a raw booking + relations into a
// DisplayBooking — used by the active/pending queries below AND the new
// done-unpaid one, so all three stay in sync if a field changes.
//
// mechanicPhone + isEmergency added for the "show phone number during an
// active emergency booking" feature — number is only ever rendered by the
// card when isEmergency is true, but it's threaded through unconditionally
// here so all three call sites (active/pending/done-unpaid) stay in sync.
function toDisplayBooking(
  b: {
    id: string;
    mechanicId: string | null;
    problemDescription: string;
    status: string;
    scheduledAt: Date | null;
    price: unknown;
    isEmergency: boolean | null;
    mechanic: { name: string | null; phone: string | null } | null;
    shop: { name: string } | null;
    vehicle: { brand: string; model: string };
  },
  ratingMap: Map<string, number>,
): DisplayBooking {
  return {
    id:               b.id,
    mechanicName:     b.mechanic?.name ?? "Unknown Mechanic",
    mechanicInitials: getInitials(b.mechanic?.name ?? null),
    mechanicPhone:    b.mechanic?.phone ?? null,
    mechanicRating:   Math.round((ratingMap.get(b.mechanicId ?? "") ?? 0) * 10) / 10,
    ShopName:         b.shop?.name ?? "",
    service:          b.problemDescription,
    status:           b.status as DisplayBooking["status"],
    isEmergency:      b.isEmergency ?? false,
    scheduledAt:      b.scheduledAt
      ? b.scheduledAt.toLocaleDateString("en-PH", {
          month: "short", day: "numeric",
          hour: "2-digit", minute: "2-digit",
        })
      : null,
    price:            b.price ? `₱${Number(b.price).toLocaleString()}` : "TBD",
    vehicleLabel:     `${b.vehicle.brand} ${b.vehicle.model}`,
  };
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
      mechanic: { select: { id: true, name: true, phone: true } },
      shop:     { select: { name: true } },
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
      mechanic: { select: { id: true, name: true, phone: true } },
      shop:     { select: { name: true } },
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

  // ── 1d. Done, but not yet paid — kept separate from the priority slot
  //        above (active/pending/estimateReview stay a single "current
  //        booking" ternary, unchanged) since an owner could plausibly have
  //        several vehicles each in a different done-unpaid state at once,
  //        not just one. findMany, not findFirst — deliberately.
  const rawDoneUnpaid = await prisma.booking.findMany({
    where: {
      ownerId: session.user.id,
      status:  "DONE",
      OR: [
        { payment: null },
        { payment: { status: { not: "PAID" } } },
      ],
    },
    include: {
      mechanic: { select: { id: true, name: true, phone: true } },
      shop:     { select: { name: true } },
      vehicle:  { select: { brand: true, model: true, plateNumber: true } },
    },
    orderBy: { updatedAt: "desc" },
  });

const CANDIDATE_POOL_LIMIT = 20; // pool fetched server-side; final closest-6 pick happens client-side (live GPS only exists in the browser)

const rawMechanics = await prisma.user.findMany({
  where: {
    role: "MECHANIC",
    mechanicProfile: {
      isAvailable: true,
      latitude:  { not: null },
      longitude: { not: null },
    },
  },
  select: {
    id:   true,
    name: true,
    mechanicProfile: {
      select: {
        specialization: true, isVerified: true, isAvailable: true,
        latitude: true, longitude: true,
      },
    },
    _count: { select: { ratingsReceived: true } },
  },
  take: CANDIDATE_POOL_LIMIT,
});

// ── 2b. Shops
const rawShops = await prisma.repairShop.findMany({
  where: {
    isVerified: true,
    latitude:  { not: null },
    longitude: { not: null },
  },
  select: {
    id: true, name: true, services: true, latitude: true, longitude: true,
  },
  take: CANDIDATE_POOL_LIMIT,
});

// ── 3. Average ratings per mechanic ───────────────────────────────────────
const mechanicIds = rawMechanics.map((m) => m.id);

const avgRatings = await prisma.mechanicRating.groupBy({
  by: ["mechanicId"],
  where: { mechanicId: { in: mechanicIds } },
  _avg: { rating: true },
});
const ratingMap = new Map(avgRatings.map((r) => [r.mechanicId, r._avg.rating ?? 0]));

// ── 3b. Average ratings per shop
const shopIds = rawShops.map((s) => s.id);
const shopRatingAgg = await prisma.shopRating.groupBy({
  by: ["shopId"],
  where: { shopId: { in: shopIds } },
  _avg: { rating: true },
  _count: { rating: true },
});
const shopRatingMap = new Map(
  shopRatingAgg.map((r) => [r.shopId, { avg: r._avg.rating ?? 0, count: r._count.rating }]),
);

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

// ── 4b. Owner's home location — fallback reference point for distance
const ownerHome = await prisma.user.findUnique({
  where:  { id: session.user.id },
  select: { homeLat: true, homeLng: true },
});

  // ── Transform → display types ──────────────────────────────────────────────

  const activeBooking: DisplayBooking | null = rawBooking
    ? toDisplayBooking(rawBooking, ratingMap)
    : null;

const mechanics: DisplayMechanic[] = rawMechanics
  .filter((m) => !busyIds.has(m.id)) // isAvailable=true already guaranteed by the query above; this catches "on but currently busy"
  .map((m) => ({
    id:        m.id,
    name:      m.name ?? "Unknown",
    initials:  getInitials(m.name),
    specialty: m.mechanicProfile?.specialization ?? "General Mechanic",
    rating:    Math.round((ratingMap.get(m.id) ?? 0) * 10) / 10,
    reviews:   m._count.ratingsReceived,
    available: true,
    lat:       m.mechanicProfile!.latitude!,
    lng:       m.mechanicProfile!.longitude!,
  }));

const shops: DisplayShop[] = rawShops.map((s) => ({
  id:       s.id,
  name:     s.name,
  initials: getInitials(s.name),
  services: s.services,
  rating:   Math.round((shopRatingMap.get(s.id)?.avg ?? 0) * 10) / 10,
  reviews:  shopRatingMap.get(s.id)?.count ?? 0,
  lat:      s.latitude!,
  lng:      s.longitude!,
}));

  const pendingDisplay: DisplayBooking | null = pendingBooking
    ? toDisplayBooking(pendingBooking, ratingMap)
    : null;

  const doneUnpaidBookings: DisplayBooking[] = rawDoneUnpaid.map((b) => toDisplayBooking(b, ratingMap));

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
      doneUnpaidBookings={doneUnpaidBookings}
      mechanics={mechanics}
      shops={shops}
      homeLat={ownerHome?.homeLat ?? null}
      homeLng={ownerHome?.homeLng ?? null}
    />
  );
}