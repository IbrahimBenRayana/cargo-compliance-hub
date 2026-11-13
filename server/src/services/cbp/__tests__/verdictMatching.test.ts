/**
 * Matching CBP's verdicts to what is actually in flight. These run the real
 * transmit, transmission and verdict code against one stateful row, because
 * every bug here is about the order things land in.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

const { prisma, db, send, n, w, b, isfNotify, filer, cfg } = vi.hoisted(() => {
  const db: { doc: any; filing: any; tx: Map<string, any>; inbound: any[]; beforeRead: (() => void) | null } =
    { doc: null, filing: null, tx: new Map(), inbound: [], beforeRead: null };
  const matches = (row: any, where: any) =>
    Object.entries(where).every(([key, want]: [string, any]) =>
      key === 'payload' ? true : row[key] === want);
  const table = (name: 'doc' | 'filing') => {
    const read = async () => {
      const snapshot = db[name] && { ...db[name] };
      const hook = db.beforeRead;
      db.beforeRead = null;
      hook?.();
      return snapshot;
    };
    return {
      findFirst: vi.fn(read),
      findUnique: vi.fn(read),
      updateMany: vi.fn(async ({ where, data }: any) => {
        if (!matches(db[name], where)) return { count: 0 };
        Object.assign(db[name], data);
        return { count: 1 };
      }),
      update: vi.fn(async ({ data }: any) => Object.assign(db[name], data)),
    };
  };
  const prisma: any = {
    abiDocument: table('doc'),
    filing: table('filing'),
    filingStatusHistory: { create: vi.fn() },
    cbpTransmission: {
      create: vi.fn(async ({ data }: any) => { db.tx.set(data.id, { ...data }); return data; }),
      update: vi.fn(async ({ where, data }: any) => Object.assign(db.tx.get(where.id), data)),
      updateMany: vi.fn(async ({ where, data }: any) => {
        const row = db.tx.get(where.id);
        if (!row || !matches(row, where)) return { count: 0 };
        Object.assign(row, data);
        return { count: 1 };
      }),
    },
    cbpInboundMessage: {
      findMany: vi.fn(async ({ where }: any) => db.inbound.filter((m) => m.transmissionId === where.transmissionId && m.application === where.application)),
    },
    user: { findUnique: vi.fn(async () => ({ firstName: 'Ibrahim', lastName: 'Rayana' })) },
    organization: { findUnique: vi.fn(async () => ({ phone: '(202) 341-7574' })) },
    htsRateLine: {},
  };
  prisma.$transaction = vi.fn(async (fn: (tx: unknown) => unknown) => fn(prisma));
  return {
    prisma, db,
    send: vi.fn(),
    n: { notify: vi.fn() }, w: { emitWebhook: vi.fn() },
    b: { billShipment: vi.fn(), billShipmentForFiling: vi.fn() },
    isfNotify: { notifyFilingAccepted: vi.fn(), notifyFilingRejected: vi.fn(), notifyFilingChangeRejected: vi.fn(), notifyFilingSubmitted: vi.fn() },
    filer: { loadOrgCbpConfig: vi.fn(), checkEntryFiler: vi.fn(() => ({ ok: true, filerCode: 'ABC' })), resolveIsfFiler: vi.fn() },
    cfg: { transport: 'mqipt', environment: 'CERT' },
  };
});
vi.mock('../../../config/database.js', () => ({ prisma }));
vi.mock('../../../config/logger.js', () => ({ default: { warn: vi.fn(), info: vi.fn(), error: vi.fn() } }));
vi.mock('../../notifications.js', () => ({ ...n, ...isfNotify }));
vi.mock('../../webhooks.js', () => w);
vi.mock('../../shipmentBilling.js', () => b);
vi.mock('../../compliance/scoreSnapshot.js', () => ({ recordScoreSnapshot: vi.fn(), triggerForStatus: vi.fn() }));
vi.mock('../../auditLog.js', () => ({ writeAuditLog: vi.fn() }));
vi.mock('../filerIdentity.js', () => filer);
vi.mock('../transport.js', () => ({ cbpTransport: { send }, cbpTrafficConfig: cfg }));
vi.mock('../sender.js', () => ({ requireCbpSender: () => ({ siteCode: '1303', idCode: 'S7P', password: 'X' }) }));
vi.mock('../../../abi-engine/payload/migrateV1.js', () => ({ migrateV1ToV2: (x: unknown) => x }));
vi.mock('../../../abi-engine/duty/engine.js', () => ({ enrichWithDuty: async (x: unknown) => x }));
vi.mock('../../../abi-engine/refdata/dbRateSource.js', () => ({ DbHtsRateSource: class {} }));
vi.mock('../../../abi-engine/payload/toAeInput.js', () => ({ toAeEntrySummaryInput: () => ({ districtPortOfEntry: '2704' }) }));
vi.mock('../../../abi-engine/validate/entrySummary.js', () => ({ validateEntrySummary: () => [] }));
vi.mock('../../../abi-engine/ae/builder.js', () => ({ buildEntrySummary: () => ['AE10'] }));
vi.mock('../../../abi-engine/isf/fromFiling.js', () => ({ mapFilingToIsfInput: () => ({}) }));
vi.mock('../../../abi-engine/isf/builder.js', () => ({ buildIsf: () => ['SF10'] }));
vi.mock('../currency.js', async (orig) => ({
  ...(await orig<typeof import('../currency.js')>()),
  convertInvoiceValuesToUsd: async (body: unknown) => ({ body, conversions: [] }),
}));

import { transmitEntryNative } from '../nativeEntry.js';
import { transmitIsfNative } from '../nativeIsf.js';
import { applyEntryVerdict } from '../entryVerdicts.js';
import { applyIsfVerdict } from '../isfVerdicts.js';

const SELLER = { type: 'seller', name: 'Albion Ltd', address: '12 Quay Rd', city: 'Felixstowe', country: 'GB' };
const PAYLOAD = { entryNumber: 'ABC-1234567-6', ior: { number: '57-123456789', name: 'ACCEPTED IOR' }, manifest: [{ invoices: [{ items: [{ parties: [SELLER] }] }] }] };
const EDITED = { ...PAYLOAD, ior: { ...PAYLOAD.ior, name: 'EDITED IOR' } };
const OLD = '00000000-0000-4000-8000-000000000001';
const VERSION = { payload: PAYLOAD, releaseRequested: true, transmissionId: OLD };
/** CBP holds the entry and its release; the row carries unsent edits. */
const HELD_ENTRY = {
  id: 'd1', orgId: 'o1', status: 'ACCEPTED', cbpState: 'ON_FILE', pendingAction: null, entrySummaryStatus: 'ACCEPTED',
  cargoReleaseStatus: 'ACCEPTED', releaseRequested: true, lastTransmissionId: OLD, entryType: '01', entryNumber: 'ABC12345676',
  mbolNumber: 'M', payload: EDITED, acceptedVersion: VERSION, rejectedPayload: null, lastError: null, respondedAt: null,
};
const HELD_ISF = {
  id: 'f1', orgId: 'o1', createdById: 'u1', status: 'accepted', cbpState: 'ON_FILE', pendingAction: null, lastTransmissionId: OLD,
  isfFilerCode: 'S7P', cbpTransactionId: 'S7P-1', houseBol: 'HB1', masterBol: 'MB1', pendingChanges: null, rejectedChanges: null,
  rejectedAt: null, rejectionReason: null, vesselName: 'OLD VESSEL', estimatedDeparture: null, estimatedLading: null,
};
const ENTRY_ARGS = { docId: 'd1', orgId: 'o1', userId: 'u1' };
const ISF_ARGS = { filingId: 'f1', orgId: 'o1', userId: 'u1' };

const verdict = (application: string, v: 'ACCEPTED' | 'REJECTED', narrative = 'CBP SAYS NO') =>
  ({ application, verdict: v, conditions: [], keys: {}, narrative }) as never;
const onEntry = (transmissionId: string, summary: never) => applyEntryVerdict({ docId: 'd1', transmissionId, summary });
const onIsf = (transmissionId: string, summary: never) => applyIsfVerdict({ filingId: 'f1', transmissionId, filerCode: 'S7P', summary });
const inFlightId = () => [...db.tx.keys()].at(-1)!;

beforeEach(() => {
  vi.clearAllMocks();
  db.doc = { ...HELD_ENTRY };
  db.filing = { ...HELD_ISF };
  db.tx = new Map();
  db.inbound = [];
  db.beforeRead = null;
  send.mockReset();
  send.mockResolvedValue({ messageId: 'm1' });
  filer.resolveIsfFiler.mockReturnValue({ ok: true, filerCode: 'S7P', mode: 'SIGMA' });
});

describe('while a send is in progress (the claim-to-send window)', () => {
  it('a late entry response to the previous transmission is not taken for the new action\'s verdict', async () => {
    send.mockImplementation(async () => { await onEntry(OLD, verdict('AX', 'REJECTED')); return { messageId: 'm1' }; });
    await transmitEntryNative({ ...ENTRY_ARGS, action: 'REPLACE' });
    expect(db.doc.pendingAction).toBe('REPLACE');
    expect(db.doc.payload).toEqual(EDITED);
  });

  it('a late ISF response to the previous transmission is not taken for the new action\'s verdict', async () => {
    send.mockImplementation(async () => { await onIsf(OLD, verdict('SN', 'REJECTED')); return { messageId: 'm1' }; });
    await transmitIsfNative({ ...ISF_ARGS, action: 'REPLACE', edits: { vesselName: 'NEW VESSEL' } });
    expect(db.filing.pendingAction).toBe('REPLACE');
    expect(db.filing.rejectedChanges).toBeNull();
  });

  it('CBP answering the entry before the send returns settles it, and the answer sticks', async () => {
    send.mockImplementation(async () => { await onEntry(inFlightId(), verdict('AX', 'REJECTED')); return { messageId: 'm1' }; });
    await transmitEntryNative({ ...ENTRY_ARGS, action: 'REPLACE' });
    expect(db.doc.pendingAction).toBeNull();
    expect(db.doc.payload).toEqual(PAYLOAD);
    expect(JSON.parse(db.doc.lastError).summary).toBe('CBP SAYS NO');
  });

  it('CBP answering the ISF before the send returns settles it', async () => {
    send.mockImplementation(async () => { await onIsf(inFlightId(), verdict('SN', 'REJECTED')); return { messageId: 'm1' }; });
    await transmitIsfNative({ ...ISF_ARGS, action: 'REPLACE', edits: { vesselName: 'NEW VESSEL' } });
    expect(db.filing.pendingAction).toBeNull();
    expect(db.filing.rejectedChanges).toEqual({ vesselName: 'NEW VESSEL' });
  });

  it('an unknown send outcome does not overwrite the reason from an answer that already landed', async () => {
    send.mockImplementation(async () => { await onEntry(inFlightId(), verdict('AX', 'REJECTED')); throw new Error('MQRC 2009 connection broken'); });
    await transmitEntryNative({ ...ENTRY_ARGS, action: 'REPLACE' });
    expect(JSON.parse(db.doc.lastError).summary).toBe('CBP SAYS NO');
  });

  it('an unknown send outcome with no answer yet is recorded on the entry', async () => {
    send.mockRejectedValue(new Error('MQRC 2009 connection broken'));
    await transmitEntryNative({ ...ENTRY_ARGS, action: 'REPLACE' });
    expect(db.doc.pendingAction).toBe('REPLACE');
    expect(db.doc.lastError).toMatch('2009');
  });
});

describe('a send that never left', () => {
  const unreachable = new Error('mq-bridge unreachable at http://mq-bridge:8080: ECONNREFUSED');

  it('leaves the entry on the transmission CBP knows about', async () => {
    send.mockRejectedValue(unreachable);
    await transmitEntryNative({ ...ENTRY_ARGS, action: 'REPLACE' });
    expect(db.doc.lastTransmissionId).toBe(OLD);
  });

  it('leaves the ISF on the transmission CBP knows about', async () => {
    send.mockRejectedValue(unreachable);
    await transmitIsfNative({ ...ISF_ARGS, action: 'REPLACE', edits: { vesselName: 'NEW VESSEL' } });
    expect(db.filing.lastTransmissionId).toBe(OLD);
  });

  it('does not lose the release of the accepted add', async () => {
    db.doc = { ...HELD_ENTRY, status: 'SENT', cargoReleaseStatus: null };
    send.mockRejectedValue(unreachable);
    await transmitEntryNative({ ...ENTRY_ARGS, action: 'REPLACE' });
    await onEntry(OLD, verdict('SX', 'ACCEPTED'));
    expect(db.doc).toMatchObject({ cargoReleaseStatus: 'ACCEPTED', status: 'ACCEPTED' });
    expect(b.billShipment).toHaveBeenCalledOnce();
  });
});

describe('a release landing during a send that then fails', () => {
  it('survives the rollback, and accepts and bills the entry', async () => {
    db.doc = { ...HELD_ENTRY, status: 'SENT', cargoReleaseStatus: null };
    send.mockImplementation(async () => {
      await onEntry(OLD, verdict('SX', 'ACCEPTED'));
      db.inbound.push({ transmissionId: OLD, application: 'SX', parsed: verdict('SX', 'ACCEPTED') });
      throw new Error('mq-bridge unreachable at http://mq-bridge:8080: ECONNREFUSED');
    });
    await transmitEntryNative({ ...ENTRY_ARGS, action: 'REPLACE' });
    expect(db.doc).toMatchObject({ cargoReleaseStatus: 'ACCEPTED', status: 'ACCEPTED', pendingAction: null });
    expect(b.billShipment).toHaveBeenCalledOnce();
  });
});

describe('a cargo release around a replace', () => {
  const REPLACING = { ...HELD_ENTRY, status: 'SENT', pendingAction: 'REPLACE', lastTransmissionId: 't2' };
  /** The dispatcher keeps every SX on its stored row. */
  const stored = (transmissionId: string, v: 'ACCEPTED' | 'REJECTED') =>
    db.inbound.push({ transmissionId, application: 'SX', parsed: verdict('SX', v) });

  it('an SX after CBP rejected the replace changes nothing and bills nothing', async () => {
    db.doc = { ...HELD_ENTRY, cargoReleaseStatus: null, status: 'SENT', lastTransmissionId: 't2' };
    await onEntry('t2', verdict('SX', 'ACCEPTED'));
    expect(db.doc).toMatchObject({ cargoReleaseStatus: null, status: 'SENT' });
    expect(b.billShipment).not.toHaveBeenCalled();
    expect(n.notify).not.toHaveBeenCalled();
  });

  it('an SX rejection after CBP rejected the replace leaves the held entry accepted', async () => {
    db.doc = { ...HELD_ENTRY, lastTransmissionId: 't2' };
    await onEntry('t2', verdict('SX', 'REJECTED'));
    expect(db.doc).toMatchObject({ cargoReleaseStatus: 'ACCEPTED', status: 'ACCEPTED', lastError: null });
  });

  it('an SX rejection that beats the AX rejection leaves the held entry accepted', async () => {
    db.doc = { ...REPLACING };
    await onEntry('t2', verdict('SX', 'REJECTED'));
    stored('t2', 'REJECTED');
    await onEntry('t2', verdict('AX', 'REJECTED'));
    expect(db.doc).toMatchObject({ cargoReleaseStatus: 'ACCEPTED', status: 'ACCEPTED', pendingAction: null, payload: PAYLOAD });
  });

  it('an SX acceptance that beats the AX rejection bills nothing', async () => {
    db.doc = { ...REPLACING, cargoReleaseStatus: null };
    await onEntry('t2', verdict('SX', 'ACCEPTED'));
    stored('t2', 'ACCEPTED');
    await onEntry('t2', verdict('AX', 'REJECTED'));
    expect(db.doc.cargoReleaseStatus).toBeNull();
    expect(b.billShipment).not.toHaveBeenCalled();
  });

  it('an SX that beats the AX acceptance counts once CBP accepts', async () => {
    db.doc = { ...REPLACING };
    await onEntry('t2', verdict('SX', 'REJECTED'));
    expect(db.doc.cargoReleaseStatus).toBe('ACCEPTED');
    stored('t2', 'REJECTED');
    await onEntry('t2', verdict('AX', 'ACCEPTED'));
    expect(db.doc).toMatchObject({ cargoReleaseStatus: 'REJECTED', status: 'REJECTED', pendingAction: null });
  });

  it('an SX that beats the acceptance of an add accepts and bills the entry once', async () => {
    db.doc = { ...REPLACING, pendingAction: 'ADD', cbpState: 'NOT_ON_FILE', entrySummaryStatus: null, cargoReleaseStatus: null, acceptedVersion: null };
    await onEntry('t2', verdict('SX', 'ACCEPTED'));
    stored('t2', 'ACCEPTED');
    await onEntry('t2', verdict('AX', 'ACCEPTED'));
    expect(db.doc).toMatchObject({ cargoReleaseStatus: 'ACCEPTED', status: 'ACCEPTED' });
    expect(b.billShipment).toHaveBeenCalledOnce();
  });

  it('the release of the version CBP holds still lands while a replace is pending', async () => {
    db.doc = { ...REPLACING, cargoReleaseStatus: null };
    await onEntry(OLD, verdict('SX', 'ACCEPTED'));
    expect(db.doc).toMatchObject({ cargoReleaseStatus: 'ACCEPTED', pendingAction: 'REPLACE', status: 'SENT' });
  });

  it('a summary accepted before versions recorded their transmission still takes its release', async () => {
    db.doc = { ...HELD_ENTRY, status: 'SENT', cargoReleaseStatus: null, acceptedVersion: { payload: PAYLOAD, releaseRequested: true } };
    await onEntry(OLD, verdict('SX', 'ACCEPTED'));
    expect(db.doc.cargoReleaseStatus).toBe('ACCEPTED');
  });

  it('a late SX after CBP accepted the delete changes nothing', async () => {
    db.doc = { ...HELD_ENTRY, status: 'CANCELLED', cbpState: 'DELETED', cargoReleaseStatus: null };
    await onEntry(OLD, verdict('SX', 'ACCEPTED'));
    expect(db.doc.cargoReleaseStatus).toBeNull();
  });
});

describe('writing a cargo release', () => {
  it('never clears a replace claimed after the row was read, and still lands', async () => {
    db.doc = { ...HELD_ENTRY, status: 'SENT', cargoReleaseStatus: null };
    db.beforeRead = () => Object.assign(db.doc, { pendingAction: 'REPLACE', lastTransmissionId: 't2' });
    await onEntry(OLD, verdict('SX', 'ACCEPTED'));
    expect(db.doc).toMatchObject({ pendingAction: 'REPLACE', lastTransmissionId: 't2', cargoReleaseStatus: 'ACCEPTED', status: 'SENT' });
  });

  it('a repeated acceptance rewrites nothing', async () => {
    const respondedAt = new Date('2026-10-01');
    db.doc = { ...HELD_ENTRY, respondedAt };
    await onEntry(OLD, verdict('SX', 'ACCEPTED'));
    expect(db.doc.respondedAt).toBe(respondedAt);
    expect(prisma.abiDocument.updateMany).not.toHaveBeenCalled();
  });

  it('a repeated rejection rewrites nothing', async () => {
    db.doc = { ...HELD_ENTRY, status: 'SENT', cargoReleaseStatus: null };
    await onEntry(OLD, verdict('SX', 'REJECTED'));
    prisma.abiDocument.updateMany.mockClear();
    await onEntry(OLD, verdict('SX', 'REJECTED'));
    expect(prisma.abiDocument.updateMany).not.toHaveBeenCalled();
  });

  it('a new rejection of the same release still records CBP\'s new reason', async () => {
    db.doc = { ...HELD_ENTRY, status: 'SENT', cargoReleaseStatus: 'REJECTED', lastError: null };
    await onEntry(OLD, verdict('SX', 'REJECTED', 'NEW REASON'));
    expect(JSON.parse(db.doc.lastError).summary).toBe('NEW REASON');
  });
});
