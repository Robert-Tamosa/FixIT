"use client";

import { useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { authClient } from "@/lib/auth-client";

function CheckEmailContent() {
  const searchParams = useSearchParams();
  const email = searchParams.get("email") ?? "";

  const [resent, setResent]   = useState(false);
  const [error, setError]     = useState("");
  const [loading, setLoading] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  async function handleResend() {
    if (!email || cooldown > 0) return;
    setLoading(true);
    setError("");
    setResent(false);

    const { error } = await authClient.sendVerificationEmail({
      email,
      callbackURL: "/dashboard",
    });

    if (error) {
      setError(error.message ?? "Couldn't resend — try again.");
    } else {
      setResent(true);
      setCooldown(60);
      const t = setInterval(() => {
        setCooldown((n) => {
          if (n <= 1) { clearInterval(t); return 0; }
          return n - 1;
        });
      }, 1000);
    }
    setLoading(false);
  }

  return (
    <div className="min-h-screen bg-[#080909] flex items-center justify-center p-6">
      <div className="w-full max-w-md bg-white/[0.03] border border-white/[0.08] rounded-2xl px-9 py-11 flex flex-col items-center text-center">

        <div className="w-14 h-14 rounded-2xl bg-amber-400/10 border border-amber-400/20
          flex items-center justify-center mb-6">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"
              stroke="#F59E0B" strokeWidth="1.5" />
            <path d="M22 6l-10 7L2 6" stroke="#F59E0B" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </div>

        <h1 className="text-xl font-black text-zinc-100 mb-2.5 tracking-tight">
          Verify your email
        </h1>
        <p className="text-sm text-zinc-500 leading-relaxed mb-1 max-w-[18rem]">
          We sent a verification link to
        </p>
        <p className="text-sm font-semibold text-amber-400 mb-6 break-all">
          {email || "your email address"}
        </p>
        <p className="text-xs text-zinc-600 leading-relaxed mb-7 max-w-[20rem]">
          Click the link in that email to activate your account, then come back
          and sign in. If you don't see it, check your spam folder.
        </p>

        {error && (
          <p role="alert" className="flex items-center gap-2 text-[13px] text-orange-400 mb-5">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true" className="shrink-0">
              <circle cx="8" cy="8" r="7" stroke="#FB923C" strokeWidth="1.3" />
              <path d="M8 5V8.5M8 11H8.01" stroke="#FB923C" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            {error}
          </p>
        )}
        {resent && !error && (
          <p className="text-[13px] text-emerald-400 mb-5">Verification email resent.</p>
        )}

        <button
          onClick={handleResend}
          disabled={loading || cooldown > 0 || !email}
          className="w-full py-[13px] rounded-xl border border-white/[0.08] bg-white/[0.03]
            text-zinc-200 font-medium text-sm hover:bg-white/[0.06] transition-colors
            disabled:opacity-40 disabled:cursor-not-allowed mb-4"
        >
          {loading
            ? "Sending…"
            : cooldown > 0
            ? `Resend in ${cooldown}s`
            : "Resend verification email"}
        </button>

        <a href="/signIn" className="text-[13px] text-zinc-600 hover:text-zinc-400 transition-colors">
          ← Back to sign in
        </a>

      </div>
    </div>
  );
}

// useSearchParams() requires a Suspense boundary in the App Router — this
// wrapper is the whole reason this file isn't just the component above.
export default function CheckEmailPage() {
  return (
    <Suspense fallback={null}>
      <CheckEmailContent />
    </Suspense>
  );
}