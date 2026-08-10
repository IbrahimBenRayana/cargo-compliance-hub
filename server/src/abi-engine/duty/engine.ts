/**
 * Duty engine (workstream F): enrich a payload-v2 entry summary with the
 * filer-computed amounts ACE checks — line duty, MPF/HMF line fees,
 * informal/mail header fees, fee totals with the MPF min/max, AD/CVD
 * subtotals, and grand totals.
 *
 * Sources of rules: Entry Summary Create/Update usage notes (l)–(r), (w),
 * (x), (ff) — July 2026 chapter. Known limitations: SPI-implied MPF
 * exemption is NOT inferred — the filer declares it via the line's
 * feeExemptionCode (honored here); article-set aggregation is deferred.
 * Where a limitation would silently produce a wrong amount, the engine
 * throws instead.
 */
import { RecordCodecError, type CodecIssue } from '../records/codec.js';
import { parseRateExpression, pickSpecialRate, computeDutyCents } from './rateExpression.js';
import {
  computeLineMpfCents,
  applyMpfMinMax,
  hmfApplies,
  computeLineHmfCents,
  HMF_DE_MINIMIS_CENTS,
  informalEntryFeeCents,
  dutiableMailFeeCents,
} from './fees.js';
import type { AbiPayloadV2, LineV2 } from '../payload/schemaV2.js';

function fail(field: string, message: string): never {
  const issue: CodecIssue = { record: 'DutyEngine', field, message };
  throw new RecordCodecError([issue]);
}

// ── Rate source ────────────────────────────────────────────

export interface HtsRate {
  /** HTS "General" column rate expression, e.g. 'Free', '3.4%'. */
  general: string;
  /** HTS "Special" column expression, e.g. 'Free (A*, AU, CL)'. */
  special?: string;
}

export interface HtsRateSource {
  /** Return the rate for a full HTS number on a date, or null if unknown. */
  getRate(htsNumber: string, date: string): Promise<HtsRate | null> | HtsRate | null;
}

/** In-memory rate source (tests, fixtures, cert scenario supplied values). */
export class StaticRateSource implements HtsRateSource {
  constructor(private readonly rates: Record<string, string | HtsRate>) {}
  getRate(htsNumber: string): HtsRate | null {
    const rate = this.rates[htsNumber];
    if (rate === undefined) return null;
    return typeof rate === 'string' ? { general: rate } : rate;
  }
}

// ── Engine ─────────────────────────────────────────────────

export interface DutyEngineOptions {
  /**
   * Applicability date (YYYYMMDD) for rates, fee amounts, and limits —
   * derived by the caller per the chapter's date matrices.
   */
  applicabilityDate: string;
}

const INFORMAL_TYPES = new Set(['11', '12']);
const TIB_TYPE = '23';

function lineValueDollars(line: LineV2): number {
  return line.tariffs.reduce((sum, t) => sum + t.valueDollars, 0);
}

/**
 * Compute all amounts and return a new, fully-priced payload.
 * Deterministic and idempotent: existing tariff duty amounts are kept,
 * fees and totals are always recomputed from line data.
 */
export async function enrichWithDuty(
  payload: AbiPayloadV2,
  rateSource: HtsRateSource,
  options: DutyEngineOptions
): Promise<AbiPayloadV2> {
  const date = options.applicabilityDate;
  if (!/^\d{8}$/.test(date)) fail('applicabilityDate', `expected YYYYMMDD, got '${date}'`);

  const result = structuredClone(payload);
  const es = result.entrySummary;
  const informal = INFORMAL_TYPES.has(es.entryTypeCode);
  const mpfExempt = informal || es.entryTypeCode === TIB_TYPE;
  const hmfOn = hmfApplies(es.motCode, es.entryTypeCode);

  let totalDutyCents = 0;
  let totalIrTaxCents = 0;
  let totalOtherRevenueCents = 0;
  let totalLineMpfCents = 0;
  let totalHmfCents = 0;
  let adBondedCents = 0;
  let adCashCents = 0;
  let cvBondedCents = 0;
  let cvCashCents = 0;

  for (const [index, line] of es.lines.entries()) {
    // 1. Line duty per tariff. Ch.99 overlay surcharges ("duty of the
    //    applicable subheading + X%") are computed on the combined value of
    //    the line's OTHER tariffs — the ch.1–97 classification(s) the
    //    overlay rides on.
    for (const [tIndex, tariff] of line.tariffs.entries()) {
      if (tariff.dutyCents === undefined) {
        const where = `lines[${index}].tariffs[${tIndex}]`;
        const rate = await rateSource.getRate(tariff.htsNumber, date);
        if (!rate) {
          fail(where, `no HTS rate available for ${tariff.htsNumber}`);
        }

        // SPI preference claim: use the Special-column rate for the claimed
        // program. A claim the subheading does not list is a filer error.
        let expression = rate.general;
        if (line.spiClaimCode) {
          const preferred = rate.special
            ? pickSpecialRate(rate.special, line.spiClaimCode)
            : null;
          // Duty-free subheadings list no programs in the Special column, yet
          // an SPI claim on them is legitimate (made for fee/statistical
          // treatment) — cert scenario 001 files SPI on a Free-rate HTS.
          const generalFree = /^free$/i.test(rate.general.trim());
          if (preferred === null && !generalFree && !tariff.htsNumber.startsWith('99')) {
            fail(
              where,
              `SPI '${line.spiClaimCode}' is not a listed program for ${tariff.htsNumber} — remove the claim or supply dutyCents explicitly`
            );
          }
          // Ch.99 overlays are unaffected by the preference claim; they keep
          // their own (general) expression.
          if (preferred !== null && !tariff.htsNumber.startsWith('99')) {
            expression = preferred;
          }
        }

        const othersValueDollars = line.tariffs.reduce(
          (sum, t, i) => (i === tIndex ? sum : sum + t.valueDollars),
          0
        );
        // A ch.99 additional-duty tariff reported without a value of its own
        // (the pairing convention: value rides on the ch.1–97 line) computes
        // its ad valorem on the base value — this covers both the overlay
        // wording AND plain-percentage ch.99 rates (e.g. 9903.41.10 '40%',
        // cert scenario 024).
        const effectiveValueDollars =
          tariff.valueDollars === 0 && tariff.htsNumber.startsWith('99') && othersValueDollars > 0
            ? othersValueDollars
            : tariff.valueDollars;
        tariff.dutyCents = computeDutyCents(
          parseRateExpression(expression),
          {
            valueDollars: effectiveValueDollars,
            quantity1Hundredths: tariff.quantity1Hundredths,
            applicableSubheadingValueDollars:
              othersValueDollars > 0 ? othersValueDollars : tariff.valueDollars,
          },
          expression
        );
      }
      totalDutyCents += tariff.dutyCents;
    }

    // 2. Line fees (recomputed): keep non-499/501 fees the caller set.
    const keptFees = (line.fees ?? []).filter((f) => f.classCode !== '499' && f.classCode !== '501');
    const fees = [...keptFees];
    const value = lineValueDollars(line);

    // The filer's explicit fee-exemption code (e.g. an MPF-exempt FTA
    // program) suppresses the line MPF; the engine never infers exemption
    // from the SPI claim alone.
    if (!mpfExempt && !line.feeExemptionCode) {
      const mpf = computeLineMpfCents(value);
      totalLineMpfCents += mpf;
      fees.push({ classCode: '499', amountCents: mpf });
    }
    if (hmfOn) {
      const hmf = computeLineHmfCents(value);
      totalHmfCents += hmf;
      fees.push({ classCode: '501', amountCents: hmf });
    }
    if (fees.length > 0) line.fees = fees;
    else delete line.fees;

    totalIrTaxCents += line.irTax?.amountCents ?? 0;
    totalOtherRevenueCents += line.otherRevenue?.amountCents ?? 0;

    // 3. AD/CVD case splits (usage note ff): case prefix A/C, bond vs cash.
    for (const adCvd of line.adCvdCases ?? []) {
      const isAd = adCvd.caseNumber.toUpperCase().startsWith('A');
      const bonded = adCvd.bondCashClaimCode === 'B';
      if (isAd) {
        if (bonded) adBondedCents += adCvd.dutyCents;
        else adCashCents += adCvd.dutyCents;
      } else if (bonded) cvBondedCents += adCvd.dutyCents;
      else cvCashCents += adCvd.dutyCents;
    }
  }

  // 4. HMF de minimis: ≤ $3.00 for the whole summary AND no other revenue.
  const revenueBesidesHmf = totalDutyCents + totalLineMpfCents + totalIrTaxCents + totalOtherRevenueCents;
  if (hmfOn && totalHmfCents <= HMF_DE_MINIMIS_CENTS && revenueBesidesHmf === 0) {
    for (const line of es.lines) {
      line.fees = line.fees?.filter((f) => f.classCode !== '501');
      if (line.fees?.length === 0) delete line.fees;
    }
    totalHmfCents = 0;
  }

  // 5. Header fees (recomputed): informal 311; dutiable mail 496 (MOT 50).
  const headerFees: NonNullable<typeof es.headerFees> = [];
  if (informal) headerFees.push({ classCode: '311', amountCents: informalEntryFeeCents(date) });
  if (es.motCode === '50' && totalDutyCents > 0) {
    headerFees.push({ classCode: '496', amountCents: dutiableMailFeeCents(date) });
  }
  if (headerFees.length > 0) es.headerFees = headerFees;
  else delete es.headerFees;

  // 6. Fee totals (89-record): line fees by class + header fees; MPF min/max
  //    applied to the 499 total (usage notes w, x).
  const totals = new Map<string, number>();
  for (const line of es.lines) {
    for (const fee of line.fees ?? []) totals.set(fee.classCode, (totals.get(fee.classCode) ?? 0) + fee.amountCents);
  }
  for (const fee of headerFees) totals.set(fee.classCode, (totals.get(fee.classCode) ?? 0) + fee.amountCents);
  if (totals.has('499')) totals.set('499', applyMpfMinMax(totals.get('499')!, date));
  if (totals.size > 0) {
    es.feeTotals = [...totals.entries()].map(([classCode, amountCents]) => ({ classCode, amountCents }));
  } else {
    delete es.feeTotals;
  }

  // 7. AD/CVD subtotals (88-record) + grand totals (90-record, note x).
  // Presence of cases (not their amounts) drives the 88-record: an explicit
  // AD/CVD summary with zero-deposit cases still reports the subtotals
  // (mandatory for types 03/07/34/38, ESF-134 — cert scenario 043).
  const hasAdCvd = es.lines.some((line) => (line.adCvdCases?.length ?? 0) > 0);
  if (hasAdCvd) {
    es.adCvdTotals = { bondedAdCents: adBondedCents, cashAdCents: adCashCents, bondedCvCents: cvBondedCents, cashCvCents: cvCashCents };
  } else {
    delete es.adCvdTotals;
  }

  const totalUserFeeCents = (es.feeTotals ?? []).reduce((sum, f) => sum + f.amountCents, 0);
  es.grandTotals = {
    dutyCents: totalDutyCents,
    userFeeCents: totalUserFeeCents,
    irTaxCents: totalIrTaxCents,
    adDutyCents: adBondedCents + adCashCents,
    cvDutyCents: cvBondedCents + cvCashCents,
    otherRevenueCents: totalOtherRevenueCents,
  };

  return result;
}
