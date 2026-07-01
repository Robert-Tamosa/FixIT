import { auth }    from "@/lib/auth";
import { prisma }  from "@/lib/prisma";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import MechanicChatsPage, {
  type MechanicChatsProps, }
  from "./view";

function getInitials(name: string | null): string {
  if (!name) return "?";
  return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
}

function timeAgo(date: Date): string {
  const diff = Date.now() - date.getTime();
  const mins  = Math.floor(diff / 60_000);
  const hours = Math.floor(diff / 3_600_000);
  const days  = Math.floor(diff / 86_400_000);
  if (mins < 1)   return "just now";
  if (mins < 60)  return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${days}d ago`;
}

export default async function MechanicChatsServerPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/signIn");

  // Fetch mechanic info
  const mechanic = await prisma.user.findUniqueOrThrow({
    where:  { id: session.user.id },
    select: { name: true },
  });

  // Fetch all bookings where this mechanic is assigned
  // These become the "conversations"
  const bookings = await prisma.booking.findMany({
    where: {
      mechanicId: session.user.id,
      status:     { notIn: ["CANCELLED"] },
    },
    select: {
      id:                 true,
      status:             true,
      problemDescription: true,
      updatedAt:          true,
      owner:   { select: { name: true } },
      vehicle: { select: { brand: true, model: true } },
    },
    orderBy: { updatedAt: "desc" },
    take: 30,
  });

  const conversations: MechanicChatsProps["conversations"] = bookings.map((b) => ({
    id:            b.id,
    ownerName:     b.owner.name     ?? "Unknown Owner",
    ownerInitials: getInitials(b.owner.name),
    vehicleLabel:  `${b.vehicle.brand} ${b.vehicle.model}`,
    lastMessage:   b.problemDescription.slice(0, 60) +
                   (b.problemDescription.length > 60 ? "…" : ""),
    time:          timeAgo(b.updatedAt),
    unread:        b.status === "PENDING" ? 1 : 0,
    status:        b.status as MechanicChatsProps["conversations"][number]["status"],
  }));

  return (
    <MechanicChatsPage
      conversations={conversations}
      mechanicName={mechanic.name     ?? "Mechanic"}
      mechanicInitials={getInitials(mechanic.name)}
    />
  );
}