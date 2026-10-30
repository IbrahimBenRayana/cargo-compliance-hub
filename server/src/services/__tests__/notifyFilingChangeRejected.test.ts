/**
 * A rejected ISF amendment or delete changes nothing at CBP: the filing stays
 * "accepted", so the alert has to say what happened and what is still on file.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

const { prisma, webhooks } = vi.hoisted(() => ({
  prisma: {
    notification: { findFirst: vi.fn(), createManyAndReturn: vi.fn() },
    notificationDelivery: { createMany: vi.fn() },
    notificationPreference: { findMany: vi.fn() },
    user: { findMany: vi.fn() },
  },
  webhooks: { emitWebhook: vi.fn() },
}));
vi.mock('../../config/database.js', () => ({ prisma }));
vi.mock('../webhooks.js', () => webhooks);
vi.mock('../notificationStream.js', () => ({ publishNotificationEvents: vi.fn(async () => undefined) }));

import { notifyFilingChangeRejected } from '../notifications.js';
import { renderNotificationEmail } from '../email.js';

const written = () => prisma.notification.createManyAndReturn.mock.calls[0][0].data[0];

beforeEach(() => {
  vi.clearAllMocks();
  prisma.notification.findFirst.mockResolvedValue(null);
  prisma.user.findMany.mockResolvedValue([{ id: 'u1', email: 'a@b.co' }]);
  prisma.notification.createManyAndReturn.mockResolvedValue([{ id: 'n1', userId: 'u1' }]);
  prisma.notificationPreference.findMany.mockResolvedValue([]);
});

describe('notifyFilingChangeRejected', () => {
  it('says CBP refused the amendment and the earlier version stays on file', async () => {
    await notifyFilingChangeRejected('o1', 'f1', 'HB1', 'REPLACE', 'BAD PORT');
    expect(written()).toMatchObject({ type: 'filing_rejected', severity: 'critical', title: 'ISF Amendment Rejected by CBP', linkUrl: '/shipments/f1' });
    expect(written().message).toContain('HB1');
    expect(written().message).toContain('earlier version stays on file');
    expect(written().message).toContain('BAD PORT');
  });

  it('goes to operators, admins and owners, not viewers', async () => {
    await notifyFilingChangeRejected('o1', 'f1', 'HB1', 'REPLACE');
    expect(prisma.user.findMany.mock.calls[0][0].where.role).toEqual({ in: ['operator', 'admin', 'owner'] });
  });

  it('says a refused delete leaves the ISF on file', async () => {
    await notifyFilingChangeRejected('o1', 'f1', 'HB1', 'DELETE');
    expect(written().title).toBe('ISF Delete Rejected by CBP');
    expect(written().message).toContain('stays on file');
  });

  it('tells API clients which action failed and that the ISF is still on file', async () => {
    await notifyFilingChangeRejected('o1', 'f1', 'HB1', 'REPLACE', 'BAD PORT');
    expect(webhooks.emitWebhook).toHaveBeenCalledWith('o1', 'filing.rejected', { filingId: 'f1', bolNumber: 'HB1', reason: 'BAD PORT', action: 'REPLACE', onFile: true });
  });

  it('emails the same story, not the "filing rejected" template', async () => {
    await notifyFilingChangeRejected('o1', 'f1', 'HB1', 'REPLACE', 'BAD PORT');
    const row = written();
    const email = renderNotificationEmail({ ...row, severity: 'critical' });
    expect(email.subject).toBe('ISF amendment rejected — HB1');
    expect(email.html).toContain('earlier version stays on file');
    expect(email.html).toContain('BAD PORT');
    expect(email.html).not.toContain('submit an amendment or corrected filing');
  });
});
