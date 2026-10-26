import type { HeroSlug } from "@/components/hero3d/Hero3D";
import { MODULE_ORDER, type ModuleKey } from "@/lib/accents";

/**
 * The route registry for mycargolens.com (rebuild, Oct 2026).
 *
 * One source for the header, mega-menu, mobile menu, footer, breadcrumbs,
 * sitemap and llms.txt. Pages never hard-code nav labels or hrefs: import
 * `ROUTES.<key>` (or `href("<key>")`) instead.
 *
 * Sources: site-architecture.md §2 (routes) and §4 (nav), copy/global.md §1-§5
 * (labels, blurbs, footer) and §7 (CTA labels).
 */

export const SITE_URL = "https://mycargolens.com";
export const APP_LOGIN_URL = "https://app.mycargolens.com/login";

export const COMPANY = {
  /** Brand, as printed on the site. */
  name: "MyCargoLens",
  /** Legal name. Casing/suffix still to confirm. */
  legalName: "Mycargolens",
  brandLine: "An inbox for US customs, not another dashboard.",
  disclosure:
    "MyCargoLens is software for importers, forwarders, NVOCCs and customs brokers. We are not a licensed customs broker and don't give legal or classification advice.",
  /**
   * Not confirmed yet. Leave null: the footer and schema skip null facts
   * instead of rendering placeholder text.
   */
  postalAddress: null as string | null,
  linkedInUrl: null as string | null,
} as const;

export type RouteGroup =
  | "home"
  | "platform"
  | "solutions"
  | "pricing"
  | "resources"
  | "company"
  | "conversion"
  | "legal";

export type SiteRoute = {
  label: string;
  href: string;
  group: RouteGroup;
  /** One-line blurb (mega-menu / dropdown), approved claims only. */
  blurb?: string;
  /** Module accent (platform modules). */
  module?: ModuleKey;
  /** Platform mega-menu column. */
  column?: "file" | "stay-ahead";
  /** Shows in the header menus. */
  nav?: boolean;
  /** Shows in the footer link columns. */
  footer?: boolean;
  /** Label override in the footer (e.g. "Overview" for /platform). */
  footerLabel?: string;
  /** Label used as the breadcrumb leaf (defaults to label). */
  crumb?: string;
  /** Hero 3D scene for the page (keys of HERO_SCENES). */
  scene?: HeroSlug;
  /** P1 pages: listed in nav/footer only once they ship. */
  live: boolean;
  /** Not in the sitemap or llms.txt (thanks page; content-owned article routes). */
  noindex?: boolean;
};

const r = <T extends Record<string, SiteRoute>>(routes: T) => routes;

export const ROUTES = r({
  home: { label: "Home", href: "/", group: "home", scene: "home", live: true },

  // ---- Platform -------------------------------------------------------
  platform: {
    label: "Platform overview",
    crumb: "Platform",
    footerLabel: "Overview",
    href: "/platform",
    group: "platform",
    blurb: "How ISF, entry and the inbox fit together.",
    scene: "platform",
    footer: true,
    nav: true,
    live: true,
  },
  isfFiling: {
    label: "ISF filing",
    href: "/platform/isf-filing",
    group: "platform",
    column: "file",
    module: "isf",
    blurb: "ISF-10 and ISF-5, each with a deadline clock and alerts at 72, 48 and 24 hours.",
    scene: "isf-filing",
    nav: true,
    footer: true,
    live: true,
  },
  customsEntry: {
    label: "Customs entry",
    href: "/platform/customs-entry",
    group: "platform",
    column: "file",
    module: "entry",
    blurb: "Entry summary (7501) and cargo release (3461), prefilled from the accepted ISF.",
    scene: "customs-entry",
    nav: true,
    footer: true,
    live: true,
  },
  api: {
    label: "API and webhooks",
    href: "/platform/api",
    group: "platform",
    column: "file",
    module: "api",
    blurb: "File from your own system. REST or XML in, signed webhooks out.",
    scene: "api",
    nav: true,
    footer: true,
    live: true,
  },
  inbox: {
    label: "The inbox",
    href: "/platform/inbox",
    group: "platform",
    column: "stay-ahead",
    module: "inbox",
    blurb: "Open work across ISF, entry and liquidation, ranked by what needs you first.",
    scene: "inbox",
    nav: true,
    footer: true,
    live: true,
  },
  preFilingChecks: {
    label: "Pre-filing checks",
    href: "/platform/pre-filing-checks",
    group: "platform",
    column: "stay-ahead",
    module: "checks",
    blurb: "Rule checks on every draft. CBP rejections explained in plain English.",
    scene: "pre-filing-checks",
    nav: true,
    footer: true,
    live: true,
  },
  compliance: {
    label: "Compliance",
    href: "/platform/compliance",
    group: "platform",
    column: "stay-ahead",
    module: "compliance",
    blurb: "Liquidation and PSC clocks, daily ADD/CVD updates, UFLPA and PGA flags.",
    scene: "compliance",
    nav: true,
    footer: true,
    live: true,
  },

  // ---- Solutions ------------------------------------------------------
  solutions: {
    label: "Solutions",
    href: "/solutions",
    group: "solutions",
    scene: "solutions",
    live: true,
  },
  nvoccForwarders: {
    label: "NVOCCs and forwarders",
    href: "/solutions/nvocc-forwarders",
    group: "solutions",
    blurb: "Every house bill on a deadline clock. Volume and API pricing on request.",
    scene: "nvocc-forwarders",
    nav: true,
    footer: true,
    live: true,
  },
  importers: {
    label: "Importers",
    href: "/solutions/importers",
    group: "solutions",
    blurb: "Check every ISF and entry you file before CBP does.",
    scene: "importers",
    nav: true,
    footer: true,
    live: true,
  },
  compare: {
    label: "How we compare",
    href: "/compare",
    group: "solutions",
    blurb: "Your broker, spreadsheets or a legacy vendor: when each fits better.",
    scene: "compare",
    nav: true,
    footer: true,
    live: true,
  },

  // ---- Pricing ----------------------------------------------------------
  pricing: {
    label: "Pricing",
    href: "/pricing",
    group: "pricing",
    scene: "pricing",
    nav: true,
    footer: true,
    live: true,
  },

  // ---- Resources --------------------------------------------------------
  resources: {
    label: "Guides and articles",
    crumb: "Resources",
    href: "/resources",
    group: "resources",
    blurb: "ISF deadlines, penalties, entries and tariffs, with sources.",
    scene: "resources",
    nav: true,
    footer: true,
    live: true,
  },
  isfLateFilingPenalties: {
    label: "ISF late filing penalties",
    href: "/resources/isf-late-filing-penalties",
    group: "resources",
    scene: "resources",
    live: true,
    // Articles are indexable only once their content is
    // published: app/resources/_content owns that status, and sitemap.ts /
    // llms.txt list them from there. Keep them out of INDEXABLE_ROUTES.
    noindex: true,
  },
  isfDeadlineCalculator: {
    label: "ISF deadline calculator",
    href: "/tools/isf-deadline-calculator",
    group: "resources",
    blurb: "Enter a lading date, get the ISF deadline.",
    nav: true,
    footer: true,
    live: false, // P1
  },
  glossary: {
    label: "Glossary",
    href: "/resources/glossary",
    group: "resources",
    blurb: "ISF, IOR, PSC, LD and the rest, in plain English.",
    nav: true,
    footer: true,
    live: false, // P1
  },
  changelog: {
    label: "Changelog",
    href: "/changelog",
    group: "resources",
    blurb: "What shipped, and when.",
    nav: true,
    footer: true,
    live: true,
  },

  // ---- Company ----------------------------------------------------------
  about: {
    label: "About",
    href: "/about",
    group: "company",
    blurb: "Who builds MyCargoLens, and what it isn't.",
    scene: "about",
    nav: true,
    footer: true,
    live: true,
  },
  security: {
    label: "Security",
    href: "/security",
    group: "company",
    blurb: "Roles, MFA, the audit trail and every CBP request on the record.",
    scene: "security",
    nav: true,
    footer: true,
    live: true,
  },
  contact: {
    label: "Contact",
    href: "/contact",
    group: "company",
    blurb: "Support, partnerships and press.",
    scene: "contact",
    nav: true,
    footer: true,
    live: true,
  },

  // ---- Conversion -------------------------------------------------------
  bookADemo: {
    label: "Book a demo",
    href: "/book-a-demo",
    group: "conversion",
    scene: "book-a-demo",
    live: true,
  },
  bookADemoThanks: {
    label: "Thanks",
    href: "/book-a-demo/thanks",
    group: "conversion",
    scene: "book-a-demo-thanks",
    noindex: true,
    live: true,
  },

  // ---- Legal --------------------------------------------------------------
  privacy: { label: "Privacy", href: "/legal/privacy", group: "legal", live: true },
  terms: { label: "Terms", href: "/legal/terms", group: "legal", live: true },
});

export type RouteKey = keyof typeof ROUTES;

export function href(key: RouteKey): string {
  return ROUTES[key].href;
}

const all = Object.values(ROUTES) as SiteRoute[];

/** Live routes only, in registry order. */
export function routesIn(group: RouteGroup, where: "nav" | "footer"): SiteRoute[] {
  return all.filter((x) => x.group === group && x.live && x[where]);
}

export function findRoute(path: string): SiteRoute | undefined {
  return all.find((x) => x.href === path);
}

/** Every indexable, live route (sitemap.ts). Articles come from app/resources/_content. */
export const INDEXABLE_ROUTES: SiteRoute[] = all.filter((x) => x.live && !x.noindex);

// ---------------------------------------------------------------------------
// Header + footer structure (site-architecture §4.1 / §4.4, global.md §1-§5)
// ---------------------------------------------------------------------------

export type MenuKey = "platform" | "solutions" | "resources" | "company";

export const HEADER_MENUS: { key: MenuKey; label: string }[] = [
  { key: "platform", label: "Platform" },
  { key: "solutions", label: "Solutions" },
  { key: "resources", label: "Resources" },
  { key: "company", label: "Company" },
];

/** Header order: Platform, Solutions, Pricing (plain link), Resources, Company. */
export const HEADER_ORDER: (MenuKey | "pricing")[] = [
  "platform",
  "solutions",
  "pricing",
  "resources",
  "company",
];

export const PLATFORM_COLUMNS = [
  { key: "file" as const, heading: "File" },
  { key: "stay-ahead" as const, heading: "Stay ahead" },
];

export function platformColumn(column: "file" | "stay-ahead"): SiteRoute[] {
  return all.filter((x) => x.group === "platform" && x.column === column && x.live);
}

/** Mega-menu rail: the certification badge (global.md §2, claim A21). */
export const CERT_BADGE = {
  label: "CBP ABI certified",
  line: "Our native ABI engine is certified by CBP.",
  href: "/security",
} as const;

/** Solutions dropdown footer line (bible P4). */
export const BROKER_PILOT_LINE = {
  label: "Licensed customs broker? Ask about a pilot.",
  href: "/book-a-demo?persona=broker&src=nav",
} as const;

export function menuItems(key: MenuKey): SiteRoute[] {
  switch (key) {
    case "platform":
      return all.filter((x) => x.group === "platform" && x.live && x.nav);
    case "solutions":
      return routesIn("solutions", "nav");
    case "resources":
      return routesIn("resources", "nav");
    case "company":
      return routesIn("company", "nav");
  }
}

export type FooterLink = { label: string; href: string; module?: ModuleKey; external?: boolean };

/** Footer link columns (site-architecture §4.4). */
export function footerColumns(): { heading: string; links: FooterLink[] }[] {
  const toLink = (x: SiteRoute): FooterLink => ({
    label: x.footerLabel ?? x.label,
    href: x.href,
    module: x.module,
  });
  return [
    {
      heading: "Platform",
      // footer order (site-architecture §4.4): overview, then modules in product order
      links: routesIn("platform", "footer")
        .sort((a, b) => (a.module ? MODULE_ORDER.indexOf(a.module) : -1) - (b.module ? MODULE_ORDER.indexOf(b.module) : -1))
        .map(toLink),
    },
    {
      heading: "Solutions",
      links: [...routesIn("solutions", "footer"), ROUTES.pricing].map(toLink),
    },
    { heading: "Resources", links: routesIn("resources", "footer").map(toLink) },
    {
      heading: "Company",
      links: [
        ...routesIn("company", "footer").map(toLink),
        { label: CTA.bookDemo.label, href: ctaHref({ src: "footer" }) },
        { label: "Log in", href: APP_LOGIN_URL, external: true },
      ],
    },
  ];
}

// ---------------------------------------------------------------------------
// CTA label registry (global.md §7, conversion-plan §3 + §7.2)
// ---------------------------------------------------------------------------

export type Persona = "importer" | "nvocc" | "broker" | "developer";

/** `data-cta-id` values (conversion plan §7). */
export type CtaId = "book_demo" | "see_pricing" | "watch_tour" | "isf_tool" | "api_overview" | "kit";
/** `data-location` values (conversion plan §7). */
export type CtaLocation = "nav" | "hero" | "section" | "close" | "sticky_mobile" | "inline" | "footer";

export const CTA = {
  /** The primary CTA everywhere. Gold, one per viewport. */
  bookDemo: { id: "book_demo", label: "Book a demo" },
  /** Contextual primaries: same destination (/book-a-demo), gold. */
  bookDemo20: { id: "book_demo", label: "Book a 20-minute demo" },
  volumePricing: { id: "book_demo", label: "Talk to us about volume pricing" },
  pilot: { id: "book_demo", label: "Talk to us about a pilot" },
  apiWalkthrough: { id: "book_demo", label: "Book an API walkthrough" },
  /** Secondaries: outline or text link. */
  seePricing: { id: "see_pricing", label: "See pricing", href: "/pricing" },
  apiOverview: { id: "api_overview", label: "Read the API overview", href: "/platform/api" },
  /** P1, when live. */
  isfTool: { id: "isf_tool", label: "Check an ISF deadline", href: "/tools/isf-deadline-calculator" },
  /** Post-launch only: no /tour route at launch. */
  tour: { id: "watch_tour", label: "Watch the 3-minute tour" },
  login: { label: "Log in", href: APP_LOGIN_URL },
} as const satisfies Record<string, { label: string; id?: CtaId; href?: string }>;

export type CtaKey = keyof typeof CTA;
/** CTA keys that go to /book-a-demo (gold). */
export type DemoCtaKey = Extract<CtaKey, "bookDemo" | "bookDemo20" | "volumePricing" | "pilot" | "apiWalkthrough">;

/** Shared UI strings (global.md §7). */
export const UI_STRINGS = {
  breadcrumbRoot: "Home",
  backToSite: "Back to site",
  externalHint: "(opens in a new tab)",
  demoMicrocopy: "20 minutes, on shipments like yours.",
  skipLink: "Skip to main content",
} as const;

/** `/book-a-demo?persona=…&src=…` */
export function ctaHref({ persona, src }: { persona?: Persona; src?: string } = {}): string {
  const q = new URLSearchParams();
  if (persona) q.set("persona", persona);
  if (src) q.set("src", src);
  const qs = q.toString();
  return qs ? `${ROUTES.bookADemo.href}?${qs}` : ROUTES.bookADemo.href;
}

// ---------------------------------------------------------------------------
// Pre-footer CTA band variants (global.md §4)
// ---------------------------------------------------------------------------

export type CtaBandVariant = "default" | "importer" | "nvocc" | "developer" | "security" | "company";

export type CtaBandCopy = {
  title: string;
  sub: string;
  cta: DemoCtaKey;
  persona?: Persona;
  /** Text link (only "See pricing", product and solution pages). */
  pricingLink: boolean;
  /** Under-button microcopy (one, never more). */
  micro?: string;
};

const MICRO_PRICE = "Pay per shipment, only when CBP accepts. No monthly fee on the public plans.";

export const CTA_BANDS: Record<CtaBandVariant, CtaBandCopy> = {
  default: {
    title: "See your own filings in the inbox.",
    sub: "Book a 20-minute demo. We'll walk through how you file today, show you the parts that matter and tell you what it costs. We set your team up after.",
    cta: "bookDemo",
    pricingLink: true,
    micro: MICRO_PRICE,
  },
  importer: {
    title: "Bring your last rejection.",
    sub: "We'll walk through it, and show what your shipments would cost per filing, charged only when CBP accepts.",
    cta: "bookDemo",
    persona: "importer",
    pricingLink: true,
    micro: MICRO_PRICE,
  },
  nvocc: {
    title: "Bring a week of house bills.",
    sub: "We'll show the deadline clock on each one, bulk submit and the API, and put volume terms in writing.",
    cta: "bookDemo",
    persona: "nvocc",
    pricingLink: false,
    micro: "Volume and API pricing, written down.",
  },
  developer: {
    title: "See the API with the people who built it.",
    sub: "REST or XML, scoped keys and HMAC-signed webhooks. 30 minutes.",
    cta: "apiWalkthrough",
    persona: "developer",
    pricingLink: false,
  },
  security: {
    title: "Have a security review to run? Start with a demo.",
    sub: "We'll show you roles, MFA and the CBP submission log in the product.",
    cta: "bookDemo",
    pricingLink: false,
  },
  company: {
    title: "Meet us on a 20-minute demo.",
    sub: "We'll look at how you file today and show you what's new on shipments like yours.",
    cta: "bookDemo",
    pricingLink: false,
  },
};

/** Routes that never show the pre-footer band (global.md §4). */
export const NO_BAND_PREFIXES = ["/book-a-demo", "/legal"];
