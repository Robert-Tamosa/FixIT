"use client";

import { useState, useEffect } from "react";
import {
  getShopMockMechanics,
  createShopMechanic,
  setMockMechanicAvailability,
  removeMockMechanic,
  findIndependentMechanicByEmail,
  inviteMechanicToShop,
  getPendingShopInvitations,
  getShopRealMechanics,
  removeMechanicFromShop,
  type DisplayMockMechanic,
  type DisplayInviteCandidate,
  type DisplayShopInvitation,
} from "@/app/actions/shop-dashboard";
import { BottomNav } from "../_shop-dashboard";

export default function ShopMechanicsPage() {
  // ── Mock roster ────────────────────────────────────────────────────────
  const [mechanics, setMechanics] = useState<DisplayMockMechanic[] | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [specialization, setSpecialization] = useState("");
  const [phone, setPhone] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ── Real mechanics (joined + pending) ─────────────────────────────────
  const [realMechanics, setRealMechanics] = useState<
    { userId: string; name: string; specialization: string; isAvailable: boolean }[] | null
  >(null);
  const [pendingInvites, setPendingInvites] = useState<DisplayShopInvitation[] | null>(null);
  const [showInviteForm, setShowInviteForm] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [candidate, setCandidate] = useState<DisplayInviteCandidate | null>(null);
  const [inviteSearching, setInviteSearching] = useState(false);
  const [inviteSubmitting, setInviteSubmitting] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);

  async function loadAll() {
    const [mock, real, pending] = await Promise.all([
      getShopMockMechanics(),
      getShopRealMechanics(),
      getPendingShopInvitations(),
    ]);
    setMechanics(mock);
    setRealMechanics(real);
    setPendingInvites(pending);
  }

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Mock mechanic handlers ─────────────────────────────────────────────

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !specialization.trim()) {
      setError("Name and specialization are required.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await createShopMechanic({
        name: name.trim(),
        specialization: specialization.trim(),
        phone: phone.trim() || undefined,
      });
      setName("");
      setSpecialization("");
      setPhone("");
      setShowForm(false);
      await loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add mechanic");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleToggleAvailability(id: string, current: boolean) {
    await setMockMechanicAvailability(id, !current);
    await loadAll();
  }

  async function handleRemove(id: string) {
    if (!confirm("Remove this mechanic from your roster? Bookings already assigned to them keep showing their name.")) return;
    await removeMockMechanic(id);
    await loadAll();
  }

  // ── Real mechanic invite handlers ──────────────────────────────────────

  async function handleSearch() {
    if (!inviteEmail.trim()) return;
    setInviteSearching(true);
    setInviteError(null);
    setCandidate(null);
    try {
      const found = await findIndependentMechanicByEmail(inviteEmail.trim());
      if (!found) {
        setInviteError("No independent, verified mechanic found with that email.");
      } else {
        setCandidate(found);
      }
    } catch (err) {
      setInviteError(err instanceof Error ? err.message : "Search failed");
    } finally {
      setInviteSearching(false);
    }
  }

  async function handleInvite() {
    if (!candidate) return;
    setInviteSubmitting(true);
    setInviteError(null);
    try {
      await inviteMechanicToShop(candidate.userId);
      setCandidate(null);
      setInviteEmail("");
      setShowInviteForm(false);
      await loadAll();
    } catch (err) {
      setInviteError(err instanceof Error ? err.message : "Could not send invitation");
    } finally {
      setInviteSubmitting(false);
    }
  }

  async function handleRemoveReal(userId: string) {
    if (!confirm("Remove this mechanic from your shop? They'll become independent again.")) return;
    await removeMechanicFromShop(userId);
    await loadAll();
  }

  return (
    <div className="min-h-screen bg-[#080909]">
      <div className="max-w-full mx-auto px-6 py-8 pb-28 space-y-8">

        {/* ── Real mechanics ──────────────────────────────────────────── */}
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h1 className="text-lg font-semibold text-zinc-100">Invited Mechanics</h1>
              <p className="text-sm text-zinc-500 mt-0.5">
                Independent mechanics with their own accounts, invited to join your shop.
              </p>
            </div>
            <button
              onClick={() => { setShowInviteForm((v) => !v); setCandidate(null); setInviteError(null); }}
              className="shrink-0 text-xs text-zinc-900 bg-amber-400 px-3 py-2 rounded-xl font-medium
                active:scale-[0.98] transition-all"
            >
              {showInviteForm ? "Cancel" : "+ Invite Mechanic"}
            </button>
          </div>

          {showInviteForm && (
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4 space-y-3">
              <div className="flex gap-2">
                <input
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => { setInviteEmail(e.target.value); setCandidate(null); }}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleSearch(); } }}
                  placeholder="Mechanic's email address"
                  className="flex-1 px-3 py-2.5 rounded-xl bg-zinc-800/60 border border-zinc-700
                    text-zinc-100 text-sm placeholder:text-zinc-600 outline-none focus:border-amber-400/50"
                />
                <button
                  onClick={handleSearch}
                  disabled={inviteSearching || !inviteEmail.trim()}
                  className="px-4 rounded-xl bg-white/[0.06] border border-white/[0.08] text-zinc-300
                    text-sm font-medium disabled:opacity-40"
                >
                  {inviteSearching ? "…" : "Search"}
                </button>
              </div>

              {inviteError && (
                <p className="text-xs text-orange-400 bg-orange-500/[0.07] rounded-lg px-3 py-2">{inviteError}</p>
              )}

              {candidate && (
                <div className="rounded-xl border border-amber-400/20 bg-amber-400/[0.05] p-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-zinc-100">{candidate.name}</p>
                    <p className="text-xs text-zinc-500 mt-0.5">
                      {candidate.specialization}
                      {candidate.yearsExperience != null ? ` · ${candidate.yearsExperience} yrs exp` : ""}
                    </p>
                  </div>
                  <button
                    onClick={handleInvite}
                    disabled={inviteSubmitting}
                    className="shrink-0 text-xs text-zinc-900 bg-amber-400 px-3 py-2 rounded-lg font-medium
                      active:scale-[0.98] transition-all disabled:opacity-50"
                  >
                    {inviteSubmitting ? "Sending…" : "Send Invitation"}
                  </button>
                </div>
              )}
            </div>
          )}

          {pendingInvites && pendingInvites.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs text-zinc-600 font-medium uppercase tracking-wide">Pending</p>
              {pendingInvites.map((inv) => (
                <div key={inv.id} className="rounded-xl border border-zinc-800 bg-zinc-900/40 px-4 py-3
                  flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm text-zinc-300">{inv.mechanicName}</p>
                    <p className="text-xs text-zinc-600 mt-0.5">{inv.mechanicEmail} · sent {inv.createdAt}</p>
                  </div>
                  <span className="shrink-0 text-[10px] text-amber-400 bg-amber-400/10 border border-amber-400/20
                    px-2 py-1 rounded-full">Awaiting response</span>
                </div>
              ))}
            </div>
          )}

          {realMechanics && realMechanics.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs text-zinc-600 font-medium uppercase tracking-wide">Joined</p>
              {realMechanics.map((m) => (
                <div key={m.userId} className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4
                  flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-zinc-100">{m.name}</p>
                    <p className="text-xs text-zinc-500 mt-0.5">{m.specialization}</p>
                  </div>
                  <button
                    onClick={() => handleRemoveReal(m.userId)}
                    className="shrink-0 text-xs text-red-400 font-medium"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          )}

          {realMechanics && realMechanics.length === 0 && pendingInvites && pendingInvites.length === 0 && !showInviteForm && (
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6 text-center">
              <p className="text-sm text-zinc-500">No invited mechanics yet.</p>
            </div>
          )}
        </div>

        {/* ── Mock roster ─────────────────────────────────────────────── */}
        <div className="space-y-4 pt-2 border-t border-zinc-800">
          <div className="flex items-center justify-between gap-3 pt-4">
            <div>
              <h2 className="text-lg font-semibold text-zinc-100">Mechanic Roster</h2>
              <p className="text-sm text-zinc-500 mt-0.5">
                Staff you can assign to bookings — no account or login required.
              </p>
            </div>
            <button
              onClick={() => setShowForm((v) => !v)}
              className="shrink-0 text-xs text-zinc-900 bg-amber-400 px-3 py-2 rounded-xl font-medium
                active:scale-[0.98] transition-all"
            >
              {showForm ? "Cancel" : "+ Add Mechanic"}
            </button>
          </div>

          {showForm && (
            <form onSubmit={handleCreate}
              className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4 space-y-3">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Name"
                className="w-full px-3 py-2.5 rounded-xl bg-zinc-800/60 border border-zinc-700
                  text-zinc-100 text-sm placeholder:text-zinc-600 outline-none focus:border-amber-400/50"
              />
              <input
                value={specialization}
                onChange={(e) => setSpecialization(e.target.value)}
                placeholder="Specialization (e.g. Engine Repair)"
                className="w-full px-3 py-2.5 rounded-xl bg-zinc-800/60 border border-zinc-700
                  text-zinc-100 text-sm placeholder:text-zinc-600 outline-none focus:border-amber-400/50"
              />
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="Phone (optional)"
                className="w-full px-3 py-2.5 rounded-xl bg-zinc-800/60 border border-zinc-700
                  text-zinc-100 text-sm placeholder:text-zinc-600 outline-none focus:border-amber-400/50"
              />

              {error && (
                <p className="text-xs text-orange-400 bg-orange-500/[0.07] rounded-lg px-3 py-2">{error}</p>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="w-full py-2.5 rounded-xl bg-amber-400 text-zinc-900 text-sm font-bold
                  active:scale-[0.98] transition-all disabled:opacity-50"
              >
                {submitting ? "Adding…" : "Add to Roster"}
              </button>
            </form>
          )}

          {mechanics === null ? (
            <p className="text-sm text-zinc-500 py-8 text-center">Loading…</p>
          ) : mechanics.length === 0 ? (
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6 text-center">
              <p className="text-sm text-zinc-500">No mechanics in your roster yet.</p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {mechanics.map((m) => (
                <div key={m.id}
                  className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4
                    flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-zinc-100">{m.name}</p>
                    <p className="text-xs text-zinc-500 mt-0.5">
                      {m.specialization}{m.phone ? ` · ${m.phone}` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => handleToggleAvailability(m.id, m.isAvailable)}
                      className={`text-[10px] px-2 py-1 rounded-full border transition-colors ${
                        m.isAvailable
                          ? "text-emerald-400 bg-emerald-400/10 border-emerald-400/20"
                          : "text-zinc-500 bg-zinc-800/40 border-zinc-800"
                      }`}
                    >
                      {m.isAvailable ? "Available" : "Unavailable"}
                    </button>
                    <button
                      onClick={() => handleRemove(m.id)}
                      className="text-xs text-red-400 font-medium"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
      <BottomNav />
    </div>
  );
}