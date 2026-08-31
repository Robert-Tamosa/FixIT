"use server";

import { auth } from "@/lib/auth"; // ASSUMPTION — adjust to your actual auth import path
import { prisma } from "@/lib/prisma"; // ASSUMPTION — adjust to your actual prisma import path
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";

export type RemoveVehicleResult =
  | { status: "success" }
  | { status: "error"; message: string };

export async function removeVehicle(vehicleId: string): Promise<RemoveVehicleResult> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return { status: "error", message: "Not authenticated." };

  const vehicle = await prisma.vehicle.findUnique({
    where: { id: vehicleId },
    select: { ownerId: true },
  });
  if (!vehicle) return { status: "error", message: "Vehicle not found." };
  if (vehicle.ownerId !== session.user.id) return { status: "error", message: "Unauthorized." };

  // Don't allow removing a vehicle that's tied to a booking still in
  // flight — deleting the Vehicle row out from under a live booking would
  // break that booking's own vehicle relation/display.
  const activeBooking = await prisma.booking.findFirst({
    where: {
      vehicleId,
      status: { notIn: ["DONE", "CANCELLED", "DECLINED"] },
    },
    select: { id: true },
  });
  if (activeBooking) {
    return { status: "error", message: "Can't remove a vehicle with an active or pending booking." };
  }

  try {
    await prisma.vehicle.delete({ where: { id: vehicleId } });
  } catch (err) {
    // ASSUMPTION worth verifying: if Booking.vehicleId has no onDelete
    // behavior set (or is RESTRICT, the Prisma default), deleting a
    // vehicle with any booking HISTORY at all — not just active ones —
    // will fail on the foreign key constraint, even long-completed jobs.
    // If that turns out to be the common case in practice, the real fix is
    // a soft-delete (an `archivedAt` field on Vehicle, filtered out of
    // normal queries) rather than a hard delete — that's a schema change
    // I didn't want to make without you confirming it's actually needed.
    console.error("[removeVehicle]", err);
    return {
      status: "error",
      message: "Couldn't remove this vehicle — it may have booking history tied to it.",
    };
  }

  revalidatePath("/dashboard/owner");
  revalidatePath("/dashboard/owner/profile");
  return { status: "success" };
}