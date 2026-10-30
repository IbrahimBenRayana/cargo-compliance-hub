/** A native amendment holds the user's edits until CBP accepts them. */
import { describe, it, expect, beforeEach, vi } from 'vitest';

const { prisma, cbp, config } = vi.hoisted(() => ({
  prisma: { filing: { findFirst: vi.fn(), update: vi.fn(), updateMany: vi.fn() } },
  cbp: { transmitIsfNative: vi.fn() },
  config: { loadOrgCbpConfig: vi.fn() },
}));
vi.mock('../../config/database.js', () => ({ prisma }));
vi.mock('../../config/logger.js', () => ({ default: { error: vi.fn(), warn: vi.fn(), info: vi.fn() } }));
vi.mock('../../services/cbp/nativeIsf.js', () => cbp);
vi.mock('../../services/cbp/filerIdentity.js', () => config);

import router from '../filings.js';

interface Layer { route?: { path: string; methods: Record<string, boolean>; stack: { handle: (...a: unknown[]) => unknown }[] } }
const amend = (router as unknown as { stack: Layer[] }).stack.find((l) => l.route?.path === '/:id/amend')!.route!.stack.at(-1)!.handle;

const ON_FILE = { id: 'f1', orgId: 'o1', status: 'accepted', cbpState: 'ON_FILE', pendingAction: null, estimatedDeparture: null, estimatedLading: null };
const user = { id: 'u1', orgId: 'o1', role: 'admin' };
const res = () => ({ statusCode: 200, status(c: number) { this.statusCode = c; return this; }, json: vi.fn() });

beforeEach(() => {
  vi.clearAllMocks();
  prisma.filing.findFirst.mockResolvedValue(ON_FILE);
  config.loadOrgCbpConfig.mockResolvedValue({ gateway: 'NATIVE' });
  cbp.transmitIsfNative.mockResolvedValue({ httpStatus: 202, body: {} });
});

describe('POST /filings/:id/amend (native)', () => {
  it('passes the edits to the transmission and does not touch the row', async () => {
    await amend({ user, headers: {}, params: { id: 'f1' }, body: { vesselName: 'NEW VESSEL' } }, res(), vi.fn());
    expect(cbp.transmitIsfNative).toHaveBeenCalledWith(expect.objectContaining({ action: 'REPLACE', edits: { vesselName: 'NEW VESSEL' } }));
    expect(prisma.filing.update).not.toHaveBeenCalled();
    expect(prisma.filing.updateMany).not.toHaveBeenCalled();
  });

  it('refuses a date it could not store once CBP accepted it, before anything is sent', async () => {
    const r = res();
    await amend({ user, headers: {}, params: { id: 'f1' }, body: { estimatedLading: 'TBD' } }, r, vi.fn());
    expect(r.statusCode).toBe(400);
    expect(cbp.transmitIsfNative).not.toHaveBeenCalled();
  });

  it('sends a replace with no edits as a resend of what CBP holds', async () => {
    await amend({ user, headers: {}, params: { id: 'f1' }, body: {} }, res(), vi.fn());
    expect(cbp.transmitIsfNative).toHaveBeenCalledWith(expect.objectContaining({ edits: undefined }));
  });
});
