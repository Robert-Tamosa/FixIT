"use server";

import { auth }    from "@/lib/auth";
import { prisma }  from "@/lib/prisma";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { confirmVehicleDocument } from "@/app/actions/document-analysis";

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
  // FIX: this used to read formData.get("yearModel"), but the input in
  // vehicle-summary-card.tsx is name="year" — that key never matched, so
  // year was silently never captured. Also fixed the write below, which
  // used to write a Prisma field called `year` that doesn't exist on
  // Vehicle (the schema field is `yearModel`) — this would have been a
  // type error the moment Prisma's generated types were checked.
  const year        = (formData.get("year")        as string | null)?.trim();
  const color       = (formData.get("color")       as string | null)?.trim();

  // COR scan data, present only if the owner scanned a COR photo before
  // submitting (see CORScanButton in vehicle-summary-card.tsx). Optional —
  // the form works exactly as before if these are absent.
  const corDocumentId = (formData.get("corDocumentId") as string | null) || null;
  const corFieldsRaw  = (formData.get("corFields") as string | null) || null;

  if (!brand)  return { status: "error", message: "Brand is required." };
  if (!model)  return { status: "error", message: "Model is required." };

  try {
    const vehicle = await prisma.vehicle.create({
      data: {
        brand,
        model,
        plateNumber,
        ...(year  ? { yearModel: parseInt(year, 10) } : {}),
        ...(color ? { color } : {}),
        ownerId: session.user.id,
      },
      select: { id: true, brand: true, model: true, plateNumber: true },
    });

    // Best-effort: attach the scanned COR document to the vehicle that was
    // just created. Deliberately doesn't fail the whole request if this
    // errors — the vehicle itself already saved successfully, and losing
    // the COR attachment is far less bad than losing the vehicle. Logged
    // so it's visible, not silently swallowed.
    if (corDocumentId) {
      try {
        const editedFields = corFieldsRaw ? JSON.parse(corFieldsRaw) : {};
        await confirmVehicleDocument(corDocumentId, editedFields, vehicle.id);
      } catch (corErr) {
        console.error("[addVehicle] COR attach failed (vehicle still saved):", corErr);
      }
    }

    revalidatePath("/owner/dashboard");
    return { status: "success", vehicle };
  } catch (err) {
    console.error("[addVehicle]", err);
    return { status: "error", message: "Failed to save vehicle. Please try again." };
  }
}