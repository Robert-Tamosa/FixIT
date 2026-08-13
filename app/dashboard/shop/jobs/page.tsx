import { auth }    from "@/lib/auth";
import { prisma }  from "@/lib/prisma";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import ShopJobsView, { type ShopJobItem, type ShopJobsProps } from "./_shop-jobs";

function formatPrice(price: unknown): string {
  if (!price) return "TBD";
  return `₱${Number(price).toLocaleString("en-PH")}`;
}

function formatDate(date: Date): string {
  return date.toLocaleDateString("en-PH", {
    month: "short", day: "numeric", year: "numeric",
  });
}

function formatScheduled(date: Date | null): string | null {
  if (!date) return null;
  return date.toLocaleDateString("en-PH", {
    month: "short", day: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function getInitials(name: string | null): string {
  if (!name) return "?";
  return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
}

export default async function ShopJobsPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/signIn");

  // layout.tsx already guarantees a shop exists for this owner — fetched
  // again here just for its id, same pattern the mechanic jobs page uses
  // (auth/role checks live in the layout, page.tsx just fetches data).
  const shop = await prisma.repairShop.findUniqueOrThrow({
    where:  { ownerId: session.user.id },
    select: { id: true },
  });

  const rawJobs = await prisma.booking.findMany({
    where:   { shopId: shop.id },
    include: {
      owner:      { select: { name: true } },
      vehicle:    { select: { brand: true, model: true } },
      shopRating: { select: { rating: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  const jobs: ShopJobItem[] = rawJobs.map((b) => ({
    id:            b.id,
    ownerName:     b.owner.name      ?? "Unknown Owner",
    ownerInitials: getInitials(b.owner.name),
    vehicleLabel:  `${b.vehicle.brand} ${b.vehicle.model}`,
    problem:       b.problemDescription,
    status:        b.status as ShopJobItem["status"],
    scheduledAt:   formatScheduled(b.scheduledAt),
    price:         formatPrice(b.price),
    isEmergency:   b.isEmergency,
    createdAt:     formatDate(b.createdAt),
    rating:        b.shopRating?.rating ?? null,
  }));

  const doneJobs    = rawJobs.filter((b) => b.status === "DONE");
  const cancelJobs  = rawJobs.filter((b) => b.status === "CANCELLED");
  const totalEarned = doneJobs.reduce((sum, b) => sum + (b.price ? Number(b.price) : 0), 0);

  const props: ShopJobsProps = {
    jobs,
    totalEarnings: `₱${totalEarned.toLocaleString("en-PH")}`,
    doneCount:     doneJobs.length,
    cancelCount:   cancelJobs.length,
  };

  return <ShopJobsView {...props} />;
}