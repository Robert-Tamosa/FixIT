"use client";

import { useState } from "react";
import { CameraCaptureButton } from "./vehicle/CameraCaptureButton";
import { inspectVehicleParts, type DisplayInspectionFlag } from "@/app/actions/inspection";

const SEVERITY_STYLES: Record<string, string> = {
  minor: "text-zinc-400 bg-white/[0.03] border-white/[0.08]",
  moderate: "text-amber-400 bg-amber-400/10 border-amber-400/20",
  needs_attention: "text-red-400 bg-red-400/10 border-red-400/20",
};

/**
 * Camera icon for the AI diagnostics chat. Tapping it captures a photo,
 * shows an "Inspect Parts Problems" button, then renders whatever surface
 * issues the model flagged. Deliberately NOT framed as a diagnosis — per
 * spec this is a triage aid for a mechanic to verify, so the panel always
 * carries a visible "not a diagnosis" disclaimer and never escalates
 * language beyond what the model returned.
 *
 * Drop this into the chat's input toolbar next to wherever the text input
 * lives. `vehicleId`/`bookingId` should come from whatever vehicle/booking
 * context your AI chat page already tracks — pass through if available,
 * both are optional on the backend.
 *
 * `onResult` lets the chat page insert the result as a message bubble in
 * the existing conversation flow instead of (or in addition to) the inline
 * panel this component renders itself.
 */
export function PartsInspectionButton({
  vehicleId,
  bookingId,
  onResult,
}: {
  vehicleId?: string;
  bookingId?: string;
  onResult?: (flags: DisplayInspectionFlag[]) => void;
}) {
  const [flags, setFlags] = useState<DisplayInspectionFlag[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleCapture(dataUrl: string) {
    setError(null);
    try {
      const result = await inspectVehicleParts(dataUrl, { vehicleId, bookingId });
      setFlags(result);
      onResult?.(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't analyze this photo — try again");
    }
  }

  return (
    <div>
      <CameraCaptureButton actionLabel="Inspect Parts Problems" onCapture={handleCapture} />

      {error && (
        <p className="text-xs text-red-400 bg-red-400/10 border border-red-400/20 rounded-lg px-3 py-2 mt-2">
          {error}
        </p>
      )}

      {flags && (
        <div className="mt-2 rounded-2xl bg-white/[0.02] border border-white/[0.06] p-3 space-y-2">
          <p className="text-[10px] text-zinc-500 leading-relaxed">
            Spotted from your photo — not a diagnosis, just flags for your mechanic to check in person.
          </p>
          {flags.length === 0 ? (
            <p className="text-xs text-zinc-400">No clear surface issues spotted in this photo.</p>
          ) : (
            <div className="space-y-1.5">
              {flags.map((f) => (
                <div key={f.id} className={`text-xs px-2.5 py-2 rounded-lg border ${
                  f.severity ? SEVERITY_STYLES[f.severity] ?? SEVERITY_STYLES.minor : SEVERITY_STYLES.minor
                }`}>
                  {f.description}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}