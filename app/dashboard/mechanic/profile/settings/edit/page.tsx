import { redirect } from "next/navigation";
import { auth }    from "@/lib/auth";
import { prisma }  from "@/lib/prisma";
import { headers } from "next/headers";
import { EditMechanicProfileForm } from "@/components/settings/EditMechanicProfileForm";

export default async function EditMechanicProfilePage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/signIn");

  const user = await prisma.user.findUnique({
    where:  { id: session.user.id },
    select: {
      name:  true,
      phone: true,
      mechanicProfile: {
        select: {
          shopName:        true,
          bio:             true,
          specialization:  true,
          yearsExperience: true,
        },
      },
    },
  });
  if (!user) redirect("/signIn");

  return (
    <EditMechanicProfileForm
      initialName={user.name ?? ""}
      initialPhone={user.phone ?? ""}
      initialShopName={user.mechanicProfile?.shopName ?? ""}
      initialBio={user.mechanicProfile?.bio ?? ""}
      initialSpecialization={user.mechanicProfile?.specialization ?? ""}
      initialYearsExperience={user.mechanicProfile?.yearsExperience ?? null}
    />
  );
}