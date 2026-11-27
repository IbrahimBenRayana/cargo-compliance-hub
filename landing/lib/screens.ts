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
  "app-compliance-inbox": { width: 1600, height: 1000, route: "/compliance", alt: "The MyCargoLens inbox: today's brief, the compliance score and filings needing attention, ranked by urgency." },
  "app-compliance-queue": { width: 1600, height: 622, route: "/compliance", alt: "Filings needing attention: an ISF cutoff in 16 hours and one already passed, each with its vessel departure and a prompt to submit before cutoff." },
  "app-dashboard-pipeline": { width: 1600, height: 1000, route: "/", alt: "The Today dashboard: action items, ISF cutoffs, filings awaiting a CBP response and shipments by stage." },
  "app-dashboard-actions": { width: 1600, height: 622, route: "/", alt: "Dashboard action items, including a shipment ready for entry, beside ISF cutoffs and filings awaiting a CBP response." },
  "app-entry-list": { width: 1600, height: 1000, route: "/abi-documents", alt: "List of customs entries with status per entry." },
  "app-flow-1": { width: 560, height: 840, route: "/shipments", alt: "Shipment record: ISF sent to CBP, manifest checked." },
  "app-flow-2": { width: 560, height: 840, route: "/shipments", alt: "Shipment record: ISF accepted, manifest checked, entry not filed yet." },
  "app-flow-3": { width: 560, height: 840, route: "/shipments", alt: "Shipment record: entry sent, waiting for CBP." },
  "app-flow-4": { width: 560, height: 840, route: "/shipments", alt: "Shipment record: entry accepted by CBP." },
  "app-isf-consolidation": { width: 1600, height: 992, route: "/shipments", alt: "ISF consolidation: three house bills under one master bill, each its own ISF, all accepted." },
  "app-isf-deadline": { width: 1600, height: 675, route: "/shipments", alt: "ISF draft with its cutoff countdown." },
  "app-isf-status-history": { width: 640, height: 468, route: "/shipments", alt: "Status history for an ISF filing: created, sent to CBP, accepted." },
  "app-isf-timeline": { width: 1600, height: 1067, route: "/shipments", alt: "Filing record: CBP's acceptance, the linked manifest and entry, and a history including sent to and accepted by CBP." },
  "app-isf-wizard": { width: 1600, height: 1000, route: "/shipments/new", alt: "New ISF wizard, step 1 of 6." },
  "app-liquidation-clocks": { width: 1600, height: 1000, route: "/compliance", alt: "Liquidation pipeline with a clock per entry: PSC deadline 15 days before liquidation at 314." },
  "app-m-compliance": {
    width: 1320,
    height: 2868,
    route: "/compliance",
    alt: "The MyCargoLens inbox on an iPhone, with sample data: today's brief, a compliance score of 100, and filings needing attention ranked by urgency, led by an ISF cutoff in 16 hours.",
    phone: true,
  },
  "app-manifest-dispositions": { width: 1600, height: 1133, route: "/manifest-query", alt: "Manifest query results with CBP's status codes for each house bill." },
  "app-risk-watch": { width: 1600, height: 1000, route: "/compliance", alt: "Risk and watch tab: UFLPA risk inbox, PGA flag lookup and CBP 5106 check." },
  "app-shipments-list": { width: 1600, height: 1000, route: "/shipments", alt: "Shipments list with drafts, statuses and ISF cutoffs." },
  "app-team-roles": { width: 1600, height: 753, route: "/team", alt: "Team page with owner, admin, operator and viewer roles." },
} satisfies Record<string, ScreenMeta>;

export type ScreenKey = keyof typeof SCREENS;
