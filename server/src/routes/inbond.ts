/**
 * In-bond (7512) filings — native QP/WP via the abi-engine.
 *
 * The stored `payload` is the engine's InbondAddInput (without `kind`);
 * `POST /:id/build` runs it through buildInbond, which is the single
 * source of validation truth (the engine's fail() issues come back as
 * structured 422s). Lifecycle events (arrive/export/transfer/divert)
 * build their WP wire preview the same way.
 *
 * Transport to CBP is pending (Phase 4): filings stop at READY and events
 * at RECORDED until the connection exists — the UI makes that explicit.
 */
import { Router, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../config/database.js';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';
import { requireCapability } from '../middleware/requireCapability.js';
import { CAPABILITIES } from '../config/plans.js';
import { writeAuditLog, getRequestMeta } from '../services/auditLog.js';
import {
  buildInbond,
  buildInbondEvent,
  type InbondAddInput,
  type InbondEventInput,
} from '../abi-engine/index.js';
import { RecordCodecError } from '../abi-engine/records/codec.js';

const router = Router();
router.use(authMiddleware);
router.use(requireCapability(CAPABILITIES.IN_BOND));

const ENTRY_TYPES = new Set(['61', '62', '63']);
const EDITABLE_STATUSES = new Set(['DRAFT', 'READY']);

function issuesFrom(err: unknown) {
  if (err instanceof RecordCodecError) {
    return err.issues.map((i) => ({ field: `${i.record}.${i.field}`, message: i.message }));
  }
  return null;
}

/** Denormalized list/search fields derived from the payload. */
function denorm(payload: Record<string, unknown>) {
  const bills = Array.isArray(payload.bills) ? (payload.bills as Record<string, unknown>[]) : [];
  const first = bills[0] ?? {};
  return {
    carrierCode:
      typeof payload.carrierCode === 'string'
        ? payload.carrierCode.slice(0, 4)
        : typeof payload.inBondCarrierCode === 'string'
          ? (payload.inBondCarrierCode as string).slice(0, 4)
          : null,
    portOfDestination:
      typeof payload.usPortOfDestination === 'string' ? payload.usPortOfDestination.slice(0, 4) : null,
    primaryBill:
      typeof first.issuerCode === 'string' && typeof first.billNumber === 'string'
        ? `${first.issuerCode}${first.billNumber}`.slice(0, 30)
        : null,
    inbondNumber: typeof payload.inBondNumber === 'string' ? payload.inBondNumber.slice(0, 12) : null,
  };
}

// ─── GET / ────────────────────────────────────────────────
router.get('/', async (req: AuthRequest, res: Response): Promise<void> => {
  const status = typeof req.query.status === 'string' ? req.query.status : undefined;
  const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';
  const filings = await prisma.inbondFiling.findMany({
    where: {
      orgId: req.user!.orgId,
      ...(status ? { status } : {}),
      ...(search
        ? {
            OR: [
              { inbondNumber: { contains: search, mode: 'insensitive' } },
              { primaryBill: { contains: search, mode: 'insensitive' } },
              { carrierCode: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    },
    orderBy: { updatedAt: 'desc' },
    take: 200,
    select: {
      id: true, status: true, entryType: true, inbondNumber: true, carrierCode: true,
      portOfDestination: true, primaryBill: true, createdAt: true, updatedAt: true,
      _count: { select: { events: true } },
    },
  });
  res.json({ filings });
});

const createSchema = z.object({
  entryType: z.enum(['61', '62', '63']),
  payload: z.record(z.string(), z.unknown()).default({}),
});

// ─── POST / ───────────────────────────────────────────────
router.post('/', async (req: AuthRequest, res: Response): Promise<void> => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
    return;
  }
  const payload = { ...parsed.data.payload, entryType: parsed.data.entryType };
  const filing = await prisma.inbondFiling.create({
    data: {
      orgId: req.user!.orgId,
      createdById: req.user!.id,
      entryType: parsed.data.entryType,
      payload: JSON.parse(JSON.stringify(payload)),
      ...denorm(payload),
    },
  });
  await writeAuditLog({
    orgId: req.user!.orgId, userId: req.user!.id,
    action: 'inbond.created', entityType: 'inbond_filing', entityId: filing.id,
    ...getRequestMeta(req),
  });
  res.status(201).json({ filing });
});

// ─── GET /:id ─────────────────────────────────────────────
router.get('/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  const filing = await prisma.inbondFiling.findFirst({
    where: { id: String(req.params.id), orgId: req.user!.orgId },
    include: { events: { orderBy: { occurredAt: 'desc' } } },
  });
  if (!filing) {
    res.status(404).json({ error: 'In-bond filing not found' });
    return;
  }
  res.json({ filing });
});

const updateSchema = z.object({
  entryType: z.enum(['61', '62', '63']).optional(),
  payload: z.record(z.string(), z.unknown()).optional(),
});

// ─── PATCH /:id ───────────────────────────────────────────
router.patch('/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
    return;
  }
  const existing = await prisma.inbondFiling.findFirst({
    where: { id: String(req.params.id), orgId: req.user!.orgId },
  });
  if (!existing) {
    res.status(404).json({ error: 'In-bond filing not found' });
    return;
  }
  if (!EDITABLE_STATUSES.has(existing.status)) {
    res.status(409).json({ error: `A filing in status ${existing.status} can no longer be edited` });
    return;
  }
  const entryType = parsed.data.entryType ?? existing.entryType;
  if (!ENTRY_TYPES.has(entryType)) {
    res.status(400).json({ error: 'Invalid entry type' });
    return;
  }
  const payload = parsed.data.payload
    ? { ...parsed.data.payload, entryType }
    : { ...(existing.payload as Record<string, unknown>), entryType };
  const filing = await prisma.inbondFiling.update({
    where: { id: existing.id },
    data: {
      entryType,
      payload: JSON.parse(JSON.stringify(payload)),
      // Any edit sends it back to draft until rebuilt.
      status: 'DRAFT',
      wireText: null,
      ...denorm(payload),
    },
  });
  res.json({ filing });
});

// ─── DELETE /:id ──────────────────────────────────────────
router.delete('/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  const existing = await prisma.inbondFiling.findFirst({
    where: { id: String(req.params.id), orgId: req.user!.orgId },
  });
  if (!existing) {
    res.status(404).json({ error: 'In-bond filing not found' });
    return;
  }
  if (!EDITABLE_STATUSES.has(existing.status)) {
    res.status(409).json({ error: `A filing in status ${existing.status} cannot be deleted` });
    return;
  }
  await prisma.inbondFiling.delete({ where: { id: existing.id } });
  await writeAuditLog({
    orgId: req.user!.orgId, userId: req.user!.id,
    action: 'inbond.deleted', entityType: 'inbond_filing', entityId: existing.id,
    ...getRequestMeta(req),
  });
  res.json({ success: true });
});

// ─── POST /:id/build ──────────────────────────────────────
// Run the payload through the engine: on success store the wire text and
// mark READY; on engine rejection return the structured issues (422).
router.post('/:id/build', async (req: AuthRequest, res: Response): Promise<void> => {
  const existing = await prisma.inbondFiling.findFirst({
    where: { id: String(req.params.id), orgId: req.user!.orgId },
  });
  if (!existing) {
    res.status(404).json({ error: 'In-bond filing not found' });
    return;
  }
  try {
    const input = { kind: 'add', ...(existing.payload as object) } as InbondAddInput;
    const lines = buildInbond(input);
    const filing = await prisma.inbondFiling.update({
      where: { id: existing.id },
      data: { status: 'READY', wireText: lines.join('\n'), ...denorm(existing.payload as Record<string, unknown>) },
    });
    res.json({ filing, wireLines: lines });
  } catch (err) {
    const issues = issuesFrom(err);
    if (issues) {
      res.status(422).json({ error: 'The filing is not yet valid for transmission', issues });
      return;
    }
    throw err;
  }
});

const eventSchema = z.object({
  action: z.enum(['1', '2', '3', '5', '6', '7', 'A', 'Z']),
  occurredAt: z.string().datetime(),
  payload: z.record(z.string(), z.unknown()).default({}),
});

// Filing status transitions implied by a recorded event.
const EVENT_STATUS: Record<string, string> = {
  '1': 'ARRIVED', '2': 'ARRIVED', '3': 'ARRIVED',
  '5': 'EXPORTED', '6': 'EXPORTED', '7': 'EXPORTED',
};

// ─── POST /:id/events ─────────────────────────────────────
router.post('/:id/events', async (req: AuthRequest, res: Response): Promise<void> => {
  const parsed = eventSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
    return;
  }
  const existing = await prisma.inbondFiling.findFirst({
    where: { id: String(req.params.id), orgId: req.user!.orgId },
  });
  if (!existing) {
    res.status(404).json({ error: 'In-bond filing not found' });
    return;
  }
  try {
    const occurred = new Date(parsed.data.occurredAt);
    const wire = occurred.toISOString();
    const input = {
      action: parsed.data.action,
      entryType: existing.entryType,
      date: `${wire.slice(2, 4)}${wire.slice(5, 7)}${wire.slice(8, 10)}`, // YYMMDD
      time: `${wire.slice(11, 13)}${wire.slice(14, 16)}00`,
      inBondNumber: existing.inbondNumber ?? undefined,
      ...parsed.data.payload,
    } as unknown as InbondEventInput;
    const lines = buildInbondEvent(input);
    const [event] = await prisma.$transaction([
      prisma.inbondEvent.create({
        data: {
          filingId: existing.id,
          action: parsed.data.action,
          payload: JSON.parse(JSON.stringify(parsed.data.payload)),
          wireText: lines.join('\n'),
          occurredAt: occurred,
        },
      }),
      ...(EVENT_STATUS[parsed.data.action]
        ? [
            prisma.inbondFiling.update({
              where: { id: existing.id },
              data: { status: EVENT_STATUS[parsed.data.action] },
            }),
          ]
        : []),
    ]);
    res.status(201).json({ event, wireLines: lines });
  } catch (err) {
    const issues = issuesFrom(err);
    if (issues) {
      res.status(422).json({ error: 'The event is not valid for this in-bond', issues });
      return;
    }
    throw err;
  }
});

export default router;
