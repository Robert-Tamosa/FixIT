"use server";

import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

/**
 * Better Auth's signUp always creates a user with the default Role (OWNER).
 * Call this immediately after signUp completes on the client, before the
 * account has any real data attached, to promote it to SHOP_OWNER.
 *
 * Guarded to only run once per account (only flips OWNER -> SHOP_OWNER),
 * so it can't be used to privilege-escalate an existing account later.
 */
export async function finalizeShopSignup() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) throw new Error("Unauthorized");

  const dbUser = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  });
  if (!dbUser) throw new Error("Unauthorized");
  if (dbUser.role !== "OWNER") {
    throw new Error("This account has already been set up — role cannot be changed here");
  }

  await prisma.user.update({
    where: { id: session.user.id },
    data: { role: "SHOP_OWNER" },
  });

  return { success: true };
}