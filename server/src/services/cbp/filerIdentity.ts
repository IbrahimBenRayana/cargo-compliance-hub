/**
 * Who files (native go-live Phase 2; audit BNA-01, FNA-04).
 *
 * OrgCbpConfig is the only source of a client's filer identity; nothing a
 * client types decides it. Rules (CBP, Michael Barela, 10/15/2026):
 *   - ISF in SIGMA mode goes out under S7P: Sigma is the ISF filer, so no
 *     client approval is needed.
 *   - ISF in CLIENT mode, and every entry, go out under the client's own
 *     filer code, and only after their CBP client rep added our queue as
 *     their service center.
 *   - Entry numbers must carry the client's filer code and a valid check
 *     digit; S7P or another org's code is refused.
 */
import { prisma } from '../../config/database.js';
import { computeEntryCheckDigit } from '../../abi-engine/ae/checkDigit.js';

export const SIGMA_FILER_CODE = 'S7P';

export type IsfFilerMode = 'SIGMA' | 'CLIENT';

export interface OrgCbpConfigLike {
  filerCode: string | null;
  isfFilerModeDefault: string;
  serviceCenterApprovedAt: Date | null;
}

export type FilerRefusalCode =
  | 'CBP_SETUP_INCOMPLETE'
  | 'SERVICE_CENTER_NOT_APPROVED'
  | 'ENTRY_FILER_MISMATCH'
  | 'ENTRY_CHECK_DIGIT'
  | 'ENTRY_NUMBER_FORMAT';

export type FilerDecision =
  | { ok: true; filerCode: string; mode?: IsfFilerMode }
  | { ok: false; code: FilerRefusalCode; message: string };

function clientCodeReady(cfg: OrgCbpConfigLike | null): FilerDecision {
  if (!cfg?.filerCode) {
    return {
      ok: false,
      code: 'CBP_SETUP_INCOMPLETE',
      message: 'Your CBP filer code is not set up yet. Contact MyCargoLens support to complete your CBP setup.',
    };
  }
  if (!cfg.serviceCenterApprovedAt) {
    return {
      ok: false,
      code: 'SERVICE_CENTER_NOT_APPROVED',
      message: `Your CBP client rep has not yet approved MyCargoLens as the service center for filer code ${cfg.filerCode}.`,
    };
  }
  return { ok: true, filerCode: cfg.filerCode };
}

export function resolveIsfFiler(cfg: OrgCbpConfigLike | null, filingMode: string | null | undefined): FilerDecision {
  const mode: IsfFilerMode = (filingMode ?? cfg?.isfFilerModeDefault ?? 'SIGMA') === 'CLIENT' ? 'CLIENT' : 'SIGMA';
  if (mode === 'SIGMA') return { ok: true, filerCode: SIGMA_FILER_CODE, mode };
  const ready = clientCodeReady(cfg);
  return ready.ok ? { ...ready, mode } : ready;
}

export function checkEntryFiler(cfg: OrgCbpConfigLike | null, entryNumber: string): FilerDecision {
  const ready = clientCodeReady(cfg);
  if (!ready.ok) return ready;
  const flat = entryNumber.replace(/-/g, '').toUpperCase();
  if (!/^[A-Z0-9]{3}\d{8}$/.test(flat)) {
    return { ok: false, code: 'ENTRY_NUMBER_FORMAT', message: `Entry number ${entryNumber} is not in CBP format (filer code, 7-digit sequence, check digit).` };
  }
  const filer = flat.slice(0, 3);
  if (filer !== ready.filerCode) {
    return {
      ok: false,
      code: 'ENTRY_FILER_MISMATCH',
      message: `Entry number ${entryNumber} uses filer code ${filer}; your entries must use your filer code ${ready.filerCode}.`,
    };
  }
  const expected = computeEntryCheckDigit(filer, flat.slice(3, 10));
  if (Number(flat[10]) !== expected) {
    return { ok: false, code: 'ENTRY_CHECK_DIGIT', message: `Entry number ${entryNumber} has an invalid check digit (expected ${expected}).` };
  }
  return { ok: true, filerCode: filer };
}

export async function loadOrgCbpConfig(orgId: string): Promise<OrgCbpConfigLike & { gateway: string } | null> {
  return prisma.orgCbpConfig.findUnique({
    where: { orgId },
    select: { filerCode: true, isfFilerModeDefault: true, serviceCenterApprovedAt: true, gateway: true },
  });
}
