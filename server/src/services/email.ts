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
import { LOGO_MARK_NAVY_PNG_B64 } from './emailAssets.js';

// ─── Brand tokens (design system: navy + gold, two-color discipline) ──
// Kept as plain hex here because email clients don't support CSS variables.
// Source of truth is the design system (colors_and_type.css); these are the
// resolved hex values for the tokens the emails actually use.
const BRAND = {
  navy:      '#1E2D4D', // primary — headings, buttons, logo frame
  navyDeep:  '#14213D', // app-icon navy / darkest ink
  gold:      '#FBBE24', // accent — the single gold (logo subject, hairline)
  goldText:  '#D8920F', // gold that stays legible as text/links on white
  ink:       '#1E293B', // body heading ink
  body:      '#475569', // body copy
  muted:     '#64748B', // secondary/meta copy
  faint:     '#94A3B8', // fine print
  border:    '#E5E7EB', // hairlines
  surface:   '#F5F6F8', // page background behind the card
  subtle:    '#F8FAFC', // inset panels (code blocks, tables)
  // Semantic statuses (used only in structure: rails, pills, banners)
  success:   '#059669',
  warning:   '#D97706',
  danger:    '#DC2626',
} as const;

// The logo is attached inline to every email via this Content-ID and referenced
// as <img src="cid:mcl-logo">. CID beats a hosted URL here: it renders even with
// remote images blocked, needs no public asset host, and can't 404.
const LOGO_CID = 'mcl-logo';

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
  cc?: string | string[];
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
      ...(options.cc ? { cc: Array.isArray(options.cc) ? options.cc.join(', ') : options.cc } : {}),
      subject: options.subject,
      html: options.html,
      text: options.text ?? stripHtml(options.html),
      // Brand logo, embedded inline (referenced as cid:mcl-logo in the header).
      // `content` is the compiled-in base64 → no filesystem/host dependency.
      attachments: [
        {
          filename: 'mycargolens.png',
          content: Buffer.from(LOGO_MARK_NAVY_PNG_B64, 'base64'),
          contentType: 'image/png',
          cid: LOGO_CID,
          contentDisposition: 'inline',
        },
      ],
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

const FONT_STACK =
  "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

function wrapTemplate(body: string): string {
  return `
<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <meta name="color-scheme" content="light" />
  <meta name="supported-color-schemes" content="light" />
  <!--[if mso]><style>* { font-family: 'Segoe UI', Arial, sans-serif !important; }</style><![endif]-->
  <style>
    /* Inter as progressive enhancement — clients that ignore it fall back cleanly. */
    @import url('https://fonts.googleapis.com/css2?family=Inter:opsz,wght@14..32,300..800&display=swap');
    a { color: ${BRAND.goldText}; }
    .mcl-body-cell { padding: 36px 40px !important; }
    @media only screen and (max-width: 600px) {
      .mcl-card { width: 100% !important; border-radius: 0 !important; }
      .mcl-body-cell { padding: 28px 22px !important; }
      .mcl-header-cell { padding: 22px 22px !important; }
    }
  </style>
</head>
<body style="margin:0; padding:0; width:100%; font-family:${FONT_STACK}; background-color:${BRAND.surface}; color:${BRAND.body}; -webkit-font-smoothing:antialiased;">
  <!-- preheader spacer keeps inbox previews clean -->
  <div style="display:none; max-height:0; overflow:hidden; opacity:0;">&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BRAND.surface}; padding:40px 0;">
    <tr>
      <td align="center">
        <table role="presentation" width="560" cellpadding="0" cellspacing="0" class="mcl-card" style="width:560px; max-width:560px; background:#ffffff; border:1px solid ${BRAND.border}; border-radius:16px; overflow:hidden; box-shadow:0 1px 2px rgba(20,33,61,0.04), 0 8px 24px rgba(20,33,61,0.06);">
          <!-- Header: Focus Frame mark + wordmark on white, calm and minimal -->
          <tr>
            <td class="mcl-header-cell" style="padding:26px 40px 22px;">
              <table role="presentation" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="vertical-align:middle; padding-right:11px;">
                    <img src="cid:${LOGO_CID}" width="30" height="30" alt="MyCargoLens" style="display:block; width:30px; height:30px; border:0;" />
                  </td>
                  <td style="vertical-align:middle;">
                    <span style="font-family:${FONT_STACK}; font-size:18px; font-weight:700; letter-spacing:-0.02em; color:${BRAND.navy};">MyCargo</span><span style="font-family:${FONT_STACK}; font-size:18px; font-weight:700; letter-spacing:-0.02em; color:${BRAND.goldText};">Lens</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <!-- Gold hairline accent — the single gold, leading the content -->
          <tr>
            <td style="padding:0 40px;">
              <div style="height:2px; width:44px; background:${BRAND.gold}; border-radius:2px;"></div>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td class="mcl-body-cell" style="padding:28px 40px 36px;">
              ${body}
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding:22px 40px 26px; background:${BRAND.subtle}; border-top:1px solid ${BRAND.border};">
              <p style="margin:0 0 6px; font-size:12px; font-weight:600; color:${BRAND.navy};">
                An inbox for US customs. Not another dashboard.
              </p>
              <p style="margin:0; font-size:12px; color:${BRAND.faint}; line-height:1.6;">
                Sent by MyCargoLens — the CBP compliance platform for modern importers.<br/>
                If you didn't expect this email, you can safely ignore it.
              </p>
            </td>
          </tr>
        </table>
        <p style="margin:16px 0 0; font-size:11px; color:${BRAND.faint};">© ${new Date().getFullYear()} MyCargoLens</p>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/**
 * Primary call-to-action button. Table + VML wrapper so it renders as a solid
 * filled button in Outlook (which ignores padding on <a>) as well as everywhere
 * else. Navy is the product primary; pass variant 'gold' for the rare
 * highest-emphasis action (a gold glow ring, used sparingly).
 */
function buttonHtml(text: string, url: string, variant: 'navy' | 'gold' = 'navy'): string {
  const bg = variant === 'gold' ? BRAND.gold : BRAND.navy;
  const fg = variant === 'gold' ? BRAND.navyDeep : '#ffffff';
  return `
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:26px 0;">
      <tr>
        <td align="center" style="border-radius:12px; background:${bg};">
          <!--[if mso]>
          <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${url}" style="height:46px;v-text-anchor:middle;width:280px;" arcsize="26%" fillcolor="${bg}" stroke="f">
          <center style="color:${fg};font-family:${FONT_STACK};font-size:15px;font-weight:600;">${text}</center>
          </v:roundrect>
          <![endif]-->
          <!--[if !mso]><!-- -->
          <a href="${url}" target="_blank" style="display:inline-block; padding:13px 30px; color:${fg}; font-family:${FONT_STACK}; font-size:15px; font-weight:600; text-decoration:none; border-radius:12px;">
            ${text}
          </a>
          <!--<![endif]-->
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
    <h2 style="margin:0 0 16px; font-size:20px; color:#14213D;">You're invited to join ${params.organizationName}</h2>
    <p style="margin:0 0 8px; font-size:15px; line-height:1.6; color:#475569;">
      <strong>${params.inviterName}</strong> has invited you to join <strong>${params.organizationName}</strong>
      on MyCargoLens as a <strong style="text-transform:capitalize;">${params.role}</strong>.
    </p>
    <p style="margin:0 0 16px; font-size:15px; line-height:1.6; color:#475569;">
      MyCargoLens helps import teams manage ISF 10+2 filings with U.S. Customs and Border Protection.
    </p>
    ${buttonHtml('Accept invitation', inviteUrl)}
    <p style="margin:0; font-size:13px; color:#94a3b8;">
      This invitation expires in 7 days. If the button doesn't work, paste this link in your browser:<br/>
      <a href="${inviteUrl}" style="color:#1E2D4D; word-break:break-all;">${inviteUrl}</a>
    </p>
  `;

  return sendMail({
    to: params.to,
    subject: `${params.inviterName} invited you to ${params.organizationName} — MyCargoLens`,
    html: wrapTemplate(body),
  });
}

/**
 * Account Setup Email — sent to a newly provisioned client owner (sales-led
 * onboarding) so they can set their first password via a one-time link.
 */
export async function sendAccountSetupEmail(params: {
  to: string;
  firstName?: string | null;
  organizationName: string;
  planName: string;
  setupToken: string;
  expiresInDays: number;
}): Promise<boolean> {
  const setupUrl = `${env.FRONTEND_URL}/set-password?token=${params.setupToken}`;
  const greeting = params.firstName ? `Hi ${params.firstName},` : 'Welcome,';

  const body = `
    <h2 style="margin:0 0 16px; font-size:20px; color:#14213D;">Your MyCargoLens account is ready</h2>
    <p style="margin:0 0 8px; font-size:15px; line-height:1.6; color:#475569;">${greeting}</p>
    <p style="margin:0 0 16px; font-size:15px; line-height:1.6; color:#475569;">
      We've set up <strong>${params.organizationName}</strong> on MyCargoLens on the
      <strong>${params.planName}</strong> plan. Set your password to get started.
    </p>
    ${buttonHtml('Set your password', setupUrl)}
    <p style="margin:0; font-size:13px; color:#94a3b8;">
      This link expires in ${params.expiresInDays} days. If the button doesn't work, paste this link in your browser:<br/>
      <a href="${setupUrl}" style="color:#1E2D4D; word-break:break-all;">${setupUrl}</a>
    </p>
  `;

  return sendMail({
    to: params.to,
    subject: `Set up your ${params.organizationName} account — MyCargoLens`,
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
    <h2 style="margin:0 0 16px; font-size:20px; color:#14213D;">Filing accepted</h2>
    <p style="margin:0 0 16px; font-size:15px; line-height:1.6; color:#475569;">
      Your ISF filing <strong>${params.bolNumber}</strong> has been <strong style="color:#16a34a;">accepted</strong> by U.S. Customs and Border Protection.
    </p>
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 16px; font-size:14px; color:#475569;">
      <tr><td style="padding:4px 16px 4px 0; font-weight:600;">BOL Number</td><td>${params.bolNumber}</td></tr>
      ${params.cbpTransactionId ? `<tr><td style="padding:4px 16px 4px 0; font-weight:600;">CBP Transaction ID</td><td>${params.cbpTransactionId}</td></tr>` : ''}
    </table>
    ${buttonHtml('View filing details', dashboardUrl)}
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
    <h2 style="margin:0 0 16px; font-size:20px; color:#14213D;">Filing rejected</h2>
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
    ${buttonHtml('Review filing', dashboardUrl)}
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
    <h2 style="margin:0 0 16px; font-size:20px; color:#14213D;">${pill}Filing deadline approaching</h2>
    <p style="margin:0 0 16px; font-size:15px; line-height:1.6; color:#475569;">
      ISF filing <strong>${params.bolNumber}</strong> must be submitted within
      <strong style="color:${urgencyColor};">${params.hoursRemaining} hours</strong>.
    </p>
    <div style="margin:0 0 16px; padding:12px 16px; background:${urgencyBg}; border-left:4px solid ${urgencyColor}; border-radius:4px;">
      <p style="margin:0; font-size:14px; color:#92400e;">
        ISF filings must be submitted at least 24 hours before cargo is loaded onto a vessel destined for the United States. Late filings may result in penalties.
      </p>
    </div>
    ${buttonHtml('Submit filing now', dashboardUrl)}
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
    <h2 style="margin:0 0 16px; font-size:20px; color:#14213D;">Filing submitted</h2>
    <p style="margin:0 0 16px; font-size:15px; line-height:1.6; color:#475569;">
      <strong>${params.submitterName}</strong> has submitted ISF filing <strong>${params.bolNumber}</strong> to CBP.
    </p>
    <p style="margin:0 0 16px; font-size:15px; line-height:1.6; color:#475569;">
      The filing is now being processed. You'll receive a notification when CBP responds with an acceptance or rejection.
    </p>
    ${buttonHtml('Track filing status', dashboardUrl)}
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
    <h2 style="margin:0 0 16px; font-size:20px; color:#14213D;">Welcome to MyCargoLens, ${params.firstName}.</h2>
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
    ${buttonHtml('Go to dashboard', dashboardUrl)}
  `;

  return sendMail({
    to: params.to,
    subject: `Welcome to MyCargoLens`,
    html: wrapTemplate(body),
  });
}

/**
 * Test email — used from the Integrations page to verify SMTP config
 */
export async function sendTestEmail(to: string): Promise<boolean> {
  const body = `
    <h2 style="margin:0 0 16px; font-size:20px; color:#14213D;">Email configuration test</h2>
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

/**
 * Email Verification — 6-digit one-time code (Stripe/Linear/Vercel pattern).
 *
 * The code itself is the primary affordance; we also include a one-click
 * verify link as a fallback so users who can't easily type into the app
 * (e.g. signed up on mobile, opens email on desktop) still have a path.
 *
 * Body deliberately avoids emoji and uses a high-contrast monospace block
 * for the digits — calm, professional, scans well in dark-mode inboxes.
 */
export async function sendVerificationCodeEmail(params: {
  to: string;
  firstName?: string | null;
  code: string;
  expiresInMin: number;
}): Promise<boolean> {
  const verifyUrl = `${env.FRONTEND_URL}/verify-email?code=${encodeURIComponent(params.code)}`;
  // Split the code into 3+3 for legibility — same trick Stripe uses.
  const codeFormatted = `${params.code.slice(0, 3)}&nbsp;&nbsp;${params.code.slice(3)}`;
  const greeting = params.firstName ? `Hi ${params.firstName},` : 'Hi there,';

  const body = `
    <h2 style="margin:0 0 12px; font-size:20px; font-weight:600; color:#14213D;">Verify your email address</h2>
    <p style="margin:0 0 20px; font-size:15px; line-height:1.6; color:#475569;">
      ${greeting} thanks for joining MyCargoLens. Enter the verification code below to confirm your email and finish setting up your account.
    </p>

    <!-- Code block -->
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto 24px; border-collapse:separate;">
      <tr>
        <td style="
          padding:20px 32px;
          background:#f8fafc;
          border:1px solid #e2e8f0;
          border-radius:10px;
          text-align:center;
        ">
          <div style="font-size:11px; font-weight:600; letter-spacing:0.12em; text-transform:uppercase; color:#64748b; margin-bottom:8px;">
            Verification code
          </div>
          <div style="font-family: ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, monospace; font-size:32px; font-weight:600; letter-spacing:0.18em; color:#14213D; line-height:1;">
            ${codeFormatted}
          </div>
        </td>
      </tr>
    </table>

    <p style="margin:0 0 20px; font-size:14px; line-height:1.6; color:#475569; text-align:center;">
      This code expires in <strong>${params.expiresInMin} minutes</strong>.
    </p>

    <p style="margin:0 0 8px; font-size:13px; line-height:1.6; color:#64748b; text-align:center;">
      Or click the button below to verify in one tap:
    </p>
    ${buttonHtml('Verify email', verifyUrl)}

    <hr style="margin:28px 0 16px; border:none; border-top:1px solid #e2e8f0;" />
    <p style="margin:0; font-size:12px; line-height:1.6; color:#94a3b8;">
      If you didn't sign up for MyCargoLens, you can safely ignore this email — no account will be created without confirming this code.
    </p>
  `;

  return sendMail({
    to: params.to,
    subject: `Your MyCargoLens verification code: ${params.code}`,
    html: wrapTemplate(body),
  });
}

/**
 * MFA sign-in code (email OTP fallback). Same 6-digit code block styling as the
 * email-verification template — different heading + purpose.
 */
export async function sendMfaCodeEmail(params: {
  to: string;
  firstName?: string | null;
  code: string;
  expiresInMin: number;
}): Promise<boolean> {
  const codeFormatted = `${params.code.slice(0, 3)}&nbsp;&nbsp;${params.code.slice(3)}`;
  const greeting = params.firstName ? `Hi ${params.firstName},` : 'Hi there,';

  const body = `
    <h2 style="margin:0 0 12px; font-size:20px; font-weight:600; color:#14213D;">Your sign-in code</h2>
    <p style="margin:0 0 20px; font-size:15px; line-height:1.6; color:#475569;">
      ${greeting} use the code below to finish signing in to MyCargoLens.
    </p>

    <!-- Code block -->
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto 24px; border-collapse:separate;">
      <tr>
        <td style="
          padding:20px 32px;
          background:#f8fafc;
          border:1px solid #e2e8f0;
          border-radius:10px;
          text-align:center;
        ">
          <div style="font-size:11px; font-weight:600; letter-spacing:0.12em; text-transform:uppercase; color:#64748b; margin-bottom:8px;">
            Sign-in code
          </div>
          <div style="font-family: ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, monospace; font-size:32px; font-weight:600; letter-spacing:0.18em; color:#14213D; line-height:1;">
            ${codeFormatted}
          </div>
        </td>
      </tr>
    </table>

    <p style="margin:0 0 20px; font-size:14px; line-height:1.6; color:#475569; text-align:center;">
      This code expires in <strong>${params.expiresInMin} minutes</strong>.
    </p>

    <hr style="margin:28px 0 16px; border:none; border-top:1px solid #e2e8f0;" />
    <p style="margin:0; font-size:12px; line-height:1.6; color:#94a3b8;">
      If you didn't try to sign in, someone may have your password — change it and contact support@mycargolens.com.
    </p>
  `;

  return sendMail({
    to: params.to,
    subject: `Your MyCargoLens sign-in code: ${params.code}`,
    html: wrapTemplate(body),
  });
}

/**
 * Security notice: two-factor authentication was enabled on the account.
 */
export async function sendMfaEnabledEmail(params: {
  to: string;
  firstName?: string | null;
}): Promise<boolean> {
  const greeting = params.firstName ? `Hi ${params.firstName},` : 'Hi there,';
  const body = `
    <h2 style="margin:0 0 12px; font-size:20px; font-weight:600; color:#14213D;">Two-factor authentication enabled</h2>
    <p style="margin:0 0 16px; font-size:15px; line-height:1.6; color:#475569;">
      ${greeting} two-factor authentication (2FA) was just turned on for your MyCargoLens account.
      From now on you'll enter a code from your authenticator app when you sign in.
    </p>
    <p style="margin:0 0 16px; font-size:15px; line-height:1.6; color:#475569;">
      Keep your recovery codes somewhere safe — they're the way back in if you lose your device.
    </p>
    <hr style="margin:24px 0 16px; border:none; border-top:1px solid #e2e8f0;" />
    <p style="margin:0; font-size:13px; line-height:1.6; color:#64748b;">
      If this wasn't you, your account may be compromised — contact support@mycargolens.com right away.
    </p>
  `;

  return sendMail({
    to: params.to,
    subject: 'Two-factor authentication was enabled on your account',
    html: wrapTemplate(body),
  });
}

/**
 * Security notice: two-factor authentication was disabled on the account.
 */
export async function sendMfaDisabledEmail(params: {
  to: string;
  firstName?: string | null;
}): Promise<boolean> {
  const greeting = params.firstName ? `Hi ${params.firstName},` : 'Hi there,';
  const body = `
    <h2 style="margin:0 0 12px; font-size:20px; font-weight:600; color:#14213D;">Two-factor authentication disabled</h2>
    <p style="margin:0 0 16px; font-size:15px; line-height:1.6; color:#475569;">
      ${greeting} two-factor authentication (2FA) was just turned off for your MyCargoLens account.
      Your account is now protected by your password alone.
    </p>
    <p style="margin:0 0 16px; font-size:15px; line-height:1.6; color:#475569;">
      We recommend keeping 2FA on. You can re-enable it any time from Settings → Password &amp; Security.
    </p>
    <hr style="margin:24px 0 16px; border:none; border-top:1px solid #e2e8f0;" />
    <p style="margin:0; font-size:13px; line-height:1.6; color:#64748b;">
      If this wasn't you, your account may be compromised — contact support@mycargolens.com right away.
    </p>
  `;

  return sendMail({
    to: params.to,
    subject: 'Two-factor authentication was disabled on your account',
    html: wrapTemplate(body),
  });
}

/**
 * Security notice: a recovery code was used to sign in / recover the account.
 */
export async function sendMfaRecoveryCodeUsedEmail(params: {
  to: string;
  firstName?: string | null;
  remainingCodes: number;
}): Promise<boolean> {
  const greeting = params.firstName ? `Hi ${params.firstName},` : 'Hi there,';
  const lowWarning =
    params.remainingCodes <= 2
      ? `<p style="margin:0 0 16px; font-size:15px; line-height:1.6; color:#b45309;">
           You're running low on recovery codes. Generate a fresh set from
           Settings → Password &amp; Security so you don't get locked out.
         </p>`
      : '';
  const body = `
    <h2 style="margin:0 0 12px; font-size:20px; font-weight:600; color:#14213D;">A recovery code was used</h2>
    <p style="margin:0 0 16px; font-size:15px; line-height:1.6; color:#475569;">
      ${greeting} one of your MyCargoLens recovery codes was just used to sign in.
      You have <strong>${params.remainingCodes}</strong> recovery ${
        params.remainingCodes === 1 ? 'code' : 'codes'
      } left.
    </p>
    ${lowWarning}
    <hr style="margin:24px 0 16px; border:none; border-top:1px solid #e2e8f0;" />
    <p style="margin:0; font-size:13px; line-height:1.6; color:#64748b;">
      If this wasn't you, your account may be compromised — contact support@mycargolens.com right away.
    </p>
  `;

  return sendMail({
    to: params.to,
    subject: 'A recovery code was used on your account',
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
  info:     '#1E2D4D',
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
    <h2 style="margin:0 0 16px; font-size:20px; color:#14213D;">${n.title}</h2>
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
    <h2 style="margin:0 0 16px; font-size:20px; color:#14213D;">Filing submitted</h2>
    <p style="margin:0 0 16px; font-size:15px; line-height:1.6; color:#475569;">
      Your ISF filing <strong>${bol}</strong> has been submitted to U.S. Customs and Border Protection. We'll let you know as soon as we hear back.
    </p>
    ${buttonHtml('View filing', dashboardUrl)}
  `;
  return { subject: `ISF filing submitted — ${bol}`, html: wrapTemplate(body) };
}

function renderFilingAccepted(n: RenderableNotification): RenderedEmail {
  const bol = meta(n, 'bolNumber') ?? 'unknown';
  const cbpTxn = meta(n, 'cbpTransactionId');
  const dashboardUrl = n.linkUrl ? `${env.FRONTEND_URL}${n.linkUrl}` : env.FRONTEND_URL;
  const body = `
    <h2 style="margin:0 0 16px; font-size:20px; color:#14213D;">Filing accepted</h2>
    <p style="margin:0 0 16px; font-size:15px; line-height:1.6; color:#475569;">
      Your ISF filing <strong>${bol}</strong> has been <strong style="color:#16a34a;">accepted</strong> by U.S. Customs and Border Protection.
    </p>
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 16px; font-size:14px; color:#475569;">
      <tr><td style="padding:4px 16px 4px 0; font-weight:600;">BOL Number</td><td>${bol}</td></tr>
      ${cbpTxn ? `<tr><td style="padding:4px 16px 4px 0; font-weight:600;">CBP Transaction ID</td><td>${cbpTxn}</td></tr>` : ''}
    </table>
    ${buttonHtml('View filing details', dashboardUrl)}
  `;
  return { subject: `ISF filing accepted — ${bol}`, html: wrapTemplate(body) };
}

function renderFilingRejected(n: RenderableNotification): RenderedEmail {
  const bol = meta(n, 'bolNumber') ?? 'unknown';
  const reason = meta(n, 'reason');
  const dashboardUrl = n.linkUrl ? `${env.FRONTEND_URL}${n.linkUrl}` : env.FRONTEND_URL;
  const body = `
    <h2 style="margin:0 0 16px; font-size:20px; color:#14213D;">Filing rejected</h2>
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
    ${buttonHtml('Review filing', dashboardUrl)}
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
    <h2 style="margin:0 0 16px; font-size:20px; color:#14213D;">${pill}Filing deadline in ${hours}h</h2>
    <p style="margin:0 0 16px; font-size:15px; line-height:1.6; color:#475569;">
      Your ISF filing <strong>${bol}</strong> deadline is in <strong>${hours} hours</strong>.
      Submit soon to avoid CBP penalties ($5,000–$10,000).
    </p>
    ${buttonHtml('Open filing', dashboardUrl)}
  `;
  return { subject: `${urgencyLabel}: ISF deadline in ${hours}h — ${bol}`, html: wrapTemplate(body) };
}
