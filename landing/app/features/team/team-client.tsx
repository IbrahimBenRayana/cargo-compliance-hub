"use client";

import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import { Building2, Shield, FileSearch } from "lucide-react";
import { Container } from "@/components/ui/container";
import { Button } from "@/components/ui/button";
import { MacWindow } from "@/components/ui/mac-window";
import { PageHero } from "@/components/page-hero";
import { TeamScene } from "@/components/illustrations/team-scene";

const EASE = [0.22, 1, 0.36, 1] as const;

const ROLES = [
  {
    role: "Admin",
    description:
      "Full access — manage team members, billing, organization settings, and all filings.",
    available: true,
  },
  {
    role: "Editor",
    description:
      "Create, edit, and submit filings. Cannot manage billing or team members.",
    available: true,
  },
  {
    role: "Viewer",
    description:
      "Read-only access to all filings, compliance scores, and audit logs.",
    available: true,
  },
  {
    role: "Custom roles",
    description: "Granular permission sets tailored to your org. Coming on the Scale plan.",
    available: false,
  },
];

export function TeamClient() {
  return (
    <>
      <PageHero
        label="TEAM"
        title="Built for teams, not solo operators"
        description="Multi-user workspaces, role-based access, shared audit trails."
        breadcrumbs={[
          { label: "Features", href: "/features" },
          { label: "Team Management", href: "/features/team" },
        ]}
        illustration={<TeamScene className="w-full max-w-xs h-auto text-foreground/90" />}
      />

      {/* Multi-org support */}
      <section className="py-14 md:py-20">
        <Container>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.55, ease: EASE }}
            className="flex items-start gap-5 max-w-3xl"
          >
            <div className="shrink-0 flex items-center justify-center rounded-xl bg-primary/8 p-3">
              <Building2 className="h-6 w-6 text-primary" strokeWidth={1.5} />
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground mb-3">
                MULTI-ORG
              </p>
              <h2 className="text-2xl md:text-3xl font-semibold tracking-tight mb-4">
                One account, multiple importers
              </h2>
              <p className="text-base md:text-lg text-muted-foreground leading-relaxed">
                Manage filings for multiple importer entities from a single MyCargoLens account.
                Switch organizations without logging out — useful for brokers, 3PLs, and compliance
                consultants managing multiple clients. Each organization has its own compliance
                history, team, and billing.
              </p>
            </div>
          </motion.div>
        </Container>
      </section>

      {/* Role-based access */}
      <section className="py-14 md:py-16 border-t border-border/60">
        <Container>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.55, ease: EASE }}
            className="mb-10"
          >
            <div className="flex items-start gap-5 max-w-3xl">
              <div className="shrink-0 flex items-center justify-center rounded-xl bg-primary/8 p-3">
                <Shield className="h-6 w-6 text-primary" strokeWidth={1.5} />
              </div>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground mb-3">
                  ACCESS CONTROL
                </p>
                <h2 className="text-2xl md:text-3xl font-semibold tracking-tight mb-4">
                  Role-based access control
                </h2>
                <p className="text-base md:text-lg text-muted-foreground leading-relaxed">
                  Assign roles to each team member. Keep sensitive billing and admin controls out
                  of the hands of filing staff while giving compliance reviewers read-only visibility.
                </p>
              </div>
            </div>
          </motion.div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-3xl">
            {ROLES.map((r, i) => (
              <motion.div
                key={r.role}
                initial={{ opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-40px" }}
                transition={{ duration: 0.45, delay: i * 0.07, ease: EASE }}
                className={`rounded-xl border p-5 ${
                  r.available
                    ? "border-border/60 bg-card/60"
                    : "border-border/40 bg-muted/30"
                }`}
              >
                <div className="flex items-center gap-2 mb-2">
                  <span
                    className={`text-sm font-semibold ${
                      r.available ? "text-foreground" : "text-muted-foreground"
                    }`}
                  >
                    {r.role}
                  </span>
                  {!r.available && (
                    <span className="inline-flex items-center rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold text-amber-600 dark:text-amber-400 border border-amber-500/20">
                      Coming soon
                    </span>
                  )}
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {r.description}
                </p>
              </motion.div>
            ))}
          </div>
        </Container>
      </section>

      {/* Audit trail */}
      <section className="py-14 md:py-16 border-t border-border/60">
        <Container>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.55, ease: EASE }}
            className="flex items-start gap-5 max-w-3xl"
          >
            <div className="shrink-0 flex items-center justify-center rounded-xl bg-primary/8 p-3">
              <FileSearch className="h-6 w-6 text-primary" strokeWidth={1.5} />
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground mb-3">
                AUDIT TRAIL
              </p>
              <h2 className="text-2xl md:text-3xl font-semibold tracking-tight mb-4">
                Shared audit trail — every action logged
              </h2>
              <p className="text-base md:text-lg text-muted-foreground leading-relaxed">
                Every create, edit, submit, amendment, and cancellation is logged with timestamps
                and user attribution. The audit trail is shared across your team, export-ready
                as CSV, and available for CBP audits or internal review at any time.
              </p>
            </div>
          </motion.div>
        </Container>
      </section>

      {/* Screenshot */}
      <section className="py-14 md:py-20 border-t border-border/60">
        <Container>
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.65, ease: EASE }}
          >
            <MacWindow
              title="Dashboard — MyCargoLens"
              urlBar="app.mycargolens.com/dashboard"
            >
              <Image
                src="/screenshots/dashboard.png"
                alt="MyCargoLens dashboard showing team filing metrics and activity"
                width={2400}
                height={1500}
                className="w-full h-auto block"
              />
            </MacWindow>
          </motion.div>
        </Container>
      </section>

      {/* CTA */}
      <section className="py-16 md:py-20 border-t border-border/60">
        <Container>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.55, ease: EASE }}
            className="text-center max-w-xl mx-auto"
          >
            <h2 className="text-2xl md:text-3xl font-semibold tracking-tight mb-4">
              Bring your whole team
            </h2>
            <p className="text-muted-foreground mb-8">
              Every plan includes unlimited team members. Pay only for filings.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <Button variant="gold" size="lg" asChild>
                <a
                  href="https://app.mycargolens.com/sign-up"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Start free
                </a>
              </Button>
              <Button variant="outline" size="lg" asChild>
                <Link href="/pricing">See pricing</Link>
              </Button>
            </div>
          </motion.div>
        </Container>
      </section>
    </>
  );
}
