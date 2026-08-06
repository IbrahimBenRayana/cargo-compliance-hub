/**
 * Entry Summary (AE/AX) tests — positions and formats asserted against the
 * Entry Summary Create/Update chapter, July 2026 (ESF page refs in comments).
 */
import { describe, it, expect } from 'vitest';
import { buildEntrySummary, type AeEntrySummaryInput } from '../ae/builder.js';
import { computeEntryCheckDigit, formatEntryNumber } from '../ae/checkDigit.js';
import { parseAeResponse, parseAeResponseBatch } from '../ae/responseParser.js';
import { OUTPUT_E0, OUTPUT_E1 } from '../ae/responseDefs.js';
import { writeRecord, RecordCodecError } from '../records/codec.js';
import { buildBatch, scenarioTag } from '../envelope/batch.js';

// ── Check digit (AE Table 1, ESF-213) ──────────────────────

describe('entry number check digit', () => {
  it('computes the worked formula: alpha conversion, even ×2 (+1 over 9), mod 10', () => {
    // ABC1234567 → base 1,2,3,1,2,3,4,5,6,7; evens 2,1,3,5,7 → ×2 = 4,2,6,10→11,14→15
    // → ones 4,2,6,1,5 = 18; odds 1+3+2+4+6 = 16; total 34 → 10-4 = 6.
    expect(computeEntryCheckDigit('ABC', '1234567')).toBe(6);
  });

  it('wraps to 0 when the sum ends in 0', () => {
    // 9999999999 → evens ×2 = 18→19 → ones 9 ×5 = 45; odds 45; total 90 → (10-0)%10 = 0.
    expect(computeEntryCheckDigit('999', '9999999')).toBe(0);
  });

  it('formats a 7-digit sequence and validates an 8-char number', () => {
    expect(formatEntryNumber('ABC', '1234567')).toBe('12345676');
    expect(formatEntryNumber('ABC', '12345676')).toBe('12345676');
    expect(() => formatEntryNumber('ABC', '12345670')).toThrow(/check digit/);
  });

  it('rejects malformed filer codes and sequences', () => {
    expect(() => computeEntryCheckDigit('AB', '1234567')).toThrow(/filer code/);
    expect(() => computeEntryCheckDigit('ABC', '123456')).toThrow(/7 digits/);
  });
});

// ── Building a type 01 consumption summary ─────────────────

const TYPE_01: AeEntrySummaryInput = {
  action: 'A',
  filerCode: 'ABC',
  entryNumber: '1234567',
  districtPortOfEntry: '2704',
  brokerReferenceNumber: 'REF001',
  entryTypeCode: '01',
  motCode: '11',
  payment: { typeCode: '2', preliminaryStatementPrintDate: '090126' },
  header: {
    importerOfRecordNumber: '26-164751100',
    estimatedEntryDate: '082026',
    usStateOfDestination: 'CA',
  },
  cargo: {
    carrierCode: 'MAEU',
    districtPortOfUnlading: '2704',
    conveyanceName: 'EVER GIVEN',
  },
  manifests: [
    { manifestedQuantity: 100, uomCode: 'CTNS', bills: [{ type: 'M', issuerCode: 'MAEU', identifier: '123456789012' }] },
  ],
  bonds: [{ bondTypeCode: '8', designationTypeCode: 'B', suretyCompanyCode: '123' }],
  lines: [
    {
      countryOfOrigin: 'CN',
      countryOfExport: 'CN',
      dateOfExportation: '080126',
      relatedPartyIndicator: 'N',
      chargesDollars: 500,
      grossWeightKg: 1200,
      descriptions: ['LITHIUM ION BATTERY PACKS'],
      parties: [
        { type: 'M', identifier: 'CNSHEBAT123SHA' },
        { type: 'S', identifier: '26-164751100' },
      ],
      tariffs: [
        { htsNumber: '8507600020', dutyCents: 34100, valueDollars: 10000, uomCode1: 'NO', quantity1Hundredths: 50000 },
      ],
      fees: [
        { classCode: '499', amountCents: 3464 },
        { classCode: '501', amountCents: 1250 },
      ],
    },
  ],
  feeTotals: [
    { classCode: '499', amountCents: 3464 },
    { classCode: '501', amountCents: 1250 },
  ],
  grandTotals: { dutyCents: 34100, userFeeCents: 4714, irTaxCents: 0, adDutyCents: 0, cvDutyCents: 0 },
};

describe('buildEntrySummary', () => {
  it('emits records in structure-map order with an appended check digit', () => {
    const lines = buildEntrySummary(TYPE_01);
    expect(lines.map((l) => l.slice(0, 2).trim())).toEqual([
      '10', '11', '20', '22', '23', '31', '40', '44', '47', '47', '50', '62', '62', '89', '90',
    ]);
    for (const line of lines) expect(line).toHaveLength(80);
  });

  it('lays out the 10-record exactly per ESF-26..34', () => {
    const rec10 = buildEntrySummary(TYPE_01)[0];
    expect(rec10.slice(0, 2)).toBe('10'); // control id
    expect(rec10[2]).toBe('A'); // action
    expect(rec10.slice(3, 6)).toBe('ABC'); // filer
    expect(rec10.slice(8, 16)).toBe('12345676'); // entry number incl. computed check digit 6
    expect(rec10.slice(17, 21)).toBe('2704'); // district/port
    expect(rec10.slice(21, 30)).toBe('REF001   '); // broker ref, left-justified
    expect(rec10.slice(33, 35)).toBe('01'); // entry type
    expect(rec10.slice(35, 37)).toBe('11'); // MOT
    expect(rec10[38]).toBe('X'); // electronic signature (mandatory on Add)
    expect(rec10[50]).toBe('2'); // payment type
    expect(rec10.slice(51, 57)).toBe('090126'); // preliminary statement print date
  });

  it('right-justifies (S)N money and quantity fields on the 50-record (ESF-89)', () => {
    const lines = buildEntrySummary(TYPE_01);
    const rec50 = lines.find((l) => l.startsWith('50'))!;
    expect(rec50.slice(2, 12)).toBe('8507600020'); // HTS
    expect(rec50.slice(13, 23)).toBe('     34100'); // duty, cents, right-justified
    expect(rec50.slice(24, 34)).toBe('     10000'); // value, whole dollars
    expect(rec50.slice(35, 47)).toBe('       50000'); // qty 1, 2 implied decimals
    expect(rec50.slice(47, 50)).toBe('NO '); // UOM 1
  });

  it('writes fee totals and grand totals per ESF-129/131', () => {
    const lines = buildEntrySummary(TYPE_01);
    const rec89 = lines.find((l) => l.startsWith('89'))!;
    expect(rec89.slice(2, 5)).toBe('499');
    expect(rec89.slice(5, 16)).toBe('       3464');
    expect(rec89.slice(16, 19)).toBe('501');
    expect(rec89.slice(19, 30)).toBe('       1250');
    const rec90 = lines.find((l) => l.startsWith('90'))!;
    expect(rec90.slice(2, 13)).toBe('      34100'); // grand total duty
    expect(rec90.slice(14, 25)).toBe('       4714'); // grand total user fees
    expect(rec90.slice(26, 37)).toBe('          0'); // IR tax reported as $0.00
  });

  it('emits only the 10-record on a Delete, with conditionals space-filled (Note 2, ESF-34)', () => {
    const lines = buildEntrySummary({
      action: 'D',
      filerCode: 'ABC',
      entryNumber: '1234567',
      districtPortOfEntry: '2704',
      entryTypeCode: '01',
    });
    expect(lines).toHaveLength(1);
    expect(lines[0][2]).toBe('D');
    expect(lines[0].slice(35, 80).trim()).toBe(''); // no MOT, signature, payment…
  });

  it('rejects an Add without importer of record, line items, or grand totals', () => {
    expect(() => buildEntrySummary({ ...TYPE_01, header: undefined })).toThrow(RecordCodecError);
    expect(() => buildEntrySummary({ ...TYPE_01, lines: [] })).toThrow(/at least one line item/);
    expect(() => buildEntrySummary({ ...TYPE_01, grandTotals: undefined })).toThrow(/grand totals/);
  });

  it('rejects class violations client-side (certification requirement)', () => {
    expect(() =>
      buildEntrySummary({
        ...TYPE_01,
        lines: [{ ...TYPE_01.lines![0], tariffs: [{ htsNumber: 'BAD-HTS!!', dutyCents: 0, valueDollars: 0, uomCode1: 'NO' }] }],
      })
    ).toThrow(RecordCodecError);
    expect(() => buildEntrySummary({ ...TYPE_01, entryNumber: '12ABC67' })).toThrow(/7 digits/);
    expect(() =>
      buildEntrySummary({ ...TYPE_01, grandTotals: { ...TYPE_01.grandTotals!, dutyCents: 341.5 } })
    ).toThrow(/non-negative integer/);
  });

  it('orders manifest bills I, M, H, S regardless of input order (Note 1, ESF-44)', () => {
    const lines = buildEntrySummary({
      ...TYPE_01,
      manifests: [
        {
          manifestedQuantity: 10,
          uomCode: 'PCS',
          bills: [
            { type: 'H', issuerCode: 'MAEU', identifier: 'HOUSE1' },
            { type: 'M', issuerCode: 'MAEU', identifier: 'MASTER1' },
          ],
        },
      ],
    });
    const bills = lines.filter((l) => l.startsWith('23'));
    expect(bills[0][2]).toBe('M');
    expect(bills[1][2]).toBe('H');
  });

  it('wraps into an AE batch with the scenario tag at B-record position 60', () => {
    const batch = buildBatch({
      sender: { siteCode: 'LGB1', idCode: 'ABC', password: 'SECRET' },
      appId: 'AE',
      blocks: [
        {
          port: '2704',
          filerCode: 'ABC',
          userData: scenarioTag(1),
          transactionLines: buildEntrySummary(TYPE_01),
        },
      ],
    });
    expect(batch[0][0]).toBe('A');
    expect(batch[1].slice(59, 71)).toBe('SCENARIO 001');
    expect(batch[2].slice(0, 2)).toBe('10');
    expect(batch.at(-1)![0]).toBe('Z');
  });
});

// ── Parsing the AX response (ESF-192..212) ─────────────────

function e0(type: string, occurrence: number, text: string): string {
  return writeRecord(OUTPUT_E0, {
    referenceDataTypeCode: type,
    occurrencePosition: String(occurrence),
    refIdConstant: 'REF ID:',
    referenceDataText: text,
  });
}

// SUMMRY reference text layout (ESF-194): filer 26-28, entry 30-37,
// broker ref 39-50, team 52-54 → relative offsets 0, 4, 13, 26.
const SUMMRY_TEXT = 'ABC 12345676 REF001       001';

describe('parseAeResponse', () => {
  it('parses an accepted summary with version number (ESF-204..206)', () => {
    const lines = [
      e0('SUMMRY', 1, SUMMRY_TEXT),
      writeRecord(OUTPUT_E1, {
        dispositionTypeCode: 'A',
        severityCode: 'I',
        conditionCode: 'S01',
        narrativeText: 'SUMMARY HAS BEEN ADDED',
        entryFilerCode: 'ABC',
        entryNumber: '12345676',
        versionNumber: '00100',
        brokerReferenceNumber: 'REF001',
      }),
    ];
    const [summary] = parseAeResponse(lines);
    expect(summary.entryFilerCode).toBe('ABC');
    expect(summary.entryNumber).toBe('12345676');
    expect(summary.brokerReferenceNumber).toBe('REF001');
    expect(summary.cbpTeamNumber).toBe('001');
    expect(summary.conditions).toHaveLength(0);
    expect(summary.disposition).toMatchObject({
      accepted: true,
      narrative: 'SUMMARY HAS BEEN ADDED',
      versionNumber: '00100',
    });
  });

  it('attaches E0 signpost references to following fatal conditions', () => {
    const lines = [
      e0('SUMMRY', 1, SUMMRY_TEXT),
      e0('LINITM', 1, '001'),
      e0('TARIFF', 1, '8507600020'),
      writeRecord(OUTPUT_E1, {
        dispositionTypeCode: ' ',
        severityCode: 'F',
        conditionCode: '368',
        narrativeText: 'TARIFF NUMBER UNKNOWN',
      }),
      writeRecord(OUTPUT_E1, {
        dispositionTypeCode: 'R',
        severityCode: 'F',
        conditionCode: 'R01',
        narrativeText: 'TRANSACTION DATA REJECTED',
        entryFilerCode: 'ABC',
        entryNumber: '12345676',
      }),
    ];
    const [summary] = parseAeResponse(lines);
    expect(summary.conditions).toHaveLength(1);
    expect(summary.conditions[0]).toMatchObject({ severity: 'F', conditionCode: '368' });
    expect(summary.conditions[0].references.map((r) => r.type)).toEqual(['LINITM', 'TARIFF']);
    expect(summary.conditions[0].references[1].text).toBe('8507600020');
    expect(summary.disposition).toMatchObject({ accepted: false, narrative: 'TRANSACTION DATA REJECTED' });
  });

  it('separates multiple summaries within one response block', () => {
    const lines = [
      e0('SUMMRY', 1, SUMMRY_TEXT),
      writeRecord(OUTPUT_E1, { dispositionTypeCode: 'A', severityCode: ' ', conditionCode: 'S01', narrativeText: 'SUMMARY HAS BEEN ADDED' }),
      e0('SUMMRY', 2, 'ABC 99999990 REF002'),
      writeRecord(OUTPUT_E1, { dispositionTypeCode: 'R', severityCode: 'F', conditionCode: 'R01', narrativeText: 'TRANSACTION DATA REJECTED' }),
    ];
    const summaries = parseAeResponse(lines);
    expect(summaries).toHaveLength(2);
    expect(summaries[0].disposition?.accepted).toBe(true);
    expect(summaries[1].entryNumber).toBe('99999990');
    expect(summaries[1].disposition?.accepted).toBe(false);
  });

  it('parses a full wire response through the envelope', () => {
    const inner = [
      e0('SUMMRY', 1, SUMMRY_TEXT),
      writeRecord(OUTPUT_E1, { dispositionTypeCode: 'A', severityCode: 'W', conditionCode: 'S02', narrativeText: 'SUMMARY HAS BEEN REPLACED' }),
    ];
    const wire = [
      'A   LGB1ABCSECRET080526     AX'.padEnd(80, ' '),
      'B  2704ABCAX'.padEnd(80, ' '),
      ...inner,
      'Y  2704ABCAX'.padEnd(80, ' '),
      'Z   LGB1ABC      080526'.padEnd(80, ' '),
    ];
    const result = parseAeResponseBatch(wire);
    expect(result.batchRejected).toBe(false);
    expect(result.summaries).toHaveLength(1);
    expect(result.summaries[0].disposition?.narrative).toBe('SUMMARY HAS BEEN REPLACED');
  });
});
