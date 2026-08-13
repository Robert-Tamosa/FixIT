import { auth }    from "@/lib/auth";
import { prisma }  from "@/lib/prisma";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import ShopChatsPage, {
  type ShopChatsProps, }
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
// booking represents an owner in the collapsed conversation list. Shop
// bookings never reach EN_ROUTE (skipped in the shop lifecycle), included
// anyway for parity with the mechanic side's identical set.
const ACTIVE_STATUSES = new Set([
  "PENDING", "CONFIRMED", "ESTIMATE_SENT", "ESTIMATE_ACCEPTED", "EN_ROUTE", "IN_PROGRESS",
]);

export default async function ShopChatsServerPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/signIn");

  // layout.tsx already guarantees a shop exists for this owner.
  const shop = await prisma.repairShop.findUniqueOrThrow({
    where:  { ownerId: session.user.id },
    select: { id: true, name: true },
  });

  // Fetch all bookings assigned to this shop
  const bookings = await prisma.booking.findMany({
    where: {
      shopId: shop.id,
      status: { notIn: ["CANCELLED"] },
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
  // shop's own bookings above.
  const previews = await getConversationPreviews(bookings.map((b) => b.id));

  // ── Collapse to one row per owner ───────────────────────────────────────
  // Same collapsing logic as the mechanic side's chats page — messages are
  // stored per-booking, so the same owner across several jobs would
  // otherwise show up as several identically-named rows.

  const byOwner = new Map<string, typeof bookings>();
  for (const b of bookings) {
    const group = byOwner.get(b.ownerId) ?? [];
    group.push(b);
    byOwner.set(b.ownerId, group);
  }

  const conversations: ShopChatsProps["conversations"] = Array.from(byOwner.values()).map((group) => {
    const primary = group.find((b) => ACTIVE_STATUSES.has(b.status)) ?? group[0];

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
      id:            primary.id,
      ownerName:     primary.owner.name ?? "Unknown Owner",
      ownerInitials: getInitials(primary.owner.name),
      vehicleLabel:  `${primary.vehicle.brand} ${primary.vehicle.model}`,
      lastMessage:   latestPreview.lastMessage
        ?? `${primary.problemDescription.slice(0, 60)}${primary.problemDescription.length > 60 ? "…" : ""}`,
      time:          latestPreview.lastMessageAt
        ? timeAgo(new Date(latestPreview.lastMessageAt))
        : timeAgo(primary.updatedAt),
      unread:        latestPreview.unreadTotal,
      status:        primary.status as ShopChatsProps["conversations"][number]["status"],
      _sortKey:      latestPreview.lastMessageAt ?? primary.updatedAt.toISOString(),
    };
  })
  .sort((a, b) => (a._sortKey < b._sortKey ? 1 : -1))
  .map(({ _sortKey, ...rest }) => rest);

  return (
    <ShopChatsPage
      conversations={conversations}
      shopName={shop.name}
      shopInitials={getInitials(shop.name)}
    />
  );
}