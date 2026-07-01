import { auth }    from "@/lib/auth";
import { prisma }  from "@/lib/prisma";
import { headers } from "next/headers";
import { redirect, notFound } from "next/navigation";
import MechanicTrackingView, { type MechanicTrackingProps } from "./_mechanic-tracking";

interface Props { params: { bookingId: string } }

export default async function MechanicTrackingPage({ params }: Props) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/signIn");

  const booking = await prisma.booking.findFirst({
    where: {
      id:         params.bookingId,
      mechanicId: session.user.id,
      status:     { in: ["CONFIRMED", "EN_ROUTE", "IN_PROGRESS", "DONE"] },
    },
    select: {
      id:       true,
      status:   true,
      ownerLat: true,
      ownerLng: true,
      address:  true,
      owner:   { select: { name: true } },
      vehicle: { select: { brand: true, model: true } },
    },
  });

  if (!booking) notFound();

  const props: MechanicTrackingProps = {
    bookingId:    booking.id,
    ownerName:    booking.owner.name             ?? "Owner",
    vehicleLabel: `${booking.vehicle.brand} ${booking.vehicle.model}`,
    status:       booking.status,
    ownerLat:     booking.ownerLat               ?? null,
    ownerLng:     booking.ownerLng               ?? null,
    ownerAddress: booking.address                ?? null,
  };

  return <MechanicTrackingView {...props} />;
}