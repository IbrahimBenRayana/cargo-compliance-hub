/**
 * HTS classifier evaluation (spec: "Accuracy is measured, not assumed").
 *
 *   docker exec -i mycargolens-server node dist/services/htsClassifier/evalCli.js \
 *     < server/src/services/htsClassifier/__fixtures__/crossEval.json
 *
 * Runs every CBP CROSS ruling and every vague description through the real
 * classifier (live schedule + AI) and prints the scores the release gate uses.
 * Nothing is written to the audit log. Each case's own ruling (and any ruling
 * citing it) is excluded from its precedent. Env: HTS_PRECEDENT=off for a run
 * without precedent, EVAL_CONCURRENCY (default 4) cases at a time.
 */
import { readFileSync } from 'node:fs';
import { classifyProduct, type ClassifyResult, type Debug } from './index.js';
import { classifierModel, precedentEnabled, verifyModel } from './llm.js';

interface Ruling { ruling: string; description: string; hts: string; heading: string; headingOnly?: boolean }
interface Vague { description: string; expect: string }

const fixture = JSON.parse(readFileSync(0, 'utf8')) as { rulings: Ruling[]; vague: Vague[] };
// Own AI budget per model so back-to-back runs don't share the daily cap.
const ctx = { userId: `hts-eval-${classifierModel()}`, orgId: 'hts-eval', audit: false };
const pct = (n: number, d: number) => (d ? `${((100 * n) / d).toFixed(1)}%` : 'n/a');

interface Run { r: ClassifyResult | null; ms: number; err?: string; pool: string[]; suff?: string; debug: Debug }

// Out of API credit, every later case would fail too: stop, don't score it.
let outOfCredit = false;
let done = 0;

async function timed(description: string, exclude: string[] = []): Promise<Run> {
  const t = Date.now();
  const debug: Debug = {};
  try {
    const r = await classifyProduct(description, { ...ctx, excludeRulings: exclude, debug });
    return { r, ms: Date.now() - t, pool: debug.candidates ?? [], suff: debug.sufficiency, debug };
  } catch (e: any) {
    if (/no credits|quota/i.test(e?.message ?? '')) outOfCredit = true;
    return { r: null, ms: Date.now() - t, err: e?.message, pool: [], debug };
  } finally {
    process.stderr.write(`eval: ${++done} done\n`);
  }
}

/** Runs every item, `limit` at a time, results in input order. */
async function pooled<T, R>(items: T[], limit: number, fn: (x: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length && !outOfCredit) {
      const i = next++;
      out[i] = await fn(items[i]);
    }
  }));
  return out;
}
const CONCURRENCY = Number(process.env.EVAL_CONCURRENCY) || 4;

async function main(): Promise<void> {
  const times: number[] = [];
  const s = { n: 0, heading1: 0, six1: 0, ten1: 0, ten3: 0, heading5: 0, needsDetail: 0, highWrong: 0, highTotal: 0, errors: 0, poolHasCode: 0, poolHasHeading: 0, precedentFound: 0, precedentHasHeading: 0, headingsHaveRight: 0 };
  const lines: string[] = [];

  // Each case is printed as it finishes ("CASE {json}"), so a run cut short
  // (e.g. a deploy restarting the container) keeps what it paid for and can
  // be resumed with the remaining cases only.
  const runs = await pooled(fixture.rulings, CONCURRENCY, async (x) => {
    const run = await timed(x.description, [x.ruling]);
    if (!outOfCredit) {
      console.log(`CASE ${JSON.stringify({
        ruling: x.ruling, want: x.hts, heading: x.heading, headingOnly: !!x.headingOnly, ms: run.ms, err: run.err,
        status: run.r?.status, codes: run.r?.suggestions.slice(0, 5).map((g) => g.code), label: run.r?.suggestions[0]?.confidence,
        pool: run.pool.includes(x.hts) ? 'code' : run.pool.some((c) => c.slice(0, 4) === x.heading) ? 'heading' : 'none',
        headings: run.debug.headings, precedent: run.debug.precedent,
      })}`);
    }
    return run;
  });
  if (outOfCredit) {
    console.log('ABORTED: the AI account is out of credit; results would be meaningless.');
    process.exit(2);
  }
  fixture.rulings.forEach((x, i) => {
    const { r, ms, err, pool, suff, debug } = runs[i];
    const prec = debug.precedent ?? [];
    s.precedentFound += +(prec.length > 0);
    s.precedentHasHeading += +prec.some((p) => p.split(':')[1]?.split('/').some((c) => c.slice(0, 4) === x.heading));
    s.headingsHaveRight += +(debug.headings ?? []).includes(x.heading);
    times.push(ms);
    s.n++;
    const inPool = pool.includes(x.hts);
    s.poolHasCode += +inPool;
    s.poolHasHeading += +pool.some((c) => c.slice(0, 4) === x.heading);
    if (!r) { s.errors++; lines.push(`ERR  ${x.ruling} ${err}`); return; }
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
    lines.push(`${t1 ? 'OK10' : h1 ? 'OK4 ' : 'MISS'} ${x.ruling} want ${x.hts} got ${top || '-'} (${r.suggestions[0]?.confidence ?? r.status}) pool:${inPool ? 'code' : pool.some((c) => c.slice(0, 4) === x.heading) ? 'heading' : 'none'} suff:${suff} prec:${prec.slice(0, 3).join(',') || '-'} ${ms}ms`);
  });

  const vague = { n: 0, asked: 0 };
  const vagueRuns = await pooled(fixture.vague, CONCURRENCY, async (v) => {
    const run = await timed(v.description);
    console.log(`VAGUE ${JSON.stringify({ description: v.description, status: run.r?.status, questions: run.r?.questions?.length ?? 0, didYouMean: run.r?.didYouMean?.length ?? 0, ms: run.ms })}`);
    return run;
  });
  fixture.vague.forEach((v, i) => {
    const { r, ms } = vagueRuns[i];
    times.push(ms);
    vague.n++;
    const asked = r?.status === 'needs_detail' && ((r.questions?.length ?? 0) > 0 || (r.didYouMean?.length ?? 0) > 0);
    vague.asked += +asked;
    lines.push(`${asked ? 'ASK ' : 'NOASK'} "${v.description}" -> ${r?.status ?? 'error'}`);
  });

  times.sort((a, b) => a - b);
  const p = (q: number) => times[Math.min(times.length - 1, Math.floor(q * times.length))];
  const scored = fixture.rulings.filter((x) => !x.headingOnly).length;
  console.log(lines.join('\n'));
  console.log(JSON.stringify({
    model: classifierModel(),
    verifyModel: verifyModel(),
    reasoningEffort: process.env.HTS_AI_REASONING_EFFORT ?? 'default',
    precedent: precedentEnabled() ? 'on (own ruling and citing rulings excluded)' : 'off',
    concurrency: CONCURRENCY,
    rulings: s.n,
    headingTop1: pct(s.heading1, s.n),
    sixDigitTop1: pct(s.six1, scored),
    tenDigitTop1: pct(s.ten1, scored),
    tenDigitTop3: pct(s.ten3, scored),
    headingInTop5: pct(s.heading5, s.n),
    poolHasRightCode: pct(s.poolHasCode, scored),
    poolHasRightHeading: pct(s.poolHasHeading, s.n),
    candidateHeadingsHaveRight: pct(s.headingsHaveRight, s.n),
    precedentFound: pct(s.precedentFound, s.n),
    precedentHasRightHeading: pct(s.precedentHasHeading, s.n),
    returnedNeedsDetail: s.needsDetail,
    highConfidence: s.highTotal,
    highConfidenceWrong: s.highWrong,
    errors: s.errors,
    vagueAsked: `${vague.asked}/${vague.n}`,
    latencyMs: { p50: p(0.5), p95: p(0.95) },
  }, null, 1));
}

void main().then(() => process.exit(0));
