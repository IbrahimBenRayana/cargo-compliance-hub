/**
 * Harmonized Tariff Schedule Query (HA/HY) tests — HTS page refs, March
 * 2023 chapter (docs/abi-engine/specs/reference-data/hts-query-2023-03.pdf).
 * Input W-Record positions asserted byte-exactly against HTS-46; output
 * records W0..WL hand-built per HTS-47..79 and round-tripped through the
 * parser. Rate figures use the chapter's implied-decimal conventions
 * (12N/8 implied → 0.05 == '000005000000'; 10N/5 implied → 1.5 ==
 * '0000150000').
 */
import { describe, it, expect } from 'vitest';
import { buildHtsQuery } from '../apps/htsQuery/builder.js';
import { parseHtsQueryResponse, parseHtsQueryResponseBatch } from '../apps/htsQuery/responseParser.js';
import {
  OUTPUT_W0,
  OUTPUT_W1,
  OUTPUT_W2,
  OUTPUT_W3,
  OUTPUT_W4,
  OUTPUT_WD,
  OUTPUT_WL,
  OUTPUT_SPECIAL_RATE_TAX_FEE,
  OUTPUT_SPECIAL_RATE_ONLY,
} from '../apps/htsQuery/recordDefs.js';
import { writeRecord } from '../records/codec.js';
import { APPLICATION_CODES } from '../envelope/conditionCodes.js';

// ── Envelope application codes ─────────────────────────────

describe('HTS query application codes', () => {
  it('uses HA→HY for the HTS query (HTS-8)', () => {
    expect(APPLICATION_CODES.htsQuery).toEqual({ input: 'HA', response: 'HY' });
  });
});

// ── Builder (HTS-46) ───────────────────────────────────────

describe('buildHtsQuery', () => {
  it('lays out the W-Record exactly per HTS-46 for a 10-digit query with an as-of date', () => {
    const [line] = buildHtsQuery([{ htsNumber: '9903881503', asOfDate: '070126' }]);
    expect(line).toHaveLength(80);
    expect(line).toBe('W 9903881503070126'.padEnd(80, ' '));
    expect(line[0]).toBe('W'); // control identifier, pos 1
    expect(line[1]).toBe(' '); // filler, pos 2
    expect(line.slice(2, 12)).toBe('9903881503'); // from tariff number, pos 3-12
    expect(line.slice(12, 18)).toBe('070126'); // as of date MMDDYY, pos 13-18
    expect(line.slice(18, 28)).toBe(' '.repeat(10)); // to tariff number space filled (Note 1)
  });

  it('left-justifies a partial 8-digit number and converts a YYYYMMDD as-of date to MMDDYY', () => {
    const [line] = buildHtsQuery([{ htsNumber: '84713000', asOfDate: '20260701' }]);
    expect(line).toBe('W 84713000  070126'.padEnd(80, ' '));
    expect(line.slice(2, 12)).toBe('84713000  '); // 8 digits left justified, pos 3-12
    expect(line.slice(12, 18)).toBe('070126');
  });

  it('space-fills the as-of date when omitted so ACE assumes the current date (HTS-8)', () => {
    const [line] = buildHtsQuery([{ htsNumber: '9903881503' }]);
    expect(line).toBe('W 9903881503'.padEnd(80, ' '));
  });

  it('places the To Tariff Number at pos 19-28 for a range query (HTS-46 Note 1)', () => {
    const [line] = buildHtsQuery([{ htsNumber: '84713000', toHtsNumber: '84714100' }]);
    expect(line).toBe(('W ' + '84713000'.padEnd(10, ' ') + ' '.repeat(6) + '84714100'.padEnd(10, ' ')).padEnd(80, ' '));
    expect(line.slice(18, 28)).toBe('84714100  ');
  });

  it('emits one W-Record per query', () => {
    const lines = buildHtsQuery([{ htsNumber: '8471300100' }, { htsNumber: '9903881503' }]);
    expect(lines).toHaveLength(2);
    expect(lines[1]).toBe('W 9903881503'.padEnd(80, ' '));
  });

  it('rejects malformed tariff numbers, malformed dates, empty and oversized queries', () => {
    expect(() => buildHtsQuery([])).toThrow(/at least one/);
    expect(() => buildHtsQuery([{ htsNumber: '9903.88.15' }])).toThrow(/8-10 digits/);
    expect(() => buildHtsQuery([{ htsNumber: '9903881' }])).toThrow(/8-10 digits/);
    expect(() => buildHtsQuery([{ htsNumber: '84713000', toHtsNumber: '8471' }])).toThrow(/8-10 digits/);
    expect(() => buildHtsQuery([{ htsNumber: '84713000', asOfDate: '7/1/26' }])).toThrow(/MMDDYY or YYYYMMDD/);
    // 6-digit but not a real MMDDYY date → rejected by the codec's class D.
    expect(() => buildHtsQuery([{ htsNumber: '84713000', asOfDate: '133226' }])).toThrow(/class D/);
    const many = Array.from({ length: 101 }, () => ({ htsNumber: '84713000' }));
    expect(() => buildHtsQuery(many)).toThrow(/at most 100/);
  });
});

// ── Output record layouts (HTS-47..49) ─────────────────────

const TARIFF = '8471300100';

describe('HTS query output record defs', () => {
  it('round-trips the W1 layout against a hand-built HTS-48..49 line', () => {
    const literal =
      'W1' +
      TARIFF +
      ' ' +
      '010126' +
      '123126' +
      '2' +
      'NO ' +
      'KG ' +
      '   ' +
      '1' +
      'PORTABLE COMPUTERS'.padEnd(30, ' ') +
      '000000000000' +
      ' ' +
      ' ';
    expect(literal).toHaveLength(80);
    const written = writeRecord(OUTPUT_W1, {
      tariffNumber: TARIFF,
      recordBeginEffectiveDate: '010126',
      recordEndEffectiveDate: '123126',
      numberOfReportingUnits: '2',
      unit1: 'NO',
      unit2: 'KG',
      dutyComputationCode: '1',
      commodityDescription: 'PORTABLE COMPUTERS',
      column1SpecificRate: '000000000000',
    });
    expect(written).toBe(literal);
  });

  it('round-trips the W0 layout against a hand-built HTS-47 line', () => {
    const literal =
      'W0' + TARIFF + '070126' + ' '.repeat(10) + '0001 TARIFF NUMBERS IN RANGE'.padEnd(40, ' ') + ' '.repeat(12);
    expect(literal).toHaveLength(80);
    const written = writeRecord(OUTPUT_W0, {
      fromTariffNumber: TARIFF,
      asOfDate: '070126',
      narrativeMessage: '0001 TARIFF NUMBERS IN RANGE',
    });
    expect(written).toBe(literal);
  });
});

// ── Response parser (HTS-47..79) ───────────────────────────

describe('parseHtsQueryResponse', () => {
  it('parses a full successful grouping: W1-W5, WD, WE, WL detail records closed by W0', () => {
    const lines = [
      writeRecord(OUTPUT_W1, {
        tariffNumber: TARIFF,
        recordBeginEffectiveDate: '010126',
        recordEndEffectiveDate: '123126',
        numberOfReportingUnits: '2',
        unit1: 'NO',
        unit2: 'KG',
        dutyComputationCode: '1',
        commodityDescription: 'PORTABLE COMPUTERS',
        column1SpecificRate: '000000000000',
        baseRateIndicator: 'B',
      }),
      writeRecord(OUTPUT_W2, {
        tariffNumber: TARIFF,
        column1RateAdValorem: '000005000000', // 5% ad valorem, 8 implied decimals
        column2RateAdValorem: '000035000000', // 35% column 2
        countervailingDutyFlag: '1',
        additionalTariffNumberIndicator: 'R',
        miscPermitLicenseIndicator: '01',
      }),
      writeRecord(OUTPUT_W3, {
        tariffNumber: TARIFF,
        gspExcludedCountries: 'CNIN',
        antidumpingDutyFlag: '1',
        quotaIndicator: '1',
        categoryNumber: '338',
        spiCodes: 'A AUSG', // 1-char SPI is space padded in position 2 (V3 Note 2)
      }),
      writeRecord(OUTPUT_W4, {
        tariffNumber: TARIFF,
        valueEditCode: '211',
        valueLowBounds: '0000150000', // 1.5, 5 implied decimals
        valueHighBounds: '0999900000', // 9999
        isoCountryOfOriginEditCode: '01',
        quantityEditCode: '101',
        quantityEditLowBounds: '0000100000', // 1
        quantityEditHighBounds: '0050000000', // 500
      }),
      writeRecord(OUTPUT_SPECIAL_RATE_TAX_FEE.W5, {
        tariffNumber: TARIFF,
        isoCountryCode: 'E', // E + space = Caribbean Basin Initiative (HTS-55)
        adValoremSpecialRate: '000000000000',
        taxFeeClassCode: '056',
        taxFeeComputationCode: '7',
        taxFeeFlag: '1',
        taxFeeAdValoremRate: '000000346400', // 0.3464% MPF
      }),
      writeRecord(OUTPUT_WD, { tariffNumber: TARIFF, spiCodes: 'P P+' }),
      writeRecord(OUTPUT_SPECIAL_RATE_ONLY.WE, {
        tariffNumber: TARIFF,
        isoCountryCode: 'JP',
        adValoremSpecialRate: '000002500000', // 0.025
      }),
      writeRecord(OUTPUT_WL, { tariffNumber: TARIFF, pgaCodes: 'EP3FS4' }),
      writeRecord(OUTPUT_W0, {
        fromTariffNumber: TARIFF,
        asOfDate: '070126',
        narrativeMessage: '0001 TARIFF NUMBERS IN RANGE',
      }),
    ];

    const { queries } = parseHtsQueryResponse(lines);
    expect(queries).toHaveLength(1);
    const query = queries[0];
    expect(query.fromTariffNumber).toBe(TARIFF);
    expect(query.asOfDate).toBe('070126');
    expect(query.toTariffNumber).toBeUndefined();
    expect(query.narrativeMessage).toBe('0001 TARIFF NUMBERS IN RANGE');
    expect(query.tariffs).toHaveLength(1);

    const tariff = query.tariffs[0];
    expect(tariff.tariffNumber).toBe(TARIFF);
    expect(tariff.beginEffectiveDate).toBe('010126');
    expect(tariff.endEffectiveDate).toBe('123126');
    expect(tariff.numberOfReportingUnits).toBe(2);
    expect(tariff.unitsOfMeasure).toEqual(['NO', 'KG']);
    expect(tariff.dutyComputationCode).toBe('1');
    expect(tariff.commodityDescription).toBe('PORTABLE COMPUTERS');
    expect(tariff.column1SpecificRate).toBe(0);
    expect(tariff.baseRateIndicator).toBe('B');
    expect(tariff.column1AdValoremRate).toBe(0.05);
    expect(tariff.column2AdValoremRate).toBe(0.35);
    expect(tariff.countervailingDutyFlag).toBe('1');
    expect(tariff.additionalTariffNumberIndicator).toBe('R');
    expect(tariff.miscPermitLicenseIndicator).toBe('01');
    expect(tariff.gspExcludedCountries).toEqual(['CN', 'IN']);
    expect(tariff.antidumpingDutyFlag).toBe('1');
    expect(tariff.quotaIndicator).toBe('1');
    expect(tariff.categoryNumber).toBe('338');
    expect(tariff.spiCodes).toEqual(['A', 'AU', 'SG', 'P', 'P+']); // W3 codes + WD continuation
    expect(tariff.valueEdit).toEqual({ code: '211', lowBounds: 1.5, highBounds: 9999 });
    expect(tariff.dateRestrictions).toEqual([]);
    expect(tariff.isoCountryOfOriginEditCode).toBe('01');
    expect(tariff.quantityEdit).toEqual({ code: '101', lowBounds: 1, highBounds: 500 });
    expect(tariff.pgaCodes).toEqual(['EP3', 'FS4']);

    expect(tariff.specialRates).toHaveLength(2);
    const [w5, we] = tariff.specialRates;
    expect(w5.recordId).toBe('W5');
    expect(w5.isoCountryCode).toBe('E');
    expect(w5.adValoremRate).toBe(0);
    expect(w5.taxFeeClassCode).toBe('056');
    expect(w5.taxFeeComputationCode).toBe('7');
    expect(w5.taxFeeFlag).toBe('1');
    expect(w5.taxFeeAdValoremRate).toBe(0.003464);
    expect(we.recordId).toBe('WE');
    expect(we.isoCountryCode).toBe('JP');
    expect(we.adValoremRate).toBe(0.025);
    expect(we.taxFeeClassCode).toBeUndefined(); // WE..WK carry no tax/fee data (HTS-72)
  });

  it('parses W4 date restrictions when the record carries date edits instead of value edits', () => {
    const lines = [
      writeRecord(OUTPUT_W4, {
        tariffNumber: TARIFF,
        entryDateRestrictionCode1: '1',
        beginRestrictionDate1: '0401',
        endRestrictionDate1: '0930',
        entryDateRestrictionCode2: '2',
        beginRestrictionDate2: '1001',
        endRestrictionDate2: '0331',
      }),
      writeRecord(OUTPUT_W0, { fromTariffNumber: TARIFF, narrativeMessage: '0001 TARIFF NUMBERS IN RANGE' }),
    ];
    const { queries } = parseHtsQueryResponse(lines);
    const tariff = queries[0].tariffs[0];
    expect(tariff.valueEdit).toBeUndefined();
    expect(tariff.dateRestrictions).toEqual([
      { code: '1', beginDate: '0401', endDate: '0930' },
      { code: '2', beginDate: '1001', endDate: '0331' },
    ]);
  });

  it('groups a range response by tariff number and keeps a following error query separate', () => {
    const other = '8471300200';
    const lines = [
      writeRecord(OUTPUT_W1, {
        tariffNumber: TARIFF,
        recordBeginEffectiveDate: '010126',
        recordEndEffectiveDate: '123126',
        numberOfReportingUnits: '1',
        unit1: 'NO',
        dutyComputationCode: '1',
      }),
      writeRecord(OUTPUT_W1, {
        tariffNumber: other,
        recordBeginEffectiveDate: '010126',
        recordEndEffectiveDate: '063026',
        numberOfReportingUnits: '1',
        unit1: 'NO',
        dutyComputationCode: '1',
      }),
      // W2 for the first number arrives after the second W1 — grouped by tariff number.
      writeRecord(OUTPUT_W2, { tariffNumber: TARIFF, column1RateAdValorem: '000005000000' }),
      writeRecord(OUTPUT_W0, {
        fromTariffNumber: '84713001',
        toTariffNumber: '84713003',
        narrativeMessage: '0002 TARIFF NUMBERS IN RANGE',
      }),
      writeRecord(OUTPUT_W0, {
        fromTariffNumber: '9999999999',
        narrativeMessage: 'TARIFF NBR NOT ON FILE',
      }),
    ];
    const { queries } = parseHtsQueryResponse(lines);
    expect(queries).toHaveLength(2);
    expect(queries[0].toTariffNumber).toBe('84713003');
    expect(queries[0].tariffs.map((t) => t.tariffNumber)).toEqual([TARIFF, other]);
    expect(queries[0].tariffs[0].column1AdValoremRate).toBe(0.05);
    expect(queries[0].tariffs[1].endEffectiveDate).toBe('063026');
    // Error/no-match query: no detail records, narrative verbatim (HTS-47).
    expect(queries[1].tariffs).toEqual([]);
    expect(queries[1].asOfDate).toBeUndefined();
    expect(queries[1].narrativeMessage).toBe('TARIFF NBR NOT ON FILE');
  });

  it('parses a full HY wire response through the envelope', () => {
    const inner = [
      writeRecord(OUTPUT_W0, {
        fromTariffNumber: '8471309999',
        narrativeMessage: 'TARIFF NBR NOT ON FILE',
      }),
    ];
    const wire = [
      'A   LGB1ABCSECRET080526     HY'.padEnd(80, ' '),
      'B  2704ABCHY'.padEnd(80, ' '),
      ...inner,
      'Y  2704ABCHY'.padEnd(80, ' '),
      'Z   LGB1ABC      080526'.padEnd(80, ' '),
    ];
    const result = parseHtsQueryResponseBatch(wire);
    expect(result.batchRejected).toBe(false);
    expect(result.response.queries).toHaveLength(1);
    expect(result.response.queries[0].narrativeMessage).toBe('TARIFF NBR NOT ON FILE');
  });
});
