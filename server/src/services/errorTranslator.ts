/**
 * Error Translator — Converts raw CBP/API validation errors into
 * clear, human-readable messages with actionable fix instructions.
 *
 * Users should never see internal API field names or cryptic codes.
 */

// ─── Field Name Mapping ───────────────────────────────────
const FIELD_LABELS: Record<string, string> = {
  // BOL & Filing
  masterBOLNumber: 'Master Bill of Lading',
  MBOLNumber: 'Master Bill of Lading',
  BOLNumber: 'House Bill of Lading',
  HBOLNumber: 'House Bill of Lading',
  billType: 'Bill Type',
  ISFSubmissionType: 'ISF Submission Type',
  ISFShipmentTypeCode: 'Shipment Type Code',
  amendmentCode: 'Amendment Code',
  USPortOfArrival: 'US Port of Arrival',
  estimateDateOfArrival: 'Estimated Arrival Date',
  foreignPortOfUnlading: 'Foreign Port of Unlading',
  placeOfDelivery: 'Place of Delivery',
  bondType: 'Bond Type',
  bondActivityCode: 'Bond Activity Code',
  bondHolderID: 'Bond Holder ID (EIN)',
  entryTypeCode: 'Entry Type Code',
  vesselName: 'Vessel Name',
  voyageNumber: 'Voyage Number',
  SCACode: 'SCAC Code',
  scacCode: 'SCAC Code',

  // Importer of Record
  IORName: 'Importer of Record Name',
  IORLastName: 'Importer of Record Last Name',
  IORNumber: 'Importer EIN Number',
  IORIDCodeQualifier: 'Importer ID Type',

  // ISF Filer
  ISFFilerName: 'ISF Filer Name',
  ISFFilerLastName: 'ISF Filer Last Name',
  ISFFilerNumber: 'ISF Filer EIN Number',
  ISFFilerIDCodeQualifier: 'ISF Filer ID Type',

  // Buyer
  buyerName: 'Buyer Name',
  buyerAddress1: 'Buyer Address',
  buyerCity: 'Buyer City',
  buyerCountry: 'Buyer Country',
  buyerPostalCode: 'Buyer Postal Code',

  // Ship To
  shipToName: 'Ship-To Party Name',
  shipToAddress1: 'Ship-To Address',
  shipToCity: 'Ship-To City',
  shipToCountry: 'Ship-To Country',

  // Seller
  sellerName: 'Seller Name',
  sellerAddress1: 'Seller Address',
  sellerCity: 'Seller City',
  sellerCountry: 'Seller Country',

  // Consolidator / Container Stuffing Location
  consolidatorName: 'Consolidator Name',
  consolidatorAddress1: 'Consolidator Address',
  consolidatorCity: 'Consolidator City',
  consolidatorCountry: 'Consolidator Country',

  CSLName: 'Container Stuffing Location Name',
  CSLAddress1: 'Container Stuffing Location Address',
  CSLCity: 'Container Stuffing Location City',
  CSLCountry: 'Container Stuffing Location Country',

  // Manufacturer
  manufacturerName: 'Manufacturer Name',
  manufacturerAddress1: 'Manufacturer Address',
  manufacturerCity: 'Manufacturer City',
  manufacturerCountry: 'Manufacturer Country',
  MID: 'Manufacturer ID (MID)',

  // Shipment / Container
  containerNumber: 'Container Number',
  containerType: 'Container Type',
  sealNumber: 'Seal Number',

  // Items / Commodity
  'commodityHTS-6Number': 'HTS Code (6-digit)',
  commodityHTSNumber: 'HTS Code',
  countryOfOrigin: 'Country of Origin',
  lineItem: 'Line Item Number',
  weight: 'Weight',
  weightUOM: 'Weight Unit of Measure',
  quantity: 'Quantity',
  quantityUOM: 'Quantity Unit of Measure',
  commodityDescription: 'Commodity Description',
  description: 'Commodity Description',
  value: 'Declared Value',

  // Booking Party
  bookingPartyName: 'Booking Party Name',
  bookingPartyAddress1: 'Booking Party Address',
  bookingPartyCity: 'Booking Party City',
  bookingPartyCountry: 'Booking Party Country',
};

// ─── Common Error Patterns → Human-Readable Translations ──

interface ErrorPattern {
  pattern: RegExp;
  translate: (match: RegExpMatchArray, field: string) => { message: string; fix: string };
}

const ERROR_PATTERNS: ErrorPattern[] = [
  // "should be equal to one of the allowed values [...]"
  {
    pattern: /should be equal to one of the allowed values \[([^\]]+)\]/i,
    translate: (match, field) => {
      const allowedRaw = match[1];
      const allowed = allowedRaw.split(',').map(v => v.trim()).filter(v => v && v !== 'null');

      if (field.includes('Port') || field.includes('USPortOfArrival')) {
        return {
          message: `The "${getFieldLabel(field)}" code you entered is not a valid US port code.`,
          fix: `Please enter a valid 4-digit Schedule D port code. Examples: 2704 (Los Angeles), 1001 (New York), 5301 (Houston). You can find the full list at the CBP port codes directory.`,
        };
      }
      if (field.includes('weightUOM') || field.includes('quantityUOM')) {
        const uomMap: Record<string, string> = { L: 'Pounds (LBS)', K: 'Kilograms (KG)' };
        const options = allowed.map(v => uomMap[v] || v).join(', ');
        return {
          message: `Invalid unit of measure for "${getFieldLabel(field)}".`,
          fix: `Please select one of the allowed units: ${options}`,
        };
      }
      if (field.includes('containerType')) {
        return {
          message: `The container type is not recognized.`,
          fix: `Please enter a valid ISO container type code (e.g., 22G1 for 20ft standard, 42G1 for 40ft standard, 45G1 for 40ft high-cube).`,
        };
      }
      if (field.includes('billType')) {
        return {
          message: `Invalid bill type.`,
          fix: `Bill type must be either "HOUSE" (for house bill of lading) or "MASTER" (for master bill of lading).`,
        };
      }
      if (allowed.length <= 10) {
        return {
          message: `The value you entered for "${getFieldLabel(field)}" is not valid.`,
          fix: `Allowed values are: ${allowed.join(', ')}`,
        };
      }
      return {
        message: `The value for "${getFieldLabel(field)}" is not in the accepted list.`,
        fix: `Please check the CBP filing requirements for valid codes and re-enter the correct value.`,
      };
    },
  },

  // "should NOT be longer than X characters"
  {
    pattern: /should NOT be longer than (\d+) characters?/i,
    translate: (match, field) => ({
      message: `"${getFieldLabel(field)}" is too long.`,
      fix: `Please shorten this field to ${match[1]} character${parseInt(match[1]) === 1 ? '' : 's'} or less.`,
    }),
  },

  // "should NOT be shorter than X characters"
  {
    pattern: /should NOT be shorter than (\d+) characters?/i,
    translate: (match, field) => ({
      message: `"${getFieldLabel(field)}" is too short.`,
      fix: `This field requires at least ${match[1]} character${parseInt(match[1]) === 1 ? '' : 's'}. Please enter the complete information.`,
    }),
  },

  // "is required" / "should have required property"
  {
    pattern: /is required|should have required property '([^']+)'/i,
    translate: (match, field) => {
      const missingField = match[1] || field;
      return {
        message: `"${getFieldLabel(missingField)}" is required but was not provided.`,
        fix: `Please go back and fill in the "${getFieldLabel(missingField)}" field before submitting.`,
      };
    },
  },

  // "should match pattern"
  {
    pattern: /should match pattern "([^"]+)"/i,
    translate: (_match, field) => {
      if (field.includes('IOR') || field.includes('Filer') || field.includes('bondHolder')) {
        return {
          message: `The "${getFieldLabel(field)}" format is invalid.`,
          fix: `EIN numbers must be in the format XX-XXXXXXXXX (2 digits, dash, 9 characters). Example: 12-3456789AB`,
        };
      }
      if (field.includes('BOL')) {
        return {
          message: `The "${getFieldLabel(field)}" format is invalid.`,
          fix: `Bill of Lading numbers should only contain letters, numbers, and dashes. No special characters.`,
        };
      }
      return {
        message: `"${getFieldLabel(field)}" has an invalid format.`,
        fix: `Please check the format and re-enter. Remove any special characters that may be causing issues.`,
      };
    },
  },

  // "should be integer" / "should be number"
  {
    pattern: /should be (integer|number)/i,
    translate: (_match, field) => ({
      message: `"${getFieldLabel(field)}" must be a number.`,
      fix: `Please enter only numbers (no letters or symbols) for this field.`,
    }),
  },

  // Date format issues
  {
    pattern: /invalid date|date format|YYYYMMDD/i,
    translate: (_match, field) => ({
      message: `The date for "${getFieldLabel(field)}" is in the wrong format.`,
      fix: `Please enter dates in the correct format (YYYY-MM-DD). For example: 2026-12-31`,
    }),
  },

  // HTS code issues
  {
    pattern: /HTS|tariff|commodity.*code/i,
    translate: (_match, field) => ({
      message: `The HTS tariff code for "${getFieldLabel(field)}" is invalid.`,
      fix: `HTS codes must be at least 6 digits. Please verify the correct HTS code for your commodity at https://hts.usitc.gov/`,
    }),
  },
];

// ─── Helper Functions ─────────────────────────────────────

function getFieldLabel(field: string): string {
  // Direct lookup
  if (FIELD_LABELS[field]) return FIELD_LABELS[field];

  // Try partial match (field might be nested like "body.0.shipments.0.manufacturer.0.items.0.weight")
  const baseName = field.split('.').pop() || field;
  if (FIELD_LABELS[baseName]) return FIELD_LABELS[baseName];

  // Convert camelCase / PascalCase to human readable
  // Handle consecutive uppercase (acronyms) like MBOLNumber → "MBOL Number"
  return baseName
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')   // "MBOLNumber" → "MBOL Number"
    .replace(/([a-z])([A-Z])/g, '$1 $2')           // "bondType" → "bond Type"
    .replace(/^./, s => s.toUpperCase())
    .replace(/\s+/g, ' ')
    .trim();
}

export interface TranslatedError {
  field: string;
  fieldLabel: string;
  originalMessage: string;
  message: string;
  fix: string;
  severity: 'critical' | 'warning';
}

/**
 * Parse a compound field key from the API.
 * The API returns fields like "MBOLNumber: MAEU123 - HBOLNumber: HBOL456"
 * which is a BOL identifier, not the actual field with the error.
 * The actual field name is often in the message itself (e.g. "description should NOT be longer than 45 characters").
 */
function parseFieldFromError(rawField: string, message: string): string {
  // If the field contains "MBOLNumber:" or "HBOLNumber:", it's a compound BOL key
  // Try to extract the actual field name from the message
  if (rawField.includes('BOLNumber:') || rawField.includes(' - ')) {
    // Check if message starts with a field name like "description should..." or "weightUOM should..."
    const msgFieldMatch = message.match(/^([a-zA-Z][a-zA-Z0-9_-]*)\s+(should|must|is|has|cannot|invalid)/i);
    if (msgFieldMatch) {
      return msgFieldMatch[1]; // e.g. "description", "weightUOM"
    }
    // Fallback: return the first part (MBOLNumber)
    const firstKey = rawField.split(':')[0].trim();
    return firstKey;
  }
  return rawField;
}

/**
 * Translate a single raw API validation error into a user-friendly message.
 */
function translateSingleError(field: string, rawMessage: string): TranslatedError {
  // Extract the actual field name from compound API keys
  const actualField = parseFieldFromError(field, rawMessage);
  const fieldLabel = getFieldLabel(actualField);

  // Strip field name prefix from message if present (e.g. "description should NOT be..." → "should NOT be...")
  let cleanMessage = rawMessage;
  if (rawMessage.toLowerCase().startsWith(actualField.toLowerCase())) {
    cleanMessage = rawMessage.slice(actualField.length).trim();
  }

  // Try each pattern
  for (const ep of ERROR_PATTERNS) {
    const match = cleanMessage.match(ep.pattern) || rawMessage.match(ep.pattern);
    if (match) {
      const { message, fix } = ep.translate(match, actualField);
      return {
        field: actualField,
        fieldLabel,
        originalMessage: rawMessage,
        message,
        fix,
        severity: rawMessage.includes('required') ? 'critical' : 'warning',
      };
    }
  }

  // Fallback — no pattern matched
  return {
    field: actualField,
    fieldLabel,
    originalMessage: rawMessage,
    message: `There's an issue with "${fieldLabel}".`,
    fix: `Please review the value you entered for "${fieldLabel}" and correct it. Original error: ${rawMessage}`,
    severity: 'warning',
  };
}

/**
 * Translate an array of raw API validation errors into user-friendly messages.
 * Input format: array of { field: string, message: string } or raw error strings.
 */
export function translateValidationErrors(errors: any[]): TranslatedError[] {
  if (!errors || !Array.isArray(errors)) return [];

  return errors.map((err) => {
    if (typeof err === 'string') {
      // Parse "fieldName: error message" format
      const colonIdx = err.indexOf(':');
      if (colonIdx > 0) {
        const field = err.slice(0, colonIdx).trim();
        const msg = err.slice(colonIdx + 1).trim();
        return translateSingleError(field, msg);
      }
      return translateSingleError('unknown', err);
    }
    if (err.field && err.message) {
      return translateSingleError(err.field, err.message);
    }
    return translateSingleError('unknown', JSON.stringify(err));
  });
}

/**
 * Translate a raw rejection reason string (from DB) into user-friendly messages.
 * The rejectionReason may be:
 *   - A semicolon-separated string: "field1: msg1; field2: msg2"
 *   - A JSON stringified array
 *   - A plain error string
 */
export function translateRejectionReason(reason: string): TranslatedError[] {
  if (!reason) return [];

  // Try JSON parse first
  try {
    const parsed = JSON.parse(reason);
    if (Array.isArray(parsed)) {
      return translateValidationErrors(parsed);
    }
  } catch {
    // Not JSON — try semicolon-separated format
  }

  // Split by semicolons
  const parts = reason.split(';').map(s => s.trim()).filter(Boolean);
  return translateValidationErrors(parts);
}

/**
 * Sanitize an error message to remove internal API provider names.
 * Replaces "CustomsCity" and similar references with neutral terms.
 */
export function sanitizeErrorMessage(message: string): string {
  return message
    .replace(/CustomsCity/gi, 'CBP filing system')
    .replace(/customs\s*city/gi, 'CBP filing system')
    .replace(/CC API/gi, 'filing API')
    .replace(/CC /g, 'CBP ')
    .replace(/via CC/gi, 'to CBP');
}
