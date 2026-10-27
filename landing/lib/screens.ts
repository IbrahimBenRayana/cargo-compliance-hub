/**
 * Real product captures in /public/screens (webp, from the wireframes'
 * screens/ folder; local demo data with sample names). Width/height are the
 * file's intrinsic size so <Screenshot> reserves space (no CLS).
 * `route` is what the browser-chrome URL bar shows. Never add a screen that
 * shows the filing provider (submission logs, API settings, entry detail).
 */
export type ScreenMeta = {
  width: number;
  height: number;
  alt: string;
  route: string;
  /**
   * Phone capture, rendered in <DevicePhone>. Must be 440 × 956 CSS px (the
   * Pro Max viewport) at DPR 3, saved as <key>.webp (1320w) plus
   * <key>-2x.webp (880w), with the app's top bar pushed 62 px down so the
   * status bar and Dynamic Island sit over empty header space.
   */
  phone?: boolean;
  /** Something on it must change before launch. */
  note?: string;
};

export const SCREENS = {
  "app-compliance-inbox": { width: 1600, height: 1000, route: "/compliance", alt: "The MyCargoLens inbox: compliance score, daily brief and the ranked action queue." },
  "app-compliance-queue": { width: 1600, height: 824, route: "/compliance", alt: "Action queue item: ISF deadline in 19 hours, vessel departs soon, submit before cutoff." },
  "app-dashboard-pipeline": { width: 1600, height: 1000, route: "/", alt: "Dashboard with shipments grouped by stage, from ISF to cleared." },
  "app-dashboard-stages": { width: 1600, height: 1027, route: "/", alt: "Dashboard stage columns, including shipments ready to file entry." },
  "app-entry-list": { width: 1600, height: 1000, route: "/abi-documents", alt: "List of customs entries with status per entry." },
  "app-flow-1": { width: 560, height: 840, route: "/", alt: "Shipment card: ISF filed." },
  "app-flow-2": { width: 560, height: 840, route: "/", alt: "Shipment card: manifest verified." },
  "app-flow-3": { width: 560, height: 840, route: "/", alt: "Shipment card: entry filed." },
  "app-flow-4": { width: 560, height: 840, route: "/", alt: "Shipment card: cleared." },
  "app-isf-consolidation": { width: 1600, height: 892, route: "/shipments", alt: "ISF consolidation with three house bills under one master bill, each with its own lifecycle." },
  "app-isf-deadline": { width: 1600, height: 676, route: "/shipments", alt: "ISF filing with its deadline countdown." },
  "app-isf-status-history": { width: 1600, height: 331, route: "/shipments", alt: "Status history rows for an ISF filing." },
  "app-isf-timeline": { width: 1600, height: 955, route: "/shipments", alt: "Filing record: lifecycle, timeline and status history, including transmitted to and accepted by CBP." },
  "app-isf-wizard": { width: 1600, height: 1000, route: "/shipments/new", alt: "New ISF wizard, step 1 of 6." },
  "app-liquidation-clocks": {
    width: 1600,
    height: 1000,
    route: "/compliance",
    alt: "Liquidation pipeline with a clock per entry.",
    note: "PSC labels blurred (app still says 270 days). Re-capture once PSC_WINDOW_DAYS ships as 300.",
  },
  "app-m-compliance": {
    width: 1320,
    height: 2868,
    route: "/compliance",
    alt: "The MyCargoLens inbox on an iPhone, with sample data: today's brief, a compliance score of 100, and filings needing attention ranked by urgency, led by an ISF due in 20 hours.",
    phone: true,
  },
  "app-manifest-dispositions": { width: 1600, height: 1216, route: "/manifest-query", alt: "Manifest query results with CBP's disposition for each house bill." },
  "app-risk-watch": { width: 1600, height: 1000, route: "/compliance", alt: "Risk and watch tab: UFLPA inbox, PGA lookup and CBP 5106 check." },
  "app-shipments-list": { width: 1600, height: 1000, route: "/shipments", alt: "Shipments list with drafts, statuses and deadlines." },
  "app-team-roles": { width: 1600, height: 704, route: "/team", alt: "Team page with owner, admin, operator and viewer roles." },
} satisfies Record<string, ScreenMeta>;

export type ScreenKey = keyof typeof SCREENS;
