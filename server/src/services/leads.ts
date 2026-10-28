/**
 * Marketing leads: store first, notify second.
 *
 * Before this, routes/contact.ts emailed the team and returned success even
 * when the send failed, storing nothing, so a demo request could vanish
 * silently. Now every submission is written to `leads` before any email is
 * attempted; the notification outcome is recorded on the row (sent | failed)
 * and failed or stuck notifications are retried by a background job
 * (retryLeadNotifications). Platform admins list leads via /admin/leads.
 *
 * Founder-facing leads (demo, enterprise, partnership, press) go to
 * env.LEADS_NOTIFY_TO; everything else (incl. billing) goes to support@. The prospect confirmation email (conversion plan §4.6,
 * email 1) is drafted here but stays off until env.LEAD_CONFIRMATION_EMAIL.
 */

import type { Lead } from '@prisma/client';
import { prisma } from '../config/database.js';
import { env } from '../config/env.js';
import { sendMail } from './email.js';
import logger from '../config/logger.js';

const SUPPORT_TO = 'support@mycargolens.com';
const SALES_SUBJECTS = new Set(['demo', 'enterprise', 'partnership', 'press']);

/** Retry policy for the team notification. */
export const LEAD_NOTIFY_MAX_ATTEMPTS = 6;
/** A `pending` row older than this was orphaned (crash between store and send). */
const PENDING_STALE_MS = 5 * 60 * 1000;
const RETRY_BATCH = 25;

export const SUBJECT_LABELS: Record<string, string> = {
  general: 'General inquiry',
  demo: 'Demo request',
  enterprise: 'Enterprise inquiry',
  support: 'Support',
  bug: 'Bug report',
  billing: 'Billing',
  partnership: 'Partnership',
  press: 'Press',
  other: 'Other',
};

const PERSONA_LABELS: Record<string, string> = {
  importer: 'Importer of record',
  nvocc_forwarder: 'NVOCC or freight forwarder',
  broker: 'Licensed customs broker',
  developer: 'Developer or IT at a logistics company',
  other: 'Something else',
};

export function leadRecipients(subject: string): string[] {
  if (!SALES_SUBJECTS.has(subject)) return [SUPPORT_TO];
  const list = env.LEADS_NOTIFY_TO.split(',').map((s) => s.trim()).filter(Boolean);
  return list.length > 0 ? list : [SUPPORT_TO];
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Label/value rows for the team email; empty values are skipped. */
function leadRows(lead: Lead): [string, string][] {
  const rows: [string, string | null | undefined][] = [
    ['From', `${lead.name} <${lead.email}>`],
    ['Subject', SUBJECT_LABELS[lead.subject] ?? lead.subject],
    ['Company', lead.company],
    ['Persona', lead.persona ? PERSONA_LABELS[lead.persona] ?? lead.persona : null],
    ['Monthly volume', lead.volumeBand],
    ['Files today', lead.filesToday],
    ['Filer code / bond', lead.filerBond],
    ['Country', lead.country],
    ['Ops owner', lead.opsOwner],
    ['Route', lead.route],
    ['Form step reached', lead.formSource === 'book_a_demo' ? `${lead.stepReached} of 2` : null],
    ['Source', [lead.src, lead.utmSource, lead.utmMedium, lead.utmCampaign].filter(Boolean).join(' / ') || null],
    ['Landing page', lead.landingPage],
    ['Referrer', lead.referrerDomain],
    ['IP', lead.ip],
    ['User-Agent', lead.userAgent],
    ['Lead id', lead.id],
  ];
  return rows.filter((r): r is [string, string] => !!r[1]);
}

/** Team notification email (pure, for tests). */
export function renderLeadNotification(lead: Lead, opts: { update?: boolean } = {}) {
  const label = SUBJECT_LABELS[lead.subject] ?? lead.subject;
  const rows = leadRows(lead);
  const message = lead.message ?? '';
  const html = `
    <p>${rows.map(([k, v]) => `<strong>${escapeHtml(k)}:</strong> ${escapeHtml(v)}`).join('<br>')}</p>
    <hr>
    <p>${escapeHtml(message || '(no message)').replace(/\n/g, '<br>')}</p>
  `;
  const text = [...rows.map(([k, v]) => `${k}: ${v}`), '', message || '(no message)'].join('\n');
  const who = lead.company ? `${lead.name} (${lead.company})` : lead.name;
  return {
    subject: `[${opts.update ? 'Lead update' : 'Contact'}] ${label} — ${who}`,
    html,
    text,
  };
}

/**
 * Email the team about a stored lead and record the outcome on the row.
 * Never throws: a failed send is flagged (notificationStatus=failed) and the
 * retry job picks it up.
 */
export async function notifyLead(lead: Lead, opts: { update?: boolean } = {}): Promise<boolean> {
  const mail = renderLeadNotification(lead, opts);
  let ok = false;
  let error: string | null = null;
  try {
    ok = await sendMail({ to: leadRecipients(lead.subject), replyTo: lead.email, ...mail });
    if (!ok) error = 'sendMail returned false';
  } catch (err) {
    error = err instanceof Error ? err.message : String(err);
  }

  try {
    await prisma.lead.update({
      where: { id: lead.id },
      data: ok
        ? { notificationStatus: 'sent', notifiedAt: new Date(), notificationError: null, notificationAttempts: { increment: 1 } }
        : { notificationStatus: 'failed', notificationError: error?.slice(0, 500) ?? null, notificationAttempts: { increment: 1 } },
    });
  } catch (err) {
    logger.error({ err, leadId: lead.id }, '[Leads] could not record notification outcome');
  }

  if (ok) logger.info({ leadId: lead.id, subject: lead.subject }, '[Leads] team notified');
  else logger.error({ leadId: lead.id, subject: lead.subject, error }, '[Leads] team notification failed; flagged for retry');
  return ok;
}

/**
 * Last resort when the database write itself failed: email the full
 * submission so the lead still reaches a human. Returns whether it was sent.
 */
export async function notifyUnstoredLead(data: Record<string, unknown> & { subject: string }): Promise<boolean> {
  const text = Object.entries(data)
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .map(([k, v]) => `${k}: ${String(v)}`)
    .join('\n');
  try {
    return await sendMail({
      to: leadRecipients(data.subject),
      subject: `[Contact][NOT STORED] ${SUBJECT_LABELS[data.subject] ?? data.subject} — database write failed`,
      html: `<p><strong>This lead could not be saved to the database.</strong> Add it by hand.</p><pre>${escapeHtml(text)}</pre>`,
      text: `This lead could not be saved to the database. Add it by hand.\n\n${text}`,
    });
  } catch {
    return false;
  }
}

/** Retry failed notifications, and pending ones orphaned by a crash. */
export async function retryLeadNotifications(): Promise<void> {
  const leads = await prisma.lead.findMany({
    where: {
      notificationAttempts: { lt: LEAD_NOTIFY_MAX_ATTEMPTS },
      OR: [
        { notificationStatus: 'failed' },
        { notificationStatus: 'pending', createdAt: { lt: new Date(Date.now() - PENDING_STALE_MS) } },
      ],
    },
    orderBy: { createdAt: 'asc' },
    take: RETRY_BATCH,
  });
  if (leads.length === 0) return;
  let sent = 0;
  for (const lead of leads) {
    if (await notifyLead(lead)) sent++;
  }
  logger.info({ tried: leads.length, sent }, '[Leads] notification retry sweep');
}

// ─── Prospect confirmation (behind LEAD_CONFIRMATION_EMAIL) ─────────────────

/**
 * Draft of conversion plan §4.6 email 1, "email route" variant (the server
 * doesn't know about a Cal.com booking yet). Copy from
 * marketing/.../copy/book-a-demo-thanks.md §7. Transactional only: adding any
 * promotional line makes it a CAN-SPAM commercial message. No em-dashes.
 */
export function renderLeadConfirmation(lead: Pick<Lead, 'name' | 'route'>) {
  const firstName = lead.name.trim().split(/\s+/)[0] || 'there';
  const volume = lead.route === 'book_volume'
    ? ' We\'ll also cover volume and API pricing for teams filing at your volume.'
    : '';
  const paragraphs = [
    `Hi ${firstName},`,
    'Thanks for asking to see MyCargoLens.',
    'A founder will reply with next steps within one business day.',
    `On the call we'll cover your open filings ranked by what needs you first, the checks every draft gets before it goes to CBP, and how per-shipment billing works.${volume}`,
    'To change the time or add a colleague, reply to this email.',
  ];
  const signature = ['Ibrahim', 'MyCargoLens', 'mycargolens.com'];
  return {
    subject: `We got your request, ${firstName}`,
    text: [...paragraphs, signature.join('\n')].join('\n\n'),
    html: [...paragraphs.map((p) => `<p>${escapeHtml(p)}</p>`), `<p>${signature.map(escapeHtml).join('<br>')}</p>`].join('\n'),
  };
}

/**
 * Send the prospect confirmation once, for demo leads, when the flag is on.
 * Best effort: a failure is logged, never surfaced to the visitor.
 */
export async function maybeSendLeadConfirmation(lead: Lead): Promise<void> {
  if (!env.LEAD_CONFIRMATION_EMAIL || lead.subject !== 'demo' || lead.confirmationSentAt) return;
  const mail = renderLeadConfirmation(lead);
  try {
    const ok = await sendMail({ to: lead.email, replyTo: leadRecipients('demo')[0], ...mail });
    if (!ok) throw new Error('sendMail returned false');
    await prisma.lead.update({ where: { id: lead.id }, data: { confirmationSentAt: new Date() } });
  } catch (err) {
    logger.error({ err, leadId: lead.id }, '[Leads] prospect confirmation failed');
  }
}
