"use client";

import { authClient } from "@/lib/auth-client";
import { useRouter } from "next/navigation";
import { useState } from "react";

const SPECIALIZATIONS = [
  { value: "ENGINE_REPAIR", label: "Engine Repair",      icon: "🔧" },
  { value: "ELECTRICAL",    label: "Electrical Systems", icon: "⚡" },
  { value: "BRAKES",        label: "Brake Systems",      icon: "🛑" },
  { value: "TIRES",         label: "Tire Services",      icon: "🔄" },
  { value: "AIRCON",        label: "Air Conditioning",   icon: "❄️" },
  { value: "DIAGNOSTICS",   label: "Diagnostics",        icon: "🔍" },
] as const;

export function MechanicSignupForm() {
  const [fullName,        setFullName]        = useState("");
  const [email,           setEmail]           = useState("");
  const [phone,           setPhone]           = useState("");
  const [password,        setPassword]        = useState("");
  const [yearsExperience, setYearsExperience] = useState("");
  const [bio,             setBio]             = useState("");
  const [shopName,        setShopName]        = useState("");
  const [specializations, setSpecializations] = useState<string[]>([]);
  const [loading,         setLoading]         = useState(false);
  const [error,           setError]           = useState("");
  const router = useRouter();

  function toggleSpecialization(value: string) {
    setSpecializations((prev) =>
      prev.includes(value) ? prev.filter((s) => s !== value) : [...prev, value]
    );
  }

  const submit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (loading) return;
    setLoading(true);
    setError("");

    try {
      if (specializations.length === 0) {
        setError("Please select at least one specialization.");
        return;
      }

      const { error: signUpError } = await authClient.signUp.email({ name: fullName, email, password });
      if (signUpError) {
        setError(signUpError.message ?? "Could not create account. Try a different email.");
        return;
      }

      const { error: signInError } = await authClient.signIn.email({ email, password });
      if (signInError) {
        setError("Account created, but sign-in failed. Please try signing in manually.");
        return;
      }

      const session = await authClient.getSession();
      if (!session.data?.user.id) {
        setError("Could not verify your session. Please try signing in manually.");
        return;
      }

      const res = await fetch("/api/mechanic/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId:         session.data.user.id,
          yearsExperience,
          bio,
          specialization: specializations.join(","),
          shopName,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Could not complete registration. Please try again.");
        return;
      }

      router.push("/signIn");
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const inputCls = [
    "w-full px-4 py-[15px] rounded-2xl",
    "bg-white/[0.04] border border-white/[0.08]",
    "text-zinc-100 placeholder:text-zinc-600",
    "outline-none transition-all duration-200",
    "focus:border-amber-400/50 focus:bg-white/[0.06]",
  ].join(" ");

  return (
    <div className="w-full max-w-3xl mx-auto rounded-[32px] border border-white/[0.08]
      bg-white/[0.03] backdrop-blur-xl p-10 space-y-6">

      {/* Heading */}
      <div>
        <h1 className="text-4xl font-black text-zinc-100">
          Become a Fix<span className="text-amber-400">IT</span> Mechanic
        </h1>
        <p className="mt-3 text-zinc-500">
          Create your mechanic profile and start receiving vehicle service
          requests from customers.
        </p>
      </div>

      {/* Basic fields */}
      <div className="grid md:grid-cols-2 gap-4">
        <input className={inputCls} placeholder="Full Name"
          value={fullName} onChange={(e) => setFullName(e.target.value)} />
        <input className={inputCls} placeholder="Email"
          value={email} onChange={(e) => setEmail(e.target.value)} />
        <input className={inputCls} type="tel" placeholder="Phone Number"
          value={phone} onChange={(e) => setPhone(e.target.value)} />
        <input className={inputCls} type="password" placeholder="Password"
          value={password} onChange={(e) => setPassword(e.target.value)} />
        <input className={inputCls} type="number" placeholder="Years of Experience"
          value={yearsExperience} onChange={(e) => setYearsExperience(e.target.value)} />
        <input className={inputCls} type="text" placeholder="Shop Name (Optional)"
          value={shopName} onChange={(e) => setShopName(e.target.value)} />
      </div>

      {/* Bio */}
      <textarea
        className={`${inputCls} min-h-[140px] resize-none`}
        placeholder="Professional Bio"
        value={bio}
        onChange={(e) => setBio(e.target.value)}
      />

      {/* Specialization multi-select */}
      <div>
        <label className="block mb-2 text-sm text-zinc-400">
          Specialization
          <span className="ml-2 text-zinc-600 font-normal">(select all that apply)</span>
        </label>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2.5">
          {SPECIALIZATIONS.map(({ value, label, icon }) => {
            const selected = specializations.includes(value);
            return (
              <button
                key={value}
                type="button"
                onClick={() => toggleSpecialization(value)}
                className={[
                  "flex items-center gap-2.5 px-4 py-3 rounded-2xl border",
                  "text-sm font-medium text-left transition-all duration-150 active:scale-[0.97]",
                  selected
                    ? "bg-amber-400/10 border-amber-400/40 text-amber-300"
                    : "bg-white/[0.04] border-white/[0.08] text-zinc-500 hover:border-white/[0.18] hover:text-zinc-300",
                ].join(" ")}
              >
                <span className="text-base leading-none">{icon}</span>
                <span className="leading-tight flex-1">{label}</span>
                {selected && (
                  <svg className="shrink-0" width="14" height="14"
                    viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <path d="M20 6L9 17l-5-5" stroke="#F59E0B" strokeWidth="2.5"
                      strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </button>
            );
          })}
        </div>
        {specializations.length === 0 && (
          <p className="mt-2 text-xs text-zinc-600">
            Please select at least one specialization.
          </p>
        )}
      </div>

      {/* Government ID */}
      <div>
        <label className="block mb-2 text-sm text-zinc-400">Government ID</label>
        <label className="flex items-center justify-center w-full h-36 rounded-2xl
          border-2 border-dashed border-white/[0.08] bg-white/[0.02]
          cursor-pointer hover:border-amber-400/40 transition-all">
          <span className="text-zinc-500">Upload Government ID</span>
          <input type="file" className="hidden" />
        </label>
      </div>

      {/* Certification */}
      <div>
        <label className="block mb-2 text-sm text-zinc-400">Certification</label>
        <label className="flex items-center justify-center w-full h-36 rounded-2xl
          border-2 border-dashed border-white/[0.08] bg-white/[0.02]
          cursor-pointer hover:border-amber-400/40 transition-all">
          <span className="text-zinc-500">Upload Certification</span>
          <input type="file" className="hidden" />
        </label>
      </div>

      {/* Error */}
      {error && (
        <p className="flex items-center gap-2 text-sm text-red-400
          bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.6" />
            <path d="M12 8v4M12 16h.01" stroke="currentColor"
              strokeWidth="2" strokeLinecap="round" />
          </svg>
          {error}
        </p>
      )}

      {/* Submit */}
      <button
        onClick={submit}
        disabled={loading}
        className="w-full py-6 rounded-2xl bg-amber-400 hover:bg-amber-300
          !text-[#080909] font-bold text-base
          shadow-[0_4px_28px_rgba(245,158,11,0.22)]
          disabled:opacity-70 disabled:cursor-not-allowed
          active:scale-[0.99] transition-all duration-150
          flex items-center justify-center gap-3"
      >
        {loading ? (
          <>
            <svg className="animate-spin shrink-0" width="18" height="18"
              viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <circle cx="12" cy="12" r="10" stroke="#080909"
                strokeWidth="3" strokeOpacity="0.25" />
              <path d="M12 2a10 10 0 0 1 10 10" stroke="#080909"
                strokeWidth="3" strokeLinecap="round" />
            </svg>
            Registering…
          </>
        ) : (
          "Register as Mechanic"
        )}
      </button>
    </div>
  );
}