import { Router, Response } from 'express';
import { prisma } from '../config/database.js';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';

const router = Router();
router.use(authMiddleware);

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

export default router;
