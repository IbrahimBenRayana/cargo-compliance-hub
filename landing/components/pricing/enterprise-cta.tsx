"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import { Container } from "@/components/ui/container";
import { Button } from "@/components/ui/button";

const ENTERPRISE_FEATURES = [
  "Unlimited or contracted volume",
  "SSO: Google, Microsoft, Okta",
  "99.9% uptime SLA + 1h response",
  "Dedicated success manager",
  "Custom integrations (EDI, ERP, WMS)",
  "Security review + DPA + SOC 2 Type II report",
  "White-label deployment available",
];

type FormData = {
  name: string;
  company: string;
  email: string;
  filings: string;
  message: string;
};

export function EnterpriseCta() {
  const [form, setForm] = useState<FormData>({
    name: "",
    company: "",
    email: "",
    filings: "",
    message: "",
  });
  const [submitted, setSubmitted] = useState(false);

  function handleChange(
    e: React.ChangeEvent<
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    >
  ) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    console.log("Enterprise form submitted", form);
    setSubmitted(true);
  }

  return (
    <section id="enterprise" className="py-24 md:py-32">
      <Container>
        <div className="rounded-2xl border border-border bg-card overflow-hidden">
          <div className="grid md:grid-cols-2 gap-0">
            {/* Left — copy */}
            <div className="p-8 md:p-12 lg:p-14 flex flex-col justify-center">
              <span className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                ENTERPRISE
              </span>
              <h2 className="mt-4 text-3xl md:text-4xl font-semibold tracking-tight text-foreground">
                Built for high-volume importers and brokers.
              </h2>
              <p className="mt-4 text-muted-foreground leading-relaxed">
                Unlimited filings. Dedicated infrastructure. SSO, SLA, and a
                human on call. We&apos;ll shape the platform around your
                compliance workflow — not the other way around.
              </p>

              <ul className="mt-8 flex flex-col gap-3">
                {ENTERPRISE_FEATURES.map((feature) => (
                  <li key={feature} className="flex items-start gap-3">
                    <Check
                      className="h-4 w-4 text-gold shrink-0 mt-0.5"
                      strokeWidth={2.5}
                    />
                    <span className="text-sm text-foreground/80">{feature}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Right — form */}
            <div className="bg-muted/30 border-t md:border-t-0 md:border-l border-border p-8 md:p-12 lg:p-14 flex flex-col justify-center">
              {submitted ? (
                <div className="text-center">
                  <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-gold/15">
                    <Check className="h-6 w-6 text-gold" strokeWidth={2.5} />
                  </div>
                  <h3 className="text-xl font-semibold text-foreground">
                    We&apos;ll be in touch soon.
                  </h3>
                  <p className="mt-2 text-sm text-muted-foreground">
                    We reply within one business day.
                  </p>
                </div>
              ) : (
                <>
                  <h3 className="text-2xl font-semibold text-foreground mb-6">
                    Talk to us
                  </h3>
                  <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="flex flex-col gap-1.5">
                        <label
                          htmlFor="name"
                          className="text-xs font-medium text-foreground/70"
                        >
                          Name
                        </label>
                        <input
                          id="name"
                          name="name"
                          type="text"
                          required
                          value={form.name}
                          onChange={handleChange}
                          placeholder="Jane Smith"
                          className="h-10 rounded-lg border border-border bg-card px-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring transition-colors"
                        />
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <label
                          htmlFor="company"
                          className="text-xs font-medium text-foreground/70"
                        >
                          Company
                        </label>
                        <input
                          id="company"
                          name="company"
                          type="text"
                          required
                          value={form.company}
                          onChange={handleChange}
                          placeholder="Acme Imports LLC"
                          className="h-10 rounded-lg border border-border bg-card px-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring transition-colors"
                        />
                      </div>
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <label
                        htmlFor="email"
                        className="text-xs font-medium text-foreground/70"
                      >
                        Company email
                      </label>
                      <input
                        id="email"
                        name="email"
                        type="email"
                        required
                        value={form.email}
                        onChange={handleChange}
                        placeholder="jane@acmeimports.com"
                        className="h-10 rounded-lg border border-border bg-card px-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring transition-colors"
                      />
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <label
                        htmlFor="filings"
                        className="text-xs font-medium text-foreground/70"
                      >
                        Filings per month
                      </label>
                      <select
                        id="filings"
                        name="filings"
                        required
                        value={form.filings}
                        onChange={handleChange}
                        className="h-10 rounded-lg border border-border bg-card px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring transition-colors"
                      >
                        <option value="" disabled>
                          Select a range
                        </option>
                        <option value="lt-50">&lt; 50</option>
                        <option value="50-200">50–200</option>
                        <option value="200-1000">200–1000</option>
                        <option value="1000+">1000+</option>
                      </select>
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <label
                        htmlFor="message"
                        className="text-xs font-medium text-foreground/70"
                      >
                        Message{" "}
                        <span className="text-muted-foreground font-normal">
                          (optional)
                        </span>
                      </label>
                      <textarea
                        id="message"
                        name="message"
                        rows={3}
                        value={form.message}
                        onChange={handleChange}
                        placeholder="Tell us about your workflow, integrations, or any specific requirements."
                        className="rounded-lg border border-border bg-card px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring transition-colors resize-none"
                      />
                    </div>

                    <Button type="submit" variant="gold" size="lg" className="w-full mt-2">
                      Request a quote
                    </Button>
                  </form>

                  <p className="mt-4 text-center text-xs text-muted-foreground">
                    We reply within one business day. No sales sequences, no
                    pressure.
                  </p>
                </>
              )}
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
}
