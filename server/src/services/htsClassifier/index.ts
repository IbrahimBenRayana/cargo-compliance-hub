/**
 * Native HTS classifier (docs/specs/native-hts-classifier.md).
 *
 *   understand (AI) -> too vague? ask : CBP precedent rulings (CROSS)
 *   -> candidate headings (our schedule + the precedent's headings)
 *   -> choose the heading (AI, GRI 1, with the legal notes and precedent)
 *   -> every line of it -> pick a line (AI) and, in parallel, a blind second
 *      opinion from the same lines (AI, optionally another model)
 *   -> a missing deciding fact? ask it -> guard rails (code): labels, duty,
 *      spread warning, notice -> audit log
 *
 * Every suggested code is a real 10-digit line from hts_rate_lines; when the
 * AI is unavailable the user gets word matches, labelled as such.
 */
import { prisma } from '../../config/database.js';
import logger from '../../config/logger.js';
import { isConfigured } from '../ai.js';
import { buildIndex, candidateHeadings, linesOfHeading, retrieveCandidates, type Candidate, type ScheduleIndex, type ScheduleLine } from './retrieve.js';
import { understandProduct, type Understanding } from './understand.js';
import { classifyAmong, chooseHeadings, type PromptContext } from './classify.js';
import { secondOpinion } from './verify.js';
import { classifierModel, precedentEnabled } from './llm.js';
import { findPrecedents, formatPrecedents, precedentHeadings, type Precedent } from './precedent.js';
import { headingNotes, lineNotes } from './notes.js';
import { agreementOf, confidenceLabel, dutySpreadWarning, EXTRA_DUTY_NOTE, NOT_A_RULING, type ConfidenceLabel } from './guards.js';
import { formatHts } from './format.js';

export type ClassifyStatus = 'ok' | 'needs_detail' | 'keyword_only' | 'no_match';

export interface Suggestion {
  code: string;
  /** Full path text: heading > subheading > ... > line. */
  description: string;
  confidence: ConfidenceLabel | null;
  /** The AI's 0-1 confidence (kept for older clients that read `score`). */
  score: number | null;
  reason?: string;
  generalRate: string;
  units: string[];
  warnings?: string[];
}

export interface ClassifyResult {
  status: ClassifyStatus;
  message?: string;
  questions?: string[];
  didYouMean?: string[];
  suggestions: Suggestion[];
  dutySpreadWarning?: string;
  dutyNote: string;
  notice: string;
  revision: string;
}

export class ClassifyInputError extends Error {}

export interface Debug { candidates?: string[]; sufficiency?: string; precedent?: string[]; headings?: string[] }

const MAX_DESCRIPTION = 1000;
const CANDIDATES = 60;
const HEADINGS = 10;
// A deciding question is asked when the second-best line is this close.
const DECIDING_GAP = 0.3;
// A runner-up heading's lines are offered too when it is a real contender.
const RUNNER_UP_MIN = 0.25;
// Prompt budget: the biggest headings (e.g. 8708) have a few hundred lines.
const MAX_LINES = 450;
const KEYWORD_RESULTS = 5;
const DETAILED_WORDS = 12;

// ─── Schedule cache ─────────────────────────────────────────────────
// ~20k lines, a few MB: loaded once and searched in memory. Reloaded every
// few hours so a new ingest revision is picked up without a restart.
const RELOAD_MS = 6 * 60 * 60 * 1000;
let cache: { index: ScheduleIndex; revision: string; loadedAt: number } | null = null;

export function resetScheduleCache(): void {
  cache = null;
}

async function schedule(): Promise<{ index: ScheduleIndex; revision: string }> {
  if (cache && Date.now() - cache.loadedAt < RELOAD_MS) return cache;
  const rows = await prisma.htsRateLine.findMany({
    select: { htsNumber: true, description: true, pathText: true, generalRate: true, units: true, revision: true },
  });
  const lines: ScheduleLine[] = rows
    .filter((r) => r.htsNumber.length === 10) // declarable statistical lines only
    .map((r) => ({ code: r.htsNumber, description: r.description, pathText: r.pathText, generalRate: r.generalRate, units: r.units }));
  const revision = rows.reduce((max, r) => (r.revision > max ? r.revision : max), '');
  cache = { index: buildIndex(lines), revision, loadedAt: Date.now() };
  logger.info({ lines: lines.length, revision }, '[HTS] schedule loaded for classifier');
  return cache;
}

// ─── Result builders ────────────────────────────────────────────────

const base = (revision: string) => ({ dutyNote: EXTRA_DUTY_NOTE, notice: NOT_A_RULING, revision });

function plainSuggestion(c: Candidate): Suggestion {
  return { code: c.code, description: c.pathText || c.description, confidence: null, score: null, generalRate: c.generalRate, units: c.units };
}

function keywordOnly(candidates: Candidate[], revision: string, why: string): ClassifyResult {
  const suggestions = candidates.slice(0, KEYWORD_RESULTS).map(plainSuggestion);
  return {
    status: 'keyword_only',
    message: `${why} These suggestions are based on matching words only; check each one before you use it.`,
    suggestions,
    dutySpreadWarning: dutySpreadWarning(suggestions.map((s) => s.generalRate)),
    ...base(revision),
  };
}

function noMatch(u: Understanding | null, revision: string): ClassifyResult {
  return {
    status: 'no_match',
    message: 'No matching HTS lines. Try describing what it is, what it is made of and what it is used for.',
    questions: u?.questions.length ? u.questions : undefined,
    didYouMean: u?.didYouMean.length ? u.didYouMean : undefined,
    suggestions: [],
    ...base(revision),
  };
}

// ─── Entry point ────────────────────────────────────────────────────

export async function classifyProduct(
  rawDescription: string,
  ctx: {
    userId: string; orgId: string;
    /** false for evaluation runs */ audit?: boolean;
    /** evaluation: the ruling being tested is not its own precedent */ excludeRulings?: string[];
    /** evaluation: report the candidate pool */ debug?: Debug;
  },
): Promise<ClassifyResult> {
  const description = rawDescription.trim();
  if (description.length < 2) throw new ClassifyInputError('Describe the product to classify.');
  if (description.length > MAX_DESCRIPTION) throw new ClassifyInputError(`Keep the description under ${MAX_DESCRIPTION} characters.`);

  const started = Date.now();
  const { index, revision } = await schedule();
  const result = await run(description, ctx.userId, index, revision, ctx.excludeRulings ?? [], ctx.debug);

  const latencyMs = Date.now() - started;
  logger.info({ status: result.status, suggestions: result.suggestions.length, latencyMs }, '[HTS] classified');
  if (ctx.audit === false) return result;
  prisma.htsClassification
    .create({
      data: {
        orgId: ctx.orgId, userId: ctx.userId, description, status: result.status,
        result: result as object, model: isConfigured() ? classifierModel() : 'none', revision, latencyMs,
      },
    })
    .catch((err: any) => logger.error({ err: err?.message }, '[HTS] audit log write failed'));
  return result;
}

async function run(
  description: string, userId: string, index: ScheduleIndex, revision: string,
  excludeRulings: string[], debug?: Debug,
): Promise<ClassifyResult> {
  if (!isConfigured()) {
    const candidates = retrieveCandidates(index, [description], KEYWORD_RESULTS);
    return candidates.length ? keywordOnly(candidates, revision, 'AI suggestions are switched off.') : noMatch(null, revision);
  }

  // Steps 1-2: understand; too vague means ask, not guess.
  let u = await understandProduct(description, userId);
  // A description this long names the goods; the AI still sometimes calls
  // one "too vague" (6 of 101 CBP rulings in v3's eval). Classify it, and
  // keep its questions, rather than refuse.
  if (u.sufficiency === 'too_vague' && description.split(/\s+/).length >= DETAILED_WORDS) u = { ...u, sufficiency: 'heading_only' };
  if (debug) debug.sufficiency = u.sufficiency;
  if (u.sufficiency === 'too_vague') {
    return {
      status: 'needs_detail',
      message: u.missing.length
        ? `This description is too general to classify. Missing: ${u.missing.join(', ')}.`
        : 'This description is too general to classify.',
      questions: u.questions,
      didYouMean: u.didYouMean,
      suggestions: [],
      ...base(revision),
    };
  }

  // Precedent: how CBP ruled on similar goods.
  const precedent: Precedent[] = precedentEnabled() && u.rulingQueries.length
    ? await findPrecedents(u.rulingQueries, { exclude: excludeRulings })
    : [];
  const precedentText = precedent.length ? formatPrecedents(precedent) : undefined;
  if (debug) debug.precedent = precedent.map((p) => `${p.ruling}:${p.codes.join('/')}`);

  // Step 3: the headings worth deciding between (real schedule headings),
  // including those CBP chose for similar goods.
  const likely = [...new Set([...u.likelyHeadings, ...precedentHeadings(precedent)])];
  const headings = candidateHeadings(index, u.searchTerms, likely, HEADINGS);
  if (debug) debug.candidates = headings.flatMap((h) => linesOfHeading(index, h.heading).map((l) => l.code));
  if (debug) debug.headings = headings.map((h) => h.heading);
  if (headings.length === 0) return noMatch(u, revision);

  // Step 4a: heading first (GRI 1), with the legal notes.
  const chosen = await chooseHeadings(description, u, headings, userId, {
    precedent: precedentText, notes: headingNotes(headings.map((h) => h.heading)),
  });
  if (!chosen) {
    const pool = retrieveCandidates(index, u.searchTerms, CANDIDATES, u.likelyHeadings);
    return pool.length ? keywordOnly(pool, revision, 'The AI step could not finish.') : noMatch(u, revision);
  }
  // Every line of the chosen heading (and of a close runner-up), not a keyword subset.
  let lines = linesOfHeading(index, chosen[0].heading);
  if (chosen[1] && chosen[1].confidence >= RUNNER_UP_MIN) lines = lines.concat(linesOfHeading(index, chosen[1].heading));
  if (lines.length > MAX_LINES) lines = retrieveCandidates(index, u.searchTerms, MAX_LINES, chosen.slice(0, 2).map((h) => h.heading));
  if (debug) debug.candidates = lines.map((l) => l.code);

  // Step 4b + 5: pick a line, and independently, a blind second opinion.
  const lineContext: PromptContext = {
    precedent: precedentText, notes: lineNotes([...new Set(lines.map((l) => l.code.slice(0, 4)))]),
  };
  const [cls, second] = await Promise.all([
    classifyAmong(description, u, lines, userId, lineContext),
    secondOpinion(description, u, lines, userId, lineContext),
  ]);
  if (!cls) return keywordOnly(lines.slice(0, KEYWORD_RESULTS), revision, 'The AI step could not finish.');
  if (cls.picks.length === 0) return noMatch(u, revision);

  // Step 6: guard rails.
  const byCode = new Map(lines.map((c) => [c.code, c]));
  const agreement = agreementOf(cls.picks[0].code, second?.code ?? null);
  const headingConfidence = chosen.find((h) => h.heading === cls.picks[0].code.slice(0, 4))?.confidence ?? 0;
  // A fact the description doesn't state decides between close lines: ask it.
  const gap = cls.picks[0].confidence - (cls.picks[1]?.confidence ?? 0);
  const deciding = cls.decidingQuestion && (gap < DECIDING_GAP || agreement !== 'exact') ? cls.decidingQuestion : undefined;
  const sufficiency = deciding ? 'heading_only' : u.sufficiency;

  const suggestions: Suggestion[] = cls.picks.map((p, rank) => {
    const c = byCode.get(p.code)!;
    const warnings: string[] = [];
    if (rank === 0 && second && agreement !== 'exact') {
      warnings.push(`A second, independent check chose ${formatHts(second.code)} instead${second.reason ? `: ${second.reason}` : '.'} Check the difference before you file.`);
    }
    if (rank === 0 && !second) warnings.push('The second check could not run; review this code carefully.');
    return {
      ...plainSuggestion(c),
      confidence: confidenceLabel({
        confidence: p.confidence, rank, nextConfidence: cls.picks[1]?.confidence ?? 0,
        agreement: rank === 0 ? agreement : null, sufficiency, headingConfidence,
      }),
      score: p.confidence,
      reason: p.reason || undefined,
      ...(warnings.length ? { warnings } : {}),
    };
  });
  // The second opinion's own pick is always on the list for the user to compare.
  if (second && !suggestions.some((s) => s.code === second.code)) {
    suggestions.push({
      ...plainSuggestion(byCode.get(second.code)!),
      confidence: 'low',
      score: null,
      reason: second.reason ? `Second check's choice: ${second.reason}` : "Second check's choice.",
    });
  }

  const partial = sufficiency !== 'enough';
  const questions = [...new Set([...(deciding ? [deciding] : []), ...u.questions])].slice(0, 3);
  return {
    status: partial ? 'needs_detail' : 'ok',
    message: deciding
      ? 'More than one line fits what was described; one fact decides between them. Answer the question to be sure.'
      : partial
        ? 'The heading looks clear, but some facts that decide the full code are missing. Answer the questions to be sure.'
        : cls.concerns[0],
    questions: partial && questions.length ? questions : undefined,
    didYouMean: partial && u.didYouMean.length ? u.didYouMean : undefined,
    suggestions,
    dutySpreadWarning: dutySpreadWarning(suggestions.map((s) => s.generalRate)),
    ...base(revision),
  };
}
