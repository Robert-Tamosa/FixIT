interface Props {
  email: string;
  phone?: string | null;
}

export default function ContactInfoCard({ email, phone }: Props) {
  return (
    <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-5">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-9 h-9 rounded-xl bg-amber-400/10 border border-amber-400/20
          flex items-center justify-center shrink-0">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"
              stroke="#F59E0B" strokeWidth="1.6" />
            <path d="M22 6l-10 7L2 6" stroke="#F59E0B" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
        </div>
        <h3 className="text-sm font-semibold text-zinc-100">Contact Information</h3>
      </div>

      <div className="space-y-2.5">
        <div className="flex items-center gap-2.5">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"
              stroke="#71717A" strokeWidth="1.5" />
            <path d="M22 6l-10 7L2 6" stroke="#71717A" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          <span className="text-sm text-zinc-400">{email}</span>
        </div>
        <div className="flex items-center gap-2.5">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.63 3.4 2 2 0 0 1 3.6 1.22h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.9a16 16 0 0 0 6 6l.95-.96a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"
              stroke="#71717A" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          <span className="text-sm text-zinc-400">{phone || "Not provided"}</span>
        </div>
      </div>
    </div>
  );
}