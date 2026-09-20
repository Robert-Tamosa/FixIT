"use client";

import { useRouter } from "next/navigation";
import type { ReactNode } from "react";

// Shared across Notifications / Privacy & Security / Help & Support, and
// across all three roles — this is the one piece of chrome (back button,
// header, background) that's genuinely identical everywhere, so it lives
// here once instead of being copy-pasted 3x like SettingsDrawer was.

export function SettingsPageShell({
  title,
  backHref,
  children,
}: {
  title:    string;
  backHref: string;
  children: ReactNode;
}) {
  const router = useRouter();

  return (
    <div className="min-h-screen w-full bg-[#080909] relative">
      <div aria-hidden="true" className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[700px] h-[450px]
          bg-amber-400/[0.025] rounded-full blur-[130px]" />
        <div className="absolute inset-0 opacity-[0.012]"
          style={{
            backgroundImage: "radial-gradient(circle, #F59E0B 1px, transparent 1px)",
            backgroundSize:  "28px 28px",
          }} />
      </div>

      <div className="relative z-10 w-full max-w-lg mx-auto p-4 pb-16">
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={() => router.push(backHref)}
            aria-label="Back"
            className="w-9 h-9 rounded-xl bg-white/[0.04] border border-white/[0.08]
              flex items-center justify-center hover:bg-white/[0.07] transition-colors shrink-0">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M15 18l-6-6 6-6" stroke="#A1A1AA" strokeWidth="2"
                strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <h1 className="text-lg font-black text-zinc-100">{title}</h1>
        </div>

        {children}
      </div>
    </div>
  );
}