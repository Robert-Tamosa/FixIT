"use client";

import { useState, useEffect } from "react";
import { createBooking } from "@/app/actions/booking";
import { getVehicles, type FetchedVehicle } from "@/app/actions/get-vehicles";
import type { DisplayMechanic } from "./_dashboard";

// ── Props ─────────────────────────────────────────────────────────────────────

interface BookingModalProps {
  isOpen: boolean;
  onClose: () => void;
  mechanics: DisplayMechanic[];
  preSelectedMechanicId?: string | null;
}

// ── Step labels (matches the Book a Service flow diagram) ──────────────────────
// 1 Select Vehicle → 2 Describe Problem → 3 Date & Time → 4 Share Location →
// 5 Browse & Select Mechanic (or Any Available) → 6 Review & Confirm (submits
// as a PENDING booking request — everything after this point, e.g. estimate
// review/accept-decline/tracking/invoice, happens in separate screens once
// the mechanic/shop responds).

const STEP_TITLES = [
  "Select your vehicle",
  "Describe the problem",
  "Preferred date & time",
  "Share your location",
  "Choose a mechanic",
  "Review & confirm",
];
const TOTAL_STEPS = STEP_TITLES.length;

// ── Location capture ─────────────────────────────────────────────────────────

interface CapturedLocation {
  lat: number;
  lng: number;
  address: string;
}

// ── Browsable targets (step 5) ──────────────────────────────────────────────
// Mechanics come in as props (already fetched for the dashboard). Shops are
// fetched fresh from /api/shops/search, mirroring the same result shape as
// /api/mechanics/search (see route.ts comments) so they can render as the
// same card type with a `kind` discriminator.

interface ShopSearchResult {
  id: string;
  kind: "shop";
  name: string;
  initials: string;
  specialization: string;
  rating: number;
  reviews: number;
  available: boolean;
  availableMechanicCount: number;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function BookingModal({
  isOpen,
  onClose,
  mechanics = [],
  preSelectedMechanicId = null,
}: BookingModalProps) {
  const [vehicles, setVehicles] = useState<FetchedVehicle[]>([]);
  const [vehiclesLoading, setVehiclesLoading] = useState(false);
  const [step, setStep] = useState(1);
  const [vehicleId, setVehicleId] = useState("");
  const [problem, setProblem] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");

  // Step 4: location
  const [location, setLocation] = useState<CapturedLocation | null>(null);
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState("");

  // Step 5: mechanic — either a specific one, or "any available"
  const [mechanicId, setMechanicId] = useState("");
  const [anyAvailable, setAnyAvailable] = useState(false);

  // Step 5: shops — fetched fresh when the step opens, mutually exclusive
  // with picking an individual mechanic or "Any Available"
  const [shopId, setShopId] = useState("");
  const [shops, setShops] = useState<ShopSearchResult[]>([]);
  const [shopsLoading, setShopsLoading] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Fetch fresh vehicles every time the modal opens
  useEffect(() => {
    if (!isOpen) return;
    setVehiclesLoading(true);
    getVehicles()
      .then(setVehicles)
      .finally(() => setVehiclesLoading(false));
    if (preSelectedMechanicId) {
      setMechanicId(preSelectedMechanicId);
      setAnyAvailable(false);
    }
  }, [isOpen, preSelectedMechanicId]);

  // Fetch shops once the owner reaches the mechanic/shop step — no point
  // fetching earlier since they might close the modal before getting there.
  useEffect(() => {
    if (!isOpen || step !== 5 || shops.length > 0 || shopsLoading) return;
    setShopsLoading(true);
    fetch("/api/shops/search")
      .then((res) => res.json())
      .then((data: { results?: ShopSearchResult[] }) => setShops(data.results ?? []))
      .catch(() => setShops([]))
      .finally(() => setShopsLoading(false));
  }, [isOpen, step, shops.length, shopsLoading]);

  if (!isOpen) return null;

  // ── Helpers ────────────────────────────────────────────────────────────────

  function reset() {
    setStep(1);
    setVehicleId("");
    setProblem("");
    setScheduledAt("");
    setLocation(null);
    setLocationError("");
    setMechanicId("");
    setAnyAvailable(false);
    setShopId("");
    setShops([]);
    setError("");
    setLoading(false);
  }

  function handleClose() {
    reset();
    onClose();
  }

  function requestLocation() {
    setLocationError("");
    if (!navigator.geolocation) {
      setLocationError("Your browser doesn't support location sharing.");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude: lat, longitude: lng } = pos.coords;
        let address = `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
        try {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`
          );
          const geo = await res.json();
          address = geo.display_name ?? address;
        } catch {
          // Reverse geocoding is best-effort — raw coordinates are still a
          // valid location if the lookup fails.
        }
        setLocation({ lat, lng, address });
        setLocating(false);
      },
      () => {
        setLocationError("Location access was denied. You can still continue, but the mechanic won't have your address.");
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  function next() {
    setError("");
    if (step === 1 && !vehicleId) {
      setError("Please select a vehicle.");
      return;
    }
    if (step === 2 && !problem.trim()) {
      setError("Please describe the problem.");
      return;
    }
    if (step === 3 && !scheduledAt) {
      setError("Please pick a date & time.");
      return;
    }
    if (step === 4 && !location) {
      setError("Please share your location so a mechanic can find you.");
      return;
    }
    if (step === 5 && !anyAvailable && !mechanicId && !shopId) {
      setError('Select a mechanic or shop, or choose "Any Available Mechanic".');
      return;
    }
    setStep((s) => s + 1);
  }

  function back() {
    setError("");
    setStep((s) => s - 1);
  }

  async function handleConfirm() {
    setLoading(true);
    setError("");
    try {
      await createBooking({
        vehicleId,
        mechanicId: shopId ? null : (anyAvailable ? null : mechanicId),
        shopId: shopId || null,
        problemDescription: problem,
        scheduledAt: scheduledAt,
        ownerLat: location!.lat,
        ownerLng: location!.lng,
        address: location!.address,
      });
      reset();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  // ── Derived display values ─────────────────────────────────────────────────

  const selectedVehicle = vehicles.find((v) => v.id === vehicleId);
  const selectedMechanic = mechanics.find((m) => m.id === mechanicId);
  const selectedShop = shops.find((s) => s.id === shopId);
  const availableMechanics = mechanics.filter((m) => m.available);

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
        onClick={handleClose}
        aria-hidden="true"
      />

      {/* Bottom sheet */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Book a service"
        className="
        fixed
        bottom-50
        left-0
        right-0
        z-[100]
        max-h-[85dvh]
        overflow-y-auto
        bg-[#111318]
        border-t
        border-white/[0.08]
        rounded-t-3xl
        max-w-2xl
        mx-auto
    ">
        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-white/[0.12]" />
        </div>

        <div className="px-5 pb-10 pt-2">
          {/* ── Header ── */}
          <div className="flex items-center justify-between mb-5">
            <div>
              <p className="text-[11px] text-zinc-500 mb-0.5 uppercase tracking-wider font-medium">
                Step {step} of {TOTAL_STEPS}
              </p>
              <h2 className="text-[18px] font-bold text-zinc-100 leading-tight">
                {STEP_TITLES[step - 1]}
              </h2>
            </div>
            <button
              onClick={handleClose}
              aria-label="Close"
              className="w-8 h-8 rounded-xl bg-white/[0.05] border border-white/[0.08]
                flex items-center justify-center hover:bg-white/[0.1] transition-colors">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M18 6L6 18M6 6l12 12" stroke="#71717A" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </button>
          </div>

          {/* ── Progress bar ── */}
          <div className="flex gap-1.5 mb-6">
            {Array.from({ length: TOTAL_STEPS }, (_, i) => i + 1).map((s) => (
              <div
                key={s}
                className={[
                  "h-1 flex-1 rounded-full transition-all duration-300",
                  s <= step ? "bg-amber-400" : "bg-white/[0.08]",
                ].join(" ")}
              />
            ))}
          </div>

          {/* ── Step 1: Vehicle ── */}
          {step === 1 && (
            <div className="space-y-2.5">
              {vehiclesLoading ? (
                <div className="flex items-center justify-center py-10 gap-2.5">
                  <span className="w-4 h-4 rounded-full border-2 border-zinc-600 border-t-amber-400 animate-spin" />
                  <p className="text-sm text-zinc-500">Loading vehicles…</p>
                </div>
              ) : vehicles.length === 0 ? (
                <div className="text-center py-10">
                  <p className="text-zinc-400 text-sm mb-1">No vehicles on your account.</p>
                  <p className="text-zinc-600 text-xs">Add a vehicle from your profile first.</p>
                </div>
              ) : (
                vehicles.map((v) => (
                  <button
                    key={v.id}
                    onClick={() => setVehicleId(v.id)}
                    className={[
                      "w-full flex items-center gap-3.5 px-4 py-3.5 rounded-2xl border transition-all text-left",
                      vehicleId === v.id
                        ? "bg-amber-400/10 border-amber-400/40"
                        : "bg-white/[0.03] border-white/[0.08] hover:bg-white/[0.06]",
                    ].join(" ")}>
                    <div
                      className={[
                        "w-10 h-10 rounded-xl flex items-center justify-center shrink-0",
                        vehicleId === v.id
                          ? "bg-amber-400/15 border border-amber-400/30"
                          : "bg-white/[0.05] border border-white/[0.08]",
                      ].join(" ")}>
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                        <path
                          d="M5 17H3a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h13l4 4v4a2 2 0 0 1-2 2h-2"
                          stroke={vehicleId === v.id ? "#F59E0B" : "#52525B"}
                          strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                        <circle cx="7.5" cy="17.5" r="2.5" stroke={vehicleId === v.id ? "#F59E0B" : "#52525B"} strokeWidth="1.5" />
                        <circle cx="17.5" cy="17.5" r="2.5" stroke={vehicleId === v.id ? "#F59E0B" : "#52525B"} strokeWidth="1.5" />
                      </svg>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-medium truncate ${vehicleId === v.id ? "text-zinc-100" : "text-zinc-300"}`}>
                        {v.brand} {v.model}
                      </p>
                      <p className="text-xs text-zinc-500">{v.plateNumber ?? "No plate number"}</p>
                    </div>
                    {vehicleId === v.id && (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="ml-auto shrink-0" aria-hidden="true">
                        <path d="M20 6L9 17l-5-5" stroke="#F59E0B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </button>
                ))
              )}
            </div>
          )}

          {/* ── Step 2: Describe the problem ── */}
          {step === 2 && (
            <div className="space-y-2">
              <label className="text-xs text-zinc-400 mb-1.5 block">
                What&apos;s wrong with your vehicle?
              </label>
              <textarea
                rows={6}
                placeholder="e.g. Engine makes a knocking sound when starting..."
                value={problem}
                onChange={(e) => setProblem(e.target.value)}
                className="w-full px-4 py-3 rounded-2xl bg-white/[0.04] border border-white/[0.08]
                  text-zinc-100 text-sm placeholder:text-zinc-600
                  outline-none resize-none
                  focus:border-amber-400/50 focus:bg-white/[0.06]
                  transition-all"
              />
              <p className="text-[11px] text-zinc-600">
                The more detail you give, the more accurate the mechanic's estimate will be.
              </p>
            </div>
          )}

          {/* ── Step 3: Preferred date & time ── */}
          {step === 3 && (
            <div className="space-y-3">
              <label className="text-xs text-zinc-400 mb-1.5 block">
                When would you like the mechanic to arrive?
              </label>
              <input
                type="datetime-local"
                value={scheduledAt}
                onChange={(e) => setScheduledAt(e.target.value)}
                min={new Date().toISOString().slice(0, 16)}
                className="w-full px-4 py-3 rounded-2xl bg-white/[0.04] border border-white/[0.08]
                  text-zinc-100 text-sm outline-none
                  focus:border-amber-400/50 focus:bg-white/[0.06]
                  transition-all [color-scheme:dark]"
              />
              <p className="text-[11px] text-zinc-600">
                Need help right now instead? Close this and use Emergency Booking from the dashboard.
              </p>
            </div>
          )}

          {/* ── Step 4: Share preferred service location ── */}
          {step === 4 && (
            <div className="space-y-3">
              {!location ? (
                <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-5 text-center space-y-3">
                  <div className="w-12 h-12 mx-auto rounded-2xl bg-amber-400/10 border border-amber-400/20 flex items-center justify-center">
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" stroke="#F59E0B" strokeWidth="1.5" />
                      <circle cx="12" cy="10" r="3" stroke="#F59E0B" strokeWidth="1.5" />
                    </svg>
                  </div>
                  <p className="text-sm text-zinc-300">
                    Share your current location so the mechanic knows where to go.
                  </p>
                  <button
                    onClick={requestLocation}
                    disabled={locating}
                    className="w-full py-3 rounded-xl bg-amber-400 hover:bg-amber-300 active:scale-[0.98]
                      text-[#080909] font-semibold text-sm transition-all disabled:opacity-50">
                    {locating ? "Getting your location…" : "Share current location"}
                  </button>
                  {locationError && (
                    <p className="text-xs text-orange-400 bg-orange-500/[0.07] rounded-lg px-3 py-2">{locationError}</p>
                  )}
                </div>
              ) : (
                <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/[0.05] p-4 space-y-2">
                  <div className="flex items-center gap-2">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                      <path d="M20 6L9 17l-5-5" stroke="#34D399" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    <p className="text-sm font-medium text-emerald-400">Location shared</p>
                  </div>
                  <p className="text-xs text-zinc-400 leading-relaxed">{location.address}</p>
                  <button
                    onClick={requestLocation}
                    disabled={locating}
                    className="text-xs text-amber-400 font-medium">
                    {locating ? "Updating…" : "Use current location again"}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* ── Step 5: Browse & select mechanic (or any available) ── */}
          {step === 5 && (
            <div className="space-y-2">
              {/* Any Available Mechanic — mechanicId stays null; the shop/
                  dispatch side (assignMechanicToBooking) picks it up later.
                  Full shop browsing alongside this is a follow-up — needs a
                  server action to list/search RepairShop records, which
                  doesn't exist in the files I've seen yet. */}
              <p className="text-[11px] text-zinc-600 uppercase tracking-wider font-medium pt-2 pb-1">
                Choose a mechanic
              </p>

              <div className="space-y-2">
                {availableMechanics.map((m) => (
                  <button
                    key={m.id}
                    onClick={() => { setMechanicId(m.id); setShopId(""); }}
                    className={[
                      "w-full flex items-center gap-3 px-4 py-3 rounded-2xl border transition-all text-left",
                      mechanicId === m.id
                        ? "bg-amber-400/10 border-amber-400/40"
                        : "bg-white/[0.03] border-white/[0.08] hover:bg-white/[0.06]",
                    ].join(" ")}>
                    <div
                      className={[
                        "w-10 h-10 rounded-xl flex items-center justify-center shrink-0 text-sm font-bold",
                        mechanicId === m.id
                          ? "bg-amber-400/15 border border-amber-400/30 text-amber-400"
                          : "bg-white/[0.05] border border-white/[0.08] text-zinc-400",
                      ].join(" ")}>
                      {m.initials}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-medium truncate ${mechanicId === m.id ? "text-zinc-100" : "text-zinc-300"}`}>
                        {m.name}
                      </p>
                      <p className="text-xs text-zinc-500 truncate">{m.specialty}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="flex items-center gap-1 justify-end">
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="#F59E0B" aria-hidden="true">
                          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                        </svg>
                        <span className="text-xs text-zinc-300">{m.rating > 0 ? m.rating : "New"}</span>
                      </div>
                      <p className="text-[10px] text-zinc-600">{m.reviews} reviews</p>
                    </div>
                  </button>
                ))}
                {availableMechanics.length === 0 && (
                  <p className="text-sm text-zinc-500 text-center py-4">
                    No individual mechanics available right now — try booking a shop below instead.
                  </p>
                )}
              </div>

              <p className="text-[11px] text-zinc-600 uppercase tracking-wider font-medium pt-4 pb-1">
                Or book a shop directly
              </p>

              <div className="space-y-2">
                {shopsLoading ? (
                  <div className="flex items-center justify-center py-6 gap-2.5">
                    <span className="w-4 h-4 rounded-full border-2 border-zinc-600 border-t-amber-400 animate-spin" />
                    <p className="text-sm text-zinc-500">Loading shops…</p>
                  </div>
                ) : shops.length === 0 ? (
                  <p className="text-sm text-zinc-500 text-center py-4">
                    No verified shops nearby yet.
                  </p>
                ) : (
                  shops.map((s) => (
                    <button
                      key={s.id}
                      onClick={() => { setShopId(s.id); setAnyAvailable(false); setMechanicId(""); }}
                      className={[
                        "w-full flex items-center gap-3 px-4 py-3 rounded-2xl border transition-all text-left",
                        shopId === s.id
                          ? "bg-amber-400/10 border-amber-400/40"
                          : "bg-white/[0.03] border-white/[0.08] hover:bg-white/[0.06]",
                      ].join(" ")}>
                      <div
                        className={[
                          "w-10 h-10 rounded-xl flex items-center justify-center shrink-0 text-sm font-bold",
                          shopId === s.id
                            ? "bg-amber-400/15 border border-amber-400/30 text-amber-400"
                            : "bg-white/[0.05] border border-white/[0.08] text-zinc-400",
                        ].join(" ")}>
                        {s.initials}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-medium truncate ${shopId === s.id ? "text-zinc-100" : "text-zinc-300"}`}>
                          {s.name}
                        </p>
                        <p className="text-xs text-zinc-500 truncate">
                          {s.specialization} · {s.availableMechanicCount} mechanic{s.availableMechanicCount === 1 ? "" : "s"} available
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="flex items-center gap-1 justify-end">
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="#F59E0B" aria-hidden="true">
                            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                          </svg>
                          <span className="text-xs text-zinc-300">{s.rating > 0 ? s.rating : "New"}</span>
                        </div>
                        <p className="text-[10px] text-zinc-600">{s.reviews} reviews</p>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>
          )}

          {/* ── Step 6: Review & confirm ── */}
          {step === 6 && (
            <div className="space-y-4">
              <div className="bg-white/[0.03] border border-white/[0.07] rounded-2xl p-4 space-y-2.5">
                <p className="text-xs text-zinc-500 uppercase tracking-wider font-medium mb-3">
                  Booking summary
                </p>
                {[
                  {
                    label: "Vehicle",
                    value: selectedVehicle ? `${selectedVehicle.brand} ${selectedVehicle.model}` : "—",
                  },
                  { label: "Problem", value: problem },
                  {
                    label: "Schedule",
                    value: scheduledAt
                        ? new Date(scheduledAt).toLocaleString("en-PH", {
                            month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
                          })
                        : "—",
                  },
                  { label: "Location", value: location?.address ?? "—" },
                  {
                    label: "Mechanic",
                    value: shopId
                      ? `${selectedShop?.name ?? "Shop"} (shop will assign a mechanic)`
                      : anyAvailable
                        ? "Any Available Mechanic"
                        : (selectedMechanic?.name ?? "—"),
                  },
                ].map(({ label, value }) => (
                  <div key={label} className="flex items-start gap-3">
                    <span className="text-xs text-zinc-500 w-16 shrink-0 pt-0.5">{label}</span>
                    <span className="text-xs text-zinc-200 flex-1 leading-relaxed">{value}</span>
                  </div>
                ))}
              </div>

              <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-white/[0.03] border border-white/[0.07]">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <circle cx="12" cy="12" r="10" stroke="#71717A" strokeWidth="1.5" />
                  <path d="M12 8v4M12 16h.01" stroke="#71717A" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
                <p className="text-xs text-zinc-500">
                  This sends a request — the mechanic reviews it and sends a repair estimate before anything is confirmed.
                </p>
              </div>
            </div>
          )}

          {/* ── Error ── */}
          {error && (
            <div className="flex items-center gap-2 mt-4 px-4 py-3 rounded-xl bg-orange-500/[0.07] border border-orange-500/[0.15]">
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" className="shrink-0" aria-hidden="true">
                <circle cx="8" cy="8" r="7" stroke="#FB923C" strokeWidth="1.2" />
                <path d="M8 5V8.5M8 11H8.01" stroke="#FB923C" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
              <p className="text-[13px] text-orange-300">{error}</p>
            </div>
          )}

          {/* ── Navigation buttons ── */}
          <div className={`flex gap-3 mt-6 ${step === 1 ? "justify-end" : "justify-between"}`}>
            {step > 1 && (
              <button
                onClick={back}
                disabled={loading}
                className="flex items-center gap-1.5 px-5 py-3 rounded-xl
                  border border-white/[0.08] text-zinc-400 text-sm font-medium
                  hover:bg-white/[0.05] transition-colors disabled:opacity-40">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M15 18l-6-6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                Back
              </button>
            )}

            {step < TOTAL_STEPS ? (
              <button
                onClick={next}
                disabled={step === 1 && vehicles.length === 0}
                className="flex items-center gap-1.5 px-6 py-3 rounded-xl
                  bg-amber-400 hover:bg-amber-300 active:scale-[0.98]
                  text-[#080909] font-semibold text-sm
                  transition-all disabled:opacity-40 disabled:cursor-not-allowed">
                Next
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M9 18l6-6-6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            ) : (
              <button
                onClick={handleConfirm}
                disabled={loading}
                className="flex items-center justify-center gap-2 flex-1 py-3.5 rounded-xl
                  bg-amber-400 hover:bg-amber-300 active:scale-[0.98]
                  text-[#080909] font-bold text-[15px]
                  transition-all disabled:opacity-40 disabled:cursor-not-allowed
                  shadow-[0_4px_20px_rgba(245,158,11,0.2)]">
                {loading ? (
                  <span aria-hidden="true" className="w-5 h-5 rounded-full border-2 border-black/20 border-t-black animate-spin" />
                ) : (
                  "Send Booking Request"
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  );
}