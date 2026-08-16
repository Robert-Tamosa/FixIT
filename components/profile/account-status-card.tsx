interface Props {
  emailVerified: boolean;
  twoFactorEnabled: boolean;
}

export default function AccountStatusCard({
  emailVerified,
  twoFactorEnabled,
}: Props) {
  return (
    <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-5">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-9 h-9 rounded-xl bg-amber-400/10 border border-amber-400/20
          flex items-center justify-center shrink-0">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"
              stroke="#F59E0B" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <h3 className="text-sm font-semibold text-zinc-100">Account Security</h3>
      </div>

      <div className="space-y-2.5">
        <div className="flex items-center justify-between">
          <span className="text-xs text-zinc-500">Email Verified</span>
          <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-full border ${
            emailVerified
              ? "text-emerald-400 bg-emerald-400/10 border-emerald-400/20"
              : "text-zinc-500 bg-zinc-800 border-zinc-700"
          }`}>
            {emailVerified ? "Verified" : "Unverified"}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-xs text-zinc-500">2FA</span>
          <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-full border ${
            twoFactorEnabled
              ? "text-emerald-400 bg-emerald-400/10 border-emerald-400/20"
              : "text-zinc-500 bg-zinc-800 border-zinc-700"
          }`}>
            {twoFactorEnabled ? "Enabled" : "Disabled"}
          </span>
        </div>
      </div>
    </div>
  );
}