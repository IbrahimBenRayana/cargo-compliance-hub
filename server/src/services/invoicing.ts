/**
 * Monthly invoicing for invoiced accounts (pricing plan v2 §8.2, Phase 1).
 *
 * An invoiced org is never charged per filing: each accepted shipment is
 * recorded 'accrued' at its locked price (shipmentBilling.ts). At month end a
 * platform admin previews the month, then creates a DRAFT Stripe invoice from
 * it in /admin; it's reviewed and finalized in the Stripe dashboard, and Stripe
 * debits the saved US bank account (ACH Direct Debit) or emails a hosted
 * invoice payable by ACH. Stripe Invoicing does the collecting, reminders and
 * receipts; we only rate the month (invoiceRating.ts).
 *
 * Kinds:
 *   usage  — a closed UTC month, in arrears: minimum + ISFs above the included
 *            count + entries. Rows move accrued → invoiced.
 *   prepay — a month's minimum in advance (a pilot's first month). That
 *            month's usage invoice then leaves the minimum out.
 */
import type Stripe from 'stripe';
import { prisma } from '../config/database.js';
import { getStripe, stripeConfigured, createStripeCustomer } from './stripe.js';
import { rateMonth, prepayLines, monthWindow, periodLabel, type InvoiceLine, type RatedRow } from './invoiceRating.js';
import type { ChargeKind } from './pricing.js';
import { env } from '../config/env.js';
import logger from '../config/logger.js';

export type InvoiceKind = 'usage' | 'prepay';

/** Statuses that mean "this month's minimum was really billed in advance". */
const LIVE_INVOICE = ['creating', 'draft', 'open', 'paid'];

interface Terms {
  minimumCents: number;
  includedIsfs: number;
  billingStartsOn: Date | null;
}

function termsOf(sub: { monthlyMinimumCents: number | null; includedIsfs: number | null; billingStartsOn: Date | null }): Terms {
  return { minimumCents: sub.monthlyMinimumCents ?? 0, includedIsfs: sub.includedIsfs ?? 0, billingStartsOn: sub.billingStartsOn };
}

/** Nothing before the org's billing start date is invoiced (the pilot's
 *  billing clock starts at its first production filing, or at day 90). */
function billableFrom(start: Date, terms: Terms): Date {
  return terms.billingStartsOn && terms.billingStartsOn > start ? terms.billingStartsOn : start;
}

/** The month as it would be invoiced now: rated lines + the rows behind them. */
export async function previewMonth(orgId: string, periodStart: Date) {
  const sub = await prisma.subscription.findUnique({ where: { orgId } });
  if (!sub) return null;
  const terms = termsOf(sub);
  const { start, end } = monthWindow(periodStart);
  const from = billableFrom(start, terms);
  const minimumApplies = from < end;
  const rows = minimumApplies
    ? await prisma.shipmentCharge.findMany({
        where: { orgId, status: 'accrued', invoiceId: null, billedAt: { gte: from, lt: end } },
        select: { id: true, kind: true, amountCents: true, billedAt: true },
      })
    : [];
  const prepay = await prisma.billingInvoice.findUnique({
    where: { orgId_periodStart_kind: { orgId, periodStart: start, kind: 'prepay' } },
  });
  const rated = rateMonth(rows as Array<RatedRow & { id: string }>, {
    minimumCents: minimumApplies ? terms.minimumCents : 0,
    includedIsfs: terms.includedIsfs,
    minimumPrepaid: !!prepay && LIVE_INVOICE.includes(prepay.status),
  });
  return { billingMode: sub.billingMode, terms, period: { start, end }, closed: end <= new Date(), rows, ...rated };
}

export type InvoiceOutcome =
  | { ok: true; invoice: { id: string; stripeInvoiceId: string; totalCents: number; dashboardUrl: string } }
  | { ok: false; httpStatus: number; error: string };

/** Link to a Stripe invoice in the dashboard (test or live, from the key). */
export function stripeDashboardUrl(stripeInvoiceId: string): string {
  const test = env.STRIPE_SECRET_KEY.startsWith('sk_test_');
  return `https://dashboard.stripe.com/${test ? 'test/' : ''}invoices/${stripeInvoiceId}`;
}

/**
 * Create one month's DRAFT Stripe invoice for an invoiced org. Idempotent: one
 * invoice per (org, month, kind) — the unique row is claimed first, and every
 * Stripe call carries a key derived from it, so retrying a failed attempt
 * re-uses the same Stripe objects instead of creating new ones.
 */
export async function createMonthlyInvoice(opts: {
  orgId: string;
  periodStart: Date;
  kind: InvoiceKind;
  createdById: string;
}): Promise<InvoiceOutcome> {
  const { orgId, periodStart, kind } = opts;
  if (!stripeConfigured()) return { ok: false, httpStatus: 503, error: 'Stripe is not configured.' };

  const sub = await prisma.subscription.findUnique({ where: { orgId }, include: { organization: true } });
  if (!sub) return { ok: false, httpStatus: 404, error: 'This organization has no plan.' };
  if (sub.billingMode !== 'invoiced') return { ok: false, httpStatus: 400, error: 'This organization is billed by card, not invoiced.' };

  const existing = await prisma.billingInvoice.findUnique({
    where: { orgId_periodStart_kind: { orgId, periodStart, kind } },
  });
  if (existing && existing.status !== 'error') {
    return { ok: false, httpStatus: 409, error: `This month already has a ${kind} invoice (${existing.status}).` };
  }

  let lines: InvoiceLine[];
  let rowIds: string[] = [];
  const label = periodLabel(periodStart);
  if (kind === 'usage') {
    const preview = await previewMonth(orgId, periodStart);
    if (!preview!.closed) return { ok: false, httpStatus: 400, error: 'A usage invoice can only be made once the month has ended (UTC).' };
    lines = preview!.lines;
    rowIds = preview!.rows.map((r) => r.id);
  } else {
    lines = prepayLines(termsOf(sub), label);
  }
  const totalCents = lines.reduce((n, l) => n + l.amountCents, 0);
  if (lines.length === 0 || totalCents <= 0) return { ok: false, httpStatus: 400, error: 'Nothing to invoice for this month.' };

  // Claim the (org, month, kind) slot. A concurrent click hits the unique index.
  let record;
  try {
    record = existing
      ? await prisma.billingInvoice.update({ where: { id: existing.id }, data: { status: 'creating', lines: lines as never, totalCents, lastError: null } })
      : await prisma.billingInvoice.create({
          data: { orgId, periodStart, kind, status: 'creating', lines: lines as never, totalCents, createdById: opts.createdById },
        });
  } catch {
    return { ok: false, httpStatus: 409, error: 'This invoice is already being created.' };
  }

  try {
    const stripe = getStripe();
    let customerId = sub.stripeCustomerId;
    if (!customerId) {
      const owner = await prisma.user.findFirst({ where: { orgId, role: 'owner', isActive: true }, select: { email: true } });
      customerId = await createStripeCustomer({ orgId, email: owner?.email, name: sub.organization.name });
      await prisma.subscription.update({ where: { orgId }, data: { stripeCustomerId: customerId } });
    }
    const key = `mcl-invoice-${record.id}`;
    const period = periodStart.toISOString().slice(0, 7);
    const debit = !!sub.achPaymentMethodId;
    const params: Stripe.InvoiceCreateParams = {
      customer: customerId,
      currency: 'usd',
      auto_advance: false, // a draft: reviewed and finalized in the Stripe dashboard
      pending_invoice_items_behavior: 'exclude',
      payment_settings: { payment_method_types: ['us_bank_account'] },
      description: kind === 'prepay' ? `MyCargoLens: ${label}, paid in advance` : `MyCargoLens: ${label}`,
      metadata: { orgId, billingInvoiceId: record.id, period, kind },
      ...(debit
        ? { collection_method: 'charge_automatically', default_payment_method: sub.achPaymentMethodId! }
        : { collection_method: 'send_invoice', days_until_due: 14 }),
    };
    const invoice = await stripe.invoices.create(params, { idempotencyKey: key });
    for (const [i, line] of lines.entries()) {
      await stripe.invoiceItems.create(
        { customer: customerId, invoice: invoice.id, currency: 'usd', amount: line.amountCents, description: line.description },
        { idempotencyKey: `${key}-line-${i}` },
      );
    }

    await prisma.$transaction([
      prisma.shipmentCharge.updateMany({
        where: { id: { in: rowIds }, status: 'accrued', invoiceId: null },
        data: { status: 'invoiced', invoiceId: record.id },
      }),
      prisma.billingInvoice.update({ where: { id: record.id }, data: { status: 'draft', stripeInvoiceId: invoice.id! } }),
    ]);
    logger.info({ orgId, kind, period, totalCents, stripeInvoiceId: invoice.id }, '✓ Monthly invoice drafted');
    return { ok: true, invoice: { id: record.id, stripeInvoiceId: invoice.id!, totalCents, dashboardUrl: stripeDashboardUrl(invoice.id!) } };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await prisma.billingInvoice.update({ where: { id: record.id }, data: { status: 'error', lastError: message.slice(0, 500) } }).catch(() => {});
    logger.error({ orgId, kind, err: message }, '[Invoicing] Could not create the Stripe invoice');
    return { ok: false, httpStatus: 502, error: `Stripe error: ${message}. Try again: the retry re-uses the same invoice.` };
  }
}

/** Mirror a Stripe invoice's status (webhook: invoice.finalized/paid/...). */
export async function syncInvoiceStatus(stripeInvoiceId: string, status: string | null | undefined): Promise<void> {
  if (!status) return;
  await prisma.billingInvoice.updateMany({ where: { stripeInvoiceId }, data: { status } });
}

// ─── Usage export (CSV) ─────────────────────────────────────────────────────

const csvCell = (v: unknown) => {
  const s = v == null ? '' : String(v);
  // Quote, and neutralise spreadsheet formulas (CSV injection).
  const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
  return /[",\n']/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
};

const KIND_LABEL: Record<ChargeKind, string> = { isf: 'ISF', entry_linked: 'Entry (on an ISF)', entry: 'Entry' };

/** Every accepted shipment in a UTC month, one row each, for the monthly
 *  statement or for rating by hand. */
export async function usageCsv(orgId: string, periodStart: Date): Promise<string> {
  const { start, end } = monthWindow(periodStart);
  const rows = await prisma.shipmentCharge.findMany({
    where: { orgId, billedAt: { gte: start, lt: end } },
    orderBy: { billedAt: 'asc' },
    include: {
      filing: { select: { houseBol: true, masterBol: true } },
      abiDocument: { select: { entryNumber: true, mbolNumber: true } },
      invoice: { select: { stripeInvoiceId: true } },
    },
  });
  const header = ['accepted_at_utc', 'type', 'reference', 'filing_id', 'abi_document_id', 'amount_usd', 'status', 'stripe_invoice'];
  const body = rows.map((r) => [
    r.billedAt.toISOString(),
    KIND_LABEL[r.kind as ChargeKind] ?? r.kind,
    r.filing ? (r.filing.houseBol || r.filing.masterBol || '') : (r.abiDocument?.entryNumber || r.abiDocument?.mbolNumber || ''),
    r.filingId ?? '',
    r.abiDocumentId ?? '',
    (r.amountCents / 100).toFixed(2),
    r.status,
    r.invoice?.stripeInvoiceId ?? '',
  ].map(csvCell).join(','));
  return [header.join(','), ...body].join('\n') + '\n';
}
