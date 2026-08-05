"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * Internal helper — NOT exported for direct client use. Called from other
 * action files (booking-actions.ts, estimate.ts, invoice.ts, etc.) at the
 * point an event actually happens, so notification creation lives next to
 * the state change it's about rather than being inferred after the fact.
 */
export async function createNotification(input: {
  userId: string;
  type: string;
  title: string;
  body?: string;
  link?: string;
}) {
  await prisma.notification.create({
    data: {
      userId: input.userId,
      type: input.type,
      title: input.title,
      body: input.body,
      link: input.link,
    },
  });
}

async function requireUserId() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) throw new Error("Unauthorized");
  return session.user.id;
}

export interface DisplayNotification {
  id: string;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  isRead: boolean;
  createdAt: string;
}

/** Most recent notifications for the current user, newest first. */
export async function getNotifications(limit = 20): Promise<DisplayNotification[]> {
  const userId = await requireUserId();

  const notifications = await prisma.notification.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  return notifications.map((n) => ({
    id: n.id,
    type: n.type,
    title: n.title,
    body: n.body,
    link: n.link,
    isRead: n.readAt !== null,
    createdAt: n.createdAt.toISOString(),
  }));
}

/** Cheap unread count for a bell badge — poll this, not the full list, when just showing a number. */
export async function getUnreadNotificationCount(): Promise<number> {
  const userId = await requireUserId();
  return prisma.notification.count({ where: { userId, readAt: null } });
}

export async function markNotificationRead(id: string) {
  const userId = await requireUserId();

  await prisma.notification.updateMany({
    where: { id, userId }, // scoped so a user can't mark someone else's notification read by guessing an id
    data: { readAt: new Date() },
  });

  return { success: true };
}

export async function markAllNotificationsRead() {
  const userId = await requireUserId();

  await prisma.notification.updateMany({
    where: { userId, readAt: null },
    data: { readAt: new Date() },
  });

  revalidatePath("/dashboard/owner");
  revalidatePath("/dashboard/mechanic");
  revalidatePath("/dashboard/shop");

  return { success: true };
}