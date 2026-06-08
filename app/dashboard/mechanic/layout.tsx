import { auth }              from "@/lib/auth";
import { prisma }            from "@/lib/prisma";
import { headers }           from "next/headers";
import { redirect }          from "next/navigation";
import type { ReactNode }    from "react";

export default async function MechanicDashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  const session = await auth.api.getSession({ headers: await headers() });

  // Not logged in
  if (!session) redirect("/signIn");

  // Read role from DB — Better Auth does not include custom fields in the session
  const dbUser = await prisma.user.findUnique({
    where:  { id: session.user.id },
    select: { role: true },
  });

  // Wrong role — owners and admins should not be here
  if (dbUser?.role !== "MECHANIC") redirect("/dashboard/owner");

  // Check verification status
  const profile = await prisma.mechanicProfile.findUnique({
    where:  { userId: session.user.id },
    select: { verificationStatus: true },
  });

  // No profile yet or not approved → hold on the pending page
  if (!profile || profile.verificationStatus !== "APPROVED") {
    redirect("/mechanic/pending");
  }

  return <>{children}</>;
}