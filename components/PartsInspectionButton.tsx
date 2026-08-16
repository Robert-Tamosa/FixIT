"use client";

import { useState } from "react";
import { CameraCaptureButton } from "./vehicle/CameraCaptureButton";
import { inspectVehicleParts, type DisplayInspectionFlag, type InspectionResult } from "@/app/actions/inspection";

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
 * Also surfaces a source-authenticity warning when the model spots visible
 * signs the photo may not be an original (watermarks, screenshot chrome,
 * stock-photo staging) — best-effort heuristic, not real AI-generation
 * detection. Shown even when zero real issues were flagged, since a
 * suspicious-but-damage-free photo would otherwise have nowhere to surface
 * the warning.
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
  onResult?: (result: InspectionResult) => void;
}) {
  const [result, setResult] = useState<InspectionResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleCapture(dataUrl: string) {
    setError(null);
    try {
      const r = await inspectVehicleParts(dataUrl, { vehicleId, bookingId });
      setResult(r);
      onResult?.(r);
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

      {result && (
        <div className="mt-2 rounded-2xl bg-white/[0.02] border border-white/[0.06] overflow-hidden">
          {result.sourceWarning?.suspicious && (
            <div className="px-3 py-2.5 border-b border-red-400/20 bg-red-400/[0.06] space-y-1">
              <p className="text-xs font-medium text-red-400 flex items-center gap-1.5">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M12 9v4M12 17h.01M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"
                    stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                This may not be an original photo
              </p>
              {result.sourceWarning.reasons.length > 0 && (
                <ul className="text-[10px] text-red-300/80 list-disc list-inside space-y-0.5">
                  {result.sourceWarning.reasons.map((reason, i) => (
                    <li key={i}>{reason}</li>
                  ))}
                </ul>
              )}
            </div>
          )}
          <div className="p-3 space-y-2">
            <p className="text-[10px] text-zinc-500 leading-relaxed">
              Spotted from your photo — not a diagnosis, just flags for your mechanic to check in person.
            </p>
            {result.flags.length === 0 ? (
              <p className="text-xs text-zinc-400">No clear surface issues spotted in this photo.</p>
            ) : (
              <div className="space-y-1.5">
                {result.flags.map((f) => (
                  <div key={f.id} className={`text-xs px-2.5 py-2 rounded-lg border ${
                    f.severity ? SEVERITY_STYLES[f.severity] ?? SEVERITY_STYLES.minor : SEVERITY_STYLES.minor
                  }`}>
                    {f.description}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}