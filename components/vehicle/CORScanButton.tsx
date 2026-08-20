"use client";

import { useState } from "react";
import { CameraCaptureButton } from "./CameraCaptureButton";
import { scanCOR, confirmVehicleDocument, type DisplayVehicleDocument } from "@/app/actions/document-analysis";

type Fields = DisplayVehicleDocument["fields"];

const FIELD_LABELS: Record<keyof Fields, string> = {
  plateNumber: "Plate Number",
  mvFileNumber: "MV File Number",
  engineNumber: "Engine Number",
  chassisNumber: "Chassis Number",
  make: "Make",
  series: "Series",
  bodyType: "Body Type",
  color: "Color",
  yearModel: "Year Model",
  grossWeight: "Gross Weight",
  ownerName: "Owner Name",
};

/**
 * Camera icon + "Scan COR" flow. Two ways to use it:
 *
 * 1. Existing vehicle (vehicle profile page): pass `vehicleId`. On confirm,
 *    the fields are saved straight onto that vehicle.
 *
 * 2. New vehicle (booking modal's Add Vehicle step): omit `vehicleId`, pass
 *    `onFieldsReady` instead. The scan runs unattached to any vehicle; once
 *    the owner reviews/edits and hits Confirm, `onFieldsReady` fires with
 *    the final fields (for you to prefill your existing Add Vehicle form's
 *    brand/model/plate/etc. inputs — COR's "make"/"series" map loosely to
 *    brand/model, not exactly, so those two fields come through as a
 *    starting point the owner can still edit in the form). You're
 *    responsible for calling `confirmVehicleDocument(documentId, fields,
 *    newVehicleId)` yourself right after your existing createVehicle action
 *    succeeds, to attach the document — see the `documentId` this callback
 *    also receives.
 */
export function CORScanButton({
  vehicleId,
  onFieldsReady,
}: {
  vehicleId?: string;
  onFieldsReady?: (fields: Fields, documentId: string) => void;
}) {
  const [doc, setDoc] = useState<DisplayVehicleDocument | null>(null);
  const [edited, setEdited] = useState<Fields | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [acknowledged, setAcknowledged] = useState(false);

  async function handleCapture(dataUrl: string) {
    const result = await scanCOR(dataUrl, vehicleId);
    if (result.status === "FAILED") {
      setError(result.failReason ?? "Couldn't read this photo — try retaking it with better lighting");
      return;
    }
    setDoc(result);
    setEdited(result.fields);
    setAcknowledged(false);
  }

  async function handleConfirm() {
    if (!doc || !edited) return;
    setSaving(true);
    setError(null);
    try {
      if (vehicleId) {
        // Existing-vehicle path: save straight onto the vehicle.
        await confirmVehicleDocument(doc.id, edited);
        setDoc(null);
        setEdited(null);
      } else {
        // New-vehicle path: hand the reviewed fields back to the caller.
        // The caller attaches the document once their own createVehicle
        // call gives them a real vehicleId.
        onFieldsReady?.(edited, doc.id);
        setDoc(null);
        setEdited(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save");
    } finally {
      setSaving(false);
    }
  }

  if (doc && edited) {
    return (
      <div className="rounded-2xl bg-white/[0.02] border border-white/[0.06] p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-medium text-zinc-200">Review scanned details</h4>
          {doc.confidence !== null && (
            <span className={`text-[10px] px-2 py-0.5 rounded-full border ${
              doc.confidence >= 0.7
                ? "text-emerald-400 bg-emerald-400/10 border-emerald-400/20"
                : "text-amber-400 bg-amber-400/10 border-amber-400/20"
            }`}>
              {Math.round(doc.confidence * 100)}% confidence
            </span>
          )}
        </div>
        <p className="text-xs text-zinc-500">
          Double-check these — anything the scan couldn't read clearly is left blank.
        </p>

        {doc.sourceSuspicious && (
          <div className="rounded-xl bg-red-400/10 border border-red-400/20 p-3 space-y-2">
            <p className="text-xs font-medium text-red-400 flex items-center gap-1.5">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M12 9v4M12 17h.01M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"
                  stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              This photo may not be an original photo of your document
            </p>
            {doc.sourceFlagReasons.length > 0 && (
              <ul className="text-[11px] text-red-300/80 list-disc list-inside space-y-0.5">
                {doc.sourceFlagReasons.map((reason, i) => (
                  <li key={i}>{reason}</li>
                ))}
              </ul>
            )}
            <label className="flex items-start gap-2 pt-1 cursor-pointer">
              <input
                type="checkbox"
                checked={acknowledged}
                onChange={(e) => setAcknowledged(e.target.checked)}
                className="mt-0.5 accent-amber-400"
              />
              <span className="text-[11px] text-zinc-300">
                I confirm this is a real photo of my own vehicle's registration document.
              </span>
            </label>
          </div>
        )}

        <div className="grid grid-cols-2 gap-2">
          {(Object.keys(FIELD_LABELS) as (keyof Fields)[]).map((key) => (
            <div key={key} className="col-span-1">
              <label className="text-[10px] text-zinc-500 block mb-1">{FIELD_LABELS[key]}</label>
              <input
                value={edited[key] ?? ""}
                onChange={(e) => setEdited({ ...edited, [key]: e.target.value || null })}
                placeholder="—"
                className="w-full px-2.5 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.08]
                  text-xs text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-amber-400/40"
              />
            </div>
          ))}
        </div>

        {error && (
          <p className="text-xs text-red-400 bg-red-400/10 border border-red-400/20 rounded-lg px-3 py-2">
            {error}
          </p>
        )}

        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => { setDoc(null); setEdited(null); }}
            disabled={saving}
            className="flex-1 rounded-xl border border-white/[0.08] text-zinc-300 text-xs font-medium py-2 disabled:opacity-50"
          >
            Discard
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={saving || (doc.sourceSuspicious && !acknowledged)}
            className="flex-1 rounded-xl bg-amber-400 text-zinc-900 text-xs font-semibold py-2 disabled:opacity-50"
          >
            {saving ? "Saving…" : "Confirm"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <CameraCaptureButton actionLabel="Scan COR" onCapture={handleCapture} maxDimension={2000} />
      {error && !doc && (
        <p className="text-xs text-red-400 mt-1">{error}</p>
      )}
    </div>
  );
}