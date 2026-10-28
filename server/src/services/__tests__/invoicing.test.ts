/** Monthly Stripe invoices for invoiced (pilot) accounts — pricing plan v2 §8.2. */
import { describe, it, expect, beforeEach, vi } from 'vitest';

const { prisma, stripeApi, stripeMod } = vi.hoisted(() => {
  const stripeApi = { invoices: { create: vi.fn() }, invoiceItems: { create: vi.fn() } };
  return {
    prisma: {
      subscription: { findUnique: vi.fn(), update: vi.fn() },
      shipmentCharge: { findMany: vi.fn(), updateMany: vi.fn() },
      billingInvoice: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
      user: { findFirst: vi.fn() },
      $transaction: vi.fn((ops: unknown[]) => Promise.all(ops)),
    },
    stripeApi,
    stripeMod: { getStripe: () => stripeApi, stripeConfigured: vi.fn(() => true), createStripeCustomer: vi.fn(() => Promise.resolve('cus_new')) },
  };
});
vi.mock('../../config/database.js', () => ({ prisma }));
vi.mock('../stripe.js', () => stripeMod);
vi.mock('../../config/logger.js', () => ({ default: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));

import { createMonthlyInvoice, previewMonth, usageCsv } from '../invoicing.js';

const SEP = new Date('2026-09-01T00:00:00Z');
const SUB = {
  orgId: 'o1', billingMode: 'invoiced', monthlyMinimumCents: 25000, includedIsfs: 50, billingStartsOn: null,
  stripeCustomerId: 'cus_1', achPaymentMethodId: 'pm_bank', organization: { name: 'Acme NVOCC' },
};
const rows = (n: number) => Array.from({ length: n }, (_, i) => ({ id: `c${i}`, kind: 'isf', amountCents: 500, billedAt: new Date(Date.UTC(2026, 8, 1 + (i % 28))) }));

beforeEach(() => {
  vi.clearAllMocks();
  stripeMod.stripeConfigured.mockReturnValue(true);
  prisma.subscription.findUnique.mockResolvedValue(SUB);
  prisma.billingInvoice.findUnique.mockResolvedValue(null);
  prisma.billingInvoice.create.mockResolvedValue({ id: 'bi1' });
  prisma.billingInvoice.update.mockResolvedValue({});
  prisma.shipmentCharge.findMany.mockResolvedValue(rows(120));
  prisma.shipmentCharge.updateMany.mockResolvedValue({ count: 120 });
  stripeApi.invoices.create.mockResolvedValue({ id: 'in_1' });
  stripeApi.invoiceItems.create.mockResolvedValue({ id: 'ii' });
});

describe('createMonthlyInvoice (usage)', () => {
  it('drafts one Stripe invoice: minimum + overage, ACH debit, idempotent keys; rows → invoiced', async () => {
    const out = await createMonthlyInvoice({ orgId: 'o1', periodStart: SEP, kind: 'usage', createdById: 'u1' });
    expect(out).toMatchObject({ ok: true, invoice: { id: 'bi1', stripeInvoiceId: 'in_1', totalCents: 60000 } });

    const [params, opts] = stripeApi.invoices.create.mock.calls[0];
    expect(params).toMatchObject({
      customer: 'cus_1', currency: 'usd', auto_advance: false, collection_method: 'charge_automatically',
      default_payment_method: 'pm_bank', payment_settings: { payment_method_types: ['us_bank_account'] },
      metadata: { orgId: 'o1', billingInvoiceId: 'bi1', period: '2026-09', kind: 'usage' },
    });
    expect(opts).toEqual({ idempotencyKey: 'mcl-invoice-bi1' });
    expect(stripeApi.invoiceItems.create.mock.calls.map((c) => [c[0].amount, c[1].idempotencyKey])).toEqual([
      [25000, 'mcl-invoice-bi1-line-0'],
      [35000, 'mcl-invoice-bi1-line-1'],
    ]);
    expect(prisma.shipmentCharge.updateMany).toHaveBeenCalledWith({
      where: { id: { in: rows(120).map((r) => r.id) }, status: 'accrued', invoiceId: null },
      data: { status: 'invoiced', invoiceId: 'bi1' },
    });
  });

  it('no bank account saved → a hosted invoice payable by ACH, net 14', async () => {
    prisma.subscription.findUnique.mockResolvedValue({ ...SUB, achPaymentMethodId: null });
    await createMonthlyInvoice({ orgId: 'o1', periodStart: SEP, kind: 'usage', createdById: 'u1' });
    expect(stripeApi.invoices.create.mock.calls[0][0]).toMatchObject({ collection_method: 'send_invoice', days_until_due: 14 });
  });

  it('refuses a month that has not ended', async () => {
    const thisMonth = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1));
    const out = await createMonthlyInvoice({ orgId: 'o1', periodStart: thisMonth, kind: 'usage', createdById: 'u1' });
    expect(out).toMatchObject({ ok: false, httpStatus: 400 });
    expect(stripeApi.invoices.create).not.toHaveBeenCalled();
  });

  it('a month can only be invoiced once', async () => {
    prisma.billingInvoice.findUnique.mockResolvedValue({ id: 'bi0', status: 'draft' });
    const out = await createMonthlyInvoice({ orgId: 'o1', periodStart: SEP, kind: 'usage', createdById: 'u1' });
    expect(out).toMatchObject({ ok: false, httpStatus: 409 });
  });

  it('card-billed orgs are not invoiced', async () => {
    prisma.subscription.findUnique.mockResolvedValue({ ...SUB, billingMode: 'card' });
    expect(await createMonthlyInvoice({ orgId: 'o1', periodStart: SEP, kind: 'usage', createdById: 'u1' })).toMatchObject({ ok: false, httpStatus: 400 });
  });

  it('a Stripe error marks the invoice for retry and leaves the rows accrued', async () => {
    stripeApi.invoices.create.mockRejectedValue(new Error('boom'));
    const out = await createMonthlyInvoice({ orgId: 'o1', periodStart: SEP, kind: 'usage', createdById: 'u1' });
    expect(out).toMatchObject({ ok: false, httpStatus: 502 });
    expect(prisma.billingInvoice.update).toHaveBeenCalledWith({ where: { id: 'bi1' }, data: { status: 'error', lastError: 'boom' } });
    expect(prisma.shipmentCharge.updateMany).not.toHaveBeenCalled();
  });

  it('the retry re-uses the failed invoice row, so Stripe keys repeat (no duplicate invoice)', async () => {
    prisma.billingInvoice.findUnique.mockImplementation(({ where }: { where: { orgId_periodStart_kind: { kind: string } } }) =>
      Promise.resolve(where.orgId_periodStart_kind.kind === 'usage' ? { id: 'bi1', status: 'error' } : null));
    prisma.billingInvoice.update.mockResolvedValue({ id: 'bi1' });
    await createMonthlyInvoice({ orgId: 'o1', periodStart: SEP, kind: 'usage', createdById: 'u1' });
    expect(prisma.billingInvoice.create).not.toHaveBeenCalled();
    expect(stripeApi.invoices.create.mock.calls[0][1]).toEqual({ idempotencyKey: 'mcl-invoice-bi1' });
  });
});

describe('prepay and billing start', () => {
  it('a prepay invoice bills the minimum only', async () => {
    const out = await createMonthlyInvoice({ orgId: 'o1', periodStart: new Date('2027-01-01T00:00:00Z'), kind: 'prepay', createdById: 'u1' });
    expect(out).toMatchObject({ ok: true, invoice: { totalCents: 25000 } });
    expect(stripeApi.invoiceItems.create).toHaveBeenCalledTimes(1);
  });

  it("a prepaid month's usage invoice leaves the minimum out", async () => {
    prisma.billingInvoice.findUnique.mockImplementation(({ where }: { where: { orgId_periodStart_kind: { kind: string } } }) =>
      Promise.resolve(where.orgId_periodStart_kind.kind === 'prepay' ? { id: 'bp', status: 'paid' } : null));
    const p = await previewMonth('o1', SEP);
    expect(p!.lines.map((l) => l.code)).toEqual(['isf_overage']);
    expect(p!.totalCents).toBe(35000);
  });

  it('usage before billingStartsOn is not invoiced; a month wholly before it has no minimum', async () => {
    prisma.subscription.findUnique.mockResolvedValue({ ...SUB, billingStartsOn: new Date('2026-11-15T00:00:00Z') });
    const p = await previewMonth('o1', SEP);
    expect(p!.lines).toEqual([]);
    expect(prisma.shipmentCharge.findMany).not.toHaveBeenCalled();
  });

  it('rows are only counted from the start date within the start month', async () => {
    prisma.subscription.findUnique.mockResolvedValue({ ...SUB, billingStartsOn: new Date('2026-09-15T00:00:00Z') });
    await previewMonth('o1', SEP);
    expect(prisma.shipmentCharge.findMany.mock.calls[0][0].where.billedAt).toEqual({ gte: new Date('2026-09-15T00:00:00Z'), lt: new Date('2026-10-01T00:00:00Z') });
  });
});

describe('usageCsv', () => {
  it('one row per accepted shipment, formulas neutralised', async () => {
    prisma.shipmentCharge.findMany.mockResolvedValue([
      { billedAt: new Date('2026-10-02T10:00:00Z'), kind: 'isf', filingId: 'f1', abiDocumentId: null, amountCents: 500, status: 'accrued', filing: { houseBol: '=HYPERLINK("x")', masterBol: null }, abiDocument: null, invoice: null },
      { billedAt: new Date('2026-10-03T10:00:00Z'), kind: 'entry', filingId: null, abiDocumentId: 'd1', amountCents: 1500, status: 'invoiced', filing: null, abiDocument: { entryNumber: 'ABC-1234567-6', mbolNumber: null }, invoice: { stripeInvoiceId: 'in_1' } },
    ]);
    const csv = (await usageCsv('o1', SEP)).trim().split('\n');
    expect(csv[0]).toBe('accepted_at_utc,type,reference,filing_id,abi_document_id,amount_usd,status,stripe_invoice');
    expect(csv[1]).toBe(`2026-10-02T10:00:00.000Z,ISF,"'=HYPERLINK(""x"")",f1,,5.00,accrued,`);
    expect(csv[2]).toBe('2026-10-03T10:00:00.000Z,Entry,ABC-1234567-6,,d1,15.00,invoiced,in_1');
  });
});
