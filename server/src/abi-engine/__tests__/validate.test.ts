/**
 * Entry-type validation rules — matrix cells asserted against the
 * reporting table of usage note (e), ESF-134/135.
 */
import { describe, it, expect } from 'vitest';
import { validateEntrySummary } from '../validate/entrySummary.js';
import { toAeEntrySummaryInput } from '../payload/toAeInput.js';
import { parseAbiPayloadV2 } from '../payload/schemaV2.js';
import { TYPE01_PAYLOAD_V2 } from './fixtures/type01PayloadV2.js';
import type { AeEntrySummaryInput } from '../ae/builder.js';

function type01(): AeEntrySummaryInput {
  return toAeEntrySummaryInput(parseAbiPayloadV2(TYPE01_PAYLOAD_V2), 'A');
}

function fatalFields(input: AeEntrySummaryInput): string[] {
  return validateEntrySummary(input).map((i) => i.field);
}

describe('validateEntrySummary', () => {
  it('accepts the reviewed type-01 fixture', () => {
    expect(validateEntrySummary(type01())).toEqual([]);
  });

  it('always passes a Delete (no conditional data on the wire)', () => {
    const input = type01();
    input.action = 'D';
    input.lines = undefined;
    expect(validateEntrySummary(input)).toEqual([]);
  });

  it('rejects unknown entry types and MOT codes', () => {
    const input = type01();
    input.entryTypeCode = '99';
    expect(fatalFields(input)).toEqual(['entryTypeCode']);

    const badMot = type01();
    badMot.motCode = '85';
    expect(fatalFields(badMot)).toContain('motCode');
  });

  it('type 01: MOT, consignee, state, and line parties are mandatory', () => {
    const input = type01();
    input.motCode = undefined;
    input.header!.consigneeNumber = undefined;
    input.header!.usStateOfDestination = undefined;
    input.lines![0].parties = [];
    const fields = fatalFields(input);
    expect(fields).toContain('motCode');
    expect(fields).toContain('header.consigneeNumber');
    expect(fields).toContain('header.usStateOfDestination');
    expect(fields).toContain('lines[0].parties[M]');
    expect(fields).toContain('lines[0].parties[S]');
  });

  it('type 11 (informal): those same elements are merely allowed', () => {
    const input = type01();
    input.entryTypeCode = '11';
    input.motCode = undefined;
    input.header!.consigneeNumber = undefined;
    input.header!.usStateOfDestination = undefined;
    input.lines![0].parties = [];
    expect(validateEntrySummary(input)).toEqual([]);
  });

  it('type 06 (FTZ): FTZ identifier and 41-record are mandatory, forbidden elsewhere', () => {
    const ftz = type01();
    ftz.entryTypeCode = '06';
    const fields = fatalFields(ftz);
    expect(fields).toContain('header.foreignTradeZoneId');
    expect(fields).toContain('lines[0].ftz');

    const stray = type01(); // type 01 carrying FTZ data
    stray.header!.foreignTradeZoneId = '02600A001';
    stray.lines![0].ftz = { statusCode: 'P', quantity: 1 };
    const strayFields = fatalFields(stray);
    expect(strayFields).toContain('header.foreignTradeZoneId');
    expect(strayFields).toContain('lines[0].ftz');
  });

  it('type 03 (AD/CVD): requires a case, AD/CVD totals, and forbids a bond waiver', () => {
    const input = type01();
    input.entryTypeCode = '03';
    input.bondWaiver = {};
    input.bonds = undefined;
    const fields = fatalFields(input);
    expect(fields).toContain('lines'); // no AD/CVD case anywhere (note ff)
    expect(fields).toContain('adCvdTotals'); // M for 03
    expect(fields).toContain('bondWaiver'); // N for 03
    expect(fields).toContain('bonds'); // bond grouping M for 03
  });

  it('type 22 (re-warehouse): warehouse ref + estimated entry date mandatory, import date forbidden', () => {
    const input = type01();
    input.entryTypeCode = '22';
    const fields = fatalFields(input);
    expect(fields).toContain('warehouse');
    expect(fields).toContain('header.dateOfImportation'); // N for 22
    expect(fatalFields(input)).not.toContain('header.estimatedEntryDate'); // fixture has one
  });

  it('type 31 (withdrawal): MOT is not allowed', () => {
    const input = type01();
    input.entryTypeCode = '31';
    input.warehouse = { filerCode: 'ABC', entryNumber: '12345676', districtPortCode: '2704' };
    expect(fatalFields(input)).toContain('motCode'); // N for 31
  });

  it('waived bond and bond detail are mutually exclusive (usage note i)', () => {
    const input = type01();
    input.bondWaiver = {};
    expect(fatalFields(input)).toContain('bonds');
  });
});

describe('bond configurations (usage note i, ESF-156–158)', () => {
  it('continuous bond must not carry STB fields; STB must not carry the continuous indicator', () => {
    const input = type01();
    input.bonds = [{ bondTypeCode: '8', designationTypeCode: 'B', suretyCompanyCode: '123', stbAmountDollars: 5000 }];
    expect(fatalFields(input)).toContain('bonds[0].stbAmountDollars');

    const stb = type01();
    stb.bonds = [{ bondTypeCode: '9', designationTypeCode: 'B', suretyCompanyCode: '123', stbAmountDollars: 5000, continuousBondIndicator: 'Y' }];
    expect(fatalFields(stb)).toContain('bonds[0].continuousBondIndicator');
  });

  it('STB amount is mandatory and must be greater than $0', () => {
    const input = type01();
    input.bonds = [{ bondTypeCode: '9', designationTypeCode: 'B', suretyCompanyCode: '123' }];
    expect(fatalFields(input)).toContain('bonds[0].stbAmountDollars');
  });

  it('U/E designations belong to STBs; a lone Additional bond is invalid', () => {
    const input = type01();
    input.bonds = [{ bondTypeCode: '8', designationTypeCode: 'U', suretyCompanyCode: '123' }];
    expect(fatalFields(input)).toContain('bonds[0].designationTypeCode');

    const lone = type01();
    lone.bonds = [{ bondTypeCode: '9', designationTypeCode: 'A', suretyCompanyCode: '123', stbAmountDollars: 100 }];
    expect(fatalFields(lone)).toContain('bonds[0].designationTypeCode');
  });

  it('two-bond filings need exactly one Basic and one Additional STB', () => {
    const input = type01();
    input.bonds = [
      { bondTypeCode: '8', designationTypeCode: 'B', suretyCompanyCode: '123' },
      { bondTypeCode: '9', designationTypeCode: 'A', suretyCompanyCode: '456', stbAmountDollars: 100 },
    ];
    expect(fatalFields(input)).toEqual([]);

    const twoBasic = type01();
    twoBasic.bonds = [
      { bondTypeCode: '8', designationTypeCode: 'B', suretyCompanyCode: '123' },
      { bondTypeCode: '9', designationTypeCode: 'B', suretyCompanyCode: '456', stbAmountDollars: 100 },
    ];
    expect(fatalFields(twoBasic)).toContain('bonds');

    const contAdditional = type01();
    contAdditional.bonds = [
      { bondTypeCode: '9', designationTypeCode: 'B', suretyCompanyCode: '123', stbAmountDollars: 100 },
      { bondTypeCode: '8', designationTypeCode: 'A', suretyCompanyCode: '456' },
    ];
    expect(fatalFields(contAdditional)).toContain('bonds');
  });

  it('a reconciliation claim requires a continuous bond (usage note aa)', () => {
    const input = type01();
    input.indicators = { ...input.indicators, tradeAgreementReconciliation: true };
    input.bonds = [{ bondTypeCode: '9', designationTypeCode: 'B', suretyCompanyCode: '123', stbAmountDollars: 100 }];
    expect(fatalFields(input)).toContain('bonds');
  });

  it('TIB waiver only for all-Canadian articles; no waiver with an AD/CVD case (ESF-158)', () => {
    const tib = type01();
    tib.entryTypeCode = '23';
    tib.bonds = undefined;
    tib.bondWaiver = { reasonCode: '01' };
    tib.lines![0].countryOfOrigin = 'CN';
    expect(fatalFields(tib)).toContain('bondWaiver');

    const ftz = type01();
    ftz.entryTypeCode = '21';
    ftz.bonds = undefined;
    ftz.bondWaiver = {};
    ftz.lines![0].adCvdCases = [{ caseNumber: 'A570053001', bondCashClaimCode: 'C', depositRateHundredths: 2500, rateTypeQualifier: 'A', dutyCents: 1000 }];
    expect(fatalFields(ftz)).toContain('bondWaiver');
  });
});

describe('PSC rules (usage note gg, ESF-183–185)', () => {
  function pscInput(): AeEntrySummaryInput {
    const input = type01();
    input.indicators = { ...input.indicators, postSummaryCorrection: true };
    input.psc = { headerReasonCodes: ['H99'], explanationLines: ['Corrected the state of destination.'] };
    input.payment = undefined; // statement fields are banned in a PSC (ESF-184)
    return input;
  }

  it('accepts a well-formed PSC filing', () => {
    expect(fatalFields(pscInput())).toEqual([]);
  });

  it('PSC records without the indicator (and vice versa) are fatal', () => {
    const noFlag = type01();
    noFlag.psc = { headerReasonCodes: ['H99'], explanationLines: ['x'] };
    expect(fatalFields(noFlag)).toContain('psc');

    const noBlock = type01();
    noBlock.indicators = { ...noBlock.indicators, postSummaryCorrection: true };
    const fields = fatalFields(noBlock);
    expect(fields).toContain('psc.headerReasonCodes');
    expect(fields).toContain('psc.explanationLines');
  });

  it("rejects 'N/A'-style explanations and informal-entry PSCs", () => {
    const na = pscInput();
    na.psc!.explanationLines = ['N/A'];
    expect(fatalFields(na)).toContain('psc.explanationLines');

    const informal = pscInput();
    informal.entryTypeCode = '11';
    expect(fatalFields(informal)).toContain('indicators.postSummaryCorrection');
  });

  it('statement fields, live entry, and cargo-release certification are banned in a PSC (ESF-184)', () => {
    const input = pscInput();
    input.payment = { typeCode: '1' };
    input.indicators!.liveEntry = true;
    input.cargoReleaseCertification = true;
    const fields = fatalFields(input);
    expect(fields).toContain('payment');
    expect(fields).toContain('indicators.liveEntry');
    expect(fields).toContain('cargoReleaseCertification');
  });

  it('accelerated liquidation requires a PSC filing', () => {
    const input = type01();
    input.indicators = { ...input.indicators, acceleratedLiquidation: true };
    expect(fatalFields(input)).toContain('indicators.acceleratedLiquidation');
  });

  it('line PSC reasons require the PSC indicator', () => {
    const input = type01();
    input.lines![0].pscReasonCodes = ['L04'];
    expect(fatalFields(input)).toContain('lines[0].pscReasonCodes');
  });
});

describe('in-bond and bill hierarchy (ESF-40/155, note h)', () => {
  it('an in-bond number requires the in-bond date, on every manifest detail', () => {
    const input = type01();
    input.manifests = [
      { manifestedQuantity: 10, uomCode: 'CTN', bills: [{ type: 'I', identifier: '123456789' }, { type: 'M', issuerCode: 'SCAC', identifier: 'BILL1' }] },
      { manifestedQuantity: 5, uomCode: 'CTN', bills: [{ type: 'M', issuerCode: 'SCAC', identifier: 'BILL2' }] },
    ];
    const fields = fatalFields(input);
    expect(fields).toContain('cargo.inBondDate');
    expect(fields).toContain('manifests[1].bills');
  });

  it('in-bond date ordering against estimated entry and import dates', () => {
    const input = type01();
    input.manifests = [{ manifestedQuantity: 10, uomCode: 'CTN', bills: [{ type: 'I', identifier: '123456789' }, { type: 'M', issuerCode: 'SCAC', identifier: 'B1' }] }];
    input.cargo = { ...input.cargo, inBondDate: '090126' }; // Sep 1 2026
    input.header!.estimatedEntryDate = '082026'; // Aug 20 2026 — earlier
    expect(fatalFields(input)).toContain('cargo.inBondDate');
  });

  it('a stray in-bond date without any in-bond movement is fatal', () => {
    const input = type01();
    input.cargo = { ...input.cargo, inBondDate: '081026' };
    expect(fatalFields(input)).toContain('cargo.inBondDate');
  });

  it('bill hierarchy: sub-house needs house, house needs master; issuer rules per MOT', () => {
    const input = type01();
    input.manifests = [{ manifestedQuantity: 1, uomCode: 'CTN', bills: [{ type: 'H', issuerCode: 'SCAC', identifier: 'H1' }] }];
    expect(fatalFields(input)).toContain('manifests[0].bills');

    const vessel = type01(); // fixture MOT 11 = vessel
    vessel.manifests = [{ manifestedQuantity: 1, uomCode: 'CTN', bills: [{ type: 'M', identifier: 'M1' }] }];
    expect(fatalFields(vessel)).toContain('manifests[0].bills'); // vessel master needs SCAC issuer

    const air = type01();
    air.motCode = '40';
    air.manifests = [{ manifestedQuantity: 1, uomCode: 'CTN', bills: [{ type: 'M', issuerCode: 'SCAC', identifier: 'M1' }] }];
    expect(fatalFields(air)).toContain('manifests[0].bills'); // air master must NOT carry issuer
  });
});

describe('payment/statement rules (usage note y) + warehouse HMF (note bb)', () => {
  it('individual payment (type 1) forbids all statement fields', () => {
    const input = type01();
    input.payment = { typeCode: '1', preliminaryStatementPrintDate: '082426', periodicStatementMonth: '09' };
    const fields = fatalFields(input);
    expect(fields).toContain('payment.preliminaryStatementPrintDate');
    expect(fields).toContain('payment.periodicStatementMonth');
  });

  it('daily statements need a print date (weekday); monthly also needs the month and bans IR tax', () => {
    const daily = type01();
    daily.payment = { typeCode: '2' };
    expect(fatalFields(daily)).toContain('payment.preliminaryStatementPrintDate');

    const weekend = type01();
    weekend.payment = { typeCode: '2', preliminaryStatementPrintDate: '082226' }; // Aug 22 2026 = Saturday
    expect(fatalFields(weekend)).toContain('payment.preliminaryStatementPrintDate');

    const monthly = type01();
    monthly.payment = { typeCode: '6', preliminaryStatementPrintDate: '082426', periodicStatementMonth: '09' };
    monthly.lines![0].irTax = { classCode: '016', amountCents: 5000 };
    expect(fatalFields(monthly)).toContain('lines[0].irTax');
  });

  it('HMF is never assessed on re-warehouse/withdrawal types (note bb)', () => {
    const input = type01();
    input.entryTypeCode = '22';
    input.motCode = undefined;
    input.header!.dateOfImportation = undefined;
    input.lines![0].fees = [{ classCode: '501', amountCents: 1250 }];
    expect(fatalFields(input)).toContain('lines[0].fees');
  });
});
