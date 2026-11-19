import { describe, it, expect } from 'vitest';
import { ctpatChecks } from '../ctpatRules.js';

const foreign = { usImporterOfRecord: false, brokerActingAsIor: false };
const brokerIor = { usImporterOfRecord: false, brokerActingAsIor: true };
const codes = (r: ReturnType<typeof ctpatChecks>) => ({
  blocks: r.blocks.map((b) => b.field),
  warnings: r.warnings.map((w) => w.code),
});

describe('ctpatChecks (spec §4 R2, R4, R5)', () => {
  it('has nothing to say without a declaration', () => {
    expect(codes(ctpatChecks({ filerCtpat: 'NONE' }))).toEqual({ blocks: [], warnings: [] });
  });

  it('R2: a non-CTPAT broker acting as IOR must name the principal (892)', () => {
    expect(codes(ctpatChecks({ declaration: { usImporterOfRecord: true, brokerActingAsIor: true }, filerCtpat: 'NONE' })).blocks)
      .toEqual(['ior.principalOnPoa']);
    expect(codes(ctpatChecks({ declaration: { usImporterOfRecord: true, brokerActingAsIor: true }, filerCtpat: 'UNKNOWN' })).blocks)
      .toEqual(['ior.principalOnPoa']);
    expect(codes(ctpatChecks({ declaration: { usImporterOfRecord: true, brokerActingAsIor: true }, filerCtpat: 'VALIDATED' })).blocks)
      .toEqual([]);
    expect(
      codes(ctpatChecks({ declaration: { usImporterOfRecord: true, brokerActingAsIor: true, principalOnPoa: '12-3456789' }, filerCtpat: 'NONE' })).blocks
    ).toEqual([]);
  });

  it('R4: foreign IOR, neither the importer nor the filer CTPAT validated, warns 894', () => {
    expect(codes(ctpatChecks({ declaration: foreign, filerCtpat: 'NONE', iorCtpat: 'UNKNOWN' })).warnings).toEqual(['CTPAT_FOREIGN_IOR']);
    expect(codes(ctpatChecks({ declaration: foreign, filerCtpat: 'VALIDATED', iorCtpat: 'NONE' })).warnings).toEqual([]);
    expect(codes(ctpatChecks({ declaration: foreign, filerCtpat: 'NONE', iorCtpat: 'VALIDATED' })).warnings).toEqual([]);
  });

  it('R5: foreign IOR, broker as IOR not CTPAT, principal not CTPAT, warns 894', () => {
    const r = ctpatChecks({ declaration: { ...brokerIor, principalOnPoa: '12-3456789' }, filerCtpat: 'NONE', iorCtpat: 'NONE' });
    expect(codes(r)).toEqual({ blocks: [], warnings: ['CTPAT_PRINCIPAL'] });
    expect(codes(ctpatChecks({ declaration: { ...brokerIor, principalOnPoa: '12-3456789' }, filerCtpat: 'NONE', iorCtpat: 'VALIDATED' })).warnings).toEqual([]);
  });

  it('never warns for a U.S. importer of record', () => {
    expect(codes(ctpatChecks({ declaration: { usImporterOfRecord: true, brokerActingAsIor: false }, filerCtpat: 'NONE', iorCtpat: 'NONE' })))
      .toEqual({ blocks: [], warnings: [] });
  });
});
