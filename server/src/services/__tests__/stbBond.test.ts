/**
 * Single transaction bonds (audit FNA-21, CATAIR ESF-157/158): a type 9
 * bond states its amount, a continuous bond never does, and the amount
 * reaches the native bond record.
 */
import { describe, it, expect } from 'vitest';
import { abiDocumentBodySchema } from '../../schemas/abiDocument.js';
import { migrateV1ToV2 } from '../../abi-engine/payload/migrateV1.js';
import { entryBody } from './fixtures/entryBody.js';

const withBond = (bond: Record<string, unknown>) => ({ ...entryBody(), bond: { suretyCode: '123', taxId: '26-164751100', ...bond } });
const ok = (bond: Record<string, unknown>) => abiDocumentBodySchema.safeParse(withBond(bond)).success;

describe('bond', () => {
  it('a single transaction bond needs its amount; a continuous bond has none', () => {
    expect(ok({ type: '9', stbAmount: 25000 })).toBe(true);
    expect(ok({ type: '9' })).toBe(false);
    expect(ok({ type: '8' })).toBe(true);
    expect(ok({ type: '8', stbAmount: 25000 })).toBe(false);
  });

  it('surety codes are 3 characters', () => {
    expect(ok({ type: '8', suretyCode: '1234' })).toBe(false);
  });

  it('carries the STB amount to the native bond record', () => {
    const v2 = migrateV1ToV2(withBond({ type: '9', stbAmount: 25000 }) as never);
    expect(v2.entrySummary.bonds).toEqual([{ bondTypeCode: '9', designationTypeCode: 'B', suretyCompanyCode: '123', stbAmountDollars: 25000 }]);
  });
});
