/**
 * Demo / contact leads must never be lost (marketing office finding, Oct 26
 * 2026): the route used to email the team and answer success even when the
 * send failed, storing nothing. Pins store-before-email, flag-don't-hide on
 * email failure, the storage-failure fallback, and book-a-demo step 2.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { prisma, sendMail } = vi.hoisted(() => ({
  prisma: { lead: { create: vi.fn(), update: vi.fn(), findUnique: vi.fn() } },
  sendMail: vi.fn(),
}));
vi.mock('../../config/database.js', () => ({ prisma }));
vi.mock('../../services/email.js', () => ({ sendMail }));
vi.mock('../../config/logger.js', () => ({ default: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() } }));

import router from '../contact.js';
import { contactFormLimiter, leadUpdateLimiter } from '../../middleware/rateLimiter.js';

type Handle = (...a: unknown[]) => unknown;
interface Layer { route?: { path: string; methods: Record<string, boolean>; stack: { handle: Handle }[] } }
const route = (path: string, method: string) =>
  (router as unknown as { stack: Layer[] }).stack.find((l) => l.route?.path === path && l.route.methods[method])!.route!;
const post = route('/', 'post').stack.at(-1)!.handle;
const patch = route('/:id', 'patch').stack.at(-1)!.handle;

function call(handle: Handle, body: unknown, params: Record<string, string> = {}) {
  const res = { statusCode: 200, body: undefined as unknown, status(c: number) { this.statusCode = c; return this; }, json(b: unknown) { this.body = b; return this; } };
  const req = { body, params, ip: '203.0.113.9', get: () => 'test-agent' };
  return Promise.resolve(handle(req, res, vi.fn())).then(() => res);
}

const LEAD_ID = '6f1c1a52-6d0b-4c64-9d5e-0e7f3c1b2a90';
const demo = { name: 'Ada Shipper', email: 'ada@example.com', subject: 'demo', message: 'Show me ISF' };

beforeEach(() => {
  vi.clearAllMocks();
  prisma.lead.create.mockImplementation(async ({ data }) => ({ id: LEAD_ID, createdAt: new Date(), confirmationSentAt: null, ...data }));
  prisma.lead.update.mockImplementation(async ({ data }) => ({ id: LEAD_ID, ...data }));
  sendMail.mockResolvedValue(true);
});

describe('POST /contact', () => {
  it('keeps the existing rate limit', () => {
    expect(route('/', 'post').stack[0].handle).toBe(contactFormLimiter);
    expect(route('/:id', 'patch').stack[0].handle).toBe(leadUpdateLimiter);
  });

  it('stores the lead before emailing the configured recipient', async () => {
    const res = await call(post, demo);
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ success: true, leadId: LEAD_ID });
    expect(prisma.lead.create.mock.invocationCallOrder[0]).toBeLessThan(sendMail.mock.invocationCallOrder[0]);
    expect(prisma.lead.create.mock.calls[0][0].data).toMatchObject({
      formSource: 'contact', subject: 'demo', name: 'Ada Shipper', email: 'ada@example.com', stepReached: 2, ip: '203.0.113.9',
    });
    expect(sendMail).toHaveBeenCalledTimes(1);
    expect(sendMail.mock.calls[0][0]).toMatchObject({ to: ['ibrahim.rayana@mycargolens.com'], replyTo: 'ada@example.com' });
    expect(prisma.lead.update.mock.calls[0][0].data).toMatchObject({ notificationStatus: 'sent' });
  });

  it('routes non-sales subjects to support', async () => {
    await call(post, { ...demo, subject: 'bug' });
    expect(sendMail.mock.calls[0][0].to).toEqual(['support@mycargolens.com']);
  });

  it('still answers success when the email fails, and flags the lead for retry', async () => {
    sendMail.mockResolvedValue(false);
    const res = await call(post, demo);
    expect(res.statusCode).toBe(200);
    expect(prisma.lead.update.mock.calls[0][0].data).toMatchObject({
      notificationStatus: 'failed', notificationError: 'sendMail returned false', notificationAttempts: { increment: 1 },
    });
  });

  it('emails the unstored lead when the database write fails', async () => {
    prisma.lead.create.mockRejectedValue(new Error('db down'));
    const res = await call(post, demo);
    expect(res.statusCode).toBe(200);
    expect(sendMail.mock.calls[0][0].subject).toContain('NOT STORED');
    expect(sendMail.mock.calls[0][0].text).toContain('ada@example.com');
  });

  it('reports an error only when the lead is neither stored nor emailed', async () => {
    prisma.lead.create.mockRejectedValue(new Error('db down'));
    sendMail.mockResolvedValue(false);
    const res = await call(post, demo);
    expect(res.statusCode).toBe(503);
  });

  it('drops honeypot submissions without storing', async () => {
    const res = await call(post, { ...demo, website: 'x' });
    expect(res.body).toEqual({ success: true });
    expect(prisma.lead.create).not.toHaveBeenCalled();
  });

  it('requires a message on the contact form but not on book-a-demo step 1', async () => {
    const noMsg = { name: 'Ada', email: 'ada@example.com', subject: 'demo' };
    expect((await call(post, noMsg)).statusCode).toBe(400);

    const res = await call(post, {
      ...noMsg, formSource: 'book_a_demo', step: 1, company: 'Ada Imports', persona: 'importer',
      src: 'linkedin', utmSource: 'linkedin', utmCampaign: 'oct', landingPage: '/book-a-demo', referrerDomain: 'linkedin.com',
    });
    expect(res.statusCode).toBe(200);
    expect(prisma.lead.create.mock.calls[0][0].data).toMatchObject({
      formSource: 'book_a_demo', stepReached: 1, company: 'Ada Imports', persona: 'importer',
      src: 'linkedin', utmSource: 'linkedin', utmCampaign: 'oct', landingPage: '/book-a-demo', referrerDomain: 'linkedin.com',
    });
  });

  it('rejects unknown fields', async () => {
    expect((await call(post, { ...demo, phone: '555' })).statusCode).toBe(400);
  });
});

describe('PATCH /contact/:id (book-a-demo step 2)', () => {
  const step1 = { id: LEAD_ID, formSource: 'book_a_demo', subject: 'demo', name: 'Ada', email: 'ada@example.com', stepReached: 1, createdAt: new Date(), confirmationSentAt: null };

  it('stores the qualification and re-notifies the team', async () => {
    prisma.lead.findUnique.mockResolvedValue(step1);
    prisma.lead.update.mockImplementation(async ({ data }) => ({ ...step1, ...data }));
    const res = await call(patch, { persona: 'nvocc_forwarder', volumeBand: '100-500', filesToday: 'tms_api', country: 'pk', route: 'book_volume' }, { id: LEAD_ID });
    expect(res.statusCode).toBe(200);
    expect(prisma.lead.update.mock.calls[0][0].data).toMatchObject({
      persona: 'nvocc_forwarder', volumeBand: '100-500', country: 'PK', route: 'book_volume', stepReached: 2,
    });
    expect(sendMail.mock.calls[0][0].subject).toMatch(/^\[Lead update\]/);
  });

  it('is a no-op for a lead already at step 2', async () => {
    prisma.lead.findUnique.mockResolvedValue({ ...step1, stepReached: 2 });
    const res = await call(patch, { persona: 'importer' }, { id: LEAD_ID });
    expect(res.body).toEqual({ success: true, leadId: LEAD_ID });
    expect(prisma.lead.update).not.toHaveBeenCalled();
  });

  it('refuses unknown, contact-form, and stale leads', async () => {
    prisma.lead.findUnique.mockResolvedValueOnce(null);
    expect((await call(patch, {}, { id: LEAD_ID })).statusCode).toBe(404);
    prisma.lead.findUnique.mockResolvedValueOnce({ ...step1, formSource: 'contact' });
    expect((await call(patch, {}, { id: LEAD_ID })).statusCode).toBe(404);
    prisma.lead.findUnique.mockResolvedValueOnce({ ...step1, createdAt: new Date(Date.now() - 25 * 3600_000) });
    expect((await call(patch, {}, { id: LEAD_ID })).statusCode).toBe(404);
    expect((await call(patch, {}, { id: 'not-a-uuid' })).statusCode).toBe(400);
  });
});
