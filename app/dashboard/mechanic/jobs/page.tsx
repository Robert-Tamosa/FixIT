import { auth }    from "@/lib/auth";
import { prisma }  from "@/lib/prisma";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import MechanicJobsView, { type JobItem, type MechanicJobsProps } from "./_mechanic-jobs";

function getInitials(name: string | null): string {
  if (!name) return "?";
  return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
}

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

export default async function MechanicJobsPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/signIn");

  const rawJobs = await prisma.booking.findMany({
    where:   { mechanicId: session.user.id },
    include: {
      owner:   { select: { name: true } },
      vehicle: { select: { brand: true, model: true } },
      rating:  { select: { rating: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  const jobs: JobItem[] = rawJobs.map((b) => ({
    id:            b.id,
    ownerName:     b.owner.name      ?? "Unknown Owner",
    ownerInitials: getInitials(b.owner.name),
    vehicleLabel:  `${b.vehicle.brand} ${b.vehicle.model}`,
    problem:       b.problemDescription,
    status:        b.status as JobItem["status"],
    scheduledAt:   formatScheduled(b.scheduledAt),
    price:         formatPrice(b.price),
    isEmergency:   b.isEmergency,
    createdAt:     formatDate(b.createdAt),
    rating:        b.rating?.rating ?? null,
  }));

  // Earnings from DONE bookings
  const doneJobs     = rawJobs.filter((b) => b.status === "DONE");
  const cancelJobs   = rawJobs.filter((b) => b.status === "CANCELLED");
  const totalEarned  = doneJobs.reduce((sum, b) => sum + (b.price ? Number(b.price) : 0), 0);

  const props: MechanicJobsProps = {
    jobs,
    totalEarnings: `₱${totalEarned.toLocaleString("en-PH")}`,
    doneCount:     doneJobs.length,
    cancelCount:   cancelJobs.length,
  };

  return <MechanicJobsView {...props} />;
}