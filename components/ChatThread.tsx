"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { getMessages, sendMessage, markMessagesRead, type DisplayMessage } from "@/app/actions/messages";
interface ChatThreadProps {
  bookingId: string;
  otherPartyName: string;
  isOpen: boolean;
  onClose: () => void;
}

const POLL_INTERVAL = 5000; // slower than tracking's 5s isn't needed to change,
// but kept as its own constant since chat and tracking polling are
// independent concerns that may want different cadences later.

export function ChatThread({ bookingId, otherPartyName, isOpen, onClose }: ChatThreadProps) {
  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    try {
      const data = await getMessages(bookingId);
      setMessages(data);
    } catch (err) {
      console.error("Failed to load messages:", err);
    } finally {
      setLoading(false);
    }
  }, [bookingId]);

  // Poll while the thread is open; mark read once on open. Skips polling
  // while the tab is backgrounded, same convention as the rest of the app's
  // polling (usePolling.ts).
  useEffect(() => {
    if (!isOpen) return;
    load();
    markMessagesRead(bookingId).catch(() => {});

    const id = setInterval(() => {
      if (document.visibilityState === "visible") load();
    }, POLL_INTERVAL);
    return () => clearInterval(id);
  }, [isOpen, bookingId, load]);

  // Auto-scroll to the latest message
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  async function handleSend() {
    const content = draft.trim();
    if (!content || sending) return;

    setSending(true);
    setError(null);

    // Optimistic append — matters most in low-network conditions, where the
    // round-trip could take a while; the sender shouldn't have to wonder if
    // their tap registered.
    const optimisticId = `optimistic-${Date.now()}`;
    const optimisticMessage: DisplayMessage = {
      id: optimisticId,
      senderId: "me",
      isMine: true,
      content,
      createdAt: new Date().toISOString(),
      readAt: null,
    };
    setMessages((prev) => [...prev, optimisticMessage]);
    setDraft("");

    try {
      const sent = await sendMessage(bookingId, content);
      setMessages((prev) => prev.map((m) => (m.id === optimisticId ? sent : m)));
    } catch (err) {
      // Roll back the optimistic message and restore the draft so nothing
      // is silently lost — important specifically because of the low-
      // network use case this module is meant to support.
      setMessages((prev) => prev.filter((m) => m.id !== optimisticId));
      setDraft(content);
      setError(err instanceof Error ? err.message : "Message failed to send — try again.");
    } finally {
      setSending(false);
    }
  }

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40" onClick={onClose} aria-hidden="true" />

      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Chat with ${otherPartyName}`}
        className="fixed bottom-0 left-0 right-0 z-[100] h-[75dvh] max-w-2xl mx-auto
          bg-[#111318] border-t border-white/[0.08] rounded-t-3xl
          flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06] shrink-0">
          <div>
            <p className="text-[11px] text-zinc-500 uppercase tracking-wider font-medium">Chat</p>
            <h2 className="text-base font-bold text-zinc-100">{otherPartyName}</h2>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="w-8 h-8 rounded-xl bg-white/[0.05] border border-white/[0.08]
              flex items-center justify-center hover:bg-white/[0.1] transition-colors">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M18 6L6 18M6 6l12 12" stroke="#71717A" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {/* Messages */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-2.5">
          {loading ? (
            <div className="flex items-center justify-center py-10 gap-2.5">
              <span className="w-4 h-4 rounded-full border-2 border-zinc-600 border-t-amber-400 animate-spin" />
              <p className="text-sm text-zinc-500">Loading messages…</p>
            </div>
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-14 gap-2 text-center">
              <p className="text-sm text-zinc-500">No messages yet.</p>
              <p className="text-xs text-zinc-600">Say hello to {otherPartyName}.</p>
            </div>
          ) : (
            messages.map((m) => (
              <div key={m.id} className={`flex ${m.isMine ? "justify-end" : "justify-start"}`}>
                <div
                  className={[
                    "max-w-[78%] px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed break-words",
                    m.isMine
                      ? "bg-amber-400 text-zinc-900 rounded-br-md"
                      : "bg-white/[0.06] text-zinc-200 rounded-bl-md border border-white/[0.06]",
                    m.id.startsWith("optimistic-") ? "opacity-60" : "",
                  ].join(" ")}>
                  {m.content}
                  <p className={`text-[10px] mt-1 ${m.isMine ? "text-zinc-900/50" : "text-zinc-500"}`}>
                    {new Date(m.createdAt).toLocaleTimeString("en-PH", { hour: "2-digit", minute: "2-digit" })}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Error */}
        {error && (
          <div className="mx-4 mb-2 px-3.5 py-2.5 rounded-xl bg-orange-500/[0.08] border border-orange-500/[0.15]">
            <p className="text-xs text-orange-300">{error}</p>
          </div>
        )}

        {/* Composer */}
        <div className="flex items-end gap-2 px-4 py-3 border-t border-white/[0.06] shrink-0">
          <textarea
            rows={1}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder="Type a message…"
            className="flex-1 px-4 py-2.5 rounded-2xl bg-white/[0.04] border border-white/[0.08]
              text-zinc-100 text-sm placeholder:text-zinc-600 outline-none resize-none
              focus:border-amber-400/50 focus:bg-white/[0.06] transition-all max-h-24"
          />
          <button
            onClick={handleSend}
            disabled={!draft.trim() || sending}
            aria-label="Send message"
            className="w-11 h-11 rounded-2xl bg-amber-400 flex items-center justify-center shrink-0
              active:scale-[0.95] transition-all disabled:opacity-40">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" stroke="#080909" strokeWidth="1.8"
                strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>
      </div>
    </>
  );
}