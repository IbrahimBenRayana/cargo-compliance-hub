/**
 * Usage limits for the HTS classifier (spec "Usage limits"). A classification
 * costs ~$0.12 of AI, so users get a clear allowance instead of unlimited runs.
 *
 * The unit is one classification. Counts come from the audit table
 * (hts_classifications: durable across restarts) plus requests in flight, so
 * parallel clicks can't slip past. Free: "too vague" answers, word-match
 * fallbacks, and repeats of a description the organization already asked
 * about in the last 24 hours (answered from the audit table, no AI).
 */
import { prisma } from '../../config/database.js';
import { env } from '../../config/env.js';
import type { ClassifyResult } from './index.js';

export interface HtsLimits {
  perMinute: number;
  userDaily: number;
  orgMonthly: number;
  globalDaily: number;
}

/** The one place plans will set limits (pricing decision pending). */
export function limitsFor(_orgId: string): HtsLimits {
  return {
    perMinute: env.HTS_LIMIT_PER_MINUTE,
    userDaily: env.HTS_LIMIT_USER_DAILY,
    orgMonthly: env.HTS_LIMIT_ORG_MONTHLY,
    globalDaily: env.HTS_LIMIT_GLOBAL_DAILY,
  };
}

export type LimitScope = 'in_flight' | 'per_minute' | 'user_daily' | 'org_monthly' | 'global_daily';

export interface Usage {
  user: { used: number; limit: number; period: 'day'; resetsAt: string };
  organization: { used: number; limit: number; period: 'month'; resetsAt: string };
}

export class HtsLimitError extends Error {
  constructor(message: string, public readonly scope: LimitScope, public readonly resetsAt: Date) {
    super(message);
    this.name = 'HtsLimitError';
  }
}

interface Who { userId: string; orgId: string }

// ─── Windows (UTC) ──────────────────────────────────────────────────
const dayStart = (now: Date) => new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
const nextDay = (now: Date) => new Date(dayStart(now).getTime() + 86_400_000);
const monthStart = (now: Date) => new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
const nextMonth = (now: Date) => new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));

// What a counted classification looks like in the audit table.
const CHARGED = { model: { notIn: ['none', 'cache'] }, status: { notIn: ['too_vague', 'keyword_only'] } };

/** The audit status: a "too vague" answer (asked, no codes) is logged as such and is free. */
export function auditStatus(r: Pick<ClassifyResult, 'status' | 'suggestions'>): string {
  return r.status === 'needs_detail' && r.suggestions.length === 0 ? 'too_vague' : r.status;
}

// ─── In flight (single server process) ──────────────────────────────
const running = { users: new Set<string>(), orgs: new Map<string, number>(), total: 0 };

const count = (where: object) => prisma.htsClassification.count({ where: { ...CHARGED, ...where } });

export async function usageFor(who: Who): Promise<Usage> {
  const now = new Date();
  const limits = limitsFor(who.orgId);
  const [user, org] = await Promise.all([
    count({ orgId: who.orgId, userId: who.userId, createdAt: { gte: dayStart(now) } }),
    count({ orgId: who.orgId, createdAt: { gte: monthStart(now) } }),
  ]);
  return {
    user: { used: user, limit: limits.userDaily, period: 'day', resetsAt: nextDay(now).toISOString() },
    organization: { used: org, limit: limits.orgMonthly, period: 'month', resetsAt: nextMonth(now).toISOString() },
  };
}

const plural = (n: number) => `${n} HTS classification${n === 1 ? '' : 's'}`;
const REPEATS_FREE = 'Classifying the same description again within 24 hours is free.';

/**
 * Claims a slot for one classification, or throws HtsLimitError saying which
 * limit was reached. Call the returned function when the classification ends.
 */
export async function reserve(who: Who): Promise<() => void> {
  const now = new Date();
  const limits = limitsFor(who.orgId);
  if (running.users.has(who.userId)) {
    throw new HtsLimitError('Your previous HTS classification is still running. Wait for it to finish.', 'in_flight', now);
  }
  // Claim first, so a parallel request sees this one while the counts run.
  running.users.add(who.userId);
  running.orgs.set(who.orgId, (running.orgs.get(who.orgId) ?? 0) + 1);
  running.total++;
  let released = false;
  const release = () => {
    if (released) return;
    released = true;
    running.users.delete(who.userId);
    const left = (running.orgs.get(who.orgId) ?? 1) - 1;
    if (left > 0) running.orgs.set(who.orgId, left); else running.orgs.delete(who.orgId);
    running.total--;
  };
  try {
    const [minute, userDay, orgMonth, global] = await Promise.all([
      // Bursts count free answers too: they still call the AI.
      prisma.htsClassification.count({ where: { orgId: who.orgId, userId: who.userId, model: { notIn: ['none', 'cache'] }, createdAt: { gte: new Date(now.getTime() - 60_000) } } }),
      count({ orgId: who.orgId, userId: who.userId, createdAt: { gte: dayStart(now) } }),
      count({ orgId: who.orgId, createdAt: { gte: monthStart(now) } }),
      count({ createdAt: { gte: dayStart(now) } }),
    ]);
    // In-flight requests count against the shared limits (this one included).
    const orgRunning = (running.orgs.get(who.orgId) ?? 1) - 1;
    const allRunning = running.total - 1;
    if (minute >= limits.perMinute) {
      throw new HtsLimitError(`Please wait a moment: up to ${limits.perMinute} HTS classifications a minute.`, 'per_minute', new Date(now.getTime() + 60_000));
    }
    if (userDay >= limits.userDaily) {
      throw new HtsLimitError(
        `You have used your ${plural(limits.userDaily)} for today. They reset at midnight UTC. ${REPEATS_FREE}`,
        'user_daily', nextDay(now),
      );
    }
    if (orgMonth + orgRunning >= limits.orgMonthly) {
      const reset = nextMonth(now).toLocaleDateString('en-US', { month: 'long', day: 'numeric', timeZone: 'UTC' });
      throw new HtsLimitError(
        `Your organization has used its ${plural(limits.orgMonthly)} for this month. They reset on ${reset} (UTC); contact us to raise the limit. ${REPEATS_FREE}`,
        'org_monthly', nextMonth(now),
      );
    }
    if (global + allRunning >= limits.globalDaily) {
      throw new HtsLimitError('HTS suggestions are busy right now. Please try again later.', 'global_daily', nextDay(now));
    }
  } catch (err) {
    release();
    throw err;
  }
  return release;
}

// ─── Repeats ────────────────────────────────────────────────────────
const REPEAT_WINDOW_MS = 24 * 60 * 60 * 1000;

/** The organization's stored answer to the same description from the last 24 hours. */
export async function cachedResult(orgId: string, description: string): Promise<ClassifyResult | null> {
  const d = description.trim();
  if (!d) return null;
  const row = await prisma.htsClassification.findFirst({
    where: {
      orgId,
      description: { equals: d, mode: 'insensitive' },
      model: { notIn: ['none', 'cache'] },
      status: { in: ['ok', 'needs_detail', 'no_match'] },
      createdAt: { gte: new Date(Date.now() - REPEAT_WINDOW_MS) },
    },
    orderBy: { createdAt: 'desc' },
    select: { result: true },
  });
  return row ? (row.result as unknown as ClassifyResult) : null;
}

/** Logs a repeat answered from the audit table (free: model "cache"). */
export async function recordRepeat(who: Who, description: string, result: ClassifyResult): Promise<void> {
  await prisma.htsClassification.create({
    data: {
      orgId: who.orgId, userId: who.userId, description: description.trim(), status: auditStatus(result),
      result: result as object, model: 'cache', revision: result.revision ?? '', latencyMs: 0,
    },
  });
}
