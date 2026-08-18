import { NextRequest, NextResponse } from "next/server";
import { inspectVehicleParts } from "@/app/actions/inspection";

export async function POST(req: NextRequest) {
  const { dataUrl, vehicleId, bookingId } = await req.json();

  if (!dataUrl) {
    return NextResponse.json({ error: "Photo is required." }, { status: 400 });
  }

  try {
    const result = await inspectVehicleParts(dataUrl, { vehicleId, bookingId });
    return NextResponse.json({ result });
  } catch (err) {
    console.error("[inspect route error]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Photo analysis failed." },
      { status: 500 },
    );
  }
}