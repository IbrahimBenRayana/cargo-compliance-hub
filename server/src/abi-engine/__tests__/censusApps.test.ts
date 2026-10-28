/**
 * Census companion application (CW/CO, CJ/CL) tests — positions and formats
 * asserted against the "Census Warning Override" chapter (May 19, 2008,
 * CWO page refs) and the "Census Warning Query" chapter (September 20,
 * 2014, CWQ page refs). Neither chapter prints worked examples, so the
 * expected 80-char lines below are constructed digit-for-digit from the
 * record layout tables.
 */
import { describe, it, expect } from 'vitest';
import { buildCensusOverride, type CwCensusOverrideInput } from '../apps/census/cwBuilder.js';
import { parseCwResponse, parseCwResponseBatch } from '../apps/census/cwResponseParser.js';
import { OUTPUT_CW03 } from '../apps/census/cwRecordDefs.js';
import { buildCensusWarningQuery, type CjCensusWarningQueryInput } from '../apps/census/cjBuilder.js';
import { parseCjResponse, parseCjResponseBatch } from '../apps/census/cjResponseParser.js';
import { OUTPUT_CJ2 } from '../apps/census/cjRecordDefs.js';
import { writeRecord } from '../records/codec.js';

// Entry ABC1234567 has check digit 6 (worked example in ae.test.ts).
const OVERRIDE: CwCensusOverrideInput = {
  filerCode: 'ABC',
  entries: [
    {
      entryNumber: '1234567',
      lines: [{ lineItemIdentifier: '001', overrides: [{ warningCode: 'C31', overrideCode: '55' }] }],
    },
  ],
};

// ── CW: Census Warning Override builder ────────────────────

describe('buildCensusOverride', () => {
  it('lays out CW01 and CW02 exactly per CWO-6..8', () => {
    const lines = buildCensusOverride(OVERRIDE);
    expect(lines).toEqual([
      // CW(1-2) 01(3-4) filer(5-7) filler(8-9) entry no incl check digit(10-17) filler(18-80)
      'CW01ABC  12345676' + ' '.repeat(63),
      // CW(1-2) 02(3-4) filler(5-6) line id(7-9) warning 1(10-12) override 1(13-14) filler(45-80)
      'CW02  001C3155' + ' '.repeat(66),
    ]);
    for (const line of lines) expect(line).toHaveLength(80);
  });

  it('places up to seven warning/override pairs at 5-char intervals from position 10', () => {
    const lines = buildCensusOverride({
      filerCode: 'ABC',
      entries: [
        {
          entryNumber: '12345676',
          lines: [
            {
              lineItemIdentifier: '001',
              overrides: [
                { warningCode: 'C31', overrideCode: '55' },
                { warningCode: 'C32', overrideCode: '56' },
                { warningCode: 'C33', overrideCode: '57' },
              ],
            },
          ],
        },
      ],
    });
    const rec = lines[1];
    expect(rec.slice(9, 14)).toBe('C3155'); // pair 1: 10-14
    expect(rec.slice(14, 19)).toBe('C3256'); // pair 2: 15-19
    expect(rec.slice(19, 24)).toBe('C3357'); // pair 3: 20-24
    expect(rec.slice(24, 80)).toBe(' '.repeat(56)); // pairs 4-7 space filled + filler
  });

  it('repeats CW01 per entry summary and CW02 per line item', () => {
    const lines = buildCensusOverride({
      filerCode: 'ABC',
      entries: [
        {
          entryNumber: '1234567',
          lines: [
            { lineItemIdentifier: '001', overrides: [{ warningCode: 'C31', overrideCode: '55' }] },
            { lineItemIdentifier: '002', overrides: [{ warningCode: 'C31', overrideCode: '55' }] },
          ],
        },
        {
          entryNumber: '9999999',
          lines: [{ lineItemIdentifier: '001', overrides: [{ warningCode: 'C31', overrideCode: '55' }] }],
        },
      ],
    });
    expect(lines.map((l) => l.slice(0, 4))).toEqual(['CW01', 'CW02', 'CW02', 'CW01', 'CW02']);
    expect(lines[3].slice(9, 17)).toBe('99999999'); // ABC9999999 → check digit 9
  });

  it('rejects structural violations the chapter states', () => {
    expect(() => buildCensusOverride({ filerCode: 'ABC', entries: [] })).toThrow(/at least one entry/);
    expect(() =>
      buildCensusOverride({ filerCode: 'ABC', entries: [{ entryNumber: '1234567', lines: [] }] })
    ).toThrow(/at least one CW02/);
    expect(() =>
      buildCensusOverride({
        filerCode: 'ABC',
        entries: [{ entryNumber: '1234567', lines: [{ lineItemIdentifier: '001', overrides: [] }] }],
      })
    ).toThrow(/at least one warning\/override/);
    const eight = Array.from({ length: 8 }, () => ({ warningCode: 'C31', overrideCode: '55' }));
    expect(() =>
      buildCensusOverride({
        filerCode: 'ABC',
        entries: [{ entryNumber: '1234567', lines: [{ lineItemIdentifier: '001', overrides: eight }] }],
      })
    ).toThrow(/at most 7/);
  });

  it('validates the entry number check digit', () => {
    expect(() =>
      buildCensusOverride({
        filerCode: 'ABC',
        entries: [
          { entryNumber: '12345670', lines: [{ lineItemIdentifier: '001', overrides: [{ warningCode: 'C31', overrideCode: '55' }] }] },
        ],
      })
    ).toThrow(/check digit/);
  });
});

// ── CO: Census Warning Override response parser ────────────

describe('parseCwResponse', () => {
  const CW03 = writeRecord(OUTPUT_CW03, {
    entryFilerCode: 'ABC',
    entryNumber: '12345676',
    entrySummaryLineItemIdentifier: '001',
    censusWarningCode: 'C31',
    censusOverrideCode: '55',
    conditionCode: '000',
    narrativeText: 'CENSUS WARNING OVERRIDE PERFORMED',
  });

  it('round-trips a CW03 disposition record (CWO-9)', () => {
    expect(CW03).toHaveLength(80);
    expect(CW03.slice(0, 4)).toBe('CW03');
    const [d] = parseCwResponse([CW03]);
    expect(d).toEqual({
      entryFilerCode: 'ABC',
      entryNumber: '12345676',
      lineItemIdentifier: '001',
      censusWarningCode: 'C31',
      censusOverrideCode: '55',
      conditionCode: '000',
      narrative: 'CENSUS WARNING OVERRIDE PERFORMED',
    });
  });

  it('parses a hand-built line at the exact CWO-9 offsets and skips foreign records', () => {
    const raw = 'CW03ABC  12345676  002C425A927OVERRIDE CODE INVALID FOR WARNING'.padEnd(80, ' ');
    const rows = parseCwResponse(['XX' + ' '.repeat(78), raw]);
    expect(rows).toHaveLength(1);
    expect(rows[0].lineItemIdentifier).toBe('002');
    expect(rows[0].censusWarningCode).toBe('C42');
    expect(rows[0].censusOverrideCode).toBe('5A');
    expect(rows[0].conditionCode).toBe('927');
    expect(rows[0].narrative).toBe('OVERRIDE CODE INVALID FOR WARNING');
  });

  it('parses a full CO wire response through the envelope', () => {
    const wire = [
      'A   LGB1ABCSECRET080726     CO'.padEnd(80, ' '),
      'B  2704ABCCO'.padEnd(80, ' '),
      CW03,
      'Y  2704ABCCO'.padEnd(80, ' '),
      'Z   LGB1ABC      080726'.padEnd(80, ' '),
    ];
    const result = parseCwResponseBatch(wire);
    expect(result.batchRejected).toBe(false);
    expect(result.dispositions).toHaveLength(1);
    expect(result.dispositions[0].narrative).toBe('CENSUS WARNING OVERRIDE PERFORMED');
  });
});

// ── CJ: Census Warning Query builder ───────────────────────

describe('buildCensusWarningQuery', () => {
  it('lays out an entry-number query exactly per CWQ-5..6', () => {
    const lines = buildCensusWarningQuery({ filerCode: 'ABC', queries: [{ entryNumbers: ['1234567'] }] });
    expect(lines).toEqual([
      // CJ(1-2) 1(3) port(4-7) from(8-13) to(14-19) filer(20-22) filler(23-24) entry 1(25-32) fillers/entries 2-5(33-80)
      'CJ1' + ' '.repeat(16) + 'ABC  12345676' + ' '.repeat(48),
    ]);
    expect(lines[0]).toHaveLength(80);
  });

  it('lays out a district/port + date-range query', () => {
    const lines = buildCensusWarningQuery({
      filerCode: 'ABC',
      queries: [{ districtPortOfEntry: '2704', requestedFromDate: '070126', requestedToDate: '073126' }],
    });
    expect(lines).toEqual(['CJ12704070126073126ABC' + ' '.repeat(58)]);
  });

  it('chunks more than five entry numbers into additional CJ1 records (CWQ-5)', () => {
    const lines = buildCensusWarningQuery({
      filerCode: 'ABC',
      queries: [{ entryNumbers: ['1234567', '1234567', '1234567', '1234567', '1234567', '9999999'] }],
    });
    expect(lines).toHaveLength(2);
    // First record: entry numbers fill slots 1-5 contiguously (Note 3).
    expect(lines[0].slice(24, 32)).toBe('12345676'); // slot 1: 25-32
    expect(lines[0].slice(34, 42)).toBe('12345676'); // slot 2: 35-42
    expect(lines[0].slice(44, 52)).toBe('12345676'); // slot 3: 45-52
    expect(lines[0].slice(54, 62)).toBe('12345676'); // slot 4: 55-62
    expect(lines[0].slice(64, 72)).toBe('12345676'); // slot 5: 65-72
    // Second record: sixth entry number in slot 1, rest space filled.
    expect(lines[1].slice(24, 32)).toBe('99999999'); // ABC9999999 → check digit 9
    expect(lines[1].slice(32, 80)).toBe(' '.repeat(48));
  });

  it('rejects criteria violations from CJ1 Notes 1-3', () => {
    const build = (q: CjCensusWarningQueryInput['queries'][number]) =>
      buildCensusWarningQuery({ filerCode: 'ABC', queries: [q] });
    expect(() => buildCensusWarningQuery({ filerCode: 'ABC', queries: [] })).toThrow(/at least one query/);
    expect(() => build({})).toThrow(/district\/port, a from\/to date pair, or at least one entry number/);
    expect(() => build({ requestedFromDate: '070126' })).toThrow(/provided together/);
    expect(() => build({ requestedFromDate: '073126', requestedToDate: '070126' })).toThrow(/must not be after/);
    // Jul 1 - Aug 1 is a 32-day inclusive span; the range may not exceed 31 days.
    expect(() => build({ requestedFromDate: '070126', requestedToDate: '080126' })).toThrow(/31 days/);
    expect(() => build({ entryNumbers: ['12345670'] })).toThrow(/check digit/);
  });

  it('allows a single-day range (from == to, CWQ-6 Note 2)', () => {
    const lines = buildCensusWarningQuery({
      filerCode: 'ABC',
      queries: [{ requestedFromDate: '070126', requestedToDate: '070126' }],
    });
    expect(lines[0].slice(7, 19)).toBe('070126070126');
  });
});

// ── CL: Census Warning Query response parser ───────────────

describe('parseCjResponse', () => {
  it('round-trips a CJ2 data row (CWQ-8)', () => {
    const line = writeRecord(OUTPUT_CJ2, {
      districtPortOfEntry: '2704',
      aceAcceptanceDate: '070826',
      entryFilerCode: 'ABC',
      entryNumber: '12345676',
      entrySummaryLineItemIdentifier: '001',
      htsNumber: '8507600020',
      censusWarningCode: 'C31',
    });
    expect(line).toHaveLength(80);
    // CJ(1-2) 2(3) port(4-7) date(8-13) filer(14-16) filler(17-18) entry(19-26)
    expect(line.slice(0, 26)).toBe('CJ22704070826ABC  12345676');
    const [row] = parseCjResponse([line]);
    expect(row).toEqual({
      districtPortOfEntry: '2704',
      aceAcceptanceDate: '070826',
      entryFilerCode: 'ABC',
      entryNumber: '12345676',
      lineItemIdentifier: '001',
      htsNumber: '8507600020',
      censusWarningCode: 'C31',
      conditionCode: undefined,
      narrative: undefined,
    });
  });

  it('parses an error row with entry summary fields space filled (Notes 1-2)', () => {
    const raw =
      'CJ22704070826ABC' + ' '.repeat(30) + '927NO DATA ON FILE FOR QUERY'.padEnd(34, ' ');
    const [row] = parseCjResponse([raw.padEnd(80, ' ')]);
    expect(row.entryNumber).toBeUndefined();
    expect(row.htsNumber).toBeUndefined();
    expect(row.censusWarningCode).toBeUndefined();
    expect(row.conditionCode).toBe('927');
    expect(row.narrative).toBe('NO DATA ON FILE FOR QUERY');
  });

  it('parses a full CL wire response through the envelope', () => {
    const inner = writeRecord(OUTPUT_CJ2, {
      districtPortOfEntry: '2704',
      aceAcceptanceDate: '070826',
      entryFilerCode: 'ABC',
      entryNumber: '12345676',
      entrySummaryLineItemIdentifier: '001',
      htsNumber: '8507600020',
      censusWarningCode: 'C31',
    });
    const wire = [
      'A   LGB1ABCSECRET080726     CL'.padEnd(80, ' '),
      'B  2704ABCCL'.padEnd(80, ' '),
      inner,
      'Y  2704ABCCL'.padEnd(80, ' '),
      'Z   LGB1ABC      080726'.padEnd(80, ' '),
    ];
    const result = parseCjResponseBatch(wire);
    expect(result.batchRejected).toBe(false);
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].censusWarningCode).toBe('C31');
  });
});
