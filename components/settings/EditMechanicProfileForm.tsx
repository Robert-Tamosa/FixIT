"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { updateMechanicProfile } from "@/app/actions/edit-profile";
import { SettingsPageShell } from "./SettingsPageShell";

export function EditMechanicProfileForm({
  initialName,
  initialPhone,
  initialShopName,
  initialBio,
  initialSpecialization,
  initialYearsExperience,
}: {
  initialName:            string;
  initialPhone:           string;
  initialShopName:        string;
  initialBio:             string;
  initialSpecialization:  string;
  initialYearsExperience: number | null;
}) {
  const router = useRouter();
  const [name, setName]                 = useState(initialName);
  const [phone, setPhone]               = useState(initialPhone);
  const [shopName, setShopName]         = useState(initialShopName);
  const [bio, setBio]                   = useState(initialBio);
  const [specialization, setSpecialization] = useState(initialSpecialization);
  const [yearsExperience, setYearsExperience] = useState(
    initialYearsExperience !== null ? String(initialYearsExperience) : "",
  );
  const [error, setError]     = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!name.trim())           { setError("Name can't be empty.");           return; }
    if (!specialization.trim()) { setError("Specialization can't be empty."); return; }

    const parsedYears = yearsExperience.trim() === "" ? null : Number(yearsExperience);
    if (parsedYears !== null && (Number.isNaN(parsedYears) || parsedYears < 0)) {
      setError("Years of experience must be a positive number.");
      return;
    }

    setPending(true);
    try {
      await updateMechanicProfile({
        name:            name.trim(),
        phone:           phone.trim() || null,
        shopName:        shopName.trim() || null,
        bio:             bio.trim() || null,
        specialization:  specialization.trim(),
        yearsExperience: parsedYears,
      });
      router.push("/dashboard/mechanic/profile");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save — try again.");
      setPending(false);
    }
  }

  return (
    <SettingsPageShell title="Edit Profile" backHref="/dashboard/mechanic/profile">
      <form onSubmit={handleSubmit}
        className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-4 space-y-3">
        <div>
          <label className="text-xs text-zinc-500 mb-1.5 block">Name</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            className="w-full rounded-xl bg-white/[0.04] border border-white/[0.08] px-3.5 py-2.5
              text-sm text-zinc-100 placeholder:text-zinc-600 outline-none focus:border-amber-400/40"
          />
        </div>
        <div>
          <label className="text-xs text-zinc-500 mb-1.5 block">Phone</label>
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="09XX XXX XXXX"
            className="w-full rounded-xl bg-white/[0.04] border border-white/[0.08] px-3.5 py-2.5
              text-sm text-zinc-100 placeholder:text-zinc-600 outline-none focus:border-amber-400/40"
          />
        </div>
        <div>
          <label className="text-xs text-zinc-500 mb-1.5 block">
            Business / Shop Name <span className="text-zinc-700">(optional, independent mechanics only)</span>
          </label>
          <input
            value={shopName}
            onChange={(e) => setShopName(e.target.value)}
            className="w-full rounded-xl bg-white/[0.04] border border-white/[0.08] px-3.5 py-2.5
              text-sm text-zinc-100 placeholder:text-zinc-600 outline-none focus:border-amber-400/40"
          />
        </div>
        <div>
          <label className="text-xs text-zinc-500 mb-1.5 block">Specialization</label>
          <input
            value={specialization}
            onChange={(e) => setSpecialization(e.target.value)}
            required
            placeholder="e.g. Engine Repair, Electrical, Brakes"
            className="w-full rounded-xl bg-white/[0.04] border border-white/[0.08] px-3.5 py-2.5
              text-sm text-zinc-100 placeholder:text-zinc-600 outline-none focus:border-amber-400/40"
          />
        </div>
        <div>
          <label className="text-xs text-zinc-500 mb-1.5 block">Years of Experience</label>
          <input
            type="number"
            min={0}
            value={yearsExperience}
            onChange={(e) => setYearsExperience(e.target.value)}
            className="w-full rounded-xl bg-white/[0.04] border border-white/[0.08] px-3.5 py-2.5
              text-sm text-zinc-100 placeholder:text-zinc-600 outline-none focus:border-amber-400/40"
          />
        </div>
        <div>
          <label className="text-xs text-zinc-500 mb-1.5 block">Bio</label>
          <textarea
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            rows={4}
            placeholder="A short intro clients will see on your profile."
            className="w-full rounded-xl bg-white/[0.04] border border-white/[0.08] px-3.5 py-2.5
              text-sm text-zinc-100 placeholder:text-zinc-600 outline-none focus:border-amber-400/40 resize-none"
          />
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
        Email can't be changed here. Certification uploads and availability toggles live elsewhere on your profile.
      </p>
    </SettingsPageShell>
  );
}