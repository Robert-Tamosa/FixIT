"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

async function requireMechanic() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) throw new Error("Unauthorized");
  const dbUser = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, role: true },
  });
  if (!dbUser || dbUser.role !== "MECHANIC") throw new Error("Mechanics only");
  return dbUser;
}

/**
 * Updates the current mechanic's location. Call this whenever a mechanic
 * toggles themselves "available" (same pattern as the owner's emergency
 * request flow using navigator.geolocation), so emergency matching always
 * has a recent location to work from.
 */
export async function updateMechanicLocation(latitude: number, longitude: number) {
  const user = await requireMechanic();

  await prisma.mechanicProfile.update({
    where: { userId: user.id },
    data: { latitude, longitude },
  });

  revalidatePath("/dashboard/mechanic");
  return { success: true };
}

/**
 * Toggles availability and captures location in one call, since a mechanic
 * going available with no location on file is invisible to emergency matching
 * regardless of the toggle state.
 */
export async function setAvailability(isAvailable: boolean, latitude?: number, longitude?: number) {
  const user = await requireMechanic();

  await prisma.mechanicProfile.update({
    where: { userId: user.id },
    data: {
      isAvailable,
      ...(latitude !== undefined && longitude !== undefined ? { latitude, longitude } : {}),
    },
  });

  revalidatePath("/dashboard/mechanic");
  return { success: true };
}