import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  const body = await req.json();

  const { userId, yearsExperience, bio, specialization, shopName } = body;

  if (!userId) {
    return NextResponse.json({ error: "Missing userId" }, { status: 400 });
  }

  await prisma.user.update({
    where: {
      id: userId,
    },
    data: {
      role: "MECHANIC",
    },
  });

  const existingProfile = await prisma.mechanicProfile.findUnique({
  where: {
    userId,
  },
});

if (existingProfile) {
  return Response.json(
    { error: "Mechanic profile already exists" },
    { status: 400 }
  );
}

await prisma.mechanicProfile.create({
  data: {
    userId,
    yearsExperience: Number(yearsExperience),
    bio,
    specialization,
    shopName,
  },
});

  return NextResponse.json({
    success: true,
  });
}
