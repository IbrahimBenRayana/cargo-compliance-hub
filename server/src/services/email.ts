/**
 * Email Service — Azure Communication Services SMTP
 *
 * Sends transactional emails for:
 *  - Team invitations
 *  - Filing status updates (accepted, rejected, deadline)
 *  - Password reset (future)
 *
 * Uses nodemailer with Azure SMTP relay.
 * All emails are fire-and-forget (errors logged, never crash the caller).
 */

import nodemailer from 'nodemailer';
import { env } from '../config/env.js';
import logger from '../config/logger.js';

// ─── Transporter ──────────────────────────────────────────
let transporter: nodemailer.Transporter | null = null;

function getTransporter(): nodemailer.Transporter | null {
  if (transporter) return transporter;

  if (!env.EMAIL_USER || !env.EMAIL_PASS) {
    logger.warn('[Email] SMTP credentials not configured — emails will be logged only.');
    return null;
  }

  transporter = nodemailer.createTransport({
    host: env.EMAIL_HOST,
    port: env.EMAIL_PORT,
    secure: false,          // STARTTLS on port 587
    auth: {
      user: env.EMAIL_USER,
      pass: env.EMAIL_PASS,
    },
    tls: {
      ciphers: 'SSLv3',
      rejectUnauthorized: true,
    },
  });

  logger.info({ host: env.EMAIL_HOST, port: env.EMAIL_PORT }, '[Email] SMTP transporter ready');
  return transporter;
}

// ─── Verify connection (called on server startup) ─────────
export async function verifyEmailConnection(): Promise<boolean> {
  const t = getTransporter();
  if (!t) return false;
  try {
    await t.verify();
    logger.info('[Email] SMTP connection verified');
    return true;
  } catch (err: any) {
    logger.error({ err: err.message }, '[Email] SMTP connection failed');
    return false;
  }
}

// ─── Core send helper ─────────────────────────────────────
interface SendMailOptions {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
}

async function sendMail(options: SendMailOptions): Promise<boolean> {
  const t = getTransporter();

  // In development without SMTP, just log
  if (!t) {
    logger.debug({
      to: options.to,
      subject: options.subject,
      preview: (options.text || options.html).slice(0, 120),
    }, '[Email][DEV] Would send email');
    return true;
  }

  try {
    const info = await t.sendMail({
      from: `"${env.EMAIL_FROM_NAME}" <${env.EMAIL_FROM}>`,
      to: Array.isArray(options.to) ? options.to.join(', ') : options.to,
      subject: options.subject,
      html: options.html,
      text: options.text ?? stripHtml(options.html),
    });

    logger.info({ to: options.to, subject: options.subject, messageId: info.messageId }, '[Email] Sent');
    return true;
  } catch (err: any) {
    logger.error({ err: err.message, to: options.to, subject: options.subject }, '[Email] Failed to send');
    return false;
  }
}

// ─── HTML helpers ─────────────────────────────────────────
function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
}

function wrapTemplate(body: string): string {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
</head>
<body style="margin:0; padding:0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f4f4f7; color: #333;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f7; padding:32px 0;">
    <tr>
      <td align="center">
        <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="background:#ffffff; border-radius:8px; overflow:hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.06);">
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #1e40af 0%, #3b82f6 100%); padding: 24px 32px;">
              <h1 style="margin:0; color:#fff; font-size:20px; font-weight:600; letter-spacing:-0.2px;">
                MyCargoLens
              </h1>
              <p style="margin:4px 0 0; color:rgba(255,255,255,0.78); font-size:12px; letter-spacing:0.04em;">
                ISF compliance platform
              </p>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding: 32px;">
              ${body}
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding: 20px 32px; background:#f9fafb; border-top:1px solid #e5e7eb;">
              <p style="margin:0; font-size:12px; color:#9ca3af; line-height:1.5;">
                This email was sent by MyCargoLens — ISF 10+2 Compliance Platform.<br/>
                If you didn't expect this email, you can safely ignore it.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function buttonHtml(text: string, url: string): string {
  return `
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px 0;">
      <tr>
        <td style="background:#2563eb; border-radius:6px;">
          <a href="${url}" target="_blank" style="display:inline-block; padding:12px 28px; color:#ffffff; font-size:14px; font-weight:600; text-decoration:none;">
            ${text}
          </a>
        </td>
      </tr>
    </table>`;
}

// ─── Email Templates ──────────────────────────────────────

/**
 * Team Invitation Email
 */
export async function sendInvitationEmail(params: {
  to: string;
  inviterName: string;
  organizationName: string;
  role: string;
  inviteToken: string;
}): Promise<boolean> {
  const inviteUrl = `${env.FRONTEND_URL}/register?invite=${params.inviteToken}`;

  const body = `
    <h2 style="margin:0 0 16px; font-size:20px; color:#1e293b;">You're invited to join ${params.organizationName}</h2>
    <p style="margin:0 0 8px; font-size:15px; line-height:1.6; color:#475569;">
      <strong>${params.inviterName}</strong> has invited you to join <strong>${params.organizationName}</strong>
      on MyCargoLens as a <strong style="text-transform:capitalize;">${params.role}</strong>.
    </p>
    <p style="margin:0 0 16px; font-size:15px; line-height:1.6; color:#475569;">
      MyCargoLens helps import teams manage ISF 10+2 filings with U.S. Customs and Border Protection.
    </p>
    ${buttonHtml('Accept Invitation', inviteUrl)}
    <p style="margin:0; font-size:13px; color:#94a3b8;">
      This invitation expires in 7 days. If the button doesn't work, paste this link in your browser:<br/>
      <a href="${inviteUrl}" style="color:#2563eb; word-break:break-all;">${inviteUrl}</a>
    </p>
  `;

  return sendMail({
    to: params.to,
    subject: `${params.inviterName} invited you to ${params.organizationName} — MyCargoLens`,
    html: wrapTemplate(body),
  });
}

/**
 * Filing Accepted by CBP
 */
export async function sendFilingAcceptedEmail(params: {
  to: string[];
  bolNumber: string;
  filingId: string;
  cbpTransactionId?: string;
}): Promise<boolean> {
  const dashboardUrl = `${env.FRONTEND_URL}/shipments/${params.filingId}`;

  const body = `
    <h2 style="margin:0 0 16px; font-size:20px; color:#1e293b;">Filing accepted</h2>
    <p style="margin:0 0 16px; font-size:15px; line-height:1.6; color:#475569;">
      Your ISF filing <strong>${params.bolNumber}</strong> has been <strong style="color:#16a34a;">accepted</strong> by U.S. Customs and Border Protection.
    </p>
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 16px; font-size:14px; color:#475569;">
      <tr><td style="padding:4px 16px 4px 0; font-weight:600;">BOL Number</td><td>${params.bolNumber}</td></tr>
      ${params.cbpTransactionId ? `<tr><td style="padding:4px 16px 4px 0; font-weight:600;">CBP Transaction ID</td><td>${params.cbpTransactionId}</td></tr>` : ''}
    </table>
    ${buttonHtml('View Filing Details', dashboardUrl)}
  `;

  return sendMail({
    to: params.to,
    subject: `ISF filing accepted — ${params.bolNumber}`,
    html: wrapTemplate(body),
  });
}

/**
 * Filing Rejected by CBP
 */
export async function sendFilingRejectedEmail(params: {
  to: string[];
  bolNumber: string;
  filingId: string;
  reason?: string;
}): Promise<boolean> {
  const dashboardUrl = `${env.FRONTEND_URL}/shipments/${params.filingId}`;

  const body = `
    <h2 style="margin:0 0 16px; font-size:20px; color:#1e293b;">Filing rejected</h2>
    <p style="margin:0 0 16px; font-size:15px; line-height:1.6; color:#475569;">
      Your ISF filing <strong>${params.bolNumber}</strong> has been <strong style="color:#dc2626;">rejected</strong> by U.S. Customs and Border Protection.
    </p>
    ${params.reason ? `
    <div style="margin:0 0 16px; padding:12px 16px; background:#fef2f2; border-left:4px solid #dc2626; border-radius:4px;">
      <p style="margin:0; font-size:14px; color:#991b1b;"><strong>Reason:</strong> ${params.reason}</p>
    </div>` : ''}
    <p style="margin:0 0 16px; font-size:15px; line-height:1.6; color:#475569;">
      Please review the filing and submit an amendment or corrected filing.
    </p>
    ${buttonHtml('Review Filing', dashboardUrl)}
  `;

  return sendMail({
    to: params.to,
    subject: `ISF filing rejected — ${params.bolNumber}`,
    html: wrapTemplate(body),
  });
}

/**
 * Filing Deadline Approaching
 */
export async function sendDeadlineWarningEmail(params: {
  to: string[];
  bolNumber: string;
  filingId: string;
  hoursRemaining: number;
}): Promise<boolean> {
  const dashboardUrl = `${env.FRONTEND_URL}/shipments/${params.filingId}`;

  const urgencyLabel = params.hoursRemaining <= 24 ? 'Urgent' : params.hoursRemaining <= 48 ? 'Soon'   : 'Reminder';
  const urgencyColor = params.hoursRemaining <= 24 ? '#dc2626' : params.hoursRemaining <= 48 ? '#d97706' : '#ea580c';
  const urgencyBg    = params.hoursRemaining <= 24 ? '#fef2f2' : params.hoursRemaining <= 48 ? '#fffbeb' : '#fff7ed';

  const pill = `<span style="display:inline-block; padding:3px 9px; margin-right:8px; font-size:11px; font-weight:700; letter-spacing:0.06em; text-transform:uppercase; color:${urgencyColor}; background:${urgencyBg}; border:1px solid ${urgencyColor}33; border-radius:999px; vertical-align:middle;">${urgencyLabel}</span>`;

  const body = `
    <h2 style="margin:0 0 16px; font-size:20px; color:#1e293b;">${pill}Filing deadline approaching</h2>
    <p style="margin:0 0 16px; font-size:15px; line-height:1.6; color:#475569;">
      ISF filing <strong>${params.bolNumber}</strong> must be submitted within
      <strong style="color:${urgencyColor};">${params.hoursRemaining} hours</strong>.
    </p>
    <div style="margin:0 0 16px; padding:12px 16px; background:${urgencyBg}; border-left:4px solid ${urgencyColor}; border-radius:4px;">
      <p style="margin:0; font-size:14px; color:#92400e;">
        ISF filings must be submitted at least 24 hours before cargo is loaded onto a vessel destined for the United States. Late filings may result in penalties.
      </p>
    </div>
    ${buttonHtml('Submit Filing Now', dashboardUrl)}
  `;

  return sendMail({
    to: params.to,
    subject: `${urgencyLabel}: deadline in ${params.hoursRemaining}h — ISF filing ${params.bolNumber}`,
    html: wrapTemplate(body),
  });
}

/**
 * Filing Submitted Confirmation
 */
export async function sendFilingSubmittedEmail(params: {
  to: string;
  bolNumber: string;
  filingId: string;
  submitterName: string;
}): Promise<boolean> {
  const dashboardUrl = `${env.FRONTEND_URL}/shipments/${params.filingId}`;

  const body = `
    <h2 style="margin:0 0 16px; font-size:20px; color:#1e293b;">Filing submitted</h2>
    <p style="margin:0 0 16px; font-size:15px; line-height:1.6; color:#475569;">
      <strong>${params.submitterName}</strong> has submitted ISF filing <strong>${params.bolNumber}</strong> to CBP.
    </p>
    <p style="margin:0 0 16px; font-size:15px; line-height:1.6; color:#475569;">
      The filing is now being processed. You'll receive a notification when CBP responds with an acceptance or rejection.
    </p>
    ${buttonHtml('Track Filing Status', dashboardUrl)}
  `;

  return sendMail({
    to: params.to,
    subject: `ISF filing submitted — ${params.bolNumber}`,
    html: wrapTemplate(body),
  });
}

/**
 * Welcome Email (after registration)
 */
export async function sendWelcomeEmail(params: {
  to: string;
  firstName: string;
  organizationName: string;
}): Promise<boolean> {
  const dashboardUrl = `${env.FRONTEND_URL}/dashboard`;

  const body = `
    <h2 style="margin:0 0 16px; font-size:20px; color:#1e293b;">Welcome to MyCargoLens, ${params.firstName}.</h2>
    <p style="margin:0 0 16px; font-size:15px; line-height:1.6; color:#475569;">
      Your account for <strong>${params.organizationName}</strong> has been created. You're all set to start managing ISF 10+2 filings.
    </p>
    <p style="margin:0 0 8px; font-size:15px; line-height:1.6; color:#475569;">
      Here's what you can do:
    </p>
    <ul style="margin:0 0 16px; padding-left:20px; font-size:14px; line-height:1.8; color:#475569;">
      <li>Create and submit ISF filings to CBP</li>
      <li>Track filing statuses in real-time</li>
      <li>Manage your team and invite colleagues</li>
      <li>Set up automated deadline reminders</li>
    </ul>
    ${buttonHtml('Go to Dashboard', dashboardUrl)}
  `;

  return sendMail({
    to: params.to,
    subject: `Welcome to MyCargoLens — Let's get started!`,
    html: wrapTemplate(body),
  });
}

/**
 * Test email — used from the Integrations page to verify SMTP config
 */
export async function sendTestEmail(to: string): Promise<boolean> {
  const body = `
    <h2 style="margin:0 0 16px; font-size:20px; color:#1e293b;">Email configuration test</h2>
    <p style="margin:0 0 16px; font-size:15px; line-height:1.6; color:#475569;">
      If you're reading this, your MyCargoLens email integration is working correctly.
    </p>
    <p style="margin:0; font-size:14px; color:#94a3b8;">
      Sent at ${new Date().toISOString()}
    </p>
  `;

  return sendMail({
    to,
    subject: 'MyCargoLens email test — connection successful',
    html: wrapTemplate(body),
  });
}

// ─── Phase 6: Generic notification renderer ──────────────────────────
// Used by the delivery worker to render any notification into a sendable
// email. Delegates to the existing specialized templates for the four
// well-known kinds (filing submitted/accepted/rejected/deadline_warning)
// and falls back to a single generic template for everything else.
//
// The worker calls renderNotificationEmail(...) → sendMail(...) per
// delivery row. Both are exported.

export { sendMail };

interface RenderableNotification {
  type: string;
  title: string;
  message: string | null;
  linkUrl: string | null;
  severity: 'info' | 'warning' | 'critical';
  metadata: Record<string, unknown> | null;
}

interface RenderedEmail {
  subject: string;
  html: string;
}

// Severity is communicated via the banner color/border, not glyphs. Keeping
// the prefix map for future label-only use (e.g., "Action needed:") if we
// want one — for now it's empty for every level so subjects stay clean.
const SEVERITY_PREFIX: Record<RenderableNotification['severity'], string> = {
  info:     '',
  warning:  '',
  critical: '',
};

const SEVERITY_BANNER_BG: Record<RenderableNotification['severity'], string> = {
  info:     '#eff6ff',
  warning:  '#fffbeb',
  critical: '#fef2f2',
};

const SEVERITY_BANNER_BORDER: Record<RenderableNotification['severity'], string> = {
  info:     '#2563eb',
  warning:  '#d97706',
  critical: '#dc2626',
};

/** Pull a string field out of metadata safely. Falsy → undefined. */
function meta(n: RenderableNotification, key: string): string | undefined {
  const v = n.metadata?.[key];
  return typeof v === 'string' ? v : undefined;
}

function metaNum(n: RenderableNotification, key: string): number | undefined {
  const v = n.metadata?.[key];
  return typeof v === 'number' ? v : undefined;
}

/**
 * Generic template — used for any kind without a bespoke renderer.
 * Looks like the specialized ones (same wrapTemplate + buttonHtml) but
 * driven entirely by Notification fields.
 */
function renderGeneric(n: RenderableNotification): RenderedEmail {
  const subject = `${SEVERITY_PREFIX[n.severity]}${n.title}`;
  const dashboardUrl = n.linkUrl ? `${env.FRONTEND_URL}${n.linkUrl}` : env.FRONTEND_URL;

  const banner = n.severity !== 'info' ? `
    <div style="margin:0 0 16px; padding:12px 16px; background:${SEVERITY_BANNER_BG[n.severity]}; border-left:4px solid ${SEVERITY_BANNER_BORDER[n.severity]}; border-radius:4px;">
      <p style="margin:0; font-size:13px; font-weight:600; text-transform:uppercase; letter-spacing:0.04em; color:${SEVERITY_BANNER_BORDER[n.severity]};">
        ${n.severity}
      </p>
    </div>` : '';

  const body = `
    ${banner}
    <h2 style="margin:0 0 16px; font-size:20px; color:#1e293b;">${n.title}</h2>
    ${n.message ? `<p style="margin:0 0 16px; font-size:15px; line-height:1.6; color:#475569;">${n.message}</p>` : ''}
    ${n.linkUrl ? buttonHtml('Open in MyCargoLens', dashboardUrl) : ''}
  `;
  return { subject, html: wrapTemplate(body) };
}

/** Dispatcher — maps known kinds to their bespoke renderers; falls back to generic. */
export function renderNotificationEmail(n: RenderableNotification): RenderedEmail {
  switch (n.type) {
    case 'filing_submitted':
      return renderFilingSubmitted(n);
    case 'filing_accepted':
      return renderFilingAccepted(n);
    case 'filing_rejected':
      return renderFilingRejected(n);
    case 'deadline_warning':
      return renderDeadlineWarning(n);
    default:
      return renderGeneric(n);
  }
}

// Bespoke renderers — same HTML as the existing send* functions but pure
// (no sendMail call), so the worker can use them as part of a render →
// send pipeline. The existing send* functions still live above for any
// caller that wants to send synchronously; new callers should go through
// the queue.

function renderFilingSubmitted(n: RenderableNotification): RenderedEmail {
  const bol = meta(n, 'bolNumber') ?? 'unknown';
  const dashboardUrl = n.linkUrl ? `${env.FRONTEND_URL}${n.linkUrl}` : env.FRONTEND_URL;
  const body = `
    <h2 style="margin:0 0 16px; font-size:20px; color:#1e293b;">Filing submitted</h2>
    <p style="margin:0 0 16px; font-size:15px; line-height:1.6; color:#475569;">
      Your ISF filing <strong>${bol}</strong> has been submitted to U.S. Customs and Border Protection. We'll let you know as soon as we hear back.
    </p>
    ${buttonHtml('View Filing', dashboardUrl)}
  `;
  return { subject: `ISF filing submitted — ${bol}`, html: wrapTemplate(body) };
}

function renderFilingAccepted(n: RenderableNotification): RenderedEmail {
  const bol = meta(n, 'bolNumber') ?? 'unknown';
  const cbpTxn = meta(n, 'cbpTransactionId');
  const dashboardUrl = n.linkUrl ? `${env.FRONTEND_URL}${n.linkUrl}` : env.FRONTEND_URL;
  const body = `
    <h2 style="margin:0 0 16px; font-size:20px; color:#1e293b;">Filing accepted</h2>
    <p style="margin:0 0 16px; font-size:15px; line-height:1.6; color:#475569;">
      Your ISF filing <strong>${bol}</strong> has been <strong style="color:#16a34a;">accepted</strong> by U.S. Customs and Border Protection.
    </p>
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 16px; font-size:14px; color:#475569;">
      <tr><td style="padding:4px 16px 4px 0; font-weight:600;">BOL Number</td><td>${bol}</td></tr>
      ${cbpTxn ? `<tr><td style="padding:4px 16px 4px 0; font-weight:600;">CBP Transaction ID</td><td>${cbpTxn}</td></tr>` : ''}
    </table>
    ${buttonHtml('View Filing Details', dashboardUrl)}
  `;
  return { subject: `ISF filing accepted — ${bol}`, html: wrapTemplate(body) };
}

function renderFilingRejected(n: RenderableNotification): RenderedEmail {
  const bol = meta(n, 'bolNumber') ?? 'unknown';
  const reason = meta(n, 'reason');
  const dashboardUrl = n.linkUrl ? `${env.FRONTEND_URL}${n.linkUrl}` : env.FRONTEND_URL;
  const body = `
    <h2 style="margin:0 0 16px; font-size:20px; color:#1e293b;">Filing rejected</h2>
    <p style="margin:0 0 16px; font-size:15px; line-height:1.6; color:#475569;">
      Your ISF filing <strong>${bol}</strong> has been <strong style="color:#dc2626;">rejected</strong> by U.S. Customs and Border Protection.
    </p>
    ${reason ? `
    <div style="margin:0 0 16px; padding:12px 16px; background:#fef2f2; border-left:4px solid #dc2626; border-radius:4px;">
      <p style="margin:0; font-size:14px; color:#991b1b;"><strong>Reason:</strong> ${reason}</p>
    </div>` : ''}
    <p style="margin:0 0 16px; font-size:15px; line-height:1.6; color:#475569;">
      Please review the filing and submit an amendment or corrected filing.
    </p>
    ${buttonHtml('Review Filing', dashboardUrl)}
  `;
  return { subject: `ISF filing rejected — ${bol}`, html: wrapTemplate(body) };
}

function renderDeadlineWarning(n: RenderableNotification): RenderedEmail {
  const bol = meta(n, 'bolNumber') ?? 'unknown';
  const hours = metaNum(n, 'hoursRemaining') ?? 0;
  const dashboardUrl = n.linkUrl ? `${env.FRONTEND_URL}${n.linkUrl}` : env.FRONTEND_URL;
  const urgencyLabel = hours <= 24 ? 'Urgent' : hours <= 48 ? 'Soon' : 'Reminder';
  const urgencyColor = hours <= 24 ? '#dc2626' : hours <= 48 ? '#d97706' : '#ea580c';
  const urgencyBg    = hours <= 24 ? '#fef2f2' : hours <= 48 ? '#fffbeb' : '#fff7ed';
  const pill = `<span style="display:inline-block; padding:3px 9px; margin-right:8px; font-size:11px; font-weight:700; letter-spacing:0.06em; text-transform:uppercase; color:${urgencyColor}; background:${urgencyBg}; border:1px solid ${urgencyColor}33; border-radius:999px; vertical-align:middle;">${urgencyLabel}</span>`;
  const body = `
    <h2 style="margin:0 0 16px; font-size:20px; color:#1e293b;">${pill}Filing deadline in ${hours}h</h2>
    <p style="margin:0 0 16px; font-size:15px; line-height:1.6; color:#475569;">
      Your ISF filing <strong>${bol}</strong> deadline is in <strong>${hours} hours</strong>.
      Submit soon to avoid CBP penalties ($5,000–$10,000).
    </p>
    ${buttonHtml('Open Filing', dashboardUrl)}
  `;
  return { subject: `${urgencyLabel}: ISF deadline in ${hours}h — ${bol}`, html: wrapTemplate(body) };
}
