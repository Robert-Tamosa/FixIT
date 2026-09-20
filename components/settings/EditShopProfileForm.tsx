"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { updateShopProfile } from "@/app/actions/edit-profile";
import { SettingsPageShell } from "./SettingsPageShell";

export function EditShopProfileForm({
  initialName,
  initialEmail,
  initialPhone,
  initialAddress,
  initialDescription,
  initialServices,
}: {
  initialName:        string;
  initialEmail:       string;
  initialPhone:       string;
  initialAddress:     string;
  initialDescription: string;
  initialServices:    string[];
}) {
  const router = useRouter();
  const [name, setName]               = useState(initialName);
  const [email, setEmail]             = useState(initialEmail);
  const [phone, setPhone]             = useState(initialPhone);
  const [address, setAddress]         = useState(initialAddress);
  const [description, setDescription] = useState(initialDescription);
  const [services, setServices]       = useState<string[]>(initialServices);
  const [serviceInput, setServiceInput] = useState("");
  const [error, setError]     = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  function addService() {
    const trimmed = serviceInput.trim();
    if (!trimmed || services.includes(trimmed)) {
      setServiceInput("");
      return;
    }
    setServices([...services, trimmed]);
    setServiceInput("");
  }

  function removeService(s: string) {
    setServices(services.filter((x) => x !== s));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!name.trim())    { setError("Shop name can't be empty."); return; }
    if (!address.trim()) { setError("Address can't be empty.");   return; }

    setPending(true);
    try {
      await updateShopProfile({
        name:        name.trim(),
        email:       email.trim() || null,
        phone:       phone.trim() || null,
        address:     address.trim(),
        description: description.trim() || null,
        services,
      });
      router.push("/dashboard/shop/profile");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save — try again.");
      setPending(false);
    }
  }

  return (
    <SettingsPageShell title="Edit Shop Details" backHref="/dashboard/shop/profile">
      <form onSubmit={handleSubmit}
        className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-4 space-y-3">
        <div>
          <label className="text-xs text-zinc-500 mb-1.5 block">Shop Name</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            className="w-full rounded-xl bg-white/[0.04] border border-white/[0.08] px-3.5 py-2.5
              text-sm text-zinc-100 placeholder:text-zinc-600 outline-none focus:border-amber-400/40"
          />
        </div>
        <div>
          <label className="text-xs text-zinc-500 mb-1.5 block">Business Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-xl bg-white/[0.04] border border-white/[0.08] px-3.5 py-2.5
              text-sm text-zinc-100 placeholder:text-zinc-600 outline-none focus:border-amber-400/40"
          />
        </div>
        <div>
          <label className="text-xs text-zinc-500 mb-1.5 block">Business Phone</label>
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="09XX XXX XXXX"
            className="w-full rounded-xl bg-white/[0.04] border border-white/[0.08] px-3.5 py-2.5
              text-sm text-zinc-100 placeholder:text-zinc-600 outline-none focus:border-amber-400/40"
          />
        </div>
        <div>
          <label className="text-xs text-zinc-500 mb-1.5 block">Address</label>
          <input
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            required
            className="w-full rounded-xl bg-white/[0.04] border border-white/[0.08] px-3.5 py-2.5
              text-sm text-zinc-100 placeholder:text-zinc-600 outline-none focus:border-amber-400/40"
          />
        </div>
        <div>
          <label className="text-xs text-zinc-500 mb-1.5 block">Description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
            placeholder="What customers see on your shop's listing."
            className="w-full rounded-xl bg-white/[0.04] border border-white/[0.08] px-3.5 py-2.5
              text-sm text-zinc-100 placeholder:text-zinc-600 outline-none focus:border-amber-400/40 resize-none"
          />
        </div>

        {/* Services — chip list */}
        <div>
          <label className="text-xs text-zinc-500 mb-1.5 block">Services Offered</label>
          <div className="flex gap-2 mb-2">
            <input
              value={serviceInput}
              onChange={(e) => setServiceInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") { e.preventDefault(); addService(); }
              }}
              placeholder="e.g. Engine Repair"
              className="flex-1 rounded-xl bg-white/[0.04] border border-white/[0.08] px-3.5 py-2.5
                text-sm text-zinc-100 placeholder:text-zinc-600 outline-none focus:border-amber-400/40"
            />
            <button
              type="button"
              onClick={addService}
              className="px-4 rounded-xl bg-white/[0.06] border border-white/[0.08] text-zinc-300
                text-sm font-medium hover:bg-white/[0.09] transition-colors">
              Add
            </button>
          </div>
          {services.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {services.map((s) => (
                <span key={s}
                  className="flex items-center gap-1.5 text-xs font-medium text-amber-300
                    bg-amber-400/10 border border-amber-400/20 px-2.5 py-1.5 rounded-full">
                  {s}
                  <button
                    type="button"
                    onClick={() => removeService(s)}
                    aria-label={`Remove ${s}`}
                    className="text-amber-400/60 hover:text-amber-300">
                    ×
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>

        {error && <p className="text-xs text-orange-400">{error}</p>}

        <button
          type="submit"
          disabled={pending}
          className="w-full py-2.5 rounded-xl bg-amber-400 text-zinc-900 text-sm font-bold
            active:scale-[0.98] transition-all disabled:opacity-50">
          {pending ? "Saving…" : "Save Changes"}
        </button>
      </form>

      <p className="text-xs text-zinc-600 mt-4 leading-relaxed">
        Logo and operating hours aren't editable here yet.
      </p>
    </SettingsPageShell>
  );
}