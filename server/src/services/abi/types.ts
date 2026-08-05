/**
 * ABI wire types — CBP Entry Summary 7501 + Cargo Release 3461.
 *
 * Phase 0.4 arrow-flip (see docs/abi-engine/MIGRATION_PLAN.md): this module
 * now OWNS the ABI payload/response types. They were born in
 * services/customscity.ts under CC-prefixed names; the shapes still match
 * the CustomsCity ABI API examples verbatim, but the declarations live here
 * under neutral names so a native CATAIR engine can implement the same
 * contract. The legacy CC-prefixed names remain as type aliases in the
 * services/customscity.ts barrel for existing importers.
 */

// ── ABI Document Types (CBP Entry Summary 7501 + Cargo Release 3461) ──
// Field names match the official CustomsCity ABI API examples verbatim.
// Dates are YYYYMMDD strings per the published ABI schema (not integers
// like ISF — confirmed against the user-supplied example payload).

export interface AbiDates {
  entryDate: string;
  importDate: string;
  arrivalDate: string;
}

export interface AbiLocation {
  portOfEntry: string;
  destinationStateUS: string;
}

export interface AbiIOR {
  number: string;
  name: string;
}

export interface AbiBond {
  type: string;
  suretyCode: string;
  taxId: string;
}

export interface AbiPayment {
  typeCode: number;
  preliminaryStatementDate: string;
}

export interface AbiConsignee {
  name: string;
  taxId: string;
  address: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
}

export interface AbiBill {
  type: string;           // "M" master, "H" house
  mBOL: string;
  hBOL: string;           // required by CC; for master-only set hBOL = mBOL
  groupBOL: 'Y' | 'N';
}

export interface AbiCarrier {
  code: string;           // SCAC
}

export interface AbiPorts {
  portOfUnlading: string;
}

export interface AbiParty {
  type: 'manufacturer' | 'seller' | 'buyer' | 'shipTo';
  loadFrom?: string;      // shipTo shortcut, e.g. "buyer"
  taxId?: string;
  name?: string;
  address?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
  telephone?: string;
  email?: string;
  pointOfContact?: string;
}

export interface AbiItemValues {
  currency: string;
  exchangeRate: number;
  totalValueOfGoods: number;
}

export interface AbiItemWeight {
  gross: string;
  uom: string;            // "K" kg, "L" lb
}

export interface AbiItem {
  sku: string;
  htsNumber: string;
  description: string;
  origin: { country: string };
  values: AbiItemValues;
  quantity1: string;
  weight: AbiItemWeight;
  aluminumPercentage?: number;
  steelPercentage?: number;
  copperPercentage?: number;
  cottonFeeExemption?: 'Y' | 'N';
  autoPartsExemption?: 'Y' | 'N';
  otherThanCompletedKitchenParts?: 'Y' | 'N';
  informationalMaterialsExemption?: 'Y' | 'N';
  religiousPurposes?: 'Y' | 'N';
  agriculturalExemption?: 'Y' | 'N';
  semiConductorExemption?: number | null;
  parties: AbiParty[];
}

export interface AbiInvoice {
  purchaseOrder: string;
  invoiceNumber: string;
  exportDate: string;
  relatedParties: 'Y' | 'N';
  countryOfExport: string;
  currency: string;
  exchangeRate: number;
  items: AbiItem[];
}

export interface AbiManifest {
  bill: AbiBill;
  carrier: AbiCarrier;
  ports: AbiPorts;
  quantity: string;
  quantityUOM: string;
  invoices: AbiInvoice[];
}

/** ABI document body — the object inside `body: [<this>]`. */
export interface AbiDocumentBody {
  entryType: '01' | '11' | '86';
  modeOfTransport: string;          // "40" vessel, "41" air
  entryNumber: string;              // filer-assigned; hyphens auto-stripped by CC
  dates: AbiDates;
  location: AbiLocation;
  ior: AbiIOR;
  bond: AbiBond;
  payment: AbiPayment;
  firms: string;
  entryConsignee: AbiConsignee;
  manifest: AbiManifest[];
}

/** POST /api/abi/documents request envelope. */
export interface AbiCreatePayload {
  type: 'abi';
  version: string;                  // "2.1"
  body: AbiDocumentBody[];
}

/** GET /api/abi/documents response envelope. */
export interface AbiListResponse {
  type: 'abi';
  version: string;
  body: AbiDocumentBody[];
}

/** Query params for GET /api/abi/documents. */
export interface AbiListParams {
  dateFrom: string;                 // YYYY-MM-DD
  dateTo: string;                   // YYYY-MM-DD
  entryType: '01' | '11' | '86';
  skip?: number;
  status?: 'ACCEPTED' | 'CANCELLED' | 'DRAFT' | 'REJECTED' | 'SENT' | 'SENDING';
  houseBOLNumber?: string[];
  masterBOLNumber?: string[];
  entryNumber?: string[];
}

/** Query params for DELETE /api/abi/documents (exactly one of these). */
export interface AbiDeleteParams {
  entryNumber?: string;
  mbolNumber?: string;
}

/**
 * POST /api/abi/send request body.
 * `action` controls which filings are transmitted (Add/Replace/Cancel/...)
 * — Phase 1 only uses 'add' + application 'entry-summary-cargo-release'.
 */
export interface AbiSendPayload {
  type: 'abi';
  action:
    | 'add'
    | 'add-entry-summary'
    | 'add-cargo-release'
    | 'replace'
    | 'replace-entry-summary'
    | 'replace-cargo-release'
    | 'replace-cargo-release-pga'
    | 'replace-pga'
    | 'update-cargo-release'
    | 'cancel-entry-summary'
    | 'cancel-cargo-release';
  application: 'entry-summary-cargo-release' | 'entry-summary' | 'cargo-release' | 'pga';
  MBOLNumber: string;
  entryNumber: string[];
}

