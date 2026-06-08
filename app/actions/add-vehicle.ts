"use server";

import { auth }    from "@/lib/auth";
import { prisma }  from "@/lib/prisma";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";

export type AddVehicleState =
  | { status: "idle" }
  | { status: "success"; vehicle: { id: string; brand: string; model: string; plateNumber: string | null } }
  | { status: "error"; message: string };

export async function addVehicle(
  _prev: AddVehicleState,
  formData: FormData
): Promise<AddVehicleState> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return { status: "error", message: "Not authenticated." };

  const brand       = (formData.get("brand")       as string | null)?.trim();
  const model       = (formData.get("model")       as string | null)?.trim();
  const plateNumber = (formData.get("plateNumber") as string | null)?.trim() || null;
  const year        = (formData.get("yearModel")   as string | null)?.trim();
  const color       = (formData.get("color")       as string | null)?.trim();

  if (!brand)  return { status: "error", message: "Brand is required." };
  if (!model)  return { status: "error", message: "Model is required." };

  try {
    const vehicle = await prisma.vehicle.create({
      data: {
        brand,
        model,
        plateNumber,
        ...(year  ? { year: parseInt(year, 10) } : {}),
        ...(color ? { color } : {}),
        ownerId: session.user.id,
      },
      select: { id: true, brand: true, model: true, plateNumber: true },
    });

    revalidatePath("/owner/dashboard");
    return { status: "success", vehicle };
  } catch (err) {
    console.error("[addVehicle]", err);
    return { status: "error", message: "Failed to save vehicle. Please try again." };
  }
}