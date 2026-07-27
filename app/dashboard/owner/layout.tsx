import { auth }           from "@/lib/auth";
import { prisma }         from "@/lib/prisma";
import { headers }        from "next/headers";
import { redirect }       from "next/navigation";
import type { ReactNode } from "react";

export default async function OwnerDashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session) redirect("/signIn");

  const dbUser = await prisma.user.findUnique({
    where:  { id: session.user.id },
    select: { role: true },
  });

  // Only OWNER accounts belong here. Everyone else gets routed to their own
  // dashboard instead of silently being allowed to view the owner view.
  switch (dbUser?.role) {
    case "OWNER":
      break; // allowed through
    case "MECHANIC":
      redirect("/dashboard/mechanic");
    case "ADMIN":
      redirect("/dashboard/admin");
    case "SHOP_OWNER":
      redirect("/dashboard/shop");
    default:
      // Unexpected/missing role for an authenticated session — don't redirect
      // to /signIn here, since that risks a loop if the sign-in page bounces
      // authenticated users back toward /dashboard. Surface an error instead.
      throw new Error("Could not determine account role. Please contact support.");
  }

  return <>{children}</>;
}