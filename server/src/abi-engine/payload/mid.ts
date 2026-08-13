/**
 * Manufacturer ID (MID) derivation — CBP Directive 3500-13 (Nov 24, 1986),
 * as republished in the appendix to 19 CFR part 102 ("Rules for
 * Constructing the Manufacturer Identification Code") and referenced by
 * the Add Manufacturer Name & Address chapter (AMF-5/AMF-23).
 *
 * Construction: [country 2] [name 3+3] [street number ≤4] [city 3], max 15.
 *   1. Country — ISO code, EXCEPT: Canadian manufacturers use the
 *      province/territory X-codes instead of 'CA' (AMF-13 Note 1); US
 *      manufacturers always use 'US' (never the 24 state-like ISO codes,
 *      AMF-13 Note 2).
 *   2. Name — first three characters of each of the first two "words".
 *      Articles/conjunctions (A, AN, AND, OF, THE) are ignored; a run of
 *      single-letter initials counts as one word ("A B C Co" → 'ABC');
 *      hyphenated words are one word ("Fritz-Werner" → 'FRITZWERNER' →
 *      'FRI'); punctuation is dropped.
 *   3. Street number — the numeric portion of the address' first number
 *      token, first four digits ("2000 Main St" → '2000'; a P.O. Box
 *      number is used the same way).
 *   4. City — first three ALPHA characters of the city (English spelling;
 *      no Flughafen/Postfach/Cedex/County prefixes — AMF-16 Note 1).
 *
 * ACE is the final authority: the $I Add-Manufacturer application derives
 * the MID server-side and returns it (AMF-18 Note 2) — a locally derived
 * MID that disagrees is corrected there. Derive here, verify via $I once
 * connected.
 */
import { RecordCodecError, type CodecIssue } from '../records/codec.js';

function fail(field: string, message: string): never {
  const issue: CodecIssue = { record: 'MidDerivation', field, message };
  throw new RecordCodecError([issue]);
}

/** Canadian province/territory → MID prefix (AMF-13 Note 1). */
export const CANADIAN_PROVINCE_MID_CODES: Record<string, string> = {
  AB: 'XA', ALBERTA: 'XA',
  NB: 'XB', 'NEW BRUNSWICK': 'XB',
  BC: 'XC', 'BRITISH COLUMBIA': 'XC',
  MB: 'XM', MANITOBA: 'XM',
  NS: 'XN', 'NOVA SCOTIA': 'XN',
  ON: 'XO', ONTARIO: 'XO',
  PE: 'XP', 'PRINCE EDWARD ISLAND': 'XP',
  QC: 'XQ', QUEBEC: 'XQ',
  SK: 'XS', SASKATCHEWAN: 'XS',
  NT: 'XT', 'NORTHWEST TERRITORIES': 'XT',
  NU: 'XV', NUNAVUT: 'XV',
  NL: 'XW', NEWFOUNDLAND: 'XW',
  YT: 'XY', YUKON: 'XY', 'YUKON TERRITORY': 'XY',
};

const IGNORED_WORDS = new Set(['A', 'AN', 'AND', 'OF', 'THE']);

/** Split a firm name into MID "words": initials runs merge, hyphens join. */
function nameWords(name: string): string[] {
  const cleaned = name
    .toUpperCase()
    .replace(/-/g, '') // hyphenated words are treated as a single word
    .replace(/[^A-Z0-9 ]/g, ' ')
    .trim();
  const tokens = cleaned.split(/\s+/).filter((w) => w.length > 0);
  // Ignore articles/conjunctions — but 'A' followed by another single letter
  // is an initial ("A B C Company" \u2192 ABC), not the article.
  const raw = tokens.filter(
    (w, i) => !IGNORED_WORDS.has(w) || (w === 'A' && tokens[i + 1]?.length === 1)
  );
  // Merge a run of single-letter tokens into one word ("A B C Co" → "ABC", "CO").
  const words: string[] = [];
  let inInitialRun = false;
  for (const token of raw) {
    if (token.length === 1 && inInitialRun && words.length > 0) {
      words[words.length - 1] += token;
      continue;
    }
    words.push(token);
    inInitialRun = token.length === 1;
  }
  return words;
}

export interface MidParty {
  name: string;
  /** Street address line ("435 Industrial Rd"). Optional. */
  address?: string;
  city?: string;
  /** ISO country code of the manufacturer's location. */
  countryCode: string;
  /** Canadian province/territory (code or name) — required semantics for CA. */
  stateOrProvince?: string;
}

/** Derive the MID per Directive 3500-13. Throws when the inputs cannot yield one. */
export function deriveMid(party: MidParty): string {
  const country = party.countryCode?.trim().toUpperCase();
  if (!country || country.length !== 2) {
    fail('countryCode', `a 2-char ISO country code is required, got '${party.countryCode ?? ''}'`);
  }
  let prefix = country;
  if (country === 'CA') {
    const key = party.stateOrProvince?.trim().toUpperCase() ?? '';
    const province = CANADIAN_PROVINCE_MID_CODES[key];
    if (!province) {
      fail('stateOrProvince', `Canadian manufacturers use province codes in the MID (AMF-13 Note 1); unknown province '${party.stateOrProvince ?? ''}'`);
    }
    prefix = province;
  }

  const words = nameWords(party.name ?? '');
  if (words.length === 0) {
    fail('name', 'a firm name is required to derive the MID');
  }
  // Two+ words: first 3 chars of each of the first two. Single word: its
  // first 6 chars (matches CBP's own cert-package example, TWNICSAN435TAI
  // for the single-word firm 'NICSAN').
  const namePart =
    words.length === 1 ? words[0].slice(0, 6) : words.slice(0, 2).map((w) => w.slice(0, 3)).join('');

  let numberPart = '';
  if (party.address) {
    const match = party.address.toUpperCase().match(/\d+/);
    if (match) numberPart = match[0].slice(0, 4);
  }

  let cityPart = '';
  if (party.city) {
    cityPart = party.city.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 3);
  }

  const mid = `${prefix}${namePart}${numberPart}${cityPart}`;
  if (mid.length > 15) {
    // By construction 2+6+4+3 = 15; defensive guard.
    return mid.slice(0, 15);
  }
  return mid;
}
