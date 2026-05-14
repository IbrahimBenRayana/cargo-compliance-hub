/**
 * Compliance Center routes.
 *
 *   GET  /ai-status                  → is AI configured + per-user usage?
 *   GET  /health-summary             → aggregate score, trends, top issues
 *   GET  /risk/uflpa                 → UFLPA exposure across recent filings
 *   GET  /pga-lookup?hts=...         → PGA agencies that flag this HTS
 *   GET  /liquidation-tracker        → entries with days-until-liquidation
 *   POST /rejection-coach (SSE)      → AI-explained rejection + fix steps
 *
 * Every endpoint goes through authMiddleware (org-scoped) — verifyEmailed
 * is NOT required for these because they're read-mostly and supportive.
 * The AI rejection coach uses authLimiter to throttle per-IP independent
 * of the per-user daily AI cap.
 */

import { Router, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../config/database.js';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';
import { authLimiter } from '../middleware/rateLimiter.js';
import * as ai from '../services/ai.js';
import { lookupPgaFlags, lookupMetadata as pgaMeta } from '../services/compliance/pgaFlags.js';
import { assessUflpaRisk } from '../services/compliance/uflpa.js';
import { computeLiquidation } from '../services/compliance/liquidation.js';
import { parseRejectionReason } from '../services/errorTranslator.js';
import logger from '../config/logger.js';

const router = Router();
router.use(authMiddleware);

// ─── GET /ai-status ──────────────────────────────────────────────────
router.get('/ai-status', (req: AuthRequest, res: Response): void => {
  res.json(ai.getStatus(req.user!.id));
});

// ─── GET /health-summary ─────────────────────────────────────────────
// Aggregates the org's filings into the numbers the Health tab shows:
//  - score (mean of recent validation scores; we estimate from rejection rate
//    when fresh validation isn't run)
//  - rejection trend bucketed by week for the last 90 days
//  - top 5 rejection-reason summaries (extracted via parseRejectionReason)
//  - deadline adherence rate (filings submitted before estimatedDeparture)

router.get('/health-summary', async (req: AuthRequest, res: Response): Promise<void> => {
  const orgId = req.user!.orgId;
  const NINETY_DAYS = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);

  const [recent, accepted, rejected, allCount] = await Promise.all([
    prisma.filing.findMany({
      where: { orgId, createdAt: { gte: NINETY_DAYS } },
      select: {
        id: true,
        status: true,
        rejectionReason: true,
        createdAt: true,
        submittedAt: true,
        rejectedAt: true,
        estimatedDeparture: true,
      },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.filing.count({ where: { orgId, status: 'accepted' } }),
    prisma.filing.count({ where: { orgId, status: 'rejected' } }),
    prisma.filing.count({ where: { orgId } }),
  ]);

  // Weekly buckets for the trend chart — 13 weeks back, label by week-start date.
  const weeks: Array<{ weekStart: string; total: number; rejected: number }> = [];
  const now = new Date();
  for (let i = 12; i >= 0; i--) {
    const weekStart = new Date(now.getTime() - (i * 7 + (now.getUTCDay())) * 24 * 60 * 60 * 1000);
    weekStart.setUTCHours(0, 0, 0, 0);
    weeks.push({
      weekStart: weekStart.toISOString().slice(0, 10),
      total: 0,
      rejected: 0,
    });
  }
  for (const f of recent) {
    const wIdx = weeks.findIndex(
      (w, i) =>
        f.createdAt.getTime() >= new Date(w.weekStart).getTime() &&
        (i === weeks.length - 1 || f.createdAt.getTime() < new Date(weeks[i + 1]!.weekStart).getTime()),
    );
    if (wIdx >= 0) {
      weeks[wIdx]!.total++;
      if (f.status === 'rejected' || f.rejectedAt) weeks[wIdx]!.rejected++;
    }
  }

  // Top 5 rejection reason "buckets" — parse each rejectionReason and pull
  // the canonical summary or first error message. Group by exact string.
  const reasonCounts = new Map<string, number>();
  for (const f of recent) {
    if (!f.rejectionReason) continue;
    const parsed = parseRejectionReason(f.rejectionReason);
    const key =
      parsed.summary?.trim() ||
      parsed.errors[0]?.message?.trim() ||
      parsed.fallbackRaw?.trim() ||
      'Unknown rejection reason';
    const truncated = key.length > 80 ? key.slice(0, 77) + '…' : key;
    reasonCounts.set(truncated, (reasonCounts.get(truncated) ?? 0) + 1);
  }
  const topReasons = Array.from(reasonCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([reason, count]) => ({ reason, count }));

  // Deadline adherence: of filings that have both submittedAt and
  // estimatedDeparture set, how many were submitted before the 24h mark.
  let onTime = 0;
  let trackable = 0;
  for (const f of recent) {
    if (!f.submittedAt || !f.estimatedDeparture) continue;
    trackable++;
    const cutoff = new Date(new Date(f.estimatedDeparture).getTime() - 24 * 60 * 60 * 1000);
    if (f.submittedAt.getTime() <= cutoff.getTime()) onTime++;
  }
  const deadlineAdherence = trackable > 0 ? Math.round((onTime / trackable) * 100) : null;

  // Score: simple proxy — % of recent filings NOT rejected.
  const rejectedRecent = recent.filter((f) => f.status === 'rejected').length;
  const score =
    recent.length > 0 ? Math.round(((recent.length - rejectedRecent) / recent.length) * 100) : null;

  res.json({
    score,
    totals: { all: allCount, accepted, rejected },
    weeklyTrend: weeks,
    topReasons,
    deadlineAdherence: { rate: deadlineAdherence, onTime, trackable },
    recentRejectedFilings: recent
      .filter((f) => f.status === 'rejected')
      .slice(0, 5)
      .map((f) => ({ id: f.id, rejectedAt: f.rejectedAt })),
  });
});

// ─── GET /risk/uflpa ─────────────────────────────────────────────────
// Scans the org's last 90 days of filings, runs UFLPA assessor, returns
// a sorted list by severity. The UI groups by severity and renders.

router.get('/risk/uflpa', async (req: AuthRequest, res: Response): Promise<void> => {
  const orgId = req.user!.orgId;
  const NINETY_DAYS = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);

  const filings = await prisma.filing.findMany({
    where: { orgId, createdAt: { gte: NINETY_DAYS } },
    select: {
      id: true,
      masterBol: true,
      houseBol: true,
      status: true,
      createdAt: true,
      manufacturer: true,
      seller: true,
      shipToParty: true,
      buyer: true,
      consigneeAddress: true,
      commodities: true,
    },
    orderBy: { createdAt: 'desc' },
  });

  const results = filings.map((f) => {
    const risk = assessUflpaRisk(f as any);
    return {
      filingId: f.id,
      bol: f.houseBol || f.masterBol || f.id.slice(0, 8),
      status: f.status,
      createdAt: f.createdAt,
      risk,
    };
  });

  const counts = {
    high: results.filter((r) => r.risk.severity === 'high').length,
    elevated: results.filter((r) => r.risk.severity === 'elevated').length,
    low: results.filter((r) => r.risk.severity === 'low').length,
  };

  res.json({
    scanned: results.length,
    counts,
    flagged: results.filter((r) => r.risk.severity !== 'low').sort((a, b) =>
      a.risk.severity === 'high' && b.risk.severity !== 'high' ? -1
      : b.risk.severity === 'high' && a.risk.severity !== 'high' ? 1
      : 0,
    ),
  });
});

// ─── GET /pga-lookup?hts=... ─────────────────────────────────────────
const pgaQuerySchema = z.object({ hts: z.string().min(2).max(20) });

router.get('/pga-lookup', (req: AuthRequest, res: Response): void => {
  const parsed = pgaQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid HTS code', details: parsed.error.flatten() });
    return;
  }
  const flags = lookupPgaFlags(parsed.data.hts);
  res.json({
    hts: parsed.data.hts,
    flags,
    matched: flags.length > 0,
    source: pgaMeta(),
  });
});

// ─── GET /liquidation-tracker ────────────────────────────────────────
// All accepted filings + their liquidation/PSC dates. Frontend turns into
// a calendar / countdown table.

router.get('/liquidation-tracker', async (req: AuthRequest, res: Response): Promise<void> => {
  const orgId = req.user!.orgId;
  const filings = await prisma.filing.findMany({
    where: {
      orgId,
      status: { in: ['accepted', 'amended'] },
      acceptedAt: { not: null },
    },
    select: {
      id: true,
      masterBol: true,
      houseBol: true,
      acceptedAt: true,
      filingType: true,
    },
    orderBy: { acceptedAt: 'desc' },
    take: 200,
  });

  const tracked = filings.map((f) => {
    const dates = computeLiquidation(f.acceptedAt!);
    return {
      filingId: f.id,
      bol: f.houseBol || f.masterBol || f.id.slice(0, 8),
      filingType: f.filingType,
      entryDate: f.acceptedAt,
      ...dates,
    };
  });

  res.json({
    total: tracked.length,
    tracked,
  });
});

// ─── POST /rejection-coach (SSE) ─────────────────────────────────────
// Streams an AI explanation + numbered fix steps for a rejected filing.
// On the wire: `data: <chunk>\n\n` per token, ending with `event: done\n\n`.

const coachSchema = z.object({ filingId: z.string().uuid() });

router.post('/rejection-coach', authLimiter, async (req: AuthRequest, res: Response): Promise<void> => {
  const parsed = coachSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'filingId required' });
    return;
  }

  // Verify ownership + load the filing.
  const filing = await prisma.filing.findFirst({
    where: { id: parsed.data.filingId, orgId: req.user!.orgId },
    select: {
      id: true,
      filingType: true,
      status: true,
      masterBol: true,
      houseBol: true,
      rejectionReason: true,
      commodities: true,
      consigneeName: true,
      manufacturer: true,
      seller: true,
    },
  });
  if (!filing) {
    res.status(404).json({ error: 'Filing not found' });
    return;
  }
  if (!filing.rejectionReason) {
    res.status(400).json({ error: 'This filing has no rejection on record.' });
    return;
  }

  if (!ai.isConfigured()) {
    res.status(503).json({ error: 'AI features are not configured.', code: 'ai_unavailable' });
    return;
  }

  // Build the prompts. We pass the structured rejection (not the raw JSON)
  // so the model gets clean context.
  const parsedRejection = parseRejectionReason(filing.rejectionReason);
  const rejectionBlock =
    parsedRejection.errors.length > 0
      ? parsedRejection.errors
          .map((e, i) => `${i + 1}. [${e.severity}] ${e.fieldLabel}: ${e.message}${e.fix ? ` — Fix hint: ${e.fix}` : ''}`)
          .join('\n')
      : parsedRejection.fallbackRaw ?? filing.rejectionReason;

  const commoditiesSummary = (filing.commodities as any[] | null | undefined)
    ?.slice(0, 5)
    ?.map((c: any) => `${c.htsCode ?? '—'} ${c.description ?? '—'} (origin: ${c.countryOfOrigin ?? '—'})`)
    ?.join('; ');

  const userPrompt = `
A US customs filing was rejected by CBP. Help the importer understand why and what to do.

Filing context:
  • Type: ${filing.filingType}
  • Master BOL: ${filing.masterBol ?? '—'}
  • House BOL:  ${filing.houseBol ?? '—'}
  • Consignee:  ${filing.consigneeName ?? '—'}
  • Manufacturer: ${(filing.manufacturer as any)?.name ?? '—'}
  • Commodities: ${commoditiesSummary ?? '—'}

Rejection details from CBP:
${rejectionBlock}

Your job:
1. Explain in plain English (no jargon unless you define it inline) what went wrong. Be specific about the root cause, not just the symptom.
2. Give 2-4 numbered, immediately-actionable fix steps. Be concrete: "Change X from A to B" beats "verify the value."
3. If a specific CBP regulation, 19 CFR section, or HTS rule is relevant, cite it briefly.
4. Total response: 200 words max.

Do NOT include any preamble ("Sure, I can help!"), AI disclaimer, or fluff. Start directly with the explanation.
  `.trim();

  // Set up SSE.
  res.set({
    'Content-Type':      'text/event-stream',
    'Cache-Control':     'no-cache, no-transform',
    'Connection':        'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  res.flushHeaders();

  try {
    const chunks = ai.stream({
      userId: req.user!.id,
      systemPrompt:
        'You are a senior US customs compliance specialist who has spent 20 years filing ISFs and ABI entries. You write tight, no-fluff guidance that a non-expert importer can act on immediately.',
      userPrompt,
    });
    for await (const chunk of chunks) {
      // SSE: encode newlines as `data: ` continuations.
      res.write(`data: ${JSON.stringify({ delta: chunk })}\n\n`);
    }
    res.write('event: done\ndata: {}\n\n');
  } catch (err: any) {
    logger.error({ err: err.message }, '[Compliance] rejection-coach stream failed');
    if (err?.code === 'ai_rate_limited') {
      res.write(`event: error\ndata: ${JSON.stringify({
        error: err.message,
        code: 'ai_rate_limited',
        callsToday: err.callsToday,
        dailyLimit: err.dailyLimit,
      })}\n\n`);
    } else {
      res.write(`event: error\ndata: ${JSON.stringify({
        error: 'AI request failed. Please try again in a moment.',
        code: 'ai_error',
      })}\n\n`);
    }
  } finally {
    res.end();
  }
});

export default router;
