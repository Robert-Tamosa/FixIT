"use client";

import {
  useState,
  useRef,
  useEffect,
  type KeyboardEvent,
  type ClipboardEvent,
  JSX,
} from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";

export default function VerifyOTPPage(): JSX.Element {
  const router = useRouter();

  const [digits, setDigits]               = useState<string[]>(Array(6).fill(""));
  const [error, setError]                 = useState<string>("");
  const [loading, setLoading]             = useState(false);
  const [resendTimer, setResendTimer]     = useState(0);
  const [resendLoading, setResendLoading] = useState(false);
  const [codeSent, setCodeSent]           = useState(false);

  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Request OTP as soon as the page loads
  useEffect(() => { void requestCode(); }, []);

  // Countdown timer for the Resend button
  useEffect(() => {
    if (resendTimer <= 0) return;
    const t = setInterval(() => setResendTimer((n) => n - 1), 1000);
    return () => clearInterval(t);
  }, [resendTimer]);

  // ── API calls via Better Auth ────────────────────────────────────────────

  async function requestCode(): Promise<void> {
    setResendLoading(true);
    setError("");

    // Better Auth sends the OTP automatically using the sendOTP function
    // you configured in lib/auth.ts (Twilio in production, console.log in dev)
    const { error } = await authClient.twoFactor.sendOtp();

    if (error) {
      setError(error.message ?? "Failed to send code. Please try again.");
    } else {
      setCodeSent(true);
      setResendTimer(60);
    }
    setResendLoading(false);
  }

  async function handleSubmit(): Promise<void> {
    const code = digits.join("");
    if (code.length !== 6) {
      setError("Please enter all 6 digits.");
      return;
    }

    setLoading(true);
    setError("");

    // Better Auth verifies the OTP and creates the full session on success
    const { error } = await authClient.twoFactor.verifyOtp({ code });

    if (error) {
      setError(error.message ?? "Invalid code. Please try again.");
      setDigits(Array(6).fill(""));
      setTimeout(() => inputRefs.current[0]?.focus(), 50);
    } else {
      // Session is created — redirect to the appropriate dashboard
      router.push("/dashboard");
    }
    setLoading(false);
  }

  // ── Input handlers ───────────────────────────────────────────────────────

  function handleChange(index: number, value: string): void {
    if (!/^\d?$/.test(value)) return;
    const next = [...digits];
    next[index] = value;
    setDigits(next);
    setError("");
    if (value && index < 5) inputRefs.current[index + 1]?.focus();
  }

  function handleKeyDown(index: number, e: KeyboardEvent<HTMLInputElement>): void {
    if (e.key === "Backspace" && !digits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
    if (e.key === "Enter") void handleSubmit();
  }

  function handlePaste(e: ClipboardEvent<HTMLDivElement>): void {
    e.preventDefault();
    const text = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (!text) return;
    const next = Array(6).fill("") as string[];
    text.split("").forEach((ch, i) => { next[i] = ch; });
    setDigits(next);
    inputRefs.current[Math.min(text.length, 5)]?.focus();
  }

  // ── Render ───────────────────────────────────────────────────────────────

  const codeComplete = digits.every(Boolean);

  const subtitle = resendLoading
    ? "Sending your verification code…"
    : codeSent
    ? "We've sent a 6-digit code to your registered phone number."
    : "Enter the code sent to your registered phone.";

  return (
    <div className="min-h-screen bg-[#0A0B0E] flex items-center justify-center p-6">
      <div className="w-full max-w-md bg-[#12141A] border border-white/[0.07] rounded-2xl px-9 py-11 flex flex-col items-center text-center">

        {/* ── Logo ── */}
        <div className="flex items-center gap-2 mb-8">
          <svg width="30" height="30" viewBox="0 0 30 30" fill="none" aria-hidden="true">
            <circle cx="15" cy="15" r="15" fill="#F59E0B" fillOpacity="0.12" />
            <path
              d="M15 7L8 10V15.5C8 19.8 11 23.8 15 25C19 23.8 22 19.8 22 15.5V10L15 7Z"
              fill="#F59E0B" fillOpacity="0.25"
              stroke="#F59E0B" strokeWidth="1.2" strokeLinejoin="round"
            />
            <path
              d="M11.5 15.5L14 18L19 13"
              stroke="#F59E0B" strokeWidth="1.5"
              strokeLinecap="round" strokeLinejoin="round"
            />
          </svg>
          <span className="text-[22px] font-bold tracking-tight text-zinc-100">
            Fix<span className="text-amber-400">IT</span>
          </span>
        </div>

        {/* ── Heading ── */}
        <h1 className="text-xl font-bold text-zinc-100 mb-2.5 tracking-tight">
          Two-step verification
        </h1>
        <p className="text-sm text-zinc-400 leading-relaxed mb-8 max-w-[17rem]">
          {subtitle}
        </p>

        {/* ── OTP Boxes ── */}
        <div
          className="flex gap-2.5 mb-5"
          onPaste={handlePaste}
          role="group"
          aria-label="One-time password input"
        >
          {digits.map((d, i) => (
            <input
              key={i}
              ref={(el) => { inputRefs.current[i] = el; }}
              type="text"
              inputMode="numeric"
              maxLength={1}
              value={d}
              autoFocus={i === 0}
              autoComplete="one-time-code"
              onChange={(e) => handleChange(i, e.target.value)}
              onKeyDown={(e) => handleKeyDown(i, e)}
              aria-label={`Digit ${i + 1} of 6`}
              className={[
                "w-12 h-[58px] rounded-xl border-[1.5px] outline-none",
                "text-center text-2xl font-bold font-mono text-zinc-100",
                "bg-[#1A1D26] transition-all duration-150",
                "focus:bg-[#1E2130] focus:border-amber-400",
                "focus:shadow-[0_0_0_3px_rgba(245,158,11,0.15)]",
                error
                  ? "border-orange-500/50 bg-orange-500/5"
                  : d
                  ? "border-amber-400/40"
                  : "border-white/10",
              ].join(" ")}
            />
          ))}
        </div>

        {/* ── Error ── */}
        {error && (
          <p role="alert" className="flex items-center gap-2 text-[13px] text-orange-400 mb-5">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true" className="shrink-0">
              <circle cx="8" cy="8" r="7" stroke="#FB923C" strokeWidth="1.3" />
              <path d="M8 5V8.5M8 11H8.01" stroke="#FB923C" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            {error}
          </p>
        )}

        {/* ── Submit ── */}
        <button
          onClick={() => void handleSubmit()}
          disabled={loading || !codeComplete}
          aria-busy={loading}
          className="w-full py-[14px] rounded-xl bg-amber-400 hover:bg-amber-300
            text-[#0A0B0E] font-semibold text-[15px] tracking-[0.1px]
            transition-all duration-150 active:scale-[0.98]
            disabled:opacity-40 disabled:cursor-not-allowed
            flex items-center justify-center gap-2 mb-5"
        >
          {loading ? (
            <span
              aria-hidden="true"
              className="w-[18px] h-[18px] rounded-full border-2 border-black/25 border-t-black animate-spin"
            />
          ) : (
            "Verify & continue"
          )}
        </button>

        {/* ── Resend ── */}
        <div className="flex items-center gap-2 text-[13px] mb-5">
          <span className="text-zinc-500">Didn&apos;t receive a code?</span>
          {resendTimer > 0 ? (
            <span className="text-zinc-400">Resend in {resendTimer}s</span>
          ) : (
            <button
              onClick={() => void requestCode()}
              disabled={resendLoading}
              className="text-amber-400 hover:text-amber-300 font-semibold
                underline underline-offset-2 transition-colors
                disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {resendLoading ? "Sending…" : "Resend code"}
            </button>
          )}
        </div>

        {/* ── Back link ── */}
        <a
          href="/signIn"
          className="text-[13px] text-zinc-600 hover:text-zinc-400 transition-colors"
        >
          ← Back to login
        </a>

      </div>
    </div>
  );
}
