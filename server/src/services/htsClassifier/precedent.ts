/**
 * Precedent for the HTS classifier (spec v3 §1): CBP rulings on similar goods
 * from the public CROSS API (rulings.cbp.gov). A broker checks how CBP ruled
 * on goods like these before choosing a heading; the AI gets the same help.
 *
 * Ruled codes are "as ruled at the time" (they may have been renumbered), so
 * precedent only informs the choice; suggestions still come from the schedule.
 * Any CROSS failure means "no precedent", never an error.
 */
import logger from '../../config/logger.js';

export interface Precedent {
  ruling: string;
  /** YYYY-MM-DD */
  date: string;
  subject: string;
  /** Ruled 10/8-digit codes, digits only, Chapter 99 left out. */
  codes: string[];
  /** The goods and the holding, from the ruling text. */
  excerpt?: string;
}

interface CrossHit {
  rulingNumber?: string;
  subject?: string;
  rulingDate?: string;
  tariffs?: string | null;
  relatedRulings?: string[] | null;
  revokedBy?: string[] | null;
  operationallyRevoked?: boolean;
}

const BASE = 'https://rulings.cbp.gov/api';
const TIMEOUT_MS = 4000;
const PAGE_SIZE = 20;
const TTL_MS = 24 * 60 * 60 * 1000;
const MAX_CACHED = 3000;

// ─── Cache (in memory; a persistent one would need a table) ─────────
const cache = new Map<string, { at: number; value: Promise<unknown> }>();

export function resetPrecedentCache(): void {
  cache.clear();
}

function cached<T>(key: string, load: () => Promise<T>): Promise<T> {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.value as Promise<T>;
  const value = load();
  // A failed load is not remembered: the next request tries again.
  value.catch(() => cache.delete(key));
  cache.set(key, { at: Date.now(), value });
  if (cache.size > MAX_CACHED) cache.delete(cache.keys().next().value!);
  return value;
}

async function getJson(url: string): Promise<any> {
  const res = await fetch(url, { headers: { accept: 'application/json' }, signal: AbortSignal.timeout(TIMEOUT_MS) });
  if (!res.ok) throw new Error(`CROSS HTTP ${res.status}`);
  return res.json();
}

const search = (term: string) => cached(`s:${term}`, async () => {
  const q = new URLSearchParams({ term, collection: 'ALL', pageSize: String(PAGE_SIZE), page: '1', sortBy: 'RELEVANCE' });
  const body = await getJson(`${BASE}/search?${q}`);
  return (Array.isArray(body?.rulings) ? body.rulings : []) as CrossHit[];
});

const rulingText = (n: string) => cached(`r:${n}`, async () => {
  const body = await getJson(`${BASE}/ruling/${encodeURIComponent(n)}`);
  return typeof body?.text === 'string' ? (body.text as string) : '';
});

// ─── Excerpt ────────────────────────────────────────────────────────

const HOLDING = /applicable (sub)?heading|is classified|are classified|classifiable|provides for|General Rules? of Interpretation|\bGRI\b|\bNote \d|excluded|essential character|we disagree/i;
const BOILERPLATE = /duty rate|rate of duty|ad valorem|CFR|Part 177|additional dut|Chapter 99|letter dated|requested a|on behalf of|hts\.usitc\.gov|CSMS|National Import Specialist|questions regarding/i;
const GOODS_MAX = 380;
const HOLDING_MAX = 480;

/** The goods and the holding sentences of a ruling, boilerplate left out. */
export function excerptOf(text: string): string {
  const salutation = /Dear [^:]{1,80}:/.exec(text);
  const body = salutation ? text.slice(salutation.index + salutation[0].length) : text;
  const sentences = body.replace(/\s+/g, ' ').split(/(?<=[a-z0-9)”"][.!?])\s*(?=[A-Z])/).map((s) => s.trim()).filter(Boolean);
  const goods: string[] = [];
  const holding: string[] = [];
  let g = 0;
  let h = 0;
  for (const s of sentences) {
    if (HOLDING.test(s) && !/duty rate|rate of duty|CFR|Part 177/i.test(s)) {
      if (h + s.length <= HOLDING_MAX) { holding.push(s); h += s.length; }
    } else if (!BOILERPLATE.test(s) && holding.length === 0 && g + s.length <= GOODS_MAX) {
      goods.push(s);
      g += s.length;
    }
  }
  return [goods.join(' '), holding.join(' ')].filter(Boolean).join(' Holding: ');
}

// ─── Search and rank ────────────────────────────────────────────────

const up = (s: string) => s.trim().toUpperCase();

function codesOf(tariffs: string | null | undefined): string[] {
  return [...new Set((tariffs ?? '').split(/[,;]/)
    .map((t) => t.replace(/\D/g, ''))
    .filter((c) => c.length >= 8 && !c.startsWith('99')))];
}

/**
 * The most similar CBP rulings for the goods. `exclude` (evaluation) drops
 * those rulings and every ruling that lists or cites them.
 */
export async function findPrecedents(
  queries: string[], opts: { exclude?: string[]; max?: number; withText?: number } = {},
): Promise<Precedent[]> {
  const max = opts.max ?? 6;
  const withText = opts.withText ?? 3;
  const exclude = new Set((opts.exclude ?? []).map(up));
  const terms = [...new Set(queries.map((q) => q.trim().toLowerCase()).filter(Boolean))].slice(0, 4);
  if (terms.length === 0) return [];

  const results = await Promise.all(terms.map((t) => search(t).catch((err: any) => {
    logger.warn({ err: err?.message }, '[HTS] precedent: CROSS search failed');
    return [] as CrossHit[];
  })));

  // Rulings found by several queries first, then by CROSS relevance.
  const scored = new Map<string, { hit: CrossHit; score: number }>();
  for (const hits of results) {
    hits.forEach((hit, pos) => {
      const n = up(hit.rulingNumber ?? '');
      if (!n || exclude.has(n)) return;
      if (hit.operationallyRevoked || (hit.revokedBy?.length ?? 0) > 0) return;
      if ((hit.relatedRulings ?? []).some((r) => exclude.has(up(r)))) return;
      if (codesOf(hit.tariffs).length === 0) return;
      const prev = scored.get(n);
      const s = 1 + 1 / (1 + pos);
      scored.set(n, { hit, score: (prev?.score ?? 0) + s });
    });
  }
  const ranked = [...scored.entries()]
    .sort((a, b) => b[1].score - a[1].score || (b[1].hit.rulingDate ?? '').localeCompare(a[1].hit.rulingDate ?? ''))
    .slice(0, max + (exclude.size ? 3 : 0));

  // Texts: for excerpts, and (evaluation) to drop rulings that cite an excluded one.
  const needText = exclude.size ? ranked.length : Math.min(withText, ranked.length);
  const texts = await Promise.all(ranked.slice(0, needText).map(([n]) => rulingText(n).catch(() => '')));

  const out: Precedent[] = [];
  ranked.forEach(([n, { hit }], i) => {
    const text = texts[i] ?? '';
    if (exclude.size && [...exclude].some((x) => new RegExp(`\\b${x}\\b`, 'i').test(text))) return;
    if (out.length >= max) return;
    const p: Precedent = {
      ruling: n,
      date: (hit.rulingDate ?? '').slice(0, 10),
      subject: (hit.subject ?? '').replace(/^RE:\s*/i, '').replace(/\s+/g, ' ').trim(),
      codes: codesOf(hit.tariffs),
    };
    if (out.length < withText && text) p.excerpt = excerptOf(text);
    out.push(p);
  });
  return out;
}

/** The 4-digit headings the precedent points to, most supported first. */
export function precedentHeadings(ps: Precedent[]): string[] {
  const count = new Map<string, number>();
  for (const p of ps) for (const h of new Set(p.codes.map((c) => c.slice(0, 4)))) count.set(h, (count.get(h) ?? 0) + 1);
  return [...count.entries()].sort((a, b) => b[1] - a[1]).map(([h]) => h);
}

// CBP's own style: 6307.90.7500
const dotted = (c: string) => `${c.slice(0, 4)}.${c.slice(4, 6)}.${c.slice(6)}`;

/** Precedent as prompt text. */
export function formatPrecedents(ps: Precedent[]): string {
  return ps.map((p, i) => `${i + 1}. ${p.ruling} (${p.date}): ${p.subject} -> ${p.codes.map(dotted).join(', ')}${p.excerpt ? `\n   ${p.excerpt}` : ''}`).join('\n');
}
