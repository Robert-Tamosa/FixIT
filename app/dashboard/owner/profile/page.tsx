import { prisma } from "@/lib/prisma";
import { requireOwner } from "@/lib/auth-guard";
import OwnerProfileView from "./_owner-profile";  
import { AIDiagnosticChathead } from "../_dashboard";

export default async function OwnerProfilePage() {
  const session = await requireOwner();

  const vehicles = await prisma.vehicle.findMany({
    where: {
      ownerId: session.user.id,
    },
  });

  return (
    <>
      <OwnerProfileView
        name={session.user.name}
        email={session.user.email ?? ""}
        phone={session.user.phone}
        image={session.user.image ?? null}
        emailVerified={session.user.emailVerified}
        twoFactorEnabled={session.user.twoFactorEnabled}
        vehicles={vehicles}
      />
      <AIDiagnosticChathead />
    </>
  );
}