"use client";

import { useState } from "react";

export default function EmergencyButton() {
  const [dispatched, setDispatched] = useState(false);
  

  if (dispatched) {
    return (
      <div
        className="mb-5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 px-5 py-4
        flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-emerald-500/20 flex items-center justify-center shrink-0">
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden="true">
            <path
              d="M20 6L9 17l-5-5"
              stroke="#34D399"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
        <div>
          <p className="text-sm font-semibold text-emerald-400">
            Help is on the way
          </p>
          <p className="text-xs text-zinc-500">
            Nearest mechanic dispatched · Est. 8 mins
          </p>
        </div>
        <button
          onClick={() => setDispatched(false)}
          className="ml-auto text-xs text-zinc-600 hover:text-zinc-400 transition-colors">
          Cancel
        </button>
      </div>
    );
  }

  return (
    <div className="relative mb-3">
      <div
        aria-hidden="true"
        className="absolute inset-0 rounded-2xl bg-red-500/15 animate-ping"
        style={{ animationDuration: "2.5s" }}
      />
      <button
        onClick={() => setDispatched(true)}
        className="relative w-full py-[18px] rounded-2xl
          bg-gradient-to-r from-red-600 to-rose-500
          border border-red-500/30
          flex items-center justify-center gap-3.5
          active:scale-[0.98] transition-transform duration-100
          shadow-[0_6px_36px_rgba(239,68,68,0.28)]">
        <svg
          width="22"
          height="22"
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden="true">
          <path
            d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"
            fill="white"
            fillOpacity="0.15"
            stroke="white"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <line
            x1="12"
            y1="9"
            x2="12"
            y2="13"
            stroke="white"
            strokeWidth="2"
            strokeLinecap="round"
          />
          <line
            x1="12"
            y1="17"
            x2="12.01"
            y2="17"
            stroke="white"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
        </svg>
        <div className="text-left">
          <p className="text-white font-bold text-[15px] leading-tight">
            Emergency — Get Help Now
          </p>
          <p className="text-white/55 text-xs mt-0.5">
            Dispatch nearest available mechanic
          </p>
        </div>
      </button>
    </div>
  );
}