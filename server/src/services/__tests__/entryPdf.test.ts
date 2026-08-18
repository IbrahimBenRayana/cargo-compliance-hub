/**
 * CBP Form 7501-format PDF for entry documents. Rendered uncompressed in
 * tests so the content stream is grep-able for the block values.
 */
import { describe, it, expect } from 'vitest';
import { renderEntry7501Pdf } from '../entryPdf.js';
import { estimateDutyForBody } from '../dutyEstimate.js';
import { StaticRateSource } from '../../abi-engine/duty/engine.js';
import type { AbiDocumentBody } from '../abi/types.js';

function completeBody(): AbiDocumentBody {
  return {
    entryType: '01',
    modeOfTransport: '11',
    entryNumber: 'SP7-2000001-0',
    dates: { entryDate: '20260820', importDate: '20260815', arrivalDate: '20260814' },
    location: { portOfEntry: '2704', destinationStateUS: 'CA' },
    ior: { number: '26-164751100', name: 'SIGMA TECHNOLOGY PARTNERS LLC' },
    bond: { type: '8', suretyCode: '123', taxId: '26-164751100' },
    payment: { typeCode: 2, preliminaryStatementDate: '20260901' },
    firms: 'Y123',
    entryConsignee: {
      name: 'SIGMA TECHNOLOGY PARTNERS LLC',
      taxId: '26-164751100',
      address: '1 MAIN ST',
      city: 'LOS ANGELES',
      state: 'CA',
      postalCode: '90001',
      country: 'US',
    },
    manifest: [
      {
        bill: { type: 'M', mBOL: 'MAEU123456789012', hBOL: 'MAEU123456789012', groupBOL: 'N' },
        carrier: { code: 'MAEU' },
        ports: { portOfUnlading: '2704' },
        quantity: '100',
        quantityUOM: 'CTNS',
        invoices: [
          {
            purchaseOrder: 'PO-1',
            invoiceNumber: 'INV-1',
            exportDate: '20260801',
            relatedParties: 'N',
            countryOfExport: 'CN',
            currency: 'USD',
            exchangeRate: 1,
            items: [
              {
                sku: 'BAT-01',
                htsNumber: '8507600020',
                description: 'LITHIUM ION BATTERY PACKS',
                origin: { country: 'CN' },
                values: { currency: 'USD', exchangeRate: 1, totalValueOfGoods: 10000 },
                quantity1: '500 NO',
                weight: { gross: '2646', uom: 'L' },
                parties: [
                  { type: 'buyer', taxId: '26-164751100' },
                  { type: 'manufacturer', name: 'SHENZHEN BATTERY CO', city: 'SHENZHEN', country: 'CN' },
                ],
              },
            ],
          },
        ],
      },
    ],
  } as AbiDocumentBody;
}

const RATES = new StaticRateSource({ '8507600020': '3.4%' });
const rateText = async (hts: string) => (hts === '8507600020' ? '3.4%' : null);

/**
 * Decode the text pdfkit wrote into an uncompressed content stream.
 * Standard-font text lands as kerned hex arrays: `[<454e5452> 50 <59>] TJ`
 * — decode every <hex> run inside each TJ/Tj and join per operator, so
 * 'ENTR'+'Y SUMMAR'+'Y' greps as 'ENTRY SUMMARY'.
 */
function extractPdfText(raw: string): string {
  const out: string[] = [];
  const tjArrays = raw.matchAll(/\[((?:<[0-9a-fA-F]+>|\s|-?\d+(?:\.\d+)?)+)\]\s*TJ/g);
  for (const m of tjArrays) {
    const text = [...m[1].matchAll(/<([0-9a-fA-F]+)>/g)]
      .map(h => Buffer.from(h[1], 'hex').toString('latin1'))
      .join('');
    out.push(text);
  }
  for (const m of raw.matchAll(/<([0-9a-fA-F]+)>\s*Tj/g)) {
    out.push(Buffer.from(m[1], 'hex').toString('latin1'));
  }
  return out.join('\n');
}

async function render(status: string) {
  const body = completeBody();
  const estimate = await estimateDutyForBody(body, RATES);
  const buffer = await renderEntry7501Pdf({
    doc: {
      id: 'doc-1',
      status,
      entryNumber: 'SP7-2000001-0',
      sentAt: status === 'DRAFT' ? null : new Date('2026-08-20T12:00:00Z'),
    },
    body,
    estimate,
    rateText,
    orgName: 'US Imports Inc.',
    compress: false,
  });
  return extractPdfText(buffer.toString('latin1'));
}

describe('renderEntry7501Pdf', () => {
  it('renders the 7501 header blocks with entry identity', async () => {
    const pdf = await render('ACCEPTED');
    expect(pdf).toContain('ENTRY SUMMARY');
    expect(pdf).toContain('CBP Form 7501');
    expect(pdf).toContain('SP7-2000001-0');
    expect(pdf).toContain('SIGMA TECHNOLOGY PARTNERS LLC');
    // Block 2 entry type, block 6 port, block 8 carrier SCAC
    expect(pdf).toContain('01 - Consumption');
    expect(pdf).toContain('2704');
    expect(pdf).toContain('MAEU');
  });

  it('renders line items with HTS, origin, value, rate, and duty', async () => {
    const pdf = await render('ACCEPTED');
    expect(pdf).toContain('8507.60.0020');
    expect(pdf).toContain('LITHIUM ION BATTERY PACKS');
    expect(pdf).toContain('CN');
    expect(pdf).toContain('10,000');
    expect(pdf).toContain('3.4%');
    // 3.4% of $10,000 line duty
    expect(pdf).toContain('340.00');
  });

  it('renders the fee summary (37-40) from the duty estimate', async () => {
    const pdf = await render('ACCEPTED');
    expect(pdf).toContain('34.64'); // MPF
    expect(pdf).toContain('12.50'); // HMF
    expect(pdf).toContain('387.14'); // grand total
  });

  it('derives the manufacturer MID for block 13', async () => {
    const pdf = await render('ACCEPTED');
    expect(pdf).toContain('CNSHEBATSHE');
  });

  it('watermarks non-accepted statuses and not accepted ones', async () => {
    const draft = await render('DRAFT');
    expect(draft).toContain('DRAFT');
    expect(draft).toContain('NOT FILED');

    const accepted = await render('ACCEPTED');
    expect(accepted).not.toContain('NOT FILED');
  });

  it('renders dashes instead of amounts when the estimate is unavailable', async () => {
    const body = completeBody();
    const buffer = await renderEntry7501Pdf({
      doc: { id: 'doc-1', status: 'DRAFT', entryNumber: 'SP7-2000001-0', sentAt: null },
      body,
      estimate: { estimable: false, issues: [{ field: 'x', message: 'missing' }] },
      rateText: async () => null,
      orgName: 'US Imports Inc.',
      compress: false,
    });
    const pdf = extractPdfText(buffer.toString('latin1'));
    expect(pdf).toContain('ENTRY SUMMARY');
    expect(pdf).not.toContain('387.14');
  });
});
