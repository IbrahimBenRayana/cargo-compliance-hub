/**
 * AD/CVD entries (audit ENG-M1, CATAIR usage note ff): entry type 03 with
 * per-line cases, deposits estimated by the migrator, carried onto the
 * 53-record and into the AD/CVD totals, and certified for release (note ee).
 */
import { describe, it, expect } from 'vitest';
import { abiDocumentBodySchema } from '../../schemas/abiDocument.js';
import { migrateV1ToV2 } from '../../abi-engine/payload/migrateV1.js';
import { enrichWithDuty, StaticRateSource } from '../../abi-engine/duty/engine.js';
import { toAeEntrySummaryInput } from '../../abi-engine/payload/toAeInput.js';
import { validateEntrySummary } from '../../abi-engine/validate/entrySummary.js';
import { buildEntrySummary } from '../../abi-engine/ae/builder.js';
import { hasNativeOnlyData } from '../abiDocumentMapper.js';
import { entryBody } from './fixtures/entryBody.js';

const RATES = new StaticRateSource({ '7606123096': '3%' });
// CERT 043's case: A-470-820-000, cash, 3.80% ad valorem on $68,707.
const CASE = { caseNumber: 'A-470-820-000', bondOrCash: 'C', rateType: 'A', rate: 3.8 };
const adcvd = (over: Parameters<typeof entryBody>[0] = {}) =>
  entryBody({ entryType: '03', hts: '7606123096', origin: 'ES', value: 68707, quantity: '21926 KG', adCvd: [CASE], ...over });

describe('AD/CVD entry (type 03)', () => {
  it('schema: type 03 needs a case, and cases need type 03', () => {
    expect(abiDocumentBodySchema.safeParse(adcvd()).success).toBe(true);
    expect(abiDocumentBodySchema.safeParse(adcvd({ adCvd: undefined })).success).toBe(false);
    expect(abiDocumentBodySchema.safeParse(adcvd({ entryType: '01' })).success).toBe(false);
    expect(abiDocumentBodySchema.safeParse(adcvd({ adCvd: [{ ...CASE, caseNumber: 'X-1' }] })).success).toBe(false);
    expect(abiDocumentBodySchema.safeParse(adcvd({ adCvd: [{ ...CASE, rateType: 'S' }] })).success).toBe(false);
  });

  it('migrates the case with the CERT-accepted deposit', () => {
    const line = migrateV1ToV2(adcvd()).entrySummary.lines[0];
    expect(line.adCvdCases).toEqual([
      { caseNumber: 'A470820000', bondCashClaimCode: 'C', depositRateHundredths: 380, rateTypeQualifier: 'A', valueOfGoodsDollars: 68707, dutyCents: 261087 },
    ]);
  });

  it('prices a specific rate on the case quantity', () => {
    const line = migrateV1ToV2(adcvd({ adCvd: [{ ...CASE, rateType: 'S', rate: 1.25, quantity: 1000.5 }] })).entrySummary.lines[0];
    expect(line.adCvdCases?.[0]).toMatchObject({ rateTypeQualifier: 'S', depositRateHundredths: 125, quantityTenThousandths: 10_005_000, dutyCents: 125063 });
  });

  it('passes the engine validator, totals the deposit, and builds a 53-record', async () => {
    const priced = await enrichWithDuty(migrateV1ToV2(adcvd()), RATES, { applicabilityDate: '20260820' });
    const input = toAeEntrySummaryInput(priced, 'A');
    expect(validateEntrySummary(input)).toEqual([]);
    expect(priced.entrySummary.adCvdTotals).toBeDefined();
    const fiftyThree = buildEntrySummary(input).filter((r) => r.startsWith('53'));
    expect(fiftyThree).toHaveLength(1);
    expect(fiftyThree[0]).toContain('A470820000');
  });

  it('is native-only data', () => {
    expect(hasNativeOnlyData(adcvd() as never)).toBe(true);
  });
});
