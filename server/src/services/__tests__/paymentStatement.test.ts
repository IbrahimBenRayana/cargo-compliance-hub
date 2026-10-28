/**
 * Statement fields follow the payment type (audit FNA-02, CATAIR ESF-31
 * usage note y): none for individual payment (1), a preliminary statement
 * date for statements (2-8), and the statement month for periodic monthly
 * statements (6-8).
 */
import { describe, it, expect } from 'vitest';
import { abiDocumentBodySchema } from '../../schemas/abiDocument.js';
import { migrateV1ToV2 } from '../../abi-engine/payload/migrateV1.js';
import { entryBody } from './fixtures/entryBody.js';

const withPayment = (payment: Record<string, unknown>) => ({ ...entryBody(), payment });
const ok = (payment: Record<string, unknown>) => abiDocumentBodySchema.safeParse(withPayment(payment)).success;

describe('payment statement fields', () => {
  it('individual payment takes no statement fields', () => {
    expect(ok({ typeCode: 1 })).toBe(true);
    expect(ok({ typeCode: 1, preliminaryStatementDate: '20260901' })).toBe(false);
    expect(ok({ typeCode: 1, periodicStatementMonth: '09' })).toBe(false);
  });

  it('daily statements need the statement date and take no month', () => {
    expect(ok({ typeCode: 2, preliminaryStatementDate: '20260901' })).toBe(true);
    expect(ok({ typeCode: 2 })).toBe(false);
    expect(ok({ typeCode: 3, preliminaryStatementDate: '20260901', periodicStatementMonth: '09' })).toBe(false);
  });

  it('periodic monthly statements need the date and the month', () => {
    expect(ok({ typeCode: 6, preliminaryStatementDate: '20260901', periodicStatementMonth: '09' })).toBe(true);
    expect(ok({ typeCode: 7, preliminaryStatementDate: '20260901' })).toBe(false);
    expect(ok({ typeCode: 8, preliminaryStatementDate: '20260901', periodicStatementMonth: '13' })).toBe(false);
  });

  it('rejects payment types CATAIR does not define, and a statement date before the entry date', () => {
    expect(ok({ typeCode: 4, preliminaryStatementDate: '20260901' })).toBe(false);
    expect(ok({ typeCode: 2, preliminaryStatementDate: '20260801' })).toBe(false);
  });

  it('carries the month to the native payload', () => {
    const v2 = migrateV1ToV2(withPayment({ typeCode: 6, preliminaryStatementDate: '20260901', periodicStatementMonth: '09' }) as never);
    expect(v2.entrySummary.payment).toMatchObject({ typeCode: '6', preliminaryStatementPrintDate: '20260901', periodicStatementMonth: '09' });
  });
});
