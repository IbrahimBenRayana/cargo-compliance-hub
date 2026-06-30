/**
 * Curated business knowledge for the AI assistant. Plain prose, version-
 * controlled here (not a DB). Kept as a TS string so it ships with the `tsc`
 * build (no asset-copy step). Keep facts in sync with the landing site and
 * server/src/config/plans.ts — pricing especially.
 */
export const BUSINESS_KB = `
# What MyCargoLens is

MyCargoLens is a US customs compliance platform — "an inbox for US customs, not
another dashboard." Importers and customs brokers file their Importer Security
Filing (ISF), ABI Entry (7501 / 3461), and In-Bond documents to US Customs and
Border Protection (CBP) from one calm workspace, with an AI Coach that explains
and helps fix every CBP rejection in plain English.

The product replaces the anxiety of legacy customs software: instead of a wall
of fields and cryptic CBP reason codes, it behaves like an inbox — what needs
your attention, why, and what to do next.

# Who it's for

- Importers of record (small, mid-market, and enterprise) who file their own ISF/Entry.
- Customs brokers and 3PLs filing on behalf of clients.
- Teams that want fewer rejected filings, clearer deadlines, and less time
  decoding CBP errors.

# Core value

- One workspace for ISF, Entry, and In-Bond instead of separate tools.
- AI Coach: every CBP rejection is translated into plain language with concrete
  fix steps; a pre-flight review catches problems before you submit.
- Compliance Center: risk scoring, data validation, and rejection translation.
- Container tracking and shipment lifecycle in the same place as the filings.

# The product surfaces (features)

- **Filings** — ISF-10 / ISF-5 security filings; ABI Entry Summary (7501) and
  Cargo Release (3461). In-Bond is on the roadmap.
- **Compliance Center** — risk/compliance scoring, validation, and the AI Coach
  that explains CBP rejections and suggests fixes.
- **Automation** — background jobs (status polling, deadline checks) and
  webhooks for integrators.
- **Lifecycle** — shipment journey tracking, score history, container tracking.
- **AI** — built on OpenAI gpt-4o-class models; gated by each team's enable flag;
  zero-retention API tier (data is not used for model training).
- **Public API** — a key-authenticated REST surface (mcl_live_… keys) for
  brokers / 3PLs / ERP integrations: ISF + ABI read/write, XML, and webhooks.

# Onboarding / getting started

MyCargoLens is sales-led. New customer organizations are provisioned by the
MyCargoLens team. The path for a prospect is to **book a demo** (the "Book a
demo" button / /book-a-demo page on the marketing site). After provisioning,
team members get a set-password email and sign in to the app.

# Security & data handling

- Encryption in transit and at rest; role-based access; per-organization data isolation.
- AI: only the relevant filing data plus the CBP response is sent to the model.
  AR/banking/billing and unrelated tenant data are never sent. The OpenAI API
  tier used is zero-retention by contract — your data is not used for training.
- See the marketing site's Security page for the full posture.
`.trim();
