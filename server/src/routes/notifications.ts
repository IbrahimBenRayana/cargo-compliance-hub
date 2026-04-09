import { Router, Response } from 'express';
import { prisma } from '../config/database.js';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';

const router = Router();
router.use(authMiddleware);

// ─── GET /api/v1/notifications ─────────────────────────────
router.get('/', async (req: AuthRequest, res: Response): Promise<void> => {
  const { unreadOnly } = req.query as Record<string, string>;

  const where: any = { userId: req.user!.id };
  if (unreadOnly === 'true') where.isRead = false;

  const [notifications, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 50,
    }),
    prisma.notification.count({
      where: { userId: req.user!.id, isRead: false },
    }),
  ]);

  res.json({ data: notifications, unreadCount });
});

// ─── PATCH /api/v1/notifications/:id/read ──────────────────
router.patch('/:id/read', async (req: AuthRequest, res: Response): Promise<void> => {
  await prisma.notification.updateMany({
    where: { id: req.params.id as string, userId: req.user!.id },
    data: { isRead: true },
  });
  res.json({ message: 'Marked as read' });
});

// ─── POST /api/v1/notifications/read-all ───────────────────
router.post('/read-all', async (req: AuthRequest, res: Response): Promise<void> => {
  await prisma.notification.updateMany({
    where: { userId: req.user!.id, isRead: false },
    data: { isRead: true },
  });
  res.json({ message: 'All marked as read' });
});

export default router;
