import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  const body = await req.json();
  const { userId, yearsExperience, bio, specialization, shopName } = body;

  if (!userId) {
    return NextResponse.json({ error: "Missing userId" }, { status: 400 });
  }

  const existingProfile = await prisma.mechanicProfile.findUnique({ where: { userId } });
  if (existingProfile) {
    return NextResponse.json({ error: "Mechanic profile already exists" }, { status: 400 });
  }

  const parsedYears = Number(yearsExperience);
  if (!specialization || Number.isNaN(parsedYears)) {
    return NextResponse.json(
      { error: "Missing or invalid specialization/yearsExperience" },
      { status: 400 },
    );
  }

  try {
    // Atomic: either both writes succeed, or neither does. Prevents a User
    // ending up with role: MECHANIC but no matching MechanicProfile if the
    // second write fails for any reason.
    await prisma.$transaction([
      prisma.user.update({
        where: { id: userId },
        data: { role: "MECHANIC" },
      }),
      prisma.mechanicProfile.create({
        data: {
          userId,
          yearsExperience: parsedYears,
          bio,
          specialization,
          shopName,
        },
      }),
    ]);
  } catch (err) {
    console.error("[mechanic/register] transaction failed:", err);
    return NextResponse.json(
      { error: "Could not complete mechanic registration. Please try again." },
      { status: 500 },
    );
  }

  return NextResponse.json({ success: true });
}