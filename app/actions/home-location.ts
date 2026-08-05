"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export interface HomeLocation {
  address: string;
  lat: number;
  lng: number;
}

/** Fetches the current owner's saved default location, or null if they've never set one. */
export async function getHomeLocation(): Promise<HomeLocation | null> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) throw new Error("Unauthorized");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { homeAddress: true, homeLat: true, homeLng: true },
  });

  if (!user?.homeLat || !user?.homeLng || !user?.homeAddress) return null;
  return { address: user.homeAddress, lat: user.homeLat, lng: user.homeLng };
}

/** Saves/overwrites the current owner's default location — used from the booking flow's "save as home" option. */
export async function saveHomeLocation(lat: number, lng: number, address: string) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) throw new Error("Unauthorized");

  await prisma.user.update({
    where: { id: session.user.id },
    data: { homeLat: lat, homeLng: lng, homeAddress: address },
  });

  revalidatePath("/dashboard/owner");
  return { success: true };
}