"use server";

import { auth }    from "@/lib/auth";
import { prisma }  from "@/lib/prisma";
import { headers } from "next/headers";

export type FetchedVehicle = {
  id:          string;
  brand:       string;
  model:       string;
  plateNumber: string | null;
};

export async function getVehicles(): Promise<FetchedVehicle[]> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return [];

  return prisma.vehicle.findMany({
    where:  { ownerId: session.user.id },
    select: { id: true, brand: true, model: true, plateNumber: true },
    orderBy: { createdAt: "desc" },
  });
}
