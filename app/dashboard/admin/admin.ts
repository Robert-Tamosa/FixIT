"use server";

import { auth }           from "@/lib/auth";
import { prisma }         from "@/lib/prisma";
import { headers }        from "next/headers";
import { revalidatePath } from "next/cache";

// ── Guard helper ──────────────────────────────────────────────────────────────

async function requireAdmin() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) throw new Error("Unauthorized");

  const dbUser = await prisma.user.findUnique({
    where:  { id: session.user.id },
    select: { role: true },
  });
  if (dbUser?.role !== "ADMIN") throw new Error("Forbidden");
  return session;
}

// ── Mechanic verification ─────────────────────────────────────────────────────

export async function approveMechanic(userId: string) {
  await requireAdmin();

  await prisma.mechanicProfile.update({
    where: { userId },
    data:  { verificationStatus: "APPROVED", isVerified: true },
  });

  revalidatePath("/dashboard/admin");
}

export async function rejectMechanic(userId: string) {
  await requireAdmin();

  await prisma.mechanicProfile.update({
    where: { userId },
    data:  { verificationStatus: "REJECTED", isVerified: false },
  });

  revalidatePath("/dashboard/admin");
}

// ── User role management ──────────────────────────────────────────────────────

export async function changeUserRole(
  userId: string,
  role: "OWNER" | "MECHANIC" | "ADMIN"
) {
  await requireAdmin();

  await prisma.user.update({
    where: { id: userId },
    data:  { role },
  });

  revalidatePath("/dashboard/admin");
}
