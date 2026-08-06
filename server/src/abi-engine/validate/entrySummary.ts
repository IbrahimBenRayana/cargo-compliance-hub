/**
 * Entry Summary validation rules (workstream G).
 *
 * "Your system must reject invalid transactions client-side" — the CBP
 * certification requirement. The codec enforces character classes; the
 * builder enforces structure; THIS layer enforces the cross-field,
 * entry-type-conditional rules from the Entry Summary Create/Update
 * chapter, primarily the reporting matrix of usage note (e) (ESF-134/135)
 * plus targeted rules from notes (i) and (ff).
 *
 * Each matrix row is encoded as a 16-char designation string in
 * ENTRY_TYPE_ORDER column order, transcribed cell-for-cell from the
 * printed table: M mandatory, C conditional, A allowed, N not allowed.
 * M-missing and N-present are fatal; C/A carry no presence check here
 * (their conditions live in dedicated rules where the scenarios need them).
 */
import type { AeEntrySummaryInput, AeLine } from '../ae/builder.js';
import { ENTRY_TYPE_CODES, MOT_CODES } from '../ae/tables.js';

export interface ValidationIssue {
  /** F = fatal (transaction must not be transmitted). */
  severity: 'F';
  field: string;
  message: string;
}

/** Column order of the ESF-134/135 reporting matrix. */
const ENTRY_TYPE_ORDER = ['01', '02', '03', '06', '07', '11', '12', '21', '22', '23', '31', '32', '34', '38', '51', '52'] as const;

type Designation = 'M' | 'C' | 'A' | 'N';

interface MatrixRule {
  field: string;
  /** 16 designations in ENTRY_TYPE_ORDER, transcribed from ESF-134/135. */
  row: string;
  present: (input: AeEntrySummaryInput) => boolean;
}

interface LineMatrixRule {
  field: string;
  row: string;
  present: (line: AeLine) => boolean;
}

const HEADER_RULES: MatrixRule[] = [
  { field: 'motCode', row: 'MMMAMAAMAMNNNNMM', present: (i) => i.motCode !== undefined },
  { field: 'bondWaiver', row: 'AANANAAAAAAANNAA', present: (i) => i.bondWaiver !== undefined },
  { field: 'bondWaiver.reasonCode', row: 'AANANNNAAAAANNAA', present: (i) => i.bondWaiver?.reasonCode !== undefined },
  { field: 'indicators.deferredTaxPaymentCode', row: 'AAAAANNAAAAAAAAA', present: (i) => i.indicators?.deferredTaxPaymentCode !== undefined },
  { field: 'indicators.tradeAgreementReconciliation', row: 'AANANNNNNNNNNNNN', present: (i) => i.indicators?.tradeAgreementReconciliation === true },
  { field: 'indicators.reconciliationIssueCode', row: 'AANANNNNNNNNNNNN', present: (i) => i.indicators?.reconciliationIssueCode !== undefined },
  { field: 'indicators.consolidatedSummary', row: 'ANNANANNNNNNNNNN', present: (i) => i.indicators?.consolidatedSummary === true },
  { field: 'header.consigneeNumber', row: 'MMMMMAAAAMMMMMMM', present: (i) => i.header?.consigneeNumber !== undefined },
  { field: 'header.estimatedEntryDate', row: 'AAAAAAAAMAMMMMAA', present: (i) => i.header?.estimatedEntryDate !== undefined },
  { field: 'header.dateOfImportation', row: 'CCACAAAMNMAAAAAA', present: (i) => i.header?.dateOfImportation !== undefined },
  { field: 'header.foreignTradeZoneId', row: 'NNNMNNNNNNNNNNNN', present: (i) => i.header?.foreignTradeZoneId !== undefined },
  { field: 'header.usStateOfDestination', row: 'MMMMMAAMMMMMMMMM', present: (i) => i.header?.usStateOfDestination !== undefined },
  { field: 'warehouse', row: 'NNNNNNNNMNMMMMNN', present: (i) => i.warehouse !== undefined },
  { field: 'bonds', row: 'AAMCMAACCCAAMMAA', present: (i) => (i.bonds?.length ?? 0) > 0 },
  { field: 'releases', row: 'ANNANANNNNNNNNNN', present: (i) => (i.releases?.length ?? 0) > 0 },
  { field: 'lines', row: 'MMMMMMMMMMMMMMMM', present: (i) => (i.lines?.length ?? 0) > 0 },
  { field: 'adCvdTotals', row: 'NNMCMNNCCCNNMMNN', present: (i) => i.adCvdTotals !== undefined },
];

const LINE_RULES: LineMatrixRule[] = [
  { field: 'countryOfExport', row: 'MMMAMMMMMMMMMMMM', present: (l) => l.countryOfExport !== undefined },
  { field: 'dateOfExportation', row: 'MMMAMMMMMMMMMMMM', present: (l) => l.dateOfExportation !== undefined },
  { field: 'relatedPartyIndicator', row: 'MMMMMAAMMMMMMMMM', present: (l) => l.relatedPartyIndicator !== undefined },
  { field: 'adNonReimbursementStatement', row: 'NNAAANNAAANNAANN', present: (l) => l.adNonReimbursementStatement !== undefined },
  { field: 'ftz', row: 'NNNMNNNNNNNNNNNN', present: (l) => l.ftz !== undefined },
  { field: 'parties[M]', row: 'MMMMMAAMCCMMMMMM', present: (l) => (l.parties ?? []).some((p) => p.type === 'M') },
  { field: 'parties[S]', row: 'MMMMMAAMMMMMMMMM', present: (l) => (l.parties ?? []).some((p) => p.type === 'S') },
  { field: 'parties[E]', row: 'AACCCAACCCAACCAA', present: (l) => (l.parties ?? []).some((p) => p.type === 'E') },
  { field: 'adCvdCases', row: 'NNCCCNNCCCNNCCNN', present: (l) => (l.adCvdCases?.length ?? 0) > 0 },
];

/** Entry types whose very definition is AD/CVD (usage note ff). */
const EXPLICIT_ADCVD_TYPES = new Set(['03', '07', '34', '38']);

function designationFor(row: string, entryType: string): Designation {
  const index = ENTRY_TYPE_ORDER.indexOf(entryType as (typeof ENTRY_TYPE_ORDER)[number]);
  return row[index] as Designation;
}

function checkDesignation(
  designation: Designation,
  present: boolean,
  field: string,
  entryType: string,
  issues: ValidationIssue[]
): void {
  if (designation === 'M' && !present) {
    issues.push({ severity: 'F', field, message: `mandatory for entry type ${entryType} (ESF-134)` });
  } else if (designation === 'N' && present) {
    issues.push({ severity: 'F', field, message: `not allowed for entry type ${entryType} (ESF-134)` });
  }
}

/**
 * Validate an Add/Replace entry summary against the entry-type reporting
 * matrix and targeted cross-field rules. Returns [] when transmittable.
 * Delete actions carry no conditional data and always pass.
 */
export function validateEntrySummary(input: AeEntrySummaryInput): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const entryType = input.entryTypeCode;

  if (!(entryType in ENTRY_TYPE_CODES)) {
    return [{ severity: 'F', field: 'entryTypeCode', message: `unknown entry type '${entryType}' (AE Table 2)` }];
  }
  if (input.action === 'D') return [];

  if (input.motCode !== undefined && !(input.motCode in MOT_CODES)) {
    issues.push({ severity: 'F', field: 'motCode', message: `unknown MOT code '${input.motCode}' (AE Table 3)` });
  }

  for (const rule of HEADER_RULES) {
    checkDesignation(designationFor(rule.row, entryType), rule.present(input), rule.field, entryType, issues);
  }

  for (const [index, line] of (input.lines ?? []).entries()) {
    for (const rule of LINE_RULES) {
      checkDesignation(
        designationFor(rule.row, entryType),
        rule.present(line),
        `lines[${index}].${rule.field}`,
        entryType,
        issues
      );
    }
  }

  // Note (i): a waived bond and a bond detail are mutually exclusive.
  if (input.bondWaiver !== undefined && (input.bonds?.length ?? 0) > 0) {
    issues.push({ severity: 'F', field: 'bonds', message: 'bond detail not allowed when the bond is waived (usage note i)' });
  }

  // Note (ff): explicit AD/CVD entry types require ≥1 case on ≥1 line.
  if (EXPLICIT_ADCVD_TYPES.has(entryType)) {
    const hasCase = (input.lines ?? []).some((l) => (l.adCvdCases?.length ?? 0) > 0);
    if (!hasCase) {
      issues.push({
        severity: 'F',
        field: 'lines',
        message: `entry type ${entryType} requires at least one AD/CVD case (usage note ff)`,
      });
    }
  }

  return issues;
}
