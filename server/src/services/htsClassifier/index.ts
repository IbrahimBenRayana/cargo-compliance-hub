/**
 * Native HTS classifier (docs/specs/native-hts-classifier.md).
 *
 *   understand (AI) -> too vague? ask : retrieve real lines (our schedule)
 *   -> classify among them (AI, GRI order) -> verify the top pick (AI)
 *   -> guard rails (code): labels, duty, spread warning, notice -> audit log
 *
 * Every suggested code is a real 10-digit line from hts_rate_lines; when the
 * AI is unavailable the user gets word matches, labelled as such.
 */
import { prisma } from '../../config/database.js';
import logger from '../../config/logger.js';
import { isConfigured } from '../ai.js';
import { buildIndex, retrieveCandidates, type Candidate, type ScheduleIndex, type ScheduleLine } from './retrieve.js';
import { understandProduct, type Understanding } from './understand.js';
import { classifyAmong } from './classify.js';
import { verifyPick, type Verification } from './verify.js';
import { classifierModel } from './llm.js';
import { confidenceLabel, dutySpreadWarning, EXTRA_DUTY_NOTE, NOT_A_RULING, type ConfidenceLabel } from './guards.js';

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

const MAX_DESCRIPTION = 1000;
const CANDIDATES = 60;
const KEYWORD_RESULTS = 5;

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
  ctx: { userId: string; orgId: string; /** false for evaluation runs */ audit?: boolean; /** evaluation: report the candidate pool */ debug?: { candidates?: string[]; sufficiency?: string } },
): Promise<ClassifyResult> {
  const description = rawDescription.trim();
  if (description.length < 2) throw new ClassifyInputError('Describe the product to classify.');
  if (description.length > MAX_DESCRIPTION) throw new ClassifyInputError(`Keep the description under ${MAX_DESCRIPTION} characters.`);

  const started = Date.now();
  const { index, revision } = await schedule();
  const result = await run(description, ctx.userId, index, revision, ctx.debug);

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
  debug?: { candidates?: string[]; sufficiency?: string },
): Promise<ClassifyResult> {
  if (!isConfigured()) {
    const candidates = retrieveCandidates(index, [description], KEYWORD_RESULTS);
    return candidates.length ? keywordOnly(candidates, revision, 'AI suggestions are switched off.') : noMatch(null, revision);
  }

  // Steps 1-2: understand; too vague means ask, not guess.
  const u = await understandProduct(description, userId);
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

  // Step 3: real schedule lines only.
  const candidates = retrieveCandidates(index, u.searchTerms, CANDIDATES, u.likelyHeadings);
  if (debug) debug.candidates = candidates.map((c) => c.code);
  if (candidates.length === 0) return noMatch(u, revision);

  // Step 4: classify among them.
  const cls = await classifyAmong(description, u, candidates, userId);
  if (!cls) return keywordOnly(candidates, revision, 'The AI step could not finish.');
  if (cls.picks.length === 0) return noMatch(u, revision);

  // Step 5: independent check of the top pick.
  const byCode = new Map(candidates.map((c) => [c.code, c]));
  const top = byCode.get(cls.picks[0].code)!;
  const verification: Verification | null = await verifyPick(description, u, top, userId);

  // Step 6: guard rails.
  const suggestions: Suggestion[] = cls.picks.map((p, rank) => {
    const c = byCode.get(p.code)!;
    const warnings: string[] = [];
    if (rank === 0 && verification && !verification.fits) {
      warnings.push(`Second check disagrees: ${verification.issue ?? 'the line wording may not cover these goods.'}`);
    } else if (rank === 0 && verification?.issue) {
      warnings.push(verification.issue);
    }
    if (rank === 0 && !verification) warnings.push('The second check could not run; review this code carefully.');
    return {
      ...plainSuggestion(c),
      confidence: confidenceLabel({
        confidence: p.confidence,
        rank,
        nextConfidence: cls.picks[1]?.confidence ?? 0,
        verification: rank === 0 ? verification : null,
        sufficiency: u.sufficiency,
      }),
      score: p.confidence,
      reason: p.reason || undefined,
      ...(warnings.length ? { warnings } : {}),
    };
  });

  const partial = u.sufficiency !== 'enough';
  return {
    status: partial ? 'needs_detail' : 'ok',
    message: partial
      ? 'The heading looks clear, but some facts that decide the full code are missing. Answer the questions to be sure.'
      : cls.concerns[0],
    questions: partial ? u.questions : undefined,
    didYouMean: partial && u.didYouMean.length ? u.didYouMean : undefined,
    suggestions,
    dutySpreadWarning: dutySpreadWarning(suggestions.map((s) => s.generalRate)),
    ...base(revision),
  };
}
