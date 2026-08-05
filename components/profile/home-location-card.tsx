"use client";

import { useState, useEffect } from "react";
import { getHomeLocation, saveHomeLocation } from "@/app/actions/home-location";

export default function HomeLocationCard() {
  const [address, setAddress] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    getHomeLocation()
      .then((loc) => setAddress(loc?.address ?? null))
      .catch(() => setAddress(null))
      .finally(() => setLoading(false));
  }, []);

  function handleUpdate() {
    setError(null);
    setSaved(false);
    if (!navigator.geolocation) {
      setError("Your browser doesn't support location sharing.");
      return;
    }
    setUpdating(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude: lat, longitude: lng } = pos.coords;
        let resolvedAddress = `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
        try {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`
          );
          const geo = await res.json();
          resolvedAddress = geo.display_name ?? resolvedAddress;
        } catch {
          // Reverse geocoding is best-effort — raw coordinates still save fine.
        }
        try {
          await saveHomeLocation(lat, lng, resolvedAddress);
          setAddress(resolvedAddress);
          setSaved(true);
        } catch (e) {
          setError(e instanceof Error ? e.message : "Could not save location.");
        } finally {
          setUpdating(false);
        }
      },
      () => {
        setError("Location access was denied.");
        setUpdating(false);
      },
      { enableHighAccuracy: true, timeout: 20000 }
    );
  }

  return (
    <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-5">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-9 h-9 rounded-xl bg-amber-400/10 border border-amber-400/20
          flex items-center justify-center shrink-0">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M3 12l9-9 9 9M5 10v10a1 1 0 0 0 1 1h3v-6h6v6h3a1 1 0 0 0 1-1V10"
              stroke="#F59E0B" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <h3 className="text-sm font-semibold text-zinc-100">Home Address</h3>
      </div>

      {loading ? (
        <div className="flex items-center gap-2.5 py-2">
          <span className="w-4 h-4 rounded-full border-2 border-zinc-600 border-t-amber-400 animate-spin" />
          <p className="text-sm text-zinc-500">Loading…</p>
        </div>
      ) : address ? (
        <p className="text-xs text-zinc-400 leading-relaxed mb-3">{address}</p>
      ) : (
        <p className="text-xs text-zinc-500 leading-relaxed mb-3">
          No home address saved yet. Set one so future bookings can use it as a one-tap location option.
        </p>
      )}

      {saved && (
        <p className="text-xs text-emerald-400 mb-3 flex items-center gap-1.5">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M20 6L9 17l-5-5" stroke="#34D399" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Saved
        </p>
      )}
      {error && (
        <p className="text-xs text-orange-400 bg-orange-500/[0.07] rounded-lg px-3 py-2 mb-3">{error}</p>
      )}

      <button
        onClick={handleUpdate}
        disabled={updating || loading}
        className="w-full py-2.5 rounded-xl bg-white/[0.05] border border-white/[0.08]
          text-sm font-medium text-zinc-300 hover:bg-white/[0.08]
          active:scale-[0.98] transition-all disabled:opacity-50">
        {updating ? "Getting location…" : address ? "Update home address" : "Set home address"}
      </button>
    </div>
  );
}