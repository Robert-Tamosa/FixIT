import { auth }    from "@/lib/auth";
import { prisma }  from "@/lib/prisma";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import OwnerChatsPage, { type OwnerChatsProps } from "./view";
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

const ACTIVE_STATUSES = new Set([
  "PENDING", "CONFIRMED", "ESTIMATE_SENT", "ESTIMATE_ACCEPTED", "EN_ROUTE", "IN_PROGRESS",
]);

export default async function OwnerChatsServerPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/signIn");

  // Only bookings with a specific mechanic assigned can have a chat
  // participant right now — "Any Available Mechanic" bookings with no
  // mechanicId yet, and pure shop-dispatched threads, aren't wired into any
  // chat UI yet (requireParticipant's shop-owner branch exists in
  // messages.ts but has no frontend using it). Scoping to assigned
  // mechanics only for now; shop conversations are a follow-up.
  const bookings = await prisma.booking.findMany({
    where: {
      ownerId:    session.user.id,
      mechanicId: { not: null },
      status:     { notIn: ["CANCELLED"] },
    },
    select: {
      id:                 true,
      mechanicId:         true,
      status:             true,
      problemDescription: true,
      updatedAt:          true,
      mechanic: { select: { name: true, mechanicProfile: { select: { specialization: true } } } },
    },
    orderBy: { updatedAt: "desc" },
    take: 30,
  });

  const previews = await getConversationPreviews(bookings.map((b) => b.id));

  // Collapse to one row per mechanic — same reasoning as the mechanic-side
  // grouping: a repeat mechanic across several jobs shouldn't produce
  // several identically-named rows.
  const byMechanic = new Map<string, typeof bookings>();
  for (const b of bookings) {
    if (!b.mechanicId) continue;
    const group = byMechanic.get(b.mechanicId) ?? [];
    group.push(b);
    byMechanic.set(b.mechanicId, group);
  }

  const conversations: OwnerChatsProps["conversations"] = Array.from(byMechanic.values()).map((group) => {
    const primary = group.find((b) => ACTIVE_STATUSES.has(b.status)) ?? group[0];

    let latest: { lastMessage: string | null; lastMessageAt: string | null; unreadTotal: number } = {
      lastMessage: null,
      lastMessageAt: null,
      unreadTotal: 0,
    };
    for (const b of group) {
      const p = previews.get(b.id);
      latest.unreadTotal += p?.unreadCount ?? 0;
      if (p?.lastMessageAt && (!latest.lastMessageAt || p.lastMessageAt > latest.lastMessageAt)) {
        latest.lastMessage = p.lastMessage;
        latest.lastMessageAt = p.lastMessageAt;
      }
    }

    return {
      id:              primary.id,
      mechanicName:    primary.mechanic?.name ?? "Unknown Mechanic",
      mechanicInitials:getInitials(primary.mechanic?.name ?? null),
      specialization:  primary.mechanic?.mechanicProfile?.specialization ?? "General Mechanic",
      lastMessage:     latest.lastMessage
        ?? `${primary.problemDescription.slice(0, 60)}${primary.problemDescription.length > 60 ? "…" : ""}`,
      time:            latest.lastMessageAt ? timeAgo(new Date(latest.lastMessageAt)) : timeAgo(primary.updatedAt),
      unread:          latest.unreadTotal,
      status:          primary.status as OwnerChatsProps["conversations"][number]["status"],
      _sortKey:        latest.lastMessageAt ?? primary.updatedAt.toISOString(),
    };
  })
  .sort((a, b) => (a._sortKey < b._sortKey ? 1 : -1))
  .map(({ _sortKey, ...rest }) => rest);

  return <OwnerChatsPage conversations={conversations} />;
}