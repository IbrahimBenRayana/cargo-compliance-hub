/**
 * Foreign invoice values on native entries are converted with CBP's own
 * certified rates (audit ENG-02, BNA-04), only where the rate's direction
 * is proven, and the entry is refused rather than sent with a guessed value.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

const { prisma } = vi.hoisted(() => ({
  prisma: { cbpCurrencyRate: { findFirst: vi.fn(), createMany: vi.fn() } },
}));
vi.mock('../../../config/database.js', () => ({ prisma }));

import { convertInvoiceValuesToUsd, currencyRateHandler, CurrencyConversionError } from '../currency.js';

const body = (currency: string, amount: number) => ({
  dates: { importDate: '20261015' },
  manifest: [{ invoices: [{ exportDate: '20261009', items: [{ values: { currency, exchangeRate: 99, totalValueOfGoods: amount } }] }] }],
});

beforeEach(() => vi.clearAllMocks());

describe('convertInvoiceValuesToUsd', () => {
  it('leaves USD lines alone', async () => {
    const out = await convertInvoiceValuesToUsd(body('USD', 1000) as never);
    expect(out.body.manifest![0].invoices[0].items[0].values.totalValueOfGoods).toBe(1000);
    expect(out.conversions).toEqual([]);
  });

  it('converts EUR with CBP\'s certified rate for the export date (scenario 045 direction)', async () => {
    prisma.cbpCurrencyRate.findFirst.mockResolvedValue({ rate: '1.159200', rateDate: new Date('2026-10-09'), indicator: 'D' });
    const out = await convertInvoiceValuesToUsd(body('EUR', 5000) as never);
    expect(out.body.manifest![0].invoices[0].items[0].values.totalValueOfGoods).toBe(5796);
    expect(out.conversions[0]).toMatchObject({ currency: 'EUR', amount: 5000, usd: 5796, rate: 1.1592 });
  });

  it('never uses the user-typed exchange rate', async () => {
    prisma.cbpCurrencyRate.findFirst.mockResolvedValue({ rate: '1.000000', rateDate: new Date('2026-10-09'), indicator: 'D' });
    const out = await convertInvoiceValuesToUsd(body('EUR', 100) as never);
    expect(out.body.manifest![0].invoices[0].items[0].values.totalValueOfGoods).toBe(100);
  });

  it('refuses when CBP has published no rate for the currency yet', async () => {
    prisma.cbpCurrencyRate.findFirst.mockResolvedValue(null);
    await expect(convertInvoiceValuesToUsd(body('EUR', 100) as never)).rejects.toBeInstanceOf(CurrencyConversionError);
  });

  it('refuses a currency whose rate direction is not verified yet', async () => {
    await expect(convertInvoiceValuesToUsd(body('JPY', 100000) as never)).rejects.toThrow(/JPY/);
  });
});

describe('currencyRateHandler', () => {
  it('stores the rates from a %R broadcast and claims the message', async () => {
    prisma.cbpCurrencyRate.createMany.mockResolvedValue({ count: 1 });
    const m = await currencyRateHandler({ id: 'r1', environment: 'CERT', application: '%R', userDataTag: null, lines: ['%1ATEUR100926 1119300D'] });
    expect(prisma.cbpCurrencyRate.createMany).toHaveBeenCalledWith(expect.objectContaining({ skipDuplicates: true }));
    expect(m).toMatchObject({ entityType: 'currency_rate' });
  });

  it('ignores other messages', async () => {
    expect(await currencyRateHandler({ id: 'r1', environment: 'CERT', application: 'SN', userDataTag: null, lines: [] })).toBeNull();
  });
});
