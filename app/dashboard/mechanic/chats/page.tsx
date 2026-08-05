import { auth }    from "@/lib/auth";
import { prisma }  from "@/lib/prisma";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import MechanicChatsPage, {
  type MechanicChatsProps, }
  from "./view";
import { getConversationPreviews } from "@/app/actions/messages";

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

// Bookings in any of these statuses count as "ongoing" for picking which
// booking represents an owner in the collapsed conversation list.
const ACTIVE_STATUSES = new Set([
  "PENDING", "CONFIRMED", "ESTIMATE_SENT", "ESTIMATE_ACCEPTED", "EN_ROUTE", "IN_PROGRESS",
]);

export default async function MechanicChatsServerPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/signIn");

  // Fetch mechanic info
  const mechanic = await prisma.user.findUniqueOrThrow({
    where:  { id: session.user.id },
    select: { name: true },
  });

  // Fetch all bookings where this mechanic is assigned
  const bookings = await prisma.booking.findMany({
    where: {
      mechanicId: session.user.id,
      status:     { notIn: ["CANCELLED"] },
    },
    select: {
      id:                 true,
      ownerId:            true,
      status:             true,
      problemDescription: true,
      updatedAt:          true,
      owner:   { select: { name: true } },
      vehicle: { select: { brand: true, model: true } },
    },
    orderBy: { updatedAt: "desc" },
    take: 30,
  });

  // Real message previews, per booking — bookingIds here are safe to pass
  // in because they came straight from a query already scoped to this
  // mechanic's own bookings above.
  const previews = await getConversationPreviews(bookings.map((b) => b.id));

  // ── Collapse to one row per owner ───────────────────────────────────────
  // Messages are stored per-booking, so the same owner across 3 jobs would
  // otherwise show up as 3 separate, identically-named rows. Group by
  // ownerId and pick one "primary" booking per owner to represent them:
  // an active/ongoing one if they have one, otherwise their most recent.
  // Preview text/time and the unread badge are computed across ALL of that
  // owner's bookings, not just the primary one, so a message sitting on a
  // non-primary (e.g. older completed) booking still surfaces correctly —
  // only the *opened thread* is scoped to the primary booking's messages.

  const byOwner = new Map<string, typeof bookings>();
  for (const b of bookings) {
    const group = byOwner.get(b.ownerId) ?? [];
    group.push(b);
    byOwner.set(b.ownerId, group);
  }

  const conversations: MechanicChatsProps["conversations"] = Array.from(byOwner.values()).map((group) => {
    // Primary booking: prefer an active one, else the most recently updated
    // (group is already a subset of `bookings`, which is ordered desc by
    // updatedAt, so group[0] is already the most recent for this owner).
    const primary = group.find((b) => ACTIVE_STATUSES.has(b.status)) ?? group[0];

    // Most recent activity across ALL of this owner's bookings — whichever
    // one has the latest message, falling back to booking.updatedAt if none
    // of their bookings have any messages yet.
    let latestPreview: { lastMessage: string | null; lastMessageAt: string | null; unreadTotal: number } = {
      lastMessage: null,
      lastMessageAt: null,
      unreadTotal: 0,
    };
    for (const b of group) {
      const p = previews.get(b.id);
      latestPreview.unreadTotal += p?.unreadCount ?? 0;
      if (p?.lastMessageAt && (!latestPreview.lastMessageAt || p.lastMessageAt > latestPreview.lastMessageAt)) {
        latestPreview.lastMessage = p.lastMessage;
        latestPreview.lastMessageAt = p.lastMessageAt;
      }
    }

    return {
      id:            primary.id, // opening this row loads THIS booking's thread
      ownerName:     primary.owner.name ?? "Unknown Owner",
      ownerInitials: getInitials(primary.owner.name),
      vehicleLabel:  `${primary.vehicle.brand} ${primary.vehicle.model}`,
      lastMessage:   latestPreview.lastMessage
        ?? `${primary.problemDescription.slice(0, 60)}${primary.problemDescription.length > 60 ? "…" : ""}`,
      time:          latestPreview.lastMessageAt
        ? timeAgo(new Date(latestPreview.lastMessageAt))
        : timeAgo(primary.updatedAt),
      unread:        latestPreview.unreadTotal,
      status:        primary.status as MechanicChatsProps["conversations"][number]["status"],
      _sortKey:      latestPreview.lastMessageAt ?? primary.updatedAt.toISOString(),
    };
  })
  // Most recently active owner first — matches the previous per-booking
  // ordering behavior, just applied to the collapsed list.
  .sort((a, b) => (a._sortKey < b._sortKey ? 1 : -1))
  .map(({ _sortKey, ...rest }) => rest);

  return (
    <MechanicChatsPage
      conversations={conversations}
      mechanicName={mechanic.name     ?? "Mechanic"}
      mechanicInitials={getInitials(mechanic.name)}
    />
  );
}