/**
 * DB-backed HtsRateSource: flat lookups against the ingested USITC table
 * (hts_rate_lines), with a small in-memory cache.
 *
 * Lookup order: exact 10-digit → 8-digit rate line (legitimate 8-digit-only
 * classifications, ESF-89). The applicability date is currently unused —
 * the table holds the single current USITC edition; per-edition history
 * arrives with quarterly re-ingestion (tracked via the revision column).
 */
import type { HtsRate, HtsRateSource } from '../duty/engine.js';

export interface HtsRateLineReader {
  findUnique(args: {
    where: { htsNumber: string };
  }): Promise<{ generalRate: string; specialRate: string } | null>;
}

export class DbHtsRateSource implements HtsRateSource {
  private readonly cache = new Map<string, HtsRate | null>();

  constructor(
    private readonly reader: HtsRateLineReader,
    private readonly maxCacheEntries = 5000
  ) {}

  // The date is unused until per-edition history lands (see doc comment).
  async getRate(htsNumber: string, _date?: string): Promise<HtsRate | null> {
    const key = htsNumber.replace(/\./g, '');
    const cached = this.cache.get(key);
    if (cached !== undefined) return cached;

    let row = await this.reader.findUnique({ where: { htsNumber: key } });
    if (!row && key.length === 10) {
      row = await this.reader.findUnique({ where: { htsNumber: key.slice(0, 8) } });
    }
    const rate: HtsRate | null =
      row && row.generalRate !== ''
        ? { general: row.generalRate, ...(row.specialRate !== '' ? { special: row.specialRate } : {}) }
        : null;

    if (this.cache.size >= this.maxCacheEntries) this.cache.clear();
    this.cache.set(key, rate);
    return rate;
  }
}
