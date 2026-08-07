/**
 * Entry Summary validation rules (workstream G).
 *
 * "Your system must reject invalid transactions client-side" — the CBP
 * certification requirement. The codec enforces character classes; the
 * builder enforces structure; THIS layer enforces the cross-field,
 * entry-type-conditional rules from the Entry Summary Create/Update
 * chapter, primarily the reporting matrix of usage note (e) (ESF-134/135)
 * plus targeted rules from notes (i), (ff), and — workstream C — the
 * bond-configuration tables (ESF-156–158), PSC rules of note (gg)
 * (ESF-183–185), cargo-release certification of note (ee) (ESF-180),
 * in-bond reporting guidelines (ESF-155), warehouse rules of note (bb)
 * (ESF-177–178), and the payment/statement rules of note (y) (ESF-174–176).
 * Rules that depend on ACE state (liquidation schedule, bond sufficiency,
 * prior-summary contents) are out of scope for client-side validation.
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
  // Never allowed for warehouse withdrawals (31/32/34/38) and Military-DCMA 51 (note ee, ESF-134/180).
  { field: 'cargoReleaseCertification', row: 'AAAAAAAAAANNNNNA', present: (i) => i.cargoReleaseCertification === true },
  // An informal entry is not eligible for a PSC (note gg, ESF-134/183).
  { field: 'indicators.postSummaryCorrection', row: 'AAAAANNAAAAAAAAA', present: (i) => i.indicators?.postSummaryCorrection === true },
  // Cargo Manifest Grouping not allowed for warehouse withdrawals (ESF-134).
  { field: 'manifests', row: 'CCCCCCCCCCNNNNCC', present: (i) => (i.manifests?.length ?? 0) > 0 },
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

/** Warehouse / re-warehouse / withdrawal types where HMF-501 is never assessed (note bb). */
const NO_HMF_TYPES = new Set(['22', '31', '32', '34', '38']);

/** MMDDYY (wire format) → YYYYMMDD comparable string; pivot 1970. */
function wireDateToComparable(mmddyy: string): string {
  const yy = Number(mmddyy.slice(4, 6));
  const century = yy >= 70 ? '19' : '20';
  return `${century}${mmddyy.slice(4, 6)}${mmddyy.slice(0, 4)}`;
}

/** Day of week for an MMDDYY wire date (0 = Sunday, 6 = Saturday). */
function wireDateDayOfWeek(mmddyy: string): number {
  const yy = Number(mmddyy.slice(4, 6));
  const year = yy >= 70 ? 1900 + yy : 2000 + yy;
  return new Date(Date.UTC(year, Number(mmddyy.slice(0, 2)) - 1, Number(mmddyy.slice(2, 4)))).getUTCDay();
}

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

  validateBonds(input, entryType, issues);
  validatePsc(input, issues);
  validateCargoRelease(input, issues);
  validateInBond(input, issues);
  validateWarehouseFees(input, entryType, issues);
  validatePayment(input, issues);

  return issues;
}

// ── Workstream C cross-field rules ─────────────────────────

/** Bond configuration tables + waiver restrictions, usage note (i) (ESF-156–158). */
function validateBonds(input: AeEntrySummaryInput, entryType: string, issues: ValidationIssue[]): void {
  const bonds = input.bonds ?? [];
  const push = (field: string, message: string) => issues.push({ severity: 'F', field, message });

  for (const [i, bond] of bonds.entries()) {
    const at = `bonds[${i}]`;
    if (bond.bondTypeCode === '8') {
      // Continuous Bond Claim table (ESF-157).
      if (bond.stbAmountDollars !== undefined) {
        push(`${at}.stbAmountDollars`, 'STB amount never allowed on a continuous bond (ESF-157)');
      }
      if (bond.stbProducerAccountNumber !== undefined) {
        push(`${at}.stbProducerAccountNumber`, 'STB producer account never allowed on a continuous bond (ESF-157)');
      }
      // Continuous supersession/substitution is expressed via the indicator,
      // not the U/E designations (those are STB designations, ESF-49/156).
      if (bond.designationTypeCode === 'U' || bond.designationTypeCode === 'E') {
        push(`${at}.designationTypeCode`, `designation '${bond.designationTypeCode}' is an STB designation — a continuous bond uses the Continuous Bond Indicator (ESF-49/156)`);
      }
    } else {
      // STB Claim table (ESF-158).
      if (bond.continuousBondIndicator !== undefined) {
        push(`${at}.continuousBondIndicator`, 'continuous bond indicator never allowed on an STB (ESF-158)');
      }
      if (bond.stbAmountDollars === undefined || bond.stbAmountDollars <= 0) {
        push(`${at}.stbAmountDollars`, 'STB amount is mandatory and must be greater than $0 (ESF-158)');
      }
    }
  }

  // Allowable configurations (ESF-156–157).
  if (bonds.length === 1) {
    const bond = bonds[0];
    if (bond.designationTypeCode === 'A') {
      push('bonds[0].designationTypeCode', 'a single bond cannot be the Additional bond (ESF-156)');
    } else if (bond.bondTypeCode === '8' && bond.designationTypeCode !== 'B') {
      push('bonds[0].designationTypeCode', 'a lone continuous bond must be the Basic bond (ESF-156)');
    }
  } else if (bonds.length === 2) {
    const additional = bonds.filter((b) => b.designationTypeCode === 'A');
    if (additional.length !== 1) {
      push('bonds', 'a two-bond filing needs exactly one Basic (B/U/E) and one Additional (A) bond (ESF-156–157)');
    } else {
      if (additional[0].bondTypeCode !== '9') {
        push('bonds', 'the Additional bond must be a single transaction bond (ESF-157)');
      }
      const basic = bonds.find((b) => b.designationTypeCode !== 'A')!;
      if (basic.bondTypeCode === '8' && basic.designationTypeCode !== 'B') {
        push('bonds', 'a continuous primary bond must carry the Basic designation (ESF-157)');
      }
    }
  }

  // Waiver restrictions beyond the matrix (ESF-158).
  if (input.bondWaiver !== undefined) {
    const hasAdCvd = (input.lines ?? []).some((l) => (l.adCvdCases?.length ?? 0) > 0);
    if (['06', '21', '22', '23'].includes(entryType) && hasAdCvd) {
      push('bondWaiver', `bond cannot be waived for entry type ${entryType} when an AD/CVD case is reported (ESF-158)`);
    }
    if (entryType === '23' && !hasAdCvd) {
      const nonCanadian = (input.lines ?? []).some((l) => l.countryOfOrigin !== 'CA');
      if (nonCanadian) {
        push('bondWaiver', 'a TIB bond can only be waived when every article is of Canadian origin (ESF-158)');
      }
    }
  }

  // Note (aa): a reconciliation claim requires a continuous bond (ESF-177).
  const recon =
    input.indicators?.tradeAgreementReconciliation === true ||
    input.indicators?.reconciliationIssueCode !== undefined;
  if (recon && !bonds.some((b) => b.bondTypeCode === '8')) {
    issues.push({
      severity: 'F',
      field: 'bonds',
      message: 'a reconciliation claim requires a continuous bond (Bond Type Code 8, usage note aa)',
    });
  }
}

/** Post Summary Correction rules, usage note (gg) (ESF-183–185). */
function validatePsc(input: AeEntrySummaryInput, issues: ValidationIssue[]): void {
  const pscOn = input.indicators?.postSummaryCorrection === true;
  const push = (field: string, message: string) => issues.push({ severity: 'F', field, message });

  if (!pscOn) {
    if (input.psc !== undefined) {
      push('psc', 'PSC reason/explanation records require the PSC indicator (ESF-54/55)');
    }
    for (const [i, line] of (input.lines ?? []).entries()) {
      if ((line.pscReasonCodes?.length ?? 0) > 0) {
        push(`lines[${i}].pscReasonCodes`, 'PSC line reasons require the PSC indicator (ESF-125)');
      }
    }
    if (input.indicators?.acceleratedLiquidation === true) {
      push('indicators.acceleratedLiquidation', 'accelerated liquidation can only be requested on a PSC filing (ESF-33)');
    }
    return;
  }

  // 35-Record reason + 36-Record explanation are mandatory on a PSC (ESF-54/55).
  if ((input.psc?.headerReasonCodes.length ?? 0) === 0) {
    push('psc.headerReasonCodes', 'a PSC filing requires at least one header reason code (ESF-54)');
  }
  if ((input.psc?.explanationLines.length ?? 0) === 0) {
    push('psc.explanationLines', 'a PSC filing requires at least one explanation line (ESF-55/185)');
  } else if (input.psc!.explanationLines.every((t) => /^(n\/?a|none)[.!]?$/i.test(t.trim()))) {
    push('psc.explanationLines', "provide a business explanation — 'N/A'/'None' is not accepted (ESF-185)");
  }

  // PSC Data Element Reporting Restrictions (ESF-184).
  const banned: [string, boolean][] = [
    ['cargoReleaseCertification', input.cargoReleaseCertification === true],
    ['indicators.consolidatedSummary', input.indicators?.consolidatedSummary === true],
    ['indicators.liveEntry', input.indicators?.liveEntry === true],
    ['indicators.tradeAgreementReconciliation', input.indicators?.tradeAgreementReconciliation === true],
    ['indicators.reconciliationIssueCode', input.indicators?.reconciliationIssueCode !== undefined],
    ['payment', input.payment !== undefined],
    ['cargo.locationOfGoodsCode', input.cargo?.locationOfGoodsCode !== undefined],
    ['releases', (input.releases?.length ?? 0) > 0],
  ];
  for (const [field, present] of banned) {
    if (present) push(field, `not allowed in a PSC filing (ESF-184)`);
  }
}

/** Cargo-release certification incompatibilities, usage note (ee) (ESF-28/180). */
function validateCargoRelease(input: AeEntrySummaryInput, issues: ValidationIssue[]): void {
  if (input.cargoReleaseCertification === true && input.indicators?.electronicInvoice === true) {
    issues.push({
      severity: 'F',
      field: 'indicators.electronicInvoice',
      message: 'an EIP claim is not allowed when certifying for cargo release (ESF-180)',
    });
  }
}

/** In-bond / in-transit reporting guidelines (ESF-40/155) + bill hierarchy (note h). */
function validateInBond(input: AeEntrySummaryInput, issues: ValidationIssue[]): void {
  const push = (field: string, message: string) => issues.push({ severity: 'F', field, message });
  const manifests = input.manifests ?? [];
  const hasInBond = manifests.some((m) => m.bills.some((b) => b.type === 'I'));

  if (hasInBond) {
    if (input.cargo?.inBondDate === undefined) {
      push('cargo.inBondDate', 'in-bond date is required when an in-bond number is reported (ESF-40)');
    } else {
      const inBond = wireDateToComparable(input.cargo.inBondDate);
      const estimated = input.header?.estimatedEntryDate;
      // TIB summaries are the stated exception to the estimated-entry cap (ESF-155).
      if (estimated !== undefined && input.entryTypeCode !== '23' && inBond > wireDateToComparable(estimated)) {
        push('cargo.inBondDate', 'in-bond date cannot be later than the estimated entry date (ESF-155)');
      }
      const imported = input.header?.dateOfImportation;
      if (imported !== undefined && inBond < wireDateToComparable(imported)) {
        push('cargo.inBondDate', 'in-bond date cannot be earlier than the import date (ESF-155)');
      }
    }
    // Every manifest detail must report the movement (ESF-155).
    for (const [i, manifest] of manifests.entries()) {
      if (!manifest.bills.some((b) => b.type === 'I')) {
        push(`manifests[${i}].bills`, 'when in-bond movement is claimed, every manifest detail must report an in-bond number (ESF-155)');
      }
    }
    if (
      input.cargo?.districtPortOfUnlading !== undefined &&
      input.cargo.districtPortOfUnlading === input.districtPortOfEntry
    ) {
      push('cargo.districtPortOfUnlading', 'with an in-bond movement the district/port of entry cannot equal the district/port of unlading (ESF-155)');
    }
  } else if (input.cargo?.inBondDate !== undefined) {
    push('cargo.inBondDate', 'in-bond date is only reported with an in-bond movement (ESF-40)');
  }

  // Bill hierarchy + issuer rules (note h, ESF-148–154).
  const mot = input.motCode;
  for (const [i, manifest] of manifests.entries()) {
    const types = new Set(manifest.bills.map((b) => b.type));
    if (types.has('S') && !types.has('H')) {
      push(`manifests[${i}].bills`, 'a sub-house bill cannot be reported without a house bill (note h)');
    }
    if (types.has('H') && !types.has('M')) {
      push(`manifests[${i}].bills`, 'a house bill cannot be reported without a master bill (note h)');
    }
    for (const bill of manifest.bills) {
      if (bill.type === 'S' && bill.issuerCode !== undefined) {
        push(`manifests[${i}].bills`, 'a sub-house issuer code is never allowed (note h)');
      }
      if (bill.type === 'I' && bill.issuerCode !== undefined) {
        push(`manifests[${i}].bills`, 'an in-bond number carries no issuer code (note h)');
      }
      if (bill.type === 'M') {
        if ((mot === '10' || mot === '11') && bill.issuerCode === undefined) {
          push(`manifests[${i}].bills`, 'the master bill issuer (SCAC) is mandatory for vessel shipments (ESF-148)');
        }
        if ((mot === '40' || mot === '41') && bill.issuerCode !== undefined) {
          push(`manifests[${i}].bills`, 'a master bill issuer code is not allowed for air shipments (ESF-153)');
        }
      }
    }
  }
}

/** HMF is never assessed on re-warehouse / withdrawal summaries (note bb, ESF-177–178). */
function validateWarehouseFees(input: AeEntrySummaryInput, entryType: string, issues: ValidationIssue[]): void {
  if (!NO_HMF_TYPES.has(entryType)) return;
  for (const [i, line] of (input.lines ?? []).entries()) {
    if ((line.fees ?? []).some((f) => f.classCode === '501')) {
      issues.push({
        severity: 'F',
        field: `lines[${i}].fees`,
        message: `HMF (501) is never assessed on entry type ${entryType} (usage note bb)`,
      });
    }
  }
}

/** Payment type / statement field rules, usage note (y) (ESF-31/174–176). */
function validatePayment(input: AeEntrySummaryInput, issues: ValidationIssue[]): void {
  const payment = input.payment;
  if (payment === undefined) return;
  const push = (field: string, message: string) => issues.push({ severity: 'F', field, message });
  const t = payment.typeCode;
  const daily = t === '2' || t === '3' || t === '5';
  const monthly = t === '6' || t === '7' || t === '8';

  if (t === '1') {
    if (payment.preliminaryStatementPrintDate !== undefined) {
      push('payment.preliminaryStatementPrintDate', 'not allowed for individual payment (type 1, note y)');
    }
    if (payment.periodicStatementMonth !== undefined) {
      push('payment.periodicStatementMonth', 'not allowed for individual payment (type 1, note y)');
    }
    if (payment.statementClientBranchId !== undefined) {
      push('payment.statementClientBranchId', 'not allowed for individual payment (type 1, note y)');
    }
    return;
  }

  if (payment.preliminaryStatementPrintDate === undefined) {
    push('payment.preliminaryStatementPrintDate', `preliminary statement print date is mandatory for payment type ${t} (note y)`);
  } else {
    const day = wireDateDayOfWeek(payment.preliminaryStatementPrintDate);
    if (day === 0 || day === 6) {
      push('payment.preliminaryStatementPrintDate', 'statement print date cannot be a weekend day (note y)');
    }
  }

  if (daily && payment.periodicStatementMonth !== undefined) {
    push('payment.periodicStatementMonth', `not allowed for daily statement type ${t} (note y)`);
  }
  if (monthly) {
    const month = payment.periodicStatementMonth;
    if (month === undefined) {
      push('payment.periodicStatementMonth', `periodic statement month is mandatory for payment type ${t} (note y)`);
    } else if (!/^(0[1-9]|1[0-2])$/.test(month)) {
      push('payment.periodicStatementMonth', `expected MM month, got '${month}' (ESF-31)`);
    }
    // An article subject to IR tax cannot be paid on a monthly statement (ESF-175/176).
    for (const [i, line] of (input.lines ?? []).entries()) {
      if (line.irTax !== undefined) {
        push(`lines[${i}].irTax`, 'IR-tax articles cannot be paid on a periodic monthly statement (note y)');
      }
    }
  }
}
