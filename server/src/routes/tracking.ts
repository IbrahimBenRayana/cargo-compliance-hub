/**
 * Container Tracking routes (Terminal 49 integration, Phase 1).
 *
 *   GET    /status                       → is the integration configured?
 *   GET    /                             → list tracked shipments for this org
 *   POST   /                             → create a tracking request (BOL/booking/container + SCAC)
 *   GET    /:id                          → get a tracked shipment + cached snapshot
 *   POST   /:id/refresh                  → re-sync from Terminal 49 (poll request + fetch shipment)
 *   DELETE /:id                          → soft-stop and remove (admin only)
 *
 * Sync model (Phase 1 = pull only):
 *   - On create we POST /tracking_requests and store the returned request id.
 *   - "tracking" status is set once trackingRequest.status === 'created' AND
 *     a shipment id is attached → at that point we fetch /shipments/{id}?include=containers
 *     and persist the flattened snapshot + the denorm fields used by the list view.
 *   - Refresh re-runs the same logic.
 *
 * Phase 2 will introduce webhook ingestion so we don't have to poll.
 */

import { Router, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../config/database.js';
import { authMiddleware, AuthRequest, requireRole } from '../middleware/auth.js';
import { requireVerifiedEmail } from '../middleware/requireVerifiedEmail.js';
import * as t49 from '../services/terminal49.js';
import logger from '../config/logger.js';

const router = Router();
router.use(authMiddleware);

// ─── helpers ───────────────────────────────────────────────

function toDate(s: string | null | undefined): Date | null {
  if (!s) return null;
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

function deriveDenorm(snapshot: t49.ShipmentSummary) {
  const lfds = snapshot.containers
    .map((c) => toDate(c.pickupLfd))
    .filter((d): d is Date => !!d);
  const earliestPickupLfd = lfds.length
    ? new Date(Math.min(...lfds.map((d) => d.getTime())))
    : null;
  const hasHolds = snapshot.containers.some((c) => (c.holdsAtPodTerminal ?? []).length > 0);
  return {
    shippingLineName:    snapshot.shippingLineName,
    portOfLadingName:    snapshot.portOfLadingName,
    portOfDischargeName: snapshot.portOfDischargeName,
    destinationName:     snapshot.destinationName,
    podVesselName:       snapshot.podVesselName,
    polEtdAt:            toDate(snapshot.polEtdAt),
    polAtdAt:            toDate(snapshot.polAtdAt),
    podEtaAt:            toDate(snapshot.podEtaAt),
    podAtaAt:            toDate(snapshot.podAtaAt),
    destinationEtaAt:    toDate(snapshot.destinationEtaAt),
    destinationAtaAt:    toDate(snapshot.destinationAtaAt),
    hasHolds,
    earliestPickupLfd,
  };
}

/**
 * Polls the tracking request → if it's resolved into a shipment id, fetches
 * the shipment and writes the snapshot. Mutates a partial Prisma update payload
 * that the caller commits in a single update().
 */
async function syncFromT49(trackingRequestId: string): Promise<{
  status: 'pending' | 'tracking' | 'failed';
  failedReason: string | null;
  t49ShipmentId: string | null;
  snapshot: t49.ShipmentSummary | null;
}> {
  const tr = await t49.getTrackingRequest(trackingRequestId);

  if (tr.status === 'failed') {
    return { status: 'failed', failedReason: tr.failedReason, t49ShipmentId: null, snapshot: null };
  }

  const shipmentId = tr.trackedObjectType === 'shipment' ? tr.trackedObjectId : null;
  if (!shipmentId) {
    return { status: 'pending', failedReason: null, t49ShipmentId: null, snapshot: null };
  }

  const shipment = await t49.getShipment(shipmentId);
  const stopped = !!shipment.lineTrackingStoppedAt;
  return {
    status: stopped ? 'failed' : 'tracking',
    failedReason: stopped ? shipment.lineTrackingStoppedReason : null,
    t49ShipmentId: shipmentId,
    snapshot: shipment,
  };
}

// ─── GET /status ──────────────────────────────────────────
router.get('/status', (_req: AuthRequest, res: Response): void => {
  res.json(t49.getStatus());
});

// ─── GET / (list) ─────────────────────────────────────────
const listQuerySchema = z.object({
  status: z.enum(['pending', 'tracking', 'failed', 'stopped']).optional(),
  filingId: z.string().uuid().optional(),
  q: z.string().trim().min(1).max(120).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});

router.get('/', async (req: AuthRequest, res: Response): Promise<void> => {
  const parsed = listQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid query', details: parsed.error.flatten() });
    return;
  }
  const { status, filingId, q, limit } = parsed.data;
  const where: any = { orgId: req.user!.orgId };
  if (status)   where.status = status;
  if (filingId) where.filingId = filingId;
  if (q) {
    where.OR = [
      { requestNumber:       { contains: q, mode: 'insensitive' } },
      { scac:                { contains: q, mode: 'insensitive' } },
      { shippingLineName:    { contains: q, mode: 'insensitive' } },
      { podVesselName:       { contains: q, mode: 'insensitive' } },
      { portOfDischargeName: { contains: q, mode: 'insensitive' } },
    ];
  }

  const rows = await prisma.trackedShipment.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: limit,
  });
  res.json({ trackedShipments: rows });
});

// ─── POST / (create) ──────────────────────────────────────
const createSchema = z.object({
  requestType:   z.enum(['bill_of_lading', 'booking_number', 'container']),
  requestNumber: z.string().trim().min(3).max(100),
  scac:          z.string().trim().length(4).regex(/^[A-Za-z]{4}$/),
  filingId:      z.string().uuid().optional(),
  refNumbers:    z.array(z.string().trim().min(1)).max(20).optional(),
});

router.post('/', requireVerifiedEmail, async (req: AuthRequest, res: Response): Promise<void> => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid body', details: parsed.error.flatten() });
    return;
  }
  const { requestType, requestNumber, scac, filingId, refNumbers } = parsed.data;
  const orgId = req.user!.orgId;

  if (filingId) {
    const owns = await prisma.filing.count({ where: { id: filingId, orgId } });
    if (!owns) {
      res.status(404).json({ error: 'Filing not found' });
      return;
    }
  }

  let trackingRequest: t49.TrackingRequestSummary;
  try {
    trackingRequest = await t49.createTrackingRequest({
      requestType,
      requestNumber,
      scac,
      refNumbers,
    });
  } catch (err: any) {
    const status = err?.status === 503 ? 503 : (err?.status === 401 ? 502 : (err?.status >= 400 && err?.status < 500 ? 400 : 502));
    logger.warn({ err }, '[tracking] createTrackingRequest failed');
    res.status(status).json({ error: err?.message ?? 'Terminal 49 request failed' });
    return;
  }

  const row = await prisma.trackedShipment.create({
    data: {
      orgId,
      createdById:          req.user!.id,
      filingId:             filingId ?? null,
      t49TrackingRequestId: trackingRequest.id,
      requestType,
      requestNumber,
      scac: scac.toUpperCase(),
      status: trackingRequest.status === 'failed' ? 'failed' : 'pending',
      failedReason: trackingRequest.failedReason ?? null,
      lastSyncedAt: new Date(),
    },
  });
  res.status(201).json({ trackedShipment: row });
});

// ─── GET /:id ─────────────────────────────────────────────
router.get('/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  if (!id || !/^[0-9a-f-]{36}$/i.test(id)) {
    res.status(400).json({ error: 'Invalid id' });
    return;
  }
  const row = await prisma.trackedShipment.findFirst({
    where: { id, orgId: req.user!.orgId },
  });
  if (!row) {
    res.status(404).json({ error: 'Not found' });
    return;
  }
  res.json({ trackedShipment: row });
});

// ─── POST /:id/refresh ────────────────────────────────────
router.post('/:id/refresh', async (req: AuthRequest, res: Response): Promise<void> => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  if (!id || !/^[0-9a-f-]{36}$/i.test(id)) {
    res.status(400).json({ error: 'Invalid id' });
    return;
  }
  const row = await prisma.trackedShipment.findFirst({
    where: { id, orgId: req.user!.orgId },
  });
  if (!row) {
    res.status(404).json({ error: 'Not found' });
    return;
  }
  if (!row.t49TrackingRequestId) {
    res.status(409).json({ error: 'No Terminal 49 tracking request id on this row' });
    return;
  }

  try {
    const synced = await syncFromT49(row.t49TrackingRequestId);
    const updateData: any = {
      status:        synced.status,
      failedReason:  synced.failedReason,
      lastSyncedAt:  new Date(),
      syncError:     null,
    };
    if (synced.t49ShipmentId) updateData.t49ShipmentId = synced.t49ShipmentId;
    if (synced.snapshot) {
      Object.assign(updateData, deriveDenorm(synced.snapshot));
      updateData.shipmentSnapshot = synced.snapshot;
    }
    const updated = await prisma.trackedShipment.update({ where: { id: row.id }, data: updateData });
    res.json({ trackedShipment: updated });
  } catch (err: any) {
    logger.warn({ err, id: row.id }, '[tracking] refresh failed');
    await prisma.trackedShipment.update({
      where: { id: row.id },
      data:  { syncError: err?.message ?? 'sync failed', lastSyncedAt: new Date() },
    });
    res.status(err?.status === 503 ? 503 : 502).json({ error: err?.message ?? 'Refresh failed' });
  }
});

// ─── DELETE /:id ──────────────────────────────────────────
router.delete('/:id', requireRole('admin', 'owner'), async (req: AuthRequest, res: Response): Promise<void> => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  if (!id || !/^[0-9a-f-]{36}$/i.test(id)) {
    res.status(400).json({ error: 'Invalid id' });
    return;
  }
  const row = await prisma.trackedShipment.findFirst({
    where: { id, orgId: req.user!.orgId },
    select: { id: true },
  });
  if (!row) {
    res.status(404).json({ error: 'Not found' });
    return;
  }
  await prisma.trackedShipment.delete({ where: { id: row.id } });
  res.json({ success: true });
});

export default router;
