/**
 * U.S. importer of record attestation (CBP foreign IOR rule, 19 CFR 110.2;
 * docs/specs/foreign-ior-rule.md §5). When a user declares the IOR a U.S.
 * importer of record in the entry wizard they tick an attestation box
 * (`ior.usIorAttested`); the server, never the browser, records who ticked
 * it and when. The stamp belongs to one declaration for one IOR number:
 * changing the number or the answer drops it.
 *
 * The draft schema strips unknown keys, so a client cannot send the stamp
 * fields itself.
 */
export interface IorAttestationStamp {
  usIorAttestedById: string;
  usIorAttestedByEmail: string;
  usIorAttestedAt: string;
}

type IorSlice = Record<string, unknown> & {
  number?: unknown;
  usImporterOfRecord?: unknown;
  usIorAttested?: unknown;
};

const STAMP_KEYS: (keyof IorAttestationStamp)[] = ['usIorAttestedById', 'usIorAttestedByEmail', 'usIorAttestedAt'];

function attested(ior: IorSlice | undefined): boolean {
  return ior?.usImporterOfRecord === true && ior?.usIorAttested === true;
}

/**
 * The merged payload with the attestation stamp carried forward, freshly
 * set, or removed. `previous` is the payload before this update.
 */
export function stampIorAttestation<P extends { ior?: unknown }>(
  previous: { ior?: unknown } | null | undefined,
  merged: P,
  user: { id: string; email: string },
  now: Date = new Date(),
  /** A saved importer's existing U.S. attestation, kept instead of a new stamp. */
  saved?: IorAttestationStamp
): P {
  const ior = merged.ior as IorSlice | undefined;
  if (!ior || typeof ior !== 'object') return merged;

  const next: IorSlice = { ...ior };
  for (const key of STAMP_KEYS) delete next[key];

  if (attested(ior)) {
    const before = previous?.ior as IorSlice | undefined;
    const sameDeclaration = attested(before) && before?.number === ior.number && typeof before?.usIorAttestedAt === 'string';
    if (sameDeclaration) {
      for (const key of STAMP_KEYS) next[key] = before![key];
    } else if (saved) {
      Object.assign(next, saved);
    } else {
      next.usIorAttestedById = user.id;
      next.usIorAttestedByEmail = user.email;
      next.usIorAttestedAt = now.toISOString();
    }
  } else if (ior.usIorAttested !== undefined && ior.usImporterOfRecord !== true) {
    // The box only means something next to a U.S. declaration.
    delete next.usIorAttested;
  }
  return { ...merged, ior: next };
}
