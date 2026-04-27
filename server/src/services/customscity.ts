/**
 * CustomsCity API Adapter
 *
 * Maps our internal Prisma Filing model to the CustomsCity (CC) API format.
 * Aligned with the official CC API documentation example payload.
 *
 * See: docs/CUSTOMSCITY_API.md for the complete reference.
 *
 * Key payload structure (from official docs):
 *   {
 *     type: "isf",
 *     send: false,
 *     sendAs: "add",
 *     version: 2,
 *     body: [ { ...flat party fields, shipments: [{ containerType, containerNumber, manufacturer: [{ ...mfr, items: [...] }] }] } ]
 *   }
 *
 * Critical field naming:
 *   - `masterBOLNumber` (separate from `BOLNumber`)
 *   - `IORName` + `IORLastName` (two separate fields)
 *   - `commodityHTS-6Number` (with HYPHEN, not camelCase)
 *   - `lineItem` (not `sequenceNumber`)
 *   - `estimateDateOfArrival` is a STRING "YYYYMMDD" (not integer)
 *   - Items nest inside manufacturer: shipments[].manufacturer[].items[]
 *   - buyer/shipTo/consolidator/CSL identifierCode = "" (empty, NOT "24")
 */

import { env } from '../config/env.js';
import logger from '../config/logger.js';

// ─── Types matching the official CC API schema ─────────────

/**
 * Top-level payload sent to POST /api/documents/isf.
 * The CC API requires `type`, `send`, `sendAs`, and `version` at the root.
 */
export interface CCDocumentCreatePayload {
  type: 'isf' | 'isf-5';
  send: boolean;
  sendAs: 'add' | 'change' | 'cancel';
  version: number;
  body: any[];  // CCISFDocumentBody[] for ISF-10 or CCISF5DocumentBody[] for ISF-5
}

/**
 * ISF document body — the main data object inside `body: [<this>]`.
 * Field names use the EXACT casing from the official CC API example.
 */
export interface CCISFDocumentBody {
  // ── BOL & Filing Identity ──
  masterBOLNumber: string;          // Master BOL — separate from BOLNumber
  BOLNumber: string;                // House BOL (or same as master for MASTER type)
  billType: string;                 // "HOUSE" | "MASTER"
  amendmentCode: string;            // "CT" for new filings
  ISFSubmissionType: string;        // "1"=ISF-10, "2"=ISF-5
  ISFShipmentTypeCode: string;      // "01"=Direct, "02"=To Order, "03"=FROB
  carnetNumber: string;             // "" when not applicable
  carnetCountry: string;            // "" when not applicable
  shipmentSubtypeCode: string;      // "" (empty string in official example)
  'estimatedValue(Type11)': number | null;
  bondActivityCode: string;         // "01"
  bondType: string;                 // "8"=Continuous, "9"=Single Transaction
  isFROB: boolean;                  // false for non-FROB shipments
  entryTypeCode: string;            // "" (empty string in official example)
  foreignPortOfUnlading: string;    // UN/LOCODE or "" 
  placeOfDelivery: string;          // UN/LOCODE or ""
  bondHolderID: string;             // EIN of bond holder (format: "XX-XXXXXXXXX")
  USPortOfArrival: string;          // 4-digit Schedule-D port code
  estimateDateOfArrival: string | number | null; // YYYYMMDD — API example shows string, validator wants number|null

  // ── Importer of Record (IOR) ──
  IORName: string;                  // IOR first/company name
  IORLastName: string;              // IOR last/company name  
  IORIDCodeQualifier: string;       // "24"=EIN
  IORNumber: string;                // EIN format "XX-XXXXXXXXX"
  IORPassportIssuanceCountry: string; // "" when using EIN
  IORDateOfBirth: string | number | null; // YYYYMMDD — validator wants number|null

  // ── ISF Filer ──
  ISFFilerName: string;             // Filer first/company name
  ISFFilerLastName: string;         // Filer last/company name
  ISFFilerIDCodeQualifier: string;  // "24"=EIN
  ISFFilerNumber: string;           // EIN format "XX-XXXXXXXXX"
  ISFFilerPassportIssuanceCountry: string; // "" when using EIN
  ISFFilerDateOfBirth: string | number | null; // YYYYMMDD — validator wants number|null

  // ── Buyer (flat) ── identifierCode is EMPTY per official example
  buyerIdentifierCode: string;      // "" (empty!)
  buyerTaxID: string;               // "" (empty when no identifierCode)
  buyerName: string;
  buyerDateOfBirth: string | number | null; // YYYYMMDD — validator wants number|null
  buyerAddress1: string;
  buyerAddress2: string;
  buyerCity: string;
  buyerStateOrProvince: string;
  buyerPostalCode: string;
  buyerCountry: string;

  // ── Ship To (flat) ── identifierCode is EMPTY per official example
  shipToIdentifierCode: string;     // "" (empty!)
  shipToTaxID: string;              // "" (empty when no identifierCode)
  shipToName: string;
  shipToDateOfBirth: string | number | null; // YYYYMMDD
  shipToAddress1: string;
  shipToAddress2: string;
  shipToCity: string;
  shipToStateOrProvince: string;
  shipToPostalCode: string;
  shipToCountry: string;

  // ── Consignee (flat) ── identifierCode IS "24" per official example
  consigneeIdentifierCode: string;  // "24" = EIN
  consigneeTaxID: string;           // EIN format
  consigneeName: string;
  consigneeAddress1: string;
  consigneeAddress2: string;
  consigneeCity: string;
  consigneeStateOrProvince: string;
  consigneePostalCode: string;
  consigneeCountry: string;

  // ── Consolidator (flat) ── identifierCode is EMPTY per official example
  consolidatorIdentifierCode: string; // "" (empty!)
  consolidatorTaxID: string;          // "" (empty when no identifierCode)
  consolidatorName: string;
  consolidatorAddress1: string;
  consolidatorAddress2: string;
  consolidatorCity: string;
  consolidatorStateOrProvince: string;
  consolidatorPostalCode: string;
  consolidatorCountry: string;

  // ── Container Stuffing Location (flat) ── identifierCode EMPTY
  containerStuffingLocationIdentifierCode: string; // "" (empty!)
  containerStuffingLocationTaxID: string;          // "" (empty when no identifierCode)
  containerStuffingLocationName: string;
  containerStuffingLocationAddress1: string;
  containerStuffingLocationAddress2: string;
  containerStuffingLocationCity: string;
  containerStuffingLocationStateOrProvince: string;
  containerStuffingLocationPostalCode: string;
  containerStuffingLocationCountry: string;

  // ── Seller (flat) ── identifierCode is EMPTY per official example
  sellerIdentifierCode: string;     // "" (empty!)
  sellerTaxID: string;              // "" (empty when no identifierCode)
  sellerName: string;
  sellerDateOfBirth: string | number | null; // YYYYMMDD — validator wants number|null
  sellerAddress1: string;
  sellerAddress2: string;
  sellerCity: string;
  sellerStateOrProvince: string;
  sellerPostalCode: string;
  sellerCountry: string;

  // ── Package Info ──
  packageQuantity: number | null;   // number|null
  packageUnit: string;

  // ── Additional ISF Reference (optional — not in working curl example) ──
  additionalISFReferenceCode?: string;  // allowed: null, 7U, SCI, SBN, CR, FN
  additionalISFReferenceID?: string;    // Reference number

  // ── References ──
  referenceCodeA: string;
  referenceNumberA: string;
  referenceCodeB: string;
  referenceNumberB: string;
  referenceCodeC: string;
  referenceNumberC: string;

  // ── Shipments (nested structure: container → manufacturer → items) ──
  shipments: CCShipment[];

  // Allow extra fields for forward-compat
  [key: string]: any;
}

/**
 * Shipment entry — contains container info and nested manufacturers with items.
 * Structure: shipments[].manufacturer[].items[]
 */
export interface CCShipment {
  scacCode: string;                 // Carrier SCAC code
  vesselName: string;               // Vessel name
  voyageNumber: string;             // Voyage number
  containerType: string;            // "CN"=Container, or specific size codes
  containerNumber: string;          // Container number
  manufacturer: CCManufacturerWithItems[];
}

/**
 * Manufacturer with nested items array.
 * This is the KEY structure — items live INSIDE manufacturer, not at body root.
 */
export interface CCManufacturerWithItems {
  manufacturerName: string;
  manufacturerTaxID: string;        // "" when no registrationCode
  registrationCode: string;         // "" when not applicable
  manufacturerAddress1: string;
  manufacturerAddress2: string;
  manufacturerCity: string;
  manufacturerStateOrProvince: string;
  manufacturerPostalCode: string;
  manufacturerCountry: string;
  items: CCItem[];
}

/**
 * Item/commodity line — nested inside manufacturer.
 * Note the HYPHENATED field name: `commodityHTS-6Number`
 */
export interface CCItem {
  estimatedQuantity: number;        // numeric, not string
  quantityUOM: string;              // "PKG", "PCS", "CTN", etc.
  estimatedWeight: number;          // numeric, not string
  weightUOM: string;                // "K" = KG, "L" = LBS
  description: string;
  countryOfOrigin: string;          // 2-letter ISO
  'commodityHTS-6Number': string;   // HYPHENATED key name!
  lineItem: number;                 // 1-based line number (not "sequenceNumber")
}

export interface CCDocumentResponse {
  _id?: string;
  id?: string;
  status?: string;
  type?: string;
  createdAt?: string;
  updatedAt?: string;
  body?: any[];
  [key: string]: any;
}

export interface CCListResponse {
  total: number;
  skip: number;
  limit: number;
  data: CCDocumentResponse[];
}

export interface CCHTSClassifyResponse {
  items: Array<{
    description: string;
    hts_code: string;
    explanation: string;
  }>;
}

// ─── ISF-5 Types ───────────────────────────────────────────

/**
 * ISF-5 document body — carrier-filed (NVOCC/carrier submits only 5 data elements).
 * Key differences from ISF-10:
 *   - `type: "isf-5"` at root level
 *   - Has bookingParty fields (not in ISF-10)
 *   - Has ISFFiler fields at body level
 *   - No IOR fields, no consignee, no buyer, no seller, no consolidator, no CSL
 *   - shipToParty is present
 *   - Simpler shipments structure (no scacCode, vesselName, voyageNumber)
 *   - containerType can be "NC" (no container)
 */
export interface CCISF5DocumentBody {
  // ── BOL & Filing Identity ──
  masterBOLNumber: string;
  BOLNumber: string;
  billType: string;
  amendmentCode: string;
  ISFSubmissionType: '2';           // Always "2" for ISF-5
  ISFShipmentTypeCode: string;
  bondActivityCode: string;
  bondType: string;
  bondHolderID: string;
  USPortOfArrival: string;
  estimateDateOfArrival: string;
  foreignPortOfUnlading: string;
  placeOfDelivery: string;
  entryTypeCode: string;

  // ── ISF Filer (carrier/NVOCC) ──
  ISFFilerName: string;
  ISFFilerLastName: string;
  ISFFilerIDCodeQualifier: string;
  ISFFilerNumber: string;
  ISFFilerPassportIssuanceCountry: string;
  ISFFilerDateOfBirth: string;

  // ── Ship To ──
  shipToIdentifierCode: string;
  shipToTaxID: string;
  shipToName: string;
  shipToAddress1: string;
  shipToAddress2: string;
  shipToCity: string;
  shipToStateOrProvince: string;
  shipToPostalCode: string;
  shipToCountry: string;

  // ── Booking Party (ISF-5 specific) ──
  bookingPartyIdentifierCode: string;
  bookingPartyTaxID: string;
  bookingPartyName: string;
  bookingPartyAddress1: string;
  bookingPartyAddress2: string;
  bookingPartyCity: string;
  bookingPartyCountry: string;
  bookingPartyStateOrProvince: string;
  bookingPartyPostalCode: string;
  bookingPartyDateOfBirth: string;   // YYYYMMDD format, required by CC API

  // ── References ──
  referenceCodeA: string;
  referenceNumberA: string;
  referenceCodeB: string;
  referenceNumberB: string;
  referenceCodeC: string;
  referenceNumberC: string;

  // ── Shipments (simpler than ISF-10 — no vessel/voyage/SCAC) ──
  shipments: CCISF5Shipment[];

  [key: string]: any;
}

/**
 * ISF-5 shipment — simpler than ISF-10 (no vessel/voyage/SCAC at shipment level).
 */
export interface CCISF5Shipment {
  containerType: string;            // "NC" for no container, or "CN", "20", "40", etc.
  containerNumber: string;
  manufacturer: CCManufacturerWithItems[];
}

// ── Manifest Query Types ─────────────────────────────────
export interface CCManifestQueryPayload {
  type: 'BOLNUMBER' | 'AWBNUMBER';
  masterBOLNumber: string | null;
  houseBOLNumber: string | null;
  limitOutputOption: '1' | '2' | '3';
  requestRelatedBOL: boolean;
  requestBOLAndEntryInformation: boolean;
}

export interface CCManifestQueryCreateResponse {
  message: string;
  _id: string;
}

export interface CCManifestDisposition {
  dispositionActionDate: string;
  dispositionActionTime: string;
  dispositionCode: string;
  entryNumber?: string;
}

export interface CCManifestHouse {
  awbNumber?: string;
  hawbNumber?: string;
  flightNumber?: string;
  importingCarrierCode?: string;
  scheduledArrivalDate?: string;
  partIndicator?: string;
  manifestQty?: string;
  boardedQty?: string;
  dispositionMsg?: CCManifestDisposition[];
  manifestedPort?: string;
  vesselDeparturePort?: string;
  vesselDepartureDate?: string;
  actualPort?: string;
  actualPortOcean?: string;
  inbondOriginatingPort?: string;
  manifestedInbondDestinationPort?: string;
  actualInbondDestinationManualDiversion?: string;
  actualInbondDestinationEDIDiversion?: string;
  containerLoadPort?: string;
  containerLoadDate?: string;
}

export interface CCManifestResponseItem {
  statusMsg?: any[];
  houses?: CCManifestHouse[];
  lastHouse?: { house: string; masterPartIndicator: string };
  transmissionDate?: string;
  carrierCode?: string;
  conveyanceName?: string;
  importingVesselCodeOrImpConveyanceName?: string;
  voyageFlightTripNo?: string;
  wr1DateOfArrival?: string;
  awbNumber?: string;
  flightNumber?: string;
  importingCarrierCode?: string;
  scheduledArrivalDate?: string;
  masterPartIndicator?: string;
  manifestQty?: string;
  masterBoardedQty?: string;
  modeOfTransport?: string;
  manifestedPortOfUnlading?: string;
  actualPortOcean?: string;
  inbondOriginatingPort?: string;
  manifestedInbondDestinationPort?: string;
  actualInbondDestinationManualDiversion?: string;
  actualInbondDestinationEDIDiversion?: string;
  containerLoadPort?: string;
  containerLoadDate?: string;
}

export interface CCManifestQueryResult {
  data?: {
    type?: string;
    masterBOLNumber?: string;
    requestBOLAndEntryInformation?: boolean;
    requestRelatedBOL?: boolean;
    limitOutputOption?: string;
    response?: CCManifestResponseItem[];
  };
}

// ── ABI Document Types (CBP Entry Summary 7501 + Cargo Release 3461) ──
// Field names match the official CustomsCity ABI API examples verbatim.
// Dates are YYYYMMDD strings per the published ABI schema (not integers
// like ISF — confirmed against the user-supplied example payload).

export interface CCABIDates {
  entryDate: string;
  importDate: string;
  arrivalDate: string;
}

export interface CCABILocation {
  portOfEntry: string;
  destinationStateUS: string;
}

export interface CCABIIOR {
  number: string;
  name: string;
}

export interface CCABIBond {
  type: string;
  taxId: string;
}

export interface CCABIPayment {
  typeCode: number;
  preliminaryStatementDate: string;
}

export interface CCABIConsignee {
  name: string;
  taxId: string;
  address: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
}

export interface CCABIBill {
  type: string;           // "M" master, "H" house
  mBOL: string;
  hBOL: string;
  groupBOL: 'Y' | 'N';
}

export interface CCABICarrier {
  code: string;           // SCAC
}

export interface CCABIPorts {
  portOfUnlading: string;
}

export interface CCABIParty {
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

export interface CCABIItemValues {
  currency: string;
  exchangeRate: number;
  totalValueOfGoods: number;
}

export interface CCABIItemWeight {
  gross: string;
  uom: string;            // "K" kg, "L" lb
}

export interface CCABIItem {
  sku: string;
  htsNumber: string;
  description: string;
  origin: { country: string };
  values: CCABIItemValues;
  quantity1: string;
  weight: CCABIItemWeight;
  aluminumPercentage?: number;
  steelPercentage?: number;
  copperPercentage?: number;
  cottonFeeExemption?: 'Y' | 'N';
  autoPartsExemption?: 'Y' | 'N';
  otherThanCompletedKitchenParts?: 'Y' | 'N';
  informationalMaterialsExemption?: 'Y' | 'N';
  religiousPurposes?: 'Y' | 'N';
  agriculturalExemption?: 'Y' | 'N';
  semiConductorExemption?: number;
  parties: CCABIParty[];
}

export interface CCABIInvoice {
  purchaseOrder: string;
  invoiceNumber: string;
  exportDate: string;
  relatedParties: 'Y' | 'N';
  countryOfExport: string;
  currency: string;
  exchangeRate: number;
  items: CCABIItem[];
}

export interface CCABIManifest {
  bill: CCABIBill;
  carrier: CCABICarrier;
  ports: CCABIPorts;
  quantity: string;
  quantityUOM: string;
  invoices: CCABIInvoice[];
}

/** ABI document body — the object inside `body: [<this>]`. */
export interface CCABIDocumentBody {
  entryType: '01' | '11';
  modeOfTransport: string;          // "40" vessel, "41" air
  entryNumber: string;              // filer-assigned; hyphens auto-stripped by CC
  dates: CCABIDates;
  location: CCABILocation;
  ior: CCABIIOR;
  bond: CCABIBond;
  payment: CCABIPayment;
  firms: string;
  entryConsignee: CCABIConsignee;
  manifest: CCABIManifest[];
}

/** POST /api/abi/documents request envelope. */
export interface CCABICreateDocumentPayload {
  type: 'abi';
  version: string;                  // "2.1"
  body: CCABIDocumentBody[];
}

/** GET /api/abi/documents response envelope. */
export interface CCABIListResponse {
  type: 'abi';
  version: string;
  body: CCABIDocumentBody[];
}

/** Query params for GET /api/abi/documents. */
export interface CCABIListParams {
  dateFrom: string;                 // YYYY-MM-DD
  dateTo: string;                   // YYYY-MM-DD
  entryType: '01' | '11';
  skip?: number;
  status?: 'ACCEPTED' | 'CANCELLED' | 'DRAFT' | 'REJECTED' | 'SENT' | 'SENDING';
  houseBOLNumber?: string[];
  masterBOLNumber?: string[];
  entryNumber?: string[];
}

/** Query params for DELETE /api/abi/documents (exactly one of these). */
export interface CCABIDeleteParams {
  entryNumber?: string;
  mbolNumber?: string;
}

/**
 * POST /api/abi/send request body.
 * `action` controls which filings are transmitted (Add/Replace/Cancel/...)
 * — Phase 1 only uses 'add' + application 'entry-summary-cargo-release'.
 */
export interface CCABISendPayload {
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

// ─── Helpers ───────────────────────────────────────────────

/**
 * Convert a Date or ISO-string to YYYYMMDD integer (what CC API actually validates).
 * NOTE: The official example shows strings, but the actual CC validator expects NUMBER type.
 * Error: "should be number,null"
 */
function toYYYYMMDD(dateValue: any): number | null {
  if (!dateValue) return null;
  const d = dateValue instanceof Date ? dateValue : new Date(dateValue);
  if (isNaN(d.getTime())) return null;
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return parseInt(`${yyyy}${mm}${dd}`, 10);
}

/**
 * Convert a Date or ISO-string to "YYYYMMDD" string.
 * The working CC API curl example uses strings for all date fields.
 */
function toYYYYMMDDString(dateValue: any): string {
  if (!dateValue) return '';
  const d = dateValue instanceof Date ? dateValue : new Date(dateValue);
  if (isNaN(d.getTime())) return '';
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}${mm}${dd}`;
}

/** Safely extract string from a JSONB party object, handling both object and string formats. */
function partyField(party: any, field: string, fallback = ''): string {
  if (!party) return fallback;
  // If party is a JSON string, parse it first
  if (typeof party === 'string') {
    try {
      const parsed = JSON.parse(party);
      if (typeof parsed === 'object' && parsed !== null) {
        return partyField(parsed, field, fallback);
      }
    } catch {
      // Not valid JSON — treat as a plain name string
    }
    return field === 'name' ? party : fallback;
  }
  if (field === 'address1') return party.address1 ?? party.street ?? party.address?.street ?? (typeof party.address === 'string' ? party.address : '') ?? fallback;
  if (field === 'address2') return party.address2 ?? party.address?.street2 ?? party.address?.line2 ?? fallback;
  if (field === 'city')     return party.city ?? party.address?.city ?? fallback;
  if (field === 'state')    return party.state ?? party.stateOrProvince ?? party.address?.state ?? fallback;
  if (field === 'zip')      return party.zip ?? party.postalCode ?? party.address?.zip ?? fallback;
  if (field === 'country')  return party.country ?? party.address?.country ?? fallback;
  if (field === 'taxId')    return party.taxId ?? party.taxID ?? party.number ?? fallback;
  return party[field] ?? fallback;
}

/**
 * Sanitize a name field for CC API.
 * CC rejects periods, commas, and most special characters in name fields.
 * Allowed: letters, numbers, spaces, dashes, ampersands.
 */
function sanitizeName(raw: string, maxLen: number): string {
  if (!raw) return '';
  // Strip characters CC rejects: periods, commas, quotes, slashes, etc.
  const cleaned = raw.replace(/[^A-Za-z0-9 &\-]/g, '').replace(/\s+/g, ' ').trim();
  return cleaned.substring(0, maxLen);
}

/**
 * Sanitize an address field for CC API.
 * CC rejects lone special characters. Strip problematic chars but allow
 * letters, numbers, spaces, dashes, periods, commas, hash, ampersand, slashes.
 */
function sanitizeAddress(raw: string, maxLen = 35): string {
  if (!raw) return '';
  const cleaned = raw.replace(/[^A-Za-z0-9 .\-,#&/]/g, '').replace(/\s+/g, ' ').trim();
  // If the result is just punctuation (like "."), replace with "NA"
  if (/^[^A-Za-z0-9]+$/.test(cleaned)) return 'NA';
  return cleaned.substring(0, maxLen);
}

/**
 * Sanitize a state/province code for CC API.
 * CC requires stateOrProvince to be a 2- or 3-letter code (e.g. "CA", "NY", "BD").
 * If the input is longer than 3 chars it's likely a full name ("Chungnam", "California").
 * We take the first 2 uppercase letters as a best-effort abbreviation.
 * For known long names we could add a lookup, but truncation to 2 is safe — CC just needs
 * a code that's ≤3 chars and alpha.
 */
function sanitizeState(raw: string, fallback = 'XX'): string {
  if (!raw) return fallback;
  const cleaned = raw.replace(/[^A-Za-z]/g, '').toUpperCase();
  if (cleaned.length === 0) return fallback;
  if (cleaned.length <= 3) return cleaned;
  // Longer than 3 chars — take first 2 letters as a code
  return cleaned.substring(0, 2);
}

/** Ensure a TaxID / EIN meets the CC pattern: XX-XXXXXXXXX */
function formatTaxId(raw: string): string {
  if (!raw) return '';
  // Already in correct format?
  if (/^[0-9]{2}-[A-Z0-9]{9}$/i.test(raw)) return raw;
  // Strip non-alphanumeric except dash
  const cleaned = raw.replace(/[^A-Z0-9-]/gi, '');
  // Try to parse "XX-XXXXXXXXX" or "XXXXXXXXXXX" (11 chars)
  if (/^\d{2}-/.test(cleaned) && cleaned.length >= 12) return cleaned.slice(0, 12);
  // If just digits like "123456789", pad to XX-XXXXXXXXX
  const digits = cleaned.replace(/-/g, '');
  if (digits.length >= 9) return digits.slice(0, 2) + '-' + digits.slice(2, 11).padEnd(9, '0');
  return raw; // return as-is if we can't format it
}

/**
 * Format bond holder EIN for ISF-5: standard NN-NNNNNNN (2-7 = 9 digits total).
 * CC ISF-5 API accepts shorter EIN format, NOT the padded 11-char format.
 * E.g. "123456789" → "12-3456789", "12-3456789" → "12-3456789"
 */
function formatBondHolderEIN(raw: string): string {
  if (!raw) return '';
  // Already formatted as NN-NNNNNNN (2 dash 7)?
  if (/^\d{2}-\d{7}$/.test(raw)) return raw;
  // Already formatted as NN-NNNNNNNNN (2 dash 9, the 11-char EIN)? Truncate to 2-7
  if (/^\d{2}-\d{7,}/.test(raw)) return raw.slice(0, 2) + '-' + raw.slice(3, 10);
  // Strip non-digit
  const digits = raw.replace(/\D/g, '');
  if (digits.length >= 9) return digits.slice(0, 2) + '-' + digits.slice(2, 9);
  if (digits.length >= 2) return digits.slice(0, 2) + '-' + digits.slice(2).padEnd(7, '0');
  return raw;
}

// ─── Internal Filing → CC API Mapping ──────────────────────

/**
 * Maps a Prisma Filing (+ its JSONB fields) to the CC ISF document payload.
 *
 * Aligned with the official CC API documentation example.
 * Key differences from earlier versions:
 *   - Root-level `type`, `send`, `sendAs`, `version` fields
 *   - `masterBOLNumber` separate from `BOLNumber`
 *   - `IORName` + `IORLastName` as separate fields
 *   - Date fields are STRINGS "YYYYMMDD" (not integers)
 *   - Items nest inside manufacturer: shipments[].manufacturer[].items[]
 *   - `commodityHTS-6Number` (HYPHENATED key)
 *   - `lineItem` (not `sequenceNumber`)
 *   - buyer/shipTo/seller/consolidator/CSL identifierCode = "" (empty)
 *   - Only consignee and IOR/Filer get identifierCode = "24"
 */
export function mapFilingToCC(filing: any): CCDocumentCreatePayload {
  // Determine ISF submission type
  const isfType = filing.filingType === 'ISF-5' ? '2' : '1';

  // Build manufacturers from the JSONB manufacturer field
  const rawManufacturers = Array.isArray(filing.manufacturer)
    ? filing.manufacturer
    : filing.manufacturer
    ? [filing.manufacturer]
    : [];

  // Build items from the JSONB commodities field
  const rawCommodities = Array.isArray(filing.commodities) ? filing.commodities : [];
  const rawContainers = Array.isArray(filing.containers) ? filing.containers : [];
  const firstContainer = rawContainers[0];

  // Map container type to CC's allowed 2-char codes
  const mapContainerType10 = (raw?: string): string => {
    if (!raw) return 'CN';
    const upper = raw.toUpperCase().trim();
    const typeMap: Record<string, string> = {
      '20GP': '20', '20DV': '20', '20ST': '20', '20OT': '20', '20FR': '20', '20RF': 'R0',
      '40GP': '40', '40DV': '40', '40ST': '40', '40OT': '40', '40FR': '40', '40RF': 'R0',
      '40HC': '40', '40HQ': '40', '45HC': '40', '45HQ': '40', '40RH': 'R0',
      '20FL': '20', '20TK': 'TW', '40FL': '40', '40TK': 'TW',
      'NC': 'NC', 'CN': 'CN', 'CL': 'CL', 'CX': 'CX', 'CW': 'CW', 'CZ': 'CZ', 'RC': 'RC', 'TW': 'TW',
      '20': '20', '2B': '2B', '40': '40', '4B': '4B', 'R0': 'R0',
    };
    return typeMap[upper] ?? (upper.length <= 2 ? upper : 'CN');
  };

  const containerType = mapContainerType10(firstContainer?.type);
  const containerNumber = firstContainer?.number ?? firstContainer?.containerNumber ?? '';

  // Build CC items (nested inside manufacturer)
  const ccItems: CCItem[] = rawCommodities.map((c: any, idx: number) => ({
    estimatedQuantity:      c.quantity != null ? Number(c.quantity) : 0,
    quantityUOM:            c.quantityUOM ?? c.unit ?? 'PKG',
    estimatedWeight:        c.weight?.value != null ? Number(c.weight.value) : (c.weight != null ? Number(c.weight) : 0),
    weightUOM:              c.weight?.unit ?? c.weightUnit ?? 'K',
    description:            c.description ?? '',
    countryOfOrigin:        c.countryOfOrigin ?? '',
    'commodityHTS-6Number': c.htsCode ?? c.htsNumber ?? c.commodityHTS6Number ?? '',
    lineItem:               idx + 1,
  }));

  // Build manufacturers with nested items
  const ccManufacturers: CCManufacturerWithItems[] = rawManufacturers.length > 0
    ? rawManufacturers.map((m: any) => ({
        manufacturerName:            sanitizeName(partyField(m, 'name') || 'Unknown Manufacturer', 35),
        manufacturerTaxID:           '',
        registrationCode:            '',
        manufacturerAddress1:        sanitizeAddress(partyField(m, 'address1')) || 'NA',
        manufacturerAddress2:        sanitizeAddress(partyField(m, 'address2')) || 'NA',
        manufacturerCity:            partyField(m, 'city') || 'Unknown',
        manufacturerStateOrProvince: sanitizeState(partyField(m, 'state')),
        manufacturerPostalCode:      partyField(m, 'zip') || '000000',
        manufacturerCountry:         partyField(m, 'country'),
        items: ccItems.length > 0 ? ccItems : [{
          estimatedQuantity: 1,
          quantityUOM: 'PKG',
          estimatedWeight: 1,
          weightUOM: 'K',
          description: 'Goods',
          countryOfOrigin: partyField(m, 'country') || 'US',
          'commodityHTS-6Number': '000000',
          lineItem: 1,
        }],
      }))
    : [{
        manufacturerName: 'Unknown Manufacturer',
        manufacturerTaxID: '',
        registrationCode: '',
        manufacturerAddress1: 'NA',
        manufacturerAddress2: 'NA',
        manufacturerCity: 'Unknown',
        manufacturerStateOrProvince: 'XX',
        manufacturerPostalCode: '000000',
        manufacturerCountry: 'US',
        items: ccItems.length > 0 ? ccItems : [{
          estimatedQuantity: 1,
          quantityUOM: 'PKG',
          estimatedWeight: 1,
          weightUOM: 'K',
          description: 'Goods',
          countryOfOrigin: 'US',
          'commodityHTS-6Number': '000000',
          lineItem: 1,
        }],
      }];

  // Build shipments array — container at shipment level, manufacturer inside
  const shipments: CCShipment[] = [{
    scacCode:        filing.scacCode ?? filing.carrierCode ?? '',
    vesselName:      filing.vesselName ?? '',
    voyageNumber:    filing.voyageNumber ?? '',
    containerType,
    containerNumber,
    manufacturer: ccManufacturers,
  }];

  // Determine the BOL
  const masterBOL = filing.masterBol ?? '';
  const houseBOL = filing.houseBol ?? filing.masterBol ?? '';
  const billType = filing.houseBol ? 'HOUSE' : 'MASTER';

  // Compute tax IDs — only IOR and consignee use EIN (identifier "24")
  // Other parties (buyer, shipTo, seller, consolidator, CSL) use empty identifierCode
  const iorTaxId     = formatTaxId(filing.importerNumber ?? '');
  const consigneeTax = formatTaxId(filing.consigneeNumber ?? '');

  // Date fields — CC API uses strings for all date fields in the working example
  // (No longer using number-typed dobPlaceholder)

  const body: CCISFDocumentBody = {
    // ── BOL & Filing Identity ──
    masterBOLNumber:     masterBOL,
    BOLNumber:           houseBOL,
    billType,
    amendmentCode:       'CT',       // CT = Complete Transmission (new filing)
    ISFSubmissionType:   isfType,
    ISFShipmentTypeCode: '01',       // "01" = Direct shipment (most common)

    // ── These fields must be EMPTY STRINGS or null when isFROB is false ──
    // CC API enforces: "entryTypeCode not required when isFROB is false"
    // CC API enforces: "foreignPortOfUnlading not required when isFROB is false"
    // CC API enforces: "placeOfDelivery not required when isFROB is false"
    carnetNumber:        '',
    carnetCountry:       '',
    shipmentSubtypeCode: '',
    'estimatedValue(Type11)': null,
    bondActivityCode:    '01',
    bondType:            filing.bondType === 'single' ? '9' : '8',
    isFROB:              false,
    entryTypeCode:       '',         // MUST be empty when isFROB=false
    foreignPortOfUnlading: '',       // MUST be empty when isFROB=false
    placeOfDelivery:       '',       // MUST be empty when isFROB=false
    bondHolderID:        iorTaxId || '00-000000000',
    // USPortOfArrival must be a valid 4-digit CBP port code.
    // The ISF-10 form stores the user's US port selection in foreignPortOfUnlading
    // (using CBP_PORTS_4DIGIT options). placeOfDelivery is an alternative source.
    // Fallback chain: foreignPortOfUnlading (form field) → placeOfDelivery → default 2704
    USPortOfArrival:     (filing.foreignPortOfUnlading || filing.placeOfDelivery || '').replace(/\s/g, '').slice(0, 4) || '2704',
    estimateDateOfArrival: toYYYYMMDDString(filing.estimatedArrival) ?? toYYYYMMDDString(new Date()),

    // ── IOR — identifierCode "24" (EIN format: XX-XXXXXXXXX) ──
    // CC: IORName max 35 chars, ISFFilerName max 25 chars
    // CC rejects periods in name fields — use sanitizeName to strip them
    IORName:                      sanitizeName(filing.importerName ?? '', 35),
    IORLastName:                  sanitizeName(filing.importerName ?? '', 35),
    IORIDCodeQualifier:           '24',
    IORNumber:                    iorTaxId || '00-000000000',
    IORPassportIssuanceCountry:   '',
    IORDateOfBirth:               toYYYYMMDDString(filing.estimatedArrival) ?? toYYYYMMDDString(new Date()),

    // ── ISF Filer — identifierCode "24" (EIN format) ──
    ISFFilerName:                      sanitizeName(filing.importerName ?? '', 25),
    ISFFilerLastName:                  sanitizeName(filing.importerName ?? '', 25),
    ISFFilerIDCodeQualifier:           '24',
    ISFFilerNumber:                    iorTaxId || '00-000000000',
    ISFFilerPassportIssuanceCountry:   '',
    ISFFilerDateOfBirth:               toYYYYMMDDString(filing.estimatedArrival) ?? toYYYYMMDDString(new Date()),

    // ── Buyer — identifierCode EMPTY (no identifier for buyer in standard ISF) ──
    buyerIdentifierCode:  '',
    buyerTaxID:           '',
    buyerName:            sanitizeName(partyField(filing.buyer, 'name') || filing.importerName || '', 35),
    buyerDateOfBirth:     toYYYYMMDDString(filing.estimatedArrival) ?? toYYYYMMDDString(new Date()),
    buyerAddress1:        sanitizeAddress(partyField(filing.buyer, 'address1') || partyField(filing.consigneeAddress, 'address1')) || 'NA',
    buyerAddress2:        sanitizeAddress(partyField(filing.buyer, 'address2')) || 'NA',
    buyerCity:            partyField(filing.buyer, 'city') || partyField(filing.consigneeAddress, 'city') || 'Unknown',
    buyerStateOrProvince: sanitizeState(partyField(filing.buyer, 'state') || partyField(filing.consigneeAddress, 'state')),
    buyerPostalCode:      partyField(filing.buyer, 'zip') || partyField(filing.consigneeAddress, 'zip') || '00000',
    buyerCountry:         partyField(filing.buyer, 'country') || 'US',

    // ── Ship To — identifierCode EMPTY (allowed: null, 1=DUNS, 9=DUNS+4, FR=FIRMS) ──
    shipToIdentifierCode:  '',
    shipToTaxID:           '',
    shipToName:            sanitizeName(partyField(filing.shipToParty, 'name') || filing.importerName || '', 35),
    shipToDateOfBirth:     toYYYYMMDDString(filing.estimatedArrival) ?? toYYYYMMDDString(new Date()),
    shipToAddress1:        sanitizeAddress(partyField(filing.shipToParty, 'address1') || partyField(filing.consigneeAddress, 'address1')) || 'NA',
    shipToAddress2:        sanitizeAddress(partyField(filing.shipToParty, 'address2')) || 'NA',
    shipToCity:            partyField(filing.shipToParty, 'city') || partyField(filing.consigneeAddress, 'city') || 'Unknown',
    shipToStateOrProvince: sanitizeState(partyField(filing.shipToParty, 'state') || partyField(filing.consigneeAddress, 'state')),
    shipToPostalCode:      partyField(filing.shipToParty, 'zip') || partyField(filing.consigneeAddress, 'zip') || '00000',
    shipToCountry:         partyField(filing.shipToParty, 'country') || 'US',

    // ── Consignee — identifierCode "24" (EIN format) ──
    consigneeIdentifierCode:  '24',
    consigneeTaxID:           consigneeTax || '00-000000000',
    consigneeName:            sanitizeName(filing.consigneeName ?? '', 35),
    consigneeAddress1:        sanitizeAddress(partyField(filing.consigneeAddress, 'address1')) || 'NA',
    consigneeAddress2:        sanitizeAddress(partyField(filing.consigneeAddress, 'address2')) || 'NA',
    consigneeCity:            partyField(filing.consigneeAddress, 'city') || 'Unknown',
    consigneeStateOrProvince: sanitizeState(partyField(filing.consigneeAddress, 'state')),
    consigneePostalCode:      partyField(filing.consigneeAddress, 'zip') || '00000',
    consigneeCountry:         partyField(filing.consigneeAddress, 'country') || 'US',

    // ── Consolidator — identifierCode EMPTY (allowed: null, 1=DUNS, 9=DUNS+4) ──
    consolidatorIdentifierCode:  '',
    consolidatorTaxID:           '',
    consolidatorName:            sanitizeName(partyField(filing.consolidator, 'name') || 'Unknown', 35),
    consolidatorAddress1:        sanitizeAddress(partyField(filing.consolidator, 'address1')) || 'NA',
    consolidatorAddress2:        sanitizeAddress(partyField(filing.consolidator, 'address2')) || 'NA',
    consolidatorCity:            partyField(filing.consolidator, 'city') || 'Unknown',
    consolidatorStateOrProvince: sanitizeState(partyField(filing.consolidator, 'state')),
    consolidatorPostalCode:      partyField(filing.consolidator, 'zip') || '000000',
    consolidatorCountry:         partyField(filing.consolidator, 'country') || 'US',

    // ── Container Stuffing Location — identifierCode EMPTY (allowed: null, 1=DUNS, 9=DUNS+4) ──
    containerStuffingLocationIdentifierCode:  '',
    containerStuffingLocationTaxID:           '',
    containerStuffingLocationName:            sanitizeName(partyField(filing.containerStuffingLocation, 'name') || 'Unknown', 35),
    containerStuffingLocationAddress1:        sanitizeAddress(partyField(filing.containerStuffingLocation, 'address1')) || 'NA',
    containerStuffingLocationAddress2:        sanitizeAddress(partyField(filing.containerStuffingLocation, 'address2')) || 'NA',
    containerStuffingLocationCity:            partyField(filing.containerStuffingLocation, 'city') || 'Unknown',
    containerStuffingLocationStateOrProvince: sanitizeState(partyField(filing.containerStuffingLocation, 'state')),
    containerStuffingLocationPostalCode:      partyField(filing.containerStuffingLocation, 'zip') || '00000',
    containerStuffingLocationCountry:         partyField(filing.containerStuffingLocation, 'country') || 'US',

    // ── Seller — identifierCode EMPTY ──
    sellerIdentifierCode:  '',
    sellerTaxID:           '',
    sellerName:            sanitizeName(partyField(filing.seller, 'name') || 'Unknown', 35),
    sellerDateOfBirth:     toYYYYMMDDString(filing.estimatedArrival) || toYYYYMMDDString(new Date()),
    sellerAddress1:        sanitizeAddress(partyField(filing.seller, 'address1')) || 'NA',
    sellerAddress2:        sanitizeAddress(partyField(filing.seller, 'address2')) || 'NA',
    sellerCity:            partyField(filing.seller, 'city') || 'Unknown',
    sellerStateOrProvince: sanitizeState(partyField(filing.seller, 'state')),
    sellerPostalCode:      partyField(filing.seller, 'zip') || '000000',
    sellerCountry:         partyField(filing.seller, 'country') || 'US',

    // ── Package Info ──
    packageQuantity: null,       // null — CC accepts null
    packageUnit:     '',         // empty — CC accepts empty

    // ── References — must be one of: [null, 7U, SCI, SBN, CR, FN] or EMPTY ──
    // The working CC example uses empty strings for all reference codes
    filerCode:                        filing.filerCode ?? '8CCG',
    additionalISFReferenceCode:       '',
    additionalISFReferenceNumber:     '',
    referenceCodeA:   '',
    referenceNumberA: '',
    referenceCodeB:   '',
    referenceNumberB: '',
    referenceCodeC:   '',
    referenceNumberC: '',

    // ── Shipments (the nested structure) ──
    shipments,
  };

  return {
    type: 'isf',
    send: false,           // Create first, then send separately via /api/send
    sendAs: 'add',         // "add" for new filings
    version: 2,            // API version 2 per official docs
    body: [body],
  };
}

// ─── ISF-5 Filing → CC API Mapping ─────────────────────────

/**
 * Maps a Prisma Filing (ISF-5 type) to the CC ISF-5 document payload.
 *
 * ISF-5 is carrier-filed and requires only 5 data elements:
 *   1. Booking Party
 *   2. Ship-To Party
 *   3. Manufacturer (with nested commodity items)
 *   4. Container stuffing location / country of origin
 *   5. Commodity HTS-6 codes
 *
 * The ISF-5 CC API payload uses type: "isf-5" and has a simpler structure
 * than ISF-10 — no IOR, no consignee, no buyer, no seller, no consolidator, no CSL.
 */
export function mapFilingToISF5CC(filing: any): CCDocumentCreatePayload {
  const isf5 = filing.isf5Data ?? {};

  // Build manufacturers from the JSONB manufacturer field
  const rawManufacturers = Array.isArray(filing.manufacturer)
    ? filing.manufacturer
    : filing.manufacturer
    ? [filing.manufacturer]
    : [];

  // Build items from the JSONB commodities field
  const rawCommodities = Array.isArray(filing.commodities) ? filing.commodities : [];
  const rawContainers = Array.isArray(filing.containers) ? filing.containers : [];
  const firstContainer = rawContainers[0];

  // Map container type to CC's allowed 2-char codes:
  // CC allows: 20, 2B, 40, 4B, NC, CL, R0, CN, CX, CW, CZ, RC, TW
  // Common ISO types like "40HC", "20GP", "40GP" etc. must be mapped to 2-char equivalents.
  const mapContainerType = (raw?: string): string => {
    if (!raw) return 'CN';
    const upper = raw.toUpperCase().trim();
    const typeMap: Record<string, string> = {
      '20GP': '20', '20DV': '20', '20ST': '20', '20OT': '20', '20FR': '20', '20RF': 'R0',
      '40GP': '40', '40DV': '40', '40ST': '40', '40OT': '40', '40FR': '40', '40RF': 'R0',
      '40HC': '40', '40HQ': '40', '45HC': '40', '45HQ': '40', '40RH': 'R0',
      '20FL': '20', '20TK': 'TW', '40FL': '40', '40TK': 'TW',
      'NC': 'NC', 'CN': 'CN', 'CL': 'CL', 'CX': 'CX', 'CW': 'CW', 'CZ': 'CZ', 'RC': 'RC', 'TW': 'TW',
      '20': '20', '2B': '2B', '40': '40', '4B': '4B', 'R0': 'R0',
    };
    return typeMap[upper] ?? (upper.length <= 2 ? upper : 'CN');
  };

  const containerType = mapContainerType(firstContainer?.type);
  const containerNumber = firstContainer?.number ?? firstContainer?.containerNumber ?? '';

  // Build CC items (nested inside manufacturer)
  const ccItems: CCItem[] = rawCommodities.map((c: any, idx: number) => ({
    estimatedQuantity:      c.quantity != null ? Number(c.quantity) : 0,
    quantityUOM:            c.quantityUOM ?? c.unit ?? 'PKG',
    estimatedWeight:        c.weight?.value != null ? Number(c.weight.value) : (c.weight != null ? Number(c.weight) : 0),
    weightUOM:              c.weight?.unit ?? c.weightUnit ?? 'K',
    description:            c.description ?? '',
    countryOfOrigin:        c.countryOfOrigin ?? '',
    'commodityHTS-6Number': c.htsCode ?? c.htsNumber ?? c.commodityHTS6Number ?? '',
    lineItem:               idx + 1,
  }));

  // Build manufacturers with nested items
  const ccManufacturers: CCManufacturerWithItems[] = rawManufacturers.length > 0
    ? rawManufacturers.map((m: any) => ({
        manufacturerName:            sanitizeName(partyField(m, 'name') || 'Unknown Manufacturer', 35),
        manufacturerTaxID:           partyField(m, 'taxId') || '',
        registrationCode:            '',
        manufacturerAddress1:        sanitizeAddress(partyField(m, 'address1')) || 'NA',
        manufacturerAddress2:        sanitizeAddress(partyField(m, 'address2')) || 'NA',
        manufacturerCity:            partyField(m, 'city') || 'Unknown',
        manufacturerStateOrProvince: sanitizeState(partyField(m, 'state')),
        manufacturerPostalCode:      partyField(m, 'zip') || '000000',
        manufacturerCountry:         partyField(m, 'country'),
        items: ccItems.length > 0 ? ccItems : [{
          estimatedQuantity: 1, quantityUOM: 'PKG', estimatedWeight: 1, weightUOM: 'K',
          description: 'Goods', countryOfOrigin: partyField(m, 'country') || 'US',
          'commodityHTS-6Number': '000000', lineItem: 1,
        }],
      }))
    : [{
        manufacturerName: 'Unknown Manufacturer', manufacturerTaxID: '', registrationCode: '',
        manufacturerAddress1: 'NA', manufacturerAddress2: 'NA', manufacturerCity: 'Unknown',
        manufacturerStateOrProvince: 'XX', manufacturerPostalCode: '000000', manufacturerCountry: 'US',
        items: ccItems.length > 0 ? ccItems : [{
          estimatedQuantity: 1, quantityUOM: 'PKG', estimatedWeight: 1, weightUOM: 'K',
          description: 'Goods', countryOfOrigin: 'US', 'commodityHTS-6Number': '000000', lineItem: 1,
        }],
      }];

  // Build ISF-5 shipments (simpler — no SCAC/vessel/voyage at shipment level)
  const shipments: CCISF5Shipment[] = [{
    containerType,
    containerNumber,
    manufacturer: ccManufacturers,
  }];

  // BOL determination — ISF-5 always uses "HOUSE" billType
  // CC API ISF-5 requires billType "HOUSE" (verified via direct API testing).
  // masterBOLNumber is the ocean carrier master BOL.
  // BOLNumber is the house BOL (must differ from master).
  const masterBOL = filing.masterBol ?? '';
  const houseBOL = filing.houseBol || '';
  const billType = 'HOUSE';  // ISF-5 always HOUSE (carrier filing)
  // BOLNumber must differ from masterBOLNumber — use houseBol, or derive from masterBol + "01"
  const bolNumber = houseBOL || (masterBOL ? masterBOL + '01' : '');

  // ISF Filer info (from isf5Data or fallback to importer info)
  const filerName   = isf5.ISFFilerName ?? filing.importerName ?? '';
  // ISF-5 ISFFilerNumber: CC API requires NN-NNNNNNNXX (EIN format) when IDCodeQualifier is "24"
  // Use formatTaxId to ensure correct EIN format
  const rawFilerNumber = isf5.ISFFilerNumber ?? filing.importerNumber ?? '';
  const filerIdQualifier = isf5.ISFFilerIDCodeQualifier ?? '24';
  const filerNumber = filerIdQualifier === '24' ? (formatTaxId(rawFilerNumber) || '00-000000000') : rawFilerNumber;

  // Bond holder ID: CC API requires NN-NNNNNNNXX (EIN format, 11 chars)
  // Use formatTaxId to produce correct format
  const rawBondHolder = isf5.bondHolderID ?? '';
  const bondHolderFormatted = formatTaxId(rawBondHolder) || '00-000000000';

  // Pad codes to minimum lengths required by CC API
  const padCode = (val: string | undefined, fallback: string) => {
    const v = (val ?? fallback).replace(/\s/g, '');
    return v.length < 2 ? v.padStart(2, '0') : v;
  };

  // Port codes must be exactly 5 chars for placeOfDelivery/foreignPortOfUnlading
  const portFive = (val: string) => {
    const v = val.replace(/\s/g, '').toUpperCase();
    return v.length === 4 ? v + '0' : v.slice(0, 5) || '00000';
  };

  // US Port of Arrival is 4-char CBP code.
  // isf5.USPortOfArrival is the primary source (4-digit CBP code from the form).
  // filing.foreignPortOfUnlading is now a 5-digit Schedule D code, so only use its first 4 digits as fallback.
  const usPort = (isf5.USPortOfArrival || (filing.foreignPortOfUnlading ? filing.foreignPortOfUnlading.slice(0, 4) : '') || '1001').replace(/\s/g, '').slice(0, 4);

  // foreignPortOfUnlading: CC requires a valid 5-digit Schedule D port code.
  // The form stores this in filing.foreignPortOfUnlading (a 5-digit Schedule D code from the dropdown).
  // Fall back to deriving from USPortOfArrival by padding to 5 digits.
  const foreignPortRaw = filing.foreignPortOfUnlading ?? isf5.foreignPortOfUnlading ?? '';
  const foreignPort = foreignPortRaw ? portFive(foreignPortRaw) : portFive(usPort);

  // ISF-5 body
  const body: CCISF5DocumentBody = {
    // ── BOL & Filing Identity ──
    masterBOLNumber:     masterBOL,
    BOLNumber:           bolNumber,
    billType,
    amendmentCode:       'CT',
    ISFSubmissionType:   '2',       // Always "2" for ISF-5
    ISFShipmentTypeCode: padCode(isf5.ISFShipmentTypeCode, '01'),
    bondActivityCode:    padCode(isf5.bondActivityCode, '03'),
    bondType:            isf5.bondType ?? (filing.bondType === 'single' ? '9' : '8'),
    bondHolderID:        bondHolderFormatted,
    USPortOfArrival:     usPort,
    estimateDateOfArrival: toYYYYMMDDString(isf5.estimateDateOfArrival) || toYYYYMMDDString(filing.estimatedArrival) || toYYYYMMDDString(new Date()),
    // foreignPortOfUnlading: 5-digit Schedule D port code (required by CC)
    foreignPortOfUnlading: foreignPort,
    // placeOfDelivery: 5-digit code for the place where cargo will be delivered in the US
    placeOfDelivery:       portFive(isf5.placeOfDelivery ?? filing.placeOfDelivery ?? usPort + '0'),
    entryTypeCode:         isf5.entryTypeCode === '03' ? '00' : (isf5.entryTypeCode || '00'),

    // ── ISF Filer (carrier/NVOCC) ──
    ISFFilerName:                    sanitizeName(filerName, 25),
    ISFFilerLastName:                sanitizeName(isf5.ISFFilerLastName ?? filerName, 25),
    ISFFilerIDCodeQualifier:         filerIdQualifier,
    ISFFilerNumber:                  filerNumber || '00-000000000',
    ISFFilerPassportIssuanceCountry: isf5.ISFFilerPassportIssuanceCountry ?? '',
    ISFFilerDateOfBirth:             isf5.ISFFilerDateOfBirth ?? '19900101',

    // ── Ship To ──
    shipToIdentifierCode:  '',
    shipToTaxID:           '',
    shipToName:            sanitizeName(partyField(filing.shipToParty, 'name') || filerName || '', 35),
    shipToAddress1:        sanitizeAddress(partyField(filing.shipToParty, 'address1')) || 'NA',
    shipToAddress2:        sanitizeAddress(partyField(filing.shipToParty, 'address2')) || 'NA',
    shipToCity:            partyField(filing.shipToParty, 'city') || 'Unknown',
    shipToStateOrProvince: sanitizeState(partyField(filing.shipToParty, 'state')),
    shipToPostalCode:      partyField(filing.shipToParty, 'zip') || '00000',
    shipToCountry:         partyField(filing.shipToParty, 'country') || 'US',

    // ── Booking Party (ISF-5 specific) ──
    // bookingPartyIdentifierCode: must be "1" (DUNS), "9" (DUNS+4), or "FR"
    // bookingPartyTaxID: must be DUNS format (NNNNNNNNN — 9 digits) when identifierCode is "1"
    // If no valid taxID is provided, we must NOT use identifierCode "1" because CC requires
    // a properly formatted 9-digit DUNS number.  Fall back to "FR" (free-form) which is more
    // lenient, and provide at least a placeholder taxID.
    bookingPartyIdentifierCode: (() => {
      const rawCode = isf5.bookingPartyIdentifierCode ?? '';
      const rawTaxId = (isf5.bookingPartyTaxID ?? '').replace(/[\-\s]/g, '');
      // If caller explicitly chose a code and provided a valid taxID, honour it
      if (['1','9','FR'].includes(rawCode) && rawTaxId.length >= 9) return rawCode;
      // If a 9+ digit taxID exists, default to DUNS
      if (rawTaxId.length >= 9) return '1';
      // Otherwise fall back to FR (free-form) so CC won't reject the empty/short taxID
      return 'FR';
    })(),
    bookingPartyTaxID: (() => {
      const rawTaxId = (isf5.bookingPartyTaxID ?? '').replace(/[\-\s]/g, '');
      const code = (() => {
        const rawCode = isf5.bookingPartyIdentifierCode ?? '';
        if (['1','9','FR'].includes(rawCode) && rawTaxId.length >= 9) return rawCode;
        if (rawTaxId.length >= 9) return '1';
        return 'FR';
      })();
      if (code === '1') return rawTaxId.slice(0, 9).padStart(9, '0');
      if (code === '9') return rawTaxId.slice(0, 13);
      // FR — free-form: use whatever we have, or a placeholder
      return rawTaxId || 'NA';
    })(),
    bookingPartyName:           sanitizeName(isf5.bookingPartyName ?? '', 35),
    bookingPartyAddress1:       sanitizeAddress(isf5.bookingPartyAddress1 ?? '') || 'NA',
    bookingPartyAddress2:       sanitizeAddress(isf5.bookingPartyAddress2 ?? '') || 'NA',
    bookingPartyCity:           isf5.bookingPartyCity ?? 'Unknown',
    bookingPartyCountry:        isf5.bookingPartyCountry ?? 'US',
    bookingPartyStateOrProvince: sanitizeState(isf5.bookingPartyStateOrProvince),
    bookingPartyPostalCode:     isf5.bookingPartyPostalCode ?? '00000',
    bookingPartyDateOfBirth:    isf5.bookingPartyDateOfBirth ?? '19900101',

    // ── References ──
    referenceCodeA:   '',
    referenceNumberA: '',
    referenceCodeB:   '',
    referenceNumberB: '',
    referenceCodeC:   '',
    referenceNumberC: '',

    // ── Shipments ──
    shipments,
  };

  return {
    type: 'isf-5',
    send: true,     // ISF-5: create and send in one step (CC /api/send has issues with ISF-5)
    sendAs: 'add',
    version: 2,
    body: [body],
  };
}

// ─── Unified Filing → CC Mapping ───────────────────────────

/**
 * Auto-detect filingType and call the correct CC mapping function.
 */
export function mapFilingToCCPayload(filing: any): CCDocumentCreatePayload {
  if (filing.filingType === 'ISF-5') {
    return mapFilingToISF5CC(filing);
  }
  return mapFilingToCC(filing);
}

// ─── CC API → Internal Mapping ─────────────────────────────

/**
 * Maps a CC API document response back to our internal Prisma-compatible format.
 */
export function mapCCToInternal(ccDoc: CCDocumentResponse): Record<string, any> {
  const b = ccDoc.body?.[0] ?? {};
  const firstShipment = b.shipments?.[0];
  const firstMfr = firstShipment?.manufacturer?.[0];
  const firstItem = firstMfr?.items?.[0];

  return {
    ccFilingId:     ccDoc._id ?? ccDoc.id,
    status:         mapCCStatus(ccDoc.status),
    importerName:   b.IORName || b.IORLastName,
    importerNumber: b.IORNumber,
    consigneeName:  b.consigneeName,
    consigneeNumber: b.consigneeTaxID,
    manufacturer: firstMfr ? {
      name:    firstMfr.manufacturerName,
      country: firstMfr.manufacturerCountry,
      address: {
        street: firstMfr.manufacturerAddress1,
        city:   firstMfr.manufacturerCity,
        state:  firstMfr.manufacturerStateOrProvince,
        zip:    firstMfr.manufacturerPostalCode,
      },
    } : undefined,
    seller: b.sellerName ? {
      name: b.sellerName,
      address: { street: b.sellerAddress1, city: b.sellerCity, state: b.sellerStateOrProvince, zip: b.sellerPostalCode, country: b.sellerCountry },
    } : undefined,
    buyer: b.buyerName ? {
      name: b.buyerName,
      address: { street: b.buyerAddress1, city: b.buyerCity, state: b.buyerStateOrProvince, zip: b.buyerPostalCode, country: b.buyerCountry },
    } : undefined,
    shipToParty: b.shipToName ? {
      name: b.shipToName,
      address: { street: b.shipToAddress1, city: b.shipToCity, state: b.shipToStateOrProvince, zip: b.shipToPostalCode, country: b.shipToCountry },
    } : undefined,
    containerStuffingLocation: b.containerStuffingLocationName ? {
      name: b.containerStuffingLocationName,
      address: { street: b.containerStuffingLocationAddress1, city: b.containerStuffingLocationCity },
    } : undefined,
    consolidator: b.consolidatorName ? {
      name: b.consolidatorName,
      address: { street: b.consolidatorAddress1, city: b.consolidatorCity },
    } : undefined,
    masterBol: b.masterBOLNumber || (b.billType === 'MASTER' ? b.BOLNumber : undefined),
    houseBol:  b.billType === 'HOUSE'  ? b.BOLNumber : undefined,
    commodities: firstMfr?.items?.map((item: any) => ({
      htsCode:         item['commodityHTS-6Number'] ?? item.commodityHTS6Number,
      countryOfOrigin: item.countryOfOrigin,
      description:     item.description,
      quantity:        item.estimatedQuantity != null ? Number(item.estimatedQuantity) : undefined,
      weight:          item.estimatedWeight != null ? { value: Number(item.estimatedWeight), unit: item.weightUOM ?? 'K' } : undefined,
    })) ?? [],
    containers: firstShipment?.containerNumber
      ? [{ number: firstShipment.containerNumber, type: firstShipment.containerType }]
      : [],
  };
}

function mapCCStatus(ccStatus?: string): string {
  if (!ccStatus) return 'draft';
  const lower = ccStatus.toLowerCase();
  if (lower.includes('accept') || lower.includes('approved')) return 'accepted';
  if (lower.includes('reject') || lower.includes('denied')) return 'rejected';
  if (lower.includes('hold')) return 'on_hold';
  if (lower.includes('sent') || lower.includes('submit') || lower.includes('pending')) return 'submitted';
  return 'draft';
}

// ─── Retry Configuration ───────────────────────────────────

interface RetryConfig {
  maxRetries: number;
  baseDelayMs: number;
  maxDelayMs: number;
  retryableStatuses: number[];
}

const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  baseDelayMs: 1000,     // 1s → 2s → 4s exponential backoff
  maxDelayMs: 10000,     // Cap at 10s
  retryableStatuses: [408, 429, 500, 502, 503, 504], // Timeout, rate-limit, server errors
};

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ─── CustomsCity API Client ────────────────────────────────

export class CustomsCityClient {
  private baseUrl: string;
  private token: string;
  private retryConfig: RetryConfig;

  constructor(baseUrl?: string, token?: string, retryConfig?: Partial<RetryConfig>) {
    this.baseUrl = baseUrl ?? env.CC_API_BASE_URL;
    this.token = token ?? env.CC_API_TOKEN ?? '';
    this.retryConfig = { ...DEFAULT_RETRY_CONFIG, ...retryConfig };
  }

  private async request<T = any>(
    method: string,
    path: string,
    body?: any,
    params?: Record<string, string | string[] | number | undefined>,
    retryCount = 0
  ): Promise<{ data: T; status: number; latencyMs: number }> {
    const url = new URL(path, this.baseUrl);
    if (params) {
      Object.entries(params).forEach(([k, v]) => {
        if (v === undefined || v === null) return;
        if (Array.isArray(v)) {
          v.forEach((item) => {
            if (item !== undefined && item !== null) {
              url.searchParams.append(k, String(item));
            }
          });
        } else {
          url.searchParams.set(k, String(v));
        }
      });
    }

    const start = Date.now();

    try {
      const response = await fetch(url.toString(), {
        method,
        headers: {
          'Authorization': `Bearer ${this.token}`,
          'Content-Type': 'application/json',
        },
        body: body ? JSON.stringify(body) : undefined,
        signal: AbortSignal.timeout(30_000), // 30s timeout
      });

      const latencyMs = Date.now() - start;

      // Check for Retry-After header (rate limiting)
      const retryAfter = response.headers.get('Retry-After');

      // Retry on retryable status codes
      if (
        this.retryConfig.retryableStatuses.includes(response.status) &&
        retryCount < this.retryConfig.maxRetries
      ) {
        const delay = retryAfter
          ? parseInt(retryAfter) * 1000
          : Math.min(
              this.retryConfig.baseDelayMs * Math.pow(2, retryCount),
              this.retryConfig.maxDelayMs
            );
        logger.warn({ method, path, attempt: retryCount + 1, maxRetries: this.retryConfig.maxRetries, status: response.status, delay }, '[CC API] Retrying after error response');
        await sleep(delay);
        return this.request<T>(method, path, body, params, retryCount + 1);
      }

      const data = await response.json().catch(() => ({})) as T;
      return { data, status: response.status, latencyMs };
    } catch (err: any) {
      // Retry on network errors (timeout, DNS, connection refused)
      if (retryCount < this.retryConfig.maxRetries && (
        err.name === 'TimeoutError' ||
        err.name === 'AbortError' ||
        err.code === 'ECONNREFUSED' ||
        err.code === 'ENOTFOUND' ||
        err.cause?.code === 'ECONNRESET'
      )) {
        const delay = Math.min(
          this.retryConfig.baseDelayMs * Math.pow(2, retryCount),
          this.retryConfig.maxDelayMs
        );
        logger.warn({ method, path, attempt: retryCount + 1, maxRetries: this.retryConfig.maxRetries, delay, err: err.message }, '[CC API] Retrying after network error');
        await sleep(delay);
        return this.request<T>(method, path, body, params, retryCount + 1);
      }
      throw err;
    }
  }

  // ── ISF Document CRUD ──

  /**
   * Create a new ISF document.
   *
   * CORRECT endpoint: POST /api/documents  (NOT /api/documents/isf!)
   * The /api/documents/isf sub-route runs a stricter validator that always
   * returns validation errors as an array without persisting.
   *
   * Payload must include: { type: "isf", send, sendAs, version, body: [...] }
   *
   * Success response:  { code: "200", message: "Document Created", processId: "..." }
   * Duplicate BOL:     HTTP 400 { errors: '{"BOLValidations":{"BOL Numbers already exist":[...]}}' }
   * Validation fail:   HTTP 201 + Array of { message, field? } (from /isf sub-route only)
   */
  async createDocument(payload: CCDocumentCreatePayload): Promise<{
    data: CCDocumentResponse;
    status: number;
    latencyMs: number;
    validationErrors?: Array<{ field?: string; message: string }>;
    persisted: boolean;
    processId?: string;
  }> {
    const result = await this.request<any>('POST', '/api/documents', payload);

    // Success: { code: "200", message: "Document Created", processId: "..." }
    if (result.data?.code === '200' || result.data?.processId) {
      return {
        data: result.data as CCDocumentResponse,
        status: result.status,
        latencyMs: result.latencyMs,
        validationErrors: undefined,
        persisted: true,
        processId: result.data.processId,
      };
    }

    // Duplicate BOL error or validation errors: HTTP 400 { errors: '{"BOLValidations":...}' }
    if (result.status === 400 && result.data?.errors) {
      const errDetail = typeof result.data.errors === 'string'
        ? result.data.errors
        : JSON.stringify(result.data.errors);

      // Parse the nested JSON errors string to extract individual validation messages
      let parsedErrors: Array<{ field?: string; message: string }> = [];
      try {
        const errObj = typeof result.data.errors === 'string'
          ? JSON.parse(result.data.errors)
          : result.data.errors;
        // CC errors format: { "MBOLNumber: X - HBOLNumber: Y": ["err1", "err2"], "ISFValidations": ["err3"] }
        for (const [key, msgs] of Object.entries(errObj)) {
          if (Array.isArray(msgs)) {
            for (const msg of msgs) {
              parsedErrors.push({ field: key, message: String(msg) });
            }
          } else {
            parsedErrors.push({ field: key, message: String(msgs) });
          }
        }
      } catch {
        // Fallback: single error with full detail string
        parsedErrors = [{ message: result.data.message || errDetail, field: 'validation' }];
      }

      return {
        data: result.data as CCDocumentResponse,
        status: result.status,
        latencyMs: result.latencyMs,
        validationErrors: parsedErrors,
        persisted: false,
      };
    }

    // Validation array (from /isf sub-route or unexpected format)
    if (Array.isArray(result.data)) {
      return {
        data: {} as CCDocumentResponse,
        status: result.status,
        latencyMs: result.latencyMs,
        validationErrors: result.data as Array<{ field?: string; message: string }>,
        persisted: false,
      };
    }

    // Legacy: document object with _id
    if (result.data?._id || result.data?.id) {
      return {
        ...result,
        validationErrors: undefined,
        persisted: true,
        processId: result.data._id || result.data.id,
      };
    }

    // Unknown response
    return {
      ...result,
      validationErrors: undefined,
      persisted: false,
    };
  }

  /**
   * Send an already-created document to CBP for processing.
   */
  async sendDocument(payload: { documentId?: string; documentIds?: string[]; [key: string]: any }): Promise<{ data: any; status: number; latencyMs: number }> {
    return this.request('POST', '/api/send', payload);
  }

  /**
   * List ISF documents within a date range.
   */
  async listDocuments(dateFrom: string, dateTo: string, skip = 0): Promise<CCListResponse> {
    const { data } = await this.request<CCListResponse>('GET', '/api/documents', undefined, {
      type: 'ISF',
      dateFrom,
      dateTo,
      skip: String(skip),
    });
    return data;
  }

  /**
   * Get document status. Requires manifestType + at least one BOL filter.
   */
  async getDocumentStatus(params?: Record<string, string>): Promise<{ data: any; status: number; latencyMs: number }> {
    return this.request('GET', '/api/document-status', undefined, params);
  }

  /**
   * Get CBP response messages.
   */
  async getMessages(params?: Record<string, string>): Promise<{ data: any; status: number; latencyMs: number }> {
    return this.request('GET', '/api/messages', undefined, params);
  }

  // ── AI & Utility Endpoints ──

  /**
   * AI-powered HTS classification.
   * CC API expects: { items: [{ description: "…" }] }
   * Returns:        { items: [{ description, hts_code, explanation }] }
   */
  async classifyHTS(description: string): Promise<{ data: CCHTSClassifyResponse; status: number; latencyMs: number }> {
    return this.request<CCHTSClassifyResponse>('POST', '/api/hts-classifier', {
      items: [{ description }],
    });
  }

  /**
   * MID (Manufacturer ID) lookup.
   */
  async getMIDList(): Promise<{ data: any; status: number; latencyMs: number }> {
    return this.request('GET', '/api/query/mid/list');
  }

  /**
   * Duty/tariff calculation.
   */
  async calculateDuty(payload: any): Promise<{ data: any; status: number; latencyMs: number }> {
    return this.request('POST', '/api/duty-calculation-tool', payload);
  }

  // ── Connectivity ──

  // ── Manifest Query ───────────────────────────────────────

  async createManifestQuery(payload: CCManifestQueryPayload) {
    return this.request<CCManifestQueryCreateResponse>('POST', '/api/manifest-query', payload);
  }

  async getManifestQueryById(requestId: string) {
    return this.request<CCManifestQueryResult>('GET', `/api/ManifestQueryByID/${requestId}`);
  }

  async getManifestQueryLatest() {
    return this.request<CCManifestQueryResult>('GET', '/api/ManifestQueryLatestResponse');
  }

  // ── ABI Documents (Entry Summary 7501 + Cargo Release 3461) ────

  /**
   * Create an ABI document on CustomsCity. Idempotency is owned by the caller
   * (correlationId is our internal AbiDocument.id).
   */
  async createABIDocument(
    payload: CCABICreateDocumentPayload
  ): Promise<{ data: any; status: number; latencyMs: number }> {
    return this.request('POST', '/api/abi/documents', payload);
  }

  /**
   * List ABI documents on CustomsCity. Array filters (entryNumber,
   * masterBOLNumber, houseBOLNumber) are sent as repeated query params per
   * FeathersJS `$in` convention — the widened `request` params loop handles
   * the repetition.
   */
  async listABIDocuments(
    params: CCABIListParams
  ): Promise<{ data: CCABIListResponse; status: number; latencyMs: number }> {
    const query: Record<string, string | string[] | number | undefined> = {
      dateFrom: params.dateFrom,
      dateTo: params.dateTo,
      entryType: params.entryType,
      skip: params.skip ?? 0,
    };
    if (params.status) query.status = params.status;
    if (params.houseBOLNumber && params.houseBOLNumber.length > 0) {
      query.houseBOLNumber = params.houseBOLNumber;
    }
    if (params.masterBOLNumber && params.masterBOLNumber.length > 0) {
      query.masterBOLNumber = params.masterBOLNumber;
    }
    if (params.entryNumber && params.entryNumber.length > 0) {
      query.entryNumber = params.entryNumber;
    }
    return this.request<CCABIListResponse>('GET', '/api/abi/documents', undefined, query);
  }

  /**
   * Delete an ABI document on CustomsCity. Exactly one of entryNumber or
   * mbolNumber should be provided (CC uses kebab-case for these params).
   */
  async deleteABIDocument(
    params: CCABIDeleteParams
  ): Promise<{ data: any; status: number; latencyMs: number }> {
    const query: Record<string, string | undefined> = {};
    if (params.entryNumber) query['entry-number'] = params.entryNumber;
    if (params.mbolNumber) query['mbol-number'] = params.mbolNumber;
    return this.request('DELETE', '/api/abi/documents', undefined, query);
  }

  /**
   * Transmit a previously-created ABI document to CBP via
   * `POST /api/abi/send`. Phase 1 only uses action='add' with application
   * 'entry-summary-cargo-release'.
   */
  async sendABIDocument(
    payload: CCABISendPayload
  ): Promise<{ data: any; status: number; latencyMs: number }> {
    return this.request('POST', '/api/abi/send', payload);
  }

  /**
   * Verify the CC API connection and token validity.
   * Uses a lightweight document listing call — if it returns 200, we're connected.
   */
  async testConnection(): Promise<boolean> {
    try {
      const { status } = await this.request('GET', '/api/documents', undefined, {
        type: 'ISF',
        dateFrom: '2025-01-01',
        dateTo: '2026-12-31',
        skip: '0',
      });
      return status === 200;
    } catch {
      return false;
    }
  }
}

// ─── Singleton ─────────────────────────────────────────────

export const ccClient = new CustomsCityClient();
