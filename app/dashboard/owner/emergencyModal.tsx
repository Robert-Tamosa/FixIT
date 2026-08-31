"use client";

import { useState, useEffect, useCallback } from "react";
import { getVehicles, type FetchedVehicle } from "@/app/actions/get-vehicles";
import {
  findEmergencyCandidates,
  createEmergencyBooking,
  type EmergencyCandidate,
  type EmergencyMatchResult,
} from "@/app/actions/emergency";
import { AddVehicleModal, type AddedVehicle } from "@/components/vehicle/AddVehicleForm";

export interface DispatchedInfo {
  mechanicName: string;
  etaMinutes: number;
  bookingId: string;
}

interface EmergencyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDispatched: (info: DispatchedInfo) => void;
  onChange?: (vehicles: FetchedVehicle[]) => void;
}

type Step =
  | "select-vehicle"
  | "location"
  | "problem"
  | "analyzing"
  | "results"
  | "confirming";

const severityColor: Record<string, string> = {
  LOW: "text-emerald-400 bg-emerald-400/10 border-emerald-400/20",
  MEDIUM: "text-amber-400 bg-amber-400/10 border-amber-400/20",
  HIGH: "text-orange-400 bg-orange-400/10 border-orange-400/20",
  CRITICAL: "text-red-400 bg-red-400/10 border-red-400/20",
};

export function EmergencyModal({ isOpen, onClose, onDispatched, onChange }: EmergencyModalProps) {
  const [step, setStep] = useState<Step>("select-vehicle");
  const [error, setError] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [vehicles, setVehicles] = useState<FetchedVehicle[]>([]);
  const [vehiclesLoading, setVehiclesLoading] = useState(false);
  const [selectedVehicleId, setSelectedVehicleId] = useState<string | null>(null);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [locating, setLocating] = useState(false);
  const [problem, setProblem] = useState("");
  const [matchResult, setMatchResult] = useState<EmergencyMatchResult | null>(null);
  const [selectedCandidate, setSelectedCandidate] = useState<EmergencyCandidate | null>(null);

  // Reset internal state and fetch fresh vehicles every time the modal opens.
  useEffect(() => {
    if (!isOpen) return;
    setStep("select-vehicle");
    setError(null);
    setSelectedVehicleId(null);
    setCoords(null);
    setProblem("");
    setMatchResult(null);
    setSelectedCandidate(null);

    setVehiclesLoading(true);
    getVehicles()
      .then(setVehicles)
      .catch(() => setError("Could not load your vehicles. Please try again."))
      .finally(() => setVehiclesLoading(false));
  }, [isOpen]);

  function chooseVehicle(vehicleId: string) {
    setSelectedVehicleId(vehicleId);
    setStep("location");
  }

  function handleAdded(vehicle: AddedVehicle) {
      const next = [vehicle, ...vehicles];
      setVehicles(next);
      onChange?.(next);
    }

  const shareLocation = useCallback(() => {
    setLocating(true);
    setError(null);
    if (!navigator.geolocation) {
      setError("Your browser doesn't support location sharing. Please enable it or try another device.");
      setLocating(false);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setLocating(false);
        setStep("problem");
      },
      () => {
        setError("Location access was denied. We need your location to find nearby mechanics.");
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }, []);

  async function analyzeAndSearch() {
    if (!selectedVehicleId || !coords) return;
    if (problem.trim().length < 10) {
      setError("Please describe the problem in a bit more detail (at least 10 characters).");
      return;
    }
    setStep("analyzing");
    setError(null);
    try {
      const result = await findEmergencyCandidates(
        selectedVehicleId,
        coords.lat,
        coords.lng,
        problem.trim(),
      );
      setMatchResult(result);
      setStep("results");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong analyzing your request.");
      setStep("problem");
    }
  }

  /** Selecting a candidate only highlights it — booking is a separate, explicit commit. */
  function selectCandidate(candidate: EmergencyCandidate) {
    setSelectedCandidate(candidate);
  }

  /** The actual commit action — separate tap from selection. */
  async function handleConfirm() {
    if (!selectedVehicleId || !coords || !matchResult || !selectedCandidate) return;
    setStep("confirming");
    setError(null);
    try {
      const res = await createEmergencyBooking(
        selectedVehicleId,
        selectedCandidate.mechanicId,
        coords.lat,
        coords.lng,
        problem.trim(),
        matchResult.analysis,
        selectedCandidate.matchScore,
      );
      onDispatched({
        mechanicName: selectedCandidate.name,
        etaMinutes: selectedCandidate.etaMinutes,
        bookingId: res.bookingId,
      });
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not send the request. Please try again.");
      setStep("results");
    }
  }

  if (!isOpen) return null;

return (
  <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
    <div className="relative w-full sm:max-w-md bg-[#0c0d0e] border border-white/[0.08]
      rounded-3xl p-6 max-h-[88vh] overflow-y-auto">

        {step === "select-vehicle" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-zinc-100">Select your vehicle</h2>
              <button onClick={onClose} className="text-zinc-500 text-sm">Cancel</button>
            </div>
            {vehiclesLoading ? (
              <p className="text-sm text-zinc-500 py-8 text-center">Loading vehicles…</p>
            ) : vehicles.length === 0 ? (
              <div className="text-center py-10">
                <p className="text-zinc-400 text-sm mb-1">No vehicles on your account.</p>
                <p className="text-zinc-600 text-xs">Add a vehicle from your profile first.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {vehicles.map((v) => (
                  <button
                    key={v.id}
                    onClick={() => chooseVehicle(v.id)}
                    className="w-full text-left p-3.5 rounded-2xl bg-white/[0.03]
                      border border-white/[0.08] hover:border-amber-400/30
                      active:scale-[0.98] transition-all">
                    <p className="text-sm font-medium text-zinc-100">{v.brand} {v.model}</p>
                    <p className="text-xs text-zinc-500 mt-0.5">{v.plateNumber ?? "No plate number"}</p>
                  </button>
                ))}
              </div>
            )}
            {error && <p className="text-xs text-orange-400 bg-orange-500/[0.07] rounded-lg px-3 py-2">{error}</p>}
            <button
              onClick={() => setAddOpen(true)}
              className="w-full text-center p-3 rounded-2xl border border-dashed
                border-white/[0.12] text-zinc-100 text-sm font-medium
                hover:border-amber-400/30
                active:scale-[0.98] transition-all">
              + Add Vehicle
            </button>
            <AddVehicleModal open={addOpen} onClose={() => setAddOpen(false)} onAdded={handleAdded} />
          </div>
        )}

        {step === "location" && (
          <div className="space-y-4 text-center py-4">
            <div className="w-16 h-16 mx-auto rounded-2xl bg-amber-400/10 border border-amber-400/20
              flex items-center justify-center text-2xl">📍</div>
            <div>
              <h2 className="text-lg font-semibold text-zinc-100">Share your location</h2>
              <p className="text-sm text-zinc-500 mt-1">
                We need your current location to find nearby mechanics.
              </p>
            </div>
            {error && <p className="text-xs text-orange-400 bg-orange-500/[0.07] rounded-lg px-3 py-2 text-left">{error}</p>}
            <button
              onClick={shareLocation}
              disabled={locating}
              className="w-full py-3 rounded-2xl bg-amber-400 text-zinc-900 text-sm font-medium
                active:scale-[0.98] transition-all disabled:opacity-50">
              {locating ? "Getting location..." : "Share current location"}
            </button>
            <button onClick={onClose} className="text-zinc-500 text-sm">Cancel</button>
          </div>
        )}

        {step === "problem" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-zinc-100">What's happening?</h2>
              <button onClick={onClose} className="text-zinc-500 text-sm">Cancel</button>
            </div>
            <textarea
              rows={4}
              value={problem}
              onChange={(e) => { setProblem(e.target.value); setError(null); }}
              placeholder="e.g. Car won't start, smoke coming from the hood, flat tire on the highway..."
              className="w-full px-3.5 py-3 rounded-2xl bg-white/[0.04] border border-white/[0.08]
                text-zinc-100 text-sm placeholder:text-zinc-600 outline-none resize-none
                focus:border-amber-400/50"
            />
            {error && <p className="text-xs text-orange-400 bg-orange-500/[0.07] rounded-lg px-3 py-2">{error}</p>}
            <button
              onClick={analyzeAndSearch}
              className="w-full py-3 rounded-2xl bg-amber-400 text-zinc-900 text-sm font-medium
                active:scale-[0.98] transition-all">
              Find a mechanic
            </button>
          </div>
        )}

        {step === "analyzing" && (
          <div className="py-16 text-center space-y-4">
            <div className="w-12 h-12 mx-auto rounded-full border-2 border-amber-400/30
              border-t-amber-400 animate-spin" />
            <div>
              <p className="text-sm font-medium text-zinc-200">Analyzing your vehicle's symptoms...</p>
              <p className="text-xs text-zinc-500 mt-1">Finding the best mechanics nearby</p>
            </div>
          </div>
        )}

        {step === "results" && matchResult && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-zinc-100">Recommended mechanics</h2>
              <button onClick={onClose} className="text-zinc-500 text-sm">Cancel</button>
            </div>

            <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-4 space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs text-zinc-500">AI Diagnosis</p>
                <span className={`text-[10px] px-2 py-0.5 rounded-full border ${severityColor[matchResult.analysis.severity]}`}>
                  {matchResult.analysis.severity}
                </span>
              </div>
              <p className="text-sm text-zinc-200">{matchResult.analysis.diagnosis}</p>
              <div className="flex justify-between text-xs text-zinc-500 pt-1 border-t border-white/[0.06]">
                <span>Recommended: {matchResult.analysis.recommendedSpecialization}</span>
                <span>
                  ₱{matchResult.analysis.estimatedCostMin.toLocaleString()}–
                  {matchResult.analysis.estimatedCostMax.toLocaleString()}
                </span>
              </div>
            </div>

            {error && <p className="text-xs text-orange-400 bg-orange-500/[0.07] rounded-lg px-3 py-2">{error}</p>}

            {matchResult.candidates.length === 0 ? (
              <p className="text-sm text-zinc-500 py-8 text-center">
                No available mechanics found nearby right now. Please try again shortly.
              </p>
            ) : (
              <>
                <div className="space-y-2.5">
                  {matchResult.candidates.map((c) => {
                    const isSelected = selectedCandidate?.mechanicId === c.mechanicId;
                    return (
                      <button
                        key={c.mechanicId}
                        onClick={() => selectCandidate(c)}
                        className={`w-full text-left p-3.5 rounded-2xl border active:scale-[0.98] transition-all ${
                          isSelected
                            ? "bg-amber-400/[0.08] border-amber-400/50"
                            : "bg-white/[0.03] border-white/[0.08] hover:border-amber-400/30"
                        }`}>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            {isSelected && (
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                                <path d="M20 6L9 17l-5-5" stroke="#F59E0B" strokeWidth="2.5"
                                  strokeLinecap="round" strokeLinejoin="round" />
                              </svg>
                            )}
                            <p className="text-sm font-medium text-zinc-100">{c.name}</p>
                          </div>
                          <span className="text-xs font-semibold text-amber-400">{c.matchScore}% match</span>
                        </div>
                        <p className="text-xs text-zinc-500 mt-0.5">
                          {c.shopName ?? "Independent mechanic"} · {c.specialization}
                        </p>
                        <div className="flex gap-3 mt-1.5 text-xs text-zinc-400">
                          <span>{c.distanceKm} km</span>
                          <span>ETA {c.etaMinutes} min</span>
                          {c.rating > 0 && <span>★ {c.rating}</span>}
                        </div>
                      </button>
                    );
                  })}
                </div>

                {/* Explicit commit action — separate from selection */}
                <button
                  onClick={handleConfirm}
                  disabled={!selectedCandidate}
                  className="w-full py-3.5 rounded-2xl bg-amber-400 text-zinc-900 text-sm font-bold
                    active:scale-[0.98] transition-all disabled:opacity-40 disabled:cursor-not-allowed">
                  {selectedCandidate ? `Confirm ${selectedCandidate.name}` : "Select a mechanic to continue"}
                </button>
              </>
            )}
          </div>
        )}

        {step === "confirming" && (
          <div className="py-16 text-center space-y-4">
            <div className="w-12 h-12 mx-auto rounded-full border-2 border-amber-400/30
              border-t-amber-400 animate-spin" />
            <p className="text-sm font-medium text-zinc-200">
              Sending request to {selectedCandidate?.name}...
            </p>
          </div>
        )}
      </div>
    </div>
  );
 }