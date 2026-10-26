import type { ModuleKey } from "@/lib/accents";

/**
 * Pricing data for /pricing and /pricing.md (copy/pricing.md, W5).
 * Prices mirror server/src/config/plans.ts (perFilingCents 4500 / 18000 / 28000,
 * charged on CBP acceptance). Keep both in sync. No volume price exists:
 * volume pricing is on request (bible v3, A40).
 */

export type TierId = "isf" | "entry" | "full";

export type Tier = {
  /** plans.ts tier id, passed to the demo form as `?tier=`. */
  id: TierId;
  name: string;
  /** USD per shipment. */
  price: number;
  /** Fact badge on the highlighted tier (never "Most popular"). */
  badge?: string;
  featured?: boolean;
  /** Accent for the tier bar (module hues). */
  accent: ModuleKey;
  who: string;
  includes: string[];
  /** One-line summary used by /pricing.md (deck §pricing.md, word for word). */
  md: string;
};

export const PRICE_NOTE = "No monthly fee";
export const PER = "per shipment";

export const TIERS: Tier[] = [
  {
    id: "isf",
    name: "ISF Filing",
    price: 45,
    accent: "isf",
    who: "You file the ISF; your broker or another tool handles the entry.",
    includes: [
      "ISF-10 (10+2) and ISF-5",
      "Deadline clock with alerts at 72, 48 and 24 hours",
      "Templates and bulk submit",
      "Manifest (MBOL) query",
      "Email support",
    ],
    md: "ISF-10, ISF-5, deadline clock, templates, manifest query.",
  },
  {
    id: "entry",
    name: "ISF + Entry",
    price: 180,
    badge: "ISF and entry, billed once",
    featured: true,
    accent: "entry",
    who: "You file both the ISF and the entry for the same shipment.",
    includes: [
      "Everything in ISF Filing",
      "Entry summary (7501)",
      "Cargo release (3461), prefilled from the accepted ISF",
      "Linked ISF and entry billed once",
      "Chat support",
    ],
    md: "Adds entry summary (7501) and cargo release (3461). A linked ISF and entry is billed once.",
  },
  {
    id: "full",
    name: "Complete",
    price: 280,
    accent: "compliance",
    who: "You also want container tracking and duty estimates in the same place.",
    includes: [
      "Everything in ISF + Entry",
      "Container tracking with vessel ETAs and last free day",
      "Duty calculator",
      "Priority support",
    ],
    md: "Adds container tracking and the duty calculator.",
  },
];

export const usd = (n: number) => `$${n.toLocaleString("en-US")}`;

export const UNDER_CARDS =
  "You're charged when CBP accepts the shipment, using the card on file. Drafts and rejected filings cost nothing, and resubmits are never charged twice.";

export const ON_EVERY_PLAN = [
  "The inbox: open work ranked by urgency",
  "Rule checks on every draft, an AI review on any draft, and HTS suggestions with reasoning",
  "CBP rejections in plain English with numbered fix steps",
  "A deadline clock on every ISF, with alerts at 72, 48 and 24 hours",
  "ADD/CVD orders pulled daily; UFLPA and PGA flags",
  "Liquidation and PSC clocks on accepted entries",
  "Four roles, MFA and an audit trail you can export to CSV",
  "Every CBP request and response logged",
] as const;

export const VOLUME = {
  eyebrow: "NVOCCs, forwarders and customs brokers",
  title: "Filing at volume?",
  body: "If you file ISFs or entries for other companies, the importer card above isn't your price. Volume pricing is on request and agreed in writing, under the same rule: you're charged only when CBP accepts.",
  partners:
    "We're taking a small number of NVOCC and forwarder design partners: API onboarding with the founder, and volume pricing agreed in writing.",
  includes: [
    "Written per-shipment volume pricing",
    "Public REST API (JSON or XML) with HMAC-signed status webhooks",
    "ISF-10 and ISF-5 for every house bill, each with its own deadline clock",
    "Team setup by our staff",
  ],
  micro: "Bring your monthly ISF count. We'll send volume terms in writing after the call.",
} as const;

export const GOOD_TO_KNOW = [
  "MyCargoLens is software. We aren't a licensed customs broker, and we don't give classification rulings.",
  "In-bond (7512), FTZ, drawback and AES aren't available today. We don't sell ISF or customs bonds.",
  "If you're shipping your first one or two containers, a broker or a DIY filing service will usually cost you less per filing.",
] as const;

export const TRUST = [
  "ISF-10 · ISF-5 · 7501 · 3461",
  "Every CBP request and response logged",
  "MFA and four roles",
  "Software, not a customs broker",
] as const;

/** FAQ in the deck's page order (Q1, Q2, Q3, Q11, Q6, Q7, Q5, Q4, Q9, Q8, Q10, Q12). */
export const FAQ = [
  {
    q: "How does per-shipment pricing work?",
    a: "You pick a plan, which sets your rate per shipment and the features you get. We keep a card on file and charge that rate once for each shipment CBP accepts. There's no monthly fee on the public plans.",
  },
  {
    q: "What counts as one shipment?",
    a: "One ISF, one entry, or an ISF and its linked entry. A linked ISF and entry on the same shipment is billed once.",
  },
  {
    q: "What am I never charged for?",
    a: "Drafts, manifest (MBOL) queries and filings CBP rejects. Fixing and resubmitting a filing, or amending it later, never charges the shipment a second time.",
  },
  {
    q: "We're an NVOCC filing hundreds of ISFs a month. Is $45 our price?",
    a: "No. The public plans are built for importers. NVOCCs, forwarders and brokers get volume pricing on request, agreed in writing, with the same rule: charged only when CBP accepts.",
  },
  {
    q: "How do I get started?",
    a: "Book a 20-minute demo. If it fits, our team sets up your account, you add a card and pick a plan, and you're charged per shipment from your first accepted filing.",
  },
  {
    q: "Is $180 cheaper than my broker?",
    a: "Often it's about the same as a typical broker fee. What changes is that you see and check every ISF and entry you file, a linked ISF and entry is billed once, and rejected filings are never charged.",
  },
  {
    q: "Is there a monthly fee?",
    a: "There's no monthly fee on the ISF Filing, ISF + Entry or Complete plans.",
  },
  {
    q: "What happens if CBP rejects my filing?",
    a: "You aren't charged. The rejection shows up in your inbox in plain English with numbered steps to fix it, and the corrected resubmit is billed once when CBP accepts.",
  },
  {
    q: "Can I change plans later?",
    a: "Yes. An Owner or Admin on your account can switch plans in billing settings. The new rate applies to shipments billed after the change.",
  },
  {
    q: "Do I need my own filer code and bond?",
    a: "Tell us how you file today when you book, and we'll go through what you need on day one during the demo.",
  },
  {
    q: "What if my card payment fails?",
    a: "The shipment is already filed with CBP. We retry the charge, and new filings pause until the card is updated.",
  },
  {
    q: "Why pay per shipment when an ISF penalty can be $5,000?",
    a: "CBP can claim $5,000 in liquidated damages per ISF violation. The per-shipment price covers the deadline clock, the checks before you submit and the record of what was sent. You stay the importer of record and decide what to file.",
  },
];

/** /pricing.md body (site-architecture §5.5; copy/pricing.md "/pricing.md" block). */
export function pricingMarkdown(): string {
  return [
    "# MyCargoLens pricing",
    "",
    "Per shipment, charged when CBP accepts the shipment. Card on file. No monthly fee on public plans.",
    "",
    ...TIERS.map((t) => `- ${t.name}: ${usd(t.price)} ${PER}. ${t.md}`),
    "",
    "On every plan: HTS suggestions with reasoning, rule checks and an AI review on any draft, and CBP rejections in plain English.",
    "Not charged: drafts, manifest queries and rejected filings. Resubmits and amendments never charge a shipment twice.",
    "Volume and API pricing for NVOCCs, forwarders and customs brokers: on request (book a demo).",
    "MyCargoLens is software, not a licensed customs broker.",
    "",
  ].join("\n");
}
