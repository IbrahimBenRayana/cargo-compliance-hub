import { Router, Request, Response } from 'express';
import { z } from 'zod';
import jwt from 'jsonwebtoken';
import { prisma } from '../config/database.js';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';
import { inAppOptedOutKinds } from '../services/notifications.js';
import { registerStreamClient } from '../services/notificationStream.js';
import { env } from '../config/env.js';

const router = Router();

// ─── GET /api/v1/notifications/stream (SSE) ────────────────
// Real-time push channel for the bell. EventSource can't send custom
// headers, so the access token is taken from the ?token= query param.
// Token TTL is short (15m today) so the URL appearing in access logs
// has limited blast radius; HTTPS is enforced in prod.
//
// We deliberately do NOT use the global authMiddleware for this route
// (it requires the Authorization header). The check is inlined below.
//
// IMPORTANT: this handler must be registered BEFORE `router.use(authMiddleware)`
// or the middleware will reject the request before we can read the query.
router.get('/stream', async (req: Request, res: Response): Promise<void> => {
  const token = (req.query.token as string | undefined)?.trim();
  if (!token) {
    res.status(401).json({ error: 'Missing stream token' });
    return;
  }

  let userId: string;
  try {
    const decoded = jwt.verify(token, env.JWT_ACCESS_SECRET) as { sub: string };
    userId = decoded.sub;
  } catch {
    res.status(401).json({ error: 'Invalid or expired stream token' });
    return;
  }

  // SSE headers. The "X-Accel-Buffering: no" hint is for nginx — without
  // it, nginx buffers the response and events arrive in batches.
  res.set({
    'Content-Type':      'text/event-stream',
    'Cache-Control':     'no-cache, no-transform',
    'Connection':        'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  res.flushHeaders();

  // Open the stream with a comment so the client knows we're connected.
  res.write(`: connected\n\n`);

  // Heartbeat every 25s to keep idle proxies from closing the connection.
  // SSE comments (lines starting with ":") are ignored by EventSource.
  const heartbeat = setInterval(() => {
    try { res.write(`: heartbeat\n\n`); } catch { /* connection gone */ }
  }, 25_000);

  const unregister = registerStreamClient(userId, res);

  const close = () => {
    clearInterval(heartbeat);
    unregister();
    try { res.end(); } catch { /* already ended */ }
  };
  req.on('close', close);
  req.on('error', close);
});

router.use(authMiddleware);

// ─── Notification kinds known to the UI (drives the Settings matrix) ─
// Keep this list aligned with SEVERITY_BY_KIND in services/notifications.ts.
// Adding a kind here that the dispatcher doesn't know is harmless;
// adding a kind to the dispatcher but not here just means it won't
// appear as an opt-out row in Settings (the user implicitly stays
// subscribed, which is the correct default).
const KNOWN_KINDS = [
  'filing_submitted',
  'filing_accepted',
  'filing_rejected',
  'filing_amended',
  'filing_cancelled',
  'filing_on_hold',
  'filing_stale',
  'deadline_warning',
  'deadline_overdue',
  'entry_submitted',
  'entry_accepted',
  'entry_rejected',
  'manifest_query_complete',
  'manifest_query_failed',
  'billing_subscription_changed',
  'billing_subscription_canceled',
  'billing_payment_failed',
  'team_member_joined',
  'api_error',
] as const;

// ─── GET /api/v1/notifications ─────────────────────────────
// Query params:
//   unreadOnly=true     filter to is_read = false
//   severity=critical   filter to a single severity level (powers the Critical tab)
router.get('/', async (req: AuthRequest, res: Response): Promise<void> => {
  const { unreadOnly, severity } = req.query as Record<string, string>;
  const userId = req.user!.id;

  // Phase 6: notify() now writes rows for the full role audience
  // regardless of in-app preference, so the read-time filter has to
  // strip out kinds the user has opted out of.
  const optedOut = await inAppOptedOutKinds(userId);

  const where: any = { userId };
  if (unreadOnly === 'true') where.isRead = false;
  if (severity === 'critical' || severity === 'warning' || severity === 'info') {
    where.severity = severity;
  }
  if (optedOut.length > 0) {
    where.type = { notIn: optedOut };
  }

  const unreadWhere: any = { userId, isRead: false };
  const criticalWhere: any = { userId, isRead: false, severity: 'critical' };
  if (optedOut.length > 0) {
    unreadWhere.type = { notIn: optedOut };
    criticalWhere.type = { notIn: optedOut };
  }

  const [notifications, unreadCount, criticalUnreadCount] = await Promise.all([
    prisma.notification.findMany({ where, orderBy: { createdAt: 'desc' }, take: 50 }),
    prisma.notification.count({ where: unreadWhere }),
    prisma.notification.count({ where: criticalWhere }),
  ]);

  res.json({ data: notifications, unreadCount, criticalUnreadCount });
});

// ─── PATCH /api/v1/notifications/:id/read ──────────────────
// Sets readAt to now() so we have engagement timing for analytics later.
router.patch('/:id/read', async (req: AuthRequest, res: Response): Promise<void> => {
  await prisma.notification.updateMany({
    where: { id: req.params.id as string, userId: req.user!.id, isRead: false },
    data: { isRead: true, readAt: new Date() },
  });
  res.json({ message: 'Marked as read' });
});

// ─── POST /api/v1/notifications/read-all ───────────────────
router.post('/read-all', async (req: AuthRequest, res: Response): Promise<void> => {
  const now = new Date();
  await prisma.notification.updateMany({
    where: { userId: req.user!.id, isRead: false },
    data: { isRead: true, readAt: now },
  });
  res.json({ message: 'All marked as read' });
});

// ─── GET /api/v1/notifications/preferences ─────────────────
// Returns one entry per known kind. Missing rows are projected as
// {inApp: true, email: true} so the UI always renders the full matrix
// even for users who've never visited the settings page.
router.get('/preferences', async (req: AuthRequest, res: Response): Promise<void> => {
  const stored = await prisma.notificationPreference.findMany({
    where: { userId: req.user!.id },
    select: { kind: true, inApp: true, email: true },
  });
  const byKind = new Map(stored.map(p => [p.kind, p]));
  const data = KNOWN_KINDS.map(kind => {
    const row = byKind.get(kind);
    return {
      kind,
      inApp: row?.inApp ?? true,
      email: row?.email ?? true,
    };
  });
  res.json({ data });
});

// ─── PATCH /api/v1/notifications/preferences ───────────────
// Bulk update. Body: { preferences: [{ kind, inApp, email }, ...] }.
// Each row is upserted; rows for unknown kinds are rejected (defense
// against a client desync writing rogue keys).
const patchPrefsSchema = z.object({
  preferences: z.array(z.object({
    kind:  z.enum(KNOWN_KINDS),
    inApp: z.boolean(),
    email: z.boolean(),
  })).min(1).max(KNOWN_KINDS.length),
});

router.patch('/preferences', async (req: AuthRequest, res: Response): Promise<void> => {
  const parsed = patchPrefsSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
    return;
  }
  const userId = req.user!.id;
  // One transaction for atomicity — either all writes land or none do.
  await prisma.$transaction(
    parsed.data.preferences.map(p =>
      prisma.notificationPreference.upsert({
        where: { userId_kind: { userId, kind: p.kind } },
        update: { inApp: p.inApp, email: p.email },
        create: { userId, kind: p.kind, inApp: p.inApp, email: p.email },
      })
    )
  );
  res.json({ message: 'Preferences updated', count: parsed.data.preferences.length });
});

export default router;
