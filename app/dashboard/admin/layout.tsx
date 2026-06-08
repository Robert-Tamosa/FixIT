import { auth }         from "@/lib/auth";
import { prisma }       from "@/lib/prisma";
import { headers }      from "next/headers";
import { redirect }     from "next/navigation";
import type { ReactNode } from "react";

export default async function AdminDashboardLayout({
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

  if (dbUser?.role !== "ADMIN") redirect("/dashboard/owner");

  return <>{children}</>;
}
