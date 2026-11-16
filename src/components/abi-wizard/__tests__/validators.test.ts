/** ENT-01 (testing week): CBP needs a "sold to" (Buyer + tax ID) party on each line of a type 01/03 entry. */
import { describe, it, expect } from 'vitest';
import { validateStep2, validateStep5 } from '../validators';
import type { ABIDocumentDraft } from '@/api/client';

const item = (parties: Array<Record<string, string>>) => ({
  sku: 'A', htsNumber: '8507600030', description: 'BATTERIES', origin: { country: 'CN' },
  values: { currency: 'USD', exchangeRate: 1, totalValueOfGoods: 100 }, quantity1: '1', weight: { gross: '1', uom: 'K' }, parties,
});
const draft = (entryType: string, parties: Array<Record<string, string>>) => ({
  entryType,
  manifest: [{ invoices: [{ purchaseOrder: 'P', invoiceNumber: 'I', exportDate: '20261001', countryOfExport: 'CN', currency: 'USD', exchangeRate: 1, items: [item(parties)] }] }],
}) as unknown as ABIDocumentDraft;
const MFR = { type: 'manufacturer', name: 'ACME', country: 'CN' };

describe('validateStep5 buyer party', () => {
  it('asks for a buyer with tax ID on a type 01 line', () => {
    const e = validateStep5(draft('01', [MFR]));
    expect(Object.entries(e).find(([k]) => k.endsWith('.parties'))?.[1]).toMatch(/Buyer party with its tax ID/);
  });
  it('accepts a type 01 line with a buyer tax ID', () => {
    const e = validateStep5(draft('01', [MFR, { type: 'buyer', taxId: '57-123456789' }]));
    expect(Object.keys(e).filter((k) => k.endsWith('.parties'))).toEqual([]);
  });
  it('does not require a buyer on an informal (11) entry', () => {
    const e = validateStep5(draft('11', [MFR]));
    expect(Object.keys(e).filter((k) => k.endsWith('.parties'))).toEqual([]);
  });
});

describe('validateStep2 importer of record status', () => {
  const ior = (patch: Record<string, unknown>) =>
    validateStep2({ ior: { number: '12-3456789', name: 'ACME', ...patch } } as unknown as ABIDocumentDraft);
  const iorErrors = (patch: Record<string, unknown>) =>
    Object.keys(ior(patch)).filter((k) => k.startsWith('ior.'));

  it('requires a choice, with no default', () => {
    expect(iorErrors({})).toEqual(['ior.usImporterOfRecord']);
  });

  it('requires the attestation for a U.S. answer only', () => {
    expect(iorErrors({ usImporterOfRecord: true })).toEqual(['ior.usIorAttested']);
    expect(iorErrors({ usImporterOfRecord: true, usIorAttested: true })).toEqual([]);
    expect(iorErrors({ usImporterOfRecord: false })).toEqual([]);
  });

  it('checks the principal number format when the broker is IOR', () => {
    const base = { usImporterOfRecord: false, brokerActingAsIor: true };
    expect(iorErrors({ ...base, principalOnPoa: '123456789' })).toEqual(['ior.principalOnPoa']);
    for (const n of ['12-3456789', '12-3456789A1', '123-45-6789', '261303-12345']) {
      expect(iorErrors({ ...base, principalOnPoa: n })).toEqual([]);
    }
    expect(iorErrors(base)).toEqual([]);
  });
});
