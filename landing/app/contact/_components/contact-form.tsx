"use client";

import * as React from "react";
import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ctaHref } from "@/lib/site";
import {
  Field,
  FormAlert,
  Honeypot,
  controlCls,
  describedBy,
  focusFirstError,
} from "@/app/book-a-demo/_components/form-kit";
import { EMAIL_RE, compact, sendLead, track, type SendFailure } from "@/app/book-a-demo/_components/lead-api";

export const SUPPORT_EMAIL = "support@mycargolens.com";
const MESSAGE_MAX = 5000;

/**
 * Deck topics. The server enum (both the current route and PR #186) has no
 * billing / partnership / press yet, so those map to the nearest value and
 * the visible topic is written into the message's first line.
 */
export const TOPICS = [
  { value: "support", label: "Help with my account or a filing", subject: "support" },
  { value: "billing", label: "Billing question", subject: "support" },
  { value: "partnership", label: "Partnership", subject: "general" },
  { value: "press", label: "Press", subject: "other" },
  { value: "bug", label: "Bug report", subject: "bug" },
  { value: "general", label: "Something else", subject: "general" },
] as const;
export type Topic = (typeof TOPICS)[number]["value"];

type Values = { name: string; email: string; company: string; topic: Topic | ""; message: string; website: string };
type Errors = Partial<Record<keyof Values, string>>;
const ORDER = ["name", "email", "topic", "message"];

const FAILURE_COPY: Record<Exclude<SendFailure, "legacy" | "notfound">, string> = {
  network: `We couldn't reach our server, so your message wasn't sent. Try again, or email ${SUPPORT_EMAIL}.`,
  server: `Something went wrong on our side and your message wasn't sent. Try again, or email ${SUPPORT_EMAIL}.`,
  invalid: `Something went wrong on our side and your message wasn't sent. Try again, or email ${SUPPORT_EMAIL}.`,
  rate: `We've had several messages from your network in the last hour. Email ${SUPPORT_EMAIL} and we'll pick it up from there.`,
};

const SALES_WORDS = /\b(demo|pricing|price|quote)\b/i;

function validate(v: Values): Errors {
  const e: Errors = {};
  if (!v.name.trim()) e.name = "Enter your name so we know who to reply to.";
  const email = v.email.trim();
  if (!email) e.email = "Enter your email so we can reply.";
  else if (!EMAIL_RE.test(email) || email.length > 255) e.email = "That email looks incomplete. Check the part after the @.";
  if (!v.topic) e.topic = "Choose a topic so it reaches the right person.";
  if (!v.message.trim()) e.message = "Write a short message so we can help.";
  else if (v.message.length > MESSAGE_MAX) e.message = "Keep it under 5,000 characters.";
  return e;
}

export function ContactForm() {
  const [v, setV] = React.useState<Values>({ name: "", email: "", company: "", topic: "", message: "", website: "" });
  const [errors, setErrors] = React.useState<Errors>({});
  const [failure, setFailure] = React.useState<SendFailure | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [sent, setSent] = React.useState<{ first: string; email: string } | null>(null);
  const successRef = React.useRef<HTMLHeadingElement>(null);

  // Cards on the left ("Send a message") preselect a topic (TopicButton below).
  React.useEffect(() => {
    const onPick = (e: Event) => {
      const topic = (e as CustomEvent<Topic>).detail;
      if (TOPICS.some((t) => t.value === topic)) setV((p) => ({ ...p, topic }));
    };
    window.addEventListener("contact:topic", onPick);
    return () => window.removeEventListener("contact:topic", onPick);
  }, []);

  React.useEffect(() => {
    if (sent) successRef.current?.focus();
  }, [sent]);

  function set<K extends keyof Values>(k: K, val: Values[K]) {
    setV((p) => ({ ...p, [k]: val }));
    if (errors[k]) setErrors((p) => ({ ...p, [k]: undefined }));
  }

  async function onSubmit(ev: React.FormEvent<HTMLFormElement>) {
    ev.preventDefault();
    if (busy) return;
    const e = validate(v);
    if (Object.keys(e).length) {
      setErrors(e);
      setFailure(null);
      requestAnimationFrame(() => focusFirstError(ORDER, e as Record<string, string | undefined>));
      return;
    }
    setErrors({});
    setFailure(null);
    setBusy(true);

    const topic = TOPICS.find((t) => t.value === v.topic)!;
    const base = {
      name: v.name.trim(),
      email: v.email.trim(),
      subject: topic.subject,
      website: v.website,
    };
    const body = `Topic: ${topic.label}\n\n${v.message.trim()}`.slice(0, MESSAGE_MAX);
    let res = await sendLead("POST", compact({ ...base, formSource: "contact", company: v.company.trim(), message: body }));
    if (!res.ok && res.kind === "legacy") {
      // Older server: no company field, so it goes in the message.
      const withCompany = v.company.trim() ? `Company: ${v.company.trim()}\n${body}` : body;
      res = await sendLead("POST", { ...base, message: withCompany.slice(0, MESSAGE_MAX) });
    }
    setBusy(false);

    if (res.ok) {
      track("generate_lead", { form_type: "contact" });
      setSent({ first: v.name.trim().split(/\s+/)[0], email: v.email.trim() });
    } else {
      setFailure(res.kind);
    }
  }

  if (sent) {
    return (
      <div className="flex flex-col items-start gap-3 py-6" role="status">
        <CheckCircle2 aria-hidden className="size-10 text-emerald-600 dark:text-emerald-400" strokeWidth={1.75} />
        <h2 ref={successRef} tabIndex={-1} className="text-[24px] font-semibold tracking-[-0.02em] text-foreground outline-none">
          Message sent.
        </h2>
        <p className="text-[15px] leading-relaxed text-muted-foreground">
          Thanks, {sent.first}. We&apos;ll reply to <span className="font-medium text-foreground">{sent.email}</span> by
          email.
        </p>
        <Link
          href="/"
          className="mt-1 inline-flex min-h-11 items-center text-[15px] font-medium text-foreground underline decoration-current/35 underline-offset-4 hover:decoration-current"
        >
          Back to the homepage
        </Link>
      </div>
    );
  }

  const failureText = failure && failure !== "legacy" && failure !== "notfound" ? FAILURE_COPY[failure] : null;
  const salesHint = v.topic !== "" && SALES_WORDS.test(v.message);

  return (
    <form onSubmit={onSubmit} noValidate aria-busy={busy} className="relative flex flex-col gap-5">
      <h2 className="text-[22px] font-semibold tracking-[-0.02em] text-foreground">Send us a message</h2>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field id="name" label="Name" error={errors.name}>
          <input
            id="name"
            name="name"
            type="text"
            autoComplete="name"
            maxLength={120}
            value={v.name}
            onChange={(e) => set("name", e.target.value)}
            aria-invalid={!!errors.name}
            aria-describedby={describedBy("name", { error: errors.name })}
            className={controlCls}
          />
        </Field>
        <Field id="email" label="Email" error={errors.email}>
          <input
            id="email"
            name="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            autoCapitalize="none"
            spellCheck={false}
            maxLength={255}
            placeholder="name@company.com"
            value={v.email}
            onChange={(e) => set("email", e.target.value)}
            aria-invalid={!!errors.email}
            aria-describedby={describedBy("email", { error: errors.email })}
            className={controlCls}
          />
        </Field>
      </div>

      <Field id="company" label="Company" hint="(optional)">
        <input
          id="company"
          name="company"
          type="text"
          autoComplete="organization"
          maxLength={200}
          value={v.company}
          onChange={(e) => set("company", e.target.value)}
          className={controlCls}
        />
      </Field>

      <Field id="topic" label="What's this about?" error={errors.topic}>
        <select
          id="topic"
          name="topic"
          value={v.topic}
          onChange={(e) => set("topic", e.target.value as Topic)}
          aria-invalid={!!errors.topic}
          aria-describedby={describedBy("topic", { error: errors.topic })}
          className={controlCls}
        >
          <option value="">Choose a topic</option>
          {TOPICS.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
      </Field>

      <Field
        id="message"
        label="Message"
        error={errors.message}
        help={
          salesHint ? (
            <>
              Asking about pricing or a demo? Booking a demo is faster.{" "}
              <Link
                href={ctaHref({ src: "contact-form" })}
                className="font-medium text-foreground underline decoration-current/40 underline-offset-2 hover:decoration-current"
              >
                Book a demo
              </Link>
            </>
          ) : undefined
        }
      >
        <textarea
          id="message"
          name="message"
          rows={6}
          placeholder="Include filing IDs or entry numbers if it's about a specific filing."
          value={v.message}
          onChange={(e) => set("message", e.target.value)}
          aria-invalid={!!errors.message}
          aria-describedby={describedBy("message", { help: salesHint, error: errors.message })}
          className={cn(controlCls, "h-auto resize-y py-2.5 leading-relaxed")}
        />
      </Field>

      <Honeypot value={v.website} onChange={(val) => set("website", val)} />

      <div aria-live="assertive" role="alert" className="empty:hidden">
        {failureText && <FormAlert>{failureText}</FormAlert>}
      </div>

      <div>
        {/* Navy, not gold: the sales banner keeps the page's one gold button (deck §6). */}
        <Button
          type="submit"
          size="lg"
          disabled={busy}
          className="h-12 w-full bg-[hsl(222_47%_22%)] text-white hover:bg-[hsl(222_47%_28%)] dark:bg-[hsl(205_90%_78%)] dark:text-[hsl(222_47%_11%)] dark:hover:bg-[hsl(205_90%_84%)]"
        >
          {busy ? "Sending…" : "Send message"}
        </Button>
        <p className="mt-3 text-center text-[13px] text-muted-foreground">
          We use your details only to reply to this message.
        </p>
      </div>
    </form>
  );
}

/** "Send a message" on a contact card: preselects the topic and moves focus to the form. */
export function TopicButton({ topic, children }: { topic: Topic; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={() => {
        window.dispatchEvent(new CustomEvent<Topic>("contact:topic", { detail: topic }));
        const field = document.getElementById("name");
        field?.scrollIntoView({ behavior: "smooth", block: "center" });
        field?.focus({ preventScroll: true });
      }}
      className="inline-flex min-h-11 items-center text-[14.5px] font-medium text-tone-fg underline decoration-current/35 underline-offset-4 hover:decoration-current"
    >
      {children}
    </button>
  );
}
