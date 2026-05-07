/**
 * Tests for validateFiling — the gate that runs before /submit forwards a
 * filing to CustomsCity. Each test is anchored to a real CC error pattern
 * we observed in prod (submission_logs grouped by error message), so a
 * regression here would re-introduce a known user-visible failure.
 *
 * Test data is the minimum valid ISF-10 filing skeleton; each test mutates
 * one field and asserts the relevant error.
 */

import { describe, it, expect } from 'vitest';
import { validateFiling } from '../validation.js';

// ─── Fixtures ────────────────────────────────────────────────────────

function validParty(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    name:    'ACME Manufacturing Co',
    address: { country: 'CN' },
    ...overrides,
  };
}

function validIsf10(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    filingType: 'ISF-10',
    importerName:   'ACME LLC',
    importerNumber: '12-3456789',
    consigneeName:   'ACME Receiving',
    consigneeNumber: '12-3456789',
    masterBol: 'MAEU1234567890',
    houseBol:  'HCLA12345678',
    foreignPortOfUnlading: '57035', // 5-digit invalid; use known-good 4-digit instead
    estimatedDeparture: new Date(Date.now() + 7  * 24 * 60 * 60 * 1000).toISOString(),
    estimatedArrival:   new Date(Date.now() + 21 * 24 * 60 * 60 * 1000).toISOString(),
    manufacturer:               validParty(),
    seller:                     validParty(),
    buyer:                      validParty({ address: { country: 'US' } }),
    shipToParty:                validParty({ address: { country: 'US' } }),
    containerStuffingLocation:  validParty(),
    consolidator:               validParty(),
    commodities: [
      {
        htsCode: '7320200',
        countryOfOrigin: 'CN',
        description: 'Helical springs',
        weight: { value: 100, unit: 'K' },
      },
    ],
    containers: [{ number: 'MSCU1234567', type: '40HC' }],
    ...overrides,
  };
}

// ─── Port code (CBP Schedule D) ──────────────────────────────────────

describe('port-code validation', () => {
  it('rejects free-form port like "MAEU1234567890" (real prod error pattern)', () => {
    const result = validateFiling(validIsf10({ foreignPortOfUnlading: 'MAEU1234567890' }));
    const portError = result.errors.find(e => e.field === 'foreignPortOfUnlading');
    expect(portError).toBeDefined();
    expect(portError?.severity).toBe('critical');
    expect(portError?.message).toMatch(/CBP port code/);
    expect(result.valid).toBe(false);
  });

  it('rejects 3-letter "USA" (too short for UN/LOCODE, not 4 digits)', () => {
    const result = validateFiling(validIsf10({ foreignPortOfUnlading: 'USA' }));
    expect(result.errors.some(e => e.field === 'foreignPortOfUnlading' && e.severity === 'critical')).toBe(true);
  });

  it('accepts 4-digit CBP port "2704" (Houston)', () => {
    const result = validateFiling(validIsf10({ foreignPortOfUnlading: '2704' }));
    expect(result.errors.some(e => e.field === 'foreignPortOfUnlading')).toBe(false);
  });

  it('accepts 5-letter UN/LOCODE "USLAX"', () => {
    const result = validateFiling(validIsf10({ foreignPortOfUnlading: 'USLAX' }));
    expect(result.errors.some(e => e.field === 'foreignPortOfUnlading')).toBe(false);
  });
});

// ─── Commodity description max length ────────────────────────────────

describe('commodity description length', () => {
  it('rejects description > 45 chars (CC limit, real prod error)', () => {
    const longDesc = 'A'.repeat(46);
    const result = validateFiling(validIsf10({
      commodities: [{
        htsCode: '7320200',
        countryOfOrigin: 'CN',
        description: longDesc,
      }],
    }));
    const descError = result.errors.find(e => e.field === 'commodities[0].description');
    expect(descError).toBeDefined();
    expect(descError?.severity).toBe('critical');
    expect(descError?.message).toMatch(/45 characters or fewer/);
  });

  it('accepts description exactly 45 chars', () => {
    const result = validateFiling(validIsf10({
      commodities: [{
        htsCode: '7320200',
        countryOfOrigin: 'CN',
        description: 'A'.repeat(45),
      }],
    }));
    const descError = result.errors.find(e => e.field === 'commodities[0].description' && e.severity === 'critical');
    expect(descError).toBeUndefined();
  });
});

// ─── Commodity weight unit ───────────────────────────────────────────

describe('commodity weight unit', () => {
  it('rejects weight unit "KG" (real prod error: "weightUOM should be one of [null, , L, K]")', () => {
    const result = validateFiling(validIsf10({
      commodities: [{
        htsCode: '7320200',
        countryOfOrigin: 'CN',
        description: 'Helical springs',
        weight: { value: 100, unit: 'KG' },
      }],
    }));
    const unitError = result.errors.find(e => e.field === 'commodities[0].weight.unit');
    expect(unitError).toBeDefined();
    expect(unitError?.severity).toBe('critical');
  });

  it('accepts weight unit "K" (kilograms)', () => {
    const result = validateFiling(validIsf10({
      commodities: [{
        htsCode: '7320200',
        countryOfOrigin: 'CN',
        description: 'X',
        weight: { value: 100, unit: 'K' },
      }],
    }));
    expect(result.errors.some(e => e.field === 'commodities[0].weight.unit')).toBe(false);
  });

  it('accepts weight unit "L" (pounds)', () => {
    const result = validateFiling(validIsf10({
      commodities: [{
        htsCode: '7320200',
        countryOfOrigin: 'CN',
        description: 'X',
        weight: { value: 220, unit: 'L' },
      }],
    }));
    expect(result.errors.some(e => e.field === 'commodities[0].weight.unit')).toBe(false);
  });

  it('skips check when weight is absent (weight is optional)', () => {
    const result = validateFiling(validIsf10({
      commodities: [{
        htsCode: '7320200',
        countryOfOrigin: 'CN',
        description: 'X',
      }],
    }));
    expect(result.errors.some(e => e.field?.includes('weight.unit'))).toBe(false);
  });
});

// Bond surety code is NOT validated for ISF (CC's ISF-10 spec uses
// bondType + bondHolderID = IOR tax ID, no separate surety code).
// Surety code is an ABI requirement, enforced in schemas/abiDocument.ts.

// ─── Smoke: a fully-valid ISF-10 should pass ────────────────────────

describe('happy path', () => {
  it('a clean ISF-10 with valid port + weight unit + bond passes the gate', () => {
    const result = validateFiling(validIsf10({
      foreignPortOfUnlading: '2704',
      bondType: 'continuous',
    }));
    // Non-critical warnings are OK (e.g., date-in-past). Gate only blocks on critical.
    expect(result.valid).toBe(true);
    expect(result.criticalCount).toBe(0);
  });
});
