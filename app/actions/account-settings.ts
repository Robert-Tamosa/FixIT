"use server";

import { auth }           from "@/lib/auth";
import { prisma }         from "@/lib/prisma";
import { headers }        from "next/headers";
import { revalidatePath } from "next/cache";

// ── Read current settings ───────────────────────────────────────────────────
// Shared by all three roles' Notifications and Privacy & Security pages —
// deliberately role-agnostic since notificationsEnabled/deletionRequestedAt
// live on User, not on any role-specific profile table.

export async function getAccountSettings() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) throw new Error("Not authenticated.");

  const user = await prisma.user.findUnique({
    where:  { id: session.user.id },
    select: { notificationsEnabled: true, deletionRequestedAt: true },
  });
  if (!user) throw new Error("User not found.");
  return user;
}

// ── Notifications toggle ────────────────────────────────────────────────────
// Single master switch for this pass — no per-category granularity yet.

export async function setNotificationsEnabled(enabled: boolean) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) throw new Error("Not authenticated.");

  await prisma.user.update({
    where: { id: session.user.id },
    data:  { notificationsEnabled: enabled },
  });

  revalidatePath("/dashboard/owner/settings/notifications");
  revalidatePath("/dashboard/mechanic/settings/notifications");
  revalidatePath("/dashboard/shop/settings/notifications");
}

// ── Account deletion request ────────────────────────────────────────────────
// Deliberately NOT a real delete — same reasoning as the vehicle hard-delete
// bug: this account has too many FK-referenced relations (bookings, payments,
// messages, ratings) to safely hard-delete without a dedicated review step.
// This just timestamps a request; nothing currently consumes it beyond the
// UI reflecting "request submitted" — actually processing it is a manual/
// admin step outside this pass' scope.

export async function requestAccountDeletion() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) throw new Error("Not authenticated.");

  await prisma.user.update({
    where: { id: session.user.id },
    data:  { deletionRequestedAt: new Date() },
  });

  revalidatePath("/dashboard/owner/settings/privacy");
  revalidatePath("/dashboard/mechanic/settings/privacy");
  revalidatePath("/dashboard/shop/settings/privacy");
}

export async function cancelAccountDeletion() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) throw new Error("Not authenticated.");

  await prisma.user.update({
    where: { id: session.user.id },
    data:  { deletionRequestedAt: null },
  });

  revalidatePath("/dashboard/owner/settings/privacy");
  revalidatePath("/dashboard/mechanic/settings/privacy");
  revalidatePath("/dashboard/shop/settings/privacy");
}