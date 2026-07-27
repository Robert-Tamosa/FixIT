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
      // Tracking only makes sense once the job is actually moving — same
      // status set the mechanic-side page allows, so both sides agree on
      // when this view is valid.
      status: { in: ["CONFIRMED", "EN_ROUTE", "IN_PROGRESS", "DONE"] },
    },
    include: {
      mechanic: { select: { name: true } },
      vehicle:  { select: { brand: true, model: true } },
    },
  });

  if (!booking) notFound();

  const props: OwnerTrackingProps = {
    bookingId:       booking.id,
    // mechanicId can be null for shop-assigned bookings the shop hasn't
    // picked a specific mechanic for yet — don't crash, show a placeholder.
    mechanicName:    booking.mechanic?.name ?? "Mechanic (not yet assigned)",
    vehicleLabel:    `${booking.vehicle.brand} ${booking.vehicle.model}`,
    status:          booking.status,
    initialOwnerLat: booking.ownerLat ?? null,
    initialOwnerLng: booking.ownerLng ?? null,
  };

  return <OwnerTrackingView {...props} />;
}