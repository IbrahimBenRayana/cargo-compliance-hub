/**
 * Bulk invoice-line CSV import.
 *
 * A pro filing an 80-line apparel entry keys from a spreadsheet, not a
 * card-per-item form. This service turns a CSV (the published template)
 * into wizard-shaped invoice items, validating every row against the
 * SAME abiItemSchema the wizard and transmit path enforce — an imported
 * item can never be laxer than a typed one.
 *
 * Errors are per-row and spreadsheet-addressed (header = row 1, first
 * data row = 2) so users fix the file in Excel, not by counting.
 * CSV only by design: the template opens and saves in Excel/Sheets;
 * an XLSX parser dependency isn't worth its supply-chain surface.
 */
import { z } from 'zod';

// ─── Public shapes ──────────────────────────────────────────────────

export interface LineImportRowError {
  /** 1-based spreadsheet row (header is row 1). */
  row: number;
  field: string;
  message: string;
}

export interface LineImportItem {
  sku: string;
  htsNumber: string;
  description: string;
  origin: { country: string };
  values: { currency: string; exchangeRate: number; totalValueOfGoods: number };
  quantity1: string;
  weight: { gross: string; uom: string };
  parties: Array<{
    type: 'manufacturer' | 'buyer';
    name?: string;
    address?: string;
    city?: string;
    country?: string;
    taxId?: string;
  }>;
}

export interface LineImportResult {
  /** Valid items, in file order. */
  items: LineImportItem[];
  errors: LineImportRowError[];
  /** Non-blank data rows seen. */
  totalRows: number;
}

export const MAX_IMPORT_ROWS = 1000;

const REQUIRED_COLUMNS = [
  'sku',
  'hts_number',
  'description',
  'origin_country',
  'total_value',
  'quantity1',
  'gross_weight',
  'weight_uom',
] as const;

const ALL_COLUMNS = [
  ...REQUIRED_COLUMNS,
  'currency',
  'exchange_rate',
  'manufacturer_name',
  'manufacturer_address',
  'manufacturer_city',
  'manufacturer_country',
  'buyer_tax_id',
] as const;

/** Downloadable template: header + one example row. */
export const LINE_IMPORT_TEMPLATE = [
  ALL_COLUMNS.join(','),
  'BAT-01,8507.60.0020,LITHIUM ION BATTERY PACKS,CN,10000,500 NO,2646,LB,USD,1,SHENZHEN BATTERY CO,,SHENZHEN,CN,26-164751100',
].join('\n');

// ─── CSV parsing (RFC-4180 quotes, CRLF-tolerant) ───────────────────

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  let i = 0;
  const push = () => { row.push(field); field = ''; };
  const pushRow = () => { push(); rows.push(row); row = []; };
  while (i < text.length) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i += 2; continue; }
        inQuotes = false; i++; continue;
      }
      field += ch; i++; continue;
    }
    if (ch === '"') { inQuotes = true; i++; continue; }
    if (ch === ',') { push(); i++; continue; }
    if (ch === '\r') { i++; continue; }
    if (ch === '\n') { pushRow(); i++; continue; }
    field += ch; i++;
  }
  if (field !== '' || row.length > 0) pushRow();
  return rows;
}

// ─── Row → item mapping ─────────────────────────────────────────────

// Mirrors the required scalars of schemas/abiDocument.ts abiItemSchema.
const importedItemSchema = z.object({
  sku: z.string().min(1, 'SKU is required').max(100),
  htsNumber: z.string().regex(/^\d{10}$/, 'HTS must be 10 digits'),
  description: z.string().min(1, 'Description is required').max(500),
  origin: z.object({ country: z.string().regex(/^[A-Z]{2}$/, 'Origin must be a 2-letter country code') }),
  values: z.object({
    currency: z.string().length(3, 'Currency must be a 3-letter code'),
    exchangeRate: z.number().positive('Exchange rate must be > 0').max(8, 'Exchange rate cannot exceed 8'),
    totalValueOfGoods: z.number().nonnegative('Value must be ≥ 0'),
  }),
  quantity1: z.string().min(1, 'Quantity is required'),
  weight: z.object({
    gross: z.string().min(1, 'Gross weight is required'),
    uom: z.enum(['K', 'L'], { message: 'Weight unit must be KG or LB' }),
  }),
  parties: z.array(z.object({}).passthrough()).min(1),
});

/** Which template column produced a given schema path (for row errors). */
const FIELD_TO_COLUMN: Record<string, string> = {
  sku: 'sku',
  htsNumber: 'hts_number',
  description: 'description',
  'origin.country': 'origin_country',
  'values.currency': 'currency',
  'values.exchangeRate': 'exchange_rate',
  'values.totalValueOfGoods': 'total_value',
  quantity1: 'quantity1',
  'weight.gross': 'gross_weight',
  'weight.uom': 'weight_uom',
  parties: 'manufacturer_name',
};

function parseNumber(raw: string): number {
  return Number(raw.replace(/,/g, '').trim());
}

function normaliseWeightUom(raw: string): string {
  const upper = raw.trim().toUpperCase();
  if (upper === 'KG' || upper === 'K') return 'K';
  if (upper === 'LB' || upper === 'LBS' || upper === 'L') return 'L';
  return upper; // schema rejects with a readable message
}

export function parseLineImportCsv(text: string): LineImportResult {
  const rows = parseCsv(text).filter((r) => r.some((c) => c.trim() !== ''));
  if (rows.length === 0) {
    return { items: [], errors: [{ row: 1, field: '', message: 'The file is empty.' }], totalRows: 0 };
  }

  // Header: case-insensitive, space/underscore tolerant.
  const header = rows[0].map((h) => h.trim().toLowerCase().replace(/\s+/g, '_'));
  const missing = REQUIRED_COLUMNS.filter((c) => !header.includes(c));
  if (missing.length > 0) {
    return {
      items: [],
      errors: [{ row: 1, field: missing[0], message: `Header is missing required column(s): ${missing.join(', ')}` }],
      totalRows: 0,
    };
  }
  const col = (name: string, row: string[]): string => {
    const idx = header.indexOf(name);
    return idx === -1 ? '' : (row[idx] ?? '').trim();
  };

  const dataRows = rows.slice(1);
  if (dataRows.length > MAX_IMPORT_ROWS) {
    return {
      items: [],
      errors: [{ row: 1, field: '', message: `Import at most ${MAX_IMPORT_ROWS} rows per file (got ${dataRows.length}).` }],
      totalRows: dataRows.length,
    };
  }

  const items: LineImportItem[] = [];
  const errors: LineImportRowError[] = [];

  dataRows.forEach((raw, index) => {
    const rowNumber = index + 2; // header is spreadsheet row 1

    const parties: LineImportItem['parties'] = [];
    const mfrName = col('manufacturer_name', raw);
    if (mfrName) {
      parties.push({
        type: 'manufacturer',
        name: mfrName,
        ...(col('manufacturer_address', raw) && { address: col('manufacturer_address', raw) }),
        ...(col('manufacturer_city', raw) && { city: col('manufacturer_city', raw) }),
        ...(col('manufacturer_country', raw) && { country: col('manufacturer_country', raw).toUpperCase() }),
      });
    }
    const buyerTaxId = col('buyer_tax_id', raw);
    if (buyerTaxId) parties.push({ type: 'buyer', taxId: buyerTaxId });

    if (parties.length === 0) {
      errors.push({
        row: rowNumber,
        field: 'manufacturer_name',
        message: 'Each line needs at least one party — fill manufacturer_name (and country) or buyer_tax_id.',
      });
      return;
    }

    const candidate: LineImportItem = {
      sku: col('sku', raw),
      htsNumber: col('hts_number', raw).replace(/\D/g, ''),
      description: col('description', raw),
      origin: { country: col('origin_country', raw).toUpperCase() },
      values: {
        currency: (col('currency', raw) || 'USD').toUpperCase(),
        exchangeRate: col('exchange_rate', raw) === '' ? 1 : parseNumber(col('exchange_rate', raw)),
        totalValueOfGoods: parseNumber(col('total_value', raw)),
      },
      quantity1: col('quantity1', raw),
      weight: {
        gross: col('gross_weight', raw).replace(/,/g, ''),
        uom: normaliseWeightUom(col('weight_uom', raw)),
      },
      parties,
    };

    const parsed = importedItemSchema.safeParse(candidate);
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        const path = issue.path.join('.');
        errors.push({
          row: rowNumber,
          field: FIELD_TO_COLUMN[path] ?? path,
          message: issue.message,
        });
      }
      return;
    }
    items.push(candidate);
  });

  return { items, errors, totalRows: dataRows.length };
}
