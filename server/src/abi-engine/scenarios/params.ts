/**
 * Certification-run parameters (Phase 3 scenario harness).
 *
 * The CBP test package leaves a handful of values to the client rep
 * ("Client Rep will supply") or to the run itself (current year). Every
 * scenario fixture takes its environment from this object so the same
 * fixtures drive both the internal dry-run (deterministic goldens) and
 * the real CERT transmission later.
 */
import type { SenderIdentity } from '../envelope/batch.js';

export interface CertParams {
  sender: SenderIdentity;
  /** CBP-assigned filer code (3) — pending issuance (LOI in process). */
  filerCode: string;
  /** Processing district/port for the B-record and 10-record. */
  districtPortOfEntry: string;
  /** Importer of record (IR# format NN-NNNNNNNNN) — client rep will supply. */
  importerOfRecordNumber: string;
  importerName: string;
  /** Consignee id (defaults to the IOR). */
  consigneeNumber: string;
  /** Surety company code for continuous-bond scenarios. */
  suretyCompanyCode: string;
  /**
   * Four-digit year substituted for the package's "YY = Current Year"
   * dates. Fixed in dry-runs so goldens stay byte-stable.
   */
  currentYear: string;
  /** Rate applicability date (YYYYMMDD) for the duty engine. */
  applicabilityDate: string;
}

/**
 * Deterministic dry-run parameters. Placeholders are shaped like the real
 * values (so field widths and check digits are exercised) but are clearly
 * fake; the CERT run swaps in the client-rep-supplied CertParams.
 */
export const DRY_RUN_PARAMS: CertParams = {
  sender: { siteCode: 'LA', idCode: 'MCL', password: 'PASSWD' },
  filerCode: 'ZZZ',
  districtPortOfEntry: '2704',
  importerOfRecordNumber: '26-164751100',
  importerName: 'SIGMA TECHNOLOGY PARTNERS LLC',
  consigneeNumber: '26-164751100',
  suretyCompanyCode: '123',
  currentYear: '2026',
  applicabilityDate: '20260820',
};

/** Entry number sequence for a scenario: deterministic, unique, 7 digits. */
export function entrySequenceFor(scenarioId: string): string {
  return scenarioId.padStart(7, '0');
}

/** Broker reference per the package: 3-char scenario number, right justified. */
export function brokerReferenceFor(scenarioId: string): string {
  return scenarioId.padStart(3, '0');
}
