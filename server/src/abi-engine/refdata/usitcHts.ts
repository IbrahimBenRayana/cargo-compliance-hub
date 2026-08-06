/**
 * USITC HTS ingestion (refdata, workstream F).
 *
 * hts.usitc.gov publishes the tariff schedule as JSON via
 * /reststop/exportList?from=NNNN&to=NNNN. Rates live on "rate lines"
 * (usually 8-digit, sometimes full 10-digit); statistical 10-digit
 * children carry the reporting units and inherit the rate from the
 * nearest ancestor rate line via the row order + indent column.
 *
 * Normalization resolves that inheritance at ingest time so the runtime
 * rate source is a flat primary-key lookup.
 */

export interface UsitcRow {
  htsno: string;
  indent: string;
  description: string;
  units: string[];
  general: string;
  special: string;
  other: string;
}

export interface NormalizedHtsLine {
  /** 8- or 10-digit HTS number, dots stripped. */
  htsNumber: string;
  description: string;
  indent: number;
  /** True when the row carried its own General rate. */
  isRateLine: boolean;
  /** Resolved General rate (own or nearest ancestor rate line's). */
  generalRate: string;
  specialRate: string;
  otherRate: string;
  units: string[];
}

const USITC_BASE = 'https://hts.usitc.gov/reststop/exportList';

/** Fetch raw USITC rows for a heading range (inclusive, e.g. '8507','8508'). */
export async function fetchUsitcRows(from: string, to: string): Promise<UsitcRow[]> {
  const url = `${USITC_BASE}?from=${from}&to=${to}&format=JSON&styles=false`;
  const res = await fetch(url, { headers: { accept: 'application/json' } });
  if (!res.ok) {
    throw new Error(`USITC export failed for ${from}-${to}: HTTP ${res.status}`);
  }
  return (await res.json()) as UsitcRow[];
}

/**
 * Resolve rate inheritance and flatten to 8/10-digit lines.
 * Walks the document-ordered rows keeping a stack of the rate lines
 * currently in scope, keyed by indent depth.
 */
export function normalizeUsitcRows(rows: UsitcRow[]): NormalizedHtsLine[] {
  const out: NormalizedHtsLine[] = [];
  // Stack of ancestors that carried rates: shallower indents first.
  const rateStack: { indent: number; general: string; special: string; other: string }[] = [];

  for (const row of rows) {
    const indent = Number(row.indent);
    // Leaving a subtree: drop rate lines at this depth or deeper.
    while (rateStack.length > 0 && rateStack[rateStack.length - 1].indent >= indent) {
      rateStack.pop();
    }

    const own = (row.general ?? '').trim();
    const isRateLine = own !== '';
    if (isRateLine) {
      rateStack.push({ indent, general: own, special: row.special ?? '', other: row.other ?? '' });
    }

    const digits = (row.htsno ?? '').replace(/\./g, '');
    if (digits.length !== 8 && digits.length !== 10) continue; // headings/groupers

    const effective = isRateLine ? rateStack[rateStack.length - 1] : rateStack[rateStack.length - 1];
    out.push({
      htsNumber: digits,
      description: row.description ?? '',
      indent,
      isRateLine,
      generalRate: effective?.general ?? '',
      specialRate: effective?.special ?? '',
      otherRate: effective?.other ?? '',
      units: row.units ?? [],
    });
  }

  return out;
}

/** Minimal persistence delegate — the slice of PrismaClient the ingest needs. */
export interface HtsRateLineStore {
  deleteMany(args: { where: { htsNumber: { startsWith: string } } }): Promise<unknown>;
  createMany(args: {
    data: (NormalizedHtsLine & { revision: string })[];
    skipDuplicates: boolean;
  }): Promise<unknown>;
}

/**
 * Ingest one 2-digit chapter: fetch, normalize, replace.
 * Returns the number of lines written.
 */
export async function ingestChapter(store: HtsRateLineStore, chapter: string, revision: string): Promise<number> {
  if (!/^\d{2}$/.test(chapter)) throw new Error(`expected 2-digit chapter, got '${chapter}'`);
  const rows = await fetchUsitcRows(`${chapter}01`, `${chapter}99`);
  const lines = normalizeUsitcRows(rows).filter((l) => l.htsNumber.startsWith(chapter));
  await store.deleteMany({ where: { htsNumber: { startsWith: chapter } } });
  if (lines.length > 0) {
    await store.createMany({ data: lines.map((l) => ({ ...l, revision })), skipDuplicates: true });
  }
  return lines.length;
}
