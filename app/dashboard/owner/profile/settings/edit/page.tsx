import { redirect } from "next/navigation";
import { auth }    from "@/lib/auth";
import { prisma }  from "@/lib/prisma";
import { headers } from "next/headers";
import { EditOwnerProfileForm } from "@/components/settings/EditOwnerProfileForm";

export default async function EditOwnerProfilePage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/signIn");

  const user = await prisma.user.findUnique({
    where:  { id: session.user.id },
    select: { name: true, phone: true },
  });
  if (!user) redirect("/signIn");

  return (
    <EditOwnerProfileForm
      initialName={user.name ?? ""}
      initialPhone={user.phone ?? ""}
    />
  );
}