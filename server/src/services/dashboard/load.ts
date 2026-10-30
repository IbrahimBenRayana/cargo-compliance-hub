/**
 * Reads what the dashboard needs: scalar columns of live shipments only, never a
 * JSON payload, so a large org's history costs nothing. Every query is org-scoped.
 */
import { prisma } from '../../config/database.js';
import { CAPABILITIES } from '../../config/plans.js';
import { getOrgEntitlements } from '../entitlements.js';
import { computeBlockers, computeSetup } from './blockers.js';
import type { FilingRow, EntryRow, Loaded } from './build.js';
import { buildSummary } from './build.js';
import type { DashboardResponse } from './types.js';

const DAY = 86_400_000;
const RECENT_SHOWN = 8;

const FILING_COLUMNS = {
  id: true, filingType: true, status: true, cbpState: true, pendingAction: true, lastTransmissionId: true,
  estimatedDeparture: true, estimatedLading: true, estimatedArrival: true,
  acceptedAt: true, rejectedAt: true, amendedAt: true, updatedAt: true, submittedAt: true,
  houseBol: true, masterBol: true, importerName: true, vesselName: true, consolidationId: true,
  rejectionReason: true, createdById: true,
} as const;

const ENTRY_COLUMNS = {
  id: true, filingId: true, status: true, cbpState: true, pendingAction: true, lastTransmissionId: true,
  entrySummaryStatus: true, cargoReleaseStatus: true, releaseRequested: true, lastError: true,
  respondedAt: true, updatedAt: true, sentAt: true, entryNumber: true, mbolNumber: true, iorName: true, userId: true,
} as const;

export async function loadLive(orgId: string, opts: { abi: boolean; tracking: boolean; now: Date }): Promise<Loaded> {
  const { abi, tracking, now } = opts;
  const ago = (days: number) => new Date(now.getTime() - days * DAY);

  const filings: FilingRow[] = await prisma.filing.findMany({
    where: {
      orgId,
      OR: [
        { status: { in: ['draft', 'rejected', 'submitted', 'pending_cbp', 'on_hold'] } },
        { pendingAction: { not: null } },
        { status: { in: ['accepted', 'amended'] }, acceptedAt: { gte: ago(60) } },
        { status: { in: ['accepted', 'amended'] }, estimatedArrival: { gte: ago(15) } },
        { status: 'accepted', rejectedAt: { not: null }, lastTransmissionId: { not: null } },
      ],
    },
    select: FILING_COLUMNS,
  });

  let entries: EntryRow[] = [];
  if (abi) {
    entries = await prisma.abiDocument.findMany({
      where: {
        orgId,
        OR: [
          { status: { notIn: ['ACCEPTED', 'CANCELLED'] } },
          { pendingAction: { not: null } },
          { status: 'ACCEPTED', updatedAt: { gte: ago(30) } },
          { status: 'ACCEPTED', lastError: { not: null } },
          { filingId: { in: filings.map((f) => f.id) } },
        ],
      },
      select: ENTRY_COLUMNS,
    });
  }

  const ids = [...filings, ...entries].filter((x) => x.pendingAction && x.lastTransmissionId).map((x) => x.lastTransmissionId!);
  const txRows = ids.length
    ? await prisma.cbpTransmission.findMany({
        where: { orgId, id: { in: ids }, entityType: { in: ['filing', 'abi_document'] } },
        select: { id: true, status: true, sentAt: true },
      })
    : [];

  const holds = tracking
    ? await prisma.trackedShipment.findMany({
        where: { orgId, hasHolds: true },
        select: { id: true, filingId: true, requestNumber: true, updatedAt: true, createdById: true },
      })
    : [];

  return { filings, entries, transmissions: new Map(txRows.map((t) => [t.id, t])), holds };
}

const FILING_VERB: Record<string, string> = { accepted: 'ISF accepted', rejected: 'ISF rejected', submitted: 'ISF sent', amended: 'ISF change sent', cancelled: 'ISF cancelled' };
const ENTRY_VERB: Record<string, string> = { ACCEPTED: 'Entry accepted', REJECTED: 'Entry rejected', SENT: 'Entry sent', CANCELLED: 'Entry cancelled' };

async function loadRecent(orgId: string, abi: boolean) {
  const [filings, entries] = await Promise.all([
    prisma.filing.findMany({
      where: { orgId, status: { in: Object.keys(FILING_VERB) } },
      orderBy: { updatedAt: 'desc' }, take: RECENT_SHOWN,
      select: { id: true, status: true, updatedAt: true, houseBol: true, masterBol: true },
    }),
    abi
      ? prisma.abiDocument.findMany({
          where: { orgId, status: { in: Object.keys(ENTRY_VERB) } },
          orderBy: { updatedAt: 'desc' }, take: RECENT_SHOWN,
          select: { id: true, status: true, updatedAt: true, entryNumber: true, mbolNumber: true },
        })
      : [],
  ]);
  return [
    ...filings.map((f) => ({ id: `isf:${f.id}`, at: f.updatedAt, text: `${FILING_VERB[f.status]} ${f.houseBol || f.masterBol || f.id.slice(0, 8)}`, href: `/shipments/${f.id}` })),
    ...entries.map((e) => ({ id: `entry:${e.id}`, at: e.updatedAt, text: `${ENTRY_VERB[e.status]} ${e.entryNumber || e.mbolNumber || e.id.slice(0, 8)}`, href: `/abi-documents/${e.id}` })),
  ].sort((a, b) => b.at.getTime() - a.at.getTime()).slice(0, RECENT_SHOWN)
    .map((r) => ({ ...r, at: r.at.toISOString() }));
}

async function loadMonth(orgId: string, abi: boolean, now: Date) {
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const [isfAccepted, isfRejected, entriesAccepted] = await Promise.all([
    prisma.filing.count({ where: { orgId, acceptedAt: { gte: start } } }),
    prisma.filing.count({ where: { orgId, rejectedAt: { gte: start } } }),
    abi ? prisma.abiDocument.count({ where: { orgId, status: 'ACCEPTED', updatedAt: { gte: start } } }) : 0,
  ]);
  return { isfAccepted, isfRejected, entriesAccepted };
}

export interface Viewer { orgId: string; role: string; now: Date }

export const canManage = (role: string) => role === 'owner' || role === 'admin';

export async function capabilitiesOf(orgId: string) {
  const ent = await getOrgEntitlements(orgId);
  return {
    ent,
    abi: ent.capabilities.includes(CAPABILITIES.ABI_ENTRY),
    tracking: ent.capabilities.includes(CAPABILITIES.CONTAINER_TRACKING),
  };
}

export async function loadDashboard({ orgId, role, now }: Viewer): Promise<DashboardResponse> {
  const { ent, abi, tracking } = await capabilitiesOf(orgId);
  const canFix = canManage(role);
  const [data, recent, month, cfg, anyFiling, anyEntry] = await Promise.all([
    loadLive(orgId, { abi, tracking, now }),
    loadRecent(orgId, abi),
    canFix ? loadMonth(orgId, abi, now) : null,
    prisma.orgCbpConfig.findUnique({ where: { orgId }, select: { filerCode: true, isfFilerModeDefault: true, serviceCenterApprovedAt: true } }),
    prisma.filing.findFirst({ where: { orgId }, select: { id: true } }),
    abi ? prisma.abiDocument.findFirst({ where: { orgId }, select: { id: true } }) : null,
  ]);
  const isEmpty = !anyFiling && !anyEntry;
  return {
    ...buildSummary(data, { abi, canAct: role !== 'viewer', now }),
    isEmpty, recent, month,
    blockers: computeBlockers(ent, cfg, { canFix, abi }),
    setup: isEmpty ? computeSetup(ent, { canFix }) : null,
  };
}
