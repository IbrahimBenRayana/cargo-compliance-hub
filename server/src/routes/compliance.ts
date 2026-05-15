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
import { lookupAddCvd, getAddCvdMeta } from '../services/compliance/addCvd.js';
import { lookupFtaForCountry, getFtaMeta } from '../services/compliance/fta.js';
import { ccClient } from '../services/customscity.js';
import { parseRejectionReason } from '../services/errorTranslator.js';
import { validateFiling } from '../services/validation.js';
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
    // computeLiquidation returns { entryDate, estimatedLiquidationAt, ... }
    // already, so we don't re-set entryDate ourselves — would shadow & confuse.
    const dates = computeLiquidation(f.acceptedAt!);
    return {
      filingId: f.id,
      bol: f.houseBol || f.masterBol || f.id.slice(0, 8),
      filingType: f.filingType,
      ...dates,
    };
  });

  res.json({
    total: tracked.length,
    tracked,
  });
});

// ─── GET /action-queue ───────────────────────────────────────────────
// The Compliance Center "Overview" hero is an inbox of actionable items
// ranked by urgency. This endpoint aggregates ALL sources of action a US
// importer should know about RIGHT NOW:
//
//   1. ISF deadline imminent  — filings due within 72h, not yet submitted
//   2. CBP rejection           — every currently-rejected filing
//   3. UFLPA high/elevated     — supply-chain risk to triage
//   4. PSC window closing      — accepted filings within 14d of PSC deadline
//   5. Liquidation soon        — accepted filings within 14d of liquidation
//   6. Bulk-fix opportunity    — N≥3 recent rejections sharing a root cause
//
// Each item has a stable `id` so the frontend can persist snooze/dismiss
// state in localStorage without server-side tables (kept lean for v1).

router.get('/action-queue', async (req: AuthRequest, res: Response): Promise<void> => {
  const orgId = req.user!.orgId;
  const now = Date.now();
  const DAY = 24 * 60 * 60 * 1000;

  // Pull every filing relevant to the action queue. Bounded to last 180d
  // since older filings rarely produce live actions.
  const window = new Date(now - 180 * DAY);
  const filings = await prisma.filing.findMany({
    where: { orgId, createdAt: { gte: window } },
    select: {
      id: true,
      filingType: true,
      status: true,
      masterBol: true,
      houseBol: true,
      createdAt: true,
      submittedAt: true,
      acceptedAt: true,
      rejectedAt: true,
      rejectionReason: true,
      estimatedDeparture: true,
      manufacturer: true,
      seller: true,
      buyer: true,
      shipToParty: true,
      consigneeAddress: true,
      commodities: true,
    },
    orderBy: { createdAt: 'desc' },
  });

  // Above-the-fold stats — these power the 3 quick stats next to the score.
  const awaitingCbp = filings.filter((f) => f.status === 'submitted').length;
  // "Issues" means: rejected, on-hold, or draft with deadline within 7d.
  const sevenDaysOut = new Date(now + 7 * DAY);
  const withIssues = filings.filter((f) =>
    f.status === 'rejected' ||
    f.status === 'on_hold' ||
    (f.status === 'draft' && f.estimatedDeparture && f.estimatedDeparture <= sevenDaysOut),
  ).length;

  // High-risk: every filing whose UFLPA assessment is 'high'. (Elevated is
  // surfaced inside Risk tab but not counted as headline urgency.)
  const highRiskFilings = filings.filter((f) => assessUflpaRisk(f as any).severity === 'high');
  const highRisk = highRiskFilings.length;

  // ── Build action items ────────────────────────────────────────────

  type ActionItem = {
    id: string;
    kind: 'deadline' | 'rejection' | 'uflpa' | 'psc' | 'liquidation' | 'bulk-fix' | 'draft_review';
    /** Current filing status — surfaced as a badge on the card. */
    status?: string;
    severity: 'critical' | 'high' | 'medium' | 'low';
    title: string;
    context: string;
    filingId?: string;
    bol?: string;
    /** ms-since-epoch — used to sort newest-first within severity bucket. */
    timestamp: number;
    /** When true the frontend pulses the dot to signal "new". */
    isNew: boolean;
    /** Per-filing compliance score 0–100 from validateFiling (rejected counts
     *  as 100% loss → score 0). null when the item isn't tied to a filing. */
    score: number | null;
    /** Best-effort origin info — used to enrich the row visually. */
    originCompany: string | null;
    originCountry: string | null;
    /** Suggested next-steps the UI can render as buttons. */
    actions: Array<{
      label: string;
      href?: string;
      kind?: 'open' | 'submit' | 'coach' | 'edit' | 'snooze';
    }>;
  };

  const items: ActionItem[] = [];
  const FIVE_MIN = 5 * 60 * 1000;

  // ── Per-filing enrichment helpers ─────────────────────────────────
  // Compute these once per filing so every action item referencing the
  // same filing gets the same metadata without redundant work.

  /**
   * Compliance score per filing (0–100) — represents DATA QUALITY,
   * independent of CBP's decision.
   *
   * Rationale: the previous "rejected → 0" shortcut made every rejected
   * filing look identical. But a rejection can happen for many reasons —
   * bond not on file, party identity mismatch, etc. — that have nothing
   * to do with the data the user entered. A rejected filing with clean
   * data should score high; a sloppy draft with 10 missing fields should
   * score low. Treating them with the same lens (validateFiling) lets the
   * user see "this rejection has clean data — the issue is external" vs
   * "this rejection has obvious data issues — fix those first."
   *
   * Weights:
   *   • Accepted / amended → 100 (CBP signed off)
   *   • All other statuses → validateFiling-based:
   *        100 − 8·critical − 2·warning − 0.5·info, clipped to [10, 100]
   *   • The reject STATUS is surfaced separately as a card badge, so the
   *     user always knows what CBP said.
   */
  function scoreFiling(f: typeof filings[number]): number {
    if (f.status === 'accepted' || f.status === 'amended') return 100;
    const r = validateFiling(f as any);
    if (r.errors.length === 0) return 100;
    const penalty = r.criticalCount * 8 + r.warningCount * 2 + r.infoCount * 0.5;
    return Math.max(10, Math.min(100, Math.round(100 - penalty)));
  }

  /** Pull the manufacturer name + country. Fallback to seller / first
   *  commodity origin so we always have *something* to show. */
  function originOf(f: typeof filings[number]): { company: string | null; country: string | null } {
    const partyName = (p: unknown): string | null => {
      if (!p || typeof p !== 'object') return null;
      const name = (p as Record<string, unknown>).name;
      return typeof name === 'string' && name.trim() ? name.trim() : null;
    };
    const partyCountry = (p: unknown): string | null => {
      if (!p || typeof p !== 'object') return null;
      const c = (p as Record<string, unknown>).country;
      return typeof c === 'string' && c.trim() ? c.trim().toUpperCase().slice(0, 2) : null;
    };
    const company = partyName(f.manufacturer) ?? partyName(f.seller);
    let country = partyCountry(f.manufacturer) ?? partyCountry(f.seller);
    if (!country && Array.isArray(f.commodities) && f.commodities.length > 0) {
      const co = (f.commodities[0] as Record<string, unknown>)?.countryOfOrigin;
      if (typeof co === 'string' && co.trim()) country = co.trim().toUpperCase().slice(0, 2);
    }
    return { company, country };
  }

  /** Per-filing cache so the same filing isn't enriched 3x when it has
   *  multiple action items pointing at it (e.g. UFLPA + deadline). */
  const enrichmentCache = new Map<string, { score: number; company: string | null; country: string | null }>();
  function enrich(f: typeof filings[number]) {
    const cached = enrichmentCache.get(f.id);
    if (cached) return cached;
    const { company, country } = originOf(f);
    const next = { score: scoreFiling(f), company, country };
    enrichmentCache.set(f.id, next);
    return next;
  }

  // 1. ISF deadlines — submitted-by clock is estimatedDeparture - 24h.
  //    Anything within 72h of that cutoff is an action item.
  for (const f of filings) {
    if (f.status !== 'draft') continue;
    if (!f.estimatedDeparture) continue;
    const cutoff = new Date(f.estimatedDeparture).getTime() - 24 * 60 * 60 * 1000;
    const hoursToCutoff = (cutoff - now) / (60 * 60 * 1000);
    if (hoursToCutoff < -24 || hoursToCutoff > 72) continue;
    const bol = f.houseBol || f.masterBol || f.id.slice(0, 8);
    const severity: ActionItem['severity'] =
      hoursToCutoff <= 24 ? 'critical' : hoursToCutoff <= 48 ? 'high' : 'medium';
    const en = enrich(f);
    items.push({
      id: `deadline:${f.id}`,
      kind: 'deadline',
      severity,
      title:
        hoursToCutoff <= 0
          ? `ISF deadline passed — ${bol}`
          : `ISF deadline in ${Math.round(hoursToCutoff)}h — ${bol}`,
      context: `Vessel departs ${new Date(f.estimatedDeparture).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}. Submit before cutoff to avoid CBP penalty.`,
      filingId: f.id,
      bol,
      timestamp: f.createdAt.getTime(),
      isNew: now - f.createdAt.getTime() < FIVE_MIN,
      score: en.score,
      status: f.status,
      originCompany: en.company,
      originCountry: en.country,
      actions: [
        { label: 'Open',     kind: 'open',  href: `/shipments/${f.id}` },
        { label: 'AI coach', kind: 'coach' },
      ],
    });
  }

  // 2. Currently-rejected filings — each is an action item.
  for (const f of filings) {
    if (f.status !== 'rejected') continue;
    const bol = f.houseBol || f.masterBol || f.id.slice(0, 8);
    const ts = f.rejectedAt?.getTime() ?? f.createdAt.getTime();
    const en = enrich(f);
    items.push({
      id: `rejection:${f.id}`,
      kind: 'rejection',
      severity: 'critical',
      title: `Rejected by CBP — ${bol}`,
      context: 'Edit the filing, fix the issues, and resubmit. The AI coach can explain what went wrong.',
      filingId: f.id,
      bol,
      timestamp: ts,
      isNew: now - ts < FIVE_MIN,
      score: en.score,
      status: f.status,
      originCompany: en.company,
      originCountry: en.country,
      actions: [
        { label: 'Open',     kind: 'open',  href: `/shipments/${f.id}` },
        { label: 'AI coach', kind: 'coach' },
      ],
    });
  }

  // 3. UFLPA risk — surface high-severity inflight filings.
  for (const f of highRiskFilings) {
    if (!['draft', 'submitted', 'pending_cbp', 'on_hold'].includes(f.status)) continue;
    const bol = f.houseBol || f.masterBol || f.id.slice(0, 8);
    const risk = assessUflpaRisk(f as any);
    const en = enrich(f);
    items.push({
      id: `uflpa:${f.id}`,
      kind: 'uflpa',
      severity: 'high',
      title: `High UFLPA risk — ${bol}`,
      context: risk.reasons[0] ?? 'Supply-chain documentation required before clearance.',
      filingId: f.id,
      bol,
      timestamp: f.createdAt.getTime(),
      isNew: false,
      score: en.score,
      status: f.status,
      originCompany: en.company,
      originCountry: en.country,
      actions: [
        { label: 'Open',     kind: 'open',  href: `/shipments/${f.id}` },
        { label: 'AI coach', kind: 'coach' },
      ],
    });
  }

  // 4. PSC deadlines — Post-Summary Correction windows about to close.
  //    Accepted/amended filings with PSC deadline ≤ 14 days away.
  for (const f of filings) {
    if (!['accepted', 'amended'].includes(f.status) || !f.acceptedAt) continue;
    const liq = computeLiquidation(f.acceptedAt);
    if (liq.status !== 'psc-window-open') continue;
    if (liq.daysUntilPscDeadline > 14) continue;
    const bol = f.houseBol || f.masterBol || f.id.slice(0, 8);
    const en = enrich(f);
    items.push({
      id: `psc:${f.id}`,
      kind: 'psc',
      severity: liq.daysUntilPscDeadline <= 7 ? 'high' : 'medium',
      title: `PSC window closes in ${liq.daysUntilPscDeadline}d — ${bol}`,
      context: 'File a Post-Summary Correction within the window, or accept the current duty assessment.',
      filingId: f.id,
      bol,
      timestamp: f.acceptedAt.getTime(),
      isNew: false,
      score: en.score,
      status: f.status,
      originCompany: en.company,
      originCountry: en.country,
      actions: [
        { label: 'Open', kind: 'open', href: `/shipments/${f.id}` },
      ],
    });
  }

  // 5. Liquidation imminent — entries whose 314-day liquidation is ≤14d.
  for (const f of filings) {
    if (!['accepted', 'amended'].includes(f.status) || !f.acceptedAt) continue;
    const liq = computeLiquidation(f.acceptedAt);
    if (liq.status !== 'awaiting-liquidation') continue;
    if (liq.daysUntilLiquidation > 14 || liq.daysUntilLiquidation < 0) continue;
    const bol = f.houseBol || f.masterBol || f.id.slice(0, 8);
    const en = enrich(f);
    items.push({
      id: `liquidation:${f.id}`,
      kind: 'liquidation',
      severity: 'medium',
      title: `Liquidation in ${liq.daysUntilLiquidation}d — ${bol}`,
      context: 'After liquidation you have 180 days to file a protest if the duty assessment is contested.',
      filingId: f.id,
      bol,
      timestamp: f.acceptedAt.getTime(),
      isNew: false,
      score: en.score,
      status: f.status,
      originCompany: en.company,
      originCountry: en.country,
      actions: [
        { label: 'Open', kind: 'open', href: `/shipments/${f.id}` },
      ],
    });
  }

  // 6. Bulk-fix detector — 3+ recent rejections sharing the same parsed
  //    rejection-summary string indicates the importer is making one
  //    repeating mistake. Surface as a single grouped item.
  const reasonGroups = new Map<string, string[]>();
  for (const f of filings) {
    if (f.status !== 'rejected' || !f.rejectionReason) continue;
    const parsed = parseRejectionReason(f.rejectionReason);
    const key =
      parsed.summary?.trim() ||
      parsed.errors[0]?.message?.trim() ||
      parsed.fallbackRaw?.trim();
    if (!key) continue;
    const truncated = key.length > 60 ? key.slice(0, 57) + '…' : key;
    if (!reasonGroups.has(truncated)) reasonGroups.set(truncated, []);
    reasonGroups.get(truncated)!.push(f.id);
  }
  for (const [reason, filingIds] of reasonGroups.entries()) {
    if (filingIds.length < 3) continue;
    items.push({
      id: `bulk-fix:${Buffer.from(reason).toString('base64').slice(0, 16)}`,
      kind: 'bulk-fix',
      severity: 'high',
      title: `${filingIds.length} filings share the same rejection`,
      context: `"${reason}" — fix once, apply to ${filingIds.length} filings.`,
      timestamp: now,
      isNew: false,
      score: null,            // bulk-fix isn't a single filing
      status: undefined,
      originCompany: null,
      originCountry: null,
      actions: [
        { label: 'View affected', kind: 'open', href: `/shipments?status=rejected` },
      ],
    });
  }

  // 7. Draft review — surface EVERY draft that doesn't already appear in
  //    the queue via a higher-priority kind (deadline / uflpa / etc.).
  //    Severity ladder: critical if data-quality score <50, high if <75,
  //    medium otherwise — so the user sees high-issue drafts near the
  //    top and tidy-ish drafts further down.
  const alreadyQueued = new Set(items.filter((i) => i.filingId).map((i) => i.filingId!));
  for (const f of filings) {
    if (f.status !== 'draft') continue;
    if (alreadyQueued.has(f.id)) continue;
    const en = enrich(f);
    const bol = f.houseBol || f.masterBol || f.id.slice(0, 8);
    const severity: ActionItem['severity'] =
      en.score < 50 ? 'critical' : en.score < 75 ? 'high' : 'medium';
    items.push({
      id: `draft:${f.id}`,
      kind: 'draft_review',
      severity,
      title: `Draft — ${bol}`,
      context:
        en.score < 50
          ? 'Many required fields are missing. Open to continue editing.'
          : en.score < 75
          ? 'In progress — a few fields still need attention before submit.'
          : 'Looking clean. Run the AI pre-flight before submitting.',
      filingId: f.id,
      bol,
      timestamp: f.createdAt.getTime(),
      isNew: now - f.createdAt.getTime() < FIVE_MIN,
      score: en.score,
      status: f.status,
      originCompany: en.company,
      originCountry: en.country,
      actions: [
        { label: 'Open',     kind: 'open',  href: `/shipments/${f.id}` },
        { label: 'AI coach', kind: 'coach' },
      ],
    });
  }

  // Sort: critical → high → medium → low; within bucket, newest first.
  const SEV_ORDER: Record<ActionItem['severity'], number> = { critical: 0, high: 1, medium: 2, low: 3 };
  items.sort((a, b) => {
    const c = SEV_ORDER[a.severity] - SEV_ORDER[b.severity];
    if (c !== 0) return c;
    return b.timestamp - a.timestamp;
  });

  // ── Score ─────────────────────────────────────────────────────────
  // Simple: (1 - rejected/total) * 100, clipped. Returns null if no data.
  const totalRecent = filings.length;
  const rejectedRecent = filings.filter((f) => f.status === 'rejected').length;
  const score = totalRecent > 0 ? Math.round(((totalRecent - rejectedRecent) / totalRecent) * 100) : null;

  res.json({
    score,
    stats: {
      awaitingCbp,
      withIssues,
      highRisk,
    },
    actionQueue: items,
    counts: {
      total: items.length,
      critical: items.filter((i) => i.severity === 'critical').length,
      high:     items.filter((i) => i.severity === 'high').length,
      medium:   items.filter((i) => i.severity === 'medium').length,
    },
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

// ─── POST /draft-review (SSE) ────────────────────────────────────────
// AI pre-flight review for in-flight filings (draft / submitted / on_hold).
// Pulls the filing, runs the deterministic rule-based validator + UFLPA
// risk + PGA lookups (cheap, signal-rich) and feeds ALL of it to GPT-4o
// so the model can prioritise + explain in plain English. Output is the
// same SSE shape as /rejection-coach so the frontend reuses one drawer.

const draftReviewSchema = z.object({ filingId: z.string().uuid() });

router.post('/draft-review', authLimiter, async (req: AuthRequest, res: Response): Promise<void> => {
  const parsed = draftReviewSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'filingId required' });
    return;
  }

  const filing = await prisma.filing.findFirst({
    where: { id: parsed.data.filingId, orgId: req.user!.orgId },
  });
  if (!filing) {
    res.status(404).json({ error: 'Filing not found' });
    return;
  }
  // Only meaningful for in-flight filings. Accepted/rejected/cancelled go
  // through the rejection-coach (or have no review value).
  const inFlight: ReadonlySet<string> = new Set(['draft', 'submitted', 'pending_cbp', 'on_hold']);
  if (!inFlight.has(filing.status)) {
    res.status(400).json({
      error: 'AI pre-flight review is only available for draft, submitted, or on-hold filings.',
    });
    return;
  }

  if (!ai.isConfigured()) {
    res.status(503).json({ error: 'AI features are not configured.', code: 'ai_unavailable' });
    return;
  }

  // Build the analytical context. We deliberately give the model both the
  // raw filing fields AND the rule-based validator's structured output —
  // the latter is what makes responses actionable (not just "the field is
  // empty" but "field X is required for ISF-10 because $reason").
  const ruleResult = validateFiling(filing as any);
  const uflpaRisk = assessUflpaRisk(filing as any);
  const commodities = (filing.commodities as any[] | null | undefined) ?? [];
  const pgaPerCommodity = commodities.slice(0, 8).map((c: any) => ({
    hts:   c?.htsCode ?? null,
    description: c?.description ?? null,
    origin: c?.countryOfOrigin ?? null,
    pga:   c?.htsCode ? lookupPgaFlags(c.htsCode) : [],
  }));

  // Sanitised view of the filing we send to the model — strip ids, refresh
  // tokens, encrypted fields. Anything that wouldn't pass a SOC-2 review.
  const sanitised: Record<string, unknown> = {
    filingType: filing.filingType,
    status:     filing.status,
    masterBol:  filing.masterBol,
    houseBol:   filing.houseBol,
    bondType:   filing.bondType,
    scacCode:   filing.scacCode,
    vesselName: filing.vesselName,
    voyageNumber: filing.voyageNumber,
    foreignPortOfUnlading: filing.foreignPortOfUnlading,
    placeOfDelivery:       filing.placeOfDelivery,
    estimatedDeparture:    filing.estimatedDeparture,
    estimatedArrival:      filing.estimatedArrival,
    importerName:   filing.importerName,
    importerNumber: filing.importerNumber,
    consigneeName:  filing.consigneeName,
    consigneeNumber: filing.consigneeNumber,
    consigneeAddress: filing.consigneeAddress,
    manufacturer:   filing.manufacturer,
    seller:         filing.seller,
    buyer:          filing.buyer,
    shipToParty:    filing.shipToParty,
    consolidator:   filing.consolidator,
    containerStuffingLocation: filing.containerStuffingLocation,
    commodities,
    containers:     filing.containers,
  };

  const userPrompt = `
You are pre-flighting a US customs filing for an importer before they submit it to CBP. Your job is to spot problems they can fix NOW, so the filing doesn't get rejected.

═══ FILING DATA ═══
${JSON.stringify(sanitised, null, 2)}

═══ DETERMINISTIC RULE-BASED ISSUES (from validator) ═══
Score: ${ruleResult.score}/100
Critical: ${ruleResult.criticalCount} | Warning: ${ruleResult.warningCount} | Info: ${ruleResult.infoCount}

${ruleResult.errors.length > 0
    ? ruleResult.errors
        .map((e, i) => `${i + 1}. [${e.severity}] ${e.field}: ${e.message}`)
        .join('\n')
    : 'No rule-based issues detected.'}

═══ UFLPA RISK ═══
Severity: ${uflpaRisk.severity}
Reasons: ${uflpaRisk.reasons.join('; ') || 'none'}

═══ PGA FLAGS PER COMMODITY ═══
${pgaPerCommodity
    .map((c) =>
      `HTS ${c.hts ?? '—'} (${c.description ?? '—'}, origin ${c.origin ?? '—'}): ${
        c.pga.length === 0 ? 'no PGA flag' : c.pga.map((p) => `${p.agency} — ${p.action}`).join('; ')
      }`,
    )
    .join('\n')}

═══ YOUR OUTPUT ═══
Format your response in markdown with these sections (skip a section if it has nothing to say):

**1. Will-reject issues** — anything CBP will almost certainly bounce. Map to rule-based critical errors first, then add anything else you spot.

**2. Likely-to-reject risks** — things that often trip CBP but aren't deterministic (origin/party mismatches, HTS that's been recently scrutinized, PGA flags missing required certs, etc.).

**3. Improvements** — fields that are valid but suboptimal (vague descriptions, missing optional but-helpful fields, descriptions that could be more specific).

**4. UFLPA / forced labor exposure** — if the UFLPA assessment is elevated or high, name the supply chain docs the importer should compile BEFORE the filing leaves port.

**5. PGA action items** — for each flagged commodity, what permit/notice the importer needs.

Be concrete and brief. Refer to the filing's actual values when relevant ("Master BOL 'MAEU…' looks like an SCAC-prefix" not "your BOL"). Use numbered or bulleted lists, not paragraphs.
  `.trim();

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
        'You are a senior US customs compliance specialist who has spent 20 years filing ISFs and ABI entries. You read draft filings like a CBP officer would — looking for the patterns that get filings rejected or delayed. Your guidance is tight, no-fluff, and immediately actionable.',
      userPrompt,
      maxTokens: 3000,  // bump above default — pre-flight reviews are longer
    });
    for await (const chunk of chunks) {
      res.write(`data: ${JSON.stringify({ delta: chunk })}\n\n`);
    }
    res.write('event: done\ndata: {}\n\n');
  } catch (err: any) {
    logger.error({ err: err.message, filingId: filing.id }, '[Compliance] draft-review stream failed');
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

// ─── Classification tab endpoints ────────────────────────────────────

// POST /classify-hts — standalone HTS classifier wrapper around CC's
// /api/ht-classification. Takes a free-text product description, returns
// the best HTS match + alternative suggestions + GRI-style explanation.
const classifyHtsSchema = z.object({
  description: z.string().min(3).max(500),
});

router.post('/classify-hts', authLimiter, async (req: AuthRequest, res: Response): Promise<void> => {
  const parsed = classifyHtsSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Description must be 3-500 characters' });
    return;
  }
  try {
    const result = await ccClient.classifyHTS(parsed.data.description.trim());
    const raw = result.data as any;
    const item = raw?.items?.[0];
    if (!item) {
      res.json({ matched: false, message: 'No classification returned. Try a more specific description.' });
      return;
    }
    // Coherence check — CC flags vague inputs.
    const coherence = item?.classifierResponse?.coherence_validation;
    if (coherence && !coherence.is_coherent) {
      res.json({
        matched: false,
        message: coherence.explanation || 'Description too vague — add material, function, or industry context.',
      });
      return;
    }
    // Primary recommendation.
    const cr = item.classifierResponse ?? {};
    const primaryHts: string | null = cr.selected_hts ?? item.classification?.hts ?? null;
    const explanation: string | null = cr.explanation ?? null;
    const alternatives: Array<{ hts: string; description: string }> =
      Array.isArray(cr.hts_review_result?.recomendations)
        ? cr.hts_review_result.recomendations
            .filter((r: any) => r?.hts && r?.description)
            .map((r: any) => ({ hts: String(r.hts), description: String(r.description) }))
        : [];
    res.json({
      matched: !!primaryHts,
      primary: primaryHts
        ? { hts: primaryHts, description: item.classification?.name ?? item.description ?? '' }
        : null,
      explanation,
      alternatives,
    });
  } catch (err: any) {
    logger.error({ err: err?.message }, '[Compliance] classify-hts failed');
    res.status(502).json({ error: 'Classifier upstream failed. Please try again.' });
  }
});

// GET /add-cvd-lookup?q=...  — seed-data lookup of active Commerce orders.
const addCvdQuery = z.object({ q: z.string().min(1).max(100) });

router.get('/add-cvd-lookup', (req: AuthRequest, res: Response): void => {
  const parsed = addCvdQuery.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: 'Query parameter `q` required (HTS, country, or text)' });
    return;
  }
  const orders = lookupAddCvd(parsed.data.q);
  res.json({
    query: parsed.data.q,
    matched: orders.length > 0,
    orders,
    source: getAddCvdMeta(),
  });
});

// GET /fta-preference?country=XX — programs that include the country
// (step 1 of eligibility; rules-of-origin is on the importer).
const ftaQuery = z.object({ country: z.string().min(2).max(2) });

router.get('/fta-preference', (req: AuthRequest, res: Response): void => {
  const parsed = ftaQuery.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: 'Query parameter `country` required (ISO-2 code)' });
    return;
  }
  const programs = lookupFtaForCountry(parsed.data.country);
  res.json({
    country: parsed.data.country.toUpperCase(),
    matched: programs.length > 0,
    programs,
    source: getFtaMeta(),
  });
});

// ─── GET /health-narrative ───────────────────────────────────────────
// One-sentence AI summary of the org's current compliance state. Used at
// the top of the Compliance Center as a "morning brief" — lead with the
// most urgent thing the user should know about. Cached per-org for 5min
// to keep AI spend bounded; falls back to a rule-based line when AI is
// disabled.

interface NarrativeSignals {
  drafts:           number;
  rejected:         number;
  uflpaHigh:        number;
  uflpaElevated:    number;
  pscClosingSoon:   number;
  liquidatingSoon:  number;
  awaitingCbp:      number;
}

const narrativeCache = new Map<string, { narrative: string; model: string | null; signals: NarrativeSignals; generatedAt: number }>();
const NARRATIVE_TTL_MS = 5 * 60_000;

function ruleBasedNarrative(s: NarrativeSignals): string {
  // Severity-ordered fallback so we still ship a useful line when AI is off.
  if (s.rejected > 0) {
    return `${s.rejected} filing${s.rejected === 1 ? '' : 's'} rejected by CBP — open the action queue to start corrections.`;
  }
  if (s.uflpaHigh > 0) {
    return `${s.uflpaHigh} high-risk UFLPA filing${s.uflpaHigh === 1 ? '' : 's'} needs evidence of origin before clearance.`;
  }
  if (s.pscClosingSoon > 0) {
    return `${s.pscClosingSoon} PSC deadline${s.pscClosingSoon === 1 ? '' : 's'} closing within 14 days — file corrections soon.`;
  }
  if (s.drafts > 0) {
    return `${s.drafts} draft${s.drafts === 1 ? '' : 's'} waiting on you. Run an AI pre-flight check before submitting.`;
  }
  if (s.uflpaElevated > 0) {
    return `${s.uflpaElevated} filing${s.uflpaElevated === 1 ? '' : 's'} flagged as UFLPA-elevated — worth a quick review.`;
  }
  if (s.liquidatingSoon > 0) {
    return `${s.liquidatingSoon} entr${s.liquidatingSoon === 1 ? 'y is' : 'ies are'} liquidating within 14 days — confirm duties paid.`;
  }
  if (s.awaitingCbp > 0) {
    return `${s.awaitingCbp} filing${s.awaitingCbp === 1 ? '' : 's'} submitted and awaiting CBP response — nothing else needs you right now.`;
  }
  return 'Inbox is clear — no rejections, no UFLPA hits, no deadlines closing this week.';
}

router.get('/health-narrative', async (req: AuthRequest, res: Response): Promise<void> => {
  const orgId = req.user!.orgId;
  const userId = req.user!.id;

  // Serve cached narrative if fresh.
  const cached = narrativeCache.get(orgId);
  if (cached && Date.now() - cached.generatedAt < NARRATIVE_TTL_MS) {
    res.json({
      narrative:   cached.narrative,
      model:       cached.model,
      signals:     cached.signals,
      generatedAt: new Date(cached.generatedAt).toISOString(),
      cached:      true,
    });
    return;
  }

  const DAY = 24 * 60 * 60 * 1000;
  const now = Date.now();
  const window180 = new Date(now - 180 * DAY);

  // Pull the same data the dashboard sees so the narrative matches what
  // the user is staring at. Bounded to 180 days.
  const filings = await prisma.filing.findMany({
    where: { orgId, createdAt: { gte: window180 } },
    select: {
      id: true,
      filingType: true,
      status: true,
      submittedAt: true,
      acceptedAt: true,
      masterBol: true,
      houseBol: true,
      manufacturer: true,
      seller: true,
      shipToParty: true,
      buyer: true,
      consigneeAddress: true,
      commodities: true,
    },
  });

  let drafts = 0, rejected = 0, awaitingCbp = 0;
  let uflpaHigh = 0, uflpaElevated = 0;
  let pscClosingSoon = 0, liquidatingSoon = 0;
  for (const f of filings) {
    if (f.status === 'draft') drafts++;
    else if (f.status === 'rejected') rejected++;
    else if (f.status === 'submitted' || f.status === 'on_hold') awaitingCbp++;

    const risk = assessUflpaRisk(f as any);
    if (risk.severity === 'high') uflpaHigh++;
    else if (risk.severity === 'elevated') uflpaElevated++;

    if (f.status === 'accepted' && f.acceptedAt) {
      const liq = computeLiquidation(new Date(f.acceptedAt));
      if (liq.daysUntilPscDeadline >= 0 && liq.daysUntilPscDeadline <= 14) pscClosingSoon++;
      if (liq.daysUntilLiquidation >= 0 && liq.daysUntilLiquidation <= 14) liquidatingSoon++;
    }
  }

  const signals: NarrativeSignals = {
    drafts, rejected, uflpaHigh, uflpaElevated, pscClosingSoon, liquidatingSoon, awaitingCbp,
  };

  // Try AI; fall back to rule-based on any failure or when disabled.
  let narrative = ruleBasedNarrative(signals);
  let model: string | null = null;
  const aiStatus = ai.getStatus(userId);
  if (aiStatus.enabled) {
    try {
      const completion = await ai.complete({
        userId,
        systemPrompt:
          'You are a calm, senior US customs-broker assistant. Given today\'s compliance signals, write EXACTLY ONE sentence (≤ 140 characters) summarising the importer\'s state. Lead with the most urgent thing. Plain English, no jargon, no emojis, no markdown. If nothing is urgent, say so honestly. Never invent numbers — use only the signals provided.',
        userPrompt:
          `Signals (all integers):\n` +
          `- drafts awaiting submission: ${drafts}\n` +
          `- filings rejected by CBP: ${rejected}\n` +
          `- UFLPA high-risk filings: ${uflpaHigh}\n` +
          `- UFLPA elevated filings: ${uflpaElevated}\n` +
          `- accepted entries with PSC window closing in ≤14 days: ${pscClosingSoon}\n` +
          `- accepted entries liquidating in ≤14 days: ${liquidatingSoon}\n` +
          `- submitted filings awaiting CBP response: ${awaitingCbp}\n\n` +
          `Write the one-sentence summary now.`,
        temperature: 0.3,
        maxTokens: 80,
      });
      const cleaned = completion.trim().replace(/^["']|["']$/g, '').replace(/\s+/g, ' ');
      if (cleaned && cleaned.length <= 200) {
        narrative = cleaned;
        model = aiStatus.model ?? null;
      }
    } catch (err) {
      logger.warn({ err, orgId }, '[health-narrative] AI generation failed, using rule-based fallback');
    }
  }

  narrativeCache.set(orgId, { narrative, model, signals, generatedAt: now });
  res.json({
    narrative,
    model,
    signals,
    generatedAt: new Date(now).toISOString(),
    cached: false,
  });
});

export default router;
