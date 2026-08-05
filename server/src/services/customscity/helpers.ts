/**
 * Shared field-formatting / sanitization helpers for the CustomsCity mappers.
 *
 * Extracted from services/customscity.ts (Phase 0.4 split — see
 * docs/abi-engine/MIGRATION_PLAN.md). Previously module-private; now
 * exported so the mapper module (and the legacy barrel) can share them.
 */

// ─── Helpers ───────────────────────────────────────────────

/**
 * Convert a Date or ISO-string to YYYYMMDD integer (what CC API actually validates).
 * NOTE: The official example shows strings, but the actual CC validator expects NUMBER type.
 * Error: "should be number,null"
 */
export function toYYYYMMDD(dateValue: any): number | null {
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
export function toYYYYMMDDString(dateValue: any): string {
  if (!dateValue) return '';
  const d = dateValue instanceof Date ? dateValue : new Date(dateValue);
  if (isNaN(d.getTime())) return '';
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}${mm}${dd}`;
}

/** Safely extract string from a JSONB party object, handling both object and string formats. */
export function partyField(party: any, field: string, fallback = ''): string {
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
export function sanitizeName(raw: string, maxLen: number): string {
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
export function sanitizeAddress(raw: string, maxLen = 35): string {
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
export function sanitizeState(raw: string, fallback = 'XX'): string {
  if (!raw) return fallback;
  const cleaned = raw.replace(/[^A-Za-z]/g, '').toUpperCase();
  if (cleaned.length === 0) return fallback;
  if (cleaned.length <= 3) return cleaned;
  // Longer than 3 chars — take first 2 letters as a code
  return cleaned.substring(0, 2);
}

/** Ensure a TaxID / EIN meets the CC pattern: XX-XXXXXXXXX */
export function formatTaxId(raw: string): string {
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
export function formatBondHolderEIN(raw: string): string {
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

