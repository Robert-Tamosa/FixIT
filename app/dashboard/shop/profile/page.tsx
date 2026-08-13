import { auth }    from "@/lib/auth";
import { prisma }  from "@/lib/prisma";
import { headers }  from "next/headers";
import { redirect } from "next/navigation";
import ShopProfileView from "./_shop-profile";

export default async function ShopProfilePage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/signIn");

  const shop = await prisma.repairShop.findUnique({
    where:  { ownerId: session.user.id },
    select: {
      id:                 true,
      name:               true,
      email:              true,
      phone:              true,
      logoUrl:            true,
      address:            true,
      description:        true,
      services:           true,
      isVerified:         true,
      verificationStatus: true,
      createdAt:          true,
    },
  });

  // layout.tsx already guards this, but redirect defensively rather than
  // crash if the shop was somehow deleted between the layout check and here.
  if (!shop) redirect("/shop/register");

  const [totalJobs, completedJobs, ratingAgg, earningsAgg] = await Promise.all([
    prisma.booking.count({ where: { shopId: shop.id } }),
    prisma.booking.count({ where: { shopId: shop.id, status: "DONE" } }),
    // ShopRating, not MechanicRating — shop bookings never have a
    // mechanicId, so their ratings live on the separate ShopRating model.
    prisma.shopRating.aggregate({
      where:  { shopId: shop.id },
      _avg:   { rating: true },
      _count: { rating: true },
    }),
    prisma.booking.aggregate({
      where: { shopId: shop.id, status: "DONE" },
      _sum:  { price: true },
    }),
  ]);

  const avgRating = ratingAgg._avg.rating
    ? Math.round(ratingAgg._avg.rating * 10) / 10
    : 0;

  const totalEarnings = earningsAgg._sum.price
    ? `₱${Number(earningsAgg._sum.price).toLocaleString("en-PH")}`
    : "₱0";

  const memberSince = shop.createdAt.toLocaleDateString("en-PH", {
    month: "short",
    year:  "numeric",
  });

  return (
    <ShopProfileView
      id={shop.id}
      name={shop.name}
      email={shop.email       ?? null}
      phone={shop.phone       ?? null}
      logoUrl={shop.logoUrl   ?? null}
      address={shop.address}
      description={shop.description ?? null}
      services={shop.services}
      isVerified={shop.isVerified}
      verificationStatus={
        (shop.verificationStatus as "PENDING" | "APPROVED" | "REJECTED")
      }
      totalJobs={totalJobs}
      completedJobs={completedJobs}
      avgRating={avgRating}
      totalReviews={ratingAgg._count.rating}
      totalEarnings={totalEarnings}
      memberSince={memberSince}
    />
  );
}