interface Props {
  emailVerified: boolean;
  twoFactorEnabled: boolean;
}

export default function AccountStatusCard({
  emailVerified,
  twoFactorEnabled,
}: Props) {
  return (
    <div
      className="
rounded-3xl
border
border-zinc-800
bg-black/40
backdrop-blur-sm
">
      <h2 className="m-4 text-lg font-semibold text-white">Account Security</h2>

      <div className="mt-2 text-small font-semibold text-amber-400 ml-5">
        <p>Email Verified: {emailVerified ? "✅" : "❌"}</p>

        <p>2FA Enabled: {twoFactorEnabled ? "✅" : "❌"}</p>
      </div>
    </div>
  );
}
