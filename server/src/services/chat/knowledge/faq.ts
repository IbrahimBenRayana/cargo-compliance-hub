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

There is NO monthly subscription fee on the public card. You keep a card on
file and are charged per accepted filing. Browsing, drafting, rule checks, HTS
suggestions and manifest (MBOL) queries are free.

- **ISF Filing — $45 per accepted ISF.** ISF-10 / ISF-5 filings, templates,
  manifest query, HTS suggestions, email support.
- **Customs entries (7501 / 3461) — talk to us.** There is no public entry
  price: entries are priced on a call for each account. Never quote or estimate
  an entry price; offer a demo or a human instead.
- **Volume pricing on request.** Forwarders, NVOCCs and brokers filing at volume
  get pricing agreed in writing; don't quote the $45 card to a volume filer, and
  never quote or estimate a volume number. Offer a demo or a human instead.
- **Larger teams: contact us.**

# Billing — when you're charged

- You're charged when **CBP accepts** the filing, not when you submit it.
- A filing CBP rejects is **not charged**. Fix it and resubmit; resubmits and
  amendments are **never charged twice**.
- The price follows what was filed (an ISF, or an entry), not the plan.
- The charge goes to the card on file right after acceptance. Accounts on an
  agreed volume price may be invoiced monthly instead.

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
