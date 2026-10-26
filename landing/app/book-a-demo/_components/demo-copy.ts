/**
 * Copy for /book-a-demo (copy/book-a-demo.md, verbatim unless noted) and the
 * routing rules (conversion-plan §4.3). Shared by the server page and the
 * client form.
 */

export const PERSONAS = ["importer", "nvocc", "broker", "developer", "other"] as const;
export type DemoPersona = (typeof PERSONAS)[number];

/** Whitelist for `?persona=`. Anything else is ignored. */
export function parsePersona(v: string | string[] | undefined): DemoPersona | undefined {
  const s = Array.isArray(v) ? v[0] : v;
  return PERSONAS.find((p) => p === s);
}

/** URL persona → server enum (PR #186 PERSONAS). */
export const SERVER_PERSONA: Record<DemoPersona, string> = {
  importer: "importer",
  nvocc: "nvocc_forwarder",
  broker: "broker",
  developer: "developer",
  other: "other",
};

/** Deck §2: H1 and sub by persona. */
export const HERO: Record<DemoPersona, { title: string; sub: string }> = {
  importer: {
    title: "See your own filings in the inbox.",
    sub: "20 minutes on shipments like yours: what needs you first, what gets checked before CBP sees it, and what each shipment would cost.",
  },
  nvocc: {
    title: "Talk to us about volume pricing.",
    sub: "30 minutes on your house bills: the deadline clock on every ISF, bulk submit and the API. We put volume terms in writing.",
  },
  broker: {
    title: "Talk to us about a pilot.",
    sub: "Tell us what you file and how. We'll reply with what fits today and what doesn't before we book a time.",
  },
  developer: {
    title: "Book an API walkthrough.",
    sub: "30 minutes with the people who built the API: auth, payloads, JSON or XML, and signed webhooks.",
  },
  other: {
    title: "Tell us what you need.",
    sub: "A founder reads every request and replies by email.",
  },
};

export const PERSONA_OPTIONS: { value: DemoPersona; label: string; hint: string }[] = [
  { value: "importer", label: "Importer of record", hint: "We import goods into the US." },
  { value: "nvocc", label: "NVOCC or freight forwarder", hint: "We file ISF for house bills or for clients." },
  { value: "broker", label: "Licensed customs broker", hint: "We file entries for importers." },
  { value: "developer", label: "Developer or IT", hint: "I'm connecting our systems to a filing tool." },
  { value: "other", label: "Something else", hint: "Partner, consultant or just looking." },
];

export const IMPORTER_VOLUME = ["1-10", "11-50", "51-200", "More than 200"] as const;
export const FILER_VOLUME = ["Under 100", "100-500", "500-2,000", "More than 2,000"] as const;

/** Value is what the lead stores (≤40 chars, server `filesToday`). */
export const FILES_TODAY = [
  { value: "broker_or_forwarder_files", label: "Our broker or forwarder files for us" },
  { value: "self_file_other_tool", label: "We self-file with another tool" },
  { value: "spreadsheets_terminal", label: "Spreadsheets plus a terminal or vendor screen" },
  { value: "tms_or_api", label: "Through our TMS or an API" },
  { value: "not_filing_yet", label: "We're not filing yet" },
] as const;

/** Value ≤20 chars (server `filerBond`). */
export const FILER_BOND = [
  { value: "both", label: "Yes, both" },
  { value: "bond_only", label: "Bond only" },
  { value: "neither", label: "Neither yet" },
  { value: "not_sure", label: "Not sure" },
] as const;

export type Route = "book_demo" | "book_volume" | "book_technical" | "broker_review" | "fit_check" | "review";

/** Conversion plan §4.3, first match wins. */
export function routeFor(persona: DemoPersona, volume: string, filesToday: string): Route {
  if (persona === "nvocc") return "book_volume";
  if (persona === "developer") return "book_technical";
  if (persona === "broker") return "broker_review";
  if (persona === "other") return "review";
  if (volume === "1-10" && filesToday === "not_filing_yet") return "fit_check";
  return "book_demo";
}

export const ROUTES_ALL: Route[] = ["book_demo", "book_volume", "book_technical", "broker_review", "fit_check", "review"];

export function parseRoute(v: string | string[] | undefined): Route | undefined {
  const s = Array.isArray(v) ? v[0] : v;
  return ROUTES_ALL.find((r) => r === s);
}

export const NOTES_MAX = 500;

/** Deck §6. The cost answer is shortened for volume personas. */
export function faqItems(persona: DemoPersona) {
  const volume = persona === "nvocc" || persona === "broker" || persona === "developer";
  return [
    {
      q: "What happens on the call?",
      a: "We ask how you file today, then show the inbox, the checks a draft goes through before CBP, and how billing works on your kind of shipments. You leave knowing what it would cost.",
    },
    {
      q: "Do I need to send documents?",
      a: "No. Have a recent shipment in mind: origin, a rough HTS chapter, how many lines.",
    },
    {
      q: "Are you a customs broker?",
      a: "No. MyCargoLens is software. You, or your broker, stay in charge of classification and advice decisions.",
    },
    {
      q: "What does it cost?",
      a: volume
        ? "NVOCCs, forwarders and brokers filing at volume get volume pricing on request. Same rule: charged only when CBP accepts."
        : "Public plans are $45 for ISF, $180 for ISF + Entry and $280 for Complete, per shipment, charged only when CBP accepts. NVOCCs, forwarders and brokers filing at volume get volume pricing on request.",
    },
  ];
}
