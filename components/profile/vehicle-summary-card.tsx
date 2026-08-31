"use client";

import { useState } from "react";
import { ManageVehiclesModal } from "@/components/vehicle/ManageVehiclesModal";
import React from "react";

interface Vehicle {
  id: string;
  brand: string;
  model: string;
  plateNumber: string | null;
}

// ── Car icon ──────────────────────────────────────────────────────────────────
function CarIcon({ className }: { className?: string }) {
  return (
    <svg
      width="16" height="16" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"
      strokeLinejoin="round" className={className} aria-hidden="true"
    >
      <path d="M5 17H3v-5l2-5h14l2 5v5h-2" />
      <circle cx="7.5" cy="17.5" r="1.5" />
      <circle cx="16.5" cy="17.5" r="1.5" />
      <path d="M5 12h14" />
    </svg>
  );
}

// ── Main Card ─────────────────────────────────────────────────────────────────
export default function VehicleSummaryCard({
  vehicles: initialVehicles,
}: {
  vehicles: Vehicle[];
}) {
  const [vehicles, setVehicles] = useState(initialVehicles);
  const [manageOpen, setManageOpen] = useState(false);

  return (
    <>
      <div className="rounded-3xl border border-zinc-800 bg-black/40 p-6">
        {/* Header */}
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white">My Vehicles</h2>
          <button
            type="button"
            onClick={() => setManageOpen(true)}
            className="flex items-center gap-1.5 text-sm font-medium text-amber-400
              hover:text-amber-300 transition-colors"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"
              strokeLinejoin="round" aria-hidden="true">
              <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
            </svg>
            Manage Vehicles
          </button>
        </div>

        {/* Count */}
        <h2 className="mt-2 text-3xl font-bold text-white">{vehicles.length}</h2>

        {/* Vehicle list */}
        <div className="mt-3 space-y-3">
          {vehicles.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-zinc-800 py-6
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
                <div className="min-w-0">
                  <p className="font-medium text-white truncate">
                    {vehicle.brand} {vehicle.model}
                  </p>
                  <p className="text-sm text-zinc-500">
                    {vehicle.plateNumber ?? "No plate number"}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <ManageVehiclesModal
        open={manageOpen}
        onClose={() => setManageOpen(false)}
        vehicles={vehicles}
        onChange={setVehicles}
      />
    </>
  );
}