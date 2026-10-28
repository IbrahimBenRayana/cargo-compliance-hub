/**
 * Add Manufacturer response parser ($R) — one result per loop: the update
 * status, the firm name (possibly split $5/$6), the ACE MID (the point of
 * the exercise), and any $7 error narratives (AMF-19..24).
 */
import { parseRecord } from '../../records/codec.js';
import { OUTPUT_DOLLAR_5, OUTPUT_DOLLAR_6, OUTPUT_DOLLAR_7 } from './recordDefs.js';
import { parseBatch } from '../../envelope/batch.js';

export interface AmfResult {
  /** U = acknowledged; E = error ($7 records explain). */
  updateStatus: 'U' | 'E';
  sequenceNumber: number;
  countryCode: string;
  firmName: string;
  /** ACE-derived MID (adds) or the submitted MID (postal updates). */
  manufacturerId?: string;
  zipOrPostalCode?: string;
  userData?: string;
  errors: { id: string; narrative: string }[];
}

/** Parse the transaction lines of one $R response (between B and Y). */
export function parseAmfResponse(lines: string[]): AmfResult[] {
  const results: AmfResult[] = [];
  let current: AmfResult | undefined;
  let pendingUserData: string | undefined;

  for (const line of lines) {
    const tag = line.slice(0, 2);
    if (tag === '$A') {
      pendingUserData = line.slice(2, 80).trimEnd();
      continue;
    }
    if (tag === '$5') {
      const rec = parseRecord(OUTPUT_DOLLAR_5, line).values;
      current = {
        updateStatus: (rec.updateStatus as 'U' | 'E') || 'E',
        sequenceNumber: Number(rec.updateSequenceNumber || '0'),
        countryCode: rec.isoCountryCode ?? '',
        firmName: rec.firmName ?? '',
        userData: pendingUserData,
        errors: [],
      };
      pendingUserData = undefined;
      results.push(current);
      continue;
    }
    if (tag === '$6' && current) {
      const rec = parseRecord(OUTPUT_DOLLAR_6, line).values;
      if (rec.firmName) current.firmName += rec.firmName;
      if (rec.manufacturerIdCode) current.manufacturerId = rec.manufacturerIdCode;
      if (rec.zipOrPostalCode) current.zipOrPostalCode = rec.zipOrPostalCode;
      continue;
    }
    if (tag === '$7' && current) {
      const rec = parseRecord(OUTPUT_DOLLAR_7, line).values;
      current.errors.push({ id: rec.errorMessageIdentifier ?? '', narrative: rec.narrativeMessage ?? '' });
    }
  }
  return results;
}

/** Parse a full A…Z wire batch of $R responses. */
export function parseAmfResponseBatch(lines: string[]): { results: AmfResult[] } {
  const batch = parseBatch(lines);
  const results = batch.blocks.flatMap((block) => parseAmfResponse(block.transactionLines));
  return { results };
}
