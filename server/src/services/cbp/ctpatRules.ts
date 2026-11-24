/**
 * CTPAT pre-send rules for CBP's foreign importer of record rule
 * (docs/specs/foreign-ior-rule.md §4). CBP looks up CTPAT itself; we only
 * know what the org told us about itself and the importer, so these predict
 * CBP's answer rather than decide it:
 *   R2  broker as IOR, filer not CTPAT validated, no principal → block (ES 892)
 *   R4  foreign IOR, broker not IOR, importer and filer not validated → warn (ES 894)
 *   R5  foreign IOR, broker as IOR, filer and principal not validated → warn (ES 894)
 * Warnings need an explicit "send anyway" (founder decision 2, Nov 16 2026).
 * R1, R3 and R6 are enforced by the engine validator and the wizard.
 */
export type CtpatStatus = 'VALIDATED' | 'NONE' | 'UNKNOWN';

export interface CtpatWarning {
  code: 'CTPAT_FOREIGN_IOR' | 'CTPAT_PRINCIPAL';
  message: string;
}

export interface CtpatCheckInput {
  declaration?: { usImporterOfRecord: boolean; brokerActingAsIor: boolean; principalOnPoa?: string };
  /** The filing org's own CTPAT validation. */
  filerCtpat: string;
  /** The importer's (or, with the broker as IOR, the principal's) CTPAT validation. */
  iorCtpat?: string;
}

export function ctpatChecks(input: CtpatCheckInput): {
  blocks: { field: string; message: string }[];
  warnings: CtpatWarning[];
} {
  const blocks: { field: string; message: string }[] = [];
  const warnings: CtpatWarning[] = [];
  const d = input.declaration;
  if (!d) return { blocks, warnings };
  const filerValidated = input.filerCtpat === 'VALIDATED';
  const iorValidated = input.iorCtpat === 'VALIDATED';

  if (d.brokerActingAsIor && !filerValidated && !d.principalOnPoa) {
    blocks.push({
      field: 'ior.principalOnPoa',
      message:
        "Your brokerage is the importer of record and is not marked CTPAT validated, so CBP needs your client's importer number (the principal on your power of attorney). Without it CBP rejects the entry (error 892).",
    });
  }

  if (!d.usImporterOfRecord && !filerValidated && !iorValidated) {
    warnings.push(
      d.brokerActingAsIor
        ? {
            code: 'CTPAT_PRINCIPAL',
            message:
              'CBP will likely reject this entry (error 894): the importer of record is foreign, and neither your brokerage nor your client is marked CTPAT validated.',
          }
        : {
            code: 'CTPAT_FOREIGN_IOR',
            message:
              'CBP will likely reject this entry (error 894): the importer of record is foreign, and neither the importer nor your company is marked CTPAT validated.',
          }
    );
  }
  return { blocks, warnings };
}
