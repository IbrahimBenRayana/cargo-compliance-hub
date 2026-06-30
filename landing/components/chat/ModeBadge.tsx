"use client";

import * as React from "react";
import { Bot, Loader2, Headset } from "lucide-react";
import type { ChatMode } from "@/lib/chatClient";

interface ModeBadgeProps {
  mode: ChatMode;
  agentName?: string | null;
}

/**
 * Small status pill in the panel header reflecting who the visitor is
 * talking to: the AI, a connecting state, or a named live agent.
 */
export function ModeBadge({ mode, agentName }: ModeBadgeProps) {
  let label: string;
  let Icon: typeof Bot;
  let pulsing = false;

  if (mode === "human") {
    Icon = Headset;
    label = agentName ? `Live agent: ${agentName}` : "Live agent";
  } else if (mode === "pending_human") {
    Icon = Loader2;
    label = "Connecting…";
    pulsing = true;
  } else {
    Icon = Bot;
    label = "AI assistant";
  }

  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-secondary/50 px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
      <Icon
        size={12}
        className={pulsing ? "animate-spin text-gold-dark dark:text-gold" : "text-gold-dark dark:text-gold"}
        aria-hidden="true"
      />
      {label}
    </span>
  );
}
