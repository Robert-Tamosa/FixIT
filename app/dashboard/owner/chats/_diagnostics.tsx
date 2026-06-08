"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// ── Types ─────────────────────────────────────────────────────────────────────

interface DiagnosticResult {
  urgency:            "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  possibleCauses:     { cause: string; likelihood: "HIGH" | "MEDIUM" | "LOW"; explanation: string }[];
  recommendations:    string[];
  partsToCheck:       string[];
  estimatedCostRange: string;
  mechanicSpecialty:  string;
  safeToDrive:        boolean;
  summary:            string;
}

export interface UserVehicle {
  id:    string;
  label: string; // "Toyota Vios (2020)"
}

// ── Constants ─────────────────────────────────────────────────────────────────

const URGENCY_CONFIG = {
  LOW:      { label: "Low",      cls: "bg-emerald-400/10 border-emerald-400/25 text-emerald-400", dot: "bg-emerald-400" },
  MEDIUM:   { label: "Moderate", cls: "bg-amber-400/10   border-amber-400/25   text-amber-400",   dot: "bg-amber-400"   },
  HIGH:     { label: "High",     cls: "bg-orange-400/10  border-orange-400/25  text-orange-400",  dot: "bg-orange-400"  },
  CRITICAL: { label: "Critical", cls: "bg-red-400/10     border-red-400/25     text-red-400",     dot: "bg-red-400 animate-pulse" },
};

const LIKELIHOOD_COLOR = {
  HIGH:   "text-red-400",
  MEDIUM: "text-amber-400",
  LOW:    "text-zinc-500",
};

const SPECIALTY_LABELS: Record<string, string> = {
  ENGINE_REPAIR: "Engine Repair",
  ELECTRICAL:    "Electrical",
  BRAKES:        "Brakes",
  TIRES:         "Tires",
  AIRCON:        "Air Conditioning",
  DIAGNOSTICS:   "General Diagnostics",
};

const QUICK_SYMPTOMS = [
  "Engine won't start",
  "Overheating",
  "Unusual knocking sound",
  "Brake feels soft",
  "Check engine light on",
  "AC not cooling",
  "Battery draining fast",
  "Smoke from engine",
];

// ── Sub-components ────────────────────────────────────────────────────────────

function UrgencyBanner({ urgency }: { urgency: DiagnosticResult["urgency"] }) {
  const c = URGENCY_CONFIG[urgency];
  return (
    <div className={`flex items-center gap-3 px-4 py-3.5 rounded-2xl border ${c.cls} mb-5`}>
      <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${c.dot}`} />
      <div>
        <p className="text-sm font-bold">{c.label} Urgency</p>
        {urgency === "CRITICAL" && (
          <p className="text-xs opacity-70 mt-0.5">Stop driving — immediate attention needed</p>
        )}
        {urgency === "HIGH" && (
          <p className="text-xs opacity-70 mt-0.5">Schedule a mechanic as soon as possible</p>
        )}
      </div>
    </div>
  );
}

function Section({ title, icon, children }: {
  title: string; icon: string; children: React.ReactNode;
}) {
  return (
    <div className="mb-4 rounded-2xl border border-white/[0.08] bg-white/[0.02] overflow-hidden">
      <div className="flex items-center gap-2.5 px-4 py-3 border-b border-white/[0.07]">
        <span className="text-base">{icon}</span>
        <h3 className="text-sm font-semibold text-zinc-200">{title}</h3>
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

// ── Result Panel ──────────────────────────────────────────────────────────────

function ResultPanel({
  result,
  onBook,
  onReset,
}: {
  result:  DiagnosticResult;
  onBook:  () => void;
  onReset: () => void;
}) {
  return (
    <div className="animate-in fade-in slide-in-from-bottom-3 duration-400">
      {/* Summary */}
      <div className="mb-5 px-4 py-4 rounded-2xl bg-white/[0.03] border border-white/[0.08]">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-xl bg-amber-400/10 border border-amber-400/20
            flex items-center justify-center shrink-0 mt-0.5">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <circle cx="12" cy="12" r="10" stroke="#F59E0B" strokeWidth="1.6" />
              <path d="M12 8v4M12 16h.01" stroke="#F59E0B" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </div>
          <div>
            <p className="text-xs font-semibold text-amber-400 mb-1">AI Diagnosis Summary</p>
            <p className="text-sm text-zinc-300 leading-relaxed">{result.summary}</p>
          </div>
        </div>
      </div>

      <UrgencyBanner urgency={result.urgency} />

      {/* Safe to drive */}
      <div className={`flex items-center gap-3 mb-4 px-4 py-3 rounded-2xl border ${
        result.safeToDrive
          ? "bg-emerald-400/[0.07] border-emerald-400/20"
          : "bg-red-400/[0.07] border-red-400/20"
      }`}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          {result.safeToDrive
            ? <path d="M20 6L9 17l-5-5" stroke="#34D399" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
            : <path d="M18 6L6 18M6 6l12 12" stroke="#F87171" strokeWidth="2.2" strokeLinecap="round" />
          }
        </svg>
        <p className={`text-sm font-semibold ${result.safeToDrive ? "text-emerald-400" : "text-red-400"}`}>
          {result.safeToDrive ? "Generally safe to drive with caution" : "Not safe to drive — stop immediately"}
        </p>
      </div>

      {/* Possible causes */}
      <Section title="Possible Causes" icon="🔍">
        <div className="space-y-3">
          {result.possibleCauses.map((c, i) => (
            <div key={i} className="flex items-start gap-3">
              <span className={`text-[10px] font-bold mt-0.5 shrink-0 ${LIKELIHOOD_COLOR[c.likelihood]}`}>
                {c.likelihood}
              </span>
              <div>
                <p className="text-sm font-semibold text-zinc-200">{c.cause}</p>
                <p className="text-xs text-zinc-500 leading-relaxed mt-0.5">{c.explanation}</p>
              </div>
            </div>
          ))}
        </div>
      </Section>

      {/* Recommendations */}
      <Section title="Recommendations" icon="📋">
        <ul className="space-y-2">
          {result.recommendations.map((r, i) => (
            <li key={i} className="flex items-start gap-2.5">
              <span className="w-5 h-5 rounded-full bg-amber-400/10 border border-amber-400/20
                flex items-center justify-center text-[10px] font-bold text-amber-400 shrink-0 mt-0.5">
                {i + 1}
              </span>
              <p className="text-sm text-zinc-300 leading-relaxed">{r}</p>
            </li>
          ))}
        </ul>
      </Section>

      {/* Parts to check + cost */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-4">
          <p className="text-xs font-semibold text-zinc-500 mb-2.5 flex items-center gap-1.5">
            <span>🔧</span> Parts to Check
          </p>
          <ul className="space-y-1.5">
            {result.partsToCheck.map((p, i) => (
              <li key={i} className="text-xs text-zinc-300 flex items-center gap-1.5">
                <span className="w-1 h-1 rounded-full bg-zinc-600 shrink-0" />
                {p}
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-4 flex flex-col gap-3">
          <div>
            <p className="text-xs font-semibold text-zinc-500 mb-1 flex items-center gap-1.5">
              <span>💰</span> Est. Cost
            </p>
            <p className="text-sm font-bold text-zinc-100">{result.estimatedCostRange}</p>
          </div>
          <div>
            <p className="text-xs font-semibold text-zinc-500 mb-1 flex items-center gap-1.5">
              <span>👨‍🔧</span> Specialist
            </p>
            <p className="text-xs font-semibold text-amber-400">
              {SPECIALTY_LABELS[result.mechanicSpecialty] ?? result.mechanicSpecialty}
            </p>
          </div>
        </div>
      </div>

      {/* Disclaimer */}
      <p className="text-[11px] text-zinc-600 text-center leading-relaxed mb-5">
        This is an AI-assisted estimate only. Always have your vehicle inspected
        by a verified FixIT mechanic for an accurate diagnosis.
      </p>

      {/* CTA buttons */}
      <div className="flex gap-3">
        <button
          onClick={onReset}
          className="flex-1 py-3 rounded-xl border border-zinc-700 text-sm font-medium
            text-zinc-400 hover:text-zinc-200 hover:border-zinc-600 transition-colors"
        >
          New Diagnosis
        </button>
        <button
          onClick={onBook}
          className="flex-[2] py-3 rounded-xl bg-amber-500 text-sm font-bold text-black
            hover:bg-amber-400 active:scale-[0.98] transition-all
            shadow-[0_4px_20px_rgba(245,158,11,0.2)] flex items-center justify-center gap-2"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <rect x="3" y="4" width="18" height="18" rx="2" stroke="#080909" strokeWidth="1.6" strokeLinecap="round" />
            <path d="M16 2v4M8 2v4M3 10h18M12 14v4M10 16h4" stroke="#080909" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
          Book a Mechanic
        </button>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function DiagnosticsView({ vehicles }: { vehicles: UserVehicle[] }) {
  const router = useRouter();
  const [symptoms,   setSymptoms]   = useState("");
  const [vehicleId,  setVehicleId]  = useState(vehicles[0]?.id ?? "");
  const [loading,    setLoading]    = useState(false);
  const [error,      setError]      = useState<string | null>(null);
  const [result,     setResult]     = useState<DiagnosticResult | null>(null);

  const selectedVehicle = vehicles.find((v) => v.id === vehicleId);

  async function handleDiagnose() {
    if (!symptoms.trim() || loading) return;
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch("/api/diagnostics", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          symptoms,
          vehicleInfo: selectedVehicle?.label ?? null,
        }),
      });

      const data = await res.json();
      if (!res.ok || data.error) {
        setError(data.error ?? "Something went wrong.");
        return;
      }
      setResult(data.result);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  function handleReset() {
    setResult(null);
    setSymptoms("");
    setError(null);
  }

  return (
    <div className="min-h-screen w-full bg-[#080909] relative">
      {/* Background decoration */}
      <div aria-hidden="true" className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[800px] h-[500px]
          bg-amber-400/[0.025] rounded-full blur-[130px]" />
        <div className="absolute inset-0 opacity-[0.012]"
          style={{
            backgroundImage: "radial-gradient(circle, #F59E0B 1px, transparent 1px)",
            backgroundSize: "28px 28px",
          }} />
      </div>

      <div className="relative z-10 w-full p-4 pb-28">

        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={() => router.back()}
            className="w-9 h-9 rounded-xl bg-white/[0.04] border border-white/[0.08]
              flex items-center justify-center hover:bg-white/[0.07] transition-colors shrink-0"
            aria-label="Go back"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M19 12H5M12 5l-7 7 7 7" stroke="#71717A" strokeWidth="1.8"
                strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-lg font-black text-zinc-100">
                Fix<span className="text-amber-400">IT</span>
              </span>
              <span className="text-xs font-semibold text-amber-400 bg-amber-400/10
                border border-amber-400/20 px-2 py-0.5 rounded-full">AI</span>
            </div>
            <p className="text-xs text-zinc-500">Vehicle Diagnostics Assistant</p>
          </div>
        </div>

        {!result ? (
          <>
            {/* Intro card */}
            <div className="mb-5 px-4 py-4 rounded-2xl bg-white/[0.03] border border-white/[0.08]">
              <p className="text-sm text-zinc-400 leading-relaxed">
                Describe what your vehicle is doing and our AI will identify possible
                causes, recommend actions, and estimate repair costs.
              </p>
            </div>

            {/* Vehicle selector */}
            {vehicles.length > 0 && (
              <div className="mb-4">
                <label className="block text-xs font-medium text-zinc-500 uppercase
                  tracking-wide mb-2">
                  Select Vehicle
                </label>
                <div className="flex gap-2 flex-wrap">
                  {vehicles.map((v) => (
                    <button
                      key={v.id}
                      type="button"
                      onClick={() => setVehicleId(v.id)}
                      className={[
                        "px-3.5 py-2 rounded-xl border text-xs font-medium transition-all",
                        vehicleId === v.id
                          ? "bg-amber-400/10 border-amber-400/40 text-amber-300"
                          : "bg-white/[0.03] border-white/[0.08] text-zinc-500 hover:border-white/[0.18]",
                      ].join(" ")}
                    >
                      {v.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Quick symptom chips */}
            <div className="mb-4">
              <label className="block text-xs font-medium text-zinc-500 uppercase
                tracking-wide mb-2">
                Common Symptoms
              </label>
              <div className="flex flex-wrap gap-2">
                {QUICK_SYMPTOMS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() =>
                      setSymptoms((prev) =>
                        prev ? `${prev}, ${s.toLowerCase()}` : s
                      )
                    }
                    className="px-3 py-1.5 rounded-xl border border-white/[0.08] bg-white/[0.03]
                      text-xs text-zinc-500 hover:text-zinc-300 hover:border-white/[0.18]
                      transition-all active:scale-95"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>

            {/* Symptom textarea */}
            <div className="mb-4">
              <label htmlFor="symptoms"
                className="block text-xs font-medium text-zinc-500 uppercase tracking-wide mb-2">
                Describe Your Problem
              </label>
              <textarea
                id="symptoms"
                rows={5}
                value={symptoms}
                onChange={(e) => setSymptoms(e.target.value)}
                placeholder="e.g. My car makes a loud knocking sound when I accelerate. The oil warning light came on this morning and there's a slight burning smell..."
                className="w-full px-4 py-3.5 rounded-2xl resize-none
                  bg-white/[0.04] border border-white/[0.08] text-sm text-zinc-200
                  placeholder:text-zinc-600
                  focus:outline-none focus:border-amber-400/40 focus:bg-white/[0.06]
                  transition-colors leading-relaxed"
              />
              <p className="text-[11px] text-zinc-600 mt-1.5">
                The more detail you provide, the more accurate the diagnosis.
              </p>
            </div>

            {/* Error */}
            {error && (
              <div className="mb-4 flex items-center gap-2 px-4 py-3 rounded-xl
                bg-red-500/10 border border-red-500/20 text-sm text-red-400">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.6" />
                  <path d="M12 8v4M12 16h.01" stroke="currentColor" strokeWidth="2"
                    strokeLinecap="round" />
                </svg>
                {error}
              </div>
            )}

            {/* Analyze button */}
            <button
              onClick={handleDiagnose}
              disabled={loading || !symptoms.trim()}
              className="w-full py-[18px] rounded-2xl bg-amber-500 font-bold text-[#080909]
                hover:bg-amber-400 active:scale-[0.99]
                disabled:opacity-50 disabled:cursor-not-allowed
                shadow-[0_6px_36px_rgba(245,158,11,0.22)]
                transition-all flex items-center justify-center gap-3"
            >
              {loading ? (
                <>
                  <svg className="animate-spin" width="18" height="18" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="10" stroke="#080909" strokeWidth="3" strokeOpacity="0.25" />
                    <path d="M12 2a10 10 0 0 1 10 10" stroke="#080909" strokeWidth="3" strokeLinecap="round" />
                  </svg>
                  Analyzing symptoms…
                </>
              ) : (
                <>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <circle cx="11" cy="11" r="8" stroke="#080909" strokeWidth="1.8" />
                    <path d="M21 21l-4.35-4.35" stroke="#080909" strokeWidth="1.8" strokeLinecap="round" />
                    <path d="M11 8v6M8 11h6" stroke="#080909" strokeWidth="1.8" strokeLinecap="round" />
                  </svg>
                  Diagnose My Vehicle
                </>
              )}
            </button>
          </>
        ) : (
          <ResultPanel
            result={result}
            onBook={() => router.push("/dashboard/owner")}
            onReset={handleReset}
          />
        )}
      </div>
    </div>
  );
}