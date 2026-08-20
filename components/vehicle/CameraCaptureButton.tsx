"use client";

import { useEffect, useRef, useState } from "react";

/** Converts a File to a base64 data URL. */
function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("Couldn't read the photo"));
    reader.readAsDataURL(file);
  });
}

/**
 * Downscales + re-compresses an image data URL via canvas. Phone camera
 * photos routinely run 2–10MB — base64-encoded, that alone can exceed Next.js
 * Server Actions' default 1MB request body limit before the request even
 * reaches the server (a 413, not a graceful error — it shows up client-side
 * as something trying to JSON.parse a plain-text rejection). This also cuts
 * Groq vision-API image tokens for no real quality loss: a vision model
 * doesn't need 4000x3000 to spot a dent or read a document field.
 *
 * Falls back to the original data URL untouched if canvas isn't available
 * for any reason — better to send something too large than nothing at all.
 */
function resizeImage(dataUrl: string, maxDimension: number, quality: number): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      let { width, height } = img;
      if (width > maxDimension || height > maxDimension) {
        if (width > height) {
          height = Math.round((height / width) * maxDimension);
          width = maxDimension;
        } else {
          width = Math.round((width / height) * maxDimension);
          height = maxDimension;
        }
      }
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) { resolve(dataUrl); return; }
      ctx.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL("image/jpeg", quality));
    };
    img.onerror = () => resolve(dataUrl); // fall back to original rather than block capture entirely
    img.src = dataUrl;
  });
}

/**
 * Camera icon button. Tapping it opens a small menu with two choices:
 *   - "Take Photo" — forces the device camera directly, via a hidden file
 *     input with capture="environment" (mobile browsers skip the gallery
 *     picker entirely when this attribute is present).
 *   - "Choose from Gallery" — a plain file input with no capture attribute,
 *     opens the normal file/photo picker instead.
 * Once a photo is picked either way, shows a preview with a confirm-labeled
 * action button and a retake option.
 */
export function CameraCaptureButton({
  actionLabel,
  onCapture,
  disabled,
  maxDimension = 1600,
  quality = 0.85,
}: {
  /** Text on the button shown after a photo is taken, e.g. "Scan COR" or "Inspect Parts Problems" */
  actionLabel: string;
  /** Called with the captured photo's data URL when the person taps the action button */
  onCapture: (dataUrl: string) => void | Promise<void>;
  disabled?: boolean;
  /** Longest edge, in pixels, the photo gets downscaled to before preview/send.
   * Default 1600 is plenty for spotting visible damage; CORScanButton passes
   * a higher value since small document text needs more resolution to stay legible. */
  maxDimension?: number;
  quality?: number;
}) {
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Close the menu on an outside click, since there's no backdrop.
  useEffect(() => {
    if (!menuOpen) return;
    function onClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    }
    window.addEventListener("mousedown", onClick);
    return () => window.removeEventListener("mousedown", onClick);
  }, [menuOpen]);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setProcessing(true);
    try {
      const raw = await fileToDataUrl(file);
      const resized = await resizeImage(raw, maxDimension, quality);
      setPreview(resized);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't load photo");
    } finally {
      setProcessing(false);
      e.target.value = ""; // allow re-selecting the same file later
    }
  }

  async function handleConfirm() {
    if (!preview) return;
    setBusy(true);
    setError(null);
    try {
      await onCapture(preview);
      setPreview(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  if (preview) {
    return (
      <div className="rounded-2xl bg-white/[0.02] border border-white/[0.06] p-3 space-y-2">
        <img src={preview} alt="Captured photo" className="w-full max-h-48 object-cover rounded-xl" />
        {error && (
          <p className="text-xs text-red-400 bg-red-400/10 border border-red-400/20 rounded-lg px-3 py-2">
            {error}
          </p>
        )}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setPreview(null)}
            disabled={busy}
            className="flex-1 rounded-xl border border-white/[0.08] text-zinc-300 text-xs font-medium py-2 disabled:opacity-50"
          >
            Retake
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={busy}
            className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-amber-400 text-zinc-900 text-xs font-semibold py-2 disabled:opacity-50"
          >
            {busy && <span className="w-3.5 h-3.5 rounded-full border-2 border-zinc-600 border-t-zinc-900 animate-spin" />}
            {busy ? "Analyzing…" : actionLabel}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative inline-block">
      {/* Forces the camera directly — no gallery option on most mobile browsers when capture is set */}
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleFileChange}
        className="hidden"
      />
      {/* Plain file input — opens the normal photo/file picker, no capture attribute */}
      <input
        ref={galleryInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        className="hidden"
      />

      <button
        type="button"
        onClick={() => setMenuOpen((v) => !v)}
        disabled={disabled || processing}
        aria-label="Add a photo"
        aria-expanded={menuOpen}
        className="w-9 h-9 rounded-xl bg-white/[0.04] border border-white/[0.08]
          flex items-center justify-center hover:bg-white/[0.07] transition-colors disabled:opacity-50 shrink-0"
      >
        {processing ? (
          <span className="w-3.5 h-3.5 rounded-full border-2 border-zinc-600 border-t-amber-400 animate-spin" />
        ) : (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"
              stroke="#F59E0B" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            <circle cx="12" cy="13" r="4" stroke="#F59E0B" strokeWidth="1.6" />
          </svg>
        )}
      </button>

      {menuOpen && (
        <div
          ref={menuRef}
          className="absolute bottom-full mb-2 left-0 z-20 w-44 rounded-xl border border-white/[0.08]
            bg-[#161616] shadow-xl overflow-hidden"
        >
          <button
            type="button"
            onClick={() => { setMenuOpen(false); cameraInputRef.current?.click(); }}
            className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-xs text-zinc-200 hover:bg-white/[0.06] transition-colors text-left"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"
                stroke="#F59E0B" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
              <circle cx="12" cy="13" r="4" stroke="#F59E0B" strokeWidth="1.6" />
            </svg>
            Take Photo
          </button>
          <div className="h-px bg-white/[0.06]" />
          <button
            type="button"
            onClick={() => { setMenuOpen(false); galleryInputRef.current?.click(); }}
            className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-xs text-zinc-200 hover:bg-white/[0.06] transition-colors text-left"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <rect x="3" y="3" width="18" height="18" rx="2" stroke="#F59E0B" strokeWidth="1.6" />
              <circle cx="8.5" cy="8.5" r="1.5" stroke="#F59E0B" strokeWidth="1.6" />
              <path d="M21 15l-5-5L5 21" stroke="#F59E0B" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Choose from Gallery
          </button>
        </div>
      )}

      {error && <p className="text-xs text-red-400 mt-1">{error}</p>}
    </div>
  );
}