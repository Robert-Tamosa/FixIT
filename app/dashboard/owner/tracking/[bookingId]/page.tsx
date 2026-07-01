import { auth }               from "@/lib/auth";
import { prisma }             from "@/lib/prisma";
import { headers }            from "next/headers";
import { redirect, notFound } from "next/navigation";
import OwnerTrackingView, { type OwnerTrackingProps } from "./_owner-tracking";

interface Props { params: Promise<{ bookingId: string }> }

export default async function OwnerTrackingPage({ params }: Props) {
  const { bookingId } = await params;   // ← must await in Next.js 15

  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/signIn");

  const booking = await prisma.booking.findFirst({
    where: { id: bookingId, ownerId: session.user.id },
    include: {
      mechanic: { select: { name: true } },
      vehicle:  { select: { brand: true, model: true } },
    },
  });

  if (!booking) notFound();

  const props: OwnerTrackingProps = {
    bookingId:       booking.id,
    mechanicName:    booking.mechanic.name    ?? "Mechanic",
    vehicleLabel:    `${booking.vehicle.brand} ${booking.vehicle.model}`,
    status:          booking.status,
    initialOwnerLat: (booking as any).ownerLat ?? null,
    initialOwnerLng: (booking as any).ownerLng ?? null,
  };

  return <OwnerTrackingView {...props} />;
}