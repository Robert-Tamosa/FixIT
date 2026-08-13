import { auth }               from "@/lib/auth";
import { prisma }             from "@/lib/prisma";
import { headers }            from "next/headers";
import { redirect, notFound } from "next/navigation";
import OwnerTrackingView, { type OwnerTrackingProps } from "./_owner-tracking";

interface Props { params: Promise<{ bookingId: string }> }

export default async function OwnerTrackingPage({ params }: Props) {
  const { bookingId } = await params;

  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/signIn");

  const booking = await prisma.booking.findFirst({
    where: {
      id: bookingId,
      ownerId: session.user.id,
      // ESTIMATE_ACCEPTED, not CONFIRMED, is the real "travel/tracking
      // relevant" state now that the estimate step exists — CONFIRMED just
      // means "accepted the request, hasn't sent a price yet." Shop
      // bookings also skip EN_ROUTE entirely (customer brings the vehicle
      // to the shop, nobody travels to them), going straight
      // ESTIMATE_ACCEPTED -> IN_PROGRESS -> DONE — this filter needs to
      // match that path too, not just the mechanic-travel path.
      status: { in: ["ESTIMATE_ACCEPTED", "EN_ROUTE", "IN_PROGRESS", "DONE"] },
    },
    include: {
      mechanic: { select: { name: true } },
      shop:     { select: { name: true } },
      vehicle:  { select: { brand: true, model: true } },
    },
  });

  if (!booking) notFound();

  const props: OwnerTrackingProps = {
    bookingId:       booking.id,
    // mechanicId is always null for shop bookings now (no assignment step
    // exists) — show the shop's name instead of a mechanic placeholder,
    // since there genuinely isn't a specific person to name.
    mechanicName:    booking.mechanic?.name ?? booking.shop?.name ?? "Mechanic",
    vehicleLabel:    `${booking.vehicle.brand} ${booking.vehicle.model}`,
    status:          booking.status,
    initialOwnerLat: booking.ownerLat ?? null,
    initialOwnerLng: booking.ownerLng ?? null,
  };

  return <OwnerTrackingView {...props} />;
}