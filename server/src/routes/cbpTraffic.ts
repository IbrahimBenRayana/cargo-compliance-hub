/**
 * CBP traffic console API (native go-live 1.8; audit FNA-18, UOP-08).
 * Platform admins only. Read-only views of what crossed the wire: the
 * connection (environment, queue manager, health), transmissions, and every
 * inbound CBP message including the unmatched ones nobody claimed.
 */
import { Router, Response } from 'express';
import { prisma } from '../config/database.js';
import { authMiddleware, AuthRequest, requirePlatformAdmin } from '../middleware/auth.js';
import { cbpTransport } from '../services/cbp/transport.js';
import { inboundEnvironment } from '../services/cbp/inboundJob.js';

const router = Router();
router.use(authMiddleware);
router.use(requirePlatformAdmin);

const take = (v: unknown, max = 100) => Math.min(Math.max(Number(v) || 50, 1), max);

// GET /connection — environment, bridge health and traffic counters.
router.get('/connection', async (_req: AuthRequest, res: Response): Promise<void> => {
  const environment = inboundEnvironment();
  const [health, lastInbound, pending, unmatched, unknown] = await Promise.all([
    cbpTransport.healthcheck(),
    prisma.cbpInboundMessage.findFirst({ where: { environment }, orderBy: { receivedAt: 'desc' }, select: { receivedAt: true } }),
    prisma.cbpInboundMessage.count({ where: { environment, dispatchedAt: null } }),
    prisma.cbpInboundMessage.count({ where: { environment, dispatchedAt: { not: null }, matchedEntityId: null } }),
    prisma.cbpTransmission.count({ where: { environment, status: 'UNKNOWN' } }),
  ]);
  res.json({
    environment,
    transport: cbpTransport.kind,
    health,
    lastInboundAt: lastInbound?.receivedAt ?? null,
    counts: { pendingDispatch: pending, unmatched, unknownOutcome: unknown },
  });
});

// GET /transmissions?status=&take=
router.get('/transmissions', async (req: AuthRequest, res: Response): Promise<void> => {
  const status = typeof req.query.status === 'string' && req.query.status ? req.query.status : undefined;
  const rows = await prisma.cbpTransmission.findMany({
    where: { environment: inboundEnvironment(), ...(status ? { status } : {}) },
    orderBy: { createdAt: 'desc' },
    take: take(req.query.take),
    select: {
      id: true, orgId: true, application: true, action: true, entityType: true, entityId: true,
      filerCode: true, userDataTag: true, entryNumber: true, isfTransactionNumber: true,
      status: true, sentAt: true, respondedAt: true, lastError: true, createdAt: true,
      _count: { select: { inbound: true } },
    },
  });
  res.json({ transmissions: rows });
});

// GET /inbound?filter=all|unmatched|pending&take=
router.get('/inbound', async (req: AuthRequest, res: Response): Promise<void> => {
  const filter = String(req.query.filter ?? 'all');
  const where = {
    environment: inboundEnvironment(),
    ...(filter === 'unmatched' ? { dispatchedAt: { not: null }, matchedEntityId: null } : {}),
    ...(filter === 'pending' ? { dispatchedAt: null } : {}),
  };
  const rows = await prisma.cbpInboundMessage.findMany({
    where,
    orderBy: { receivedAt: 'desc' },
    take: take(req.query.take),
    select: {
      id: true, application: true, userDataTag: true, receivedAt: true, dispatchedAt: true,
      matchedEntityType: true, matchedEntityId: true, transmissionId: true, parseError: true,
    },
  });
  res.json({ messages: rows });
});

// GET /inbound/:id — the raw message as received plus its parsed summary.
router.get('/inbound/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  const row = await prisma.cbpInboundMessage.findUnique({ where: { id: String(req.params.id) } });
  if (!row) {
    res.status(404).json({ error: 'Message not found' });
    return;
  }
  res.json({ message: row });
});

// GET /transmissions/:id — the wire as sent and every response it drew.
router.get('/transmissions/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  const row = await prisma.cbpTransmission.findUnique({
    where: { id: String(req.params.id) },
    include: { inbound: { orderBy: { receivedAt: 'asc' } } },
  });
  if (!row) {
    res.status(404).json({ error: 'Transmission not found' });
    return;
  }
  res.json({ transmission: row });
});

export default router;
