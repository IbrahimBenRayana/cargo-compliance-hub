import { Router, Response } from 'express';
import { prisma } from '../config/database.js';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';

const router = Router();
router.use(authMiddleware);

// ─── GET /api/v1/submission-logs — List API call logs ──────
router.get('/', async (req: AuthRequest, res: Response): Promise<void> => {
  const {
    filingId,
    page = '1',
    limit = '50',
  } = req.query as Record<string, string>;

  const pageNum = Math.max(1, parseInt(page) || 1);
  const pageSize = Math.min(100, Math.max(1, parseInt(limit) || 50));
  const skip = (pageNum - 1) * pageSize;

  const where: any = { orgId: req.user!.orgId };
  if (filingId) where.filingId = filingId;

  const [logs, total] = await Promise.all([
    prisma.submissionLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take: pageSize,
      include: {
        filing: {
          select: { id: true, filingType: true, masterBol: true, status: true },
        },
        user: {
          select: { firstName: true, lastName: true, email: true },
        },
      },
    }),
    prisma.submissionLog.count({ where }),
  ]);

  res.json({
    data: logs,
    pagination: {
      total,
      page: pageNum,
      limit: pageSize,
      totalPages: Math.ceil(total / pageSize),
    },
  });
});

export default router;
