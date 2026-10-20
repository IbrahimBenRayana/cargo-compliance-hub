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
import { parseRateExpression, pickSpecialRate, computeDutyCents, ch99Semantics } from './rateExpression.js';
import {
  computeLineMpfCents,
  applyMpfMinMax,
  hmfApplies,
  computeLineHmfCents,
  HMF_DE_MINIMIS_CENTS,
  informalEntryFeeCents,
  dutiableMailFeeCents,
  MPF_EXEMPT_SPI,
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
    // 1. Line duty per tariff. A ch.99 heading reported with value 0 rides
    //    on the line's ch.1-97 classification: its rate applies to the base
    //    value, and its rate text says whether it adds to column 1 or
    //    replaces it (ch99Semantics). Overlays resolve first so a
    //    replacement can zero the base before the base is priced.
    const isOverlay = (t: LineV2['tariffs'][number]) => t.valueDollars === 0 && t.htsNumber.startsWith('99');
    const baseValueDollars = line.tariffs.reduce((sum, t) => (isOverlay(t) ? sum : sum + t.valueDollars), 0);
    let replacesBase = false;
    const order = line.tariffs
      .map((tariff, tIndex) => ({ tariff, tIndex }))
      .sort((a, b) => Number(isOverlay(b.tariff)) - Number(isOverlay(a.tariff)));

    for (const { tariff, tIndex } of order) {
      const where = `lines[${index}].tariffs[${tIndex}]`;
      const overlay = isOverlay(tariff) && baseValueDollars > 0;

      if (overlay) {
        const rate = await rateSource.getRate(tariff.htsNumber, date);
        if (!rate && tariff.dutyCents === undefined) fail(where, `no HTS rate available for ${tariff.htsNumber}`);
        if (rate) {
          // Ch.99 rates are unaffected by an SPI claim; they keep their own
          // general expression.
          const semantics = ch99Semantics(tariff.htsNumber, rate.general);
          if (semantics === 'unknown') {
            fail(
              where,
              `Chapter 99 heading ${tariff.htsNumber} has no rate we can apply automatically ('${rate.general || 'blank'}'). Check the heading, or report its duty explicitly.`
            );
          }
          if (semantics === 'replacement') replacesBase = true;
          if (tariff.dutyCents === undefined) {
            tariff.dutyCents =
              semantics === 'none'
                ? 0
                : computeDutyCents(
                    parseRateExpression(rate.general),
                    { valueDollars: baseValueDollars, quantity1Hundredths: tariff.quantity1Hundredths, applicableSubheadingValueDollars: baseValueDollars },
                    rate.general
                  );
          }
        }
      } else if (tariff.dutyCents === undefined) {
        if (replacesBase && !tariff.htsNumber.startsWith('98')) {
          // ACE's '[base] replaced': the ch.99 rate is the line's whole duty.
          tariff.dutyCents = 0;
        } else {
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
            if (preferred !== null && !tariff.htsNumber.startsWith('99')) {
              expression = preferred;
            }
          }

          const othersValueDollars = line.tariffs.reduce(
            (sum, t, i) => (i === tIndex ? sum : sum + t.valueDollars),
            0
          );
          tariff.dutyCents = computeDutyCents(
            parseRateExpression(expression),
            {
              valueDollars: tariff.valueDollars,
              quantity1Hundredths: tariff.quantity1Hundredths,
              applicableSubheadingValueDollars:
                othersValueDollars > 0 ? othersValueDollars : tariff.valueDollars,
            },
            expression
          );
        }
      }
      totalDutyCents += tariff.dutyCents ?? 0;
    }

    // 2. Line fees (recomputed): keep non-499/501 fees the caller set.
    const keptFees = (line.fees ?? []).filter((f) => f.classCode !== '499' && f.classCode !== '501');
    const fees = [...keptFees];
    const value = lineValueDollars(line);

    // Line MPF is suppressed by the filer's explicit fee-exemption code OR
    // by an SPI claim on CBP's MPF-exemption table (ACE enforces the latter
    // itself — F632 FORMAL MPF NOT ALLOWED when the fee is reported anyway).
    const spiMpfExempt = line.spiClaimCode !== undefined && MPF_EXEMPT_SPI.has(line.spiClaimCode);
    // GRI set components (V) carry no line fees — the set header does
    // (live F629 FORMAL MPF NOT ALLOWED / F480 HMF NOT ALLOWED - SET
    // COMPONENT, 8/28).
    const setComponent = line.articleSetIndicator === 'V';
    // MPF-exempt ARTICLE provisions, each live-proven by F632 FORMAL MPF
    // NOT ALLOWED - ARTICLE EXEMPT: 9802.00 repairs (048, 9/5) and
    // 9820 Haiti preference (055, 9/8). Deliberately narrow — 9823 TRQ
    // lines exempt via SPI instead (027).
    const exemptProvision = line.tariffs.some(
      (t) => t.htsNumber.startsWith('980200') || t.htsNumber.startsWith('9820') || t.htsNumber.startsWith('981785')
    );
    if (!mpfExempt && !line.feeExemptionCode && !spiMpfExempt && !setComponent && !exemptProvision) {
      const mpf = computeLineMpfCents(value);
      totalLineMpfCents += mpf;
      fees.push({ classCode: '499', amountCents: mpf });
    }
    if (hmfOn && !setComponent) {
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
  // Sample entries (9811.00 provisions) are exempt from even the informal
  // MPF (live F635 INFRML MPF NOT ALLOWED - SUMMARY EXEMPT, scenario 056).
  const sampleEntry = es.lines.every((l) => l.tariffs.some((t) => t.htsNumber.startsWith('981100')));
  if (informal && !sampleEntry) headerFees.push({ classCode: '311', amountCents: informalEntryFeeCents(date) });
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
