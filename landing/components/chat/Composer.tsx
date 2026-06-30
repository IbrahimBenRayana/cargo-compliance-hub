"use client";

import * as React from "react";
import { ArrowUp } from "lucide-react";
import { cn } from "@/lib/utils";

interface ComposerProps {
  onSend: (text: string) => void;
  disabled?: boolean;
  placeholder?: string;
}

const MAX_LENGTH = 4000;

/**
 * Auto-growing textarea composer. Enter sends, Shift+Enter inserts a newline.
 * Disabled while a turn is streaming. Submit button is gold and disabled when
 * empty or busy.
 */
export function Composer({ onSend, disabled, placeholder }: ComposerProps) {
  const [value, setValue] = React.useState("");
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);

  const autosize = React.useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  }, []);

  React.useEffect(() => {
    autosize();
  }, [value, autosize]);

  function submit() {
    const trimmed = value.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed.slice(0, MAX_LENGTH));
    setValue("");
    // Reset height after clearing.
    requestAnimationFrame(() => {
      const el = textareaRef.current;
      if (el) el.style.height = "auto";
    });
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  }

  const canSend = value.trim().length > 0 && !disabled;

  return (
    <div className="border-t border-border/60 p-3">
      <div className="flex items-end gap-2 rounded-xl border border-border bg-background px-3 py-2 focus-within:ring-2 focus-within:ring-ring transition-shadow">
        <textarea
          ref={textareaRef}
          rows={1}
          value={value}
          maxLength={MAX_LENGTH}
          disabled={disabled}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder ?? "Ask about MyCargoLens…"}
          aria-label="Message"
          className="flex-1 resize-none bg-transparent text-[13.5px] leading-relaxed text-foreground placeholder:text-muted-foreground focus:outline-none disabled:opacity-60"
        />
        <button
          type="button"
          onClick={submit}
          disabled={!canSend}
          aria-label="Send message"
          className={cn(
            "flex size-8 flex-shrink-0 items-center justify-center rounded-lg transition-all duration-200",
            canSend
              ? "bg-gold text-yellow-950 hover:bg-gold-light hover:scale-[1.03] shadow-gold"
              : "bg-secondary text-muted-foreground/50 cursor-not-allowed"
          )}
        >
          <ArrowUp size={16} strokeWidth={2.4} />
        </button>
      </div>
    </div>
  );
}
