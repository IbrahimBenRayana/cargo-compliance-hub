/**
 * HTS classifier evaluation (spec: "Accuracy is measured, not assumed").
 *
 *   docker exec -i mycargolens-server node dist/services/htsClassifier/evalCli.js \
 *     < server/src/services/htsClassifier/__fixtures__/crossEval.json
 *
 * Runs every CBP CROSS ruling and every vague description through the real
 * classifier (live schedule + AI) and prints the scores the release gate uses.
 * Nothing is written to the audit log.
 */
import { readFileSync } from 'node:fs';
import { classifyProduct, type ClassifyResult } from './index.js';
import { classifierModel } from './llm.js';

interface Ruling { ruling: string; description: string; hts: string; heading: string; headingOnly?: boolean }
interface Vague { description: string; expect: string }

const fixture = JSON.parse(readFileSync(0, 'utf8')) as { rulings: Ruling[]; vague: Vague[] };
// Own AI budget per model so back-to-back runs don't share the daily cap.
const ctx = { userId: `hts-eval-${classifierModel()}`, orgId: 'hts-eval', audit: false };
const pct = (n: number, d: number) => (d ? `${((100 * n) / d).toFixed(1)}%` : 'n/a');

async function timed(description: string): Promise<{ r: ClassifyResult | null; ms: number; err?: string; pool: string[]; suff?: string }> {
  const t = Date.now();
  const debug: { candidates?: string[]; sufficiency?: string } = {};
  try {
    const r = await classifyProduct(description, { ...ctx, debug });
    return { r, ms: Date.now() - t, pool: debug.candidates ?? [], suff: debug.sufficiency };
  } catch (e: any) {
    return { r: null, ms: Date.now() - t, err: e?.message, pool: [] };
  }
}

async function main(): Promise<void> {
  const times: number[] = [];
  const s = { n: 0, heading1: 0, six1: 0, ten1: 0, ten3: 0, heading5: 0, needsDetail: 0, highWrong: 0, highTotal: 0, errors: 0, poolHasCode: 0, poolHasHeading: 0 };
  const lines: string[] = [];

  for (const x of fixture.rulings) {
    const { r, ms, err, pool, suff } = await timed(x.description);
    times.push(ms);
    s.n++;
    const inPool = pool.includes(x.hts);
    s.poolHasCode += +inPool;
    s.poolHasHeading += +pool.some((c) => c.slice(0, 4) === x.heading);
    if (!r) { s.errors++; lines.push(`ERR  ${x.ruling} ${err}`); continue; }
    const codes = r.suggestions.map((g) => g.code);
    const top = codes[0] ?? '';
    const h1 = top.slice(0, 4) === x.heading;
    const s1 = !x.headingOnly && top.slice(0, 6) === x.hts.slice(0, 6);
    const t1 = !x.headingOnly && top === x.hts;
    const t3 = !x.headingOnly && codes.slice(0, 3).includes(x.hts);
    const h5 = codes.slice(0, 5).some((c) => c.slice(0, 4) === x.heading);
    s.heading1 += +h1; s.six1 += +s1; s.ten1 += +t1; s.ten3 += +t3; s.heading5 += +h5;
    if (r.status === 'needs_detail') s.needsDetail++;
    if (r.suggestions[0]?.confidence === 'high') {
      s.highTotal++;
      const right = x.headingOnly ? h1 : t1;
      if (!right) s.highWrong++;
    }
    lines.push(`${t1 ? 'OK10' : h1 ? 'OK4 ' : 'MISS'} ${x.ruling} want ${x.hts} got ${top || '-'} (${r.suggestions[0]?.confidence ?? r.status}) pool:${inPool ? 'code' : pool.some((c) => c.slice(0, 4) === x.heading) ? 'heading' : 'none'} suff:${suff} ${ms}ms`);
  }

  const vague = { n: 0, asked: 0 };
  for (const v of fixture.vague) {
    const { r, ms } = await timed(v.description);
    times.push(ms);
    vague.n++;
    const asked = r?.status === 'needs_detail' && ((r.questions?.length ?? 0) > 0 || (r.didYouMean?.length ?? 0) > 0);
    vague.asked += +asked;
    lines.push(`${asked ? 'ASK ' : 'NOASK'} "${v.description}" -> ${r?.status ?? 'error'}`);
  }

  times.sort((a, b) => a - b);
  const p = (q: number) => times[Math.min(times.length - 1, Math.floor(q * times.length))];
  const scored = fixture.rulings.filter((x) => !x.headingOnly).length;
  console.log(lines.join('\n'));
  console.log(JSON.stringify({
    model: classifierModel(),
    rulings: s.n,
    headingTop1: pct(s.heading1, s.n),
    sixDigitTop1: pct(s.six1, scored),
    tenDigitTop1: pct(s.ten1, scored),
    tenDigitTop3: pct(s.ten3, scored),
    headingInTop5: pct(s.heading5, s.n),
    poolHasRightCode: pct(s.poolHasCode, scored),
    poolHasRightHeading: pct(s.poolHasHeading, s.n),
    returnedNeedsDetail: s.needsDetail,
    highConfidence: s.highTotal,
    highConfidenceWrong: s.highWrong,
    errors: s.errors,
    vagueAsked: `${vague.asked}/${vague.n}`,
    latencyMs: { p50: p(0.5), p95: p(0.95) },
  }, null, 1));
}

void main().then(() => process.exit(0));
