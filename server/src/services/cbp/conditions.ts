/**
 * CBP condition catalog (audit BNA-08, FNA-10): one place that turns a CBP
 * condition into what a user sees, built only from CBP's official tables:
 *   - entry summary (AX): ACE CATAIR Error Dictionary (refdata/aeErrorDictionary)
 *   - batch control (X1): CATAIR Batch & Block Control condition codes
 *   - ISF (SF90) message types and SA status-advisory dispositions
 * CBP's narrative is always kept; nothing here is invented. Batch-control
 * conditions are about our transmission or authorization, not the filer's
 * data, so they are flagged for operations.
 */
import { AE_ERROR_DICTIONARY, AE_ERROR_DICTIONARY_VERSION } from '../../abi-engine/refdata/aeErrorDictionary.js';
import { CONDITION_CODES } from '../../abi-engine/envelope/conditionCodes.js';
import { SF90_MESSAGE_TYPES, SA_DISPOSITION_CODES } from '../../abi-engine/isf/recordDefs.js';

export type ConditionSource = 'entry-summary' | 'batch' | 'isf' | 'isf-advisory';

/** AX condition severities (AE output E0/E1 records). */
export const SEVERITY_LABELS: Record<string, string> = {
  F: 'Fatal: must be corrected',
  W: 'Warning: accepted, review recommended',
  P: 'PGA message',
  I: 'Informational',
};

export interface CbpConditionView {
  source: ConditionSource;
  code: string;
  severity?: string;
  /** CBP's own short text. */
  narrative: string;
  /** CBP's explanation of the rule, when published. */
  explanation?: string;
  /** True when CBP will not accept the transaction until it is fixed. */
  blocking: boolean;
  /** Who acts on it: the filer (data) or our operations team (transmission/authorization). */
  audience: 'filer' | 'operations';
  reference: string;
}

function normaliseAeCode(code: string): string {
  const c = code.trim().toUpperCase();
  return /^\d+$/.test(c) ? String(Number(c)).padStart(3, '0') : c;
}

export function describeCondition(input: {
  source: ConditionSource;
  code: string;
  severity?: string;
  narrative?: string;
}): CbpConditionView {
  const given = input.narrative?.trim();
  switch (input.source) {
    case 'entry-summary': {
      const code = normaliseAeCode(input.code);
      const entry = AE_ERROR_DICTIONARY[code];
      return {
        source: input.source,
        code,
        severity: input.severity,
        narrative: entry?.narrative || given || `Condition ${code}`,
        explanation: entry?.explanation || undefined,
        blocking: input.severity === undefined ? true : input.severity === 'F',
        audience: 'filer',
        reference: `CBP ACE CATAIR Error Dictionary ${AE_ERROR_DICTIONARY_VERSION}`,
      };
    }
    case 'batch': {
      const code = input.code.trim().toUpperCase();
      return {
        source: input.source,
        code,
        narrative: CONDITION_CODES[code] ?? given ?? `Condition ${code}`,
        blocking: true,
        audience: 'operations',
        reference: 'CBP CATAIR Batch & Block Control, X1 condition codes',
      };
    }
    case 'isf': {
      const code = input.code.trim();
      return {
        source: input.source,
        code,
        narrative: SF90_MESSAGE_TYPES[code] ?? given ?? `Message type ${code}`,
        explanation: given && SF90_MESSAGE_TYPES[code] ? given : undefined,
        blocking: code === '01' || code === '11',
        audience: 'filer',
        reference: 'CBP CATAIR ISF chapter, SF90 message types',
      };
    }
    case 'isf-advisory': {
      const code = input.code.trim().toUpperCase();
      return {
        source: input.source,
        code,
        narrative: SA_DISPOSITION_CODES[code] ?? given ?? `Disposition ${code}`,
        explanation: given,
        blocking: false,
        audience: 'filer',
        reference: 'CBP ISF Status Advisory (SA) dispositions',
      };
    }
  }
}
