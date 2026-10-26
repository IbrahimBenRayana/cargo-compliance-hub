/**
 * Curated business knowledge for the AI assistant. Plain prose, version-
 * controlled here (not a DB). Kept as a TS string so it ships with the `tsc`
 * build (no asset-copy step). Keep facts in sync with the approved-claims list
 * (marketing/context/product-marketing.md §1 + §8), server/src/config/plans.ts
 * and server/src/services/shipmentBilling.ts. Roadmap items live in the
 * "Not available" section below and must never be described as live.
 */
export const BUSINESS_KB = `
# What MyCargoLens is

MyCargoLens is ISF and customs entry software that shows which filing needs you
now, checks it before CBP does, and puts the price per shipment on the website.
Importers, forwarders/NVOCCs and customs brokers file their Importer Security
Filing (ISF-10 / ISF-5), ABI Entry Summary (7501) and Cargo Release (3461) with
US Customs and Border Protection (CBP) from one workspace, with a compliance
inbox that ranks open work by urgency.

MyCargoLens is CBP ABI certified: our native ABI engine is certified by CBP and
we have a direct connection to CBP. We transmit to CBP ourselves, no middleman,
and every CBP request and response is logged.

MyCargoLens is software, not a customs broker. It does not file on anyone's
behalf as their broker and does not give classification or legal advice.

# Who it's for

- Importers of record who file their own ISF and entries, or want control over them.
- Forwarders and NVOCCs filing ISFs at volume (volume pricing on request).
- Customs brokers and 3PLs, including via the public API.

# What's live today

- **Filings** — ISF-10 and ISF-5; ABI Entry Summary (7501) and Cargo Release
  (3461). An entry starts prefilled from the accepted ISF and stays linked to it.
  Templates, clone any filing, and bulk-submit up to 20 drafts at once.
- **ISF deadline clock** — deadline from the lading date (24h before lading),
  with alerts at 72h, 48h and 24h before it.
- **Checks before CBP** — rule-based validation on every submit (app, bulk and
  API); an optional AI pre-flight review of any draft.
- **Rejections in plain English** — CBP error codes translated into numbered
  fix steps (the AI Coach).
- **Compliance inbox** — open work ranked by urgency: ISF deadlines, rejections,
  possible UFLPA exposure, PSC deadlines, liquidations due soon, repeated
  rejections, drafts to review.
- **Liquidation and PSC tracking** — every accepted entry is tracked through its
  314-day liquidation window, with the post-summary correction (PSC) deadline at
  300 days from the date of entry (CBP's regular PSC window).
- **Compliance helpers** — ADD/CVD orders pulled from the Federal Register daily,
  UFLPA flags, which agencies (FDA, USDA-APHIS, EPA, FCC) may own an HTS code,
  FTA program lookup, and HTS code suggestions with alternatives and reasoning
  (suggestions only, never rulings).
- **Duty calculator** and **container tracking** (vessel ETAs, last free day) on
  the Complete plan.
- **Manifest (MBOL) query** — free on every plan.
- **Audit trail** — every CBP request and response logged; four roles (Owner,
  Admin, Operator, Viewer), MFA, CSV export, full-lifecycle PDF export.
- **Public API** — REST at /api/public/v1 with scoped, revocable keys; ISF and
  entry read/write; JSON or XML; HMAC-signed status webhooks.
- **This assistant**, with live hand-off to a person.

# Not available (roadmap or not offered) — never offer these as live

- **In-bond (7512)** — on the roadmap, not available yet. MyCargoLens cannot
  file in-bonds today.
- **Type 86 (Section 321)** — CBP discontinued Type 86 entries; MyCargoLens does
  not offer it.
- **SSO / SAML single sign-on** — not available. Sign-in is email + password
  with MFA (authenticator app or email code, plus recovery codes).
- **FTZ, drawback, AES export filing, ISF bonds, FDA Prior Notice filing, CBP
  exam tracking** — not offered today.
- **A self-serve trial or sandbox** — not offered; book a demo instead.
If someone asks for one of these, say plainly that MyCargoLens doesn't offer it
today, don't give dates, and offer to connect them with the team if it matters
to their decision.

# Onboarding / getting started

MyCargoLens is sales-led and accounts are invitation-only. There is no self-serve
signup or free trial. The path for a prospect is to **book a 20-minute demo**
(the "Book a demo" button / /book-a-demo page on the marketing site); the team
then sets up their organization, and team members get a set-password email.

# Security & data handling

- Role-based access, per-organization data isolation, encryption in transit.
- Passwords hashed with bcrypt; refresh tokens rotate on use; MFA secrets
  encrypted (AES-256-GCM); API keys shown once and stored hashed.
- AI features only send the filing being reviewed (plus the CBP response, for a
  rejection) to the model. Billing/banking details and other organizations'
  data are never sent.
- For anything deeper (certifications, questionnaires), offer a human.
`.trim();
