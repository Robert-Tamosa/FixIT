"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";

// ── Types ─────────────────────────────────────────────────────────────────────

interface Message {
  id:      string;
  role:    "user" | "assistant";
  content: string;
  loading?: boolean;
}

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

// ── Constants ─────────────────────────────────────────────────────────────────

const URGENCY_CONFIG = {
  LOW:      { label: "Low Urgency",      cls: "text-emerald-400 bg-emerald-400/10 border-emerald-400/20" },
  MEDIUM:   { label: "Moderate Urgency", cls: "text-amber-400   bg-amber-400/10   border-amber-400/20"   },
  HIGH:     { label: "High Urgency",     cls: "text-orange-400  bg-orange-400/10  border-orange-400/20"  },
  CRITICAL: { label: "Critical",         cls: "text-red-400     bg-red-400/10     border-red-400/20"     },
};

const LIKELIHOOD_COLOR = { HIGH: "text-red-400", MEDIUM: "text-amber-400", LOW: "text-zinc-500" };

const QUICK_PROMPTS = [
  "Engine won't start",
  "Car overheating",
  "Brake feels soft",
  "AC not cooling",
  "Check engine light on",
  "Unusual knocking sound",
];

// ── Diagnostic Result Card ────────────────────────────────────────────────────

function DiagnosticCard({ result }: { result: DiagnosticResult }) {
  const urg = URGENCY_CONFIG[result.urgency];
  return (
    <div className="mt-2 rounded-2xl border border-white/[0.08] bg-white/[0.03] overflow-hidden">
      {/* Summary */}
      <div className="px-4 py-3.5 border-b border-white/[0.07]">
        <p className="text-sm text-zinc-300 leading-relaxed">{result.summary}</p>
      </div>

      {/* Urgency + safe to drive */}
      <div className="flex items-center gap-2.5 px-4 py-3 border-b border-white/[0.07]">
        <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-lg border ${urg.cls}`}>
          {urg.label}
        </span>
        <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-lg border ${
          result.safeToDrive
            ? "text-emerald-400 bg-emerald-400/10 border-emerald-400/20"
            : "text-red-400 bg-red-400/10 border-red-400/20"
        }`}>
          {result.safeToDrive ? "Safe to drive" : "Do not drive"}
        </span>
      </div>

      {/* Possible causes */}
      <div className="px-4 py-3 border-b border-white/[0.07]">
        <p className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wide mb-2.5">
          Possible Causes
        </p>
        <div className="space-y-2.5">
          {result.possibleCauses.map((c, i) => (
            <div key={i} className="flex items-start gap-2">
              <span className={`text-[10px] font-bold mt-0.5 shrink-0 ${LIKELIHOOD_COLOR[c.likelihood]}`}>
                {c.likelihood}
              </span>
              <div>
                <p className="text-xs font-semibold text-zinc-200">{c.cause}</p>
                <p className="text-[11px] text-zinc-500 leading-relaxed mt-0.5">{c.explanation}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Recommendations */}
      <div className="px-4 py-3 border-b border-white/[0.07]">
        <p className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wide mb-2.5">
          Recommendations
        </p>
        <ul className="space-y-1.5">
          {result.recommendations.map((r, i) => (
            <li key={i} className="flex items-start gap-2">
              <span className="w-4 h-4 rounded-full bg-amber-400/10 border border-amber-400/20
                flex items-center justify-center text-[9px] font-bold text-amber-400 shrink-0 mt-0.5">
                {i + 1}
              </span>
              <p className="text-xs text-zinc-300 leading-relaxed">{r}</p>
            </li>
          ))}
        </ul>
      </div>

      {/* Parts + cost */}
      <div className="grid grid-cols-2 divide-x divide-white/[0.07]">
        <div className="px-4 py-3">
          <p className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wide mb-2">
            Parts to Check
          </p>
          <ul className="space-y-1">
            {result.partsToCheck.map((p, i) => (
              <li key={i} className="flex items-center gap-1.5">
                <span className="w-1 h-1 rounded-full bg-zinc-600 shrink-0" />
                <span className="text-[11px] text-zinc-300">{p}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="px-4 py-3">
          <p className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wide mb-2">
            Est. Cost
          </p>
          <p className="text-sm font-bold text-zinc-100">{result.estimatedCostRange}</p>
          <p className="text-[11px] text-amber-400 mt-2 font-medium">{result.mechanicSpecialty}</p>
        </div>
      </div>
    </div>
  );
}

// ── Message Bubble ────────────────────────────────────────────────────────────

function MessageBubble({ msg }: { msg: Message }) {
  const isUser = msg.role === "user";

  // Try to parse AI result from assistant messages
  let parsed: DiagnosticResult | null = null;
  if (!isUser && !msg.loading) {
    try {
      parsed = JSON.parse(msg.content);
    } catch {
      parsed = null;
    }
  }

  return (
    <div className={`flex gap-2.5 ${isUser ? "flex-row-reverse" : "flex-row"}`}>
      {/* Avatar */}
      {!isUser && (
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-amber-400 to-yellow-500
          flex items-center justify-center shrink-0 mt-1">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96-.44 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24 2.5 2.5 0 0 1 4.44-1.66z"
              stroke="#080909" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96-.44 2.5 2.5 0 0 0 2.96-3.08 3 3 0 0 0 .34-5.58 2.5 2.5 0 0 0-1.32-4.24 2.5 2.5 0 0 0-4.44-1.66z"
              stroke="#080909" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
      )}

      <div className={`max-w-[85%] ${isUser ? "items-end" : "items-start"} flex flex-col`}>
        {msg.loading ? (
          <div className="flex items-center gap-2 px-4 py-3 rounded-2xl rounded-tl-sm
            bg-white/[0.04] border border-white/[0.08]">
            <span className="w-1.5 h-1.5 rounded-full bg-zinc-500 animate-bounce"
              style={{ animationDelay: "0ms" }} />
            <span className="w-1.5 h-1.5 rounded-full bg-zinc-500 animate-bounce"
              style={{ animationDelay: "150ms" }} />
            <span className="w-1.5 h-1.5 rounded-full bg-zinc-500 animate-bounce"
              style={{ animationDelay: "300ms" }} />
          </div>
        ) : isUser ? (
          <div className="px-4 py-2.5 rounded-2xl rounded-tr-sm bg-amber-500">
            <p className="text-sm font-medium text-[#080909]">{msg.content}</p>
          </div>
        ) : parsed ? (
          <DiagnosticCard result={parsed} />
        ) : (
          <div className="px-4 py-2.5 rounded-2xl rounded-tl-sm
            bg-white/[0.04] border border-white/[0.08]">
            <p className="text-sm text-zinc-300 leading-relaxed">{msg.content}</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main Chat Page ────────────────────────────────────────────────────────────

export default function AIDiagnosticsChatPage() {
  const router = useRouter();
  const [messages,  setMessages]  = useState<Message[]>([
    {
      id:      "welcome",
      role:    "assistant",
      content: '{"urgency":"LOW","possibleCauses":[],"recommendations":["Describe your vehicle symptoms and I\'ll help diagnose the issue."],"partsToCheck":[],"estimatedCostRange":"—","mechanicSpecialty":"DIAGNOSTICS","safeToDrive":true,"summary":"Hi! I\'m the FixIT AI Diagnostic Assistant. Tell me what\'s wrong with your vehicle — sounds, warning lights, performance issues — and I\'ll identify possible causes and recommend next steps."}',
    },
  ]);
  const [input,     setInput]     = useState("");
  const [loading,   setLoading]   = useState(false);
  const bottomRef  = useRef<HTMLDivElement>(null);
  const inputRef   = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function sendMessage(text?: string) {
    const content = (text ?? input).trim();
    if (!content || loading) return;

    const userMsg: Message = { id: Date.now().toString(), role: "user", content };
    const loadingMsg: Message = { id: "loading", role: "assistant", content: "", loading: true };

    setMessages((prev) => [...prev, userMsg, loadingMsg]);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/diagnostics", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ symptoms: content }),
      });

      const data = await res.json();
      const reply = data.error
        ? data.error
        : JSON.stringify(data.result);

      setMessages((prev) => [
        ...prev.filter((m) => m.id !== "loading"),
        { id: Date.now().toString(), role: "assistant", content: reply },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev.filter((m) => m.id !== "loading"),
        { id: Date.now().toString(), role: "assistant",
          content: "Network error. Please try again." },
      ]);
    } finally {
      setLoading(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  return (
    <div className="min-h-screen w-full bg-[#080909] flex flex-col relative">
      {/* Background */}
      <div aria-hidden="true" className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[600px] h-[400px]
          bg-amber-400/[0.02] rounded-full blur-[120px]" />
      </div>

      {/* Header */}
      <div className="sticky top-0 z-10 bg-[#080909]/95 backdrop-blur-xl
        border-b border-white/[0.06] px-4 py-3.5 flex items-center gap-3">
        <button onClick={() => router.back()}
          className="w-9 h-9 rounded-xl bg-white/[0.04] border border-white/[0.08]
            flex items-center justify-center hover:bg-white/[0.07] transition-colors shrink-0"
          aria-label="Go back">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M19 12H5M12 5l-7 7 7 7" stroke="#71717A" strokeWidth="1.8"
              strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>

        {/* AI avatar */}
        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-amber-400 to-yellow-500
          flex items-center justify-center shrink-0">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96-.44 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24 2.5 2.5 0 0 1 4.44-1.66z"
              stroke="#080909" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96-.44 2.5 2.5 0 0 0 2.96-3.08 3 3 0 0 0 .34-5.58 2.5 2.5 0 0 0-1.32-4.24 2.5 2.5 0 0 0-4.44-1.66z"
              stroke="#080909" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold text-zinc-100">FixIT AI Diagnostics</p>
            <span className="text-[10px] font-semibold text-amber-400
              bg-amber-400/10 border border-amber-400/20 px-1.5 py-0.5 rounded-full">
              AI
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            <p className="text-[11px] text-zinc-500">Online</p>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 pb-36">
        {messages.map((msg) => (
          <MessageBubble key={msg.id} msg={msg} />
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Quick prompts + input — sticky bottom */}
      <div className="sticky bottom-0 bg-[#080909]/95 backdrop-blur-xl
        border-t border-white/[0.06] px-4 pt-3 pb-6">
        {/* Quick prompts */}
        <div className="flex gap-2 overflow-x-auto pb-2.5 scrollbar-none">
          {QUICK_PROMPTS.map((p) => (
            <button key={p} type="button"
              onClick={() => sendMessage(p)}
              disabled={loading}
              className="shrink-0 px-3 py-1.5 rounded-xl border border-white/[0.08]
                bg-white/[0.03] text-[11px] text-zinc-500
                hover:text-zinc-300 hover:border-white/[0.18]
                disabled:opacity-40 transition-all active:scale-95">
              {p}
            </button>
          ))}
        </div>

        {/* Input row */}
        <div className="flex items-end gap-2.5 mt-1">
          <textarea
            ref={inputRef}
            rows={1}
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              e.target.style.height = "auto";
              e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`;
            }}
            onKeyDown={handleKeyDown}
            disabled={loading}
            placeholder="Describe your vehicle symptoms…"
            className="flex-1 px-4 py-3 rounded-2xl resize-none overflow-hidden
              bg-white/[0.04] border border-white/[0.08] text-sm text-zinc-200
              placeholder:text-zinc-600
              focus:outline-none focus:border-amber-400/40 focus:bg-white/[0.06]
              disabled:opacity-50 transition-colors leading-relaxed"
            style={{ minHeight: "48px", maxHeight: "120px" }}
          />
          <button
            onClick={() => sendMessage()}
            disabled={loading || !input.trim()}
            aria-label="Send"
            className="w-12 h-12 rounded-2xl bg-amber-500 flex items-center justify-center
              hover:bg-amber-400 active:scale-95 transition-all
              disabled:opacity-40 disabled:cursor-not-allowed
              shadow-[0_4px_20px_rgba(245,158,11,0.25)] shrink-0">
            {loading ? (
              <svg className="animate-spin" width="16" height="16" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" stroke="#080909" strokeWidth="3" strokeOpacity="0.25" />
                <path d="M12 2a10 10 0 0 1 10 10" stroke="#080909" strokeWidth="3" strokeLinecap="round" />
              </svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M22 2L11 13M22 2L15 22l-4-9-9-4 20-7z"
                  stroke="#080909" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}