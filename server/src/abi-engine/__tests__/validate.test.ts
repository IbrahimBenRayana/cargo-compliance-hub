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
