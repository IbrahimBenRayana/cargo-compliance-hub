/**
 * POST /api/v1/contact
 *
 * Unauthenticated endpoint for the marketing-site contact form.
 *
 * Pre-Phase-3, ContactPage.handleSubmit was a setTimeout + console.log
 * stub — every demo request, enterprise inquiry, and bug report was
 * silently dropped. This route accepts the submission, validates it,
 * and emails the team via the same Azure SMTP transport the rest of the app
 * uses — "Request a demo" (subject=demo) routes to contact@mycargolens.com,
 * all other subjects to support@mycargolens.com.
 *
 * Rate-limited to 5/hr/IP via contactFormLimiter (see middleware).
 * Validated with strict Zod — unexpected fields are rejected.
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { sendMail } from '../services/email.js';
import { contactFormLimiter } from '../middleware/rateLimiter.js';
import logger from '../config/logger.js';

const router = Router();

const SUBJECTS = [
  'general',
  'demo',
  'enterprise',
  'support',
  'bug',
  'other',
] as const;

const contactSchema = z.object({
  name: z.string().trim().min(1).max(120),
  email: z.string().trim().email().max(255),
  // Constrain subject to the landing-site dropdown values so we can route /
  // label clearly downstream and reject random strings.
  subject: z.enum(SUBJECTS),
  // Generous max — most messages are <500 chars but founders sometimes paste
  // a whole rejection cable + their question. Hard cap at 5000.
  message: z.string().trim().min(1).max(5000),
  // Honeypot — landing form should NOT render this field; bots happily fill
  // every input they find. If non-empty we silently accept (200) and drop.
  website: z.string().max(0).optional(),
}).strict();

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

router.post('/', contactFormLimiter, async (req: Request, res: Response): Promise<void> => {
  const parsed = contactSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid submission', details: parsed.error.flatten() });
    return;
  }

  const { name, email, subject, message, website } = parsed.data;

  // Honeypot tripped — pretend success so the bot doesn't retry against a
  // different field name. We log it for visibility.
  if (website && website.length > 0) {
    logger.warn({ ip: req.ip, email }, '[Contact] honeypot tripped — dropped');
    res.json({ success: true });
    return;
  }

  const subjectLabels: Record<typeof SUBJECTS[number], string> = {
    general: 'General inquiry',
    demo: 'Demo request',
    enterprise: 'Enterprise inquiry',
    support: 'Support',
    bug: 'Bug report',
    other: 'Other',
  };
  const subjectLabel = subjectLabels[subject];

  // Route by subject: "Request a demo" submissions go to the sales inbox;
  // everything else continues to support.
  const to = subject === 'demo' ? 'contact@mycargolens.com' : 'support@mycargolens.com';

  const safeName = escapeHtml(name);
  const safeEmail = escapeHtml(email);
  const safeMessage = escapeHtml(message).replace(/\n/g, '<br>');

  const html = `
    <p><strong>From:</strong> ${safeName} &lt;${safeEmail}&gt;<br>
    <strong>Subject:</strong> ${subjectLabel}<br>
    <strong>IP:</strong> ${escapeHtml(req.ip ?? 'unknown')}<br>
    <strong>User-Agent:</strong> ${escapeHtml((req.get('user-agent') ?? '').slice(0, 200))}</p>
    <hr>
    <p>${safeMessage}</p>
  `;

  const text = [
    `From: ${name} <${email}>`,
    `Subject: ${subjectLabel}`,
    `IP: ${req.ip ?? 'unknown'}`,
    '',
    message,
  ].join('\n');

  // Fire and forget — log failures but don't bubble to the user. If SMTP
  // is misconfigured we don't want the form to error and turn legitimate
  // inquiries into "send failed" toast spam.
  const ok = await sendMail({
    to,
    subject: `[Contact] ${subjectLabel} — ${name}`,
    html,
    text,
  });

  if (!ok) {
    logger.error({ email, subject }, '[Contact] sendMail returned false');
  } else {
    logger.info({ subject, email }, '[Contact] submission received');
  }

  res.json({ success: true });
});

export default router;
