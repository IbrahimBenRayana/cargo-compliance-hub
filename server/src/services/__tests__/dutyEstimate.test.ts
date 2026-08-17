/**
 * Duty estimate service — transmit-time duty/fee preview for entry drafts.
 *
 * The service reuses the native pipeline (migrateV1ToV2 → enrichWithDuty)
 * on the CC-shaped draft body, so every number here is hand-computed from
 * the same CATAIR fee rules the engine's own duty.test.ts proves:
 *   MPF 0.3464% (min 3358¢ / max 65150¢ for FY26), HMF 0.125%,
 *   informal entry fee 269¢ (FY26).
 */
import { describe, it, expect } from 'vitest';
import { estimateDutyForBody } from '../dutyEstimate.js';
import { StaticRateSource } from '../../abi-engine/duty/engine.js';
import type { AbiDocumentBody } from '../abi/types.js';

// A complete, valid v1 (CC-shaped) formal-consumption draft. Mirrors the
// fixture proven end-to-end in abi-engine/__tests__/payload.test.ts.
// One line: $10,000 of lithium-ion batteries (8507.60.0020) from CN, ocean.
function completeBody(): AbiDocumentBody {
  return {
    entryType: '01',
    modeOfTransport: '11',
    entryNumber: 'ABC-1234567-6',
    dates: { entryDate: '20260820', importDate: '20260815', arrivalDate: '20260814' },
    location: { portOfEntry: '2704', destinationStateUS: 'CA' },
    ior: { number: '26-164751100', name: 'SIGMA TECHNOLOGY PARTNERS LLC' },
    bond: { type: '8', suretyCode: '123', taxId: '26-164751100' },
    payment: { typeCode: 2, preliminaryStatementDate: '20260901' },
    firms: 'Y123',
    entryConsignee: {
      name: 'SIGMA TECHNOLOGY PARTNERS LLC',
      taxId: '26-164751100',
      address: '1 MAIN ST',
      city: 'LOS ANGELES',
      state: 'CA',
      postalCode: '90001',
      country: 'US',
    },
    manifest: [
      {
        bill: { type: 'M', mBOL: 'MAEU123456789012', hBOL: 'MAEU123456789012', groupBOL: 'N' },
        carrier: { code: 'MAEU' },
        ports: { portOfUnlading: '2704' },
        quantity: '100',
        quantityUOM: 'CTNS',
        invoices: [
          {
            purchaseOrder: 'PO-1',
            invoiceNumber: 'INV-1',
            exportDate: '20260801',
            relatedParties: 'N',
            countryOfExport: 'CN',
            currency: 'USD',
            exchangeRate: 1,
            items: [
              {
                sku: 'BAT-01',
                htsNumber: '8507600020',
                description: 'LITHIUM ION BATTERY PACKS',
                origin: { country: 'CN' },
                values: { currency: 'USD', exchangeRate: 1, totalValueOfGoods: 10000 },
                quantity1: '500 NO',
                weight: { gross: '2646', uom: 'L' },
                aluminumPercentage: 0,
                steelPercentage: 0,
                copperPercentage: 0,
                cottonFeeExemption: 'N',
                autoPartsExemption: 'N',
                otherThanCompletedKitchenParts: 'N',
                informationalMaterialsExemption: 'N',
                religiousPurposes: 'N',
                agriculturalExemption: 'N',
                parties: [
                  { type: 'buyer', taxId: '26-164751100' },
                  { type: 'manufacturer', name: 'SHENZHEN BATTERY CO', city: 'SHENZHEN', country: 'CN' },
                ],
              },
            ],
          },
        ],
      },
    ],
  } as AbiDocumentBody;
}

const RATES = new StaticRateSource({ '8507600020': '3.41%' });

describe('estimateDutyForBody — complete formal entry', () => {
  it('computes duty, MPF, HMF, and the grand total for a formal ocean entry', async () => {
    const result = await estimateDutyForBody(completeBody(), RATES);

    expect(result.estimable).toBe(true);
    if (!result.estimable) return;

    // 3.41% × $10,000 = $341.00
    expect(result.totals.dutyCents).toBe(34100);
    // MPF 0.3464% × $10,000 = $34.64 (inside FY26 min/max, unclamped)
    expect(result.totals.mpfCents).toBe(3464);
    // HMF 0.125% × $10,000 = $12.50 (vessel MOT 11, type 01)
    expect(result.totals.hmfCents).toBe(1250);
    // Grand total = duty + user fees
    expect(result.totals.totalCents).toBe(34100 + 3464 + 1250);
  });

  it('labels every fee class it reports', async () => {
    const result = await estimateDutyForBody(completeBody(), RATES);
    if (!result.estimable) throw new Error('expected estimable');

    const byClass = Object.fromEntries(result.totals.fees.map((f) => [f.classCode, f]));
    expect(byClass['499'].label).toMatch(/merchandise processing/i);
    expect(byClass['499'].amountCents).toBe(3464);
    expect(byClass['501'].label).toMatch(/harbor maintenance/i);
    expect(byClass['501'].amountCents).toBe(1250);
  });

  it('reports a per-line breakdown with HTS, value, duty, and fees', async () => {
    const result = await estimateDutyForBody(completeBody(), RATES);
    if (!result.estimable) throw new Error('expected estimable');

    expect(result.lines).toHaveLength(1);
    expect(result.lines[0]).toMatchObject({
      lineNumber: 1,
      htsNumbers: ['8507600020'],
      valueDollars: 10000,
      dutyCents: 34100,
      mpfCents: 3464,
      hmfCents: 1250,
      adCvdCents: 0,
    });
  });

  it('uses the draft entry date as the fee applicability date', async () => {
    const result = await estimateDutyForBody(completeBody(), RATES);
    if (!result.estimable) throw new Error('expected estimable');
    expect(result.applicabilityDate).toBe('20260820');
  });
});

describe('estimateDutyForBody — fee edge rules', () => {
  it('clamps the MPF total to the fiscal-year minimum for tiny values', async () => {
    const body = completeBody();
    body.manifest[0].invoices[0].items[0].values.totalValueOfGoods = 100;
    const result = await estimateDutyForBody(body, RATES);
    if (!result.estimable) throw new Error('expected estimable');

    // Line MPF = 0.3464% × $100 = 35¢ → clamped up to the FY26 min 3358¢.
    expect(result.totals.mpfCents).toBe(3358);
    // Duty 3.41% × $100 = $3.41; HMF 0.125% × $100 = 13¢ (de minimis does
    // not zero it because other revenue exists).
    expect(result.totals.dutyCents).toBe(341);
    expect(result.totals.hmfCents).toBe(13);
  });

  it('exempts informal entries from MPF and charges the informal entry fee', async () => {
    const body = completeBody();
    body.entryType = '11';
    const result = await estimateDutyForBody(body, RATES);
    if (!result.estimable) throw new Error('expected estimable');

    expect(result.totals.mpfCents).toBe(0);
    // Type 11 is HMF-exempt even on vessel MOT.
    expect(result.totals.hmfCents).toBe(0);
    // Informal entry fee, class 311, FY26 = 269¢.
    const informal = result.totals.fees.find((f) => f.classCode === '311');
    expect(informal?.amountCents).toBe(269);
    expect(result.totals.totalCents).toBe(34100 + 269);
  });
});

describe('estimateDutyForBody — incomplete or unpriceable drafts', () => {
  it('returns the missing fields for an incomplete draft instead of throwing', async () => {
    const body = completeBody() as unknown as Record<string, unknown>;
    delete body.entryConsignee;
    delete body.bond;

    const result = await estimateDutyForBody(body, RATES);
    expect(result.estimable).toBe(false);
    if (result.estimable) return;

    const fields = result.issues.map((i) => i.field);
    expect(fields.some((f) => f.startsWith('entryConsignee'))).toBe(true);
    expect(fields.some((f) => f.startsWith('bond'))).toBe(true);
  });

  it('surfaces an unknown HTS number as an issue, not a crash', async () => {
    const result = await estimateDutyForBody(completeBody(), new StaticRateSource({}));
    expect(result.estimable).toBe(false);
    if (result.estimable) return;
    expect(result.issues.some((i) => /no HTS rate available/i.test(i.message))).toBe(true);
  });

  it('surfaces migrator rejections (unmappable entry number) as issues', async () => {
    const body = completeBody();
    // Passes the draft schema's length regex but cannot split into
    // filer code + 8-digit number.
    body.entryNumber = 'BADBADBADBAD';
    const result = await estimateDutyForBody(body, RATES);
    expect(result.estimable).toBe(false);
    if (result.estimable) return;
    expect(result.issues.some((i) => /cannot split/i.test(i.message))).toBe(true);
  });

  it('never throws on garbage input', async () => {
    const result = await estimateDutyForBody({ hello: 'world' }, RATES);
    expect(result.estimable).toBe(false);
  });
});
