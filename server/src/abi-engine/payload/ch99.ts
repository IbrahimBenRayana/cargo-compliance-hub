/**
 * Chapter 99 overlay numbers on an entry line (audit MHT-03/04).
 *
 * Wire shape CERT accepted: 8 digits, value 0, and no unit or quantity
 * (any UOM on a zero-reporting-unit tariff draws F441/F442). Value and
 * quantity ride on the ch.1-97 classification, which is reported last.
 *
 * Order: CSMS #69668138 (27 Aug 2026) lists ch.98, ch.99 additional
 * duties, 301, 338, 232, 201, replacement/MTB, other quota, then the
 * ch.1-97 number; out of order draws F852 HTS OUT OF SEQUENCE. The ranks
 * below follow that list, checked against every stack CERT accepted:
 * 9903.41 before 9903.05 (024), 9903.88/.91 before 9903.05 (013, 028,
 * the battery key 9903.91.06 / .05.31 / .94.06), 9903.05.90 before the
 * 9903.82 bucket (023, 059). Unlisted headings keep their input order
 * within their rank.
 */
const RANKS: Array<[prefix: string, rank: number]> = [
  ['9903.41', 1], // proclamation additional duties (footwear in lieu)
  ['9903.88', 2], // Section 301 China lists
  ['9903.91', 2], // Section 301 China four-year review
  ['9903.01', 3], // IEEPA-era headings (historical entries)
  ['9903.05', 4], // Section 301 forced labor / NT52 economies
  ['9903.80', 5], // Section 232 steel (expired family)
  ['9903.81', 5],
  ['9903.82', 5], // Section 232 consolidated content buckets
  ['9903.85', 5], // Section 232 aluminum (expired family)
  ['9903.94', 5], // Section 232 autos and parts
  ['9903.45', 6], // Section 201 safeguards
  ['9902', 7], // temporary duty suspensions (replace column 1)
];

export const CH99_PATTERN = /^99\d{6}$/;

/** Program rank of a ch.99 number; unlisted 9903 headings sort with the
 *  additional duties at the top, other ch.99 numbers just before the base. */
export function ch99Rank(htsNumber: string): number {
  const dotted = `${htsNumber.slice(0, 4)}.${htsNumber.slice(4, 6)}`;
  for (const [prefix, rank] of RANKS) {
    if (prefix.includes('.') ? dotted === prefix : htsNumber.startsWith(prefix)) return rank;
  }
  return htsNumber.startsWith('9903') ? 1 : 8;
}

/** Normalise user input: dots and spaces out; a padded '9903880100' keeps
 *  its 8 digits only when the padding is '00'. Anything else is returned
 *  as-is for the schema to reject. */
export function normaliseCh99(raw: string): string {
  const digits = raw.replace(/[.\s]/g, '');
  return /^99\d{6}00$/.test(digits) ? digits.slice(0, 8) : digits;
}

/** Deduplicated, CBP-ordered overlay numbers. */
export function orderCh99(numbers: string[]): string[] {
  const unique = [...new Set(numbers.map(normaliseCh99).filter((n) => n.length > 0))];
  return unique
    .map((n, i) => ({ n, i, rank: ch99Rank(n) }))
    .sort((a, b) => a.rank - b.rank || a.i - b.i)
    .map(({ n }) => n);
}

/**
 * Search filter for the ch.99 picker (audit MHT-07): a code query is a
 * prefix inside chapter 99 (null when it points outside it); a text query
 * needs every word in the description.
 */
export function ch99SearchWhere(raw: string):
  | { htsNumber: { startsWith: string } }
  | { AND: Array<{ htsNumber: { startsWith: string } } | { description: { contains: string; mode: 'insensitive' } }> }
  | null {
  const q = raw.trim().slice(0, 80);
  if (q.length < 2) return null;
  if (/^[\d.\s]+$/.test(q)) {
    const digits = q.replace(/\D/g, '');
    return digits.startsWith('99') ? { htsNumber: { startsWith: digits } } : null;
  }
  const words = q.split(/\s+/).filter((w) => w.length >= 2);
  return {
    AND: [
      { htsNumber: { startsWith: '99' } },
      ...words.map((w) => ({ description: { contains: w, mode: 'insensitive' as const } })),
    ],
  };
}

/**
 * Order picker results: 9903 trade-remedy headings (301, 232, IEEPA...) first,
 * then 9902 temporary reductions and the rest, by number within each group,
 * keeping the first `limit`. A word like "steel" otherwise listed only 9902
 * lines, which sort first by number.
 */
export function rankCh99Results<T extends { htsNumber: string }>(rows: T[], limit: number): T[] {
  const group = (n: string) => (n.startsWith('9903') ? 0 : 1);
  return [...rows]
    .sort((a, b) => group(a.htsNumber) - group(b.htsNumber) || a.htsNumber.localeCompare(b.htsNumber))
    .slice(0, limit);
}
