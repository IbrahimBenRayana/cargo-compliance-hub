/**
 * PGA (Participating Government Agency) flag lookup.
 *
 * Given an HTS code, returns the agencies that require notice / permit /
 * certification at the port of entry — FDA Prior Notice for food, USDA
 * APHIS phytosanitary for plants, EPA TSCA for chemicals, FCC for RF
 * electronics, etc.
 *
 * Data is a curated seed at `data/pga-flags.json` keyed by HTS prefix: a
 * 2-digit chapter, or a 4-digit heading where the chapter is too coarse
 * (chapter 87 covers both cars and brake calipers). Longest prefix wins.
 * These are hints to check, not the CBP PGA indicator file.
 */

import pgaData from '../../data/pga-flags.json' with { type: 'json' };

export interface PgaFlag {
  agency: string;
  name: string;
  action: string;
}

interface PgaTable {
  _meta: { source: string; lastUpdated: string; note: string };
  prefixes: Record<string, PgaFlag[]>;
}

const TABLE = pgaData as PgaTable;

/** Strip non-digits, then try the 4-digit heading before the 2-digit chapter. */
export function lookupPgaFlags(hts: string): PgaFlag[] {
  const digits = (hts || '').replace(/\D/g, '');
  if (digits.length < 2) return [];
  return TABLE.prefixes[digits.slice(0, 4)] ?? TABLE.prefixes[digits.slice(0, 2)] ?? [];
}

export function lookupMetadata() {
  return TABLE._meta;
}
