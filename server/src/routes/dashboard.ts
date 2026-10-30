/**
 * The dashboard's work queue (spec: docs/specs/dashboard-redesign.md §9).
 *
 *   GET /           → everything one page load needs
 *   GET /actions    → filtered or further pages of the queue
 *
 * The org always comes from the session. Plans decide what is read; roles decide
 * what is offered. Nothing here writes, and nothing here transmits to CBP.
 */
import { Router, Response } from 'express';
import { z } from 'zod';
import logger from '../config/logger.js';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';
import { decodeCursor, queryActions, sortedRows } from '../services/dashboard/build.js';
import { capabilitiesOf, loadDashboard, loadLive } from '../services/dashboard/load.js';

const router = Router();
router.use(authMiddleware);

function noStore(res: Response) {
  res.set('Cache-Control', 'private, no-store');
}

router.get('/', async (req: AuthRequest, res: Response): Promise<void> => {
  noStore(res);
  const started = performance.now();
  const body = await loadDashboard({ orgId: req.user!.orgId, role: req.user!.role, now: new Date() });
  logger.info({
    event: 'dashboard.load',
    orgId: req.user!.orgId,
    ms: Math.round(performance.now() - started),
    open: body.attention.now + body.attention.soon + body.attention.later,
  });
  res.json(body);
});

const actionsQuery = z.object({
  lane: z.enum(['now', 'soon', 'later']).optional(),
  filter: z.enum(['all', 'overdue', 'due_today', 'rejected', 'no_response']).optional(),
  mine: z.enum(['true', 'false']).optional().transform((v) => v === 'true'),
  importer: z.string().min(1).max(255).optional(),
  group: z.string().uuid().optional(),
  cursor: z.string().max(400).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(25),
});

router.get('/actions', async (req: AuthRequest, res: Response): Promise<void> => {
  const parsed = actionsQuery.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid query params', details: parsed.error.flatten() });
    return;
  }
  const { cursor: rawCursor, mine, ...q } = parsed.data;
  const cursor = rawCursor ? decodeCursor(rawCursor) : null;
  if (rawCursor && !cursor) {
    res.status(400).json({ error: 'Invalid cursor', code: 'INVALID_CURSOR' });
    return;
  }
  noStore(res);
  const now = new Date();
  const { orgId, role, id: userId } = req.user!;
  const { abi, tracking } = await capabilitiesOf(orgId);
  const rows = sortedRows(await loadLive(orgId, { abi, tracking, now }), { abi, canAct: role !== 'viewer', now });
  res.json(queryActions(rows, { ...q, mine, userId, cursor, now }));
});

export default router;
