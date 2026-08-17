import { SessionUser } from "@/types";
import { useState } from "react";

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export default function Header({ user }: { user: SessionUser }) {
  const h = new Date().getHours();
  const greeting  = h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
  const firstName = user.name.split(" ")[0];
  const initials  = getInitials(user.name);
  const [query, setQuery] = useState("");

  return (
    <div className="mb-6">
      {/* Top row: logo · greeting · notification + avatar */}
      <div className="flex items-center justify-between mb-3">
        <div>
          <div className="flex items-center gap-2 mb-0.5">
            <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden="true">
              <path d="M10 2L4 4.5V10.5C4 14.7 6.8 18.5 10 19.5C13.2 18.5 16 14.7 16 10.5V4.5L10 2Z"
                fill="#F59E0B" fillOpacity="0.25" stroke="#F59E0B" strokeWidth="1.2" />
              <path d="M7.5 10.5L9.5 12.5L13.5 8.5" stroke="#F59E0B" strokeWidth="1.4"
                strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span className="text-[20px] font-black tracking-tight text-zinc-100 leading-none">
              Fix<span className="text-amber-400">IT</span>
            </span>
          </div>
          <p className="text-sm text-zinc-500">
            {greeting},{" "}
            <span className="text-zinc-300 font-medium">{firstName}</span> 👋
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            aria-label="Notifications"
            className="relative w-10 h-10 rounded-xl bg-white/[0.04] border border-white/[0.08]
              flex items-center justify-center hover:bg-white/[0.07] transition-colors"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" stroke="#71717A" strokeWidth="1.6"
                strokeLinecap="round" strokeLinejoin="round" />
              <path d="M13.73 21a2 2 0 0 1-3.46 0" stroke="#71717A" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
            <span className="absolute top-2 right-2 w-2 h-2 bg-amber-400 rounded-full border-2 border-[#080909]" />
          </button>
          <div className="w-10 h-10 rounded-xl bg-amber-400/10 border border-amber-400/20 flex items-center justify-center">
            <span className="text-[11px] font-bold text-amber-400">{initials}</span>
          </div>
        </div>
      </div>

      {/* Search bar — centred below the top row */}
      <div className="relative w-full">
        <svg
          className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
          width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true"
        >
          <circle cx="11" cy="11" r="8" stroke="#52525B" strokeWidth="1.8" />
          <path d="M21 21l-4.35-4.35" stroke="#52525B" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search mechanics, services…"
          className="w-full pl-10 pr-4 py-2.5 rounded-xl
            bg-white/[0.04] border border-white/[0.08]
            text-sm text-zinc-200 placeholder:text-zinc-600
            focus:outline-none focus:border-amber-400/40 focus:bg-white/[0.06]
            transition-colors"
        />
      </div>
    </div>
  );
}