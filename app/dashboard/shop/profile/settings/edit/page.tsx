import { redirect } from "next/navigation";
import { auth }    from "@/lib/auth";
import { prisma }  from "@/lib/prisma";
import { headers } from "next/headers";
import { EditShopProfileForm } from "@/components/settings/EditShopProfileForm";

export default async function EditShopProfilePage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/signIn");

  const shop = await prisma.repairShop.findUnique({
    where:  { ownerId: session.user.id },
    select: {
      name:        true,
      email:       true,
      phone:       true,
      address:     true,
      description: true,
      services:    true,
    },
  });
  if (!shop) redirect("/dashboard/shop/profile");

  return (
    <EditShopProfileForm
      initialName={shop.name}
      initialEmail={shop.email ?? ""}
      initialPhone={shop.phone ?? ""}
      initialAddress={shop.address}
      initialDescription={shop.description ?? ""}
      initialServices={shop.services}
    />
  );
}