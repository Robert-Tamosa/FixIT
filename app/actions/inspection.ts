"use server";

import { headers } from "next/headers";
import { auth } from "@/lib/auth"; // ASSUMPTION — adjust to your actual auth import path
import { prisma } from "@/lib/prisma"; // ASSUMPTION — adjust to your actual prisma import path
import { callGroqVision, assertReasonableImageSize } from "@/lib/groq-vision";

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

export type DisplayInspectionFlag = {
  id: string;
  vehicleId: string | null;
  bookingId: string | null;
  issueType: string;
  description: string;
  confidence: number;
  severity: string | null;
  mechanicReviewed: boolean;
  mechanicConfirmed: boolean | null;
  reviewNotes: string | null;
  createdAt: string;
};

function toDisplay(f: any): DisplayInspectionFlag {
  return {
    id: f.id,
    vehicleId: f.vehicleId,
    bookingId: f.bookingId,
    issueType: f.issueType,
    description: f.description,
    confidence: f.confidence,
    severity: f.severity,
    mechanicReviewed: f.mechanicReviewed,
    mechanicConfirmed: f.mechanicConfirmed,
    reviewNotes: f.reviewNotes,
    createdAt: f.createdAt.toISOString?.() ?? f.createdAt,
  };
}

// ============================================================
// The triage prompt — explicitly scoped to surface-visible issues only.
// Per spec: never diagnose internal/mechanical problems from a photo, and
// this is a triage aid for a mechanic to verify — NOT shown to the owner
// as a diagnosis. That "not shown as diagnosis" instruction is enforced by
// how the frontend presents this (see integration notes), not by the model
// itself — the model output alone can't guarantee how it gets displayed.
// ============================================================
const TRIAGE_PROMPT = `You are looking at a photo of part of a vehicle (car or motorcycle), submitted by the vehicle owner describing a possible problem.

Your ONLY job is to flag VISUALLY-CONFIRMABLE SURFACE issues that are clearly visible in this specific photo. Examples of what's in scope: dents, scratches, rust, cracked or broken external parts, visibly worn or damaged tires, visible fluid leaks/stains, broken lights or mirrors, damaged bodywork.

You must NOT diagnose or guess at internal, mechanical, or electrical problems that aren't directly visible in the photo — no engine issues, no brake problems, no transmission issues, no electrical faults, unless there is a directly visible external sign of it (e.g., a visible fluid leak, not "this might be a brake problem").

If you see no clear, visually-confirmable issue, return an empty array.

Respond with ONLY a JSON array, no markdown formatting, no explanation, no preamble — just the raw JSON array. Each element:

{
  "issueType": string,        // short slug, e.g. "dent", "rust", "cracked_part", "tire_wear", "fluid_leak"
  "description": string,      // one plain-language sentence describing exactly what's visible and where
  "confidence": number,       // 0.0 to 1.0
  "severity": "minor" | "moderate" | "needs_attention" | null
}`;

// ============================================================
// inspectVehicleParts — run triage on one photo, create one InspectionFlag
// row per issue found. Returns [] if nothing was flagged (not an error).
// ============================================================
export async function inspectVehicleParts(
  imageDataUrl: string,
  opts: { vehicleId?: string; bookingId?: string },
): Promise<DisplayInspectionFlag[]> {
  const user = await requireUser();
  assertReasonableImageSize(imageDataUrl);

  if (opts.vehicleId) {
    const vehicle = await prisma.vehicle.findUnique({
      where: { id: opts.vehicleId },
      select: { ownerId: true },
    });
    if (!vehicle || vehicle.ownerId !== user.id) throw new Error("Unauthorized");
  }
  if (opts.bookingId) {
    const booking = await prisma.booking.findUnique({
      where: { id: opts.bookingId },
      select: { ownerId: true },
    });
    if (!booking || booking.ownerId !== user.id) throw new Error("Unauthorized");
  }

  let results: Array<Record<string, unknown>>;
  try {
    const raw = await callGroqVision<unknown>(imageDataUrl, TRIAGE_PROMPT);
    results = Array.isArray(raw) ? (raw as Array<Record<string, unknown>>) : [];
  } catch (err) {
    // Triage failing shouldn't crash the chat — surface as an empty result
    // with the error visible to the caller via a thrown error the UI can
    // catch and show as "couldn't analyze this photo, try again."
    throw new Error(err instanceof Error ? err.message : "Photo analysis failed");
  }

  if (results.length === 0) return [];

  const created = await prisma.$transaction(
    results.map((r) =>
      prisma.inspectionFlag.create({
        data: {
          vehicleId: opts.vehicleId ?? null,
          bookingId: opts.bookingId ?? null,
          ownerId: user.id,
          image: imageDataUrl,
          issueType: typeof r.issueType === "string" ? r.issueType : "unspecified",
          description: typeof r.description === "string" ? r.description : "",
          confidence: typeof r.confidence === "number" ? r.confidence : 0,
          severity: typeof r.severity === "string" ? r.severity : null,
          rawResponse: r as any,
        },
      }),
    ),
  );

  return created.map(toDisplay);
}

// ============================================================
// getInspectionFlagsForVehicle — mechanic/shop-side review list
// ============================================================
export async function getInspectionFlagsForVehicle(vehicleId: string): Promise<DisplayInspectionFlag[]> {
  const user = await requireUser();
  // ASSUMPTION / open decision: review access is left broad here — any
  // MECHANIC or SHOP_OWNER can view flags for any vehicle, not just one
  // they're actively booked with. That may be too open once there's real
  // traffic (a mechanic browsing a stranger's flagged vehicle). Tightening
  // this to "only if you have an active/past booking with this vehicle" is
  // a one-line change (add a booking existence check below) — worth
  // deciding deliberately rather than defaulting silently either way.
  if (user.role !== "MECHANIC" && user.role !== "SHOP_OWNER" && user.role !== "ADMIN") {
    const vehicle = await prisma.vehicle.findUnique({ where: { id: vehicleId }, select: { ownerId: true } });
    if (vehicle?.ownerId !== user.id) throw new Error("Unauthorized");
  }
  const flags = await prisma.inspectionFlag.findMany({
    where: { vehicleId },
    orderBy: { createdAt: "desc" },
  });
  return flags.map(toDisplay);
}

// ============================================================
// reviewInspectionFlag — mechanic/shop signs off (confirm or dismiss)
// ============================================================
export async function reviewInspectionFlag(
  flagId: string,
  confirmed: boolean,
  notes?: string,
): Promise<DisplayInspectionFlag> {
  const user = await requireUser();
  if (user.role !== "MECHANIC" && user.role !== "SHOP_OWNER") throw new Error("Unauthorized");

  const flag = await prisma.inspectionFlag.findUnique({ where: { id: flagId } });
  if (!flag) throw new Error("Inspection flag not found");

  // If this flag is tied to a specific booking, restrict review to that
  // booking's mechanic/shop — see the open decision noted above for the
  // untied (bookingId === null) case, which stays open to any mechanic.
  if (flag.bookingId) {
    const booking = await prisma.booking.findUnique({
      where: { id: flag.bookingId },
      select: { mechanicId: true, shopId: true },
    });
    const isMechanic = user.role === "MECHANIC" && booking?.mechanicId === user.id;
    let isShopOwner = false;
    if (user.role === "SHOP_OWNER" && booking?.shopId) {
      const shop = await prisma.repairShop.findUnique({ where: { id: booking.shopId }, select: { ownerId: true } });
      isShopOwner = shop?.ownerId === user.id;
    }
    if (!isMechanic && !isShopOwner) throw new Error("Unauthorized");
  }

  const updated = await prisma.inspectionFlag.update({
    where: { id: flagId },
    data: {
      mechanicReviewed: true,
      mechanicConfirmed: confirmed,
      reviewedById: user.id,
      reviewedAt: new Date(),
      reviewNotes: notes ?? null,
    },
  });
  return toDisplay(updated);
}