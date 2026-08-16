"use server";

import { headers } from "next/headers";
import { auth } from "@/lib/auth"; // ASSUMPTION — adjust to your actual auth import path
import { prisma } from "@/lib/prisma"; // ASSUMPTION — adjust to your actual prisma import path

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

export type DirectWalletInfo = {
  accountName: string;
  qrImage: string;
  isBusiness: boolean | null;
};

export type MyDirectPaymentSetup = {
  gcash: DirectWalletInfo | null;
  maya: DirectWalletInfo | null;
};

function toInfo(qrImage: string | null, accountName: string | null, isBusiness: boolean | null): DirectWalletInfo | null {
  if (!qrImage || !accountName) return null;
  return { accountName, qrImage, isBusiness };
}

// ============================================================
// getMyDirectPaymentSetup — fetch the current mechanic's or shop's own
// saved QR/account info, for their own settings screen.
// ============================================================
export async function getMyDirectPaymentSetup(): Promise<MyDirectPaymentSetup> {
  const user = await requireUser();

  if (user.role === "MECHANIC") {
    const profile = await prisma.mechanicProfile.findUnique({
      where: { userId: user.id },
      select: {
        gcashQrImage: true, gcashAccountName: true, gcashIsBusiness: true,
        mayaQrImage: true, mayaAccountName: true, mayaIsBusiness: true,
      },
    });
    return {
      gcash: toInfo(profile?.gcashQrImage ?? null, profile?.gcashAccountName ?? null, profile?.gcashIsBusiness ?? null),
      maya: toInfo(profile?.mayaQrImage ?? null, profile?.mayaAccountName ?? null, profile?.mayaIsBusiness ?? null),
    };
  }

  if (user.role === "SHOP_OWNER") {
    const shop = await prisma.repairShop.findUnique({
      where: { ownerId: user.id },
      select: {
        gcashQrImage: true, gcashAccountName: true, gcashIsBusiness: true,
        mayaQrImage: true, mayaAccountName: true, mayaIsBusiness: true,
      },
    });
    return {
      gcash: toInfo(shop?.gcashQrImage ?? null, shop?.gcashAccountName ?? null, shop?.gcashIsBusiness ?? null),
      maya: toInfo(shop?.mayaQrImage ?? null, shop?.mayaAccountName ?? null, shop?.mayaIsBusiness ?? null),
    };
  }

  throw new Error("Only mechanics and shops can have a direct payment setup");
}

// ============================================================
// saveDirectPaymentQr — upload/replace the QR for one provider.
// ============================================================
export async function saveDirectPaymentQr(
  provider: "gcash" | "maya",
  qrImageDataUrl: string,
  accountName: string,
  isBusiness: boolean,
): Promise<void> {
  const user = await requireUser();
  if (!accountName.trim()) throw new Error("Account name is required");

  const data =
    provider === "gcash"
      ? { gcashQrImage: qrImageDataUrl, gcashAccountName: accountName.trim(), gcashIsBusiness: isBusiness }
      : { mayaQrImage: qrImageDataUrl, mayaAccountName: accountName.trim(), mayaIsBusiness: isBusiness };

  if (user.role === "MECHANIC") {
    await prisma.mechanicProfile.update({ where: { userId: user.id }, data });
    return;
  }
  if (user.role === "SHOP_OWNER") {
    await prisma.repairShop.update({ where: { ownerId: user.id }, data });
    return;
  }
  throw new Error("Only mechanics and shops can set up direct payment");
}

// ============================================================
// removeDirectPaymentQr — clear one provider's setup (e.g. QR expired,
// account changed, or they want to stop offering this option).
// ============================================================
export async function removeDirectPaymentQr(provider: "gcash" | "maya"): Promise<void> {
  const user = await requireUser();

  const data =
    provider === "gcash"
      ? { gcashQrImage: null, gcashAccountName: null, gcashIsBusiness: null }
      : { mayaQrImage: null, mayaAccountName: null, mayaIsBusiness: null };

  if (user.role === "MECHANIC") {
    await prisma.mechanicProfile.update({ where: { userId: user.id }, data });
    return;
  }
  if (user.role === "SHOP_OWNER") {
    await prisma.repairShop.update({ where: { ownerId: user.id }, data });
    return;
  }
  throw new Error("Only mechanics and shops can manage direct payment setup");
}