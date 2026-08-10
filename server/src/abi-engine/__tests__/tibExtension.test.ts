/**
 * TIB companion application tests — positions and formats asserted against
 * the "Temporary Importation Bond / Extend Close" chapter, Jan 26 2018
 * rev 05 (TIB-n page refs, tib-xa-e0-rev05-2018.pdf) and the "Temporary
 * Importation Bond / Expiration Notice" chapter, Jan 26 2018 rev 03
 * (TS-n page refs, tib-x1-rev03-2018.pdf).
 */
import { describe, it, expect } from 'vitest';
import { buildTibExtension, type TibExtendCloseInput } from '../apps/tib/builder.js';
import { OUTPUT_E0, OUTPUT_E1, OUTPUT_X1_NOTICE } from '../apps/tib/recordDefs.js';
import {
  parseTibResponse,
  parseTibResponseBatch,
  parseTibExpirationNotices,
  parseTibExpirationNoticeBatch,
  TIB_CONDITION_CODES,
} from '../apps/tib/responseParser.js';
import { writeRecord, RecordCodecError } from '../records/codec.js';
import { OUTPUT_X1 as ENVELOPE_X1 } from '../envelope/recordDefs.js';

const EXTEND: TibExtendCloseInput = {
  action: 'extend',
  districtPortOfEntrySummary: '2704',
  filerCode: 'ABC',
  entryNumber: '1234567', // check digit 6 (see ae.test.ts worked formula)
};

// ── Building the XA request (TIB-8..10) ────────────────────

describe('buildTibExtension', () => {
  it('lays out the extension XA-record exactly per TIB-9', () => {
    const lines = buildTibExtension(EXTEND);
    expect(lines).toHaveLength(1); // one XA per TRANSACTION grouping (TIB-8)
    // X A | port 3-6 | filer 7-9 | space | entry 11-18 | code 19 | 61S
    expect(lines[0]).toBe('XA2704ABC 123456761'.padEnd(80, ' '));
    expect(lines[0]).toHaveLength(80);
  });

  it('emits Extension/Closure Code 2 for a closure (Note 2, TIB-10)', () => {
    const [line] = buildTibExtension({ ...EXTEND, action: 'close' });
    expect(line[18]).toBe('2');
    expect(line.slice(0, 18)).toBe('XA2704ABC 12345676');
  });

  it('accepts a full 8-char entry number and validates its check digit (Note 1, Appendix E)', () => {
    const [line] = buildTibExtension({ ...EXTEND, entryNumber: '12345676' });
    expect(line.slice(10, 18)).toBe('12345676');
    expect(() => buildTibExtension({ ...EXTEND, entryNumber: '12345670' })).toThrow(/check digit/);
    expect(() => buildTibExtension({ ...EXTEND, entryNumber: '123456' })).toThrow(/7 digits/);
  });

  it('rejects a malformed district/port client-side (4N, TIB-9)', () => {
    expect(() => buildTibExtension({ ...EXTEND, districtPortOfEntrySummary: '270' })).toThrow(RecordCodecError);
    expect(() => buildTibExtension({ ...EXTEND, districtPortOfEntrySummary: '27O4' })).toThrow(/4 numerals/);
  });

  it('rejects a malformed filer code client-side (3AN, TIB-9)', () => {
    expect(() => buildTibExtension({ ...EXTEND, filerCode: 'AB' })).toThrow(/3 characters/);
    expect(() => buildTibExtension({ ...EXTEND, filerCode: 'ABCD' })).toThrow(RecordCodecError);
  });
});

// ── Response record layouts (TIB-12..14) ───────────────────

describe('TIB response record defs', () => {
  it('lays out the E0 condition reference exactly per TIB-12', () => {
    const line = writeRecord(OUTPUT_E0, {
      referenceDataTypeCode: 'SUMMRY',
      occurrencePosition: '1',
      entryFilerCode: 'ABC',
      entryNumber: '12345676',
    });
    // E0 | SUMMRY 4-9 | occurrence 11-16 right-justified | REF ID: 18-24
    // | filer 26-28 | entry 30-37 | 43S
    expect(line).toBe('E0 SUMMRY      1 REF ID: ABC 12345676' + ' '.repeat(43));
  });

  it('lays out the E1 disposition exactly per TIB-13..14', () => {
    const line = writeRecord(OUTPUT_E1, {
      dispositionTypeCode: 'A',
      severityCode: ' ',
      conditionCode: '995',
      narrativeText: 'EXT GRANTED SUBJECT TO REVIEW',
      entryFilerCode: 'ABC',
      entryNumber: '12345676',
      brokerReferenceNumber: 'REF001',
    });
    expect(line).toBe(
      'E1A 995   ' + // ids 1-2, disposition 3, severity 4, code 5-7, 3S filler 8-10
        'EXT GRANTED SUBJECT TO REVIEW'.padEnd(40, ' ') + // narrative 11-50
        'ABC' + // filer 51-53
        '  ' + // reserved expansion filler 54-55
        '12345676' + // entry 56-63
        '     ' + // filler 64-68
        'REF001   ' + // broker ref 69-77 (9X)
        '   ' // filler 78-80
    );
  });

  it('accepts printed Note 2 narratives with specials (documented AN→X transcription)', () => {
    // "ENTRY TYPE MUST BE '23'" and "EXT-CLOSE REQ LATE, ENTRY CLOSED"
    // contain ' - , which the printed 40AN class would forbid — the def
    // deliberately uses class X (see recordDefs.ts).
    const line = writeRecord(OUTPUT_E1, {
      dispositionTypeCode: 'R',
      severityCode: 'F',
      conditionCode: '8XY',
      narrativeText: TIB_CONDITION_CODES['8XY'],
    });
    expect(line.slice(10, 50).trimEnd()).toBe("ENTRY TYPE MUST BE '23'");
  });
});

// ── Parsing the TX response (TIB-11..14) ───────────────────

function e0Summry(occurrence: number): string {
  return writeRecord(OUTPUT_E0, {
    referenceDataTypeCode: 'SUMMRY',
    occurrencePosition: String(occurrence),
    entryFilerCode: 'ABC',
    entryNumber: '12345676',
  });
}

describe('parseTibResponse', () => {
  it('parses an accepted extension (995 EXT GRANTED SUBJECT TO REVIEW)', () => {
    const lines = [
      e0Summry(1),
      writeRecord(OUTPUT_E1, {
        dispositionTypeCode: 'A',
        severityCode: ' ',
        conditionCode: '995',
        narrativeText: 'EXT GRANTED SUBJECT TO REVIEW',
        entryFilerCode: 'ABC',
        entryNumber: '12345676',
        brokerReferenceNumber: 'REF001',
      }),
    ];
    const [response] = parseTibResponse(lines);
    expect(response.referenceType).toBe('SUMMRY');
    expect(response.occurrence).toBe(1);
    expect(response.entryFilerCode).toBe('ABC');
    expect(response.entryNumber).toBe('12345676');
    expect(response.conditions).toHaveLength(0);
    expect(response.disposition).toMatchObject({
      accepted: true,
      conditionCode: '995',
      narrative: 'EXT GRANTED SUBJECT TO REVIEW',
      brokerReferenceNumber: 'REF001',
    });
  });

  it('parses a rejection with a preceding fatal condition (8WA then 998)', () => {
    const lines = [
      e0Summry(1),
      writeRecord(OUTPUT_E1, {
        dispositionTypeCode: ' ',
        severityCode: 'F',
        conditionCode: '8WA',
        narrativeText: 'NO ENTRY EXISTS',
      }),
      writeRecord(OUTPUT_E1, {
        dispositionTypeCode: 'R',
        severityCode: 'F',
        conditionCode: '998',
        narrativeText: 'TRANSACTION DATA REJECTED',
        entryFilerCode: 'ABC',
        entryNumber: '12345676',
      }),
    ];
    const [response] = parseTibResponse(lines);
    expect(response.conditions).toHaveLength(1);
    expect(response.conditions[0]).toEqual({ severity: 'F', conditionCode: '8WA', narrative: 'NO ENTRY EXISTS' });
    expect(response.disposition).toMatchObject({ accepted: false, conditionCode: '998', severity: 'F' });
  });

  it('separates multiple XA groupings within one response block', () => {
    const lines = [
      e0Summry(1),
      writeRecord(OUTPUT_E1, {
        dispositionTypeCode: 'A',
        severityCode: ' ',
        conditionCode: '996',
        narrativeText: 'CLOSURE REQ ACCEPTED',
      }),
      e0Summry(2),
      writeRecord(OUTPUT_E1, {
        dispositionTypeCode: 'R',
        severityCode: 'F',
        conditionCode: '8XW',
        narrativeText: 'EXTENSION LIMIT REACHED',
      }),
    ];
    const responses = parseTibResponse(lines);
    expect(responses).toHaveLength(2);
    expect(responses[0].disposition?.accepted).toBe(true);
    expect(responses[0].disposition?.narrative).toBe('CLOSURE REQ ACCEPTED');
    expect(responses[1].occurrence).toBe(2);
    expect(responses[1].disposition?.accepted).toBe(false);
  });

  it('falls back to the Note 2 narrative table when the wire narrative is blank', () => {
    const lines = [
      e0Summry(1),
      writeRecord(OUTPUT_E1, {
        dispositionTypeCode: ' ',
        severityCode: 'F',
        conditionCode: '8XT',
        narrativeText: ' ',
      }),
    ];
    const [response] = parseTibResponse(lines);
    expect(response.conditions[0].narrative).toBe('SCHED CLOSE DT NOT WITHIN 60 DAYS');
  });

  it('parses a full TX wire response through the envelope', () => {
    const inner = [
      e0Summry(1),
      writeRecord(OUTPUT_E1, {
        dispositionTypeCode: 'A',
        severityCode: ' ',
        conditionCode: '995',
        narrativeText: 'EXT GRANTED SUBJECT TO REVIEW',
      }),
    ];
    const wire = [
      'A   LGB1ABCSECRET080726     TX'.padEnd(80, ' '),
      'B  2704ABCTX'.padEnd(80, ' '),
      ...inner,
      'Y  2704ABCTX'.padEnd(80, ' '),
      'Z   LGB1ABC      080726'.padEnd(80, ' '),
    ];
    const result = parseTibResponseBatch(wire);
    expect(result.batchRejected).toBe(false);
    expect(result.responses).toHaveLength(1);
    expect(result.responses[0].disposition?.narrative).toBe('EXT GRANTED SUBJECT TO REVIEW');
  });
});

// ── Expiration notices (TS chapter) ────────────────────────

describe('TIB expiration notices', () => {
  const NOTICE_VALUES = {
    districtPortOfEntrySummary: '2704',
    entryFilerCode: 'ABC',
    entryNumber: '12345676',
    importerOfRecordNumber: '26-164751100',
    tibExpirationDate: '090126',
    totalNumberOfExtensions: '2',
  };

  it('lays out the X1 notice exactly per TS-10..11', () => {
    const line = writeRecord(OUTPUT_X1_NOTICE, NOTICE_VALUES);
    // X 1 | port 3-6 | filer 7-9 | space | entry 11-18 | importer 19-30
    // | expiration 31-36 | extensions 37 | 43S
    expect(line).toBe('X12704ABC 1234567626-1647511000901262' + ' '.repeat(43));
  });

  it('parses X1 notice lines into typed notices', () => {
    const [notice] = parseTibExpirationNotices([writeRecord(OUTPUT_X1_NOTICE, NOTICE_VALUES)]);
    expect(notice).toEqual({
      districtPortOfEntrySummary: '2704',
      entryFilerCode: 'ABC',
      entryNumber: '12345676',
      importerOfRecordNumber: '26-164751100',
      tibExpirationDate: '090126',
      totalNumberOfExtensions: 2,
    });
  });

  it('extracts notices from inside a TS block rather than treating X1 as envelope conditions', () => {
    const wire = [
      'A   LGB1ABC       080726    TS'.padEnd(80, ' '),
      'B  2704ABCTS'.padEnd(80, ' '),
      writeRecord(OUTPUT_X1_NOTICE, NOTICE_VALUES),
      'Y  2704ABCTS'.padEnd(80, ' '),
      'Z   LGB1ABC      080726'.padEnd(80, ' '),
    ];
    const result = parseTibExpirationNoticeBatch(wire);
    expect(result.batchRejected).toBe(false);
    expect(result.envelopeConditions).toHaveLength(0);
    expect(result.notices).toHaveLength(1);
    expect(result.notices[0].entryNumber).toBe('12345676');
  });

  it('still recognises an envelope-level X1 batch rejection outside any block', () => {
    const reject = writeRecord(ENVELOPE_X1, {
      dispositionType: 'R',
      severity: 'F',
      conditionCode: '999',
      narrative: 'BATCH REJECTED',
    });
    const result = parseTibExpirationNoticeBatch(['A   LGB1ABC       080726    TS'.padEnd(80, ' '), reject]);
    expect(result.batchRejected).toBe(true);
    expect(result.notices).toHaveLength(0);
    expect(result.envelopeConditions[0]).toMatchObject({
      conditionCode: '999',
      narrative: 'BATCH REJECTED',
      finalDisposition: true,
    });
  });
});

// ── Note 2 condition-code table (TIB-14) ───────────────────

describe('TIB_CONDITION_CODES', () => {
  it('carries the printed Note 2 narratives', () => {
    expect(TIB_CONDITION_CODES['8WA']).toBe('NO ENTRY EXISTS');
    expect(TIB_CONDITION_CODES['8XY']).toBe("ENTRY TYPE MUST BE '23'");
    expect(TIB_CONDITION_CODES['995']).toBe('EXT GRANTED SUBJECT TO REVIEW');
    expect(TIB_CONDITION_CODES['996']).toBe('CLOSURE REQ ACCEPTED');
    expect(TIB_CONDITION_CODES['999']).toBe('BATCH REJECTED');
    expect(Object.keys(TIB_CONDITION_CODES)).toHaveLength(17);
  });
});
