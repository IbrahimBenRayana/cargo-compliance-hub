/**
 * Foreign Importer of Record enhancement — Importer of Record Information
 * 15-Record (Entry Summary Create/Update V112, ESF-42; CSMS #70409426) and
 * the usage-note-(f) importer number formats it reuses.
 */
import { describe, it, expect } from 'vitest';
import { buildEntrySummary } from '../ae/builder.js';
import { validateEntrySummary } from '../validate/entrySummary.js';
import { toAeEntrySummaryInput } from '../payload/toAeInput.js';
import { parseAbiPayloadV2 } from '../payload/schemaV2.js';
import { canonicalImporterNumber } from '../records/importerNumber.js';
import { TYPE01_PAYLOAD_V2 } from './fixtures/type01PayloadV2.js';
import type { AeEntrySummaryInput } from '../ae/builder.js';

function type01(): AeEntrySummaryInput {
  return toAeEntrySummaryInput(parseAbiPayloadV2(TYPE01_PAYLOAD_V2), 'A');
}

describe('canonicalImporterNumber (usage note f)', () => {
  it('detects SSN, EIN with and without suffix, and CBP-assigned numbers', () => {
    expect(canonicalImporterNumber('123-45-6789')).toEqual({ type: '34', number: '123-45-6789' });
    expect(canonicalImporterNumber('12-3456789')).toEqual({ type: 'EI', number: '12-3456789' });
    expect(canonicalImporterNumber('123456789')).toEqual({ type: 'EI', number: '12-3456789' });
    expect(canonicalImporterNumber('12-3456789A1')).toEqual({ type: 'EI', number: '12-3456789A1' });
    expect(canonicalImporterNumber(' 261303-12345 ')).toEqual({ type: 'ANI', number: '261303-12345' });
    expect(canonicalImporterNumber('26130312345')).toEqual({ type: 'ANI', number: '261303-12345' });
  });

  it('returns null for anything else', () => {
    for (const raw of ['', 'ACME', '12-345678', '1234-56-789', '261303-1234A5']) {
      expect(canonicalImporterNumber(raw)).toBeNull();
    }
  });
});

describe('15-Record — Importer of Record Information', () => {
  const rec15 = (lines: string[]) => lines.filter((l) => l.startsWith('15'));

  it('is not emitted without a declaration (pre-cutover transactions stay byte-identical)', () => {
    expect(rec15(buildEntrySummary(type01()))).toEqual([]);
  });

  it('follows the 11-Record with Y/N indicators at positions 4 and 6', () => {
    const input = { ...type01(), iorDeclaration: { usImporterOfRecord: true, brokerActingAsIor: false } };
    const lines = buildEntrySummary(input);
    const at11 = lines.findIndex((l) => l.startsWith('11'));
    expect(lines[at11 + 1]).toBe('15 Y N'.padEnd(80));
  });

  it('carries the principal on power of attorney at positions 7-18', () => {
    const input = {
      ...type01(),
      iorDeclaration: { usImporterOfRecord: false, brokerActingAsIor: true, principalOnPoa: '12-3456789' },
    };
    const [line] = rec15(buildEntrySummary(input));
    expect(line).toHaveLength(80);
    expect(line.slice(3, 4)).toBe('N');
    expect(line.slice(5, 6)).toBe('Y');
    expect(line.slice(6, 18)).toBe('12-3456789  ');
    expect(line.slice(18)).toBe(' '.repeat(62));
  });

  it('is never emitted on a Delete (10-Record only)', () => {
    const input = { ...type01(), action: 'D' as const, iorDeclaration: { usImporterOfRecord: true, brokerActingAsIor: false } };
    expect(rec15(buildEntrySummary(input))).toEqual([]);
  });
});

describe('validateEntrySummary — IOR declaration', () => {
  const fields = (input: AeEntrySummaryInput, requireIorDeclaration = true) =>
    validateEntrySummary(input, { requireIorDeclaration }).map((i) => i.field);

  it('requires the declaration on Add/Replace once required (error 888)', () => {
    expect(fields(type01())).toEqual(['iorDeclaration']);
    expect(fields({ ...type01(), action: 'R' })).toEqual(['iorDeclaration']);
  });

  it('does not require it before the cutover or on a Delete', () => {
    expect(fields(type01(), false)).toEqual([]);
    expect(validateEntrySummary(type01())).toEqual([]);
    expect(fields({ ...type01(), action: 'D', lines: undefined })).toEqual([]);
  });

  it('accepts a complete declaration', () => {
    expect(fields({ ...type01(), iorDeclaration: { usImporterOfRecord: true, brokerActingAsIor: false } })).toEqual([]);
    expect(
      fields({
        ...type01(),
        iorDeclaration: { usImporterOfRecord: false, brokerActingAsIor: true, principalOnPoa: '261303-12345' },
      })
    ).toEqual([]);
  });

  it('rejects a principal not in a usage-note-f format (error 893)', () => {
    const input = {
      ...type01(),
      iorDeclaration: { usImporterOfRecord: true, brokerActingAsIor: true, principalOnPoa: '123456789' },
    };
    expect(fields(input)).toEqual(['iorDeclaration.principalOnPoa']);
  });

  it('rejects a principal when the broker is not acting as IOR', () => {
    const input = {
      ...type01(),
      iorDeclaration: { usImporterOfRecord: true, brokerActingAsIor: false, principalOnPoa: '12-3456789' },
    };
    expect(fields(input)).toEqual(['iorDeclaration.principalOnPoa']);
  });
});
