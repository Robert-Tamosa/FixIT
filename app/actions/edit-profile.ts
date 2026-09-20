"use server";

import { auth }           from "@/lib/auth";
import { prisma }         from "@/lib/prisma";
import { headers }        from "next/headers";
import { revalidatePath } from "next/cache";

// Duck-typed Prisma error check instead of `instanceof Prisma.
// PrismaClientKnownRequestError` — in Prisma 7 that class lives on the
// generated client's own output path, not @prisma/client, and that path
// isn't known from here. .code is stable on the thrown object regardless
// of which class it's an instance of.
function isUniqueConstraintError(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code?: unknown }).code === "P2002"
  );
}

// ── Owner ────────────────────────────────────────────────────────────────────

export async function updateOwnerProfile(data: { name: string; phone: string | null }) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) throw new Error("Not authenticated.");
  if (!data.name.trim()) throw new Error("Name can't be empty.");

  try {
    await prisma.user.update({
      where: { id: session.user.id },
      data: {
        name:  data.name.trim(),
        phone: data.phone?.trim() || null,
      },
    });
  } catch (err) {
    if (isUniqueConstraintError(err)) {
      throw new Error("That phone number is already linked to another account.");
    }
    throw err;
  }

  revalidatePath("/dashboard/owner/profile");
}

// ── Mechanic ─────────────────────────────────────────────────────────────────
// Touches both User (name/phone) and MechanicProfile (shopName/bio/
// specialization/yearsExperience) — kept as one transaction so a failure
// partway through can't leave the two out of sync.

export async function updateMechanicProfile(data: {
  name:            string;
  phone:           string | null;
  shopName:        string | null;
  bio:             string | null;
  specialization:  string;
  yearsExperience: number | null;
}) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) throw new Error("Not authenticated.");
  if (!data.name.trim())           throw new Error("Name can't be empty.");
  if (!data.specialization.trim()) throw new Error("Specialization can't be empty.");

  try {
    await prisma.$transaction([
      prisma.user.update({
        where: { id: session.user.id },
        data: {
          name:  data.name.trim(),
          phone: data.phone?.trim() || null,
        },
      }),
      prisma.mechanicProfile.update({
        where: { userId: session.user.id },
        data: {
          shopName:        data.shopName?.trim() || null,
          bio:             data.bio?.trim() || null,
          specialization:  data.specialization.trim(),
          yearsExperience: data.yearsExperience,
        },
      }),
    ]);
  } catch (err) {
    if (isUniqueConstraintError(err)) {
      throw new Error("That phone number is already linked to another account.");
    }
    throw err;
  }

  revalidatePath("/dashboard/mechanic/profile");
}

// ── Shop ─────────────────────────────────────────────────────────────────────
// RepairShop.email/phone aren't unique-constrained (only User.phone and
// User.email are), so no collision handling needed here.

export async function updateShopProfile(data: {
  name:        string;
  email:       string | null;
  phone:       string | null;
  address:     string;
  description: string | null;
  services:    string[];
}) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) throw new Error("Not authenticated.");
  if (!data.name.trim())    throw new Error("Shop name can't be empty.");
  if (!data.address.trim()) throw new Error("Address can't be empty.");

  const shop = await prisma.repairShop.findUnique({
    where:  { ownerId: session.user.id },
    select: { id: true },
  });
  if (!shop) throw new Error("No shop found for this account.");

  await prisma.repairShop.update({
    where: { id: shop.id },
    data: {
      name:        data.name.trim(),
      email:       data.email?.trim() || null,
      phone:       data.phone?.trim() || null,
      address:     data.address.trim(),
      description: data.description?.trim() || null,
      services:    data.services.map((s) => s.trim()).filter(Boolean),
    },
  });

  revalidatePath("/dashboard/shop/profile");
}