/**
 * Saved importers (CBP foreign IOR rule, docs/specs/foreign-ior-rule.md §3).
 * When an entry's declaration is complete, the org's answer for that
 * importer of record is remembered, so the next entry for the same IOR
 * fills itself in. The entry payload stays the legal declaration.
 */
import { prisma } from '../config/database.js';
import { canonicalImporterNumber } from '../abi-engine/records/importerNumber.js';
import type { IorAttestationStamp } from './abi/iorAttestation.js';

type IorSlice = {
  number?: unknown;
  name?: unknown;
  usImporterOfRecord?: unknown;
  ctpatStatus?: unknown;
  usIorAttestedById?: unknown;
  usIorAttestedByEmail?: unknown;
  usIorAttestedAt?: unknown;
};

export interface ProfileUpsert {
  iorNumber: string;
  iorNumberType: string;
  name: string | null;
  usIorStatus: 'US' | 'FOREIGN';
  ctpatStatus: string | undefined;
  declaredById: string;
  declaredByEmail: string;
  declaredAt: Date;
}

/**
 * The profile an entry's `ior` slice declares, or null when it declares
 * nothing worth remembering: no valid number, no answer, or a U.S. answer
 * nobody has attested yet.
 */
export function profileFromIor(
  ior: IorSlice | undefined,
  user: { id: string; email: string },
  now: Date = new Date()
): ProfileUpsert | null {
  if (!ior || typeof ior.number !== 'string' || typeof ior.usImporterOfRecord !== 'boolean') return null;
  const number = canonicalImporterNumber(ior.number);
  if (!number) return null;
  const ctpatStatus = typeof ior.ctpatStatus === 'string' ? ior.ctpatStatus : undefined;
  const name = typeof ior.name === 'string' && ior.name ? ior.name : null;
  if (ior.usImporterOfRecord) {
    if (typeof ior.usIorAttestedAt !== 'string' || typeof ior.usIorAttestedById !== 'string') return null;
    return {
      iorNumber: number.number,
      iorNumberType: number.type,
      name,
      usIorStatus: 'US',
      ctpatStatus,
      declaredById: ior.usIorAttestedById,
      declaredByEmail: String(ior.usIorAttestedByEmail ?? ''),
      declaredAt: new Date(ior.usIorAttestedAt),
    };
  }
  return {
    iorNumber: number.number,
    iorNumberType: number.type,
    name,
    usIorStatus: 'FOREIGN',
    ctpatStatus,
    declaredById: user.id,
    declaredByEmail: user.email,
    declaredAt: now,
  };
}

/** Remember the entry's declaration; writes only when the answer changed. */
export async function rememberImporter(orgId: string, ior: IorSlice | undefined, user: { id: string; email: string }): Promise<void> {
  const next = profileFromIor(ior, user);
  if (!next) return;
  const existing = await prisma.importerProfile.findUnique({
    where: { orgId_iorNumber: { orgId, iorNumber: next.iorNumber } },
  });
  // The declarer only changes with the answer (or a fresh U.S. attestation).
  const sameDeclaration =
    existing?.usIorStatus === next.usIorStatus &&
    (next.usIorStatus === 'FOREIGN' || existing.declaredAt?.getTime() === next.declaredAt.getTime());
  const ctpatStatus = next.ctpatStatus ?? existing?.ctpatStatus ?? 'UNKNOWN';
  const name = next.name ?? existing?.name ?? null;
  if (existing && sameDeclaration && existing.ctpatStatus === ctpatStatus && existing.name === name) return;

  const declared = sameDeclaration && existing
    ? { declaredById: existing.declaredById, declaredByEmail: existing.declaredByEmail, declaredAt: existing.declaredAt }
    : { declaredById: next.declaredById, declaredByEmail: next.declaredByEmail, declaredAt: next.declaredAt };
  await prisma.importerProfile.upsert({
    where: { orgId_iorNumber: { orgId, iorNumber: next.iorNumber } },
    create: { orgId, iorNumber: next.iorNumber, iorNumberType: next.iorNumberType, name, usIorStatus: next.usIorStatus, ctpatStatus, ...declared },
    update: { name, usIorStatus: next.usIorStatus, ctpatStatus, ...declared },
  });
}

/** The saved importer for a typed IOR number, if any. */
export async function findImporterProfile(orgId: string, rawNumber: string) {
  const number = canonicalImporterNumber(rawNumber);
  if (!number) return null;
  return prisma.importerProfile.findUnique({ where: { orgId_iorNumber: { orgId, iorNumber: number.number } } });
}

/**
 * The attestation a saved U.S. importer already carries, so a new entry for
 * the same IOR keeps the original declarer instead of re-stamping.
 */
export async function savedAttestation(orgId: string, rawNumber: unknown): Promise<IorAttestationStamp | undefined> {
  if (typeof rawNumber !== 'string') return undefined;
  const profile = await findImporterProfile(orgId, rawNumber);
  if (profile?.usIorStatus !== 'US' || !profile.declaredById || !profile.declaredAt) return undefined;
  return {
    usIorAttestedById: profile.declaredById,
    usIorAttestedByEmail: profile.declaredByEmail ?? '',
    usIorAttestedAt: profile.declaredAt.toISOString(),
  };
}
