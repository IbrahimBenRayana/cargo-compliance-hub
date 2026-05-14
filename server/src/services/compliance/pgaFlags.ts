/**
 * PGA (Participating Government Agency) flag lookup.
 *
 * Given an HTS code, returns the agencies that require notice / permit /
 * certification at the port of entry — FDA Prior Notice for food, USDA
 * APHIS phytosanitary for plants, EPA TSCA for chemicals, FCC for RF
 * electronics, etc.
 *
 * Data is a curated seed at `data/pga-flags.json` keyed by HTS chapter (2
 * digits). For v1 we match by chapter only — sufficient for the most common
 * import categories. Later we can extend to heading (4 digits) or full HTS
 * (10 digits) if accuracy demands it.
 */

import pgaData from '../../data/pga-flags.json' with { type: 'json' };

export interface PgaFlag {
  agency: string;
  name: string;
  action: string;
}

interface PgaTable {
  _meta: { source: string; lastUpdated: string; note: string };
  chapters: Record<string, PgaFlag[]>;
}

const TABLE = pgaData as PgaTable;

/** Strip non-digits, then return the leading 2-digit chapter. */
function chapterOf(hts: string): string | null {
  const digits = (hts || '').replace(/\D/g, '');
  if (digits.length < 2) return null;
  return digits.slice(0, 2);
}

export function lookupPgaFlags(hts: string): PgaFlag[] {
  const chapter = chapterOf(hts);
  if (!chapter) return [];
  return TABLE.chapters[chapter] ?? [];
}

export function lookupMetadata() {
  return TABLE._meta;
}
