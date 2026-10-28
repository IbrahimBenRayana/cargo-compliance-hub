/**
 * Payload schema v2, mapper, migrator, and the golden-file harness
 * (Phase 1.5, MIGRATION_PLAN.md decision D2).
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseAbiPayloadV2, isAbiPayloadV2 } from '../payload/schemaV2.js';
import { toAeEntrySummaryInput, toWireDate } from '../payload/toAeInput.js';
import { migrateV1ToV2, splitV1EntryNumber } from '../payload/migrateV1.js';
import { buildEntrySummary } from '../ae/builder.js';
import { buildBatch, scenarioTag } from '../envelope/batch.js';
import { RecordCodecError } from '../records/codec.js';
import { TYPE01_PAYLOAD_V2 } from './fixtures/type01PayloadV2.js';
import type { AbiDocumentBody } from '../../services/abi/types.js';

const HERE = dirname(fileURLToPath(import.meta.url));

describe('payload schema v2', () => {
  it('accepts the type-01 fixture and discriminates versions', () => {
    expect(() => parseAbiPayloadV2(TYPE01_PAYLOAD_V2)).not.toThrow();
    expect(isAbiPayloadV2(TYPE01_PAYLOAD_V2)).toBe(true);
    expect(isAbiPayloadV2({ entryType: '01' })).toBe(false); // v1 shape
  });

  it('rejects malformed HTS numbers and dates', () => {
    const bad = structuredClone(TYPE01_PAYLOAD_V2);
    bad.entrySummary.lines[0].tariffs[0].htsNumber = '8507.60.0020';
    expect(() => parseAbiPayloadV2(bad)).toThrow(/HTS/);

    const badDate = structuredClone(TYPE01_PAYLOAD_V2);
    badDate.entrySummary.dates!.estimatedEntry = '08/20/26';
    expect(() => parseAbiPayloadV2(badDate)).toThrow(/YYYYMMDD/);
  });
});

describe('toAeEntrySummaryInput', () => {
  it('converts storage dates (YYYYMMDD) to wire dates (MMDDYY)', () => {
    expect(toWireDate('20260820')).toBe('082026');
    const input = toAeEntrySummaryInput(TYPE01_PAYLOAD_V2, 'A');
    expect(input.header?.estimatedEntryDate).toBe('082026');
    expect(input.header?.dateOfImportation).toBe('081526');
    expect(input.cargo?.estimatedDateOfArrival).toBe('081426');
    expect(input.payment?.preliminaryStatementPrintDate).toBe('090126');
    expect(input.lines?.[0].dateOfExportation).toBe('080126');
  });

  it('refuses to build when the duty engine has not run', () => {
    const pending = structuredClone(TYPE01_PAYLOAD_V2);
    delete pending.entrySummary.lines[0].tariffs[0].dutyCents;
    expect(() => toAeEntrySummaryInput(pending, 'A')).toThrow(/duty amount not computed/);

    const noTotals = structuredClone(TYPE01_PAYLOAD_V2);
    delete noTotals.entrySummary.grandTotals;
    expect(() => toAeEntrySummaryInput(noTotals, 'A')).toThrow(/grand totals not computed/);
  });

  it('maps a Delete to identity fields only, skipping completeness checks', () => {
    const noTotals = structuredClone(TYPE01_PAYLOAD_V2);
    delete noTotals.entrySummary.grandTotals;
    const input = toAeEntrySummaryInput(noTotals, 'D');
    expect(input.action).toBe('D');
    expect(input.lines).toBeUndefined();
    expect(buildEntrySummary(input)).toHaveLength(1);
  });
});

describe('migrateV1ToV2', () => {
  const V1: AbiDocumentBody = {
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
                htsNumber: '8507.60.0020',
                description: 'LITHIUM ION BATTERY PACKS',
                origin: { country: 'CN' },
                values: { currency: 'USD', exchangeRate: 1, totalValueOfGoods: 10000 },
                quantity1: '500 NO',
                weight: { gross: '2646', uom: 'L' }, // pounds → kg
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
  };

  it('splits the hyphenated entry number into filer + 8-char number', () => {
    expect(splitV1EntryNumber('ABC-1234567-6')).toEqual({ filerCode: 'ABC', entryNumber: '12345676' });
    expect(splitV1EntryNumber('ABC12345676')).toEqual({ filerCode: 'ABC', entryNumber: '12345676' });
    expect(() => splitV1EntryNumber('12345')).toThrow(RecordCodecError);
  });

  it('migrates the full v1 document into a valid v2 payload', () => {
    const v2 = migrateV1ToV2(V1);
    const es = v2.entrySummary;
    expect(es.filerCode).toBe('ABC');
    expect(es.entryNumber).toBe('12345676');
    expect(es.districtPortOfEntry).toBe('2704');
    expect(es.importerOfRecord.number).toBe('26-164751100');
    expect(es.bonds?.[0]).toMatchObject({ bondTypeCode: '8', suretyCompanyCode: '123' });
    expect(es.payment?.typeCode).toBe('2');
    expect(es.cargo?.locationOfGoodsCode).toBe('Y123');
    // SCAC-prefixed 16-char bill split into issuer + 12-char identifier:
    expect(es.manifests?.[0].bills).toEqual([{ type: 'M', issuerCode: 'MAEU', identifier: '123456789012' }]);
    const line = es.lines[0];
    expect(line.tariffs[0]).toMatchObject({
      htsNumber: '8507600020', // dots stripped
      valueDollars: 10000,
      uomCode1: 'NO',
      quantity1Hundredths: 50000, // "500 NO" → 500.00
    });
    expect(line.tariffs[0].dutyCents).toBeUndefined(); // duty engine's job
    expect(line.grossWeightKg).toBe(1200); // 2646 lb → 1200 kg
    expect(line.parties).toEqual([
      { type: 'S', identifier: '26-164751100' },
      { type: 'M', identifier: 'CNSHEBATSHE' }, // derived MID (Directive 3500-13)
    ]);
    expect(v2.commercial?.invoices?.[0]).toMatchObject({ invoiceNumber: 'INV-1', itemSkus: ['BAT-01'] });
    expect(v2.commercial?.consignee?.name).toBe('SIGMA TECHNOLOGY PARTNERS LLC');
  });

  it('survives the full shadow pipeline: migrate \u2192 duty \u2192 validate \u2192 build', async () => {
    // The exact chain services/abiShadow.ts runs after every CC submission.
    const { enrichWithDuty, StaticRateSource } = await import('../duty/engine.js');
    const { toAeEntrySummaryInput } = await import('../payload/toAeInput.js');
    const { validateEntrySummary } = await import('../validate/entrySummary.js');
    const priced = await enrichWithDuty(
      migrateV1ToV2(V1),
      new StaticRateSource({ '8507600020': '3.41%' }),
      { applicabilityDate: '20260820' }
    );
    const input = toAeEntrySummaryInput(priced, 'A');
    // MID derivation closes the manufacturer-party gap: clean validation.
    expect(validateEntrySummary(input)).toEqual([]);
    const lines = buildEntrySummary(input);
    expect(lines[0].startsWith('10')).toBe(true);
    expect(lines[lines.length - 1].startsWith('90')).toBe(true);
  });

  it('refuses unmappable values instead of degrading silently', () => {
    expect(() => migrateV1ToV2({ ...V1, entryNumber: 'BAD' })).toThrow(/cannot split/);
    expect(() => migrateV1ToV2({ ...V1, bond: { ...V1.bond, type: 'X' } })).toThrow(/bond type/);
    expect(() =>
      migrateV1ToV2({ ...V1, manifest: [{ ...V1.manifest[0], quantity: 'lots' }] })
    ).toThrow(/manifested quantity/);
  });
});

describe('deriveMid (Directive 3500-13)', () => {
  it('constructs country + 3+3 name + street number + city', async () => {
    const { deriveMid } = await import('../payload/mid.js');
    expect(
      deriveMid({ name: 'NICSAN APPLIANCE WORKS', address: '435 INDUSTRIAL RD', city: 'TAICHUNG', countryCode: 'TW' })
    ).toBe('TWNICAPP435TAI');
    // Ignored articles + hyphenated words merge (AMF/Directive rules).
    expect(deriveMid({ name: 'THE FRITZ-WERNER GROUP', address: '12345 MAIN ST', city: 'BERLIN', countryCode: 'DE' })).toBe(
      'DEFRIGRO1234BER' // street number capped at 4 digits
    );
    // Initials run counts as one word.
    expect(deriveMid({ name: 'A B C COMPANY', city: 'OSAKA', countryCode: 'JP' })).toBe('JPABCCOMOSA');
    // Single-word firm: first six characters (cert package: TWNICSAN435TAI).
    expect(deriveMid({ name: 'NICSAN', address: '435 INDUSTRIAL RD', city: 'TAICHUNG', countryCode: 'TW' })).toBe(
      'TWNICSAN435TAI'
    );
  });

  it('applies the Canadian province rule and refuses CA without a province', async () => {
    const { deriveMid } = await import('../payload/mid.js');
    expect(
      deriveMid({ name: 'MAPLE AUTO PARTS', address: '77 KING ST', city: 'TORONTO', countryCode: 'CA', stateOrProvince: 'ON' })
    ).toBe('XOMAPAUT77TOR');
    expect(() => deriveMid({ name: 'MAPLE AUTO', city: 'TORONTO', countryCode: 'CA' })).toThrow(RecordCodecError);
  });

  it('requires a usable name and country', async () => {
    const { deriveMid } = await import('../payload/mid.js');
    expect(() => deriveMid({ name: '', city: 'PARIS', countryCode: 'FR' })).toThrow(RecordCodecError);
    expect(() => deriveMid({ name: 'ACME', city: 'PARIS', countryCode: '' })).toThrow(RecordCodecError);
  });
});

describe('golden-file harness', () => {
  it('the full pipeline output matches the reviewed golden record stream', () => {
    const input = toAeEntrySummaryInput(parseAbiPayloadV2(TYPE01_PAYLOAD_V2), 'A');
    const batch = buildBatch({
      sender: { siteCode: 'LGB1', idCode: 'ABC', password: 'SECRET' },
      appId: 'AE',
      transmissionDate: '082026',
      blocks: [
        {
          port: '2704',
          filerCode: 'ABC',
          userData: scenarioTag(1),
          transactionLines: buildEntrySummary(input),
        },
      ],
    });
    const stream = batch.join('\n') + '\n';
    const goldenPath = join(HERE, 'golden', 'type01-entry-summary.golden.txt');
    if (process.env.GOLDEN_UPDATE === '1') {
      writeFileSync(goldenPath, stream);
    }
    const golden = readFileSync(goldenPath, 'utf8');
    expect(stream).toBe(golden);
  });
});
