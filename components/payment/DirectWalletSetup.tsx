"use client";

import { useEffect, useState } from "react";
import { CameraCaptureButton } from "../vehicle/CameraCaptureButton";
import {
  getMyDirectPaymentSetup,
  saveDirectPaymentQr,
  removeDirectPaymentQr,
  type MyDirectPaymentSetup,
  type DirectWalletInfo,
} from "@/app/actions/direct-payment-setup";

const PROVIDER_LABEL: Record<"gcash" | "maya", string> = { gcash: "GCash", maya: "Maya" };

/**
 * Lets a mechanic or shop register their own GCash/Maya QR so owners can
 * pay them directly, bypassing the platform entirely. Drop this into the
 * mechanic profile page or the shop profile page — same component works
 * for both, since the underlying action branches on role automatically.
 */
export function DirectWalletSetup() {
  const [setup, setSetup] = useState<MyDirectPaymentSetup | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getMyDirectPaymentSetup()
      .then(setSetup)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function refresh() {
    const s = await getMyDirectPaymentSetup();
    setSetup(s);
  }

  if (loading) {
    return (
      <div className="rounded-2xl bg-white/[0.02] border border-white/[0.06] p-4 flex items-center gap-2">
        <span className="w-4 h-4 rounded-full border-2 border-zinc-600 border-t-amber-400 animate-spin" />
        <span className="text-sm text-zinc-400">Loading…</span>
      </div>
    );
  }

  return (
    <div className="rounded-2xl bg-white/[0.02] border border-white/[0.06] p-4 space-y-4">
      <div>
        <h3 className="text-sm font-medium text-zinc-200">Direct Payment Setup</h3>
        <p className="text-xs text-zinc-500 mt-1">
          Let owners pay you directly via GCash or Maya — money goes straight to your own account, not through FixIT. Optional; owners can still pay cash or through FixIT's online checkout either way.
        </p>
      </div>

      <ProviderRow provider="gcash" info={setup?.gcash ?? null} onChanged={refresh} />
      <ProviderRow provider="maya" info={setup?.maya ?? null} onChanged={refresh} />
    </div>
  );
}

function ProviderRow({
  provider,
  info,
  onChanged,
}: {
  provider: "gcash" | "maya";
  info: DirectWalletInfo | null;
  onChanged: () => void;
}) {
  const [editing, setEditing] = useState(false);

  if (editing || !info) {
    return (
      <EditForm
        provider={provider}
        existing={info}
        onDone={() => { setEditing(false); onChanged(); }}
        onCancel={() => setEditing(false)}
      />
    );
  }

  return (
    <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-3 flex items-center gap-3">
      <img src={info.qrImage} alt={`${PROVIDER_LABEL[provider]} QR`} className="w-14 h-14 rounded-lg object-cover shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-sm text-zinc-200">{PROVIDER_LABEL[provider]}</p>
        <p className="text-xs text-zinc-500 truncate">{info.accountName}</p>
        <span className={`inline-block mt-1 text-[10px] px-1.5 py-0.5 rounded-full border ${
          info.isBusiness
            ? "text-emerald-400 bg-emerald-400/10 border-emerald-400/20"
            : "text-amber-400 bg-amber-400/10 border-amber-400/20"
        }`}>
          {info.isBusiness ? "Business account" : "Personal account"}
        </span>
      </div>
      <button
        onClick={() => setEditing(true)}
        className="text-xs text-zinc-400 underline underline-offset-2 shrink-0"
      >
        Edit
      </button>
    </div>
  );
}

function EditForm({
  provider,
  existing,
  onDone,
  onCancel,
}: {
  provider: "gcash" | "maya";
  existing: DirectWalletInfo | null;
  onDone: () => void;
  onCancel: () => void;
}) {
  const [qrImage, setQrImage] = useState<string | null>(existing?.qrImage ?? null);
  const [accountName, setAccountName] = useState(existing?.accountName ?? "");
  const [isBusiness, setIsBusiness] = useState(existing?.isBusiness ?? false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    if (!qrImage) { setError("Upload your QR code first"); return; }
    if (!accountName.trim()) { setError("Enter the name on the account"); return; }
    setSaving(true);
    setError(null);
    try {
      await saveDirectPaymentQr(provider, qrImage, accountName, isBusiness);
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save");
    } finally {
      setSaving(false);
    }
  }

  async function handleRemove() {
    setSaving(true);
    try {
      await removeDirectPaymentQr(provider);
      onDone();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-3.5 space-y-3">
      <p className="text-sm font-medium text-zinc-200">{PROVIDER_LABEL[provider]}</p>

      {qrImage ? (
        <div className="flex items-center gap-3">
          <img src={qrImage} alt="QR preview" className="w-16 h-16 rounded-lg object-cover" />
          <button
            type="button"
            onClick={() => setQrImage(null)}
            className="text-xs text-zinc-400 underline underline-offset-2"
          >
            Replace photo
          </button>
        </div>
      ) : (
        <div>
          <p className="text-xs text-zinc-500 mb-2">
            Upload a photo or screenshot of your {PROVIDER_LABEL[provider]} QR code (found in the app under "Receive Money" or "My QR").
          </p>
          <CameraCaptureButton
            actionLabel="Use this photo"
            onCapture={(dataUrl) => { setQrImage(dataUrl); }}
          />
        </div>
      )}

      <div>
        <label className="text-[11px] text-zinc-500 block mb-1">Name on the account</label>
        <input
          value={accountName}
          onChange={(e) => setAccountName(e.target.value)}
          placeholder="Juan Dela Cruz"
          className="w-full px-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.08]
            text-sm text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-amber-400/40"
        />
      </div>

      <label className="flex items-start gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={isBusiness}
          onChange={(e) => setIsBusiness(e.target.checked)}
          className="mt-0.5 accent-amber-400"
        />
        <span className="text-xs text-zinc-300">
          This is a registered {PROVIDER_LABEL[provider]} Business account (not my personal account)
        </span>
      </label>

      {!isBusiness && (
        <div className="rounded-lg bg-red-400/10 border border-red-400/20 p-3 space-y-1.5">
          <p className="text-xs font-medium text-red-400 flex items-center gap-1.5">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M12 9v4M12 17h.01M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"
                stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Using a personal account carries real risk
          </p>
          <p className="text-[11px] text-red-300/80 leading-relaxed">
            {PROVIDER_LABEL[provider]}'s own terms list using a personal account for business as grounds for
            suspension. Receiving payments from many different customers repeatedly — which is exactly what
            happens here — is the kind of pattern their fraud systems watch for. Personal accounts also cap at
            ₱100,000/month and don't generate BIR-compliant receipts. We'd recommend registering a{" "}
            {PROVIDER_LABEL[provider]} Business account before relying on this for real, ongoing income — this
            option is here for you to use at your own discretion in the meantime.
          </p>
        </div>
      )}

      {error && (
        <p className="text-xs text-red-400 bg-red-400/10 border border-red-400/20 rounded-lg px-3 py-2">{error}</p>
      )}

      <div className="flex gap-2">
        {existing && (
          <button
            type="button"
            onClick={handleRemove}
            disabled={saving}
            className="text-xs text-red-400 disabled:opacity-50 mr-auto"
          >
            Remove
          </button>
        )}
        <button
          type="button"
          onClick={onCancel}
          disabled={saving}
          className="px-3 py-1.5 rounded-lg border border-white/[0.08] text-xs text-zinc-300 disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="px-3 py-1.5 rounded-lg bg-amber-400 text-zinc-900 text-xs font-semibold disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save"}
        </button>
      </div>
    </div>
  );
}