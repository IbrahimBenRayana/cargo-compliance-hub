/**
 * Currency Exchange Rates Update (%R) parser — CATAIR "Currency Exchange
 * Rates Update" chapter (June 2023), Record Identifier %1 (CEU-6/7):
 *   1 '%', 2 '1', 3-4 ISO country, 5-7 ISO currency, 8-13 rate date
 *   MMDDYY, 14 space, 15-21 rate (7N, six implied decimals), 22 indicator
 *   (Q quarterly, D daily, N none: rate 0000000), 23-72 remarks.
 * CBP broadcasts these unsolicited on the filer's outbound queue.
 */
import { parseBatch } from '../../envelope/batch.js';

export interface CurrencyRate {
  countryCode: string;
  currencyCode: string;
  /** YYYYMMDD */
  rateDate: string;
  /** Decimal rate as CBP publishes it (six decimals). */
  rate: number;
  indicator: 'Q' | 'D' | 'N' | 'X';
  remarks?: string;
}

function yyyymmdd(mmddyy: string): string | null {
  if (!/^\d{6}$/.test(mmddyy)) return null;
  const mm = mmddyy.slice(0, 2), dd = mmddyy.slice(2, 4), yy = Number(mmddyy.slice(4, 6));
  // Two-digit years: CBP rates are recent; 00-79 -> 20xx.
  const yyyy = yy < 80 ? 2000 + yy : 1900 + yy;
  return `${yyyy}${mm}${dd}`;
}

export function parseCurrencyRateRecord(line: string): CurrencyRate | null {
  if (!line.startsWith('%1')) return null;
  const padded = line.padEnd(80, ' ');
  const rateDate = yyyymmdd(padded.slice(7, 13));
  const rateRaw = padded.slice(14, 21);
  const indicator = padded[21] as CurrencyRate['indicator'];
  if (!rateDate || !/^\d{7}$/.test(rateRaw) || !'QDNX'.includes(indicator)) return null;
  const remarks = padded.slice(22, 72).trim();
  return {
    countryCode: padded.slice(2, 4),
    currencyCode: padded.slice(4, 7),
    rateDate,
    rate: Number(rateRaw) / 1_000_000,
    indicator,
    ...(remarks && { remarks }),
  };
}

/** Every %1 rate in a %R broadcast (with or without the A/B/Y/Z envelope). */
export function parseCurrencyUpdateBatch(lines: string[]): CurrencyRate[] {
  let records = lines;
  try {
    const batch = parseBatch(lines);
    if (batch.blocks.length > 0) records = batch.blocks.flatMap((b) => b.transactionLines);
  } catch {
    /* bare records */
  }
  return records.map(parseCurrencyRateRecord).filter((r): r is CurrencyRate => r !== null);
}
