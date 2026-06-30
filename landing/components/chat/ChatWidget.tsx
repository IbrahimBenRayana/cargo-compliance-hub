"use client";

import * as React from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { MessageCircle, X, Headset, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { MessageList, type UiMessage } from "./MessageList";
import { Composer } from "./Composer";
import { ModeBadge } from "./ModeBadge";
import { HumanHandoffForm } from "./HumanHandoffForm";
import {
  getConfig,
  createOrRestoreConversation,
  sendMessage,
  eventsUrl,
  type ChatConfig,
  type ChatMode,
  type ChatMessage,
  type LiveMessageEvent,
  type ModeChangeEvent,
} from "@/lib/chatClient";

const EASE = [0.22, 1, 0.36, 1] as const;

const WELCOME: UiMessage = {
  id: "welcome",
  role: "assistant",
  content:
    "Hi! I'm the MyCargoLens assistant. Ask me anything about the platform — features, pricing, security — or tap “Talk to a human” to reach our team.",
};

function mapMessage(m: ChatMessage): UiMessage {
  const meta = (m.metadata ?? {}) as { agentName?: string };
  return {
    id: m.id,
    role: m.role,
    content: m.content,
    agentName: meta.agentName,
  };
}

export function ChatWidget() {
  const reducedMotion = useReducedMotion();

  const [open, setOpen] = React.useState(false);
  const [config, setConfig] = React.useState<ChatConfig | null>(null);
  const [bootError, setBootError] = React.useState(false);
  const [initialised, setInitialised] = React.useState(false);
  const [initialising, setInitialising] = React.useState(false);

  const [messages, setMessages] = React.useState<UiMessage[]>([WELCOME]);
  const [mode, setMode] = React.useState<ChatMode>("ai");
  const [agentName, setAgentName] = React.useState<string | null>(null);
  const [streaming, setStreaming] = React.useState(false);
  const [agentTyping, setAgentTyping] = React.useState(false);
  const [showHandoff, setShowHandoff] = React.useState(false);

  const seenIds = React.useRef<Set<string>>(new Set());
  const panelRef = React.useRef<HTMLDivElement>(null);
  const agentTypingTimer = React.useRef<ReturnType<typeof setTimeout> | null>(
    null
  );

  // ── Config probe (once on mount) ──────────────────────────────────────────
  React.useEffect(() => {
    let cancelled = false;
    getConfig()
      .then((c) => {
        if (!cancelled) setConfig(c);
      })
      .catch(() => {
        if (!cancelled) setBootError(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // ── Lazily create/restore the conversation the first time the panel opens ──
  React.useEffect(() => {
    if (!open || initialised || initialising) return;
    setInitialising(true);
    createOrRestoreConversation()
      .then((detail) => {
        if (detail) {
          const restored = detail.messages.map(mapMessage);
          restored.forEach((m) => seenIds.current.add(m.id));
          setMessages(restored.length > 0 ? restored : [WELCOME]);
          setMode(detail.conversation.mode);
        }
        setInitialised(true);
        setInitialising(false);
      })
      .catch(() => {
        setBootError(true);
        setInitialising(false);
      });
  }, [open, initialised, initialising]);

  // ── Live events stream while the panel is open and a session exists ────────
  React.useEffect(() => {
    if (!open || !initialised) return;
    const url = eventsUrl();
    if (!url) return;

    const es = new EventSource(url);

    const onMessage = (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data) as LiveMessageEvent;
        if (!data.messageId || seenIds.current.has(data.messageId)) return;
        seenIds.current.add(data.messageId);
        setAgentTyping(false);
        setMessages((prev) => [
          ...prev,
          {
            id: data.messageId,
            role: data.role,
            content: data.content,
            agentName: data.agentName,
          },
        ]);
      } catch {
        // ignore malformed frame
      }
    };

    const onModeChange = (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data) as ModeChangeEvent;
        setMode(data.mode);
        if (data.assignedAgentName) setAgentName(data.assignedAgentName);
      } catch {
        // ignore
      }
    };

    const onAgentTyping = () => {
      setAgentTyping(true);
      if (agentTypingTimer.current) clearTimeout(agentTypingTimer.current);
      agentTypingTimer.current = setTimeout(() => setAgentTyping(false), 6000);
    };

    es.addEventListener("message", onMessage);
    es.addEventListener("mode_change", onModeChange);
    es.addEventListener("agent_typing", onAgentTyping);

    return () => {
      es.removeEventListener("message", onMessage);
      es.removeEventListener("mode_change", onModeChange);
      es.removeEventListener("agent_typing", onAgentTyping);
      es.close();
      if (agentTypingTimer.current) clearTimeout(agentTypingTimer.current);
    };
  }, [open, initialised]);

  // ── Escape to close + focus management ─────────────────────────────────────
  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  // ── Send a visitor message and stream the AI reply ─────────────────────────
  const handleSend = React.useCallback(
    async (text: string) => {
      if (streaming) return;

      const userMsg: UiMessage = {
        id: `local-${Date.now()}`,
        role: "user",
        content: text,
      };
      // Optimistic user bubble + an empty assistant bubble to stream into.
      const assistantId = `assistant-${Date.now()}`;
      setMessages((prev) => [
        ...prev,
        userMsg,
        { id: assistantId, role: "assistant", content: "" },
      ]);
      setStreaming(true);

      let gotDelta = false;
      try {
        for await (const ev of sendMessage(text)) {
          if (ev.type === "delta") {
            gotDelta = true;
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantId
                  ? { ...m, content: m.content + ev.text }
                  : m
              )
            );
          } else if (ev.type === "escalated") {
            setMode("pending_human");
            setMessages((prev) => [
              ...prev,
              {
                id: `sys-esc-${Date.now()}`,
                role: "system",
                content: "Connecting you with a MyCargoLens specialist…",
              },
            ]);
          } else if (ev.type === "human_mode") {
            // Message went to a live agent — drop the empty placeholder; the
            // reply arrives over the events stream.
            setMessages((prev) => prev.filter((m) => m.id !== assistantId));
          } else if (ev.type === "error") {
            const showHuman = ev.code === "ai_unavailable";
            setMessages((prev) =>
              prev
                .filter((m) => m.id !== assistantId || gotDelta)
                .concat({
                  id: `err-${Date.now()}`,
                  role: "system",
                  content: ev.message,
                })
            );
            if (showHuman) setShowHandoff(true);
          }
        }
      } finally {
        // Clean up an assistant bubble that never received any text.
        setMessages((prev) =>
          prev.filter((m) => !(m.id === assistantId && m.content === ""))
        );
        setStreaming(false);
      }
    },
    [streaming]
  );

  const handleEscalated = React.useCallback(() => {
    setShowHandoff(false);
    setMode("pending_human");
    setMessages((prev) => [
      ...prev,
      {
        id: `sys-esc-${Date.now()}`,
        role: "system",
        content: "A specialist will join shortly. You can keep typing here.",
      },
    ]);
  }, []);

  // Don't render at all if the backend says the widget is disabled or the
  // config probe failed.
  if (bootError || !config || !config.enabled) return null;

  const aiEnabled = config.aiEnabled;
  const inHuman = mode === "human" || mode === "pending_human";

  return (
    <>
      {/* Floating launcher — sits below the Nav (z-50) at z-40. */}
      <div className="fixed bottom-5 right-5 z-40 print:hidden sm:bottom-6 sm:right-6">
        <AnimatePresence>
          {!open && (
            <motion.button
              type="button"
              key="launcher"
              onClick={() => setOpen(true)}
              aria-label="Open chat"
              initial={reducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.6, y: 12 }}
              animate={reducedMotion ? { opacity: 1 } : { opacity: 1, scale: 1, y: 0 }}
              exit={reducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.6, y: 12 }}
              transition={{ duration: 0.28, ease: EASE }}
              whileHover={reducedMotion ? undefined : { scale: 1.05 }}
              whileTap={reducedMotion ? undefined : { scale: 0.95 }}
              className="group flex size-14 items-center justify-center rounded-full bg-gold text-yellow-950 shadow-gold transition-shadow hover:shadow-[0_0_0_1px_hsl(43_96%_56%_/_0.3),_0_0_28px_hsl(43_96%_56%_/_0.45),_0_0_60px_hsl(43_96%_56%_/_0.18)]"
            >
              <MessageCircle size={24} strokeWidth={2.2} />
            </motion.button>
          )}
        </AnimatePresence>
      </div>

      {/* Panel */}
      <AnimatePresence>
        {open && (
          <motion.div
            ref={panelRef}
            key="panel"
            role="dialog"
            aria-modal="false"
            aria-label="MyCargoLens chat"
            initial={
              reducedMotion ? { opacity: 0 } : { opacity: 0, y: 24, scale: 0.96 }
            }
            animate={
              reducedMotion ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }
            }
            exit={
              reducedMotion ? { opacity: 0 } : { opacity: 0, y: 24, scale: 0.96 }
            }
            transition={{ duration: 0.3, ease: EASE }}
            className={cn(
              "fixed z-40 flex flex-col overflow-hidden rounded-2xl border border-border/60 bg-[hsl(var(--background)/0.92)] shadow-[0_24px_80px_-20px_hsl(var(--foreground)/0.3)] backdrop-blur-xl backdrop-saturate-150 print:hidden",
              // Mobile: near-fullscreen sheet. Desktop: anchored card bottom-right.
              "inset-x-3 bottom-3 top-20 sm:inset-x-auto sm:bottom-6 sm:right-6 sm:top-auto sm:h-[min(640px,calc(100vh-6rem))] sm:w-[400px]"
            )}
          >
            {/* Header */}
            <div className="flex items-center justify-between gap-3 border-b border-border/60 bg-card/50 px-4 py-3">
              <div className="flex items-center gap-2.5">
                <span className="flex size-9 items-center justify-center rounded-lg bg-gold/15 text-gold-dark dark:text-gold">
                  <Sparkles size={17} aria-hidden="true" />
                </span>
                <div className="min-w-0">
                  <p className="text-[13.5px] font-semibold leading-tight text-foreground">
                    MyCargoLens
                  </p>
                  <div className="mt-0.5">
                    <ModeBadge mode={mode} agentName={agentName} />
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close chat"
                className="flex size-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* Transcript */}
            <MessageList
              messages={messages}
              typing={streaming || agentTyping}
            />

            {/* Handoff form (inline) */}
            <AnimatePresence>
              {showHandoff && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.24, ease: EASE }}
                  className="overflow-hidden"
                >
                  <HumanHandoffForm
                    onEscalated={handleEscalated}
                    onCancel={() => setShowHandoff(false)}
                  />
                </motion.div>
              )}
            </AnimatePresence>

            {/* Footer / composer area */}
            {aiEnabled && !inHuman ? (
              <>
                {!showHandoff && (
                  <button
                    type="button"
                    onClick={() => setShowHandoff(true)}
                    className="flex items-center justify-center gap-1.5 border-t border-border/60 py-2 text-[12px] font-medium text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-colors"
                  >
                    <Headset size={13} aria-hidden="true" />
                    Talk to a human
                  </button>
                )}
                <Composer
                  onSend={handleSend}
                  disabled={streaming || initialising || !initialised}
                />
              </>
            ) : inHuman ? (
              // Live / pending human: composer stays open so the visitor can
              // keep chatting with the agent.
              <Composer
                onSend={handleSend}
                disabled={initialising || !initialised}
                placeholder="Message the team…"
              />
            ) : (
              // AI disabled entirely — human path only.
              <div className="border-t border-border/60 p-3">
                {showHandoff ? null : (
                  <Button
                    variant="gold"
                    size="sm"
                    className="w-full"
                    onClick={() => setShowHandoff(true)}
                    disabled={initialising || !initialised}
                  >
                    <Headset size={14} aria-hidden="true" />
                    Talk to a human
                  </Button>
                )}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
