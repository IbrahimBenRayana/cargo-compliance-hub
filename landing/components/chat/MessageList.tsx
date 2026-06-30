"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import type { ChatRole } from "@/lib/chatClient";
import { TypingIndicator } from "./TypingIndicator";

export interface UiMessage {
  id: string;
  role: ChatRole;
  content: string;
  agentName?: string;
}

interface MessageListProps {
  messages: UiMessage[];
  /** Show a typing indicator bubble at the bottom (AI streaming / agent typing). */
  typing?: boolean;
}

/**
 * Scrollable transcript. Autoscrolls to the newest content whenever messages
 * change or the typing indicator toggles. Assistant/agent/system text
 * preserves line breaks via `whitespace-pre-wrap`.
 */
export function MessageList({ messages, typing }: MessageListProps) {
  const endRef = React.useRef<HTMLDivElement>(null);
  const scrollRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    // Jump to bottom on new content. `block:"end"` keeps the composer in view.
    const el = scrollRef.current;
    if (el) {
      el.scrollTop = el.scrollHeight;
    }
  }, [messages, typing]);

  return (
    <div
      ref={scrollRef}
      className="flex-1 overflow-y-auto overscroll-contain px-4 py-4 space-y-3"
    >
      {messages.map((m) => (
        <MessageBubble key={m.id} message={m} />
      ))}

      {typing && (
        <div className="flex justify-start">
          <div className="rounded-2xl rounded-bl-md bg-secondary/70 px-3 py-2">
            <TypingIndicator />
          </div>
        </div>
      )}

      <div ref={endRef} />
    </div>
  );
}

function MessageBubble({ message }: { message: UiMessage }) {
  const isUser = message.role === "user";
  const isSystem = message.role === "system";

  if (isSystem) {
    return (
      <div className="flex justify-center">
        <p className="max-w-[85%] text-center text-[11px] leading-relaxed text-muted-foreground">
          {message.content}
        </p>
      </div>
    );
  }

  return (
    <div className={cn("flex", isUser ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[85%] whitespace-pre-wrap break-words rounded-2xl px-3.5 py-2 text-[13.5px] leading-relaxed shadow-sm",
          isUser
            ? "rounded-br-md bg-gold text-yellow-950"
            : "rounded-bl-md border border-border/60 bg-card text-foreground"
        )}
      >
        {message.role === "agent" && message.agentName && (
          <span className="mb-0.5 block text-[10.5px] font-semibold text-gold-dark dark:text-gold">
            {message.agentName}
          </span>
        )}
        {message.content}
      </div>
    </div>
  );
}
