import { auth }    from "@/lib/auth";
import { prisma }  from "@/lib/prisma";
import { headers }  from "next/headers";
import { redirect } from "next/navigation";
import MechanicProfileView from "./_mechanic-profile";

export default async function MechanicProfilePage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/signIn");

  const mechanicId = session.user.id;

  // ── Run all queries in parallel ────────────────────────────────────────────
  const [
    user,
    totalJobs,
    completedJobs,
    ratingAgg,
    earningsAgg,
    activeBooking,
  ] = await Promise.all([

    // 1. User + mechanic profile
    prisma.user.findUnique({
      where:  { id: mechanicId },
      select: {
        id:        true,
        name:      true,
        email:     true,
        phone:     true,
        image:     true,
        createdAt: true,
        mechanicProfile: {
          select: {
            shopName:           true,
            bio:                true,
            specialization:     true,
            yearsExperience:    true,
            isVerified:         true,
            verificationStatus: true,
          },
        },
      },
    }),

    // 2. Total bookings as mechanic
    prisma.booking.count({
      where: { mechanicId },
    }),

    // 3. Completed bookings
    prisma.booking.count({
      where: { mechanicId, status: "DONE" },
    }),

    // 4. Average rating + total reviews
    prisma.mechanicRating.aggregate({
      where: { mechanicId },
      _avg:   { rating: true },
      _count: { rating: true },
    }),

    // 5. Total earnings from completed bookings
    prisma.booking.aggregate({
      where: { mechanicId, status: "DONE" },
      _sum:  { price: true },
    }),

    // 6. Check if currently on an active job (→ unavailable)
    prisma.booking.findFirst({
      where:  { mechanicId, status: { in: ["CONFIRMED", "EN_ROUTE", "IN_PROGRESS"] } },
      select: { id: true },
    }),

  ]);

  if (!user) redirect("/signIn");

  // ── Format values ──────────────────────────────────────────────────────────

  const avgRating = ratingAgg._avg.rating
    ? Math.round(ratingAgg._avg.rating * 10) / 10
    : 0;

  const totalEarnings = earningsAgg._sum.price
    ? `₱${Number(earningsAgg._sum.price).toLocaleString("en-PH")}`
    : "₱0";

  const memberSince = user.createdAt.toLocaleDateString("en-PH", {
    month: "short",
    year:  "numeric",
  });

  const profile = user.mechanicProfile;

  return (
    <MechanicProfileView
      // ── User ──────────────────────────────────────────────────────────────
      id={user.id}
      name={user.name             ?? "Unknown"}
      email={user.email}
      phone={user.phone           ?? null}
      image={user.image           ?? null}

      // ── Mechanic profile ──────────────────────────────────────────────────
      shopName={profile?.shopName           ?? null}
      bio={profile?.bio                     ?? null}
      specialization={profile?.specialization ?? "General"}
      yearsExperience={profile?.yearsExperience ?? null}
      isVerified={profile?.isVerified       ?? false}
      verificationStatus={
        (profile?.verificationStatus as "PENDING" | "APPROVED" | "REJECTED")
        ?? "PENDING"
      }

      // ── Availability (no active job = available) ───────────────────────────
      isAvailable={!activeBooking}

      // ── Stats ──────────────────────────────────────────────────────────────
      totalJobs={totalJobs}
      completedJobs={completedJobs}
      avgRating={avgRating}
      totalReviews={ratingAgg._count.rating}
      totalEarnings={totalEarnings}
      memberSince={memberSince}
    />
  );
}