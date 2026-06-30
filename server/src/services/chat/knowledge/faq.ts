/**
 * Frequently-asked questions — pricing, billing, security, support. Keep the
 * pricing numbers in sync with server/src/config/plans.ts and the landing
 * /pricing page. If unsure of an exact figure, the assistant should offer to
 * connect a human rather than guess.
 */
export const FAQ_KB = `
# Pricing

There is NO monthly subscription fee. You pick ONE tier, which sets a flat
per-shipment rate and unlocks that tier's features. You keep a card on file and
are charged the flat rate for each shipment you file. You only pay for what you
actually file — browsing, drafting, and manifest (MBOL) queries are always free.

Tiers (per shipment filed, no monthly fee):
- **ISF Filing — $45 / shipment.** File ISF-10 / ISF-5 security filings.
  Includes templates, manifest query, email support.
- **ISF + Entry — $180 / shipment.** Everything in ISF Filing, plus ABI Entry
  Summary (7501) and Cargo Release (3461). Chat support.
- **Complete — $280 / shipment.** Everything in ISF + Entry, plus container
  tracking, HTS classification, the duty calculator, and priority support.
- **Enterprise — contact sales.** Volume per-shipment pricing, SSO, uptime SLA,
  dedicated support, custom integrations.

Billing details:
- One charge per shipment you file. A linked ISF and ABI Entry on the SAME
  shipment is billed once, not twice. Fixing and resubmitting the same filing
  never double-charges.
- The charge happens on the first successful CBP submission for that shipment.
- You can change tiers anytime from billing settings; the new rate/features
  apply to shipments filed after the change. Existing data is untouched.

# Support

- Email: support@mycargolens.com
- In-app and on this site you can talk to the AI assistant, and at any point ask
  to "talk to a human" to reach the MyCargoLens team.

# Security (short form)

- Encryption in transit and at rest, role-based access, per-org isolation.
- AI uses OpenAI's zero-retention API tier; trade data is not used for training,
  and only filing data + the CBP response is ever sent to the model.

# Customs domain quick reference

- **ISF (Importer Security Filing / "10+2")** — advance cargo data filed to CBP
  before ocean arrival; ISF-10 for general cargo, ISF-5 for FROB/IE/T&E.
- **Entry (7501 / 3461)** — the formal customs entry: 3461 is Cargo Release,
  7501 is the Entry Summary (duties/taxes/fees).
- **In-Bond (7512)** — moves cargo under bond without entry at the first port.
- **HTS** — Harmonized Tariff Schedule classification code that drives duty rates.
- **CBP** — US Customs and Border Protection, the agency these filings go to.
- **Rejection codes** — CBP error responses that block a filing; the AI Coach
  translates them and suggests fixes.
`.trim();
