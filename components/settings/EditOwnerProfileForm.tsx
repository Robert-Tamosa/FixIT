"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { updateOwnerProfile } from "@/app/actions/edit-profile";
import { SettingsPageShell } from "./SettingsPageShell";

export function EditOwnerProfileForm({
  initialName,
  initialPhone,
}: {
  initialName:  string;
  initialPhone: string;
}) {
  const router = useRouter();
  const [name, setName]       = useState(initialName);
  const [phone, setPhone]     = useState(initialPhone);
  const [error, setError]     = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError("Name can't be empty.");
      return;
    }

    setPending(true);
    try {
      await updateOwnerProfile({ name: name.trim(), phone: phone.trim() || null });
      router.push("/dashboard/owner/profile");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save — try again.");
      setPending(false);
    }
  }

  return (
    <SettingsPageShell title="Edit Profile" backHref="/dashboard/owner/profile">
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
        Email can't be changed here. Home location has its own editor on your profile page.
      </p>
    </SettingsPageShell>
  );
}