import { prisma } from "@/lib/prisma";
import { requireOwner } from "@/lib/auth-guard";
import { BottomNav } from "@/components/BottomNav";
import ProfileHeader from "@/components/profile/profile-header";
import VehicleSummaryCard from "@/components/profile/vehicle-summary-card";
import ContactInfoCard from "@/components/profile/contact-info-card";
import AccountStatusCard from "@/components/profile/account-status-card";
import SignOutButton from "@/components/SignOutButton";


export default async function OwnerProfilePage() {
  const session = await requireOwner();

  const vehicles = await prisma.vehicle.findMany({
    where: {
      ownerId: session.user.id,
    },
  });

  return (
    <div className="space-y-6 p-6 min-h-screen w-screen bg-[#080909] relative">
      <ProfileHeader user={session.user} />

      <div className="grid gap-6 lg:grid-cols-2">
        <VehicleSummaryCard vehicles={vehicles} />

        <AccountStatusCard
          emailVerified={session.user.emailVerified}
          twoFactorEnabled={session.user.twoFactorEnabled}
        />
      </div>

      <ContactInfoCard
        email={session.user.email ?? ""}
        phone={session.user.phone}
      />

      <SignOutButton/>

      <BottomNav/>
    </div>
  );
}