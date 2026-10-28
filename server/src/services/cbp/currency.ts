/**
 * CBP certified currency rates (audit ENG-02, BNA-04).
 *
 * %R broadcasts arrive unsolicited on our outbound queue; the dispatcher
 * stores every rate. Native entries convert foreign invoice values to USD
 * with the certified rate for the date of exportation (19 CFR 159.32),
 * never with a user-typed rate.
 *
 * Rate direction: the %R chapter does not say whether a rate is dollars per
 * unit or units per dollar, and the Federal Reserve quotes most currencies
 * as units per dollar but EUR/GBP/AUD/NZD as dollars per unit. Only
 * directions proven in CERT are converted (EUR: scenario 045, EUR 5,000 x
 * 1.1592 = $5,796 accepted); any other foreign currency is refused rather
 * than sent with a guessed value. Add a currency here only once proven.
 */
import { prisma } from '../../config/database.js';
import { parseCurrencyUpdateBatch } from '../../abi-engine/apps/currency/updateParser.js';
import type { AbiDocumentBody } from '../abi/types.js';
import type { InboundHandler } from './dispatcher.js';

/** Currencies whose CBP rate is applied as USD = amount x rate (proven in CERT). */
const MULTIPLY_VERIFIED = new Set(['EUR']);

export class CurrencyConversionError extends Error {
  readonly code = 'CURRENCY_NOT_CONVERTIBLE';
}

export interface CurrencyConversion {
  currency: string;
  amount: number;
  usd: number;
  rate: number;
  rateDate: string;
  indicator: string;
}

const isoDate = (yyyymmdd: string) => new Date(`${yyyymmdd.slice(0, 4)}-${yyyymmdd.slice(4, 6)}-${yyyymmdd.slice(6, 8)}T00:00:00Z`);

/**
 * A copy of the entry with every foreign line value converted to USD, plus
 * the conversions applied (for the audit trail). Throws when a currency is
 * not convertible or CBP has published no usable rate on or before the date.
 */
export async function convertInvoiceValuesToUsd(body: AbiDocumentBody): Promise<{ body: AbiDocumentBody; conversions: CurrencyConversion[] }> {
  const copy = JSON.parse(JSON.stringify(body)) as AbiDocumentBody;
  const conversions: CurrencyConversion[] = [];
  for (const manifest of copy.manifest ?? []) {
    for (const invoice of manifest.invoices ?? []) {
      const onDate = (invoice as { exportDate?: string }).exportDate || copy.dates?.importDate;
      for (const item of invoice.items ?? []) {
        const currency = (item.values?.currency || 'USD').toUpperCase();
        if (currency === 'USD') continue;
        if (!MULTIPLY_VERIFIED.has(currency)) {
          throw new CurrencyConversionError(
            `Invoices in ${currency} cannot be converted automatically yet; enter the value in US dollars.`,
          );
        }
        if (!onDate) throw new CurrencyConversionError('An export or import date is needed to convert the invoice currency.');
        const row = await prisma.cbpCurrencyRate.findFirst({
          where: { currencyCode: currency, indicator: { in: ['D', 'Q'] }, rateDate: { lte: isoDate(onDate) } },
          orderBy: { rateDate: 'desc' },
        });
        if (!row) {
          throw new CurrencyConversionError(`CBP has not published a ${currency} rate on or before ${onDate} yet.`);
        }
        const rate = Number(row.rate);
        const amount = item.values.totalValueOfGoods;
        const usd = Math.round(amount * rate * 100) / 100;
        item.values = { ...item.values, currency: 'USD', exchangeRate: 1, totalValueOfGoods: usd };
        conversions.push({ currency, amount, usd, rate, rateDate: row.rateDate.toISOString().slice(0, 10), indicator: row.indicator });
      }
    }
  }
  return { body: copy, conversions };
}

/** Dispatcher handler: store the rates of a %R broadcast. */
export const currencyRateHandler: InboundHandler = async (row) => {
  if (row.application !== '%R') return null;
  const rates = parseCurrencyUpdateBatch(row.lines);
  if (rates.length > 0) {
    await prisma.cbpCurrencyRate.createMany({
      data: rates.map((r) => ({
        countryCode: r.countryCode,
        currencyCode: r.currencyCode,
        rateDate: isoDate(r.rateDate),
        rate: r.rate,
        indicator: r.indicator,
        remarks: r.remarks?.slice(0, 50),
        inboundMessageId: row.id,
      })),
      skipDuplicates: true,
    });
  }
  return { entityType: 'currency_rate', entityId: row.id, parsed: { rates } };
};
