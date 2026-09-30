import { describe, it, expect } from 'vitest';
import { isUsFederalHoliday, usFederalHolidays } from '../calendar/usFederalHolidays.js';
import { statementDateFrom } from '../scenarios/aeBase.js';
import { validateEntrySummary } from '../validate/entrySummary.js';

describe('US federal holidays (observed dates)', () => {
  it('lists the eleven 2026 holidays on their observed dates', () => {
    expect(usFederalHolidays(2026)).toEqual([
      '20260101', // New Year's Day (Thu)
      '20260119', // Martin Luther King Jr. Day (3rd Mon Jan)
      '20260216', // Washington's Birthday (3rd Mon Feb)
      '20260525', // Memorial Day (last Mon May)
      '20260619', // Juneteenth (Fri)
      '20260703', // Independence Day: Jul 4 is a Saturday, observed Fri
      '20260907', // Labor Day (1st Mon Sep)
      '20261012', // Columbus Day (2nd Mon Oct)
      '20261111', // Veterans Day (Wed)
      '20261126', // Thanksgiving (4th Thu Nov)
      '20261225', // Christmas Day (Fri)
    ]);
  });

  it('moves a Sunday holiday to Monday and a Saturday holiday to Friday', () => {
    expect(isUsFederalHoliday('20270705')).toBe(true); // Jul 4 2027 is a Sunday
    expect(isUsFederalHoliday('20271224')).toBe(true); // Dec 25 2027 is a Saturday
    expect(isUsFederalHoliday('20271225')).toBe(false);
  });

  it("observes a Saturday New Year's Day on Dec 31 of the prior year", () => {
    expect(isUsFederalHoliday('20271231')).toBe(true); // Jan 1 2028 is a Saturday
    expect(isUsFederalHoliday('20280101')).toBe(false);
  });

  it('treats ordinary business days as non-holidays', () => {
    expect(isUsFederalHoliday('20261013')).toBe(false);
    expect(isUsFederalHoliday('20260930')).toBe(false);
  });
});

describe('statementDateFrom', () => {
  it('rolls past a weekend AND the holiday behind it (live F204, 9/30)', () => {
    // 9/30 + 10 days = Sat 10/10 → Mon 10/12 is Columbus Day → Tue 10/13.
    expect(statementDateFrom('20260930')).toBe('20261013');
  });

  it('leaves an ordinary business day alone', () => {
    // 9/2 + 10 = Sat 9/12 → Mon 9/14 (no holiday).
    expect(statementDateFrom('20260902')).toBe('20260914');
  });
});

describe('validateEntrySummary: statement print date', () => {
  const base = {
    action: 'A' as const,
    filerCode: 'S7P',
    entryNumber: '0000001',
    districtPortOfEntry: '1303',
    entryTypeCode: '01',
    lines: [],
  };

  it('rejects a statement print date on a federal holiday before it reaches ACE', () => {
    const issues = validateEntrySummary({
      ...base,
      payment: { typeCode: '2', preliminaryStatementPrintDate: '101226' }, // Columbus Day 2026
    } as never);
    expect(issues.some((i) => i.field === 'payment.preliminaryStatementPrintDate' && /holiday/i.test(i.message))).toBe(true);
  });

  it('accepts an ordinary business day', () => {
    const issues = validateEntrySummary({
      ...base,
      payment: { typeCode: '2', preliminaryStatementPrintDate: '101326' },
    } as never);
    expect(issues.some((i) => i.field === 'payment.preliminaryStatementPrintDate')).toBe(false);
  });
});
