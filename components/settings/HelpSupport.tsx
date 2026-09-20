"use client";

import { useState } from "react";
import { SettingsPageShell } from "./SettingsPageShell";

// Placeholder copy — swap FAQ content and contact details for the real
// ones before this ships. Kept static/client-only, no server round trip,
// since none of this depends on user-specific data.

const FAQS: { q: string; a: string }[] = [
  {
    q: "How do I book a mechanic?",
    a: "From Home, tap \"Book Service\", pick a mechanic or shop, describe the problem, and choose a time slot.",
  },
  {
    q: "What if it's an emergency?",
    a: "Tap the Emergency button on Home. FixIT auto-assigns the nearest available mechanic or shop instead of you picking one manually.",
  },
  {
    q: "How do I pay?",
    a: "Cash, GCash, or Maya — whichever the mechanic/shop has set up. You'll see the options once the job is marked done.",
  },
  {
    q: "My location permission isn't working.",
    a: "Location permission is shared across the whole site, not per feature — if you denied it once anywhere, check your browser's site settings and allow location for this app.",
  },
];

export function HelpSupport({ backHref }: { backHref: string }) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <SettingsPageShell title="Help & Support" backHref={backHref}>
      {/* FAQ */}
      <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] overflow-hidden mb-4">
        {FAQS.map((item, i) => (
          <div key={item.q} className={i > 0 ? "border-t border-white/[0.06]" : ""}>
            <button
              onClick={() => setOpenIndex(openIndex === i ? null : i)}
              aria-expanded={openIndex === i}
              className="w-full flex items-center justify-between px-4 py-3.5 text-left">
              <span className="text-sm font-medium text-zinc-200 pr-3">{item.q}</span>
              <svg
                width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true"
                className={`shrink-0 transition-transform duration-200 ${openIndex === i ? "rotate-180" : ""}`}>
                <path d="M6 9l6 6 6-6" stroke="#71717A" strokeWidth="1.8"
                  strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            {openIndex === i && (
              <p className="px-4 pb-3.5 text-xs text-zinc-500 leading-relaxed">{item.a}</p>
            )}
          </div>
        ))}
      </div>

      {/* Contact */}
      <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-4 space-y-3">
        <p className="text-sm font-semibold text-zinc-100">Still need help?</p>
        <a href="mailto:support@fixit.app"
          className="flex items-center gap-2.5 text-sm text-zinc-400 hover:text-amber-400 transition-colors">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"
              stroke="currentColor" strokeWidth="1.5" />
            <path d="M22 6l-10 7L2 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          support@fixit.app
        </a>
        <a href="tel:+639171234567"
          className="flex items-center gap-2.5 text-sm text-zinc-400 hover:text-amber-400 transition-colors">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"
              stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          +63 917 123 4567
        </a>
      </div>
    </SettingsPageShell>
  );
}