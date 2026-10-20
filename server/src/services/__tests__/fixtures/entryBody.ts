/** A complete v1 entry body with one line: $10,000 of CN batteries unless overridden. */
import type { AbiDocumentBody } from '../../abi/types.js';

export interface EntryBodyOptions {
  hts?: string;
  origin?: string;
  value?: number;
  quantity?: string;
  ch99?: string[];
  spi?: string;
}

export function entryBody(opts: EntryBodyOptions = {}): AbiDocumentBody {
  return {
    entryType: '01',
    modeOfTransport: '11',
    entryNumber: 'SP7-1234567-0',
    dates: { entryDate: '20260820', importDate: '20260815', arrivalDate: '20260814' },
    location: { portOfEntry: '2704', destinationStateUS: 'CA' },
    ior: { number: '26-164751100', name: 'SIGMA TECHNOLOGY PARTNERS LLC' },
    bond: { type: '8', suretyCode: '123', taxId: '26-164751100' },
    payment: { typeCode: 2, preliminaryStatementDate: '20260901' },
    firms: 'Y123',
    entryConsignee: {
      name: 'SIGMA TECHNOLOGY PARTNERS LLC', taxId: '26-164751100',
      address: '1 MAIN ST', city: 'LOS ANGELES', state: 'CA', postalCode: '90001', country: 'US',
    },
    manifest: [{
      bill: { type: 'M', mBOL: 'MAEU123456789012', hBOL: 'MAEU123456789012', groupBOL: 'N' },
      carrier: { code: 'MAEU' },
      ports: { portOfUnlading: '2704' },
      quantity: '100', quantityUOM: 'CTNS',
      invoices: [{
        purchaseOrder: 'PO-1', invoiceNumber: 'INV-1', exportDate: '20260801',
        relatedParties: 'N', countryOfExport: opts.origin ?? 'CN', currency: 'USD', exchangeRate: 1,
        items: [{
          sku: 'SKU-1', htsNumber: opts.hts ?? '8507600030',
          description: 'LITHIUM ION BATTERY PACKS',
          origin: { country: opts.origin ?? 'CN' },
          ...(opts.ch99 ? { additionalHtsNumbers: opts.ch99 } : {}),
          ...(opts.spi ? { spiClaimCode: opts.spi } : {}),
          values: { currency: 'USD', exchangeRate: 1, totalValueOfGoods: opts.value ?? 10000 },
          quantity1: opts.quantity ?? '500 NO', weight: { gross: '2646', uom: 'L' },
          parties: [
            { type: 'buyer', taxId: '26-164751100' },
            { type: 'manufacturer', name: 'SHENZHEN BATTERY CO', address: '8 INDUSTRIAL RD', city: 'SHENZHEN', country: 'CN' },
          ],
        }],
      }],
    }],
  } as unknown as AbiDocumentBody;
}
