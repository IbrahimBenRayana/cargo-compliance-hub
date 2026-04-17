"use client";

import * as React from "react";
import { Mail, Clock, Building2, CheckCircle2 } from "lucide-react";
import { Container } from "@/components/ui/container";
import { Button } from "@/components/ui/button";
import { PageHero } from "@/components/page-hero";
import { ContactScene } from "@/components/illustrations/contact-scene";

type SubjectOption =
  | ""
  | "General inquiry"
  | "Technical support"
  | "Enterprise inquiry"
  | "Bug report"
  | "Other";

interface FormState {
  name: string;
  email: string;
  subject: SubjectOption;
  message: string;
}

const initialForm: FormState = {
  name: "",
  email: "",
  subject: "",
  message: "",
};

const infoCards = [
  {
    icon: Mail,
    title: "Email us",
    body: "support@mycargolens.com",
    href: "mailto:support@mycargolens.com",
  },
  {
    icon: Clock,
    title: "Response time",
    body: "We reply within one business day",
    href: null,
  },
  {
    icon: Building2,
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

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    // Simulate async submission
    setTimeout(() => {
      console.log("Contact form:", form);
      setLoading(false);
      setSubmitted(true);
    }, 600);
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
              {infoCards.map(({ icon: Icon, title, body, href }) => (
                <div
                  key={title}
                  className="flex items-start gap-4 rounded-xl border border-border/60 bg-card/50 p-5"
                >
                  <div className="mt-0.5 flex-shrink-0 flex items-center justify-center rounded-lg bg-primary/8 p-2.5">
                    <Icon className="h-4 w-4 text-primary" aria-hidden="true" />
                  </div>
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
                    <option value="General inquiry">General inquiry</option>
                    <option value="Technical support">Technical support</option>
                    <option value="Enterprise inquiry">Enterprise inquiry</option>
                    <option value="Bug report">Bug report</option>
                    <option value="Other">Other</option>
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
