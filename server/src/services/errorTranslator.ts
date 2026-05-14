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

// ─── CBP Disposition Code Translations ────────────────────
// These are standard CBP response codes for ISF filings.
// Reference: CBP CATAIR / ABI / ACE appendices.

interface CBPCodeEntry {
  code: string;
  pattern: RegExp;
  message: string;
  fix: string;
  severity: 'critical' | 'warning';
}

const CBP_DISPOSITION_CODES: CBPCodeEntry[] = [
  // S-codes: ISF Severity / Status codes
  {
    code: 'S75',
    pattern: /S75\s+ENTITY\s+IDENT\s+NOT\s+ON\s+FILE/i,
    message: 'One of the parties (manufacturer, seller, or buyer) is not recognized in the CBP system.',
    fix: 'Verify the party name, address, and country exactly match what is registered with CBP. Ensure the manufacturer/seller has been previously reported in a CBP filing. In the test environment, this is expected with sample data.',
    severity: 'critical',
  },
  {
    code: 'S17',
    pattern: /S17\s+ISF\s+IMP\s+NBR\s+NOT\s+ON\s+FILE/i,
    message: 'The Importer Number (EIN) is not registered with CBP.',
    fix: 'Enter a valid Employer Identification Number (EIN) that is registered with CBP. The EIN must be in XX-XXXXXXX format and actively registered for customs filing. Contact your customs broker if you need to register.',
    severity: 'critical',
  },
  {
    code: 'SA7',
    pattern: /SA7\s+CONT\s+BOND\s+NOT\s+ON\s+FILE/i,
    message: 'No continuous customs bond is on file with CBP for this importer.',
    fix: 'A valid continuous bond (Type 1) must be on file with CBP for the importer EIN used. Contact your surety company or customs broker to verify the bond is active and properly linked to your EIN.',
    severity: 'critical',
  },
  {
    code: 'S18',
    pattern: /S18\s+ISF\s+FILER\s+NOT\s+ON\s+FILE/i,
    message: 'The ISF filer is not registered with CBP to submit filings.',
    fix: 'The ISF filer EIN must be registered with CBP as an authorized filer. Contact CBP or your licensed customs broker to register.',
    severity: 'critical',
  },
  {
    code: 'S01',
    pattern: /S01\s+/i,
    message: 'ISF transaction number has been assigned by CBP.',
    fix: 'This is an informational response — no action needed.',
    severity: 'warning',
  },
  {
    code: 'S02',
    pattern: /S02\s+/i,
    message: 'ISF filing has been accepted by CBP.',
    fix: 'No action needed — your filing has been accepted.',
    severity: 'warning',
  },
  {
    code: 'S10',
    pattern: /S10\s+/i,
    message: 'There is a data discrepancy in the filing.',
    fix: 'Review all fields for accuracy. Check BOL numbers, party names, HTS codes, and port codes. Correct any errors and resubmit.',
    severity: 'critical',
  },
  {
    code: 'S50',
    pattern: /S50\s+/i,
    message: 'ISF filing was received but CBP requires additional review.',
    fix: 'CBP is reviewing the filing. No immediate action needed, but monitor the status for updates.',
    severity: 'warning',
  },
  {
    code: 'S76',
    pattern: /S76\s+/i,
    message: 'A party entity identifier does not match CBP records.',
    fix: 'Verify the name, address, and country for all parties exactly match what is on file with CBP.',
    severity: 'critical',
  },
  {
    code: 'ISF REJECTED',
    pattern: /ISF\s+REJECTED/i,
    message: 'The ISF filing was rejected by CBP due to one or more errors listed above.',
    fix: 'Review and fix all the errors listed, then resubmit the filing.',
    severity: 'critical',
  },
  // Generic catch-all for unknown codes
  {
    code: 'GENERIC',
    pattern: /^([A-Z][A-Z0-9]{1,3})\s+(.+)/i,
    message: '',  // Will be built dynamically
    fix: 'Please review the error details and correct the filing. Contact support if you need help understanding this code.',
    severity: 'warning',
  },
];

/**
 * Translate CBP disposition/response codes into user-friendly messages.
 * Input: raw CBP rejection string like:
 *   "S75 ENTITY IDENT NOT ON FILE - Party: CN, S17 ISF IMP NBR NOT ON FILE, ..."
 */
export function translateCBPRejection(rawReason: string): TranslatedError[] {
  if (!rawReason) return [];

  // Split by commas, semicolons, or newlines
  const parts = rawReason.split(/[,;\n]+/).map(s => s.trim()).filter(Boolean);

  const results: TranslatedError[] = [];

  for (const part of parts) {
    let matched = false;

    for (const entry of CBP_DISPOSITION_CODES) {
      if (entry.code === 'GENERIC') continue; // Skip catch-all in first pass
      if (entry.pattern.test(part)) {
        // Extract any extra context (e.g. "- Party: CN")
        const extraContext = part.replace(entry.pattern, '').replace(/^[\s\-:]+/, '').trim();
        results.push({
          field: entry.code,
          fieldLabel: `CBP Code ${entry.code}`,
          originalMessage: part,
          message: entry.message + (extraContext ? ` (${extraContext})` : ''),
          fix: entry.fix,
          severity: entry.severity,
        });
        matched = true;
        break;
      }
    }

    if (!matched && part.length > 2) {
      // Try generic pattern
      const genericMatch = part.match(/^([A-Z][A-Z0-9]{1,3})\s+(.+)/i);
      if (genericMatch) {
        results.push({
          field: genericMatch[1],
          fieldLabel: `CBP Code ${genericMatch[1]}`,
          originalMessage: part,
          message: `CBP returned code ${genericMatch[1]}: ${genericMatch[2]}`,
          fix: 'Please review the error details and correct the filing. Contact your customs broker if you need help understanding this code.',
          severity: 'warning',
        });
      } else {
        results.push({
          field: 'CBP',
          fieldLabel: 'CBP Response',
          originalMessage: part,
          message: part,
          fix: 'Review and correct the filing based on this CBP response.',
          severity: 'warning',
        });
      }
    }
  }

  return results;
}

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
      // Defensive: if upstream forgot to flatten a nested message, render the
      // structure as JSON instead of letting it template-stringify into "[object Object]".
      const msg = typeof err.message === 'string' ? err.message : JSON.stringify(err.message);
      return translateSingleError(err.field, msg);
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
 * Parse a stored rejectionReason into the structured shape the Compliance
 * Center + frontend RejectionDetailsCard both consume. Mirrors the frontend
 * parser at src/components/RejectionDetailsCard.tsx but lives on the server
 * so routes can use the same model without duplicating regex/cleanup logic.
 */
export interface ParsedRejection {
  summary?: string;
  errors: Array<{
    field?: string;
    fieldLabel?: string;
    message: string;
    fix?: string;
    severity: 'critical' | 'warning' | 'info';
  }>;
  fallbackRaw?: string;
}

function cleanLegacy(s: string | undefined): string | undefined {
  if (!s) return s;
  const cleaned = s
    .replace(/\s*Original error:\s*\[object Object\]\s*\.?/gi, '')
    .replace(/\s*\[object Object\]\s*/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();
  return cleaned && cleaned !== '.' && cleaned !== ':' && cleaned !== '-' ? cleaned : undefined;
}

export function parseRejectionReason(raw: string | null | undefined): ParsedRejection {
  if (!raw) return { errors: [] };

  // Shape 1: JSON envelope { summary, errors: [...] }
  try {
    const parsed = JSON.parse(raw);
    if (parsed && Array.isArray(parsed.errors) && parsed.errors.length > 0) {
      const errors = parsed.errors.map((e: any) => ({
        field:      e.field,
        fieldLabel: cleanLegacy(e.fieldLabel) ?? cleanLegacy(e.field) ?? 'CBP validation',
        message:    cleanLegacy(e.message) ?? cleanLegacy(e.originalMessage) ?? 'CBP flagged an issue with this field.',
        fix:        cleanLegacy(e.fix),
        severity:   (e.severity === 'critical' || e.severity === 'warning' || e.severity === 'info' ? e.severity : 'warning') as 'critical' | 'warning' | 'info',
      }));
      return { errors, summary: cleanLegacy(parsed.summary) };
    }
  } catch {
    // Not JSON — fall through.
  }

  // Shape 2: plain text. Strip artifacts; return as fallbackRaw.
  const cleaned = cleanLegacy(raw);
  return { errors: [], fallbackRaw: cleaned ?? 'A rejection was recorded but no detail was captured.' };
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

// ── Manifest Disposition Codes ────────────────────────────

const MANIFEST_DISPOSITION_CODES: Record<string, { label: string; description: string; severity: 'info' | 'warning' | 'success' | 'error' }> = {
  '1C': { label: 'Cargo Released', description: 'Cargo has been released by CBP', severity: 'success' },
  '1E': { label: 'Export Cargo', description: 'Cargo identified as export', severity: 'info' },
  '1F': { label: 'FDA Hold', description: 'Cargo held by FDA for inspection', severity: 'warning' },
  '1H': { label: 'Intensive Exam', description: 'Cargo selected for intensive examination', severity: 'warning' },
  '1J': { label: 'USDA Hold', description: 'Cargo held by USDA', severity: 'warning' },
  '1R': { label: 'CBP Hold', description: 'Cargo held by CBP', severity: 'error' },
  '1W': { label: 'Arrived', description: 'Cargo arrived at port of entry', severity: 'info' },
  '2A': { label: 'Not on File', description: 'Manifest not on file at CBP', severity: 'warning' },
  '3H': { label: 'Hold Intact', description: 'Hold still in effect', severity: 'warning' },
  '4A': { label: 'In-Bond Arrival', description: 'In-bond cargo arrived at destination', severity: 'info' },
  'FS': { label: 'Firm Seized', description: 'Cargo has been seized by CBP', severity: 'error' },
  'S17': { label: 'ISF Filing Review', description: 'ISF filing under review by CBP', severity: 'warning' },
  'S75': { label: 'Entity Not on File', description: 'Entity identifier not on file with CBP', severity: 'error' },
  'SA7': { label: 'ISF Accepted', description: 'ISF filing accepted by CBP', severity: 'success' },
};

export function translateManifestDisposition(code: string): {
  label: string; description: string; severity: 'info' | 'warning' | 'success' | 'error';
} {
  return MANIFEST_DISPOSITION_CODES[code] ?? {
    label: `Code ${code}`,
    description: `CBP disposition code ${code}`,
    severity: 'info' as const,
  };
}
