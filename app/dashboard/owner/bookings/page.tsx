import { auth }    from "@/lib/auth";
import { prisma }  from "@/lib/prisma";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import CompletedBookingsView, {
  type CompletedBooking,
} from "./_completed-bookings";

function formatPrice(price: unknown): string {
  if (!price) return "TBD";
  return `₱${Number(price).toLocaleString("en-PH")}`;
}

export default async function CompletedBookingsPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/signIn");

  const rawBookings = await prisma.booking.findMany({
    where: {
      ownerId: session.user.id,
      status:  "DONE",
    },
    select: {
      id:                 true,
      problemDescription: true,
      price:              true,
      completedAt:        true,
      mechanic: { select: { id: true, name: true } },
      vehicle:  { select: { brand: true, model: true } },
      rating: {
        select: {
          rating:    true,
          comment:   true,
          sentiment: true,
        },
      },
    },
    orderBy: { completedAt: "desc" },
  });

  function getInitials(name: string | null): string {
    if (!name) return "?";
    return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
  }

  const bookings: CompletedBooking[] = rawBookings.map((b) => ({
    id:               b.id,
    mechanicId:       b.mechanic?.id ?? null,
    mechanicName:     b.mechanic?.name     ?? "Unassigned",
    mechanicInitials: getInitials(b.mechanic?.name ?? null),
    vehicleLabel:     `${b.vehicle.brand} ${b.vehicle.model}`,
    problem:          b.problemDescription,
    price:            formatPrice(b.price),
    completedAt:      b.completedAt
      ? b.completedAt.toLocaleDateString("en-PH", {
          month: "short", day: "numeric", year: "numeric",
        })
      : "—",
    rating:    b.rating?.rating    ?? null,
    comment:   b.rating?.comment   ?? null,
    sentiment: b.rating?.sentiment ?? null,
  }));

  return <CompletedBookingsView bookings={bookings}
  
  />;
}