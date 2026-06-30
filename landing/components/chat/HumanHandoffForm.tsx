"use client";

import * as React from "react";
import { Headset } from "lucide-react";
import { Button } from "@/components/ui/button";
import { escalate } from "@/lib/chatClient";

interface HumanHandoffFormProps {
  /** Called once escalation succeeds (server returns pending_human). */
  onEscalated: () => void;
  /** Dismiss the form without escalating. */
  onCancel: () => void;
  /** Optional reason carried over (e.g. the visitor's last message). */
  reason?: string;
}

/**
 * Inline form shown when the visitor asks to "talk to a human". Optionally
 * captures name + email so staff know who they're talking to, then calls
 * `escalate`. Includes a hidden honeypot field, mirroring contact/page.tsx.
 */
export function HumanHandoffForm({
  onEscalated,
  onCancel,
  reason,
}: HumanHandoffFormProps) {
  const [name, setName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [website, setWebsite] = React.useState(""); // honeypot
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await escalate({
        reason,
        name: name.trim() || undefined,
        email: email.trim() || undefined,
        website,
      });
      setLoading(false);
      onEscalated();
    } catch {
      setError("Couldn't reach the server. Please try again.");
      setLoading(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      className="m-3 rounded-xl border border-border/60 bg-card/70 p-4"
    >
      <div className="mb-3 flex items-start gap-2.5">
        <span className="mt-0.5 flex size-8 flex-shrink-0 items-center justify-center rounded-lg bg-gold/15 text-gold-dark dark:text-gold">
          <Headset size={16} aria-hidden="true" />
        </span>
        <div>
          <p className="text-[13px] font-semibold text-foreground">
            Talk to a specialist
          </p>
          <p className="text-[12px] leading-snug text-muted-foreground">
            Leave your details (optional) and we&apos;ll connect you with a
            MyCargoLens team member.
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-2.5">
        <input
          type="text"
          name="name"
          autoComplete="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Your name"
          aria-label="Your name"
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-[13px] placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring transition-shadow"
        />
        <input
          type="email"
          name="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@company.com"
          aria-label="Your email"
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-[13px] placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring transition-shadow"
        />

        {/* Honeypot — visually hidden, off the tab order. Real users never
            see it; bots fill it and the server drops the request. */}
        <div
          aria-hidden="true"
          className="absolute -left-[10000px] top-auto h-px w-px overflow-hidden"
        >
          <label htmlFor="chat-website">Website</label>
          <input
            id="chat-website"
            name="website"
            type="text"
            tabIndex={-1}
            autoComplete="off"
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
          />
        </div>

        {error && (
          <p className="text-[12px] text-red-600 dark:text-red-400" role="alert">
            {error}
          </p>
        )}

        <div className="mt-1 flex items-center gap-2">
          <Button
            type="submit"
            variant="gold"
            size="sm"
            disabled={loading}
            className="flex-1"
          >
            {loading ? "Connecting…" : "Connect me"}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onCancel}
            disabled={loading}
          >
            Cancel
          </Button>
        </div>
      </div>
    </form>
  );
}
