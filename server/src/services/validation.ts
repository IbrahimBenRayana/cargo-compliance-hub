/**
 * Filing Validation Engine
 * 
 * Comprehensive validation matching CBP ISF requirements:
 * - HTS code format (6-10 digit, valid prefix ranges)
 * - SCAC code (exactly 4 uppercase letters)
 * - ISO 3166-1 alpha-2 country codes
 * - US port codes (Schedule D codes)
 * - Date logic (departure > today, arrival > departure, deadline checks)
 * - Required field completeness per ISF-10 vs ISF-5
 * - Address completeness for party information
 * - Bill of Lading format validation
 */

// ─── Types ─────────────────────────────────────────────────

export interface ValidationError {
  field: string;
  code: string;
  message: string;
  severity: 'critical' | 'warning' | 'info';
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  score: number;         // 0-100 compliance score
  criticalCount: number;
  warningCount: number;
  infoCount: number;
}

// ─── Reference Data ────────────────────────────────────────

// ISO 3166-1 alpha-2 country codes (complete set)
const VALID_COUNTRY_CODES = new Set([
  'AF','AL','DZ','AS','AD','AO','AG','AR','AM','AU','AT','AZ','BS','BH','BD','BB',
  'BY','BE','BZ','BJ','BM','BT','BO','BA','BW','BR','BN','BG','BF','BI','KH','CM',
  'CA','CV','CF','TD','CL','CN','CO','KM','CG','CD','CR','CI','HR','CU','CY','CZ',
  'DK','DJ','DM','DO','EC','EG','SV','GQ','ER','EE','SZ','ET','FJ','FI','FR','GA',
  'GM','GE','DE','GH','GR','GD','GT','GN','GW','GY','HT','HN','HK','HU','IS','IN',
  'ID','IR','IQ','IE','IL','IT','JM','JP','JO','KZ','KE','KI','KP','KR','KW','KG',
  'LA','LV','LB','LS','LR','LY','LI','LT','LU','MO','MG','MW','MY','MV','ML','MT',
  'MH','MR','MU','MX','FM','MD','MC','MN','ME','MA','MZ','MM','NA','NR','NP','NL',
  'NZ','NI','NE','NG','MK','NO','OM','PK','PW','PS','PA','PG','PY','PE','PH','PL',
  'PT','QA','RO','RU','RW','KN','LC','VC','WS','SM','ST','SA','SN','RS','SC','SL',
  'SG','SK','SI','SB','SO','ZA','SS','ES','LK','SD','SR','SE','CH','SY','TW','TJ',
  'TZ','TH','TL','TG','TO','TT','TN','TR','TM','TV','UG','UA','AE','GB','US','UY',
  'UZ','VU','VE','VN','YE','ZM','ZW',
]);

// CBP Schedule D port codes used to be hand-listed here; we now enforce
// format only (4-digit CBP or 5-letter UN/LOCODE) since maintaining a
// complete list is brittle and CC enforces the membership check anyway.

// ─── Validation Rules ──────────────────────────────────────

function validateHTSCode(htsCode: string, fieldPath: string): ValidationError[] {
  const errors: ValidationError[] = [];
  if (!htsCode) {
    errors.push({ field: fieldPath, code: 'MISSING_FIELD', message: 'HTS code is required', severity: 'critical' });
    return errors;
  }

  // Strip dots and spaces for digit check
  const digits = htsCode.replace(/[\.\-\s]/g, '');

  if (!/^\d+$/.test(digits)) {
    errors.push({ field: fieldPath, code: 'INVALID_FORMAT', message: 'HTS code must contain only digits (dots/dashes allowed as separators)', severity: 'critical' });
    return errors;
  }

  if (digits.length < 6) {
    errors.push({ field: fieldPath, code: 'INVALID_FORMAT', message: 'HTS code must be at least 6 digits', severity: 'critical' });
  } else if (digits.length > 10) {
    errors.push({ field: fieldPath, code: 'INVALID_FORMAT', message: 'HTS code cannot exceed 10 digits', severity: 'warning' });
  }

  // Chapter range check (01-99 are valid HTS chapters)
  const chapter = parseInt(digits.substring(0, 2));
  if (chapter < 1 || chapter > 99) {
    errors.push({ field: fieldPath, code: 'INVALID_HTS_CHAPTER', message: `HTS chapter ${chapter} is not valid (must be 01-99)`, severity: 'critical' });
  }

  return errors;
}

function validateCountryCode(code: string, fieldPath: string, fieldLabel: string): ValidationError[] {
  const errors: ValidationError[] = [];
  if (!code) {
    errors.push({ field: fieldPath, code: 'MISSING_FIELD', message: `${fieldLabel} is required`, severity: 'critical' });
    return errors;
  }

  const upper = code.toUpperCase().trim();
  if (upper.length !== 2) {
    errors.push({ field: fieldPath, code: 'INVALID_FORMAT', message: `${fieldLabel} must be a 2-letter ISO country code (e.g., US, CN, DE)`, severity: 'critical' });
  } else if (!VALID_COUNTRY_CODES.has(upper)) {
    errors.push({ field: fieldPath, code: 'INVALID_COUNTRY', message: `"${upper}" is not a valid ISO 3166-1 country code`, severity: 'critical' });
  }

  return errors;
}

function validateSCACCode(scac: string | null | undefined): ValidationError[] {
  const errors: ValidationError[] = [];
  if (!scac) {
    errors.push({ field: 'scacCode', code: 'MISSING_FIELD', message: 'SCAC (Standard Carrier Alpha Code) is required for submission', severity: 'warning' });
    return errors;
  }

  if (!/^[A-Z]{4}$/.test(scac.toUpperCase().trim())) {
    errors.push({ field: 'scacCode', code: 'INVALID_FORMAT', message: 'SCAC code must be exactly 4 uppercase letters (e.g., MAEU, CMDU, HLCU)', severity: 'critical' });
  }

  return errors;
}

function validatePortCode(port: string | null | undefined, fieldPath: string, fieldLabel: string): ValidationError[] {
  const errors: ValidationError[] = [];
  if (!port) {
    errors.push({ field: fieldPath, code: 'MISSING_FIELD', message: `${fieldLabel} is required`, severity: 'warning' });
    return errors;
  }

  const trimmed = port.trim().toUpperCase();
  // CBP Schedule D port codes are exactly 4 digits (e.g., "2704" = Houston).
  // UN/LOCODEs are 5 letters (e.g., "USLAX" = Los Angeles).
  // Anything else is rejected. This is `critical` severity now (was 'warning')
  // because CC's allowed-values list is fixed and a freeform port string
  // produces a CC error the user can't act on.
  const isCbpFourDigit = /^\d{4}$/.test(trimmed);
  const isUnLocodeFive = /^[A-Z]{5}$/.test(trimmed);
  if (!isCbpFourDigit && !isUnLocodeFive) {
    errors.push({
      field:    fieldPath,
      code:     'INVALID_FORMAT',
      message:  `${fieldLabel} must be a 4-digit CBP port code (e.g., "2704") or a 5-letter UN/LOCODE (e.g., "USLAX"). Received: "${port}"`,
      severity: 'critical',
    });
  }

  return errors;
}

// Accepted commodity weight UOM per CustomsCity: 'K' (kilograms) or 'L' (pounds).
// 'KG' / 'LB' / freeform text is rejected by CC; we catch it here so the user
// gets an inline error instead of a CC-flavored 400.
function validateWeightUnit(unit: string | null | undefined, fieldPath: string, commodityIndex: number): ValidationError[] {
  if (!unit) return []; // weight itself optional; missing unit only matters when weight present
  const trimmed = unit.trim().toUpperCase();
  if (trimmed !== 'K' && trimmed !== 'L') {
    return [{
      field:    fieldPath,
      code:     'INVALID_FORMAT',
      message:  `Commodity ${commodityIndex + 1} weight unit must be "K" (kilograms) or "L" (pounds). Received: "${unit}"`,
      severity: 'critical',
    }];
  }
  return [];
}

function validateBillOfLading(bol: string | null | undefined, fieldPath: string): ValidationError[] {
  const errors: ValidationError[] = [];
  if (!bol) return errors;

  const trimmed = bol.trim();
  if (trimmed.length < 4 || trimmed.length > 50) {
    errors.push({ field: fieldPath, code: 'INVALID_FORMAT', message: 'Bill of Lading number should be 4-50 characters', severity: 'warning' });
  }

  // BOL should be alphanumeric (with some separators allowed)
  if (!/^[A-Za-z0-9\-\/\.]+$/.test(trimmed)) {
    errors.push({ field: fieldPath, code: 'INVALID_FORMAT', message: 'Bill of Lading contains invalid characters (only letters, digits, -, /, . allowed)', severity: 'warning' });
  }

  return errors;
}

function validateDateLogic(filing: any): ValidationError[] {
  const errors: ValidationError[] = [];
  const now = new Date();

  const departure = filing.estimatedDeparture ? new Date(filing.estimatedDeparture) : null;
  const arrival = filing.estimatedArrival ? new Date(filing.estimatedArrival) : null;
  const deadline = filing.filingDeadline ? new Date(filing.filingDeadline) : null;

  if (!departure) {
    errors.push({ field: 'estimatedDeparture', code: 'MISSING_FIELD', message: 'Estimated departure date is required', severity: 'warning' });
  }

  if (!arrival) {
    errors.push({ field: 'estimatedArrival', code: 'MISSING_FIELD', message: 'Estimated arrival date is required', severity: 'warning' });
  }

  if (departure && arrival && arrival <= departure) {
    errors.push({ field: 'estimatedArrival', code: 'INVALID_DATE_RANGE', message: 'Arrival date must be after departure date', severity: 'critical' });
  }

  if (departure && departure < now) {
    errors.push({ field: 'estimatedDeparture', code: 'DATE_IN_PAST', message: 'Departure date is in the past — ISF must be filed before departure', severity: 'warning' });
  }

  if (deadline && deadline < now) {
    errors.push({ field: 'filingDeadline', code: 'DEADLINE_PASSED', message: 'Filing deadline has already passed! Immediate action required', severity: 'critical' });
  } else if (deadline) {
    const hoursUntilDeadline = (deadline.getTime() - now.getTime()) / (1000 * 60 * 60);
    if (hoursUntilDeadline < 24) {
      errors.push({ field: 'filingDeadline', code: 'DEADLINE_IMMINENT', message: `Filing deadline is in less than 24 hours (${Math.round(hoursUntilDeadline)}h remaining)`, severity: 'warning' });
    }
  }

  return errors;
}

function validateParty(party: any, fieldPath: string, fieldLabel: string, required: boolean): ValidationError[] {
  const errors: ValidationError[] = [];

  if (!party) {
    if (required) {
      errors.push({ field: fieldPath, code: 'MISSING_FIELD', message: `${fieldLabel} is required`, severity: 'critical' });
    }
    return errors;
  }

  // If it's an array, validate the first element
  if (Array.isArray(party)) {
    if (party.length === 0) {
      if (required) {
        errors.push({ field: fieldPath, code: 'MISSING_FIELD', message: `${fieldLabel} is required`, severity: 'critical' });
      }
      return errors;
    }
    return validateParty(party[0], `${fieldPath}[0]`, fieldLabel, required);
  }

  // Accept string (legacy JSON string or plain name)
  if (typeof party === 'string') {
    const trimmed = party.trim();
    if (trimmed.length === 0) {
      if (required) {
        errors.push({ field: fieldPath, code: 'MISSING_FIELD', message: `${fieldLabel} name cannot be empty`, severity: 'critical' });
      }
      return errors;
    }
    // Try to parse JSON string
    if (trimmed.startsWith('{')) {
      try {
        const parsed = JSON.parse(trimmed);
        return validateParty(parsed, fieldPath, fieldLabel, required);
      } catch {
        // Not valid JSON — treat as a plain name string, which is valid
      }
    }
    return errors;
  }

  // Object format — validate fields
  if (!party.name || String(party.name).trim().length === 0) {
    errors.push({ field: `${fieldPath}.name`, code: 'MISSING_FIELD', message: `${fieldLabel} name is required`, severity: 'critical' });
  }

  // Address completeness check (info-level for addresses)
  if (!party.country && !party.address?.country) {
    errors.push({ field: `${fieldPath}.country`, code: 'INCOMPLETE_ADDRESS', message: `${fieldLabel} country is recommended for faster CBP processing`, severity: 'info' });
  } else {
    const country = party.country || party.address?.country;
    if (country && !VALID_COUNTRY_CODES.has(country.toUpperCase().trim())) {
      errors.push({ field: `${fieldPath}.country`, code: 'INVALID_COUNTRY', message: `${fieldLabel} country "${country}" is not a valid ISO code`, severity: 'warning' });
    }
  }

  return errors;
}

// ─── Main Validation Function ──────────────────────────────

export function validateFiling(filing: any): ValidationResult {
  const errors: ValidationError[] = [];

  const isISF10 = filing.filingType === 'ISF-10';

  // ── ISF 10+2 Party Fields (all 8 parties required) ──────
  if (isISF10) {
    errors.push(...validateParty(filing.manufacturer, 'manufacturer', 'Manufacturer', true));
    errors.push(...validateParty(filing.seller, 'seller', 'Seller', true));
    errors.push(...validateParty(filing.buyer, 'buyer', 'Buyer', true));
    errors.push(...validateParty(filing.shipToParty, 'shipToParty', 'Ship-To Party', true));
    errors.push(...validateParty(filing.containerStuffingLocation, 'containerStuffingLocation', 'Container Stuffing Location', true));
    errors.push(...validateParty(filing.consolidator, 'consolidator', 'Consolidator', true));

    // Importer of Record
    if (!filing.importerNumber) {
      errors.push({ field: 'importerNumber', code: 'MISSING_FIELD', message: 'Importer of Record number is required', severity: 'critical' });
    }
    if (!filing.importerName) {
      errors.push({ field: 'importerName', code: 'MISSING_FIELD', message: 'Importer of Record name is required', severity: 'warning' });
    }

    // Consignee
    if (!filing.consigneeNumber) {
      errors.push({ field: 'consigneeNumber', code: 'MISSING_FIELD', message: 'Consignee number is required', severity: 'warning' });
    }
  }

  // ── ISF 5 specific (carrier-filed) ──────────────────────
  if (filing.filingType === 'ISF-5') {
    const isf5 = filing.isf5Data ?? {};

    // Booking Party is required for ISF-5
    if (!isf5.bookingPartyName) {
      errors.push({ field: 'isf5Data.bookingPartyName', code: 'MISSING_FIELD', message: 'Booking Party name is required for ISF-5', severity: 'critical' });
    }
    if (!isf5.bookingPartyCountry) {
      errors.push({ field: 'isf5Data.bookingPartyCountry', code: 'MISSING_FIELD', message: 'Booking Party country is required for ISF-5', severity: 'warning' });
    }

    // ISF Filer is required for ISF-5 (carrier/NVOCC)
    if (!isf5.ISFFilerName && !filing.importerName) {
      errors.push({ field: 'isf5Data.ISFFilerName', code: 'MISSING_FIELD', message: 'ISF Filer name is required for ISF-5', severity: 'critical' });
    }
    if (!isf5.ISFFilerNumber && !filing.importerNumber) {
      errors.push({ field: 'isf5Data.ISFFilerNumber', code: 'MISSING_FIELD', message: 'ISF Filer number (EIN) is required for ISF-5', severity: 'critical' });
    }

    // Ship-To Party required — check top-level party OR isf5Data
    if (!filing.shipToParty && !isf5.shipToName) {
      errors.push({ field: 'shipToParty', code: 'MISSING_FIELD', message: 'Ship-To Party is required for ISF-5', severity: 'critical' });
    } else if (filing.shipToParty) {
      errors.push(...validateParty(filing.shipToParty, 'shipToParty', 'Ship-To Party', true));
    }

    // Manufacturer required — check top-level party field
    if (!filing.manufacturer) {
      errors.push({ field: 'manufacturer', code: 'MISSING_FIELD', message: 'Manufacturer / Supplier is required for ISF-5', severity: 'critical' });
    } else {
      errors.push(...validateParty(filing.manufacturer, 'manufacturer', 'Manufacturer', true));
    }
  }

  // ── Commodities (both types) ────────────────────────────
  const commodities = Array.isArray(filing.commodities) ? filing.commodities : [];
  if (commodities.length === 0) {
    errors.push({ field: 'commodities', code: 'MISSING_FIELD', message: 'At least one commodity line is required', severity: 'critical' });
  } else {
    commodities.forEach((c: any, i: number) => {
      const prefix = `commodities[${i}]`;
      errors.push(...validateHTSCode(c.htsCode || c.htsNumber, `${prefix}.htsCode`));
      errors.push(...validateCountryCode(c.countryOfOrigin, `${prefix}.countryOfOrigin`, `Commodity ${i + 1} country of origin`));

      // Description length: CC schema rejects > 45 chars on `description`.
      // Empty is `info`-level (recommended); over-length is `critical` (CC blocks).
      const desc = (c.description ?? '').toString();
      if (desc.trim().length === 0) {
        errors.push({ field: `${prefix}.description`, code: 'MISSING_FIELD', message: `Commodity ${i + 1}: Description is recommended`, severity: 'info' });
      } else if (desc.length > 45) {
        errors.push({
          field:    `${prefix}.description`,
          code:     'INVALID_FORMAT',
          message:  `Commodity ${i + 1}: Description must be 45 characters or fewer (currently ${desc.length}). Shorten or split into multiple lines.`,
          severity: 'critical',
        });
      }

      // Weight unit: CC accepts only K (kilograms) or L (pounds). Anything
      // else (KG, LB, lbs, etc.) is rejected.
      if (c.weight && c.weight.unit !== undefined && c.weight.unit !== null) {
        errors.push(...validateWeightUnit(c.weight.unit, `${prefix}.weight.unit`, i));
      }
    });
  }

  // ── Containers ──────────────────────────────────────────
  const containers = Array.isArray(filing.containers) ? filing.containers : [];
  containers.forEach((c: any, i: number) => {
    const num = c.number || c.containerNumber || '';
    if (num && !/^[A-Z]{4}\d{7}$/i.test(num.replace(/[\s\-]/g, ''))) {
      errors.push({
        field: `containers[${i}].number`,
        code: 'INVALID_FORMAT',
        message: `Container ${i + 1}: "${num}" doesn't match ISO 6346 format (4 letters + 7 digits, e.g., MSCU1234567)`,
        severity: 'warning',
      });
    }
  });

  // ── Shipment Details ────────────────────────────────────
  if (!filing.masterBol && !filing.houseBol) {
    errors.push({ field: 'masterBol', code: 'MISSING_FIELD', message: 'Master or House Bill of Lading is required', severity: 'critical' });
  }
  if (filing.masterBol) {
    errors.push(...validateBillOfLading(filing.masterBol, 'masterBol'));
  }
  if (filing.houseBol) {
    errors.push(...validateBillOfLading(filing.houseBol, 'houseBol'));
  }

  if (!filing.vesselName && isISF10) {
    errors.push({ field: 'vesselName', code: 'MISSING_FIELD', message: 'Vessel name is required', severity: 'warning' });
  }

  if (isISF10) {
    errors.push(...validateSCACCode(filing.scacCode));
    errors.push(...validatePortCode(filing.foreignPortOfUnlading, 'foreignPortOfUnlading', 'Foreign port of unlading'));
    // placeOfDelivery is NOT required by CC API when isFROB=false — downgrade to info
    if (!filing.placeOfDelivery) {
      errors.push({ field: 'placeOfDelivery', code: 'MISSING_FIELD', message: 'Place of delivery is optional for non-FROB shipments', severity: 'info' });
    }
    errors.push(...validateDateLogic(filing));
  } else {
    // ISF-5: check USPortOfArrival from isf5Data
    const isf5 = filing.isf5Data ?? {};
    const isf5Port = isf5.USPortOfArrival || filing.foreignPortOfUnlading;
    if (!isf5Port) {
      errors.push({ field: 'isf5Data.USPortOfArrival', code: 'MISSING_FIELD', message: 'US Port of Arrival is required for ISF-5', severity: 'warning' });
    }
    // ISF-5: check estimated arrival from isf5Data or filing
    const isf5Arrival = isf5.estimateDateOfArrival || filing.estimatedArrival;
    if (!isf5Arrival) {
      errors.push({ field: 'isf5Data.estimateDateOfArrival', code: 'MISSING_FIELD', message: 'Estimated date of arrival is required for ISF-5', severity: 'warning' });
    }
  }

  // ── Calculate Score ─────────────────────────────────────
  const criticalCount = errors.filter(e => e.severity === 'critical').length;
  const warningCount = errors.filter(e => e.severity === 'warning').length;
  const infoCount = errors.filter(e => e.severity === 'info').length;

  // Score: start at 100, deduct 15 per critical, 5 per warning, 1 per info
  const score = Math.max(0, Math.min(100, 100 - (criticalCount * 15) - (warningCount * 5) - (infoCount * 1)));

  return {
    valid: criticalCount === 0,
    errors,
    score,
    criticalCount,
    warningCount,
    infoCount,
  };
}

// ─── Status State Machine ──────────────────────────────────

const VALID_TRANSITIONS: Record<string, string[]> = {
  draft:       ['submitted', 'cancelled'],
  submitted:   ['pending_cbp', 'accepted', 'rejected', 'on_hold'],
  pending_cbp: ['accepted', 'rejected', 'on_hold'],
  accepted:    ['amended'],            // Can only amend after acceptance
  rejected:    ['draft', 'submitted'], // Can edit (→draft) or directly resubmit (→submitted)
  on_hold:     ['accepted', 'rejected'],
  amended:     ['submitted', 'pending_cbp', 'accepted', 'rejected'],
  cancelled:   [],                     // Terminal state
};

export function isValidTransition(from: string, to: string): boolean {
  return VALID_TRANSITIONS[from]?.includes(to) ?? false;
}

export function getAllowedTransitions(status: string): string[] {
  return VALID_TRANSITIONS[status] ?? [];
}
