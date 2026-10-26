/**
 * services/leads.ts: notification retry sweep, configurable recipients, and
 * the prospect confirmation email that stays off until the founder approves.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { prisma, sendMail, env } = vi.hoisted(() => ({
  prisma: { lead: { findMany: vi.fn(), update: vi.fn() } },
  sendMail: vi.fn(),
  env: { LEADS_NOTIFY_TO: 'ibrahim.rayana@mycargolens.com', LEAD_CONFIRMATION_EMAIL: false },
}));
vi.mock('../../config/database.js', () => ({ prisma }));
vi.mock('../../config/env.js', () => ({ env }));
vi.mock('../email.js', () => ({ sendMail }));
vi.mock('../../config/logger.js', () => ({ default: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() } }));

import {
  leadRecipients, retryLeadNotifications, maybeSendLeadConfirmation, renderLeadConfirmation,
  renderLeadNotification, LEAD_NOTIFY_MAX_ATTEMPTS,
} from '../leads.js';
import adminRouter from '../../routes/admin.js';
import type { Lead } from '@prisma/client';

const lead = (over: Partial<Lead> = {}): Lead => ({
  id: 'l1', formSource: 'book_a_demo', subject: 'demo', name: 'Ada Shipper', email: 'ada@example.com',
  company: 'Ada Imports', message: null, persona: 'importer', volumeBand: '11-50', filesToday: null, filerBond: null,
  country: null, opsOwner: null, route: 'book_demo', stepReached: 2, bookingStatus: 'requested', src: null,
  utmSource: 'linkedin', utmMedium: null, utmCampaign: null, utmTerm: null, utmContent: null, landingPage: null,
  referrerDomain: null, ip: null, userAgent: null, notificationStatus: 'failed', notificationAttempts: 1,
  notificationError: null, notifiedAt: null, confirmationSentAt: null, createdAt: new Date(), updatedAt: new Date(),
  ...over,
});

beforeEach(() => {
  vi.clearAllMocks();
  env.LEADS_NOTIFY_TO = 'ibrahim.rayana@mycargolens.com';
  env.LEAD_CONFIRMATION_EMAIL = false;
  sendMail.mockResolvedValue(true);
  prisma.lead.update.mockResolvedValue({});
});

describe('leadRecipients', () => {
  it('sends sales subjects to LEADS_NOTIFY_TO (comma-separated) and the rest to support', () => {
    env.LEADS_NOTIFY_TO = 'a@x.com, b@x.com';
    expect(leadRecipients('demo')).toEqual(['a@x.com', 'b@x.com']);
    expect(leadRecipients('enterprise')).toEqual(['a@x.com', 'b@x.com']);
    expect(leadRecipients('bug')).toEqual(['support@mycargolens.com']);
  });

  it('falls back to support when LEADS_NOTIFY_TO is blank', () => {
    env.LEADS_NOTIFY_TO = ' ';
    expect(leadRecipients('demo')).toEqual(['support@mycargolens.com']);
  });
});

describe('renderLeadNotification', () => {
  it('escapes HTML and includes the qualification', () => {
    const m = renderLeadNotification(lead({ name: '<script>x</script>' }));
    expect(m.html).not.toContain('<script>');
    expect(m.text).toContain('Persona: Importer of record');
    expect(m.text).toContain('Monthly volume: 11-50');
  });
});

describe('retryLeadNotifications', () => {
  it('only picks failed or orphaned-pending leads under the attempt cap', async () => {
    prisma.lead.findMany.mockResolvedValue([lead(), lead({ id: 'l2' })]);
    await retryLeadNotifications();
    const where = prisma.lead.findMany.mock.calls[0][0].where;
    expect(where.notificationAttempts).toEqual({ lt: LEAD_NOTIFY_MAX_ATTEMPTS });
    expect(where.OR[0]).toEqual({ notificationStatus: 'failed' });
    expect(where.OR[1].notificationStatus).toBe('pending');
    expect(sendMail).toHaveBeenCalledTimes(2);
    expect(prisma.lead.update.mock.calls[0][0].data).toMatchObject({ notificationStatus: 'sent' });
  });

  it('records a thrown send as failed', async () => {
    prisma.lead.findMany.mockResolvedValue([lead()]);
    sendMail.mockRejectedValue(new Error('SMTP 535'));
    await retryLeadNotifications();
    expect(prisma.lead.update.mock.calls[0][0].data).toMatchObject({ notificationStatus: 'failed', notificationError: 'SMTP 535' });
  });
});

describe('prospect confirmation email', () => {
  it('is not sent while LEAD_CONFIRMATION_EMAIL is off', async () => {
    await maybeSendLeadConfirmation(lead());
    expect(sendMail).not.toHaveBeenCalled();
  });

  it('is sent once to the prospect, demo leads only, when the flag is on', async () => {
    env.LEAD_CONFIRMATION_EMAIL = true;
    await maybeSendLeadConfirmation(lead({ subject: 'bug' }));
    await maybeSendLeadConfirmation(lead({ confirmationSentAt: new Date() }));
    expect(sendMail).not.toHaveBeenCalled();

    await maybeSendLeadConfirmation(lead());
    expect(sendMail.mock.calls[0][0]).toMatchObject({ to: 'ada@example.com', replyTo: 'ibrahim.rayana@mycargolens.com', subject: 'We got your request, Ada' });
    expect(prisma.lead.update.mock.calls[0][0].data.confirmationSentAt).toBeInstanceOf(Date);
  });

  it('has no em-dashes and stays transactional', () => {
    const m = renderLeadConfirmation({ name: 'Ada Shipper', route: 'book_volume' });
    expect(m.text).not.toMatch(/—/);
    expect(m.text).toContain('volume and API pricing');
    expect(m.text).not.toMatch(/unsubscribe|offer|discount/i);
  });
});

describe('admin lead routes', () => {
  interface Layer { name?: string; route?: { path: string; methods: Record<string, boolean> } }
  const stack = (adminRouter as unknown as { stack: Layer[] }).stack;

  it('exist behind the platform-admin gate', () => {
    const gate = stack.findIndex((l) => !l.route && l.name === 'requirePlatformAdmin');
    const list = stack.findIndex((l) => l.route?.path === '/leads' && l.route.methods.get);
    const notify = stack.findIndex((l) => l.route?.path === '/leads/:id/notify' && l.route.methods.post);
    expect(gate).toBeGreaterThanOrEqual(0);
    expect(list).toBeGreaterThan(gate);
    expect(notify).toBeGreaterThan(gate);
  });
});
