"use client";

import { useState }     from "react";
import { useRouter }    from "next/navigation";
import Link             from "next/link";

// ── Types ─────────────────────────────────────────────────────────────────────

interface Conversation {
  id:          string;
  name:        string;
  subtitle:    string;
  lastMessage: string;
  time:        string;
  unread:      number;
  isAI:        boolean;
  initials:    string;
  href:        string;
  online:      boolean;
}

// ── Mock conversations ────────────────────────────────────────────────────────
// Replace mechanic conversations with real DB data once messaging is built.
// The AI conversation always stays pinned at the top.

const CONVERSATIONS: Conversation[] = [
  {
    id:          "ai",
    name:        "FixIT AI Diagnostics",
    subtitle:    "AI Assistant",
    lastMessage: "Describe your vehicle symptoms and I'll help diagnose the issue.",
    time:        "now",
    unread:      0,
    isAI:        true,
    initials:    "AI",
    href:        "/dashboard/owner/chats/ai",
    online:      true,
  },
  {
    id:          "mech-1",
    name:        "Miguel Santos",
    subtitle:    "Engine & Transmission",
    lastMessage: "I'll be there in about 20 minutes.",
    time:        "2m",
    unread:      1,
    isAI:        false,
    initials:    "MS",
    href:        "/dashboard/owner/chats/mech-1",
    online:      true,
  },
  {
    id:          "mech-2",
    name:        "Jose Reyes",
    subtitle:    "Electrical Systems",
    lastMessage: "The part will cost around ₱1,500.",
    time:        "1h",
    unread:      0,
    isAI:        false,
    initials:    "JR",
    href:        "/dashboard/owner/chats/mech-2",
    online:      false,
  },
  {
    id:          "mech-3",
    name:        "Maria Cruz",
    subtitle:    "Brakes & Suspension",
    lastMessage: "Service completed. Thank you for choosing FixIT!",
    time:        "Yesterday",
    unread:      0,
    isAI:        false,
    initials:    "MC",
    href:        "/dashboard/owner/chats/mech-3",
    online:      false,
  },
];

// ── Conversation Row ──────────────────────────────────────────────────────────

function ConversationRow({ conv }: { conv: Conversation }) {
  return (
    <Link
      href={conv.href}
      className="flex items-center gap-3.5 px-4 py-3.5
        hover:bg-white/[0.04] active:bg-white/[0.06]
        transition-colors cursor-pointer"
    >
      {/* Avatar */}
      <div className="relative shrink-0">
        <div className={[
          "w-12 h-12 rounded-full flex items-center justify-center text-sm font-bold",
          conv.isAI
            ? "bg-gradient-to-br from-amber-400 to-yellow-500"
            : "bg-white/[0.08] border border-white/[0.1] text-zinc-300",
        ].join(" ")}>
          {conv.isAI ? (
            // Brain/AI icon for FixIT AI
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96-.44 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24 2.5 2.5 0 0 1 4.44-1.66z"
                stroke="#080909" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96-.44 2.5 2.5 0 0 0 2.96-3.08 3 3 0 0 0 .34-5.58 2.5 2.5 0 0 0-1.32-4.24 2.5 2.5 0 0 0-4.44-1.66z"
                stroke="#080909" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          ) : (
            conv.initials
          )}
        </div>

        {/* Online dot */}
        {conv.online && (
          <span className="absolute bottom-0 right-0 w-3 h-3 rounded-full
            bg-emerald-400 border-2 border-[#080909]" />
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-0.5">
          <div className="flex items-center gap-1.5 min-w-0">
            <p className={`text-sm truncate ${conv.unread > 0 ? "font-bold text-zinc-100" : "font-medium text-zinc-200"}`}>
              {conv.name}
            </p>
            {conv.isAI && (
              <span className="shrink-0 text-[9px] font-bold text-amber-400
                bg-amber-400/10 border border-amber-400/20 px-1.5 py-0.5 rounded-full">
                AI
              </span>
            )}
          </div>
          <span className={`text-[11px] shrink-0 ml-2 ${conv.unread > 0 ? "text-amber-400 font-semibold" : "text-zinc-600"}`}>
            {conv.time}
          </span>
        </div>
        <div className="flex items-center justify-between gap-2">
          <p className={`text-xs truncate ${conv.unread > 0 ? "text-zinc-300" : "text-zinc-500"}`}>
            {conv.subtitle !== "AI Assistant" && (
              <span className="text-zinc-600">{conv.subtitle} · </span>
            )}
            {conv.lastMessage}
          </p>
          {conv.unread > 0 && (
            <span className="shrink-0 min-w-[18px] h-[18px] rounded-full bg-amber-400
              flex items-center justify-center text-[10px] font-bold text-[#080909] px-1">
              {conv.unread}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ChatListPage() {
  const router  = useRouter();
  const [query, setQuery] = useState("");

  const filtered = CONVERSATIONS.filter((c) =>
    c.name.toLowerCase().includes(query.toLowerCase()) ||
    c.lastMessage.toLowerCase().includes(query.toLowerCase())
  );

  // Separate AI (always first) from mechanic conversations
  const aiConv       = filtered.filter((c) =>  c.isAI);
  const mechanicConvs = filtered.filter((c) => !c.isAI);

  return (
    <div className="min-h-screen w-full bg-[#080909] flex flex-col">

      {/* ── Header ── */}
      <div className="sticky top-0 z-10 bg-[#080909]/95 backdrop-blur-xl
        border-b border-white/[0.06]">
        <div className="flex items-center gap-3 px-4 py-3.5">
          <button
            onClick={() => router.back()}
            aria-label="Go back"
            className="w-9 h-9 rounded-xl bg-white/[0.04] border border-white/[0.08]
              flex items-center justify-center hover:bg-white/[0.07] transition-colors shrink-0"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M19 12H5M12 5l-7 7 7 7" stroke="#71717A" strokeWidth="1.8"
                strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <h1 className="text-[17px] font-bold text-zinc-100 flex-1">Messages</h1>
          {/* Compose button (placeholder) */}
          <button
            aria-label="New message"
            className="w-9 h-9 rounded-xl bg-white/[0.04] border border-white/[0.08]
              flex items-center justify-center hover:bg-white/[0.07] transition-colors"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M12 5H7a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-5"
                stroke="#71717A" strokeWidth="1.6" strokeLinecap="round" />
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"
                stroke="#71717A" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>

        {/* Search bar */}
        <div className="px-4 pb-3">
          <div className="relative">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
              className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
              aria-hidden="true">
              <circle cx="11" cy="11" r="8" stroke="#52525B" strokeWidth="1.6" />
              <path d="M21 21l-4.35-4.35" stroke="#52525B" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
            <input
              type="search"
              placeholder="Search conversations…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 rounded-xl
                bg-white/[0.05] border border-white/[0.07]
                text-sm text-zinc-200 placeholder:text-zinc-600
                outline-none focus:border-amber-400/40 focus:bg-white/[0.07]
                transition-colors"
            />
          </div>
        </div>
      </div>

      {/* ── Conversation list ── */}
      <div className="flex-1 overflow-y-auto">

        {/* FixIT AI — always pinned at top */}
        {aiConv.length > 0 && (
          <div>
            <p className="px-4 pt-4 pb-1 text-[10px] font-semibold text-zinc-600
              uppercase tracking-wider">
              AI Assistant
            </p>
            {aiConv.map((c) => (
              <ConversationRow key={c.id} conv={c} />
            ))}
          </div>
        )}

        {/* Divider */}
        {aiConv.length > 0 && mechanicConvs.length > 0 && (
          <div className="mx-4 my-1 h-px bg-white/[0.05]" />
        )}

        {/* Mechanic conversations */}
        {mechanicConvs.length > 0 && (
          <div>
            <p className="px-4 pt-3 pb-1 text-[10px] font-semibold text-zinc-600
              uppercase tracking-wider">
              Mechanics
            </p>
            {mechanicConvs.map((c) => (
              <ConversationRow key={c.id} conv={c} />
            ))}
          </div>
        )}

        {/* Empty state */}
        {filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 gap-3 px-8 text-center">
            <div className="w-14 h-14 rounded-2xl bg-white/[0.04] border border-white/[0.07]
              flex items-center justify-center">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"
                  stroke="#52525B" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <p className="text-zinc-400 font-semibold">No conversations found</p>
            <p className="text-xs text-zinc-600">
              Try a different search or book a mechanic to start chatting.
            </p>
          </div>
        )}

        {/* Bottom padding for nav */}
        <div className="h-24" />
      </div>
    </div>
  );
}