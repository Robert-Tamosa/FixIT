import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";

export default async function DashboardPage() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    redirect("/signIn");
  }

  const user = await prisma.user.findUnique({
    where: {
      id: session.user.id,
    },
    select: {
      role: true,
    },
  });

  switch (user?.role) {
    case "ADMIN":
      redirect("/dashboard/admin");

    case "MECHANIC":
      redirect("/dashboard/mechanic");

    case "SHOP_OWNER": {
      const shop = await prisma.repairShop.findUnique({
        where: { ownerId: session.user.id },
        select: { verificationStatus: true },
      });
      if (!shop) redirect("/shop/register");
      if (shop.verificationStatus !== "APPROVED") redirect("/shop/pending");
      redirect("/dashboard/shop");
    }

    case "OWNER":
    default:
      redirect("/dashboard/owner");
  }
}