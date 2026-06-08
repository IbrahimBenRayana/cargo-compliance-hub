"use client";

import * as React from "react";
import { Mail, Clock, Building2, CheckCircle2 } from "lucide-react";
import { Container } from "@/components/ui/container";
import { Button } from "@/components/ui/button";
import { IconTile, type IconTileHover } from "@/components/ui/icon-tile";
import { PageHero } from "@/components/page-hero";
import { ContactScene } from "@/components/illustrations/contact-scene";

// Subject values match the server enum (see server/src/routes/contact.ts).
// The display labels in the <option> elements diverge from these keys —
// keys are stable, labels can be reworded without a server change.
type SubjectOption =
  | ""
  | "demo"
  | "general"
  | "support"
  | "enterprise"
  | "bug"
  | "other";

interface FormState {
  name: string;
  email: string;
  subject: SubjectOption;
  message: string;
  // Honeypot — kept hidden in the DOM. Real users never fill it; bots do.
  // Submitted as-is so the server can drop spam silently.
  website: string;
}

const initialForm: FormState = {
  name: "",
  email: "",
  subject: "",
  message: "",
  website: "",
};

// Marketing site → API base URL. Configured per-deploy via
// NEXT_PUBLIC_API_URL (e.g. https://app.mycargolens.com). Falls back to the
// dev server in development.
const API_URL =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") || "http://localhost:3001";

const infoCards: Array<{
  icon: typeof Mail;
  hover: IconTileHover;
  title: string;
  body: string;
  href: string | null;
}> = [
  {
    icon: Mail,
    hover: "lift",
    title: "Email us",
    body: "support@mycargolens.com",
    href: "mailto:support@mycargolens.com",
  },
  {
    icon: Clock,
    hover: "spin",
    title: "Response time",
    body: "We reply within one business day",
    href: null,
  },
  {
    icon: Building2,
    hover: "lift",
    title: "Enterprise",
    body: "For enterprise inquiries, use the form or email sales@mycargolens.com",
    href: "mailto:sales@mycargolens.com",
  },
];

export default function ContactPage() {
  const [form, setForm] = React.useState<FormState>(initialForm);
  const [submitted, setSubmitted] = React.useState(false);
  const [loading, setLoading] = React.useState(false);

  function handleChange(
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  const [error, setError] = React.useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    // Browser-side guard — the select keeps an empty-string default.
    if (!form.subject) {
      setError("Please pick a topic.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/v1/contact`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // No cookies needed — endpoint is public. credentials:'omit' keeps
        // the preflight simple.
        credentials: "omit",
        body: JSON.stringify({
          name: form.name.trim(),
          email: form.email.trim(),
          subject: form.subject,
          message: form.message.trim(),
          // Honeypot — kept blank by real users, populated by bots.
          website: form.website,
        }),
      });

      if (!res.ok) {
        // 429 = rate-limited (caller hit our 5/hr cap). Surface a specific
        // message; everything else gets a generic one.
        if (res.status === 429) {
          setError("Too many submissions from this network. Email us directly: support@mycargolens.com");
        } else {
          setError("Something went wrong sending your message. Please email us at support@mycargolens.com");
        }
        setLoading(false);
        return;
      }

      setLoading(false);
      setSubmitted(true);
    } catch {
      setError("Couldn't reach the server. Please email us at support@mycargolens.com");
      setLoading(false);
    }
  }

  return (
    <>
      <PageHero
        label="CONTACT"
        title="Let's talk."
        description="Whether you're evaluating MyCargoLens for your team, have a technical question, or need help with an existing account — we're here."
        illustration={<ContactScene className="w-full max-w-xs h-auto text-foreground/90" />}
      />
      <section className="pb-20 md:pb-28">
      <Container>
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-start">
          {/* Left — Info */}
          <div>

            {/* Info cards */}
            <div className="flex flex-col gap-4">
              {infoCards.map(({ icon: Icon, hover, title, body, href }, idx) => (
                <div
                  key={title}
                  className="flex items-start gap-4 rounded-xl border border-border/60 bg-card/50 p-5"
                >
                  <IconTile
                    icon={Icon}
                    hover={hover}
                    tone="primary"
                    reveal
                    revealDelay={idx * 0.06}
                    className="mt-0.5 size-9 rounded-lg"
                  />
                  <div>
                    <p className="text-sm font-semibold mb-0.5">{title}</p>
                    {href ? (
                      <a
                        href={href}
                        className="text-sm text-muted-foreground hover:text-foreground transition-colors underline underline-offset-2"
                      >
                        {body}
                      </a>
                    ) : (
                      <p className="text-sm text-muted-foreground">{body}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Right — Form */}
          <div className="glass rounded-2xl border border-border/60 p-6 sm:p-8 shadow-card">
            {submitted ? (
              <div className="flex flex-col items-center justify-center text-center py-10 gap-4">
                <CheckCircle2
                  className="h-12 w-12 text-green-500"
                  aria-hidden="true"
                />
                <h2 className="text-xl font-semibold">Message sent!</h2>
                <p className="text-muted-foreground text-sm max-w-xs">
                  We&apos;ll get back to you within one business day.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-2"
                  onClick={() => {
                    setForm(initialForm);
                    setSubmitted(false);
                    setError(null);
                  }}
                >
                  Send another message
                </Button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-5">
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="name" className="text-sm font-medium">
                    Name
                  </label>
                  <input
                    id="name"
                    name="name"
                    type="text"
                    autoComplete="name"
                    value={form.name}
                    onChange={handleChange}
                    placeholder="Jane Smith"
                    className="w-full rounded-lg border border-border bg-background px-3.5 py-2.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring transition-shadow"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label htmlFor="email" className="text-sm font-medium">
                    Email <span className="text-muted-foreground">(required)</span>
                  </label>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    required
                    value={form.email}
                    onChange={handleChange}
                    placeholder="jane@company.com"
                    className="w-full rounded-lg border border-border bg-background px-3.5 py-2.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring transition-shadow"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label htmlFor="subject" className="text-sm font-medium">
                    Subject
                  </label>
                  <select
                    id="subject"
                    name="subject"
                    value={form.subject}
                    onChange={handleChange}
                    className="w-full rounded-lg border border-border bg-background px-3.5 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring transition-shadow"
                  >
                    <option value="">Select a topic…</option>
                    <option value="general">General inquiry</option>
                    <option value="support">Technical support</option>
                    <option value="enterprise">Enterprise inquiry</option>
                    <option value="bug">Bug report</option>
                    <option value="other">Other</option>
                  </select>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label htmlFor="message" className="text-sm font-medium">
                    Message <span className="text-muted-foreground">(required)</span>
                  </label>
                  <textarea
                    id="message"
                    name="message"
                    rows={5}
                    required
                    value={form.message}
                    onChange={handleChange}
                    placeholder="Tell us how we can help…"
                    className="w-full resize-none rounded-lg border border-border bg-background px-3.5 py-2.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring transition-shadow"
                  />
                </div>

                {/* Honeypot — visually hidden, off the tab order, with a name
                    most bots can't resist filling. Real users never see it. */}
                <div aria-hidden="true" className="absolute -left-[10000px] top-auto h-px w-px overflow-hidden">
                  <label htmlFor="website">Website</label>
                  <input
                    id="website"
                    name="website"
                    type="text"
                    tabIndex={-1}
                    autoComplete="off"
                    value={form.website}
                    onChange={handleChange}
                  />
                </div>

                {error && (
                  <p className="text-sm text-red-600 dark:text-red-400" role="alert">
                    {error}
                  </p>
                )}

                <Button
                  type="submit"
                  variant="gold"
                  size="lg"
                  className="w-full mt-1"
                  disabled={loading}
                >
                  {loading ? "Sending…" : "Send message"}
                </Button>
              </form>
            )}
          </div>
        </div>
      </Container>
      </section>
    </>
  );
}
