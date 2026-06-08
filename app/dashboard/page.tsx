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

    case "OWNER":
    default:
      redirect("/dashboard/owner");
  }
}