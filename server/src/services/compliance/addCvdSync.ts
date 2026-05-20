/**
 * ADD/CVD seed refresh — Federal Register sync.
 *
 * The "Commerce ACE export" referenced in the original seed comment is not
 * a free public API; it requires authenticated CBP broker access. The
 * Federal Register API, however, is free, well-documented, and publishes
 * every ADD/CVD order document the moment Commerce releases it. We use it
 * to discover candidate orders, parse the title for country + product +
 * type, and persist them as status='pending' for admin review.
 *
 * Heuristic parsing notes:
 *   • Title pattern: "[product] From [country]: [action] …" — split on
 *     " From " then on the colon. ~95% of ITA documents follow this.
 *   • Case # and HTS prefixes are NOT in the title — they live in the
 *     document body, which we don't fetch in v1 (would 10× the cost).
 *     Admins fill those in during review.
 *   • Country names are mapped to ISO-2 via a small built-in dictionary.
 *
 * Output: returns the number of new candidates inserted. Idempotent
 * because we dedupe against existing rows by (lower-case product +
 * country + type).
 */

import { prisma } from '../../config/database.js';
import logger from '../../config/logger.js';

const FR_API = 'https://www.federalregister.gov/api/v1/documents.json';
const ITA_AGENCY = 'international-trade-administration';
const TERM = 'antidumping OR countervailing OR "duty order"';

interface FrDocument {
  document_number: string;
  title: string;
  publication_date: string;
  html_url: string;
}

interface FrResponse {
  count: number;
  results: FrDocument[];
}

export interface SyncResult {
  fetched:     number;
  parsed:      number;
  inserted:    number;
  skipped:     number;
  since:       string;
  errors:      string[];
}

/** Run the sync. Pulls Federal Register documents tagged with the ITA agency
 *  since `since` (defaults to 14 days ago) and inserts new candidates. */
export async function syncFromFederalRegister(opts: { since?: Date } = {}): Promise<SyncResult> {
  const since = opts.since ?? new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
  const sinceStr = since.toISOString().slice(0, 10);

  const result: SyncResult = {
    fetched: 0, parsed: 0, inserted: 0, skipped: 0, since: sinceStr, errors: [],
  };

  const url = `${FR_API}?per_page=100`
    + `&conditions%5Bterm%5D=${encodeURIComponent(TERM)}`
    + `&conditions%5Bagencies%5D%5B%5D=${ITA_AGENCY}`
    + `&conditions%5Bpublication_date%5D%5Bgte%5D=${sinceStr}`
    + `&order=newest`
    + `&fields%5B%5D=document_number&fields%5B%5D=title&fields%5B%5D=publication_date&fields%5B%5D=html_url`;

  let docs: FrDocument[] = [];
  try {
    const res = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!res.ok) {
      result.errors.push(`Federal Register fetch failed: ${res.status}`);
      return result;
    }
    const data = (await res.json()) as FrResponse;
    docs = data.results ?? [];
    result.fetched = docs.length;
  } catch (err) {
    result.errors.push(`Federal Register fetch threw: ${String(err)}`);
    return result;
  }

  // Pre-load existing orders for dedupe. Index by lowercase product+country+type.
  const existing = await prisma.addCvdOrder.findMany({
    select: { product: true, country: true, type: true, status: true },
  });
  const seen = new Set(existing.map(toDedupeKey));

  for (const doc of docs) {
    const parsed = parseTitle(doc.title);
    if (!parsed) continue;
    result.parsed++;

    const key = `${parsed.product.toLowerCase()}|${parsed.country}|${parsed.type}`;
    if (seen.has(key)) {
      result.skipped++;
      continue;
    }

    try {
      await prisma.addCvdOrder.create({
        data: {
          case:        '',                 // admin fills during review (lives in body)
          type:        parsed.type,
          country:     parsed.country,
          product:     parsed.product,
          htsPrefixes: [],                 // admin fills during review
          note:        `Discovered from Federal Register ${doc.document_number} (${doc.publication_date}).`,
          status:      'pending',
          source:      'federal-register',
          sourceUrl:   doc.html_url,
          sourceDate:  new Date(doc.publication_date),
        },
      });
      seen.add(key);
      result.inserted++;
    } catch (err) {
      result.errors.push(`Insert failed for "${doc.title.slice(0, 60)}": ${String(err)}`);
    }
  }

  logger.info({ result }, '[addCvdSync] Federal Register sync complete');
  return result;
}

function toDedupeKey(o: { product: string; country: string; type: string }): string {
  return `${o.product.toLowerCase()}|${o.country}|${o.type}`;
}

// ─── Title parsing ──────────────────────────────────────────────────

/** Heuristic title parser. Returns null when the title doesn't match the
 *  "[product] From [country]: [action]" pattern. */
function parseTitle(title: string): { product: string; country: string; type: 'AD' | 'CVD' | 'ADCVD' } | null {
  // Split on " From " (most ITA titles start with the product, then " From ").
  const fromIdx = title.indexOf(' From ');
  if (fromIdx < 0) return null;

  const product = stripCertain(title.slice(0, fromIdx).trim());
  const after = title.slice(fromIdx + 6);

  // Country name = everything up to the first colon.
  const colonIdx = after.indexOf(':');
  const countryName = (colonIdx >= 0 ? after.slice(0, colonIdx) : after).trim();
  const country = countryNameToIso2(countryName);
  if (!country) return null;

  // Type — infer from anywhere in the title.
  const lower = title.toLowerCase();
  const hasAd  = /antidumping|\bad\b/.test(lower);
  const hasCvd = /countervailing|\bcvd\b/.test(lower);
  const type: 'AD' | 'CVD' | 'ADCVD' =
    hasAd && hasCvd ? 'ADCVD' :
    hasCvd          ? 'CVD'   :
                      'AD';

  // Reject very short or generic products (likely noise).
  if (product.length < 4) return null;

  return { product, country, type };
}

function stripCertain(s: string): string {
  // ITA titles love "Certain XYZ" — drop the leading "Certain " noise.
  return s.replace(/^Certain\s+/i, '');
}

/** ISO-2 mapping for the countries that show up in ITA orders. We don't
 *  need every country code — only the ones with active orders. */
const COUNTRY_MAP: Record<string, string> = {
  "people's republic of china":             'CN',
  'people’s republic of china':        'CN',
  'china':                                  'CN',
  'india':                                  'IN',
  'vietnam':                                'VN',
  'socialist republic of vietnam':          'VN',
  'mexico':                                 'MX',
  'canada':                                 'CA',
  'japan':                                  'JP',
  'south korea':                            'KR',
  'republic of korea':                      'KR',
  'korea':                                  'KR',
  'taiwan':                                 'TW',
  'thailand':                               'TH',
  'indonesia':                              'ID',
  'malaysia':                               'MY',
  'philippines':                            'PH',
  'turkey':                                 'TR',
  'türkiye':                                'TR',
  'turkiye':                                'TR',
  'brazil':                                 'BR',
  'argentina':                              'AR',
  'chile':                                  'CL',
  'germany':                                'DE',
  'france':                                 'FR',
  'italy':                                  'IT',
  'spain':                                  'ES',
  'united kingdom':                         'GB',
  'netherlands':                            'NL',
  'belgium':                                'BE',
  'russia':                                 'RU',
  'russian federation':                     'RU',
  'south africa':                           'ZA',
  'united arab emirates':                   'AE',
  'saudi arabia':                           'SA',
  'oman':                                   'OM',
  'australia':                              'AU',
};

function countryNameToIso2(name: string): string | null {
  const key = name.toLowerCase().trim();
  return COUNTRY_MAP[key] ?? null;
}
