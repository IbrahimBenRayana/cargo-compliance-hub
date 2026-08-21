/**
 * Duty engine tests — rules asserted against the Entry Summary
 * Create/Update usage notes (l)–(r), (w), (x) (ESF page refs in comments).
 */
import { describe, it, expect } from 'vitest';
import { parseRateExpression, pickSpecialRate, computeDutyCents } from '../duty/rateExpression.js';
import {
  computeLineMpfCents,
  applyMpfMinMax,
  computeLineHmfCents,
  hmfApplies,
  informalEntryFeeCents,
  dutiableMailFeeCents,
  manualEntrySurchargeCents,
} from '../duty/fees.js';
import { enrichWithDuty, StaticRateSource } from '../duty/engine.js';
import { RecordCodecError } from '../records/codec.js';
import { TYPE01_PAYLOAD_V2 } from './fixtures/type01PayloadV2.js';
import { toAeEntrySummaryInput } from '../payload/toAeInput.js';
import { buildEntrySummary } from '../ae/builder.js';

describe('rate expressions', () => {
  it('parses Free, ad valorem, specific, and compound rates', () => {
    expect(parseRateExpression('Free')).toEqual([{ kind: 'free' }]);
    expect(parseRateExpression('3.4%')).toEqual([{ kind: 'adValorem', perMillion: 34000 }]);
    expect(parseRateExpression('$1.50/kg')).toEqual([{ kind: 'specific', microDollarsPerUnit: 1_500_000, unit: 'kg' }]);
    expect(parseRateExpression('4.4¢/kg + 4%')).toEqual([
      { kind: 'specific', microDollarsPerUnit: 44_000, unit: 'kg' },
      { kind: 'adValorem', perMillion: 40000 },
    ]);
  });

  it('rejects unsupported expressions instead of guessing', () => {
    expect(() => parseRateExpression('See chapter 99')).toThrow(RecordCodecError);
    expect(() => parseRateExpression('')).toThrow(RecordCodecError);
  });

  it('computes ad valorem, specific, and compound duty with standard rounding', () => {
    // $10,000 × 3.4% = $340.00
    expect(computeDutyCents(parseRateExpression('3.4%'), { valueDollars: 10000 })).toBe(34000);
    // 1,234.00 kg × 4.4¢ = $54.296 → $54.30
    expect(
      computeDutyCents(parseRateExpression('4.4¢/kg'), { valueDollars: 0, quantity1Hundredths: 123400 })
    ).toBe(5430);
    // compound: $54.296 + $400 = $454.296 → 45430
    expect(
      computeDutyCents(parseRateExpression('4.4¢/kg + 4%'), { valueDollars: 10000, quantity1Hundredths: 123400 })
    ).toBe(45430);
    expect(computeDutyCents(parseRateExpression('Free'), { valueDollars: 10000 })).toBe(0);
  });

  it('requires quantity 1 for specific rates', () => {
    expect(() => computeDutyCents(parseRateExpression('$1.50/kg'), { valueDollars: 100 })).toThrow(/quantity 1/);
  });
});

describe('fees (usage notes n/o/p/q/r/w)', () => {
  it('computes formal MPF at 0.3464% with FY26 min/max (ESF-173)', () => {
    expect(computeLineMpfCents(10000)).toBe(3464); // $10,000 → $34.64
    expect(applyMpfMinMax(3464, '20260815')).toBe(3464); // within limits
    expect(applyMpfMinMax(100, '20260815')).toBe(3358); // below FY26 min $33.58
    expect(applyMpfMinMax(99_999, '20260815')).toBe(65150); // above FY26 max $651.50
    expect(applyMpfMinMax(100, '20250815')).toBe(3271); // FY25 min $32.71
  });

  it('computes HMF at 0.125% for vessel MOTs only (ESF-161)', () => {
    expect(computeLineHmfCents(10000)).toBe(1250); // $10,000 → $12.50
    expect(hmfApplies('11', '01')).toBe(true);
    expect(hmfApplies('40', '01')).toBe(false); // air
    expect(hmfApplies('11', '06')).toBe(false); // FTZ exempt
    expect(hmfApplies(undefined, '01')).toBe(false);
  });

  it('returns FY-adjusted fixed fees (ESF-163..165)', () => {
    expect(informalEntryFeeCents('20260815')).toBe(269); // FY26 $2.69
    expect(informalEntryFeeCents('20250815')).toBe(262); // FY25 $2.62
    expect(dutiableMailFeeCents('20260815')).toBe(739);
    expect(manualEntrySurchargeCents('20260815')).toBe(403);
  });
});

describe('enrichWithDuty', () => {
  const RATES = new StaticRateSource({ '8507600020': '3.41%' });

  function unpriced() {
    const p = structuredClone(TYPE01_PAYLOAD_V2);
    delete p.entrySummary.lines[0].tariffs[0].dutyCents;
    delete p.entrySummary.grandTotals;
    p.entrySummary.lines[0].fees = undefined;
    p.entrySummary.feeTotals = undefined;
    return p;
  }

  it('prices the type-01 fixture to the exact hand-checked amounts', async () => {
    const priced = await enrichWithDuty(unpriced(), RATES, { applicabilityDate: '20260820' });
    const es = priced.entrySummary;
    expect(es.lines[0].tariffs[0].dutyCents).toBe(34100); // $10,000 × 3.41%
    expect(es.lines[0].fees).toEqual([
      { classCode: '499', amountCents: 3464 }, // MPF
      { classCode: '501', amountCents: 1250 }, // HMF (MOT 11)
    ]);
    expect(es.feeTotals).toEqual([
      { classCode: '499', amountCents: 3464 },
      { classCode: '501', amountCents: 1250 },
    ]);
    expect(es.grandTotals).toEqual({
      dutyCents: 34100,
      userFeeCents: 4714,
      irTaxCents: 0,
      adDutyCents: 0,
      cvDutyCents: 0,
      otherRevenueCents: 0,
    });
    // The priced payload matches the reviewed fixture and builds cleanly.
    expect(priced.entrySummary).toEqual(TYPE01_PAYLOAD_V2.entrySummary);
    expect(() => buildEntrySummary(toAeEntrySummaryInput(priced, 'A'))).not.toThrow();
  });

  it('applies the MPF minimum on low-value entries (usage note w)', async () => {
    const p = unpriced();
    p.entrySummary.lines[0].tariffs[0].valueDollars = 500; // MPF $1.73 → min $33.58
    const priced = await enrichWithDuty(p, RATES, { applicabilityDate: '20260820' });
    expect(priced.entrySummary.feeTotals).toContainEqual({ classCode: '499', amountCents: 3358 });
    // Line-level fee stays the true computation; only the total is floored.
    expect(priced.entrySummary.lines[0].fees).toContainEqual({ classCode: '499', amountCents: 173 });
  });

  it('drops HMF under the $3 de minimis only when no other revenue is due (usage note o)', async () => {
    const p = unpriced();
    p.entrySummary.entryTypeCode = '23'; // TIB: MPF exempt, duty-free
    p.entrySummary.lines[0].tariffs[0].valueDollars = 2000; // HMF $2.50 ≤ $3.00
    const rates = new StaticRateSource({ '8507600020': 'Free' });
    const priced = await enrichWithDuty(p, rates, { applicabilityDate: '20260820' });
    expect(priced.entrySummary.feeTotals).toBeUndefined();
    expect(priced.entrySummary.grandTotals?.userFeeCents).toBe(0);
  });

  it('adds the informal entry fee and skips MPF for type 11 (usage notes m, q)', async () => {
    const p = unpriced();
    p.entrySummary.entryTypeCode = '11';
    p.entrySummary.motCode = '40'; // air: no HMF
    const priced = await enrichWithDuty(p, RATES, { applicabilityDate: '20260820' });
    expect(priced.entrySummary.headerFees).toEqual([{ classCode: '311', amountCents: 269 }]);
    expect(priced.entrySummary.lines[0].fees).toBeUndefined();
    expect(priced.entrySummary.grandTotals?.userFeeCents).toBe(269);
  });

  it('splits AD/CVD case duty into 88-record subtotals and grand totals (usage note ff)', async () => {
    const p = unpriced();
    p.entrySummary.entryTypeCode = '03';
    p.entrySummary.lines[0].adCvdCases = [
      { caseNumber: 'A570010001', bondCashClaimCode: 'C', depositRateHundredths: 2500, rateTypeQualifier: 'A', dutyCents: 250000 },
      { caseNumber: 'C570010002', bondCashClaimCode: 'B', depositRateHundredths: 1000, rateTypeQualifier: 'A', dutyCents: 100000 },
    ];
    const priced = await enrichWithDuty(p, RATES, { applicabilityDate: '20260820' });
    expect(priced.entrySummary.adCvdTotals).toEqual({
      bondedAdCents: 0,
      cashAdCents: 250000,
      bondedCvCents: 100000,
      cashCvCents: 0,
    });
    expect(priced.entrySummary.grandTotals?.adDutyCents).toBe(250000);
    expect(priced.entrySummary.grandTotals?.cvDutyCents).toBe(100000);
  });

  it('suppresses line MPF when the SPI program is MPF-exempt (CBP MPF/preference table)', async () => {
    // CERT floor enforces this: F632 FORMAL MPF NOT ALLOWED - ARTICLE EXEMPT
    // came back on scenario 001 (Singapore FTA) when we reported the 499 fee.
    const rates = new StaticRateSource({
      '8507600020': { general: '3.41%', special: 'Free (AU,BH,CL,CO,IL,JO,KS,OM,P,PA,PE,S,SG)' },
    });
    const sg = unpriced();
    sg.entrySummary.lines[0].spiClaimCode = 'SG';
    const priced = await enrichWithDuty(sg, rates, { applicabilityDate: '20260820' });
    expect(priced.entrySummary.lines[0].tariffs[0].dutyCents).toBe(0);
    expect(priced.entrySummary.lines[0].fees).toEqual([
      { classCode: '501', amountCents: 1250 }, // HMF still due — only MPF is program-exempt
    ]);

    // Israel FTA (IL) is NOT on the MPF-exemption table — the fee stays.
    const il = unpriced();
    il.entrySummary.lines[0].spiClaimCode = 'IL';
    const pricedIl = await enrichWithDuty(il, rates, { applicabilityDate: '20260820' });
    expect(pricedIl.entrySummary.lines[0].fees).toEqual([
      { classCode: '499', amountCents: 3464 },
      { classCode: '501', amountCents: 1250 },
    ]);
  });

  it('refuses unlisted SPI claims and unknown HTS numbers instead of guessing', async () => {
    const spi = unpriced();
    spi.entrySummary.lines[0].spiClaimCode = 'A';
    await expect(enrichWithDuty(spi, RATES, { applicabilityDate: '20260820' })).rejects.toThrow(/SPI/);

    const unknown = unpriced();
    unknown.entrySummary.lines[0].tariffs[0].htsNumber = '9999999999';
    await expect(enrichWithDuty(unknown, RATES, { applicabilityDate: '20260820' })).rejects.toThrow(/no HTS rate/);
  });
});

describe('SPI preference rates (Special column)', () => {
  it('extracts the program group a claim qualifies for', () => {
    const special = 'Free (A*, AU, BH, CL, D, E, IL, JO, MA, OM, P, PA, PE, S, SG) 2.5% (KR)';
    expect(pickSpecialRate(special, 'AU')).toBe('Free');
    expect(pickSpecialRate(special, 'A')).toBe('Free'); // A* listing covers an A claim
    expect(pickSpecialRate(special, 'KR')).toBe('2.5%');
    expect(pickSpecialRate(special, 'A+')).toBeNull(); // GSP-LDC is a distinct program
    expect(pickSpecialRate(special, 'MX')).toBeNull();
  });

  it('prices a claimed line with the preference rate', async () => {
    const p = structuredClone(TYPE01_PAYLOAD_V2);
    delete p.entrySummary.lines[0].tariffs[0].dutyCents;
    delete p.entrySummary.grandTotals;
    p.entrySummary.lines[0].fees = undefined;
    p.entrySummary.feeTotals = undefined;
    p.entrySummary.lines[0].spiClaimCode = 'AU';
    const rates = new StaticRateSource({
      '8507600020': { general: '3.41%', special: 'Free (A*, AU, CL)' },
    });
    const priced = await enrichWithDuty(p, rates, { applicabilityDate: '20260820' });
    expect(priced.entrySummary.lines[0].tariffs[0].dutyCents).toBe(0);
    expect(priced.entrySummary.grandTotals?.dutyCents).toBe(0);
    // AU is on CBP's MPF-exemption table, so the claim itself drops the
    // 499 fee (CERT F632 rejects it otherwise); HMF is unaffected.
    expect(priced.entrySummary.lines[0].fees).not.toContainEqual(
      expect.objectContaining({ classCode: '499' })
    );
  });

  it('suppresses line MPF only via the explicit fee-exemption code', async () => {
    const p = structuredClone(TYPE01_PAYLOAD_V2);
    delete p.entrySummary.lines[0].tariffs[0].dutyCents;
    delete p.entrySummary.grandTotals;
    p.entrySummary.lines[0].fees = undefined;
    p.entrySummary.feeTotals = undefined;
    p.entrySummary.lines[0].feeExemptionCode = 'F';
    const rates = new StaticRateSource({ '8507600020': 'Free' });
    const priced = await enrichWithDuty(p, rates, { applicabilityDate: '20260820' });
    expect(priced.entrySummary.lines[0].fees?.some((f) => f.classCode === '499')).not.toBe(true);
  });
});

describe('ch.99 overlay surcharges (Section 301/232)', () => {
  const OVERLAY_RATES = new StaticRateSource({
    '8507600020': '3.41%',
    '9903880300': 'The duty provided in the applicable subheading + 25%',
  });

  it('parses the overlay wording into a surcharge component', () => {
    expect(parseRateExpression('The duty provided in the applicable subheading + 25%')).toEqual([
      { kind: 'overlaySurcharge', perMillion: 250000 },
    ]);
    expect(parseRateExpression('The duty provided in the applicable subheading + 7.5%')).toEqual([
      { kind: 'overlaySurcharge', perMillion: 75000 },
    ]);
  });

  it('computes the surcharge on the ch.1–97 value of the same line', async () => {
    const p = structuredClone(TYPE01_PAYLOAD_V2);
    delete p.entrySummary.lines[0].tariffs[0].dutyCents;
    delete p.entrySummary.grandTotals;
    p.entrySummary.lines[0].fees = undefined;
    p.entrySummary.feeTotals = undefined;
    // 301 List-3 style pairing: ch.99 line carries no value of its own.
    p.entrySummary.lines[0].tariffs.unshift({
      htsNumber: '9903880300',
      valueDollars: 0,
      uomCode1: 'X',
    });
    const priced = await enrichWithDuty(p, OVERLAY_RATES, { applicabilityDate: '20260820' });
    const [overlay, base] = priced.entrySummary.lines[0].tariffs;
    expect(base.dutyCents).toBe(34100); // $10,000 × 3.41%
    expect(overlay.dutyCents).toBe(250000); // $10,000 × 25%
    expect(priced.entrySummary.grandTotals?.dutyCents).toBe(284100);
    // MPF/HMF stay computed on the line value once, not per tariff.
    expect(priced.entrySummary.lines[0].fees).toContainEqual({ classCode: '499', amountCents: 3464 });
  });

  it('the overlay keeps its surcharge under an SPI claim on the base line', async () => {
    const p = structuredClone(TYPE01_PAYLOAD_V2);
    delete p.entrySummary.lines[0].tariffs[0].dutyCents;
    delete p.entrySummary.grandTotals;
    p.entrySummary.lines[0].fees = undefined;
    p.entrySummary.feeTotals = undefined;
    p.entrySummary.lines[0].spiClaimCode = 'AU';
    p.entrySummary.lines[0].tariffs.unshift({
      htsNumber: '9903880300',
      valueDollars: 0,
      uomCode1: 'X',
    });
    const rates = new StaticRateSource({
      '8507600020': { general: '3.41%', special: 'Free (A*, AU, CL)' },
      '9903880300': 'The duty provided in the applicable subheading + 25%',
    });
    const priced = await enrichWithDuty(p, rates, { applicabilityDate: '20260820' });
    const [overlay, base] = priced.entrySummary.lines[0].tariffs;
    expect(base.dutyCents).toBe(0); // preference
    expect(overlay.dutyCents).toBe(250000); // 301 unaffected by the claim
  });
});
