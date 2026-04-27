import { z } from 'zod';

// ─── Primitive helpers ──────────────────────────────────────────────────

const YYYYMMDD = z.string().regex(/^\d{8}$/, 'Date must be YYYYMMDD');
const TwoDigit = z.string().regex(/^\d{2}$/);
const CountryCode = z.string().regex(/^[A-Z]{2}$/, 'ISO-3166 alpha-2');
const USState = z.string().regex(/^[A-Z]{2}$/);

// ─── ABI document sub-schemas ───────────────────────────────────────────

const abiDatesSchema = z.object({
  entryDate: YYYYMMDD,
  importDate: YYYYMMDD,
  arrivalDate: YYYYMMDD,
});

const abiLocationSchema = z.object({
  portOfEntry: z.string().min(1).max(4), // CC: must NOT be longer than 4 chars
  destinationStateUS: USState,
});

const abiIORSchema = z.object({
  number: z.string().min(1).max(50),
  name: z.string().min(1).max(255),
});

const abiBondSchema = z.object({
  type: z.enum(['8', '9']), // CC: only "8" continuous or "9" single-transaction
  taxId: z.string().min(1).max(50),
});

const abiPaymentSchema = z.object({
  typeCode: z.number().int(),
  preliminaryStatementDate: YYYYMMDD,
});

const abiConsigneeSchema = z.object({
  name: z.string().min(1).max(255),
  taxId: z.string().min(1).max(50), // CC required (IRS / EIN / SSN — same form as IOR number)
  address: z.string().min(1).max(255),
  city: z.string().min(1).max(100),
  state: z.string().min(1).max(10),
  postalCode: z.string().min(1).max(20),
  country: CountryCode,
});

const abiBillSchema = z.object({
  type: z.string().min(1).max(2), // "M" master, "H" house
  mBOL: z.string().min(1).max(100),
  // CC requires `hBOL` to be a string (never null). Empty string is allowed
  // and means "no house BOL" (master-only shipment).
  hBOL: z.string().max(100).default(''),
  groupBOL: z.enum(['Y', 'N']).default('N'),
});

const abiCarrierSchema = z.object({
  code: z.string().min(1).max(10), // SCAC
});

const abiPortsSchema = z.object({
  portOfUnlading: z.string().min(1).max(10),
});

const abiPartySchema = z.object({
  type: z.enum(['manufacturer', 'seller', 'buyer', 'shipTo']),
  loadFrom: z.string().optional(), // shipTo only: "buyer" etc
  taxId: z.string().optional(),
  name: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  postalCode: z.string().optional(),
  country: z.string().optional(),
  telephone: z.string().optional(),
  email: z.string().optional(),
  pointOfContact: z.string().optional(),
});

const abiItemSchema = z.object({
  sku: z.string().min(1).max(100),
  htsNumber: z.string().regex(/^\d{10}$/, 'HTS must be 10 digits'),
  description: z.string().min(1).max(500),
  origin: z.object({ country: CountryCode }),
  values: z.object({
    currency: z.string().length(3),
    exchangeRate: z.number().positive(),
    totalValueOfGoods: z.number().nonnegative(),
  }),
  quantity1: z.string().min(1),
  weight: z.object({
    gross: z.string().min(1),
    uom: z.string().min(1).max(3), // "K" kg, "L" lb
  }),
  aluminumPercentage: z.number().min(0).max(100).optional().default(0),
  steelPercentage: z.number().min(0).max(100).optional().default(0),
  copperPercentage: z.number().min(0).max(100).optional().default(0),
  cottonFeeExemption: z.enum(['Y', 'N']).optional().default('N'),
  autoPartsExemption: z.enum(['Y', 'N']).optional().default('N'),
  otherThanCompletedKitchenParts: z.enum(['Y', 'N']).optional().default('N'),
  informationalMaterialsExemption: z.enum(['Y', 'N']).optional().default('N'),
  religiousPurposes: z.enum(['Y', 'N']).optional().default('N'),
  agriculturalExemption: z.enum(['Y', 'N']).optional().default('N'),
  // CC accepts only [null, 1..9] — 0 is rejected. Default to undefined so
  // the field is omitted entirely unless the user explicitly picks a value.
  semiConductorExemption: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5), z.literal(6), z.literal(7), z.literal(8), z.literal(9)]).nullable().optional(),
  parties: z.array(abiPartySchema).min(1),
});

const abiInvoiceSchema = z.object({
  purchaseOrder: z.string().min(1).max(100),
  invoiceNumber: z.string().min(1).max(100),
  exportDate: YYYYMMDD,
  // Phase 1: only "N" accepted. Y (related-party transactions) opens up
  // additional CBP fields we haven't modelled — defer to phase 2.
  relatedParties: z.literal('N').default('N'),
  countryOfExport: CountryCode,
  currency: z.string().length(3),
  exchangeRate: z.number().positive(),
  items: z.array(abiItemSchema).min(1),
});

const abiManifestSchema = z.object({
  bill: abiBillSchema,
  carrier: abiCarrierSchema,
  ports: abiPortsSchema,
  quantity: z.string().min(1),
  quantityUOM: z.string().min(1).max(5),
  invoices: z.array(abiInvoiceSchema).min(1),
});

// ─── Full ABI document body (the `body[0]` object in the CC payload) ────

export const abiDocumentBodySchema = z.object({
  entryType: z.enum(['01', '11']),
  modeOfTransport: TwoDigit,
  // Filer-assigned entry number. CBP / CustomsCity do NOT assign this —
  // the broker draws it from their pre-issued block (e.g. "S4G12580927" or
  // "S4G-1258092-7"). Hyphens are stripped on transmit by the mapper.
  entryNumber: z.string().regex(/^[A-Z0-9-]{9,13}$/, 'Entry number must be 9–13 chars (letters, digits, hyphens)'),
  dates: abiDatesSchema,
  location: abiLocationSchema,
  ior: abiIORSchema,
  bond: abiBondSchema,
  payment: abiPaymentSchema,
  firms: z.string().min(1).max(10),
  entryConsignee: abiConsigneeSchema,
  manifest: z.array(abiManifestSchema).min(1),
});

export type ABIDocumentBody = z.infer<typeof abiDocumentBodySchema>;

// ─── Draft / partial schemas for wizard steps ───────────────────────────

// Every field is optional at draft creation/update time so the wizard can
// save partial state between steps. The full schema above is only enforced
// at transmit time (server-side guard in POST /:id/send).

export const abiDocumentDraftSchema = abiDocumentBodySchema.deepPartial();

export type ABIDocumentDraft = z.infer<typeof abiDocumentDraftSchema>;

// ─── Route payload schemas ──────────────────────────────────────────────

export const createABIDocumentSchema = z.object({
  payload: abiDocumentDraftSchema.default({}),
  manifestQueryId: z.string().uuid().optional(),
  filingId: z.string().uuid().optional(),
});

export const updateABIDocumentSchema = z.object({
  payload: abiDocumentDraftSchema,
});

export const listABIDocumentsQuerySchema = z.object({
  status: z.enum(['DRAFT', 'SENDING', 'SENT', 'ACCEPTED', 'REJECTED', 'CANCELLED']).optional(),
  mbolNumber: z.string().optional(),
  entryNumber: z.string().optional(),
  skip: z.coerce.number().int().nonnegative().default(0),
  take: z.coerce.number().int().positive().max(100).default(25),
});

export const deleteABIDocumentParamsSchema = z.object({
  id: z.string().uuid(),
});

// ─── Status enum (mirrors Prisma string values) ─────────────────────────

export const ABI_DOCUMENT_STATUS = [
  'DRAFT',
  'SENDING',
  'SENT',
  'ACCEPTED',
  'REJECTED',
  'CANCELLED',
] as const;

export type ABIDocumentStatus = (typeof ABI_DOCUMENT_STATUS)[number];
