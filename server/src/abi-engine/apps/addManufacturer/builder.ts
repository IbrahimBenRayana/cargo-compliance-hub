/**
 * Add Manufacturer builder ($I) — submit manufacturer names/addresses so
 * ACE derives and returns the authoritative MID, or update the postal
 * code of an existing MID (AMF chapter, March 2023 v3.0).
 *
 * Usage maps (AMF-9): each loop is $A? $1 $2? $3 $4? for adds, and
 * $A? $1 $4 for postal updates; up to 999 loops per block.
 */
import { writeRecord, RecordCodecError, type CodecIssue } from '../../records/codec.js';
import { CANADIAN_PROVINCE_MID_CODES } from '../../payload/mid.js';
import {
  INPUT_DOLLAR_A,
  INPUT_DOLLAR_1,
  INPUT_DOLLAR_2,
  INPUT_DOLLAR_3,
  INPUT_DOLLAR_4,
} from './recordDefs.js';

function fail(field: string, message: string): never {
  const issue: CodecIssue = { record: 'AddManufacturer', field, message };
  throw new RecordCodecError([issue]);
}

export interface AddManufacturerRequest {
  action: 'add';
  /** ISO country of the firm ('CA' resolves to the province X-code). */
  countryCode: string;
  /** Canadian province/territory — required when countryCode is CA. */
  stateOrProvince?: string;
  /** Firm name, ≤100 chars ($1 carries 70, $2 the next 30). */
  name: string;
  /** Street, ≤94 chars ($2 carries 43, $3 the next 51). */
  street?: string;
  /** City, ≤67 chars ($3 carries 23, $4 the next 44). English spelling. */
  city: string;
  /** Required when the country is US, Canada, or China (AMF-17). */
  zipOrPostalCode?: string;
  /** Optional: ACE verifies it against its own derivation (AMF-18 Note 2). */
  manufacturerId?: string;
  userData?: string;
}

export interface UpdatePostalCodeRequest {
  action: 'updatePostalCode';
  manufacturerId: string;
  zipOrPostalCode: string;
  userData?: string;
}

export type AmfRequest = AddManufacturerRequest | UpdatePostalCodeRequest;

/** Countries whose adds must carry a ZIP/postal code (AMF-17). */
const ZIP_REQUIRED = new Set(['US', 'CA', 'CN']);

function resolveCountry(request: AddManufacturerRequest, at: string): string {
  const country = request.countryCode?.trim().toUpperCase() ?? '';
  if (country.length !== 2) fail(`${at}.countryCode`, 'a 2-char ISO country code is required');
  if (country !== 'CA') return country;
  const province = CANADIAN_PROVINCE_MID_CODES[request.stateOrProvince?.trim().toUpperCase() ?? ''];
  if (!province) {
    fail(`${at}.stateOrProvince`, 'Canadian manufacturers report the province X-code instead of CA (AMF-13 Note 1)');
  }
  return province;
}

/** Build one $I transaction (the lines between B and Y) for 1-999 requests. */
export function buildAddManufacturers(requests: AmfRequest[]): string[] {
  if (requests.length === 0) fail('requests', 'at least one manufacturer request is required');
  if (requests.length > 999) fail('requests', 'at most 999 manufacturer loops per block (AMF-9)');

  const lines: string[] = [];
  requests.forEach((request, index) => {
    const at = `requests[${index}]`;
    const sequence = String(index + 1).padStart(5, '0');
    if (request.userData) {
      lines.push(writeRecord(INPUT_DOLLAR_A, { userData: request.userData }));
    }

    if (request.action === 'updatePostalCode') {
      if (!request.manufacturerId?.trim()) fail(`${at}.manufacturerId`, 'the existing MID is required for a postal update');
      if (!request.zipOrPostalCode?.trim()) fail(`${at}.zipOrPostalCode`, 'a postal code is required for a postal update');
      // Country + name are space-filled for action 'U' (AMF-12).
      lines.push(writeRecord(INPUT_DOLLAR_1, { updateActionCode: 'U', updateSequenceNumber: sequence }));
      lines.push(
        writeRecord(INPUT_DOLLAR_4, {
          zipOrPostalCode: request.zipOrPostalCode.trim().toUpperCase(),
          manufacturerIdCode: request.manufacturerId.trim().toUpperCase(),
        })
      );
      return;
    }

    const country = resolveCountry(request, at);
    const name = request.name?.trim().toUpperCase() ?? '';
    if (name.length === 0) fail(`${at}.name`, 'a firm name is required to add a manufacturer');
    if (name.length > 100) fail(`${at}.name`, 'firm name exceeds 100 characters (AMF-12)');
    const street = request.street?.trim().toUpperCase() ?? '';
    if (street.length > 94) fail(`${at}.street`, 'street exceeds 94 characters (AMF-15)');
    const city = request.city?.trim().toUpperCase() ?? '';
    if (city.length === 0) fail(`${at}.city`, 'a city is required to add a manufacturer (AMF-16)');
    if (city.length > 67) fail(`${at}.city`, 'city exceeds 67 characters (AMF-16)');
    const zip = request.zipOrPostalCode?.trim().toUpperCase() ?? '';
    if (ZIP_REQUIRED.has(request.countryCode.trim().toUpperCase()) && zip.length === 0) {
      fail(`${at}.zipOrPostalCode`, 'ZIP/postal code is required for US, Canadian, and Chinese manufacturers (AMF-17)');
    }

    lines.push(
      writeRecord(INPUT_DOLLAR_1, {
        updateActionCode: 'A',
        updateSequenceNumber: sequence,
        isoCountryCode: country,
        firmName: name.slice(0, 70),
      })
    );
    // $2 carries name overflow and/or the first street segment.
    if (name.length > 70 || street.length > 0) {
      lines.push(
        writeRecord(INPUT_DOLLAR_2, {
          firmName: name.length > 70 ? name.slice(70, 100) : undefined,
          street: street.slice(0, 43) || undefined,
        })
      );
    }
    // $3 is mandatory for adds (AMF-16): street overflow + city 1-23.
    lines.push(
      writeRecord(INPUT_DOLLAR_3, {
        street: street.length > 43 ? street.slice(43, 94) : undefined,
        city: city.slice(0, 23),
      })
    );
    // $4: city overflow, ZIP, optional MID for ACE verification.
    if (city.length > 23 || zip.length > 0 || request.manufacturerId) {
      lines.push(
        writeRecord(INPUT_DOLLAR_4, {
          city: city.length > 23 ? city.slice(23, 67) : undefined,
          zipOrPostalCode: zip || undefined,
          manufacturerIdCode: request.manufacturerId?.trim().toUpperCase(),
        })
      );
    }
  });

  return lines;
}
