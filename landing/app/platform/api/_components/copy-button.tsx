"use client";

import * as React from "react";
import { Check, Copy } from "lucide-react";

/** Copies a code sample. Announces the result to screen readers. */
export function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = React.useState(false);
  const timer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  React.useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  async function onCopy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  }

  return (
    <button
      type="button"
      onClick={onCopy}
      aria-label={`Copy ${label}`}
      className="inline-flex h-7 items-center gap-1.5 rounded-md border border-white/10 bg-white/5 px-2 text-[12px] font-medium text-[hsl(216_30%_85%)] transition-colors duration-150 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(205_90%_78%)] active:scale-[0.97]"
    >
      {copied ? <Check aria-hidden className="size-3.5" /> : <Copy aria-hidden className="size-3.5" />}
      <span aria-live="polite">{copied ? "Copied" : "Copy"}</span>
    </button>
  );
}
