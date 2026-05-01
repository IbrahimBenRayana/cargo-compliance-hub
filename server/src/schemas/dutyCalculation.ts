import { z } from 'zod';

// ─── Input schemas (same shape, different validation strictness) ────

const CountryCode = z.string().regex(/^[A-Z]{2}$/, 'ISO-3166 alpha-2');
const Currency    = z.string().regex(/^[A-Z]{3}$/, 'ISO-4217');
const HTS_FORMAT  = /^\d{4}\.?\d{2}\.?\d{2}\.?\d{2}$|^\d{10}$|^\d{4}\.\d{2}\.\d{4}$/;
// Accepts: 8501528040, 8501.52.80.40, 8501.52.8040, 7320.20.1000

const baseItemSchema = z.object({
  hts: z.string().regex(HTS_FORMAT, 'HTS must be 10 digits (with optional dots)').optional().or(z.literal('')),
  description: z.string().min(1, 'Description required').max(500),
  totalValue: z.number().nonnegative('Total value must be ≥ 0'),
  quantity1: z.number().nullable().optional(),
  quantity2: z.number().nullable().optional(),
  spi: z.string().max(10).optional().default(''),
  aluminumPercentage:           z.number().min(0).max(100).optional(),
  steelPercentage:              z.number().min(0).max(100).optional(),
  copperPercentage:             z.number().min(0).max(100).optional(),
  isCottonExempt:               z.boolean().optional(),
  isAutoPartExempt:             z.boolean().optional(),
  kitchenPartNotComplete:       z.boolean().optional(),
  isInformationalMaterialExempt:z.boolean().optional(),
});

/** Standard endpoint: HTS is required (deterministic calculation). */
export const dutyCalcStandardItemSchema = baseItemSchema.extend({
  hts: z.string().regex(HTS_FORMAT, 'HTS must be 10 digits (with optional dots)'),
});

/** AI endpoint: HTS is optional (AI classifies from description). */
export const dutyCalcAIItemSchema = baseItemSchema;

const baseRequestSchema = z.object({
  entryType:            z.enum(['formal', 'informal']),
  modeOfTransportation: z.enum(['air', 'ocean', 'truck', 'rail']),
  estimatedEntryDate:   z.string().regex(/^\d{2}\/\d{2}\/\d{4}$/, 'MM/DD/YYYY format'),
  countryOfOrigin:      CountryCode,
  currency:             Currency,
});

export const dutyCalcStandardSchema = baseRequestSchema.extend({
  items: z.array(dutyCalcStandardItemSchema).min(1, 'At least one item required').max(50),
});

export const dutyCalcAISchema = baseRequestSchema.extend({
  items: z.array(dutyCalcAIItemSchema).min(1, 'At least one item required').max(50),
});

export type DutyCalcStandardPayload = z.infer<typeof dutyCalcStandardSchema>;
export type DutyCalcAIPayload       = z.infer<typeof dutyCalcAISchema>;

/** Strip dots from HTS values before sending to CC (CC accepts both, but
 *  storage / lookup is unhyphenated — same convention as ABI entry numbers). */
export function normaliseHts(hts: string): string {
  return hts.replace(/\./g, '');
}
