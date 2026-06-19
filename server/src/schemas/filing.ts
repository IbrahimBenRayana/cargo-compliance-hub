/**
 * Filing (ISF) zod schemas — shared between the JWT routes (routes/filings.ts),
 * the reusable write services (services/filingWrite.ts), and the public API
 * (routes/publicApi.ts). Moved out of the route module so services + the public
 * API can validate against the same contract without a circular import.
 *
 * Each schema mirrors what the ISF wizard actually sends (see
 * src/pages/ShipmentWizard.tsx → buildPayload). Tighter than `z.any()` so bad
 * data is caught at the boundary instead of being silently passed to CC and
 * rejected there. Strict field-by-field checks still run at /submit via
 * validateFiling().
 */
import { z } from 'zod';

export const addressSchema = z.object({
  name: z.string().min(1).max(35, 'Party name must be 35 characters or fewer (CC limit)'),
  address1: z.string().max(100).optional(),
  address2: z.string().max(100).optional(),
  city: z.string().max(100).optional(),
  state: z.string().max(50).optional(),
  zip: z.string().max(20).optional(),
  country: z.string().max(2).optional(), // ISO-2 when present; loose for drafts
}).or(z.string()); // Plain string accepted for legacy / partial drafts

export const commoditySchema = z.object({
  // Wizard sends digits-only, max 6 chars (ISF requires HTS-6 prefix).
  // We accept 4-10 digits at the boundary so callers other than the wizard
  // (e.g., AI prefill, API) work too. Strict format check at /submit time.
  htsCode: z.string().regex(/^\d{4,10}$/, 'HTS code must be 4–10 digits (no dots/dashes)').or(
    z.string().regex(/^[\d\.\-\s]+$/, 'HTS code may include digits, dots, dashes, or spaces').refine(
      (s) => /^\d{4,10}$/.test(s.replace(/[\.\-\s]/g, '')),
      'HTS code must be 4–10 digits after stripping separators',
    ),
  ),
  countryOfOrigin: z.string().regex(/^[A-Z]{2}$/i, 'Country of origin must be a 2-letter ISO code (e.g., CN, US)'),
  description: z.string().max(45, 'Commodity description must be 45 characters or fewer (CC limit)').optional(),
  quantity: z.number().nonnegative().optional(),
  quantityUOM: z.string().max(10).optional(),
  weight: z.object({
    value: z.number().nonnegative(),
    // CC accepts only K (kilograms) or L (pounds). 'KG' / 'LB' / freeform = rejected.
    unit: z.enum(['K', 'L'], { errorMap: () => ({ message: 'Weight unit must be "K" (kilograms) or "L" (pounds)' }) }).default('K'),
  }).optional(),
  value: z.object({
    amount: z.number().nonnegative(),
    currency: z.string().regex(/^[A-Z]{3}$/, 'Currency must be a 3-letter ISO code (e.g., USD)').default('USD'),
  }).optional(),
});

export const containerSchema = z.object({
  number: z.string().min(1).max(20, 'Container number must be 20 characters or fewer'),
  // CC container types (CN = standard, NC = none/no-container, 20/40/40HC = sizes).
  // Wizard defaults to 'CN' when type is missing — schema reflects that.
  type: z.enum(['CN', 'NC', '20', '40', '40HC', '20GP', '40GP', 'TW', 'CL', 'R0']).optional(),
  sealNumber: z.string().max(50).optional(),
});

export const createFilingSchema = z.object({
  filingType: z.enum(['ISF-10', 'ISF-5']).default('ISF-10'),

  // Importer (string fields stay loose at create time so partial drafts can save).
  // Strict checks run at /submit via validateFiling().
  importerName: z.string().max(35, 'Importer name must be 35 characters or fewer (CC limit)').optional(),
  importerNumber: z.string().max(50).optional(),

  // Consignee
  consigneeName: z.string().max(35, 'Consignee name must be 35 characters or fewer').optional(),
  consigneeNumber: z.string().max(50).optional(),
  consigneeAddress: addressSchema.optional(),

  // Parties — wizard sends `manufacturer` as a single-element array; everything
  // else as a single object. Both shapes work via `.or(z.array(addressSchema))`.
  manufacturer: addressSchema.or(z.array(addressSchema)).optional(),
  seller: addressSchema.optional(),
  buyer: addressSchema.optional(),
  shipToParty: addressSchema.optional(),
  containerStuffingLocation: addressSchema.optional(),
  consolidator: addressSchema.optional(),

  // Shipment details
  masterBol: z.string().max(100).optional(),
  houseBol: z.string().max(100).optional(),
  scacCode: z.string().max(10).optional(),
  vesselName: z.string().max(100).optional(),
  voyageNumber: z.string().max(50).optional(),
  foreignPortOfUnlading: z.string().max(10).optional(),
  placeOfDelivery: z.string().max(10).optional(),
  estimatedDeparture: z.string().optional(),
  estimatedArrival: z.string().optional(),

  // Bond
  bondType: z.string().max(50).optional(),
  bondSuretyCode: z.string().max(10).optional(),

  // ISF-5 specific data (JSONB) — kept loose since the shape is heterogeneous;
  // validateFiling() does the field-by-field checks at /submit.
  isf5Data: z.any().optional(),

  // Commodities & containers — now use the structured sub-schemas above.
  commodities: z.array(commoditySchema).default([]),
  containers: z.array(containerSchema).default([]),
});

export type CreateFilingInput = z.infer<typeof createFilingSchema>;
