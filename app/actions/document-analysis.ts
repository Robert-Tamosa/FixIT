"use server";

import { headers } from "next/headers";
import { auth } from "@/lib/auth"; // ASSUMPTION — adjust to your actual auth import path
import { prisma } from "@/lib/prisma"; // ASSUMPTION — adjust to your actual prisma import path
import { callGroqVision, assertReasonableImageSize } from "@/lib/groq-vision";

// ============================================================
// Auth helper — same per-file pattern as the rest of the project
// ============================================================
async function requireUser() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) throw new Error("Unauthorized");
  const dbUser = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, role: true },
  });
  if (!dbUser) throw new Error("Unauthorized");
  return dbUser;
}

// ============================================================
// Display type
// ============================================================
export type DisplayVehicleDocument = {
  id: string;
  vehicleId: string | null;
  status: "PENDING" | "EXTRACTED" | "CONFIRMED" | "FAILED";
  confidence: number | null;
  failReason: string | null;
  sourceSuspicious: boolean;
  sourceFlagReasons: string[];
  fields: {
    plateNumber: string | null;
    mvFileNumber: string | null;
    engineNumber: string | null;
    chassisNumber: string | null;
    make: string | null;
    series: string | null;
    bodyType: string | null;
    color: string | null;
    yearModel: string | null;
    grossWeight: string | null;
    ownerName: string | null;
  };
};

function toDisplay(d: any): DisplayVehicleDocument {
  return {
    id: d.id,
    vehicleId: d.vehicleId,
    status: d.status,
    confidence: d.confidence,
    failReason: d.failReason,
    sourceSuspicious: d.sourceSuspicious ?? false,
    sourceFlagReasons: d.sourceFlagReasons ?? [],
    fields: {
      plateNumber: d.plateNumber,
      mvFileNumber: d.mvFileNumber,
      engineNumber: d.engineNumber,
      chassisNumber: d.chassisNumber,
      make: d.make,
      series: d.series,
      bodyType: d.bodyType,
      color: d.color,
      yearModel: d.yearModel,
      grossWeight: d.grossWeight,
      ownerName: d.ownerName,
    },
  };
}

// ============================================================
// The extraction prompt — strict JSON-only, null for low-confidence fields
// ============================================================
const COR_PROMPT = `You are looking at a photo of a Philippine LTO (Land Transportation Office) Certificate of Registration (COR/OR-CR) for a vehicle.

Extract the following fields. For ANY field you are not confident about (blurry, cut off, ambiguous, or not visible in the photo), return null for that field rather than guessing.

Separately, examine the PHOTO ITSELF (not its content) for visible signs it may not be an original photo taken directly of a physical document by the person submitting it — for example:
- A visible watermark, logo, or caption from a stock-photo site, search engine, or news source
- Screenshot artifacts: browser chrome, address bar, scrollbar, cropped browser window edges
- Studio-style staging (uniform backdrop, promotional lighting) inconsistent with a quick phone photo of a document on a desk or in hand
- Visual artifacts sometimes seen in AI-generated images: warped or physically-impossible text/edges, unnaturally smooth or repeating textures, inconsistent lighting/shadow directions within the same image
Only flag what is actually visible — do not guess at AI generation from content alone. When genuinely uncertain whether something is a real tell, err toward flagging it rather than missing it — a false positive here just means a human double-checks, which is cheap; missing an actual reused/downloaded image is the expensive failure.

Respond with ONLY a JSON object, no markdown formatting, no explanation, no preamble — just the raw JSON:

{
  "plateNumber": string | null,
  "mvFileNumber": string | null,
  "engineNumber": string | null,
  "chassisNumber": string | null,
  "make": string | null,
  "series": string | null,
  "bodyType": string | null,
  "color": string | null,
  "yearModel": string | null,
  "grossWeight": string | null,
  "ownerName": string | null,
  "confidence": number,
  "sourceCheck": {
    "suspicious": boolean,
    "reasons": string[]
  }
}

"confidence" is your overall confidence (0.0 to 1.0) in the fields you DID extract — not counting fields you returned as null.
"sourceCheck.reasons" should list the specific visible evidence for each flag (e.g. "Visible Shutterstock watermark in the bottom-right corner"), not a generic statement. Empty array if nothing suspicious was visible.`;

// ============================================================
// Basic format sanity checks — per spec: "validated with basic format
// checks" before being shown to the owner. Deliberately loose (LTO document
// formats vary), these just null out obviously-wrong OCR noise rather than
// trying to be a strict validator.
// ============================================================
function sanityCheck(fields: Record<string, unknown>) {
  const cleaned: Record<string, string | null> = {};
  for (const [key, value] of Object.entries(fields)) {
    if (key === "confidence") continue;
    if (typeof value !== "string" || value.trim().length === 0) {
      cleaned[key] = null;
      continue;
    }
    const v = value.trim();
    // Reject obvious placeholder junk a model sometimes emits instead of null
    if (/^(n\/?a|none|unknown|null|-{1,3})$/i.test(v)) {
      cleaned[key] = null;
      continue;
    }
    cleaned[key] = v;
  }
  return cleaned;
}

// ============================================================
// scanCOR — capture a COR photo, run extraction, leave it in EXTRACTED
// status for the owner to review. Does NOT touch the Vehicle record yet.
//
// vehicleId is optional: pass it when rescanning for an EXISTING vehicle
// (e.g. from the vehicle profile page). Omit it for the "Add Vehicle" step
// inside the booking modal, where the vehicle doesn't exist yet — the
// document is created unattached and gets linked in confirmVehicleDocument
// once the vehicle is actually created.
// ============================================================
export async function scanCOR(imageDataUrl: string, vehicleId?: string): Promise<DisplayVehicleDocument> {
  const user = await requireUser();

  if (vehicleId) {
    const vehicle = await prisma.vehicle.findUnique({ where: { id: vehicleId }, select: { ownerId: true } });
    if (!vehicle) throw new Error("Vehicle not found");
    if (vehicle.ownerId !== user.id) throw new Error("Unauthorized");
  }

  assertReasonableImageSize(imageDataUrl);

  const doc = await prisma.vehicleDocument.create({
    data: { vehicleId: vehicleId ?? null, uploadedById: user.id, image: imageDataUrl, status: "PENDING" },
  });

  try {
    const result = await callGroqVision<Record<string, unknown>>(imageDataUrl, COR_PROMPT);
    const fields = sanityCheck(result);
    const confidence = typeof result.confidence === "number" ? result.confidence : null;

    const sourceCheck = result.sourceCheck as { suspicious?: boolean; reasons?: unknown } | undefined;
    const sourceSuspicious = sourceCheck?.suspicious === true;
    const sourceFlagReasons = Array.isArray(sourceCheck?.reasons)
      ? sourceCheck.reasons.filter((r): r is string => typeof r === "string")
      : [];

    const updated = await prisma.vehicleDocument.update({
      where: { id: doc.id },
      data: {
        ...fields,
        confidence,
        rawResponse: result as any,
        status: "EXTRACTED",
        sourceSuspicious,
        sourceFlagReasons,
      },
    });
    return toDisplay(updated);
  } catch (err) {
    const updated = await prisma.vehicleDocument.update({
      where: { id: doc.id },
      data: {
        status: "FAILED",
        failReason: err instanceof Error ? err.message : "Extraction failed",
      },
    });
    return toDisplay(updated);
  }
}

// ============================================================
// confirmVehicleDocument — owner reviews/edits the extracted fields and
// confirms. Two call shapes:
//   1. Rescan of an existing vehicle: doc.vehicleId is already set, just
//      pass the edited fields.
//   2. Add-vehicle-in-booking-modal flow: doc.vehicleId is null because the
//      vehicle didn't exist at scan time — pass the newly-created vehicle's
//      id as `attachToVehicleId` so this call both links the document AND
//      writes the confirmed fields back onto that Vehicle.
// Either way, copies the subset of fields the Vehicle model already has
// (plateNumber, yearModel) back onto the Vehicle record.
// ============================================================
export async function confirmVehicleDocument(
  documentId: string,
  edited: Partial<DisplayVehicleDocument["fields"]>,
  attachToVehicleId?: string,
): Promise<DisplayVehicleDocument> {
  const user = await requireUser();
  const doc = await prisma.vehicleDocument.findUnique({
    where: { id: documentId },
    select: { id: true, vehicleId: true, uploadedById: true, vehicle: { select: { ownerId: true } } },
  });
  if (!doc) throw new Error("Document not found");

  // Ownership check depends on whether this document is attached yet.
  if (doc.vehicleId) {
    if (doc.vehicle?.ownerId !== user.id) throw new Error("Unauthorized");
  } else {
    if (doc.uploadedById !== user.id) throw new Error("Unauthorized");
  }

  let targetVehicleId = doc.vehicleId;
  if (!targetVehicleId && attachToVehicleId) {
    const vehicle = await prisma.vehicle.findUnique({
      where: { id: attachToVehicleId },
      select: { ownerId: true },
    });
    if (!vehicle || vehicle.ownerId !== user.id) throw new Error("Unauthorized to attach to that vehicle");
    targetVehicleId = attachToVehicleId;
  }

  const cleaned = sanityCheck(edited);

  const ops: any[] = [
    prisma.vehicleDocument.update({
      where: { id: documentId },
      data: {
        ...cleaned,
        ...(targetVehicleId ? { vehicleId: targetVehicleId } : {}),
        status: "CONFIRMED",
        confirmedAt: new Date(),
      },
    }),
  ];

  if (targetVehicleId) {
    // ASSUMPTION: Vehicle.plateNumber is String? and Vehicle.yearModel is
    // Int? (both confirmed in schema). Only these two fields exist on
    // Vehicle today; the rest (engine/chassis number, MV file number, gross
    // weight, etc.) have nowhere to live on Vehicle and just stay on
    // VehicleDocument. Surfacing them on the vehicle profile too would be a
    // deliberate Vehicle schema change, not something to add silently here.
    ops.push(
      prisma.vehicle.update({
        where: { id: targetVehicleId },
        data: {
          ...(cleaned.plateNumber ? { plateNumber: cleaned.plateNumber } : {}),
          ...(cleaned.yearModel && /^\d{4}$/.test(cleaned.yearModel)
            ? { yearModel: parseInt(cleaned.yearModel, 10) }
            : {}),
        },
      }),
    );
  }

  const [updated] = await prisma.$transaction(ops);
  return toDisplay(updated);
}

// ============================================================
// getVehicleDocument — fetch one (for polling scan status / showing the
// review form)
// ============================================================
export async function getVehicleDocument(documentId: string): Promise<DisplayVehicleDocument> {
  const user = await requireUser();
  const doc = await prisma.vehicleDocument.findUnique({
    where: { id: documentId },
    include: { vehicle: { select: { ownerId: true } } },
  });
  if (!doc) throw new Error("Document not found");
  const authorized = doc.vehicleId ? doc.vehicle?.ownerId === user.id : doc.uploadedById === user.id;
  if (!authorized) throw new Error("Unauthorized");
  return toDisplay(doc);
}