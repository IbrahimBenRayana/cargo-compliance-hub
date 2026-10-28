import type { ModuleKey } from "@/lib/accents";

/**
 * Pricing data for /pricing and /pricing.md.
 * Public card (v2): ISF is $45 per accepted ISF, charged on CBP acceptance
 * (server/src/config/plans.ts perFilingCents 4500). Customs entry has no public
 * price ("talk to us"). Volume pricing is on request. Never publish another number.
 */

export type Plan = {
  id: "isf" | "entry";
  name: string;
  /** USD per accepted ISF. Absent = no public price ("Talk to us"). */
  price?: number;
  /** Line under the price (or under "Talk to us"). */
  unit: string;
  note: string;
  /** Module hue for the card bar. */
  accent: ModuleKey;
  who: string;
  includes: string[];
};

export const ISF_PRICE = 45;
export const PER_ISF = "per accepted ISF";

export const ISF_PLAN: Plan = {
  id: "isf",
  name: "ISF Filing",
  price: ISF_PRICE,
  unit: PER_ISF,
  note: "No monthly fee",
  accent: "isf",
  who: "You file the ISF. Your card is charged only when CBP accepts it.",
  includes: [
    "ISF-10 (10+2) and ISF-5",
    "Deadline clock with alerts at 72, 48 and 24 hours",
    "Templates and bulk submit",
    "Manifest (MBOL) query",
    "Rejections and amendments aren't charged",
  ],
};

export const ENTRY_PLAN: Plan = {
  id: "entry",
  name: "Customs entry",
  unit: "Priced on a call",
  note: "Tell us how many entries you file",
  accent: "entry",
  who: "You also file the entry for your shipments, linked to the ISF.",
  includes: [
    "Entry summary (7501)",
    "Cargo release (3461), prefilled from the accepted ISF",
    "ISF and entry linked on one shipment",
    "Container tracking and the duty calculator: ask us in the demo",
  ],
};

export const PLANS: Plan[] = [ISF_PLAN, ENTRY_PLAN];

export const usd = (n: number) => `$${n.toLocaleString("en-US")}`;

export const UNDER_CARDS =
  "You're charged when CBP accepts the ISF, using the card on file. Drafts, rejected filings and amendments cost nothing.";

export const ENTERPRISE = "Larger team, or a setup that doesn't fit either card?";

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
  body: "If you file ISFs or entries for other companies, the $45 above isn't your price. Volume pricing is on request and agreed in writing, under the same rule: you're charged only when CBP accepts.",
  partners:
    "We're taking a small number of paid NVOCC and forwarder pilots: API onboarding with our team, and volume pricing agreed in writing.",
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

/** Pricing FAQ. */
export const FAQ = [
  {
    q: "How does the ISF price work?",
    a: "We keep a card on file and charge $45 once for each ISF that CBP accepts. There's no monthly fee, and nothing is charged until CBP accepts the filing.",
  },
  {
    q: "What am I never charged for?",
    a: "Drafts, manifest (MBOL) queries and filings CBP rejects. Fixing and resubmitting a filing, or amending it later, isn't charged again.",
  },
  {
    q: "What does customs entry cost?",
    a: "Talk to us. Book a demo, tell us how many entries you file and how you file them today, and we'll go through the price with you on the call.",
  },
  {
    q: "We're an NVOCC filing hundreds of ISFs a month. Is $45 our price?",
    a: "No. The $45 price is built for importers. NVOCCs, forwarders and brokers get volume pricing on request, agreed in writing, with the same rule: charged only when CBP accepts.",
  },
  {
    q: "How do I get started?",
    a: "Book a 20-minute demo. If it fits, our team sets up your account, you add a card, and you're charged from your first accepted ISF.",
  },
  {
    q: "Is there a monthly fee?",
    a: "Not for ISF filing. You pay $45 for each accepted ISF and nothing else.",
  },
  {
    q: "What happens if CBP rejects my filing?",
    a: "You aren't charged. The rejection shows up in your inbox in plain English with numbered steps to fix it, and the corrected resubmit is billed once when CBP accepts.",
  },
  {
    q: "Do I need my own filer code and bond?",
    a: "Tell us how you file today when you book, and we'll go through what you need on day one during the demo.",
  },
  {
    q: "What if my card payment fails?",
    a: "The filing is already with CBP. We retry the charge, and new filings pause until the card is updated.",
  },
  {
    q: "Why pay per ISF when an ISF penalty can be $5,000?",
    a: "CBP can claim $5,000 in liquidated damages per ISF violation. The price covers the deadline clock, the checks before you submit and the record of what was sent. You stay the importer of record and decide what to file.",
  },
];

/** /pricing.md body (site-architecture §5.5), generated from the same data as /pricing. */
export function pricingMarkdown(): string {
  return [
    "# MyCargoLens pricing",
    "",
    `- ISF Filing (ISF-10 or ISF-5): ${usd(ISF_PRICE)} ${PER_ISF}. Card on file, charged only when CBP accepts. No monthly fee. Rejections and amendments aren't charged.`,
    "- Customs entry (entry summary 7501, cargo release 3461, ISF and entry linked): talk to us (book a demo).",
    "- Volume pricing for NVOCCs, forwarders and customs brokers: on request (book a demo).",
    "- Larger teams: contact us.",
    "",
    "On every plan: HTS suggestions with reasoning, rule checks and an AI review on any draft, and CBP rejections in plain English.",
    "Not charged: drafts, manifest queries and rejected filings.",
    "MyCargoLens is software, not a licensed customs broker.",
    "",
  ].join("\n");
}
