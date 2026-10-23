/** ENT-01 (testing week): CBP needs a "sold to" (Buyer + tax ID) party on each line of a type 01/03 entry. */
import { describe, it, expect } from 'vitest';
import { validateStep5 } from '../validators';
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
