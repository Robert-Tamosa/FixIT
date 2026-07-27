import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function ShopPendingPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/signIn");

  const dbUser = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  });
  if (dbUser?.role !== "SHOP_OWNER") redirect("/signIn");

  const shop = await prisma.repairShop.findUnique({
    where: { ownerId: session.user.id },
    select: { name: true, verificationStatus: true },
  });

  if (!shop) redirect("/shop/register");
  if (shop.verificationStatus === "APPROVED") redirect("/dashboard/shop");

  const isRejected = shop.verificationStatus === "REJECTED";

  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center px-6">
      <div className="max-w-sm w-full text-center space-y-4">
        <div
          className={`mx-auto w-16 h-16 rounded-2xl flex items-center justify-center text-2xl
          ${isRejected ? "bg-orange-500/10" : "bg-amber-400/10 animate-pulse"}`}>
          {isRejected ? "✕" : "⏳"}
        </div>
        <h1 className="text-lg font-semibold text-zinc-100">
          {isRejected ? "Registration not approved" : "Your shop is under review"}
        </h1>
        <p className="text-sm text-zinc-500">
          {isRejected
            ? `${shop.name} was not approved. Please contact support or update your details and resubmit.`
            : `${shop.name} has been submitted and is awaiting admin verification. This usually takes 1–2 business days.`}
        </p>
      </div>
    </div>
  );
}