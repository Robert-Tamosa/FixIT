import { auth }    from "@/lib/auth";
import { prisma }  from "@/lib/prisma";
import { headers }  from "next/headers";
import { redirect } from "next/navigation";
import SignOutButton from "@/components/SignOutButton";

export default async function MechanicPendingPage() {
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session) redirect("/signIn");

  // Read role from DB — Better Auth does not include custom fields in the session
  const dbUser = await prisma.user.findUnique({
    where:  { id: session.user.id },
    select: { role: true, name: true },
  });

  if (dbUser?.role !== "MECHANIC") redirect("/dashboard/owner");

  const profile = await prisma.mechanicProfile.findUnique({
    where:  { userId: session.user.id },
    select: { verificationStatus: true, shopName: true, specialization: true },
  });

  // Already approved — send to mechanic dashboard
  if (profile?.verificationStatus === "APPROVED") {
    redirect("/dashboard/mechanic");
  }

  const isRejected = profile?.verificationStatus === "REJECTED";
  const name       = (dbUser?.name ?? session.user.name ?? "there").split(" ")[0];

  return (
    <div className="min-h-screen bg-[#080909] flex flex-col items-center justify-center p-6 relative overflow-hidden">

      {/* Ambient glow */}
      <div aria-hidden="true" className="pointer-events-none fixed inset-0">
        <div className={[
          "absolute -top-32 left-1/2 -translate-x-1/2 w-[500px] h-[400px] rounded-full blur-[100px]",
          isRejected ? "bg-red-500/[0.05]" : "bg-amber-400/[0.04]",
        ].join(" ")} />
      </div>

      <div className="relative z-10 w-full max-w-sm flex flex-col items-center text-center">

        {/* Logo */}
        <div className="flex items-center gap-2.5 mb-12">
          <div className="w-9 h-9 rounded-xl bg-amber-400/10 border border-amber-400/20
            flex items-center justify-center">
            <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden="true">
              <path d="M10 2L4 4.5V10.5C4 14.7 6.8 18.5 10 19.5C13.2 18.5 16 14.7 16 10.5V4.5L10 2Z"
                fill="#F59E0B" fillOpacity="0.2" stroke="#F59E0B" strokeWidth="1.2" />
              <path d="M7.5 10.5L9.5 12.5L13.5 8.5" stroke="#F59E0B" strokeWidth="1.4"
                strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <span className="text-[26px] font-black tracking-tight text-zinc-100 leading-none">
            Fix<span className="text-amber-400">IT</span>
          </span>
        </div>

        {/* Status icon */}
        <div className={[
          "w-20 h-20 rounded-3xl flex items-center justify-center mb-6 border",
          isRejected
            ? "bg-red-500/10   border-red-500/20"
            : "bg-amber-400/10 border-amber-400/20",
        ].join(" ")}>
          {isRejected ? (
            // X icon
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <circle cx="12" cy="12" r="10"
                fill="#EF4444" fillOpacity="0.15" stroke="#EF4444" strokeWidth="1.2" />
              <path d="M15 9L9 15M9 9l6 6"
                stroke="#EF4444" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          ) : (
            // Clock / hourglass icon
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <circle cx="12" cy="12" r="10"
                fill="#F59E0B" fillOpacity="0.15" stroke="#F59E0B" strokeWidth="1.2" />
              <path d="M12 6v6l3.5 3.5"
                stroke="#F59E0B" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
        </div>

        {/* Heading */}
        <h1 className="text-[22px] font-black text-zinc-100 tracking-tight mb-3">
          {isRejected ? "Application Not Approved" : "Account Under Review"}
        </h1>

        {/* Description */}
        <p className="text-sm text-zinc-400 leading-relaxed mb-6 max-w-xs">
          {isRejected
            ? `Hi ${name}, unfortunately your mechanic application was not approved. Please contact support for more information or to reapply.`
            : `Hi ${name}, your application is being reviewed by our admin team. This usually takes 1–2 business days. We'll notify you once your account is approved.`}
        </p>

        {/* Shop / specialization info */}
        {profile?.shopName && (
          <div className="w-full bg-white/[0.03] border border-white/[0.07] rounded-2xl
            px-4 py-3.5 flex items-center gap-3 mb-6 text-left">
            <div className="w-9 h-9 rounded-xl bg-white/[0.05] border border-white/[0.08]
              flex items-center justify-center shrink-0">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"
                  stroke="#71717A" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-zinc-100 truncate">{profile.shopName}</p>
              {profile.specialization && (
                <p className="text-xs text-zinc-500 truncate">{profile.specialization}</p>
              )}
            </div>
          </div>
        )}

        {/* Status badge */}
        <div className={[
          "flex items-center gap-2 px-4 py-2 rounded-xl border mb-8 text-sm font-semibold",
          isRejected
            ? "bg-red-500/10   border-red-500/20   text-red-400"
            : "bg-amber-400/10 border-amber-400/20 text-amber-400",
        ].join(" ")}>
          <span className={[
            "w-2 h-2 rounded-full",
            isRejected ? "bg-red-400" : "bg-amber-400 animate-pulse",
          ].join(" ")} />
          {isRejected ? "Application Rejected" : "Pending Approval"}
        </div>

        {/* Actions */}
        <div className="w-full flex flex-col gap-3">
          {isRejected && (
            <a
              href="mailto:support@fixit.com"
              className="w-full py-3.5 rounded-2xl border border-white/[0.08] bg-white/[0.03]
                text-zinc-200 font-medium text-sm text-center
                hover:bg-white/[0.06] transition-colors"
            >
              Contact Support
            </a>
          )}

          {/* Uses the existing SignOutButton component */}
          <SignOutButton />
        </div>

      </div>
    </div>
  );
}
