/**
 * Candidate retrieval for the native HTS classifier (spec step 3).
 *
 * The whole schedule (~20k 10-digit lines) is small enough to search in
 * memory: an inverted index over each line's full path text, scored by word
 * rarity, with a spread across headings so the right heading stays in the
 * pool even when another heading shares more words with the query.
 * Everything returned is a real schedule line; the AI only ranks these.
 */

export interface ScheduleLine {
  /** 10-digit HTS number, digits only. */
  code: string;
  /** The line's own description (often just "Other"). */
  description: string;
  /** Heading > subheading > ... > this line (hts_rate_lines.path_text). */
  pathText: string;
  generalRate: string;
  units: string[];
}

export interface Candidate extends ScheduleLine {
  score: number;
}

export interface ScheduleIndex {
  lines: ScheduleLine[];
  /** token -> indexes of lines whose path contains it */
  postings: Map<string, number[]>;
  /** per line: its path tokens and its own-description tokens */
  pathTokens: Set<string>[];
  ownTokens: Set<string>[];
  /** per line: normalised path text for phrase matching */
  pathNorm: string[];
}

// Words that say nothing about what the goods are.
const STOPWORDS = new Set([
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'by', 'for', 'from', 'in', 'into', 'is', 'it', 'its',
  'of', 'on', 'or', 'other', 'than', 'that', 'the', 'their', 'thereof', 'therefor', 'this', 'to',
  'with', 'whether', 'not', 'kind', 'used', 'including', 'which', 'such', 'similar', 'type',
]);

/** Fold simple English plurals so "batteries" matches "battery". */
function singular(w: string): string {
  if (w.length > 4 && w.endsWith('ies')) return `${w.slice(0, -3)}y`;
  if (/(sses|ches|shes|xes|zes)$/.test(w)) return w.slice(0, -2);
  if (w.length > 3 && w.endsWith('s') && !/(ss|us|is)$/.test(w)) return w.slice(0, -1);
  return w;
}

/**
 * Lowercased, filler-free, plural-folded words. A hyphenated word also
 * yields its joined form ("t-shirt" -> "tshirt"), which is far more telling
 * than its parts.
 */
export function tokenize(text: string): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  const add = (w: string) => {
    const t = singular(w);
    if (t.length < 2 || STOPWORDS.has(t) || seen.has(t)) return;
    seen.add(t);
    out.push(t);
  };
  for (const raw of text.toLowerCase().split(/[^a-z0-9-]+/)) {
    if (!raw) continue;
    const parts = raw.split('-').filter(Boolean);
    for (const p of parts) add(p);
    if (parts.length > 1) add(parts.join(''));
  }
  return out;
}

const normalise = (s: string) => ` ${s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()} `;

export function buildIndex(lines: ScheduleLine[]): ScheduleIndex {
  const postings = new Map<string, number[]>();
  const pathTokens: Set<string>[] = [];
  const ownTokens: Set<string>[] = [];
  const pathNorm: string[] = [];
  lines.forEach((l, i) => {
    const toks = new Set(tokenize(l.pathText || l.description));
    pathTokens.push(toks);
    ownTokens.push(new Set(tokenize(l.description)));
    pathNorm.push(normalise(l.pathText || l.description));
    for (const t of toks) {
      const list = postings.get(t);
      if (list) list.push(i);
      else postings.set(t, [i]);
    }
  });
  return { lines, postings, pathTokens, ownTokens, pathNorm };
}

const HEADINGS_KEPT = 15;
const LINES_PER_HEADING = 4;

/**
 * Best matching schedule lines for the given search terms (the product
 * description plus the AI's tariff-vocabulary expansions).
 */
export function retrieveCandidates(
  index: ScheduleIndex, terms: string[], limit = 60, likelyHeadings: string[] = [],
): Candidate[] {
  const n = index.lines.length || 1;
  const queryTokens = [...new Set(terms.flatMap(tokenize))];
  const phrases = terms.map(normalise).filter((p) => p.trim().includes(' '));

  const scores = new Map<number, number>();
  for (const t of queryTokens) {
    const hits = index.postings.get(t);
    if (!hits) continue;
    const idf = Math.log(1 + n / hits.length);
    for (const i of hits) {
      const own = index.ownTokens[i].has(t) ? 0.5 * idf : 0;
      scores.set(i, (scores.get(i) ?? 0) + idf + own);
    }
  }
  for (const [i, s] of scores) {
    let bonus = 0;
    for (const p of phrases) if (index.pathNorm[i].includes(p)) bonus += 2;
    if (bonus) scores.set(i, s + bonus);
  }
  // Headings the AI judged likely join the pool even when the wording
  // differs (a few of their lines, best-scoring first).
  for (const h of likelyHeadings) {
    const inHeading = index.lines
      .map((l, i) => [l, i] as const)
      .filter(([l]) => l.code.startsWith(h))
      .sort((a, b) => (scores.get(b[1]) ?? 0) - (scores.get(a[1]) ?? 0))
      .slice(0, LINES_PER_HEADING * 2);
    for (const [, i] of inHeading) if (!scores.has(i)) scores.set(i, 0);
  }
  if (scores.size === 0) return [];

  const ranked = [...scores.entries()].sort((a, b) => b[1] - a[1] || index.lines[a[0]].code.localeCompare(index.lines[b[0]].code));

  // Spread: the best few lines of each of the best headings first...
  const byHeading = new Map<string, number[]>();
  for (const h of likelyHeadings) byHeading.set(h, []);
  for (const [i] of ranked) {
    const h = index.lines[i].code.slice(0, 4);
    const list = byHeading.get(h);
    if (!list) {
      if (byHeading.size < HEADINGS_KEPT + likelyHeadings.length) byHeading.set(h, [i]);
    } else if (list.length < LINES_PER_HEADING * (likelyHeadings.includes(h) ? 2 : 1)) list.push(i);
  }
  const picked = new Set([...byHeading.values()].flat());
  // ...then the rest by score, up to the limit.
  for (const [i] of ranked) {
    if (picked.size >= limit) break;
    picked.add(i);
  }

  return [...picked]
    .map((i) => ({ ...index.lines[i], score: Math.round((scores.get(i) ?? 0) * 100) / 100 }))
    .sort((a, b) => b.score - a.score || a.code.localeCompare(b.code))
    .slice(0, limit);
}
