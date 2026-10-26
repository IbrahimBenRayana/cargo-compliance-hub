/**
 * Frequently-asked questions — pricing, billing, security, support. Keep the
 * pricing numbers in sync with server/src/config/plans.ts and the landing
 * /pricing page, and the billing rules in sync with
 * server/src/services/shipmentBilling.ts (charge on CBP ACCEPTANCE, not on
 * submission). If unsure of an exact figure, the assistant should offer to
 * connect a human rather than guess.
 */
export const FAQ_KB = `
# Pricing

There is NO monthly subscription fee. Each organization is on ONE tier, which
sets a flat per-shipment rate and unlocks that tier's features. You keep a card
on file and pay the flat rate per shipment. Browsing, drafting and manifest
(MBOL) queries are free.

Tiers (per shipment, no monthly fee):
- **ISF Filing — $45 / shipment.** ISF-10 / ISF-5 filings, templates, manifest
  query, email support.
- **ISF + Entry — $180 / shipment.** Everything in ISF Filing, plus ABI Entry
  Summary (7501) and Cargo Release (3461). Chat support.
- **Complete — $280 / shipment.** Everything in ISF + Entry, plus container
  tracking, HTS classification suggestions, the duty calculator, and priority
  support.
- **Volume pricing on request.** Forwarders, NVOCCs and brokers filing at volume
  get pricing agreed in writing; don't quote the $45 card to a volume filer, and
  never quote or estimate a volume number. Offer a demo or a human instead.

# Billing — when you're charged

- You're charged when **CBP accepts** the shipment, not when you submit it.
- A filing CBP rejects is **not charged**. Fix it and resubmit; resubmits and
  amendments are **never charged twice**.
- A linked ISF and ABI Entry on the same shipment is billed once.
- The charge goes to the card on file right after acceptance.
- Tier changes apply to shipments accepted after the change; existing data is
  untouched.

# Support

- Email: support@mycargolens.com
- In-app and on this site you can talk to this assistant, and at any point ask
  to "talk to a human" to reach the MyCargoLens team.

# Customs domain quick reference

- **ISF (Importer Security Filing / "10+2")** — advance cargo data filed to CBP
  before ocean lading; ISF-10 for general cargo, ISF-5 for FROB/IE/T&E.
- **Entry (7501 / 3461)** — the formal customs entry: 3461 is Cargo Release,
  7501 is the Entry Summary (duties/taxes/fees).
- **PSC (Post-Summary Correction)** — a correction to an entry summary before
  liquidation. CBP's regular PSC window is 300 days from the date of entry.
- **Liquidation** — CBP's final computation of duties on an entry; MyCargoLens
  tracks each accepted entry through a 314-day liquidation window.
- **In-Bond (7512)** — moves cargo under bond without entry at the first port.
  (MyCargoLens doesn't file in-bonds yet — roadmap.)
- **Type 86** — a Section 321 low-value entry type that CBP has discontinued.
- **HTS** — Harmonized Tariff Schedule classification code that drives duty rates.
- **CBP** — US Customs and Border Protection, the agency these filings go to.
- **Rejection codes** — CBP error responses that block a filing; the AI Coach
  translates them and suggests fixes.
`.trim();
