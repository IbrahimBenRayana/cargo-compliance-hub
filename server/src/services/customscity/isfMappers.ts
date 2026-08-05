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

import type {
  CCDocumentCreatePayload,
  CCDocumentResponse,
  CCISF5DocumentBody,
  CCISF5Shipment,
  CCISFDocumentBody,
  CCItem,
  CCManufacturerWithItems,
  CCShipment,
} from './isfTypes.js';
import {
  formatTaxId,
  partyField,
  sanitizeAddress,
  sanitizeName,
  sanitizeState,
  toYYYYMMDDString,
} from './helpers.js';

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
    // CC's `commodityHTS-6Number` field is — by name and validator —
    // strictly the 6-digit HS prefix. Strip separators and clamp to 6
    // digits regardless of what's in our DB (we store the full 10
    // digits so the duty calculator can reuse them).
    'commodityHTS-6Number': String(c.htsCode ?? c.htsNumber ?? c.commodityHTS6Number ?? '').replace(/\D/g, '').slice(0, 6),
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
    // CC's `commodityHTS-6Number` field is — by name and validator —
    // strictly the 6-digit HS prefix. Strip separators and clamp to 6
    // digits regardless of what's in our DB (we store the full 10
    // digits so the duty calculator can reuse them).
    'commodityHTS-6Number': String(c.htsCode ?? c.htsNumber ?? c.commodityHTS6Number ?? '').replace(/\D/g, '').slice(0, 6),
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

