/**
 * Related-party transactions (19 CFR 152.102(g)) — end to end.
 *
 * Phase 1 hard-locked `relatedParties` to 'N', which excluded every
 * intercompany import (a very large share of US import value). The native
 * engine has always modelled it: schemaV2 `relatedPartyIndicator`, AE
 * 40-record column 56. These tests prove the draft schema accepts 'Y' and
 * that it survives migrate → duty → validate → build onto the wire.
 */
import { describe, it, expect } from 'vitest';
import { abiDocumentBodySchema } from '../../schemas/abiDocument.js';
import { migrateV1ToV2 } from '../../abi-engine/payload/migrateV1.js';
import { enrichWithDuty, StaticRateSource } from '../../abi-engine/duty/engine.js';
import { toAeEntrySummaryInput } from '../../abi-engine/payload/toAeInput.js';
import { validateEntrySummary } from '../../abi-engine/validate/entrySummary.js';
import { buildEntrySummary } from '../../abi-engine/ae/builder.js';
import type { AbiDocumentBody } from '../abi/types.js';

function body(relatedParties: 'Y' | 'N'): AbiDocumentBody {
  return {
    entryType: '01',
    modeOfTransport: '11',
    entryNumber: 'SP7-1234567-0',
    dates: { entryDate: '20260820', importDate: '20260815', arrivalDate: '20260814' },
    location: { portOfEntry: '2704', destinationStateUS: 'CA' },
    ior: { number: '26-164751100', name: 'SIGMA TECHNOLOGY PARTNERS LLC' },
    bond: { type: '8', suretyCode: '123', taxId: '26-164751100' },
    payment: { typeCode: 2, preliminaryStatementDate: '20260901' },
    firms: 'Y123',
    entryConsignee: {
      name: 'SIGMA TECHNOLOGY PARTNERS LLC', taxId: '26-164751100',
      address: '1 MAIN ST', city: 'LOS ANGELES', state: 'CA',
      postalCode: '90001', country: 'US',
    },
    manifest: [{
      bill: { type: 'M', mBOL: 'MAEU123456789012', hBOL: 'MAEU123456789012', groupBOL: 'N' },
      carrier: { code: 'MAEU' },
      ports: { portOfUnlading: '2704' },
      quantity: '100',
      quantityUOM: 'CTNS',
      invoices: [{
        purchaseOrder: 'PO-1', invoiceNumber: 'INV-1', exportDate: '20260801',
        relatedParties,
        countryOfExport: 'CN', currency: 'USD', exchangeRate: 1,
        items: [{
          sku: 'BAT-01', htsNumber: '8507600020',
          description: 'LITHIUM ION BATTERY PACKS',
          origin: { country: 'CN' },
          values: { currency: 'USD', exchangeRate: 1, totalValueOfGoods: 10000 },
          quantity1: '500 NO', weight: { gross: '2646', uom: 'L' },
          parties: [
            { type: 'buyer', taxId: '26-164751100' },
            { type: 'manufacturer', name: 'SHENZHEN BATTERY CO', city: 'SHENZHEN', country: 'CN' },
          ],
        }],
      }],
    }],
  } as AbiDocumentBody;
}

/** Build the native wire records for a draft body. */
async function wire(relatedParties: 'Y' | 'N'): Promise<string[]> {
  const priced = await enrichWithDuty(
    migrateV1ToV2(body(relatedParties)),
    new StaticRateSource({ '8507600020': '3.4%' }),
    { applicabilityDate: '20260820' },
  );
  const input = toAeEntrySummaryInput(priced, 'A');
  expect(validateEntrySummary(input)).toEqual([]);
  return buildEntrySummary(input);
}

/** The AE 40-record (line detail) carries relatedPartyIndicator at col 56. */
function line40(records: string[]): string {
  const rec = records.find((r) => r.startsWith('40'));
  if (!rec) throw new Error('no 40-record in the built entry summary');
  return rec;
}

describe('draft schema — related parties', () => {
  it('accepts Y (previously hard-locked to N)', () => {
    const parsed = abiDocumentBodySchema.safeParse(body('Y'));
    expect(parsed.success).toBe(true);
  });

  it('still accepts N', () => {
    expect(abiDocumentBodySchema.safeParse(body('N')).success).toBe(true);
  });

  it('rejects anything other than Y or N', () => {
    const bad = body('N') as unknown as Record<string, any>;
    bad.manifest[0].invoices[0].relatedParties = 'MAYBE';
    expect(abiDocumentBodySchema.safeParse(bad).success).toBe(false);
  });
});

describe('related-party indicator reaches the CBP wire record', () => {
  it("writes 'Y' at column 56 of the 40-record", async () => {
    const rec = line40(await wire('Y'));
    // 1-based CATAIR columns → 0-based string index.
    expect(rec[55]).toBe('Y');
  });

  it("writes 'N' at column 56 for unrelated parties", async () => {
    const rec = line40(await wire('N'));
    expect(rec[55]).toBe('N');
  });

  it('changes nothing else on the record (regression guard)', async () => {
    const y = line40(await wire('Y'));
    const n = line40(await wire('N'));
    expect(y.length).toBe(n.length);
    // Column 56 is the ONLY difference between the two builds.
    const diffs = [...y].map((ch, i) => (ch === n[i] ? null : i)).filter((i) => i !== null);
    expect(diffs).toEqual([55]);
  });
});

describe('public API inherits the change', () => {
  it('accepts Y through createABIDocumentSchema (the /entries write path)', async () => {
    const { createABIDocumentSchema } = await import('../../schemas/abiDocument.js');
    const parsed = createABIDocumentSchema.safeParse({ payload: body('Y') });
    expect(parsed.success).toBe(true);
  });
});
