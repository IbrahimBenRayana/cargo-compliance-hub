/**
 * Companion query application tests — AD/CVD Case Information Query (AD/AC,
 * ADQ page refs, July 2026 chapter) and Quota Query (QA/QB, QA page refs,
 * April 2015 chapter). Positions and formats asserted against the chapters;
 * the deposit-rate figures reuse the chapters' own printed examples
 * (10.17% → 001017, $110.25 → 00011025; ADQ-23 Notes 1-2).
 */
import { describe, it, expect } from 'vitest';
import { buildAdCvdCaseQuery } from '../apps/adcvd/builder.js';
import { parseAdCvdResponse, parseAdCvdResponseBatch } from '../apps/adcvd/responseParser.js';
import {
  OUTPUT_RA,
  OUTPUT_RB,
  OUTPUT_RC,
  OUTPUT_RD,
  OUTPUT_RE,
  OUTPUT_RF,
  OUTPUT_RG,
  OUTPUT_RH,
  OUTPUT_RI,
  OUTPUT_RJ,
  OUTPUT_RX,
} from '../apps/adcvd/recordDefs.js';
import { buildQuotaQuery } from '../apps/quota/builder.js';
import { parseQuotaResponse, parseQuotaResponseBatch } from '../apps/quota/responseParser.js';
import { OUTPUT_Q2, OUTPUT_Q3, OUTPUT_Q4, OUTPUT_Q5, QUOTA_CONDITION_CODES } from '../apps/quota/recordDefs.js';
import { writeRecord } from '../records/codec.js';
import { APPLICATION_CODES } from '../envelope/conditionCodes.js';

// ── Envelope application codes ─────────────────────────────

describe('query application codes', () => {
  it('uses AD→AC for the AD/CVD case query and QA→QB for the quota query', () => {
    expect(APPLICATION_CODES.adCvdCaseQuery).toEqual({ input: 'AD', response: 'AC' });
    expect(APPLICATION_CODES.quotaQuery).toEqual({ input: 'QA', response: 'QB' });
  });
});

// ── AD/CVD case query builder (ADQ-9..14) ──────────────────

describe('buildAdCvdCaseQuery', () => {
  it('lays out the Q1-Record exactly per ADQ-10, splitting 10-digit cases into base + suffix', () => {
    const [line] = buildAdCvdCaseQuery({
      type: 'caseNumbers',
      caseNumbers: ['A570016000', 'C570017'],
    });
    expect(line).toHaveLength(80);
    expect(line).toBe('Q1 A570016000 C570017'.padEnd(80, ' '));
    expect(line.slice(3, 10)).toBe('A570016'); // case 1 base, pos 4-10
    expect(line.slice(10, 13)).toBe('000'); // case 1 suffix, pos 11-13
    expect(line.slice(14, 21)).toBe('C570017'); // case 2 base, pos 15-21
    expect(line.slice(21, 24)).toBe('   '); // 7-digit query: suffix space filled
  });

  it('chunks more than five case numbers into repeated Q1-Records (ADQ-10)', () => {
    const lines = buildAdCvdCaseQuery({
      type: 'caseNumbers',
      caseNumbers: ['A570016000', 'C570017001', 'A570018000', 'C570019000', 'A570020000', 'A570021'],
    });
    expect(lines).toHaveLength(2);
    expect(lines[1]).toBe('Q1 A570021'.padEnd(80, ' '));
  });

  it('rejects malformed case numbers and empty queries', () => {
    expect(() => buildAdCvdCaseQuery({ type: 'caseNumbers', caseNumbers: ['A-570-016'] })).toThrow(
      /7 or 10 characters/
    );
    expect(() => buildAdCvdCaseQuery({ type: 'caseNumbers', caseNumbers: [] })).toThrow(/at least one/);
  });

  it('lays out the Q2 criteria record exactly per ADQ-12..13 with a left-justified 8-digit HTS', () => {
    const [line] = buildAdCvdCaseQuery({
      type: 'criteria',
      companyCaseStatus: 'A',
      countryCode: 'CN',
      htsNumber: '84713000',
    });
    expect(line).toHaveLength(80);
    expect(line).toBe('Q2 A CN 84713000'.padEnd(80, ' '));
    expect(line.slice(8, 18)).toBe('84713000  '); // 8N/2S left justified, pos 9-18
  });

  it('places the TSUSA number and date-since-last-update at their ADQ-13 positions', () => {
    const [line] = buildAdCvdCaseQuery({
      type: 'criteria',
      companyCaseStatus: 'B',
      tsusaNumber: '54321',
      dateSinceLastUpdate: '040409',
    });
    expect(line[3]).toBe('B'); // status, pos 4
    expect(line.slice(19, 26)).toBe('54321  '); // 5N/2S left justified, pos 20-26
    expect(line.slice(59, 65)).toBe('040409'); // pos 60-65
  });

  it('enforces the criteria rules of ADQ-14 Notes 1 and 4', () => {
    expect(() =>
      buildAdCvdCaseQuery({ type: 'criteria', companyCaseStatus: 'A', htsNumber: '84713000', tsusaNumber: '54321' })
    ).toThrow(/not both/);
    expect(() => buildAdCvdCaseQuery({ type: 'criteria', companyCaseStatus: 'A' })).toThrow(
      /at least one criterion/
    );
    expect(() => buildAdCvdCaseQuery({ type: 'criteria', companyCaseStatus: 'A', htsNumber: '847130' })).toThrow(
      /8 or 10 digits/
    );
  });
});

// ── AD/CVD response parser (ADQ-15..30) ────────────────────

const CASE = 'A570016000';

describe('parseAdCvdResponse', () => {
  it('round-trips the RA layout against the hand-built ADQ-16 line', () => {
    const literal = (
      'RA' +
      'A570016000' +
      ' ' +
      'C570017'.padEnd(10, ' ') +
      ' ' +
      'WOODEN BEDROOM FURNITURE'.padEnd(30, ' ') +
      ' ' +
      'CN' +
      ' ' +
      'AC' +
      ' ' +
      '010409'
    ).padEnd(80, ' ');
    const written = writeRecord(OUTPUT_RA, {
      caseNumber: CASE,
      relatedCaseNumber: 'C570017',
      shortDescription: 'WOODEN BEDROOM FURNITURE',
      countryCode: 'CN',
      companyCaseStatus: 'AC',
      companyCaseStatusEffectiveDate: '010409',
    });
    expect(written).toBe(literal);

    const { cases } = parseAdCvdResponse([literal]);
    expect(cases).toHaveLength(1);
    expect(cases[0]).toMatchObject({
      caseNumber: CASE,
      relatedCaseNumber: 'C570017',
      shortDescription: 'WOODEN BEDROOM FURNITURE',
      countryCode: 'CN',
      companyCaseStatus: 'AC',
      companyCaseStatusEffectiveDate: '010409',
    });
  });

  it('assembles a full RA..RJ case grouping with name continuations and both deposit-rate forms', () => {
    const lines = [
      writeRecord(OUTPUT_RA, {
        caseNumber: CASE,
        shortDescription: 'WOODEN BEDROOM FURNITURE',
        countryCode: 'CN',
        companyCaseStatus: 'AC',
        companyCaseStatusEffectiveDate: '010409',
      }),
      // Official name split across two RB segments (ADQ-18).
      writeRecord(OUTPUT_RB, {
        caseNumber: CASE,
        recordSequence: '1',
        officialCaseName: 'WOODEN BEDROOM FURNITURE FROM THE PEOPLES REPUBLIC OF',
      }),
      writeRecord(OUTPUT_RB, { caseNumber: CASE, recordSequence: '2', officialCaseName: ' CHINA' }),
      // Manufacturer name continued via Record Sequence 2 (ADQ-19).
      writeRecord(OUTPUT_RC, {
        caseNumber: CASE,
        recordSequence: '1',
        manufacturerIdentificationCode: 'CNSHEBAT123SHA',
        manufacturerName: 'SHENZHEN BATTERY CO',
      }),
      writeRecord(OUTPUT_RC, { caseNumber: CASE, recordSequence: '2', manufacturerName: ' LTD' }),
      writeRecord(OUTPUT_RD, { caseNumber: CASE, recordSequence: '1', foreignExporterName: 'EXPORTER ONE' }),
      writeRecord(OUTPUT_RE, {
        caseNumber: CASE,
        contactOffice: 'IMPORT ADMIN OFC 5',
        contactName: 'AD CVD OPS UNIT 2',
        contactTelephoneNumber1: '2024821234',
        contactTelephoneNumber2: '2024825678',
        contactTelephoneNumber2Extension: '0042',
      }),
      // 10.17% ad valorem → 001017 (ADQ-23 Note 1).
      writeRecord(OUTPUT_RF, {
        caseNumber: CASE,
        depositRateEffectiveDate: '061810',
        adValoremDepositRate: '001017',
        rateAddedDate: '061810',
      }),
      // $110.25 per KG specific → 00011025 (ADQ-23 Note 2).
      writeRecord(OUTPUT_RF, {
        caseNumber: CASE,
        depositRateEffectiveDate: '040109',
        specificDepositRate: '00011025',
        unitOfMeasure: 'KG',
        rateAddedDate: '040109',
        rateInactivatedDate: '123114',
      }),
      writeRecord(OUTPUT_RG, {
        caseNumber: CASE,
        eventEffectiveDate: '061809',
        event: 'INITIATION',
        determination: 'AFFIRM',
        federalRegisterCitation: '22FR12345',
        eventAddedDate: '061809',
      }),
      writeRecord(OUTPUT_RH, {
        caseNumber: CASE,
        bondCashEffectiveDate: '040109',
        bondCashIndicator: 'CASH ONLY',
        bondCashIndicatorAddedDate: '040109',
      }),
      // One RI carries up to three tariff numbers (ADQ-26..27).
      writeRecord(OUTPUT_RI, {
        caseNumber: CASE,
        tariffNumber1: '9403508045',
        addedDate1: '010409',
        tariffNumber2: '9403908040',
        addedDate2: '010409',
        inactivatedDate2: '123114',
      }),
      writeRecord(OUTPUT_RJ, {
        caseNumber: CASE,
        suspensionActionEffectiveDate: '040109',
        suspensionAction: 'START',
        suspensionActionAddedDate: '040109',
      }),
    ];
    for (const line of lines) expect(line).toHaveLength(80);

    const { cases, failures } = parseAdCvdResponse(lines);
    expect(failures).toHaveLength(0);
    expect(cases).toHaveLength(1);
    const result = cases[0];

    expect(result.officialCaseName).toBe('WOODEN BEDROOM FURNITURE FROM THE PEOPLES REPUBLIC OF CHINA');
    expect(result.manufacturers).toEqual([
      { identificationCode: 'CNSHEBAT123SHA', name: 'SHENZHEN BATTERY CO LTD' },
    ]);
    expect(result.foreignExporters).toEqual([{ identificationCode: undefined, name: 'EXPORTER ONE' }]);
    expect(result.contacts[0]).toMatchObject({
      office: 'IMPORT ADMIN OFC 5',
      telephone1: '2024821234',
      telephone2: '2024825678',
      telephone2Extension: '0042',
    });
    expect(result.depositRates).toEqual([
      {
        effectiveDate: '061810',
        adValoremRateHundredths: 1017,
        specificRateCents: undefined,
        unitOfMeasure: undefined,
        otherUnitOfMeasure: undefined,
        addedDate: '061810',
        inactivatedDate: undefined,
      },
      {
        effectiveDate: '040109',
        adValoremRateHundredths: undefined,
        specificRateCents: 11025,
        unitOfMeasure: 'KG',
        otherUnitOfMeasure: undefined,
        addedDate: '040109',
        inactivatedDate: '123114',
      },
    ]);
    expect(result.events).toEqual([
      {
        effectiveDate: '061809',
        event: 'INITIATION',
        determination: 'AFFIRM',
        federalRegisterCitation: '22FR12345',
        addedDate: '061809',
        inactivatedDate: undefined,
      },
    ]);
    expect(result.bondCashDetails[0]).toMatchObject({ indicator: 'CASH ONLY' });
    expect(result.tariffs).toEqual([
      { tariffNumber: '9403508045', addedDate: '010409', inactivatedDate: undefined },
      { tariffNumber: '9403908040', addedDate: '010409', inactivatedDate: '123114' },
    ]);
    expect(result.suspensions[0]).toMatchObject({ action: 'START', effectiveDate: '040109' });
  });

  it('reports failed queries from RX records (ADQ-29..30)', () => {
    const q1e = writeRecord(OUTPUT_RX, {
      referenceDataTypeCode: 'Q1E',
      occurrencePosition: '2',
      referenceIdConstant: 'REF ID:',
      referenceDataText: 'A570016999',
      conditionCode: 'AD1',
      narrativeText: 'CASE NUMBER NOT ON FILE',
    });
    expect(q1e.slice(13, 20)).toBe('REF ID:'); // constant, pos 14-20
    // Q2C failure carries a space-filled reference text (ADQ-30 Note 1).
    const q2c = ('RX' + 'Q2C' + ' ' + '     1' + ' ' + 'REF ID:' + ' ' + ''.padEnd(13, ' ') + '  ' + 'AD2' + ' ' +
      'INVALID QUERY REQUEST').padEnd(80, ' ');

    const { cases, failures } = parseAdCvdResponse([q1e, q2c]);
    expect(cases).toHaveLength(0);
    expect(failures).toEqual([
      {
        referenceType: 'Q1E',
        occurrence: 2,
        referenceText: 'A570016999',
        conditionCode: 'AD1',
        narrative: 'CASE NUMBER NOT ON FILE',
      },
      {
        referenceType: 'Q2C',
        occurrence: 1,
        referenceText: undefined,
        conditionCode: 'AD2',
        narrative: 'INVALID QUERY REQUEST',
      },
    ]);
  });

  it('parses a full AC wire response through the envelope', () => {
    const inner = [
      writeRecord(OUTPUT_RA, {
        caseNumber: CASE,
        shortDescription: 'WOODEN BEDROOM FURNITURE',
        countryCode: 'CN',
        companyCaseStatus: 'AC',
        companyCaseStatusEffectiveDate: '010409',
      }),
    ];
    const wire = [
      'A   LGB1ABCSECRET080526     AC'.padEnd(80, ' '),
      'B  2704ABCAC'.padEnd(80, ' '),
      ...inner,
      'Y  2704ABCAC'.padEnd(80, ' '),
      'Z   LGB1ABC      080526'.padEnd(80, ' '),
    ];
    const result = parseAdCvdResponseBatch(wire);
    expect(result.batchRejected).toBe(false);
    expect(result.response.cases).toHaveLength(1);
    expect(result.response.cases[0].caseNumber).toBe(CASE);
  });
});

// ── Quota query builder (QA-8..11) ─────────────────────────

describe('buildQuotaQuery', () => {
  it('lays out a two-tariff Chapter 99 query exactly per QA-10', () => {
    const [line] = buildQuotaQuery([
      { typeCode: 'R', queryId: '9903881500', secondTariffNumber: '8471300100', countryOfOrigin: 'CN' },
    ]);
    expect(line).toHaveLength(80);
    expect(line).toBe('Q1R99038815008471300100CN'.padEnd(80, ' '));
    expect(line[2]).toBe('R'); // type code, pos 3
    expect(line.slice(3, 13)).toBe('9903881500'); // query id, pos 4-13
    expect(line.slice(13, 23)).toBe('8471300100'); // second tariff, pos 14-23
    expect(line.slice(23, 25)).toBe('CN'); // country, pos 24-25
  });

  it('left-justifies an 8-digit tariff number in the 10-position query id', () => {
    const [line] = buildQuotaQuery([{ typeCode: 'R', queryId: '84713000', countryOfOrigin: 'JP' }]);
    expect(line.slice(3, 13)).toBe('84713000  ');
  });

  it('lays out a textile-category query with a space-filled second tariff', () => {
    const [line] = buildQuotaQuery([{ typeCode: 'X', queryId: '340', countryOfOrigin: 'VN' }]);
    expect(line).toBe(('Q1X' + '340'.padEnd(10, ' ') + ''.padEnd(10, ' ') + 'VN').padEnd(80, ' '));
  });

  it('rejects malformed requests per QA-10 Note 1 rules', () => {
    expect(() =>
      buildQuotaQuery([{ typeCode: 'X', queryId: '340', secondTariffNumber: '84713000', countryOfOrigin: 'VN' }])
    ).toThrow(/space filled/);
    expect(() => buildQuotaQuery([{ typeCode: 'X', queryId: '3400', countryOfOrigin: 'VN' }])).toThrow(/3-digit/);
    expect(() => buildQuotaQuery([{ typeCode: 'R', queryId: '8471300', countryOfOrigin: 'JP' }])).toThrow(
      /8-10 digits/
    );
  });

  it('enforces the 99-requests-per-block limit (QA-8)', () => {
    const requests = Array.from({ length: 100 }, () => ({
      typeCode: 'R' as const,
      queryId: '84713000',
      countryOfOrigin: 'JP',
    }));
    expect(() => buildQuotaQuery(requests)).toThrow(/at most 99/);
    expect(buildQuotaQuery(requests.slice(0, 99))).toHaveLength(99);
  });
});

// ── Quota response parser (QA-9, QA-12..19) ────────────────

describe('parseQuotaResponse', () => {
  it('round-trips the Q2 layout against the hand-built QA-12..14 line', () => {
    const literal = (
      'Q2' +
      'R' +
      '9903881500' +
      '903881500'.padEnd(15, ' ') +
      '99' +
      '00000250000' +
      'KG'.padEnd(3, ' ') +
      ''.padEnd(6, ' ') +
      '010115' +
      '123115' +
      '1501'.padEnd(6, ' ') +
      '00000225000'
    ).padEnd(80, ' ');
    const written = writeRecord(OUTPUT_Q2, {
      quotaQueryIdTypeCode: 'R',
      quotaQueryId: '9903881500',
      quotaId: '903881500',
      countryOfOrigin: '99',
      quotaLimit: '00000250000',
      unitOfMeasureCode: 'KG',
      beginningPeriodDate: '010115',
      endingPeriodDate: '123115',
      quotaPeriod: '1501',
      thresholdQuantity: '00000225000',
    });
    expect(written).toBe(literal);

    const { results } = parseQuotaResponse([literal]);
    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      typeCode: 'R',
      queryId: '9903881500',
      quotaId: '903881500',
      countryOfOrigin: '99',
      quotaLimit: 250000,
      unitOfMeasureCode: 'KG',
      textileConversionFactorThousandths: undefined,
      beginningPeriodDate: '010115',
      endingPeriodDate: '123115',
      quotaPeriod: '1501',
      thresholdQuantity: 225000,
    });
  });

  it('merges a Q2/Q3/Q4 results grouping into one quota status (QA-9)', () => {
    const lines = [
      writeRecord(OUTPUT_Q2, {
        quotaQueryIdTypeCode: 'X',
        quotaQueryId: '340',
        quotaId: '33340AA',
        countryOfOrigin: 'VN',
        unitOfMeasureCode: 'DOZ',
        // 1.375 conversion factor → 001375 (NNN.NNN, 3 implied decimals, QA-13).
        textileConversionFactor: '001375',
        beginningPeriodDate: '010115',
        endingPeriodDate: '123115',
        quotaPeriod: '1501',
        thresholdQuantity: '00000100000',
      }),
      writeRecord(OUTPUT_Q3, {
        globalIndicator: '99',
        periodProcessingIndicator: 'PDOPEN',
        description: 'COTTON TROUSERS',
        quotaType: 'ABS',
        quantityToDate: '00000012345',
        recordNumber: '0001',
      }),
      writeRecord(OUTPUT_Q4, {
        lastQuotaTransactionDate: '063015',
        dateOfStatus: '070115',
        timeOfStatus: '1432',
      }),
    ];
    for (const line of lines) expect(line).toHaveLength(80);

    const { results, errors } = parseQuotaResponse(lines);
    expect(errors).toHaveLength(0);
    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      typeCode: 'X',
      queryId: '340',
      quotaId: '33340AA',
      quotaLimit: undefined,
      textileConversionFactorThousandths: 1375,
      globalIndicator: '99',
      periodProcessingIndicator: 'PDOPEN',
      description: 'COTTON TROUSERS',
      quotaType: 'ABS',
      quantityToDate: 12345,
      recordNumber: 1,
      lastQuotaTransactionDate: '063015',
      dateOfStatus: '070115',
      timeOfStatus: '1432',
    });
  });

  it('collects Q5 errors alongside results, matching the QA-19 condition table', () => {
    const lines = [
      writeRecord(OUTPUT_Q2, {
        quotaQueryIdTypeCode: 'R',
        quotaQueryId: '9903881500',
        quotaId: '903881500',
        countryOfOrigin: '99',
        unitOfMeasureCode: 'KG',
        beginningPeriodDate: '010115',
        endingPeriodDate: '123115',
        quotaPeriod: '1501',
        thresholdQuantity: '00000225000',
      }),
      writeRecord(OUTPUT_Q3, { quotaType: 'TRQ', quantityToDate: '00000000000', recordNumber: '0001' }),
      writeRecord(OUTPUT_Q4, { dateOfStatus: '070115', timeOfStatus: '1432' }),
      writeRecord(OUTPUT_Q5, {
        quotaQueryIdTypeCode: 'X',
        quotaQueryId: '340',
        countryOfOrigin: 'VN',
        conditionCode: 'Q50',
        narrativeText: 'NO QUOTA FOR CATEGORY',
      }),
    ];
    const { results, errors } = parseQuotaResponse(lines);
    expect(results).toHaveLength(1);
    // Q4 with no transactions returns spaces (QA-17).
    expect(results[0].lastQuotaTransactionDate).toBeUndefined();
    expect(errors).toEqual([
      { typeCode: 'X', queryId: '340', countryOfOrigin: 'VN', conditionCode: 'Q50', narrative: 'NO QUOTA FOR CATEGORY' },
    ]);
    expect(QUOTA_CONDITION_CODES[errors[0].conditionCode as keyof typeof QUOTA_CONDITION_CODES]).toBe(
      errors[0].narrative
    );
  });

  it('parses a full QB wire response through the envelope', () => {
    const inner = [
      writeRecord(OUTPUT_Q5, {
        quotaQueryIdTypeCode: 'R',
        quotaQueryId: '8471300099',
        countryOfOrigin: 'JP',
        conditionCode: 'Q49',
        narrativeText: 'NO QUOTA RECORDS FOR TARIFF',
      }),
    ];
    const wire = [
      'A   LGB1ABCSECRET080526     QB'.padEnd(80, ' '),
      'B  2704ABCQB'.padEnd(80, ' '),
      ...inner,
      'Y  2704ABCQB'.padEnd(80, ' '),
      'Z   LGB1ABC      080526'.padEnd(80, ' '),
    ];
    const result = parseQuotaResponseBatch(wire);
    expect(result.batchRejected).toBe(false);
    expect(result.response.results).toHaveLength(0);
    expect(result.response.errors[0].conditionCode).toBe('Q49');
  });
});
