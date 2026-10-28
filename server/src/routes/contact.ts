/**
 * POST  /api/v1/contact      — contact form and /book-a-demo (step 1, or the
 *                              whole form for single-step callers)
 * PATCH /api/v1/contact/:id  — /book-a-demo step 2 (qualification)
 *
 * Unauthenticated endpoints for the marketing site.
 *
 * Every submission is stored in `leads` BEFORE any email is attempted, so a
 * lead can't be lost to an SMTP failure (services/leads.ts). The response is
 * an error only when the lead could not be stored and the fallback email
 * failed too. A failed team notification is flagged on the row and retried by
 * a background job, never reported to the visitor.
 *
 * POST is rate-limited to 5/hr/IP via contactFormLimiter; PATCH has its own
 * limiter so a two-step submission costs one contact slot. Strict Zod:
 * unexpected fields are rejected.
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../config/database.js';
import { contactFormLimiter, leadUpdateLimiter } from '../middleware/rateLimiter.js';
import { notifyLead, notifyUnstoredLead, maybeSendLeadConfirmation } from '../services/leads.js';
import logger from '../config/logger.js';

const router = Router();

const SUBJECTS = ['general', 'demo', 'enterprise', 'support', 'bug', 'billing', 'partnership', 'press', 'other'] as const;
// Conversion plan §4.2 field 4 and §4.3 routes.
const PERSONAS = ['importer', 'nvocc_forwarder', 'broker', 'developer', 'other'] as const;
const ROUTES = ['book_demo', 'book_volume', 'book_technical', 'broker_review', 'fit_check', 'review'] as const;

/** Step 2 can only complete a lead this recently created. */
const STEP2_WINDOW_MS = 24 * 60 * 60 * 1000;

const opt = (max: number) => z.string().trim().max(max).optional();

// Qualification fields (book-a-demo step 2). Also accepted on POST so a
// single-step caller can send everything at once.
const qualificationShape = {
  persona: z.enum(PERSONAS).optional(),
  volumeBand: opt(30),
  filesToday: opt(40),
  filerBond: opt(20),
  country: z.string().trim().regex(/^[A-Za-z]{2}$/).transform((c) => c.toUpperCase()).optional(),
  opsOwner: opt(200),
  route: z.enum(ROUTES).optional(),
};

const contactSchema = z.object({
  name: z.string().trim().min(1).max(120),
  email: z.string().trim().email().max(255),
  // Constrain subject to the landing-site dropdown values so we can route /
  // label clearly downstream and reject random strings.
  subject: z.enum(SUBJECTS),
  // Generous max — most messages are <500 chars but founders sometimes paste
  // a whole rejection cable + their question. Hard cap at 5000. Optional for
  // /book-a-demo, required for the contact form (refine below).
  message: z.string().trim().max(5000).optional(),
  // Honeypot — landing form should NOT render this field; bots happily fill
  // every input they find. If non-empty we silently accept (200) and drop.
  // (Was max(0), which made the schema 400 bots before the honeypot branch.)
  website: z.string().max(500).optional(),
  formSource: z.enum(['contact', 'book_a_demo']).default('contact'),
  // 1 = book-a-demo step 1; step 2 follows via PATCH /:id. Omitted = complete.
  step: z.literal(1).optional(),
  company: opt(200),
  ...qualificationShape,
  // Attribution (first touch, from the landing site)
  src: opt(100),
  utmSource: opt(100),
  utmMedium: opt(100),
  utmCampaign: opt(100),
  utmTerm: opt(100),
  utmContent: opt(100),
  landingPage: opt(500),
  referrerDomain: opt(255),
}).strict().refine((d) => d.formSource === 'book_a_demo' || !!d.message, {
  path: ['message'],
  message: 'Required',
});

const qualificationSchema = z.object({
  ...qualificationShape,
  message: z.string().trim().max(5000).optional(),
}).strict();

const empty = (v: string | undefined) => (v ? v : undefined);

type Qualification = z.infer<typeof qualificationSchema>;
const qualificationData = (q: Qualification) => ({
  persona: q.persona,
  volumeBand: empty(q.volumeBand),
  filesToday: empty(q.filesToday),
  filerBond: empty(q.filerBond),
  country: empty(q.country),
  opsOwner: empty(q.opsOwner),
  route: q.route,
});

router.post('/', contactFormLimiter, async (req: Request, res: Response): Promise<void> => {
  const parsed = contactSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid submission', details: parsed.error.flatten() });
    return;
  }

  const { website, step, ...data } = parsed.data;

  // Honeypot tripped — pretend success so the bot doesn't retry against a
  // different field name. We log it for visibility.
  if (website && website.length > 0) {
    logger.warn({ ip: req.ip, email: data.email }, '[Contact] honeypot tripped — dropped');
    res.json({ success: true });
    return;
  }

  const record = {
    formSource: data.formSource,
    subject: data.subject,
    name: data.name,
    email: data.email,
    company: empty(data.company),
    message: empty(data.message),
    ...qualificationData(data),
    stepReached: step === 1 ? 1 : 2,
    src: empty(data.src),
    utmSource: empty(data.utmSource),
    utmMedium: empty(data.utmMedium),
    utmCampaign: empty(data.utmCampaign),
    utmTerm: empty(data.utmTerm),
    utmContent: empty(data.utmContent),
    landingPage: empty(data.landingPage),
    referrerDomain: empty(data.referrerDomain),
    ip: req.ip?.slice(0, 64) ?? null,
    userAgent: (req.get('user-agent') ?? '').slice(0, 255) || null,
  };

  let lead;
  try {
    lead = await prisma.lead.create({ data: record });
  } catch (err) {
    // Storage failed: get the lead to a human by email instead, and only
    // report failure if that fails too.
    logger.error({ err, email: data.email, subject: data.subject }, '[Contact] lead could not be stored');
    const mailed = await notifyUnstoredLead({ ...record });
    if (mailed) {
      res.json({ success: true });
    } else {
      logger.error({ lead: record }, '[Contact] lead NOT stored and NOT emailed');
      res.status(503).json({ error: 'We could not save your request. Please email us directly.' });
    }
    return;
  }

  // The lead is safe. Notification failures are flagged on the row and
  // retried by the background job; the visitor still gets success.
  await notifyLead(lead);
  if (step !== 1) await maybeSendLeadConfirmation(lead);

  logger.info({ leadId: lead.id, subject: lead.subject, formSource: lead.formSource }, '[Contact] lead stored');
  res.json({ success: true, leadId: lead.id });
});

router.patch('/:id', leadUpdateLimiter, async (req: Request, res: Response): Promise<void> => {
  const id = z.string().uuid().safeParse(req.params.id);
  const parsed = qualificationSchema.safeParse(req.body);
  if (!id.success || !parsed.success) {
    res.status(400).json({ error: 'Invalid submission', details: parsed.success ? undefined : parsed.error.flatten() });
    return;
  }

  try {
    const existing = await prisma.lead.findUnique({ where: { id: id.data } });
    if (
      !existing
      || existing.formSource !== 'book_a_demo'
      || Date.now() - existing.createdAt.getTime() > STEP2_WINDOW_MS
    ) {
      res.status(404).json({ error: 'Request not found' });
      return;
    }
    // A repeated step 2 (double click, retry after a network blip) is a no-op.
    if (existing.stepReached >= 2) {
      res.json({ success: true, leadId: existing.id });
      return;
    }

    const lead = await prisma.lead.update({
      where: { id: existing.id },
      data: {
        ...qualificationData(parsed.data),
        ...(parsed.data.message ? { message: parsed.data.message } : {}),
        stepReached: 2,
      },
    });

    await notifyLead(lead, { update: true });
    await maybeSendLeadConfirmation(lead);

    res.json({ success: true, leadId: lead.id });
  } catch (err) {
    logger.error({ err, leadId: id.data, body: parsed.data }, '[Contact] lead step 2 could not be stored');
    res.status(503).json({ error: 'We could not save your request. Please email us directly.' });
  }
});

export default router;
