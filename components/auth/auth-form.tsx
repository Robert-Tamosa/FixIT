"use client";

import { useState } from "react";
import Link from "next/link";
import { authClient } from "@/lib/auth-client";
import { useRouter } from "next/navigation";

interface AuthFormProps {
  mode: "signin" | "signup";
}

export function AuthForm({ mode }: AuthFormProps) {
  // ── moved to top (was declared after submit — hoisting bug) ───────────────
  const isSignUp = mode === "signup";

  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState("");
  const router = useRouter();

  // ── Social auth (unchanged logic) ─────────────────────────────────────────
  const handleSocialAuth = async (provider: "google" | "facebook") => {
    try {
      setLoading(true);
      setError("");
      await authClient.signIn.social({ provider, callbackURL: "/dashboard" });
    } catch {
      setError(`Failed to authenticate with ${provider}. Please try again.`);
    } finally {
      setLoading(false);
    }
  };

  // ── Email submit (fixed twoFactorRedirect path + error display) ───────────
  const submit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (loading) return;
    setLoading(true);
    setError("");

    try {
      if (isSignUp) {
        const { error } = await authClient.signUp.email({
          email,
          password,
          name: fullName,
        });
        if (error) { setError(error.message ?? "Sign up failed."); return; }
        router.push("/signIn");
        return;
      }

      const { error } = await authClient.signIn.email(
        { email, password },
        {
          async onSuccess(context) {
            // fixed: was /two-factor
            if (context.data.twoFactorRedirect) {
              router.push("/verify-otp");
            } else {
              router.push("/dashboard");
            }
          },
        }
      );

      if (error) setError(error.message ?? "Incorrect email or password.");
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // ── Shared input className ─────────────────────────────────────────────────
  const inputCls = [
    "w-full px-4 py-[15px] rounded-2xl text-[15px]",
    "bg-white/[0.04] border border-white/[0.08]",
    "text-zinc-100 placeholder:text-zinc-600",
    "outline-none transition-all duration-200",
    "focus:border-amber-400/50 focus:bg-white/[0.06]",
    "focus:shadow-[0_0_0_3px_rgba(245,158,11,0.07)]",
  ].join(" ");

  return (
    <div className="relative min-h-screen bg-[#080909] flex flex-col overflow-hidden">

        <nav className="relative z-20 w-full border-b border-white/[0.06] bg-[#080909]/80 backdrop-blur-xl">
  <div className="max-w-7xl mx-auto px-8 h-20 flex items-center justify-between">

    {/* Logo */}
    <Link href="/" className="flex items-center gap-3">
      <div
        className="w-10 h-10 rounded-xl bg-amber-400/10
        border border-amber-400/20 flex items-center justify-center"
      >
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
          <path
            d="M10 2L4 4.5V10.5C4 14.7 6.8 18.5 10 19.5C13.2 18.5 16 14.7 16 10.5V4.5L10 2Z"
            fill="#F59E0B"
            fillOpacity="0.2"
            stroke="#F59E0B"
            strokeWidth="1.2"
          />
          <path
            d="M7.5 10.5L9.5 12.5L13.5 8.5"
            stroke="#F59E0B"
            strokeWidth="1.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>

      <span className="text-3xl font-black text-zinc-100">
        Fix<span className="text-amber-400">IT</span>
      </span>
    </Link>

    {/* navigation */}
    <div className="flex items-center gap-3">
      <Link
        href="/signIn"
        className={`px-6 py-2.5 rounded-xl font-semibold transition-all ${
          !isSignUp
            ? "bg-amber-400 text-[#080909]"
            : "text-zinc-400 hover:text-zinc-100"
        }`}
      >
        Sign In
      </Link>

      <Link
        href="/signUp"
        className={`px-6 py-2.5 rounded-xl font-semibold transition-all ${
          isSignUp
            ? "bg-amber-400 text-[#080909]"
            : "text-zinc-400 hover:text-zinc-100"
        }`}
      >
        Sign Up
      </Link>
    </div>

  </div>
</nav>

      {/* ── Ambient background ──────────────────────────────────────────────── */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        {/* Top amber glow */}
        <div className="absolute -top-32 left-1/2 -translate-x-1/2 w-[500px] h-[400px]
          bg-amber-400/[0.04] rounded-full blur-[90px]" />
        {/* Dot grid */}
        <div className="absolute inset-0 opacity-[0.018]"
          style={{
            backgroundImage: "radial-gradient(circle, #F59E0B 1px, transparent 1px)",
            backgroundSize: "28px 28px",
          }} />
      </div>

      {/* ── Main content ────────────────────────────────────────────────────── */}
      <div className="relative z-10 flex items-center justify-center flex-1 w-full px-6">
        <div className="w-full max-w-md">
        

        {/* ── Heading ───────────────────────────────────────────────────────── */}
        <div className="mb-7">
          <h1 className="text-[26px] font-black text-zinc-100 tracking-tight leading-tight">
            {isSignUp ? "Create your\naccount" : "Welcome\nback"}
          </h1>
          <p className="text-sm text-zinc-500 mt-2 leading-relaxed">
            {isSignUp
              ? "Join FixIT to diagnose your vehicle and book mechanics"
              : "Sign in to manage your vehicles and service bookings"}
          </p>
        </div>

        {/* ── Form ──────────────────────────────────────────────────────────── */}
        <form onSubmit={submit} className="flex flex-col gap-3">

          {isSignUp && (
            <input
              type="text"
              placeholder="Full name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              autoComplete="name"
              className={inputCls}
            />
          )}

          <input
            type="email"
            placeholder="Email address"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            className={inputCls}
          />

          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => { setPassword(e.target.value); setError(""); }}
            autoComplete={isSignUp ? "new-password" : "current-password"}
            className={inputCls}
          />

          {/* Error message — was missing in the original */}
          {error && (
            <div className="flex items-start gap-2.5 px-4 py-3 rounded-xl
              bg-orange-500/[0.07] border border-orange-500/[0.15]">
              <svg width="15" height="15" viewBox="0 0 16 16" fill="none"
                className="shrink-0 mt-[1px]" aria-hidden="true">
                <circle cx="8" cy="8" r="7" stroke="#FB923C" strokeWidth="1.2" />
                <path d="M8 5V8.5M8 11H8.01" stroke="#FB923C" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
              <p className="text-[13px] text-orange-300 leading-snug">{error}</p>
            </div>
          )}

          {/* CTA button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-[15px] mt-1 rounded-2xl
              bg-amber-400 hover:bg-amber-300 active:scale-[0.97]
              text-[#080909] font-bold text-[15px] tracking-[0.1px]
              transition-all duration-150 disabled:opacity-40 disabled:cursor-not-allowed
              flex items-center justify-center gap-2
              shadow-[0_4px_28px_rgba(245,158,11,0.22)]"
          >
            {loading ? (
              <span aria-hidden="true"
                className="w-5 h-5 rounded-full border-2 border-black/20 border-t-black animate-spin" />
            ) : isSignUp ? "Create Account" : "Sign In"}
          </button>
        </form>

        {/* ── Divider ───────────────────────────────────────────────────────── */}
        <div className="flex items-center gap-3 my-6">
          <div className="flex-1 h-px bg-white/[0.06]" />
          <span className="text-xs text-zinc-600 font-medium tracking-wide uppercase">or</span>
          <div className="flex-1 h-px bg-white/[0.06]" />
        </div>

        {/* ── Social buttons ────────────────────────────────────────────────── */}
        <div className="flex flex-col gap-3">

          <button
            type="button"
            onClick={() => handleSocialAuth("google")}
            disabled={loading}
            className="w-full py-[13px] rounded-2xl
              border border-white/[0.08] bg-white/[0.03]
              text-zinc-200 font-medium text-sm
              flex items-center justify-center gap-3
              hover:bg-white/[0.06] hover:border-white/[0.13]
              active:scale-[0.98] transition-all disabled:opacity-40"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            Continue with Google
          </button>

          <button
            type="button"
            onClick={() => handleSocialAuth("facebook")}
            disabled={loading}
            className="w-full py-[13px] rounded-2xl
              border border-white/[0.08] bg-white/[0.03]
              text-zinc-200 font-medium text-sm
              flex items-center justify-center gap-3
              hover:bg-white/[0.06] hover:border-white/[0.13]
              active:scale-[0.98] transition-all disabled:opacity-40"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" fill="#1877F2"/>
            </svg>
            Continue with Facebook
          </button>

        </div>

        {/* ── Mechanic / shop link ──────────────────────────────────────────── */}
        <p className="text-center text-xs text-zinc-600 mt-8 pb-10">
          Are you a mechanic or shop?{" "}
          <Link href="/mechanicSignUp"
            className="text-amber-400/70 hover:text-amber-400 transition-colors font-medium">
            Register here
          </Link>
        </p>

      </div>
      </div>
    </div>
  );
}