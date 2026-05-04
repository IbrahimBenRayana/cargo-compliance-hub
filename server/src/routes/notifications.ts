import { Router, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../config/database.js';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';

const router = Router();
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

  const where: any = { userId: req.user!.id };
  if (unreadOnly === 'true') where.isRead = false;
  if (severity === 'critical' || severity === 'warning' || severity === 'info') {
    where.severity = severity;
  }

  const [notifications, unreadCount, criticalUnreadCount] = await Promise.all([
    prisma.notification.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 50,
    }),
    prisma.notification.count({
      where: { userId: req.user!.id, isRead: false },
    }),
    prisma.notification.count({
      where: { userId: req.user!.id, isRead: false, severity: 'critical' },
    }),
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
