/**
 * UFLPA (Uyghur Forced Labor Prevention Act) risk surface.
 *
 * Two-axis check on a filing:
 *   1. Origin link to Xinjiang Uyghur Autonomous Region (XUAR) — by address
 *      city / state / province strings on the manufacturer or supplier
 *      parties. Strings are normalized (lowercase, trim) before matching.
 *   2. HTS chapter risk — chapters 52 (cotton), 41/42 (leather), 61-63
 *      (apparel), 31 (fertilizers/inputs), 84-85 (specific subset for
 *      polysilicon/solar) are explicitly named in CBP enforcement guidance.
 *
 * Returns a structured risk record per filing so the UI can render it
 * uniformly. We deliberately err on the side of "flag for review" rather
 * than auto-classifying; the importer is the responsible party.
 */

// Xinjiang region city/province aliases (lower-cased). CBP enforcement
// language uses XUAR but importers' shipping docs use any of these forms.
const XINJIANG_TOKENS = [
  'xinjiang', 'xuar', 'uyghur', 'uygur',
  'urumqi', 'ürümqi', 'kashgar', 'kashi', 'aksu', 'hotan', 'hetian',
  'turpan', 'karamay', 'kuytun', 'shihezi', 'changji', 'bortala',
  'ili', 'ghulja', 'tacheng', 'altay',
];

// HTS chapters explicitly named in CBP UFLPA enforcement priorities.
const HIGH_RISK_CHAPTERS = new Set([
  '50', '51', '52', '53', '54', '55',  // textiles & raw materials
  '41', '42', '43',                    // leather/hides/furs
  '61', '62', '63',                    // apparel & finished textiles
  '31',                                 // fertilizers (polysilicon precursors)
]);

// HTS *subheadings* (4-digit) that have specific UFLPA scrutiny even when
// the parent chapter doesn't trigger — e.g. polysilicon (3818.00), solar
// modules (8541.43), tomatoes & tomato products (2002).
const HIGH_RISK_HEADINGS = new Set([
  '3818',           // polysilicon
  '8541',           // photovoltaic cells (subheadings 8541.4x specifically)
  '2002', '0702',   // tomatoes (paste + fresh)
]);

export type UflpaSeverity = 'high' | 'elevated' | 'low';

export interface UflpaRisk {
  severity: UflpaSeverity;
  reasons: string[];
  origin?: { city?: string; state?: string; country?: string };
  htsMatches: string[];
  /** What the importer should do next. */
  recommendation: string;
}

interface PartyLike {
  city?: string | null;
  state?: string | null;
  country?: string | null;
  address1?: string | null;
}

interface CommodityLike {
  htsCode?: string | null;
  countryOfOrigin?: string | null;
}

interface FilingLike {
  manufacturer?: PartyLike | null;
  seller?: PartyLike | null;
  shipToParty?: PartyLike | null;
  buyer?: PartyLike | null;
  consigneeAddress?: PartyLike | null;
  commodities?: CommodityLike[] | null;
}

function normalize(s?: string | null): string {
  return (s ?? '').toLowerCase().trim();
}

function hasXinjiangSignal(party?: PartyLike | null): boolean {
  if (!party) return false;
  const haystack = [party.city, party.state, party.address1].map(normalize).join(' ');
  if (!haystack) return false;
  return XINJIANG_TOKENS.some((t) => haystack.includes(t));
}

function isChinaOrigin(party?: PartyLike | null): boolean {
  return normalize(party?.country) === 'cn';
}

function chapterOf(hts?: string | null): string | null {
  const digits = (hts ?? '').replace(/\D/g, '');
  return digits.length >= 2 ? digits.slice(0, 2) : null;
}
function headingOf(hts?: string | null): string | null {
  const digits = (hts ?? '').replace(/\D/g, '');
  return digits.length >= 4 ? digits.slice(0, 4) : null;
}

export function assessUflpaRisk(filing: FilingLike): UflpaRisk {
  const reasons: string[] = [];
  const partyHits: PartyLike[] = [];

  // Origin: scan every party for Xinjiang signals.
  for (const p of [filing.manufacturer, filing.seller, filing.shipToParty, filing.buyer]) {
    if (hasXinjiangSignal(p)) {
      partyHits.push(p!);
      reasons.push(
        `Party address references Xinjiang region (${p?.city ?? p?.state ?? 'unspecified'})`,
      );
    }
  }

  // HTS scan.
  const htsMatches: string[] = [];
  const chinaOriginCommodities = (filing.commodities ?? []).filter(
    (c) => normalize(c.countryOfOrigin) === 'cn',
  );
  for (const c of chinaOriginCommodities) {
    const ch = chapterOf(c.htsCode);
    const hd = headingOf(c.htsCode);
    if ((ch && HIGH_RISK_CHAPTERS.has(ch)) || (hd && HIGH_RISK_HEADINGS.has(hd))) {
      htsMatches.push(c.htsCode!);
    }
  }
  if (htsMatches.length > 0) {
    reasons.push(
      `${htsMatches.length} commodit${htsMatches.length === 1 ? 'y' : 'ies'} with China origin in UFLPA priority HTS (${htsMatches.join(', ')})`,
    );
  }

  // Compute severity.
  let severity: UflpaSeverity;
  if (partyHits.length > 0 && htsMatches.length > 0)      severity = 'high';
  else if (partyHits.length > 0 || htsMatches.length > 0) severity = 'elevated';
  else                                                     severity = 'low';

  // Even at 'low', flag if the manufacturer is in China + cotton chapter.
  const chinaParty = [filing.manufacturer, filing.seller].some(isChinaOrigin);
  if (severity === 'low' && chinaParty && chinaOriginCommodities.length > 0) {
    severity = 'elevated';
    reasons.push('China-origin commodities — recommended to verify supply chain documentation');
  }

  const recommendation =
    severity === 'high'
      ? 'Compile complete supply chain documentation (mine→finished good) before clearance. CBP may issue a detention order requiring proof of admissibility.'
      : severity === 'elevated'
      ? 'Maintain supply chain documentation showing the goods are not produced with forced labor from XUAR.'
      : 'No specific UFLPA exposure detected from filing data.';

  return {
    severity,
    reasons,
    origin: partyHits[0]
      ? { city: partyHits[0].city ?? undefined, state: partyHits[0].state ?? undefined, country: partyHits[0].country ?? undefined }
      : undefined,
    htsMatches,
    recommendation,
  };
}
