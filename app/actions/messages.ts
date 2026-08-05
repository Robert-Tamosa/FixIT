"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * Confirms the current user is a participant on this booking — the owner,
 * the assigned mechanic, or (for shop-dispatched bookings with no mechanic
 * assigned yet) the shop's owner. Anyone else gets Unauthorized, same as
 * the rest of the booking-scoped actions in this app.
 */
async function requireParticipant(bookingId: string) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) throw new Error("Unauthorized");

  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    select: {
      id: true,
      ownerId: true,
      mechanicId: true,
      shopId: true,
      shop: { select: { ownerId: true } },
    },
  });
  if (!booking) throw new Error("Booking not found");

  const userId = session.user.id;
  const isOwner = booking.ownerId === userId;
  const isMechanic = booking.mechanicId === userId;
  const isShopOwner = booking.shopId != null && booking.shop?.ownerId === userId;

  if (!isOwner && !isMechanic && !isShopOwner) {
    throw new Error("You don't have access to this conversation");
  }

  return { userId, booking };
}

export interface ConversationPreview {
  bookingId: string;
  lastMessage: string | null;
  lastMessageAt: string | null;
  unreadCount: number;
}

/**
 * Batch-fetches a lightweight preview (last message + unread count) for a
 * set of bookings, for conversation-list screens (owner/mechanic chat
 * lists). Deliberately does NOT re-check participant access per booking —
 * that would be an N+1 auth query on top of an already-batched read query,
 * defeating the point. Trust boundary: callers must only pass bookingIds
 * the current user is already confirmed to have access to (e.g. straight
 * from their own `booking.findMany({ where: { mechanicId: session.user.id }})`
 * or the owner equivalent) — never pass through an arbitrary/user-supplied
 * list of IDs here.
 */
export async function getConversationPreviews(bookingIds: string[]): Promise<Map<string, ConversationPreview>> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) throw new Error("Unauthorized");
  const userId = session.user.id;

  const map = new Map<string, ConversationPreview>();
  if (bookingIds.length === 0) return map;

  const [lastMessages, unreadCounts] = await Promise.all([
    prisma.message.findMany({
      where: { bookingId: { in: bookingIds } },
      orderBy: { createdAt: "desc" },
      distinct: ["bookingId"],
      select: { bookingId: true, content: true, createdAt: true },
    }),
    prisma.message.groupBy({
      by: ["bookingId"],
      where: { bookingId: { in: bookingIds }, senderId: { not: userId }, readAt: null },
      _count: { _all: true },
    }),
  ]);

  const unreadMap = new Map(unreadCounts.map((u) => [u.bookingId, u._count._all]));

  for (const id of bookingIds) {
    const last = lastMessages.find((m) => m.bookingId === id);
    map.set(id, {
      bookingId: id,
      lastMessage: last?.content ?? null,
      lastMessageAt: last ? last.createdAt.toISOString() : null,
      unreadCount: unreadMap.get(id) ?? 0,
    });
  }

  return map;
}

export interface DisplayMessage {
  id: string;
  senderId: string;
  isMine: boolean;
  content: string;
  createdAt: string; // ISO string — format client-side so the timezone matches the viewer
  readAt: string | null;
}

/** Fetches the full message thread for a booking, oldest first. */
export async function getMessages(bookingId: string): Promise<DisplayMessage[]> {
  const { userId } = await requireParticipant(bookingId);

  const messages = await prisma.message.findMany({
    where: { bookingId },
    orderBy: { createdAt: "asc" },
    // Capped — a booking-scoped thread is short-lived by nature (one job's
    // worth of back-and-forth), so there's no pagination need yet. Worth
    // revisiting only if bookings start accumulating unusually long threads.
    take: 200,
  });

  return messages.map((m) => ({
    id: m.id,
    senderId: m.senderId,
    isMine: m.senderId === userId,
    content: m.content,
    createdAt: m.createdAt.toISOString(),
    readAt: m.readAt ? m.readAt.toISOString() : null,
  }));
}

/**
 * Sends a message on a booking's thread. Kept intentionally minimal — text
 * only, no attachments — since this is explicitly meant to work in
 * low-network conditions, and small payloads matter more there than rich
 * media ever would.
 */
export async function sendMessage(bookingId: string, content: string): Promise<DisplayMessage> {
  const { userId } = await requireParticipant(bookingId);

  const trimmed = content.trim();
  if (!trimmed) throw new Error("Message can't be empty");
  if (trimmed.length > 2000) throw new Error("Message is too long");

  const message = await prisma.message.create({
    data: { bookingId, senderId: userId, content: trimmed },
  });

  revalidatePath("/dashboard/owner");
  revalidatePath("/dashboard/mechanic");
  revalidatePath("/dashboard/shop");

  return {
    id: message.id,
    senderId: message.senderId,
    isMine: true,
    content: message.content,
    createdAt: message.createdAt.toISOString(),
    readAt: null,
  };
}

/** Marks all messages NOT sent by the current user as read. Called when the thread is opened/viewed. */
export async function markMessagesRead(bookingId: string) {
  const { userId } = await requireParticipant(bookingId);

  await prisma.message.updateMany({
    where: { bookingId, senderId: { not: userId }, readAt: null },
    data: { readAt: new Date() },
  });

  return { success: true };
}

/**
 * Lightweight unread count for a booking — cheap enough to poll alongside
 * a dashboard's existing refresh cycle, for showing a badge without opening
 * the full thread.
 */
export async function getUnreadCount(bookingId: string): Promise<number> {
  const { userId } = await requireParticipant(bookingId);

  return prisma.message.count({
    where: { bookingId, senderId: { not: userId }, readAt: null },
  });
}