"use client";

import { useState, useEffect } from "react";
import { createBooking } from "@/app/actions/booking";
import { getVehicles, type FetchedVehicle } from "@/app/actions/get-vehicles";
import type { DisplayMechanic } from "./_dashboard";

// ── Props ─────────────────────────────────────────────────────────────────────

interface BookingModalProps {
  isOpen:    boolean;
  onClose:   () => void;
  mechanics: DisplayMechanic[];
}

// ── Step labels ───────────────────────────────────────────────────────────────

const STEP_TITLES = [
  "Select your vehicle",
  "Describe the problem",
  "Review & confirm",
];

// ── Component ─────────────────────────────────────────────────────────────────

export function BookingModal({
  isOpen,
  onClose,
  mechanics = [],
}: BookingModalProps) {
  const [vehicles, setVehicles]         = useState<FetchedVehicle[]>([]);
  const [vehiclesLoading, setVehiclesLoading] = useState(false);
  const [step, setStep] = useState(1);
  const [vehicleId, setVehicleId] = useState("");
  const [mechanicId, setMechanicId] = useState("");
  const [problem, setProblem] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Fetch fresh vehicles every time the modal opens
  useEffect(() => {
    if (!isOpen) return;
    setVehiclesLoading(true);
    getVehicles()
      .then(setVehicles)
      .finally(() => setVehiclesLoading(false));
  }, [isOpen]);

  if (!isOpen) return null;

  // ── Helpers ────────────────────────────────────────────────────────────────

  function reset() {
    setStep(1);
    setVehicleId("");
    setMechanicId("");
    setProblem("");
    setScheduledAt("");
    setError("");
    setLoading(false);
  }

  function handleClose() {
    reset();
    onClose();
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
    if (step === 2 && !mechanicId) {
      setError("Please select a mechanic.");
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
        mechanicId,
        problemDescription: problem,
        scheduledAt: scheduledAt || undefined,
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
                Step {step} of 3
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
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                aria-hidden="true">
                <path
                  d="M18 6L6 18M6 6l12 12"
                  stroke="#71717A"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </svg>
            </button>
          </div>

          {/* ── Progress bar ── */}
          <div className="flex gap-1.5 mb-6">
            {[1, 2, 3].map((s) => (
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
                  <span className="w-4 h-4 rounded-full border-2 border-zinc-600
                    border-t-amber-400 animate-spin" />
                  <p className="text-sm text-zinc-500">Loading vehicles…</p>
                </div>
              ) : vehicles.length === 0 ? (
                <div className="text-center py-10">
                  <p className="text-zinc-400 text-sm mb-1">
                    No vehicles on your account.
                  </p>
                  <p className="text-zinc-600 text-xs">
                    Add a vehicle from your profile first.
                  </p>
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
                      <svg
                        width="20"
                        height="20"
                        viewBox="0 0 24 24"
                        fill="none"
                        aria-hidden="true">
                        <path
                          d="M5 17H3a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h13l4 4v4a2 2 0 0 1-2 2h-2"
                          stroke={vehicleId === v.id ? "#F59E0B" : "#52525B"}
                          strokeWidth="1.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                        <circle
                          cx="7.5"
                          cy="17.5"
                          r="2.5"
                          stroke={vehicleId === v.id ? "#F59E0B" : "#52525B"}
                          strokeWidth="1.5"
                        />
                        <circle
                          cx="17.5"
                          cy="17.5"
                          r="2.5"
                          stroke={vehicleId === v.id ? "#F59E0B" : "#52525B"}
                          strokeWidth="1.5"
                        />
                      </svg>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-medium truncate ${vehicleId === v.id ? "text-zinc-100" : "text-zinc-300"}`}>
                        {v.brand} {v.model}
                      </p>
                      <p className="text-xs text-zinc-500">
                        {v.plateNumber ?? "No plate number"}
                      </p>
                    </div>
                    {vehicleId === v.id && (
                      <svg
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        className="ml-auto shrink-0"
                        aria-hidden="true">
                        <path
                          d="M20 6L9 17l-5-5"
                          stroke="#F59E0B"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    )}
                  </button>
                ))
              )}
            </div>
          )}

          {/* ── Step 2: Problem + Mechanic ── */}
          {step === 2 && (
            <div className="space-y-4">
              {/* Problem description */}
              <div>
                <label className="text-xs text-zinc-400 mb-1.5 block">
                  What&apos;s wrong with your vehicle?
                </label>
                <textarea
                  rows={3}
                  placeholder="e.g. Engine makes a knocking sound when starting..."
                  value={problem}
                  onChange={(e) => setProblem(e.target.value)}
                  className="w-full px-4 py-3 rounded-2xl bg-white/[0.04] border border-white/[0.08]
                    text-zinc-100 text-sm placeholder:text-zinc-600
                    outline-none resize-none
                    focus:border-amber-400/50 focus:bg-white/[0.06]
                    transition-all"
                />
              </div>

              {/* Mechanic selection */}
              <div>
                <label className="text-xs text-zinc-400 mb-1.5 block">
                  Choose a mechanic
                </label>
                <div className="space-y-2">
                  {mechanics
                    .filter((m) => m.available)
                    .map((m) => (
                      <button
                        key={m.id}
                        onClick={() => setMechanicId(m.id)}
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
                          <p
                            className={`text-sm font-medium truncate ${mechanicId === m.id ? "text-zinc-100" : "text-zinc-300"}`}>
                            {m.name}
                          </p>
                          <p className="text-xs text-zinc-500 truncate">
                            {m.specialty}
                          </p>
                        </div>
                        <div className="text-right shrink-0">
                          <div className="flex items-center gap-1 justify-end">
                            <svg
                              width="10"
                              height="10"
                              viewBox="0 0 24 24"
                              fill="#F59E0B"
                              aria-hidden="true">
                              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                            </svg>
                            <span className="text-xs text-zinc-300">
                              {m.rating > 0 ? m.rating : "New"}
                            </span>
                          </div>
                          <p className="text-[10px] text-zinc-600">
                            {m.reviews} reviews
                          </p>
                        </div>
                      </button>
                    ))}
                  {mechanics.filter((m) => m.available).length === 0 && (
                    <p className="text-sm text-zinc-500 text-center py-4">
                      No mechanics available right now.
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ── Step 3: Schedule + Confirm ── */}
          {step === 3 && (
            <div className="space-y-4">
              {/* Schedule (optional) */}
              <div>
                <label className="text-xs text-zinc-400 mb-1.5 block">
                  Preferred schedule{" "}
                  <span className="text-zinc-600">(optional)</span>
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
              </div>

              {/* Summary card */}
              <div className="bg-white/[0.03] border border-white/[0.07] rounded-2xl p-4 space-y-2.5">
                <p className="text-xs text-zinc-500 uppercase tracking-wider font-medium mb-3">
                  Booking summary
                </p>
                {[
                  { label: "Vehicle", value: selectedVehicle ? `${selectedVehicle.brand} ${selectedVehicle.model}` : "—" },
                  { label: "Mechanic", value: selectedMechanic?.name ?? "—" },
                  { label: "Problem", value: problem },
                  {
                    label: "Schedule",
                    value: scheduledAt
                      ? new Date(scheduledAt).toLocaleString("en-PH", {
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })
                      : "As soon as available",
                  },
                ].map(({ label, value }) => (
                  <div
                    key={label}
                    className="flex items-start gap-3">
                    <span className="text-xs text-zinc-500 w-16 shrink-0 pt-0.5">
                      {label}
                    </span>
                    <span className="text-xs text-zinc-200 flex-1 leading-relaxed">
                      {value}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Error ── */}
          {error && (
            <div
              className="flex items-center gap-2 mt-4 px-4 py-3 rounded-xl
              bg-orange-500/[0.07] border border-orange-500/[0.15]">
              <svg
                width="14"
                height="14"
                viewBox="0 0 16 16"
                fill="none"
                className="shrink-0"
                aria-hidden="true">
                <circle
                  cx="8"
                  cy="8"
                  r="7"
                  stroke="#FB923C"
                  strokeWidth="1.2"
                />
                <path
                  d="M8 5V8.5M8 11H8.01"
                  stroke="#FB923C"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
              </svg>
              <p className="text-[13px] text-orange-300">{error}</p>
            </div>
          )}

          {/* ── Navigation buttons ── */}
          <div
            className={`flex gap-3 mt-6 ${step === 1 ? "justify-end" : "justify-between"}`}>
            {step > 1 && (
              <button
                onClick={back}
                disabled={loading}
                className="flex items-center gap-1.5 px-5 py-3 rounded-xl
                  border border-white/[0.08] text-zinc-400 text-sm font-medium
                  hover:bg-white/[0.05] transition-colors disabled:opacity-40">
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  aria-hidden="true">
                  <path
                    d="M15 18l-6-6 6-6"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                Back
              </button>
            )}

            {step < 3 ? (
              <button
                onClick={next}
                disabled={vehicles.length === 0}
                className="flex items-center gap-1.5 px-6 py-3 rounded-xl
                  bg-amber-400 hover:bg-amber-300 active:scale-[0.98]
                  text-[#080909] font-semibold text-sm
                  transition-all disabled:opacity-40 disabled:cursor-not-allowed">
                Next
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  aria-hidden="true">
                  <path
                    d="M9 18l6-6-6-6"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
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
                  <span
                    aria-hidden="true"
                    className="w-5 h-5 rounded-full border-2 border-black/20 border-t-black animate-spin"
                  />
                ) : (
                  "Confirm Booking"
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  );
}