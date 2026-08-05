/**
 * CustomsCity ISF wire types — ISF-10 + ISF-5 request/response shapes plus
 * the shared document/list/HTS-classify response envelopes.
 *
 * Extracted from services/customscity.ts (Phase 0.4 split — see
 * docs/abi-engine/MIGRATION_PLAN.md). Field names use the EXACT casing from
 * the official CC API examples; see docs/CUSTOMSCITY_API.md.
 */

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

