"use client";

import { useEffect, useState } from "react";
import { AddVehicleModal, type AddedVehicle } from "@/components/vehicle/AddVehicleForm";
import { removeVehicle } from "@/app/actions/remove-vehicle";

interface Vehicle {
  id: string;
  brand: string;
  model: string;
  plateNumber: string | null;
}

function CarIcon({ className }: { className?: string }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M5 17H3v-5l2-5h14l2 5v5h-2" />
      <circle cx="7.5" cy="17.5" r="1.5" />
      <circle cx="16.5" cy="17.5" r="1.5" />
      <path d="M5 12h14" />
    </svg>
  );
}

export function ManageVehiclesModal({
  open,
  onClose,
  vehicles: initialVehicles,
  onChange,
}: {
  open: boolean;
  onClose: () => void;
  vehicles: Vehicle[];
  /** Fired after any add/remove, so a caller like VehicleSummaryCard can
   * keep its own read-only summary in sync without needing a full page
   * reload — the original component never did this at all (its onSuccess
   * prop was accepted but its vehicle argument was intentionally unused). */
  onChange?: (vehicles: Vehicle[]) => void;
}) {
  const [vehicles, setVehicles] = useState(initialVehicles);
  const [addOpen, setAddOpen] = useState(false);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setVehicles(initialVehicles);
  }, [initialVehicles]);

  function handleAdded(vehicle: AddedVehicle) {
    const next = [vehicle, ...vehicles];
    setVehicles(next);
    onChange?.(next);
  }

  async function handleRemove(vehicleId: string) {
    setError(null);
    setRemovingId(vehicleId);
    const result = await removeVehicle(vehicleId);
    setRemovingId(null);
    if (result.status === "error") {
      setError(result.message);
      return;
    }
    const next = vehicles.filter((v) => v.id !== vehicleId);
    setVehicles(next);
    onChange?.(next);
    setConfirmingId(null);
  }

  if (!open) return null;

  return (
    <>
      <div
        className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center
          bg-black/70 backdrop-blur-sm px-4 pb-4 sm:pb-0"
        onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
        role="dialog" aria-modal="true" aria-label="Manage vehicles"
      >
        <div className="w-full max-w-md rounded-3xl border border-zinc-800
          bg-[#0e0e0f] shadow-2xl overflow-hidden max-h-[85vh] flex flex-col
          animate-in slide-in-from-bottom-4 duration-300">

          <div className="flex items-center justify-between px-6 pt-6 pb-4
            border-b border-zinc-800/60 shrink-0">
            <h2 className="text-base font-semibold text-zinc-100">Manage Vehicles</h2>
            <button
              type="button" onClick={onClose}
              aria-label="Close"
              className="w-8 h-8 rounded-lg flex items-center justify-center
                text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.05]
                transition-colors"
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                <path d="M1 1l12 12M13 1L1 13" stroke="currentColor" strokeWidth="1.6"
                  strokeLinecap="round" />
              </svg>
            </button>
          </div>

          <div className="px-6 py-4 space-y-2.5 overflow-y-auto flex-1">
            {error && (
              <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20
                rounded-xl px-3.5 py-2.5">
                {error}
              </p>
            )}

            {vehicles.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-zinc-800 py-8
                flex flex-col items-center gap-2">
                <CarIcon className="text-zinc-600 w-6 h-6" />
                <p className="text-sm text-zinc-600">No vehicles added yet</p>
              </div>
            ) : (
              vehicles.map((vehicle) => (
                <div key={vehicle.id}
                  className="flex items-center gap-3 rounded-2xl border border-zinc-800 p-4">
                  <div className="w-9 h-9 rounded-xl bg-zinc-800/60 flex items-center
                    justify-center shrink-0">
                    <CarIcon className="text-zinc-400" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-white truncate">
                      {vehicle.brand} {vehicle.model}
                    </p>
                    <p className="text-sm text-zinc-500">
                      {vehicle.plateNumber ?? "No plate number"}
                    </p>
                  </div>

                  {confirmingId === vehicle.id ? (
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => setConfirmingId(null)}
                        disabled={removingId === vehicle.id}
                        className="text-xs text-zinc-500 px-2 py-1.5 disabled:opacity-50"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRemove(vehicle.id)}
                        disabled={removingId === vehicle.id}
                        className="text-xs text-red-400 bg-red-500/10 border border-red-500/20
                          rounded-lg px-2.5 py-1.5 disabled:opacity-50"
                      >
                        {removingId === vehicle.id ? "Removing…" : "Confirm"}
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => { setError(null); setConfirmingId(vehicle.id); }}
                      aria-label={`Remove ${vehicle.brand} ${vehicle.model}`}
                      className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0
                        text-zinc-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                    >
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                        <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6h14z"
                          stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </button>
                  )}
                </div>
              ))
            )}
          </div>

          <div className="px-6 pb-6 pt-2 shrink-0">
            <button
              type="button"
              onClick={() => setAddOpen(true)}
              className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-xl
                border border-amber-400/30 text-amber-400 text-sm font-medium
                hover:bg-amber-400/10 transition-colors"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
                <path d="M12 5v14M5 12h14" />
              </svg>
              Add Vehicle
            </button>
          </div>
        </div>
      </div>

      <AddVehicleModal open={addOpen} onClose={() => setAddOpen(false)} onAdded={handleAdded} />
    </>
  );
}