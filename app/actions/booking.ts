"use server";

import { auth }           from "@/lib/auth";
import { prisma }         from "@/lib/prisma";
import { headers }        from "next/headers";
import { revalidatePath } from "next/cache";

interface CreateBookingInput {
  vehicleId:          string;
  mechanicId:         string;
  problemDescription: string;
  scheduledAt?:       string; // ISO string from the datetime-local input
}

export async function createBooking(data: CreateBookingInput) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) throw new Error("Unauthorized");

  if (!data.vehicleId)          throw new Error("Please select a vehicle.");
  if (!data.mechanicId)         throw new Error("Please select a mechanic.");
  if (!data.problemDescription) throw new Error("Please describe the problem.");

  const booking = await prisma.booking.create({
    data: {
      ownerId:            session.user.id,
      vehicleId:          data.vehicleId,
      mechanicId:         data.mechanicId,
      problemDescription: data.problemDescription,
      scheduledAt:        data.scheduledAt ? new Date(data.scheduledAt) : undefined,
      status:             "PENDING",
    },
  });

  revalidatePath("/dashboard/owner");

  return { success: true, bookingId: booking.id };
}