"use client";

import * as React from "react";

/**
 * Three-dot "someone is typing" indicator, rendered as an assistant/agent
 * bubble while the AI streams or a live agent is composing. CSS-only bounce so
 * it animates even when Framer's reduced-motion config is active (it's a
 * loading affordance, not decorative — kept subtle).
 */
export function TypingIndicator() {
  return (
    <div className="flex items-center gap-1 px-1 py-0.5" aria-label="Typing" role="status">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="inline-block size-1.5 rounded-full bg-muted-foreground/60 motion-safe:animate-bounce"
          style={{ animationDelay: `${i * 0.15}s`, animationDuration: "0.9s" }}
        />
      ))}
    </div>
  );
}
