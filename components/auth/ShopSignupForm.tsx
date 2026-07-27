"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client"; // adjust to your actual Better Auth client import
import { finalizeShopSignup } from "@/app/actions/shop-auth";
import { createShop } from "@/app/actions/shop";

const SERVICE_OPTIONS = [
  "Engine Repair",
  "Transmission",
  "Electrical Systems",
  "Brakes & Suspension",
  "Tire Service",
  "Battery & Starting",
  "Cooling System",
  "General Mechanic",
];

type Step = "account" | "shop-details";

export function ShopSignupForm() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("account");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Step 1 — account fields
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");

  // Step 2 — shop fields
  const [shopName, setShopName] = useState("");
  const [address, setAddress] = useState("");
  const [shopPhone, setShopPhone] = useState("");
  const [services, setServices] = useState<string[]>([]);

  function toggleService(s: string) {
    setServices((prev) => (prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]));
  }

  async function handleCreateAccount() {
    if (!name || !email || !password) {
      setError("Please fill in all fields");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const { error: signUpError } = await authClient.signUp.email({ email, password, name });
      if (signUpError) {
        setError(signUpError.message ?? "Could not create account. Try a different email.");
        return;
      }
      await finalizeShopSignup();
      if (phone) {
        // If you store phone at signup elsewhere, wire it in here via a
        // dedicated updateProfile action — omitted since it's not yet built.
      }
      setStep("shop-details");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not create account");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCreateShop() {
    if (!shopName || !address || services.length === 0) {
      setError("Shop name, address, and at least one service are required");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await createShop({
        name: shopName,
        address,
        phone: shopPhone || undefined,
        services,
      });
      router.push("/shop/pending");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not register shop");
    } finally {
      setSubmitting(false);
    }
  }

  if (step === "account") {
    return (
      <div className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-zinc-100">Register your shop</h2>
          <p className="text-sm text-zinc-500 mt-1">Step 1 of 2 — create your business account</p>
        </div>

        <div className="space-y-3">
          <input
            placeholder="Your full name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-3 py-2.5 rounded-xl bg-white/[0.04] border border-white/[0.08]
              text-zinc-100 text-sm placeholder:text-zinc-600 outline-none focus:border-amber-400/50"
          />
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full px-3 py-2.5 rounded-xl bg-white/[0.04] border border-white/[0.08]
              text-zinc-100 text-sm placeholder:text-zinc-600 outline-none focus:border-amber-400/50"
          />
          <input
            type="tel"
            placeholder="Phone number"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="w-full px-3 py-2.5 rounded-xl bg-white/[0.04] border border-white/[0.08]
              text-zinc-100 text-sm placeholder:text-zinc-600 outline-none focus:border-amber-400/50"
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full px-3 py-2.5 rounded-xl bg-white/[0.04] border border-white/[0.08]
              text-zinc-100 text-sm placeholder:text-zinc-600 outline-none focus:border-amber-400/50"
          />
        </div>

        {error && <p className="text-xs text-orange-400 bg-orange-500/[0.07] rounded-lg px-3 py-2">{error}</p>}

        <button
          onClick={handleCreateAccount}
          disabled={submitting}
          className="w-full py-3 rounded-2xl bg-amber-400 text-zinc-900 text-sm font-medium
            active:scale-[0.98] transition-all disabled:opacity-50">
          {submitting ? "Creating account..." : "Continue"}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-zinc-100">Shop details</h2>
        <p className="text-sm text-zinc-500 mt-1">
          Step 2 of 2 — this will be reviewed by an admin before your shop goes live
        </p>
      </div>

      <div className="space-y-3">
        <input
          placeholder="Shop name"
          value={shopName}
          onChange={(e) => setShopName(e.target.value)}
          className="w-full px-3 py-2.5 rounded-xl bg-white/[0.04] border border-white/[0.08]
            text-zinc-100 text-sm placeholder:text-zinc-600 outline-none focus:border-amber-400/50"
        />
        <input
          placeholder="Shop address"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          className="w-full px-3 py-2.5 rounded-xl bg-white/[0.04] border border-white/[0.08]
            text-zinc-100 text-sm placeholder:text-zinc-600 outline-none focus:border-amber-400/50"
        />
        <input
          type="tel"
          placeholder="Shop phone (optional)"
          value={shopPhone}
          onChange={(e) => setShopPhone(e.target.value)}
          className="w-full px-3 py-2.5 rounded-xl bg-white/[0.04] border border-white/[0.08]
            text-zinc-100 text-sm placeholder:text-zinc-600 outline-none focus:border-amber-400/50"
        />
      </div>

      <div>
        <label className="text-xs text-zinc-400 mb-2 block">Services offered</label>
        <div className="flex flex-wrap gap-2">
          {SERVICE_OPTIONS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => toggleService(s)}
              className={`px-3 py-1.5 rounded-full text-xs border transition-all active:scale-[0.98] ${
                services.includes(s)
                  ? "bg-amber-400 text-zinc-900 border-amber-400"
                  : "bg-white/[0.04] text-zinc-400 border-white/[0.08]"
              }`}>
              {s}
            </button>
          ))}
        </div>
      </div>

      {error && <p className="text-xs text-orange-400 bg-orange-500/[0.07] rounded-lg px-3 py-2">{error}</p>}

      <button
        onClick={handleCreateShop}
        disabled={submitting}
        className="w-full py-3 rounded-2xl bg-amber-400 text-zinc-900 text-sm font-medium
          active:scale-[0.98] transition-all disabled:opacity-50">
        {submitting ? "Submitting..." : "Submit for review"}
      </button>
    </div>
  );
}