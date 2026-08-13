"use client";

import { useState, useEffect, useCallback } from "react";
import { createBooking } from "@/app/actions/booking";
import { getVehicles, type FetchedVehicle } from "@/app/actions/get-vehicles";
import { getAvailableSlots, getMechanicLocationForBooking, type TimeSlot } from "@/app/actions/scheduling";
import { getHomeLocation, saveHomeLocation } from "@/app/actions/home-location";
import type { DisplayMechanic } from "./_dashboard";

// ── Props ─────────────────────────────────────────────────────────────────────

interface BookingModalProps {
  isOpen: boolean;
  onClose: () => void;
  mechanics: DisplayMechanic[];
  preSelectedMechanicId?: string | null;
}

// ── Step labels ──────────────────────────────────────────────────────────────
// 1 Select Vehicle → 2 Describe Problem → 3 Choose Mechanic/Shop → 4 Date & Time
// (hard-blocked against that mechanic's existing schedule) → 5 Share Location
// (home / mechanic-shop's location / current) → 6 Review & Confirm.
//
// NOTE: Step 5 is skipped entirely when a SHOP is chosen — the location is
// automatically the shop's own address (bring the vehicle there), no owner
// input needed. It's only shown when a specific MECHANIC is chosen, where
// "where do I meet them" is a real choice (home / mechanic's current spot /
// somewhere else). Step numbering/progress bar below account for this.

const STEP_TITLES = [
  "Select your vehicle",
  "Describe the problem",
  "Choose a mechanic or shop",
  "Pick a date & time",
  "Share your location",
  "Review & confirm",
];
const TOTAL_STEPS = STEP_TITLES.length;

// ── Shop search result shape (from /api/shops/search) ──────────────────────

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
  address: string;
  latitude: number | null;
  longitude: number | null;
}

interface CapturedLocation {
  lat: number;
  lng: number;
  address: string;
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

  // Step 3: mechanic or shop — one or the other, no "Any Available" option
  const [mechanicId, setMechanicId] = useState("");
  const [shopId, setShopId] = useState("");
  const [shops, setShops] = useState<ShopSearchResult[]>([]);
  const [shopsLoading, setShopsLoading] = useState(false);

  // Step 4: date & time (hard-blocking slot picker)
  const [date, setDate] = useState("");
  const [slots, setSlots] = useState<TimeSlot[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [scheduledAt, setScheduledAt] = useState(""); // ISO string of the chosen slot

  // Step 5: location — home / mechanic-shop's location / current
  // (skipped entirely for shop bookings — see isShopFlow below)
  const [location, setLocation] = useState<CapturedLocation | null>(null);
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState("");
  const [homeLocation, setHomeLocation] = useState<CapturedLocation | null>(null);
  const [homeLoading, setHomeLoading] = useState(false);
  const [targetLocation, setTargetLocation] = useState<CapturedLocation | null>(null);
  const [targetLocationLabel, setTargetLocationLabel] = useState("");
  const [targetLocationLoading, setTargetLocationLoading] = useState(false);
  const [saveAsHome, setSaveAsHome] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const isShopFlow = !!shopId;
  // Displayed step numbering collapses out step 5 for shop bookings, since
  // it's never actually shown — internal `step` still uses 1-6 positions
  // matching the JSX blocks below, just skipping over 5 in navigation.
  const totalStepsDisplay = isShopFlow ? TOTAL_STEPS - 1 : TOTAL_STEPS;
  const stepDisplay = isShopFlow && step > 5 ? step - 1 : step;

  // ── Load vehicles + home location fresh every time the modal opens ─────────
  useEffect(() => {
    if (!isOpen) return;
    setVehiclesLoading(true);
    getVehicles().then(setVehicles).finally(() => setVehiclesLoading(false));

    setHomeLoading(true);
    getHomeLocation().then(setHomeLocation).finally(() => setHomeLoading(false));

    if (preSelectedMechanicId) {
      setMechanicId(preSelectedMechanicId);
    }
  }, [isOpen, preSelectedMechanicId]);

  // ── Fetch shops once step 3 is reached ──────────────────────────────────────
  useEffect(() => {
    if (!isOpen || step !== 3 || shops.length > 0 || shopsLoading) return;
    setShopsLoading(true);
    fetch("/api/shops/search")
      .then((res) => res.json())
      .then((data: { results?: ShopSearchResult[] }) => setShops(data.results ?? []))
      .catch(() => setShops([]))
      .finally(() => setShopsLoading(false));
  }, [isOpen, step, shops.length, shopsLoading]);

  // ── Fetch available slots whenever the date changes (step 4) ───────────────
  useEffect(() => {
    if (!date) { setSlots([]); return; }
    setSlotsLoading(true);
    getAvailableSlots(date, mechanicId || null)
      .then(setSlots)
      .catch(() => setSlots([]))
      .finally(() => setSlotsLoading(false));
    setScheduledAt("");
  }, [date, mechanicId]);

  // ── Fetch the mechanic/shop's location as soon as one is chosen ────────────
  // Moved off "step === 5 only" — for shop bookings step 5 never renders at
  // all, but we still need targetLocation ready by the time step 4 tries to
  // auto-apply it when skipping ahead to step 6.
  const loadTargetLocation = useCallback(async () => {
    setTargetLocationLoading(true);
    try {
      if (mechanicId) {
        const loc = await getMechanicLocationForBooking(mechanicId);
        if (loc) {
          setTargetLocation({ lat: loc.lat, lng: loc.lng, address: loc.address });
          const m = mechanics.find((x) => x.id === mechanicId);
          setTargetLocationLabel(m ? `${m.name}'s current location` : loc.address);
        } else {
          setTargetLocation(null);
        }
      } else if (shopId) {
        const s = shops.find((x) => x.id === shopId);
        if (s?.latitude && s?.longitude) {
          setTargetLocation({ lat: s.latitude, lng: s.longitude, address: s.address });
          setTargetLocationLabel(s.name);
        } else {
          setTargetLocation(null);
        }
      } else {
        setTargetLocation(null);
      }
    } finally {
      setTargetLocationLoading(false);
    }
  }, [mechanicId, shopId, mechanics, shops]);

  useEffect(() => {
    if (!isOpen || (!mechanicId && !shopId)) return;
    loadTargetLocation();
  }, [isOpen, mechanicId, shopId, loadTargetLocation]);

  if (!isOpen) return null;

  // ── Helpers ────────────────────────────────────────────────────────────────

  function reset() {
    setStep(1);
    setVehicleId("");
    setProblem("");
    setMechanicId("");
    setShopId("");
    setShops([]);
    setDate("");
    setSlots([]);
    setScheduledAt("");
    setLocation(null);
    setLocationError("");
    setHomeLocation(null);
    setTargetLocation(null);
    setTargetLocationLabel("");
    setSaveAsHome(false);
    setError("");
    setLoading(false);
  }

  function handleClose() {
    reset();
    onClose();
  }

  function requestCurrentLocation() {
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
          // Reverse geocoding is best-effort — raw coordinates are still valid.
        }
        setLocation({ lat, lng, address });
        setLocating(false);
      },
      () => {
        setLocationError("Location access was denied. You can still continue, but the mechanic won't have your address.");
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 20000 }
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
    if (step === 3 && !mechanicId && !shopId) {
      setError("Select a mechanic or a shop.");
      return;
    }
    if (step === 4) {
      if (!scheduledAt) {
        setError("Pick an available date & time.");
        return;
      }
      if (isShopFlow) {
        // Skip step 5 entirely — auto-apply the shop's own location instead
        // of asking the owner to choose. If we don't actually have the
        // shop's coordinates for some reason (never geocoded/shared), don't
        // silently proceed with no location — block with a clear message
        // rather than letting the booking submit incomplete.
        if (!targetLocation) {
          setError("Could not determine this shop's location. Please try again in a moment, or choose a different shop.");
          return;
        }
        setLocation(targetLocation);
        setStep(6);
        return;
      }
    }
    if (step === 5 && !location) {
      setError("Please choose a location.");
      return;
    }
    setStep((s) => s + 1);
  }

  function back() {
    setError("");
    if (step === 6 && isShopFlow) {
      // Skip step 5 on the way back too — it never rendered going forward.
      setStep(4);
      return;
    }
    setStep((s) => s - 1);
  }

  async function handleConfirm() {
    setLoading(true);
    setError("");
    try {
      await createBooking({
        vehicleId,
        mechanicId: mechanicId || null,
        shopId: shopId || null,
        problemDescription: problem,
        scheduledAt,
        ownerLat: location!.lat,
        ownerLng: location!.lng,
        address: location!.address,
      });

      if (saveAsHome && location && !isShopFlow) {
        await saveHomeLocation(location.lat, location.lng, location.address).catch(() => {});
      }

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
  const todayStr = new Date().toISOString().slice(0, 10);

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <>
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
        onClick={handleClose}
        aria-hidden="true"
      />

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
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-white/[0.12]" />
        </div>

        <div className="px-5 pb-10 pt-2">
          {/* ── Header ── */}
          <div className="flex items-center justify-between mb-5">
            <div>
              <p className="text-[11px] text-zinc-500 mb-0.5 uppercase tracking-wider font-medium">
                Step {stepDisplay} of {totalStepsDisplay}
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
            {Array.from({ length: totalStepsDisplay }, (_, i) => i + 1).map((s) => (
              <div
                key={s}
                className={[
                  "h-1 flex-1 rounded-full transition-all duration-300",
                  s <= stepDisplay ? "bg-amber-400" : "bg-white/[0.08]",
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

          {/* ── Step 3: Choose mechanic or shop ── */}
          {step === 3 && (
            <div className="space-y-2">
              <p className="text-[11px] text-zinc-600 uppercase tracking-wider font-medium pb-1">
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
                    No individual mechanics available right now — try a shop below.
                  </p>
                )}
              </div>

              <p className="text-[11px] text-zinc-600 uppercase tracking-wider font-medium pt-4 pb-1">
                Or choose a shop
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
                      onClick={() => { setShopId(s.id); setMechanicId(""); }}
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

          {/* ── Step 4: Date & time — hard-blocking slot picker ── */}
          {step === 4 && (
            <div className="space-y-3">
              <div>
                <label className="text-xs text-zinc-400 mb-1.5 block">Date</label>
                <input
                  type="date"
                  value={date}
                  min={todayStr}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full px-4 py-3 rounded-2xl bg-white/[0.04] border border-white/[0.08]
                    text-zinc-100 text-sm outline-none
                    focus:border-amber-400/50 focus:bg-white/[0.06]
                    transition-all [color-scheme:dark]"
                />
              </div>

              {shopId && (
                <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-white/[0.03] border border-white/[0.07]">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <circle cx="12" cy="12" r="10" stroke="#71717A" strokeWidth="1.5" />
                    <path d="M12 8v4M12 16h.01" stroke="#71717A" strokeWidth="1.5" strokeLinecap="round" />
                  </svg>
                  <p className="text-xs text-zinc-500">
                    Shop time slots aren't checked against individual mechanic schedules yet — all times shown as open.
                    Bring your vehicle to {selectedShop?.name ?? "the shop"} — no location step needed.
                  </p>
                </div>
              )}

              {date && (
                <div>
                  <label className="text-xs text-zinc-400 mb-1.5 block">Available times</label>
                  {slotsLoading ? (
                    <div className="flex items-center justify-center py-8 gap-2.5">
                      <span className="w-4 h-4 rounded-full border-2 border-zinc-600 border-t-amber-400 animate-spin" />
                      <p className="text-sm text-zinc-500">Checking availability…</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-3 gap-2">
                      {slots.map((slot) => (
                        <button
                          key={slot.iso}
                          disabled={!slot.available}
                          onClick={() => setScheduledAt(slot.iso)}
                          className={[
                            "py-2.5 rounded-xl text-xs font-medium border transition-all",
                            !slot.available
                              ? "bg-white/[0.01] border-white/[0.04] text-zinc-700 cursor-not-allowed line-through"
                              : scheduledAt === slot.iso
                                ? "bg-amber-400 border-amber-400 text-zinc-900 font-bold"
                                : "bg-white/[0.03] border-white/[0.08] text-zinc-300 hover:bg-white/[0.06]",
                          ].join(" ")}>
                          {slot.label}
                        </button>
                      ))}
                    </div>
                  )}
                  {!slotsLoading && mechanicId && (
                    <p className="text-[11px] text-zinc-600 mt-2">
                      Greyed-out times are already booked with this mechanic (±1hr buffer).
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ── Step 5: Location — home / mechanic's location / current ──
              Never rendered for shop bookings — see next()'s step 4 handler,
              which auto-applies the shop's location and jumps straight to
              step 6 instead. */}
          {step === 5 && !isShopFlow && (
            <div className="space-y-2.5">
              {/* Home */}
              {homeLoading ? (
                <div className="flex items-center justify-center py-4">
                  <span className="w-4 h-4 rounded-full border-2 border-zinc-600 border-t-amber-400 animate-spin" />
                </div>
              ) : homeLocation ? (
                <button
                  onClick={() => setLocation(homeLocation)}
                  className={[
                    "w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl border transition-all text-left",
                    location?.address === homeLocation.address
                      ? "bg-amber-400/10 border-amber-400/40"
                      : "bg-white/[0.03] border-white/[0.08] hover:bg-white/[0.06]",
                  ].join(" ")}>
                  <div className="w-10 h-10 rounded-xl bg-white/[0.05] border border-white/[0.08]
                    flex items-center justify-center shrink-0">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                      <path d="M3 12l9-9 9 9M5 10v10a1 1 0 0 0 1 1h3v-6h6v6h3a1 1 0 0 0 1-1V10"
                        stroke="#52525B" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-zinc-300">Home address</p>
                    <p className="text-xs text-zinc-500 truncate">{homeLocation.address}</p>
                  </div>
                </button>
              ) : null}

              {/* Mechanic's location */}
              {targetLocationLoading ? (
                <div className="flex items-center justify-center py-4">
                  <span className="w-4 h-4 rounded-full border-2 border-zinc-600 border-t-amber-400 animate-spin" />
                </div>
              ) : targetLocation ? (
                <button
                  onClick={() => setLocation(targetLocation)}
                  className={[
                    "w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl border transition-all text-left",
                    location?.address === targetLocation.address
                      ? "bg-amber-400/10 border-amber-400/40"
                      : "bg-white/[0.03] border-white/[0.08] hover:bg-white/[0.06]",
                  ].join(" ")}>
                  <div className="w-10 h-10 rounded-xl bg-white/[0.05] border border-white/[0.08]
                    flex items-center justify-center shrink-0">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                      <path d="M3 21h18M5 21V7l7-4 7 4v14M9 21v-6h6v6" stroke="#52525B" strokeWidth="1.5"
                        strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-zinc-300">{targetLocationLabel}</p>
                    <p className="text-xs text-zinc-500 truncate">Bring your vehicle here</p>
                  </div>
                </button>
              ) : null}

              {/* Current location */}
              {!location || (location.address !== homeLocation?.address && location.address !== targetLocation?.address) ? (
                location ? (
                  <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/[0.05] p-4 space-y-2">
                    <div className="flex items-center gap-2">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                        <path d="M20 6L9 17l-5-5" stroke="#34D399" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                      <p className="text-sm font-medium text-emerald-400">Current location shared</p>
                    </div>
                    <p className="text-xs text-zinc-400 leading-relaxed">{location.address}</p>
                    <label className="flex items-center gap-2 pt-1 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={saveAsHome}
                        onChange={(e) => setSaveAsHome(e.target.checked)}
                        className="accent-amber-400"
                      />
                      <span className="text-xs text-zinc-400">Save this as my home address</span>
                    </label>
                    <button onClick={requestCurrentLocation} disabled={locating} className="text-xs text-amber-400 font-medium">
                      {locating ? "Updating…" : "Use current location again"}
                    </button>
                  </div>
                ) : (
                  <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-4 text-center space-y-3">
                    <p className="text-sm text-zinc-300">
                      {homeLocation || targetLocation ? "Or use somewhere else" : "Share your current location"}
                    </p>
                    <button
                      onClick={requestCurrentLocation}
                      disabled={locating}
                      className="w-full py-3 rounded-xl bg-amber-400 hover:bg-amber-300 active:scale-[0.98]
                        text-[#080909] font-semibold text-sm transition-all disabled:opacity-50">
                      {locating ? "Getting your location…" : "Share current location"}
                    </button>
                    {locationError && (
                      <p className="text-xs text-orange-400 bg-orange-500/[0.07] rounded-lg px-3 py-2">{locationError}</p>
                    )}
                  </div>
                )
              ) : null}
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
                    label: "Mechanic",
                    value: shopId ? (selectedShop?.name ?? "Shop") : (selectedMechanic?.name ?? "—"),
                  },
                  {
                    label: "Schedule",
                    value: scheduledAt
                      ? new Date(scheduledAt).toLocaleString("en-PH", {
                          month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
                        })
                      : "—",
                  },
                  {
                    label: "Location",
                    value: isShopFlow
                      ? `${location?.address ?? "—"} (shop location)`
                      : (location?.address ?? "—"),
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
                  This sends a request — {isShopFlow ? "the shop" : "the mechanic"} reviews it and sends a repair estimate before anything is confirmed.
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