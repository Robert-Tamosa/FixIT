"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";

// ── Types ─────────────────────────────────────────────────────────────────────

interface Conversation {
  id:           string; // bookingId
  ownerName:    string;
  ownerInitials:string;
  vehicleLabel: string;
  lastMessage:  string;
  time:         string;
  unread:       number;
  status:       "PENDING" | "CONFIRMED" | "EN_ROUTE" | "IN_PROGRESS" | "DONE" | "CANCELLED";
}

interface ChatMessage {
  id:        string;
  role:      "mechanic" | "owner" | "system";
  content:   string;
  timestamp: string;
}

export interface MechanicChatsProps {
  conversations: Conversation[];
  mechanicName:  string;
  mechanicInitials: string;
}

// ── Status badge ──────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<string, { label: string; cls: string }> = {
  PENDING:     { label: "Pending",     cls: "text-amber-400   bg-amber-400/10   border-amber-400/20"   },
  CONFIRMED:   { label: "Confirmed",   cls: "text-sky-400     bg-sky-400/10     border-sky-400/20"     },
  EN_ROUTE:    { label: "En Route",    cls: "text-blue-400    bg-blue-400/10    border-blue-400/20"    },
  IN_PROGRESS: { label: "In Progress", cls: "text-orange-400  bg-orange-400/10  border-orange-400/20"  },
  DONE:        { label: "Completed",   cls: "text-emerald-400 bg-emerald-400/10 border-emerald-400/20" },
  CANCELLED:   { label: "Cancelled",   cls: "text-red-400     bg-red-400/10     border-red-400/20"     },
};

function StatusBadge({ status }: { status: string }) {
  const c = STATUS_CONFIG[status] ?? STATUS_CONFIG.PENDING;
  return (
    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-md border ${c.cls}`}>
      {c.label}
    </span>
  );
}

// ── Conversation List ─────────────────────────────────────────────────────────

function ConversationList({
  conversations,
  selected,
  onSelect,
}: {
  conversations: Conversation[];
  selected:      string | null;
  onSelect:      (id: string) => void;
}) {
  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 py-4 border-b border-white/[0.07]">
        <h1 className="text-base font-bold text-zinc-100">Messages</h1>
        <p className="text-xs text-zinc-500 mt-0.5">
          {conversations.length} conversation{conversations.length !== 1 ? "s" : ""}
        </p>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        {conversations.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 px-6 text-center">
            <div className="w-12 h-12 rounded-2xl bg-white/[0.04] border border-white/[0.08]
              flex items-center justify-center">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"
                  stroke="#52525B" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <p className="text-sm text-zinc-500">No conversations yet</p>
            <p className="text-xs text-zinc-600">
              Conversations will appear here once you accept bookings
            </p>
          </div>
        ) : (
          conversations.map((c) => (
            <button
              key={c.id}
              onClick={() => onSelect(c.id)}
              className={[
                "w-full flex items-center gap-3 px-4 py-3.5 text-left transition-colors",
                "border-b border-white/[0.05]",
                selected === c.id
                  ? "bg-amber-400/[0.07] border-l-2 border-l-amber-400"
                  : "hover:bg-white/[0.03]",
              ].join(" ")}
            >
              {/* Avatar */}
              <div className="w-11 h-11 rounded-full bg-zinc-800 border border-white/[0.08]
                flex items-center justify-center shrink-0 text-sm font-bold text-zinc-300">
                {c.ownerInitials}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-0.5">
                  <p className="text-sm font-semibold text-zinc-100 truncate">{c.ownerName}</p>
                  <span className="text-[10px] text-zinc-600 shrink-0 ml-2">{c.time}</span>
                </div>
                <p className="text-xs text-zinc-500 truncate mb-1">{c.vehicleLabel}</p>
                <div className="flex items-center gap-2">
                  <StatusBadge status={c.status} />
                  {c.unread > 0 && (
                    <span className="w-4 h-4 rounded-full bg-amber-400 flex items-center
                      justify-center text-[9px] font-bold text-[#080909] shrink-0 ml-auto">
                      {c.unread}
                    </span>
                  )}
                </div>
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  );
}

// ── Chat View ─────────────────────────────────────────────────────────────────

function ChatView({
  conversation,
  mechanicName,
  mechanicInitials,
  onBack,
}: {
  conversation:     Conversation;
  mechanicName:     string;
  mechanicInitials: string;
  onBack:           () => void;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id:        "sys-1",
      role:      "system",
      content:   `Booking created · ${conversation.vehicleLabel}`,
      timestamp: conversation.time,
    },
    {
      id:        "owner-1",
      role:      "owner",
      content:   `Hi, I need help with my ${conversation.vehicleLabel}. ${conversation.lastMessage}`,
      timestamp: conversation.time,
    },
  ]);
  const [input,   setInput]   = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef  = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  function sendMessage() {
    const content = input.trim();
    if (!content || sending) return;

    const msg: ChatMessage = {
      id:        Date.now().toString(),
      role:      "mechanic",
      content,
      timestamp: new Date().toLocaleTimeString("en-PH", {
        hour: "2-digit", minute: "2-digit",
      }),
    };

    setMessages((prev) => [...prev, msg]);
    setInput("");
    // TODO: persist message via server action / real-time (e.g. Pusher, Supabase Realtime)
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Chat header */}
      <div className="flex items-center gap-3 px-4 py-3.5 border-b border-white/[0.07]">
        <button onClick={onBack}
          className="w-8 h-8 rounded-xl bg-white/[0.04] border border-white/[0.08]
            flex items-center justify-center hover:bg-white/[0.07] transition-colors shrink-0 md:hidden"
          aria-label="Back">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M19 12H5M12 5l-7 7 7 7" stroke="#71717A" strokeWidth="1.8"
              strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>

        <div className="w-9 h-9 rounded-full bg-zinc-800 border border-white/[0.08]
          flex items-center justify-center shrink-0 text-sm font-bold text-zinc-300">
          {conversation.ownerInitials}
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-zinc-100 truncate">{conversation.ownerName}</p>
          <p className="text-xs text-zinc-500 truncate">{conversation.vehicleLabel}</p>
        </div>

        <StatusBadge status={conversation.status} />
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {messages.map((msg) => {
          if (msg.role === "system") {
            return (
              <div key={msg.id} className="flex justify-center">
                <span className="text-[11px] text-zinc-600 bg-white/[0.03]
                  border border-white/[0.07] px-3 py-1 rounded-full">
                  {msg.content}
                </span>
              </div>
            );
          }

          const isMechanic = msg.role === "mechanic";
          return (
            <div key={msg.id}
              className={`flex gap-2.5 ${isMechanic ? "flex-row-reverse" : "flex-row"}`}>
              {/* Avatar */}
              <div className={`w-7 h-7 rounded-full flex items-center justify-center
                shrink-0 mt-1 text-[10px] font-bold
                ${isMechanic
                  ? "bg-amber-400/10 border border-amber-400/20 text-amber-400"
                  : "bg-zinc-800 border border-white/[0.08] text-zinc-400"
                }`}>
                {isMechanic ? mechanicInitials : conversation.ownerInitials}
              </div>

              <div className={`max-w-[78%] flex flex-col gap-1
                ${isMechanic ? "items-end" : "items-start"}`}>
                <div className={`px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed
                  ${isMechanic
                    ? "bg-amber-500 text-[#080909] font-medium rounded-tr-sm"
                    : "bg-white/[0.05] border border-white/[0.08] text-zinc-200 rounded-tl-sm"
                  }`}>
                  {msg.content}
                </div>
                <span className="text-[10px] text-zinc-600">{msg.timestamp}</span>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="px-4 pt-3 pb-6 border-t border-white/[0.07]
        bg-[#080909]/95 backdrop-blur-xl">
        <div className="flex items-end gap-2.5">
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
            placeholder="Type a message…"
            className="flex-1 px-4 py-3 rounded-2xl resize-none overflow-hidden
              bg-white/[0.04] border border-white/[0.08] text-sm text-zinc-200
              placeholder:text-zinc-600
              focus:outline-none focus:border-amber-400/40 focus:bg-white/[0.06]
              transition-colors leading-relaxed"
            style={{ minHeight: "48px", maxHeight: "120px" }}
          />
          <button
            onClick={sendMessage}
            disabled={!input.trim()}
            aria-label="Send"
            className="w-12 h-12 rounded-2xl bg-amber-500 flex items-center justify-center
              hover:bg-amber-400 active:scale-95 transition-all
              disabled:opacity-40 disabled:cursor-not-allowed
              shadow-[0_4px_20px_rgba(245,158,11,0.25)] shrink-0">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M22 2L11 13M22 2L15 22l-4-9-9-4 20-7z"
                stroke="#080909" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Empty state ───────────────────────────────────────────────────────────────

function NoConversationSelected() {
  return (
    <div className="hidden md:flex flex-col items-center justify-center h-full gap-4 text-center px-8">
      <div className="w-16 h-16 rounded-3xl bg-white/[0.04] border border-white/[0.08]
        flex items-center justify-center">
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"
            stroke="#52525B" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
      <div>
        <p className="text-sm font-semibold text-zinc-400">Select a conversation</p>
        <p className="text-xs text-zinc-600 mt-1">Choose from the list to start messaging</p>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function MechanicChatsPage({
  conversations,
  mechanicName,
  mechanicInitials,
}: MechanicChatsProps) {
  const router  = useRouter();
  const [selectedId, setSelectedId] = useState<string | null>(
    conversations.length > 0 ? conversations[0].id : null
  );

  const selected = conversations.find((c) => c.id === selectedId) ?? null;

  return (
    <div className="min-h-screen w-full bg-[#080909] flex flex-col">
      {/* Background */}
      <div aria-hidden="true" className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[600px] h-[400px]
          bg-amber-400/[0.02] rounded-full blur-[120px]" />
      </div>

      {/* Top nav bar */}
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
        <div className="flex items-center gap-2">
          <span className="text-[18px] font-black tracking-tight text-zinc-100">
            Fix<span className="text-amber-400">IT</span>
          </span>
        </div>
        <p className="text-sm font-semibold text-zinc-100 ml-1">Chats</p>
        {conversations.filter((c) => c.unread > 0).length > 0 && (
          <span className="w-5 h-5 rounded-full bg-amber-400 flex items-center justify-center
            text-[10px] font-bold text-[#080909]">
            {conversations.reduce((s, c) => s + c.unread, 0)}
          </span>
        )}
      </div>

      {/* Body — mobile: show list OR chat. Desktop: split view */}
      <div className="relative z-10 flex flex-1 overflow-hidden"
        style={{ height: "calc(100vh - 64px)" }}>

        {/* Sidebar — always visible on md+, hidden when chat selected on mobile */}
        <div className={[
          "w-full md:w-80 md:border-r border-white/[0.07] flex-shrink-0 flex flex-col",
          selected ? "hidden md:flex" : "flex",
        ].join(" ")}>
          <ConversationList
            conversations={conversations}
            selected={selectedId}
            onSelect={setSelectedId}
          />
        </div>

        {/* Chat panel */}
        <div className={[
          "flex-1 flex flex-col",
          selected ? "flex" : "hidden md:flex",
        ].join(" ")}>
          {selected ? (
            <ChatView
              conversation={selected}
              mechanicName={mechanicName}
              mechanicInitials={mechanicInitials}
              onBack={() => setSelectedId(null)}
            />
          ) : (
            <NoConversationSelected />
          )}
        </div>
      </div>
    </div>
  );
}