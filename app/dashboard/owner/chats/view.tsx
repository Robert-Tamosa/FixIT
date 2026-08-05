"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  getMessages,
  sendMessage as sendMessageAction,
  markMessagesRead,
  type DisplayMessage,
} from "@/app/actions/messages";

// ── Types ─────────────────────────────────────────────────────────────────────

interface Conversation {
  id:               string; // bookingId
  mechanicName:     string;
  mechanicInitials: string;
  specialization:   string;
  lastMessage:      string;
  time:             string;
  unread:           number;
  status:           "PENDING" | "CONFIRMED" | "ESTIMATE_SENT" | "ESTIMATE_ACCEPTED" | "EN_ROUTE" | "IN_PROGRESS" | "DONE" | "CANCELLED";
}

export interface OwnerChatsProps {
  conversations: Conversation[];
}

// ── Status badge ──────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<string, { label: string; cls: string }> = {
  PENDING:            { label: "Pending",     cls: "text-amber-400   bg-amber-400/10   border-amber-400/20"   },
  CONFIRMED:          { label: "Confirmed",   cls: "text-sky-400     bg-sky-400/10     border-sky-400/20"     },
  ESTIMATE_SENT:      { label: "Estimate",    cls: "text-blue-400    bg-blue-400/10    border-blue-400/20"    },
  ESTIMATE_ACCEPTED:  { label: "Confirmed",   cls: "text-sky-400     bg-sky-400/10     border-sky-400/20"     },
  EN_ROUTE:           { label: "En Route",    cls: "text-blue-400    bg-blue-400/10    border-blue-400/20"    },
  IN_PROGRESS:        { label: "In Progress", cls: "text-orange-400  bg-orange-400/10  border-orange-400/20"  },
  DONE:               { label: "Completed",   cls: "text-emerald-400 bg-emerald-400/10 border-emerald-400/20" },
  CANCELLED:          { label: "Cancelled",   cls: "text-red-400     bg-red-400/10     border-red-400/20"     },
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
  onOpenAI,
}: {
  conversations: Conversation[];
  selected:      string | null;
  onSelect:      (id: string) => void;
  onOpenAI:      () => void;
}) {
  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-4 border-b border-white/[0.07]">
        <h1 className="text-base font-bold text-zinc-100">Messages</h1>
        <p className="text-xs text-zinc-500 mt-0.5">
          {conversations.length} conversation{conversations.length !== 1 ? "s" : ""}
        </p>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* AI Diagnostics — always pinned, routes to its own page instead of opening inline */}
        <p className="px-4 pt-3 pb-1 text-[10px] font-semibold text-zinc-600 uppercase tracking-wider">
          AI Assistant
        </p>
        <button
          onClick={onOpenAI}
          className="w-full flex items-center gap-3.5 px-4 py-3.5 text-left
            hover:bg-white/[0.04] active:bg-white/[0.06] transition-colors border-b border-white/[0.05]">
          <div className="w-11 h-11 rounded-full bg-gradient-to-br from-amber-400 to-yellow-500
            flex items-center justify-center shrink-0">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96-.44 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24 2.5 2.5 0 0 1 4.44-1.66z"
                stroke="#080909" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96-.44 2.5 2.5 0 0 0 2.96-3.08 3 3 0 0 0 .34-5.58 2.5 2.5 0 0 0-1.32-4.24 2.5 2.5 0 0 0-4.44-1.66z"
                stroke="#080909" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <p className="text-sm font-medium text-zinc-200">FixIT AI Diagnostics</p>
              <span className="text-[9px] font-bold text-amber-400 bg-amber-400/10
                border border-amber-400/20 px-1.5 py-0.5 rounded-full">AI</span>
            </div>
            <p className="text-xs text-zinc-500 truncate">
              Describe your vehicle symptoms and I'll help diagnose the issue.
            </p>
          </div>
        </button>

        {conversations.length > 0 && (
          <p className="px-4 pt-3 pb-1 text-[10px] font-semibold text-zinc-600 uppercase tracking-wider">
            Mechanics
          </p>
        )}

        {conversations.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-14 gap-2 px-6 text-center">
            <p className="text-sm text-zinc-500">No mechanic conversations yet</p>
            <p className="text-xs text-zinc-600">Book a mechanic to start chatting</p>
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
              <div className="w-11 h-11 rounded-full bg-white/[0.08] border border-white/[0.1]
                flex items-center justify-center shrink-0 text-sm font-bold text-zinc-300">
                {c.mechanicInitials}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-0.5">
                  <p className="text-sm font-semibold text-zinc-100 truncate">{c.mechanicName}</p>
                  <span className="text-[10px] text-zinc-600 shrink-0 ml-2">{c.time}</span>
                </div>
                <p className="text-xs text-zinc-500 truncate mb-1">
                  <span className="text-zinc-600">{c.specialization} · </span>
                  {c.lastMessage}
                </p>
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
  onBack,
}: {
  conversation: Conversation;
  onBack:       () => void;
}) {
  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [input,    setInput]    = useState("");
  const [sending,  setSending]  = useState(false);
  const [error,    setError]    = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    try {
      const data = await getMessages(conversation.id);
      setMessages(data);
    } catch (err) {
      console.error("Failed to load messages:", err);
    } finally {
      setLoading(false);
    }
  }, [conversation.id]);

  useEffect(() => {
    setLoading(true);
    load();
    markMessagesRead(conversation.id).catch(() => {});

    const id = setInterval(() => {
      if (document.visibilityState === "visible") load();
    }, 5000);
    return () => clearInterval(id);
  }, [conversation.id, load]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function sendMessage() {
    const content = input.trim();
    if (!content || sending) return;

    setSending(true);
    setError(null);

    const optimisticId = `optimistic-${Date.now()}`;
    const optimisticMsg: DisplayMessage = {
      id: optimisticId,
      senderId: "me",
      isMine: true,
      content,
      createdAt: new Date().toISOString(),
      readAt: null,
    };
    setMessages((prev) => [...prev, optimisticMsg]);
    setInput("");

    try {
      const sent = await sendMessageAction(conversation.id, content);
      setMessages((prev) => prev.map((m) => (m.id === optimisticId ? sent : m)));
    } catch (err) {
      setMessages((prev) => prev.filter((m) => m.id !== optimisticId));
      setInput(content);
      setError(err instanceof Error ? err.message : "Message failed to send — try again.");
    } finally {
      setSending(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  return (
    <div className="flex flex-col h-full">
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

        <div className="w-9 h-9 rounded-full bg-white/[0.08] border border-white/[0.1]
          flex items-center justify-center shrink-0 text-sm font-bold text-zinc-300">
          {conversation.mechanicInitials}
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-zinc-100 truncate">{conversation.mechanicName}</p>
          <p className="text-xs text-zinc-500 truncate">{conversation.specialization}</p>
        </div>

        <StatusBadge status={conversation.status} />
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        <div className="flex justify-center">
          <span className="text-[11px] text-zinc-600 bg-white/[0.03]
            border border-white/[0.07] px-3 py-1 rounded-full">
            {conversation.specialization}
          </span>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-10 gap-2.5">
            <span className="w-4 h-4 rounded-full border-2 border-zinc-600 border-t-amber-400 animate-spin" />
            <p className="text-sm text-zinc-500">Loading messages…</p>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 gap-1.5 text-center">
            <p className="text-sm text-zinc-500">No messages yet.</p>
            <p className="text-xs text-zinc-600">Say hello to {conversation.mechanicName}.</p>
          </div>
        ) : (
          messages.map((msg) => {
            const isOwner = msg.isMine;
            return (
              <div key={msg.id} className={`flex gap-2.5 ${isOwner ? "flex-row-reverse" : "flex-row"}`}>
                <div className={`w-7 h-7 rounded-full flex items-center justify-center
                  shrink-0 mt-1 text-[10px] font-bold
                  ${isOwner
                    ? "bg-amber-400/10 border border-amber-400/20 text-amber-400"
                    : "bg-white/[0.08] border border-white/[0.1] text-zinc-400"
                  }`}>
                  {isOwner ? "Me" : conversation.mechanicInitials}
                </div>

                <div className={`max-w-[78%] flex flex-col gap-1 ${isOwner ? "items-end" : "items-start"}`}>
                  <div className={[
                    "px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed",
                    isOwner
                      ? "bg-amber-500 text-[#080909] font-medium rounded-tr-sm"
                      : "bg-white/[0.05] border border-white/[0.08] text-zinc-200 rounded-tl-sm",
                    msg.id.startsWith("optimistic-") ? "opacity-60" : "",
                  ].join(" ")}>
                    {msg.content}
                  </div>
                  <span className="text-[10px] text-zinc-600">
                    {new Date(msg.createdAt).toLocaleTimeString("en-PH", { hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      {error && (
        <div className="mx-4 mb-2 px-3.5 py-2.5 rounded-xl bg-orange-500/[0.08] border border-orange-500/[0.15]">
          <p className="text-xs text-orange-300">{error}</p>
        </div>
      )}

      <div className="px-4 pt-3 pb-6 border-t border-white/[0.07] bg-[#080909]/95 backdrop-blur-xl">
        <div className="flex items-end gap-2.5">
          <textarea
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
            disabled={!input.trim() || sending}
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

export default function OwnerChatsPage({ conversations }: OwnerChatsProps) {
  const router = useRouter();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const selected = conversations.find((c) => c.id === selectedId) ?? null;

  return (
    <div className="min-h-screen w-full bg-[#080909] flex flex-col">
      <div aria-hidden="true" className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[600px] h-[400px]
          bg-amber-400/[0.02] rounded-full blur-[120px]" />
      </div>

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
        <h1 className="text-[17px] font-bold text-zinc-100 flex-1">Messages</h1>
        {conversations.filter((c) => c.unread > 0).length > 0 && (
          <span className="w-5 h-5 rounded-full bg-amber-400 flex items-center justify-center
            text-[10px] font-bold text-[#080909]">
            {conversations.reduce((s, c) => s + c.unread, 0)}
          </span>
        )}
      </div>

      <div className="relative z-10 flex flex-1 overflow-hidden" style={{ height: "calc(100vh - 64px)" }}>
        <div className={[
          "w-full md:w-80 md:border-r border-white/[0.07] flex-shrink-0 flex flex-col",
          selected ? "hidden md:flex" : "flex",
        ].join(" ")}>
          <ConversationList
            conversations={conversations}
            selected={selectedId}
            onSelect={setSelectedId}
            onOpenAI={() => router.push("/dashboard/owner/chats/ai")}
          />
        </div>

        <div className={["flex-1 flex flex-col", selected ? "flex" : "hidden md:flex"].join(" ")}>
          {selected ? (
            <ChatView conversation={selected} onBack={() => setSelectedId(null)} />
          ) : (
            <NoConversationSelected />
          )}
        </div>
      </div>
    </div>
  );
}