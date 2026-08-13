"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { addVehicle, type AddVehicleState } from "@/app/actions/add-vehicle";
import { CORScanButton } from "@/components/vehicle/CORScanButton";
import type { DisplayVehicleDocument } from "@/app/actions/document-analysis";
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

// ── Add Vehicle Modal ─────────────────────────────────────────────────────────
function AddVehicleModal({
  open,
  onClose,
  onSuccess,
}: {
  open: boolean;
  onClose: () => void;
  onSuccess: (v: Vehicle) => void;
}) {
  const initialState: AddVehicleState = { status: "idle" };
  const [state, formAction, pending] = useActionState(addVehicle, initialState);
  const formRef = useRef<HTMLFormElement>(null);

  // Refs so a COR scan can prefill these plain uncontrolled inputs without
  // restructuring the whole form into controlled state.
  const brandRef = useRef<HTMLInputElement>(null);
  const modelRef = useRef<HTMLInputElement>(null);
  const plateRef = useRef<HTMLInputElement>(null);
  const yearRef = useRef<HTMLInputElement>(null);
  const colorRef = useRef<HTMLInputElement>(null);

  // Set once a COR scan is confirmed — carried to the server as hidden
  // fields so addVehicle.ts can attach the document to the new vehicle.
  const [corDocumentId, setCorDocumentId] = useState<string | null>(null);
  const [corFields, setCorFields] = useState<DisplayVehicleDocument["fields"] | null>(null);

  function handleCorFieldsReady(fields: DisplayVehicleDocument["fields"], documentId: string) {
    setCorDocumentId(documentId);
    setCorFields(fields);
    // Best-effort prefill — COR's "make"/"series" map loosely to brand/model,
    // not exactly, so leave them editable rather than treating this as final.
    if (fields.make && brandRef.current) brandRef.current.value = fields.make;
    if (fields.series && modelRef.current) modelRef.current.value = fields.series;
    if (fields.plateNumber && plateRef.current) plateRef.current.value = fields.plateNumber;
    if (fields.yearModel && yearRef.current) yearRef.current.value = fields.yearModel;
    if (fields.color && colorRef.current) colorRef.current.value = fields.color;
  }

  // Close + propagate new vehicle on success
  useEffect(() => {
    if (state.status === "success") {
      formRef.current?.reset();
      setCorDocumentId(null);
      setCorFields(null);
      onClose();
    }
  }, [state, onClose]);

  // Trap focus / close on Escape
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    /* Backdrop */
    <div
      className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center
        bg-black/70 backdrop-blur-sm px-4 pb-4 sm:pb-0"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      role="dialog" aria-modal="true" aria-label="Add vehicle"
    >
      {/* Sheet */}
      <div
        className="w-full max-w-md rounded-3xl border border-zinc-800
          bg-[#0e0e0f] shadow-2xl overflow-hidden
          animate-in slide-in-from-bottom-4 duration-300"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-6 pb-4
          border-b border-zinc-800/60">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-amber-400/10 border border-amber-400/20
              flex items-center justify-center">
              <CarIcon className="text-amber-400" />
            </div>
            <h2 className="text-base font-semibold text-zinc-100">Add a Vehicle</h2>
          </div>
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

        {/* Form */}
        <form ref={formRef} action={formAction} className="px-6 py-5 space-y-4">

          {/* COR scan — optional shortcut to prefill the fields below */}
          <div className="rounded-2xl border border-dashed border-white/[0.12] p-3 flex items-center gap-3">
            <div className="flex-1">
              <p className="text-xs font-medium text-zinc-300">Have your COR handy?</p>
              <p className="text-[11px] text-zinc-600 mt-0.5">Scan it to fill in the details below</p>
            </div>
            <CORScanButton onFieldsReady={handleCorFieldsReady} />
          </div>
          {corDocumentId && (
            <p className="text-[11px] text-emerald-400 -mt-2">
              Scanned — details prefilled below, double-check before saving.
            </p>
          )}
          <input type="hidden" name="corDocumentId" value={corDocumentId ?? ""} />
          <input type="hidden" name="corFields" value={corFields ? JSON.stringify(corFields) : ""} />

          {/* Brand + Model (side by side) */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label htmlFor="brand"
                className="block text-xs font-medium text-zinc-400 uppercase tracking-wide">
                Brand <span className="text-red-500">*</span>
              </label>
              <input
                ref={brandRef}
                id="brand" name="brand" type="text"
                placeholder="Toyota"
                required
                className="w-full px-3.5 py-2.5 rounded-xl
                  bg-white/[0.04] border border-white/[0.08] text-sm text-zinc-200
                  placeholder:text-zinc-600
                  focus:outline-none focus:border-amber-400/50 focus:bg-white/[0.06]
                  transition-colors"
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="model"
                className="block text-xs font-medium text-zinc-400 uppercase tracking-wide">
                Model <span className="text-red-500">*</span>
              </label>
              <input
                ref={modelRef}
                id="model" name="model" type="text"
                placeholder="Vios"
                required
                className="w-full px-3.5 py-2.5 rounded-xl
                  bg-white/[0.04] border border-white/[0.08] text-sm text-zinc-200
                  placeholder:text-zinc-600
                  focus:outline-none focus:border-amber-400/50 focus:bg-white/[0.06]
                  transition-colors"
              />
            </div>
          </div>

          {/* Plate number */}
          <div className="space-y-1.5">
            <label htmlFor="plateNumber"
              className="block text-xs font-medium text-zinc-400 uppercase tracking-wide">
              Plate Number
            </label>
            <input
              ref={plateRef}
              id="plateNumber" name="plateNumber" type="text"
              placeholder="ABC 1234  (optional)"
              className="w-full px-3.5 py-2.5 rounded-xl
                bg-white/[0.04] border border-white/[0.08] text-sm text-zinc-200
                placeholder:text-zinc-600
                focus:outline-none focus:border-amber-400/50 focus:bg-white/[0.06]
                transition-colors uppercase"
            />
          </div>

          {/* Year + Color */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label htmlFor="year"
                className="block text-xs font-medium text-zinc-400 uppercase tracking-wide">
                Year
              </label>
              <input
                ref={yearRef}
                id="year" name="year" type="number"
                placeholder="2020"
                min="1970" max={new Date().getFullYear() + 1}
                className="w-full px-3.5 py-2.5 rounded-xl
                  bg-white/[0.04] border border-white/[0.08] text-sm text-zinc-200
                  placeholder:text-zinc-600
                  focus:outline-none focus:border-amber-400/50 focus:bg-white/[0.06]
                  transition-colors [appearance:textfield]
                  [&::-webkit-inner-spin-button]:appearance-none"
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="color"
                className="block text-xs font-medium text-zinc-400 uppercase tracking-wide">
                Color
              </label>
              <input
                ref={colorRef}
                id="color" name="color" type="text"
                placeholder="White"
                className="w-full px-3.5 py-2.5 rounded-xl
                  bg-white/[0.04] border border-white/[0.08] text-sm text-zinc-200
                  placeholder:text-zinc-600
                  focus:outline-none focus:border-amber-400/50 focus:bg-white/[0.06]
                  transition-colors"
              />
            </div>
          </div>

          {/* Error message */}
          {state.status === "error" && (
            <p className="flex items-center gap-2 text-sm text-red-400
              bg-red-500/10 border border-red-500/20 rounded-xl px-3.5 py-2.5">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.6" />
                <path d="M12 8v4M12 16h.01" stroke="currentColor" strokeWidth="2"
                  strokeLinecap="round" />
              </svg>
              {state.message}
            </p>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-1">
            <button
              type="button" onClick={onClose}
              className="flex-1 py-2.5 rounded-xl border border-zinc-700 text-sm
                font-medium text-zinc-400 hover:text-zinc-200 hover:border-zinc-600
                transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={pending}
              className="flex-1 py-2.5 rounded-xl bg-amber-500 text-sm font-semibold
                text-black hover:bg-amber-400 active:scale-[0.98]
                disabled:opacity-50 disabled:cursor-not-allowed
                transition-all flex items-center justify-center gap-2"
            >
              {pending ? (
                <>
                  <svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24"
                    fill="none" aria-hidden="true">
                    <circle cx="12" cy="12" r="10" stroke="currentColor"
                      strokeWidth="3" strokeOpacity="0.25" />
                    <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor"
                      strokeWidth="3" strokeLinecap="round" />
                  </svg>
                  Saving…
                </>
              ) : "Save Vehicle"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Main Card ─────────────────────────────────────────────────────────────────
export default function VehicleSummaryCard({
  vehicles: initialVehicles,
}: {
  vehicles: Vehicle[];
}) {
  const vehicles = initialVehicles;
  const [modalOpen, setModalOpen] = React.useState(false);

  function handleSuccess(_newVehicle: Vehicle) {
  setModalOpen(false);
}
  return (
    <>
      <div className="rounded-3xl border border-zinc-800 bg-black/40 p-6">
        {/* Header */}
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white">My Vehicles</h2>
          <button
            type="button"
            onClick={() => setModalOpen(true)}
            className="flex items-center gap-1.5 text-sm font-medium text-amber-400
              hover:text-amber-300 transition-colors"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"
              aria-hidden="true">
              <path d="M12 5v14M5 12h14" />
            </svg>
            Add Vehicle
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

      <AddVehicleModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSuccess={handleSuccess}
      />
    </>
  );
}