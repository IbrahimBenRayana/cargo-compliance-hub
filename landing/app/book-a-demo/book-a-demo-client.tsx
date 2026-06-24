"use client";

import * as React from "react";
import { CalendarClock, Clock, ShieldCheck, CheckCircle2 } from "lucide-react";
import { Container } from "@/components/ui/container";
import { Button } from "@/components/ui/button";
import { IconTile, type IconTileHover } from "@/components/ui/icon-tile";
import { PageHero } from "@/components/page-hero";
import { ContactScene } from "@/components/illustrations/contact-scene";

// Monthly shipment volume — values double as the labels shown in the
// composed message body, so keep them human-readable.
const VOLUME_OPTIONS = ["1–10", "11–50", "51–200", "200+"] as const;

// What the visitor files. Values are stable keys; labels are shown in the
// <option> and embedded (resolved) into the message body on submit.
const FILING_OPTIONS = [
  { value: "isf", label: "ISF only" },
  { value: "isf-entry", label: "ISF + Entry" },
  { value: "full", label: "Full customs" },
] as const;

type VolumeOption = "" | (typeof VOLUME_OPTIONS)[number];
type FilingOption = "" | (typeof FILING_OPTIONS)[number]["value"];

interface FormState {
  name: string;
  email: string;
  company: string;
  volume: VolumeOption;
  filing: FilingOption;
  message: string;
  // Honeypot — kept hidden in the DOM. Real users never fill it; bots do.
  // Submitted as-is so the server can drop spam silently.
  website: string;
}

const initialForm: FormState = {
  name: "",
  email: "",
  company: "",
  volume: "",
  filing: "",
  message: "",
  website: "",
};

// Marketing site → API base URL. Configured per-deploy via
// NEXT_PUBLIC_API_URL (e.g. https://app.mycargolens.com). Falls back to the
// dev server in development.
const API_URL =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") || "http://localhost:3001";

const infoCards: Array<{
  icon: typeof CalendarClock;
  hover: IconTileHover;
  title: string;
  body: string;
}> = [
  {
    icon: CalendarClock,
    hover: "lift",
    title: "20 minutes, no slides",
    body: "A live walkthrough of the filing inbox on your kind of shipments.",
  },
  {
    icon: Clock,
    hover: "spin",
    title: "We'll be in touch fast",
    body: "We reply within one business day to schedule a time that works.",
  },
  {
    icon: ShieldCheck,
    hover: "lift",
    title: "Set up on the right plan",
    body: "After the demo we provision your account on the plan that fits.",
  },
];

export function BookADemoClient() {
  const [form, setForm] = React.useState<FormState>(initialForm);
  const [submitted, setSubmitted] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  function handleChange(
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    // Browser-side guards — the selects keep an empty-string default.
    if (!form.volume) {
      setError("Please pick your typical shipment volume.");
      return;
    }
    if (!form.filing) {
      setError("Please tell us what you file.");
      return;
    }

    // The contact endpoint only accepts name/email/subject/message/website,
    // so we fold company, volume, and filing type into the message body as
    // a small structured block above any free-text note.
    const filingLabel =
      FILING_OPTIONS.find((o) => o.value === form.filing)?.label ?? form.filing;
    const composedMessage = [
      `Company: ${form.company.trim() || "—"}`,
      `Typical shipment volume: ${form.volume}`,
      `What they file: ${filingLabel}`,
      "",
      form.message.trim() || "(no additional message)",
    ].join("\n");

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
          subject: "demo",
          message: composedMessage,
          // Honeypot — kept blank by real users, populated by bots.
          website: form.website,
        }),
      });

      if (!res.ok) {
        // 429 = rate-limited (caller hit our 5/hr cap). Surface a specific
        // message; everything else gets a generic one.
        if (res.status === 429) {
          setError("Too many submissions from this network. Email us directly: sales@mycargolens.com");
        } else {
          setError("Something went wrong sending your request. Please email us at sales@mycargolens.com");
        }
        setLoading(false);
        return;
      }

      setLoading(false);
      setSubmitted(true);
    } catch {
      setError("Couldn't reach the server. Please email us at sales@mycargolens.com");
      setLoading(false);
    }
  }

  return (
    <>
      <PageHero
        label="BOOK A DEMO"
        title="See MyCargoLens in action."
        description="Book a 20-minute demo — we'll set up your account on the right plan afterward."
        illustration={<ContactScene className="w-full max-w-xs h-auto text-foreground/90" />}
      />
      <section className="pb-20 md:pb-28">
        <Container>
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-start">
            {/* Left — what to expect */}
            <div>
              <div className="flex flex-col gap-4">
                {infoCards.map(({ icon: Icon, hover, title, body }, idx) => (
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
                      <p className="text-sm text-muted-foreground">{body}</p>
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
                  <h2 className="text-xl font-semibold">Thanks — we&apos;ll be in touch to schedule your demo</h2>
                  <p className="text-muted-foreground text-sm max-w-xs">
                    We reply within one business day. Keep an eye on your inbox.
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
                    Request another demo
                  </Button>
                </div>
              ) : (
                <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-5">
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="name" className="text-sm font-medium">
                      Full name <span className="text-muted-foreground">(required)</span>
                    </label>
                    <input
                      id="name"
                      name="name"
                      type="text"
                      autoComplete="name"
                      required
                      value={form.name}
                      onChange={handleChange}
                      placeholder="Jane Smith"
                      className="w-full rounded-lg border border-border bg-background px-3.5 py-2.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring transition-shadow"
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="email" className="text-sm font-medium">
                      Work email <span className="text-muted-foreground">(required)</span>
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
                    <label htmlFor="company" className="text-sm font-medium">
                      Company
                    </label>
                    <input
                      id="company"
                      name="company"
                      type="text"
                      autoComplete="organization"
                      value={form.company}
                      onChange={handleChange}
                      placeholder="Acme Imports"
                      className="w-full rounded-lg border border-border bg-background px-3.5 py-2.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring transition-shadow"
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="volume" className="text-sm font-medium">
                      Typical shipment volume
                    </label>
                    <select
                      id="volume"
                      name="volume"
                      value={form.volume}
                      onChange={handleChange}
                      className="w-full rounded-lg border border-border bg-background px-3.5 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring transition-shadow"
                    >
                      <option value="">Select a range…</option>
                      {VOLUME_OPTIONS.map((v) => (
                        <option key={v} value={v}>
                          {v} shipments / month
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="filing" className="text-sm font-medium">
                      What do you file?
                    </label>
                    <select
                      id="filing"
                      name="filing"
                      value={form.filing}
                      onChange={handleChange}
                      className="w-full rounded-lg border border-border bg-background px-3.5 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring transition-shadow"
                    >
                      <option value="">Select…</option>
                      {FILING_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="message" className="text-sm font-medium">
                      Anything else? <span className="text-muted-foreground">(optional)</span>
                    </label>
                    <textarea
                      id="message"
                      name="message"
                      rows={4}
                      value={form.message}
                      onChange={handleChange}
                      placeholder="Tell us what you'd like to see…"
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
                    {loading ? "Sending…" : "Request a demo"}
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
