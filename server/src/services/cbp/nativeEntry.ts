/**
 * Native entry transmission (native go-live 4.1): send an entry summary
 * (AE) through our own certified engine, certified for cargo release when
 * the entry type has one, exactly the way scenarios 009 and 061 passed CERT.
 *
 *   1. lifecycle allows the action (entryLifecycle)
 *   2. filer identity: the entry number carries the org's own filer code
 *      with a valid check digit and an approved service-center queue
 *   3. build: v1 payload -> v2 -> duty -> AE input; for release
 *      certification add the SE13 contact and the SE/BY cargo entities CBP
 *      requires (live SX 11035/11037/11208 on 061), all from real data
 *   4. the engine's CATAIR validator must pass; issues -> 422 with fields
 *   5. atomic claim, then transmitNative (row first; FAILED rolls back,
 *      UNKNOWN stays awaiting CBP); CBP's AX/SX settle it (entryVerdicts)
 */
import { entryRuleIssues } from '../../schemas/abiDocument.js';
import { prisma } from '../../config/database.js';
import { env } from '../../config/env.js';
import { migrateV1ToV2 } from '../../abi-engine/payload/migrateV1.js';
import { enrichWithDuty } from '../../abi-engine/duty/engine.js';
import { DbHtsRateSource } from '../../abi-engine/refdata/dbRateSource.js';
import { toAeEntrySummaryInput } from '../../abi-engine/payload/toAeInput.js';
import { validateEntrySummary } from '../../abi-engine/validate/entrySummary.js';
import { buildEntrySummary, type AeCargoEntity } from '../../abi-engine/ae/builder.js';
import { buildBatch } from '../../abi-engine/envelope/batch.js';
import { RecordCodecError } from '../../abi-engine/records/codec.js';
import type { AbiDocumentBody, AbiParty } from '../abi/types.js';
import { writeAuditLog } from '../auditLog.js';
import { canStartEntryAction, entryStateOnStart, type EntryAction } from './entryLifecycle.js';
import { checkEntryFiler, loadOrgCbpConfig } from './filerIdentity.js';
import { transmitNative } from './nativeTransmit.js';
import { convertInvoiceValuesToUsd, CurrencyConversionError, type CurrencyConversion } from './currency.js';
import { cbpTransport, cbpTrafficConfig } from './transport.js';
import { requireCbpSender } from './sender.js';

const ACTION_CODE: Record<EntryAction, 'A' | 'R' | 'D'> = { ADD: 'A', REPLACE: 'R', DELETE: 'D' };
/** Entry types whose AE is certified for cargo release (combined 3461+7501);
 *  CATAIR note ee bars only 3x and 51, so 03 certifies like 01. */
const RELEASE_ENTRY_TYPES = new Set(['01', '03', '11']);

export interface EntryTransmitOutcome {
  httpStatus: number;
  body: Record<string, unknown>;
}

const upper = (v: string | undefined | null) => (v ?? '').trim().toUpperCase();

/**
 * Cargo-release header entities from the entry's own parties: the seller by
 * name and address (SE30 Note 2: the identifier route is BY/ST only) and the
 * buyer as the importer's identifier. Never invented: a missing seller is a
 * missing-data error.
 */
function releaseEntities(body: AbiDocumentBody): { entities: AeCargoEntity[] } | { missing: string } {
  const parties: AbiParty[] = body.manifest?.flatMap((m) => m.invoices?.flatMap((inv) => inv.items?.flatMap((it) => it.parties ?? []) ?? []) ?? []) ?? [];
  const seller = parties.find((p) => p.type === 'seller' && p.name);
  if (!seller?.name || !seller.address || !seller.city || !seller.country) {
    return { missing: 'A seller with name, street, city and country is required to certify the entry for cargo release (SE30-SE36).' };
  }
  const ior = upper(body.ior?.number);
  if (!ior) return { missing: 'The importer of record number is required.' };
  return {
    entities: [
      {
        code: 'SE',
        name: upper(seller.name).slice(0, 35),
        addressComponents: [{ qualifier: '15', information: upper(seller.address).slice(0, 35) }],
        geography: {
          city: upper(seller.city).slice(0, 35),
          countrySubEntityCode: upper(seller.state).slice(0, 3) || undefined,
          postalCode: upper(seller.postalCode).replace(/\s/g, '').slice(0, 15) || undefined,
          countryCode: upper(seller.country).slice(0, 2),
        },
      },
      { code: 'BY', identifier: { qualifier: 'EI', value: ior } },
    ],
  };
}

type BuildOutcome =
  | {
      ok: true;
      doc: NonNullable<Awaited<ReturnType<typeof prisma.abiDocument.findFirst>>>;
      body: AbiDocumentBody;
      lines: string[];
      districtPort: string;
      filerCode: string;
      releaseRequested: boolean;
      conversions: CurrencyConversion[];
    }
  | { ok: false; httpStatus: number; body: Record<string, unknown> };

/**
 * Everything short of sending: lifecycle and filer checks, currency
 * conversion, the full CATAIR build and the engine's validator. Used by the
 * transmit and by the preflight that shows the filer every issue up front.
 */
/** Line-party rules (ESF-134 matrix) in words a filer can act on. */
const LINE_PARTY_WORDS: Record<string, string> = {
  S: 'a Buyer party with its tax ID (CBP "sold to" party, required for this entry type)',
  M: 'a Manufacturer party with its name, street, city and country (CBP builds the MID from it)',
};
function wordLinePartyIssue<T extends { field: string; message: string }>(issue: T): T {
  const m = /^lines\[(\d+)\]\.parties\[([A-Z])\]$/.exec(issue.field);
  const words = m && LINE_PARTY_WORDS[m[2]];
  return words ? { ...issue, message: `Line ${Number(m[1]) + 1} needs ${words}.` } : issue;
}

export async function buildNativeEntry(opts: {
  docId: string;
  orgId: string;
  userId: string;
  action: EntryAction;
}): Promise<BuildOutcome> {

  const doc = await prisma.abiDocument.findFirst({ where: { id: opts.docId, orgId: opts.orgId } });
  if (!doc) return { ok: false, httpStatus: 404, body: { error: 'Entry not found' } };
  if (doc.entryType === '86') {
    return {
      ok: false,
      httpStatus: 422,
      body: { error: 'CBP no longer accepts Type 86 (de minimis) entries. File this shipment as a formal (01) or informal (11) entry.', code: 'entry_type_suspended' },
    };
  }

  const allowed = canStartEntryAction(doc, opts.action);
  if (!allowed.ok) return { ok: false, httpStatus: 409, body: { error: allowed.reason, code: 'ENTRY_ACTION_NOT_ALLOWED' } };

  const body = doc.payload as unknown as AbiDocumentBody;
  const filer = checkEntryFiler(await loadOrgCbpConfig(opts.orgId), String(body?.entryNumber ?? ''));
  if (!filer.ok) return { ok: false, httpStatus: 422, body: { error: filer.message, code: filer.code } };

  // The entry rules the schema enforces (lading port, bond amount, statement
  // payment, AD/CVD vs type 03) apply to the native send too.
  if (opts.action !== 'DELETE') {
    const ruleIssues = entryRuleIssues(body);
    if (ruleIssues.length > 0) {
      return {
        ok: false,
        httpStatus: 422,
        body: {
          error: ruleIssues.length === 1 ? ruleIssues[0].message : 'This entry is missing required information.',
          code: 'ENTRY_DATA_INCOMPLETE',
          issues: ruleIssues.map((i) => ({ record: 'Entry', field: i.path.join('.'), message: i.message })),
        },
      };
    }
  }

  const releaseRequested = opts.action !== 'DELETE' && RELEASE_ENTRY_TYPES.has(doc.entryType);
  // Foreign invoice values become USD at CBP's certified rate (audit ENG-02).
  let conversions: CurrencyConversion[] = [];
  let usdBody: AbiDocumentBody;
  try {
    ({ body: usdBody, conversions } = await convertInvoiceValuesToUsd(body));
  } catch (err) {
    if (err instanceof CurrencyConversionError) {
      return { ok: false, httpStatus: 422, body: { error: err.message, code: err.code } };
    }
    throw err;
  }
  let lines: string[];
  let districtPort: string;
  try {
    const now = new Date();
    const applicabilityDate = `${now.getUTCFullYear()}${String(now.getUTCMonth() + 1).padStart(2, '0')}${String(now.getUTCDate()).padStart(2, '0')}`;
    const priced = await enrichWithDuty(migrateV1ToV2(usdBody), new DbHtsRateSource(prisma.htsRateLine), { applicabilityDate });
    const input = toAeEntrySummaryInput(priced, ACTION_CODE[opts.action]);
    districtPort = input.districtPortOfEntry;

    // Informal entries are limited to $2,500 (19 CFR 143.21(a)); chapter 98
    // provisions carry their own limits (AE Table 9) and are left to ACE.
    if (doc.entryType === '11') {
      const lines = priced.entrySummary.lines;
      const totalUsd = lines.reduce((sum, l) => sum + l.tariffs.reduce((t, x) => t + x.valueDollars, 0), 0);
      const chapter98 = lines.some((l) => l.tariffs.some((t) => t.htsNumber.startsWith('98')));
      if (totalUsd > 2500 && !chapter98) {
        return {
          ok: false,
          httpStatus: 422,
          body: {
            error: `Informal entries are limited to $2,500 and this one totals $${totalUsd.toLocaleString('en-US')}. File it as a formal entry (01).`,
            code: 'INFORMAL_VALUE_LIMIT',
          },
        };
      }
    }

    if (releaseRequested) {
      const [user, org] = await Promise.all([
        prisma.user.findUnique({ where: { id: opts.userId }, select: { firstName: true, lastName: true } }),
        prisma.organization.findUnique({ where: { id: opts.orgId }, select: { phone: true } }),
      ]);
      const name = upper(`${user?.firstName ?? ''} ${user?.lastName ?? ''}`).slice(0, 35);
      const phone = (org?.phone ?? '').replace(/\D/g, '').slice(-10);
      if (!name || phone.length < 10) {
        return {
          ok: false,
          httpStatus: 422,
          body: {
            error: 'CBP needs a contact name and a 10-digit phone number to certify an entry for cargo release. Add your organization phone number in Settings.',
            code: 'CERTIFY_CONTACT_MISSING',
          },
        };
      }
      const entities = releaseEntities(body);
      if ('missing' in entities) return { ok: false, httpStatus: 422, body: { error: entities.missing, code: 'ENTRY_DATA_INCOMPLETE' } };
      input.cargoReleaseCertification = true;
      input.certifyContact = { name, phone };
      input.cargoEntities = entities.entities;
    }

    const issues = validateEntrySummary(input).map(wordLinePartyIssue);
    if (issues.length > 0) {
      return { ok: false, httpStatus: 422, body: { error: 'This entry does not meet CBP rules yet.', code: 'ENTRY_DATA_INCOMPLETE', issues } };
    }
    lines = buildEntrySummary(input);
  } catch (err) {
    if (err instanceof RecordCodecError) {
      return { ok: false, httpStatus: 422, body: { error: 'This entry is missing required information.', code: 'ENTRY_DATA_INCOMPLETE', issues: err.issues } };
    }
    throw err;
  }

  return { ok: true, doc, body, lines, districtPort, filerCode: filer.filerCode, releaseRequested, conversions };
}

export async function transmitEntryNative(opts: {
  docId: string;
  orgId: string;
  userId: string;
  action: EntryAction;
}): Promise<EntryTransmitOutcome> {
  if (cbpTrafficConfig.transport === 'mock' && env.NODE_ENV === 'production') {
    return { httpStatus: 503, body: { error: 'This server is not connected to CBP yet.', code: 'CBP_NOT_CONNECTED' } };
  }
  const built = await buildNativeEntry(opts);
  if (!built.ok) return { httpStatus: built.httpStatus, body: built.body };
  const { doc, body, lines, districtPort, releaseRequested, conversions } = built;
  const filer = { filerCode: built.filerCode };

  const sender = requireCbpSender();
  const started = entryStateOnStart(doc, opts.action);
  const claimed = await prisma.abiDocument.updateMany({
    where: { id: doc.id, pendingAction: null, status: doc.status },
    data: {
      status: started.status,
      pendingAction: started.pendingAction,
      entrySummaryStatus: started.entrySummaryStatus,
      cargoReleaseStatus: started.cargoReleaseStatus,
      ...(opts.action !== 'DELETE' && { releaseRequested }),
      lastError: null,
    },
  });
  if (claimed.count === 0) {
    return { httpStatus: 409, body: { error: 'This entry is already being transmitted.', code: 'ENTRY_ALREADY_PENDING' } };
  }

  const result = await transmitNative({
    transport: cbpTransport,
    orgId: opts.orgId,
    environment: cbpTrafficConfig.transport === 'mock' ? 'MOCK' : cbpTrafficConfig.environment === 'PROD' ? 'PROD' : 'CERT',
    application: 'AE',
    action: ACTION_CODE[opts.action],
    entityType: 'abi_document',
    entityId: doc.id,
    filerCode: filer.filerCode,
    entryNumber: String(body.entryNumber).replace(/-/g, '').toUpperCase(),
    buildWire: (userDataTag) =>
      buildBatch({ sender, appId: 'AE', blocks: [{ port: districtPort, filerCode: filer.filerCode, userData: userDataTag, transactionLines: lines }] }),
  });

  if (result.status === 'FAILED') {
    await prisma.abiDocument.update({
      where: { id: doc.id },
      data: {
        status: doc.status,
        pendingAction: null,
        entrySummaryStatus: doc.entrySummaryStatus,
        cargoReleaseStatus: doc.cargoReleaseStatus,
        lastTransmissionId: result.id,
        lastError: result.lastError ?? 'Not sent',
      },
    });
    return { httpStatus: 502, body: { error: 'The entry could not be sent to CBP. Nothing was transmitted; you can try again.', detail: result.lastError } };
  }

  await prisma.abiDocument.update({
    where: { id: doc.id },
    data: { lastTransmissionId: result.id, sentAt: new Date(), lastError: result.status === 'UNKNOWN' ? result.lastError : null },
  });
  writeAuditLog({
    orgId: opts.orgId, userId: opts.userId,
    action: `entry.native_${opts.action.toLowerCase()}`, entityType: 'abi_document', entityId: doc.id,
    newValue: { transmissionId: result.id, outcome: result.status, filerCode: filer.filerCode, releaseRequested, currencyConversions: conversions },
  });
  return {
    httpStatus: 202,
    body: { transmissionId: result.id, outcome: result.status, filerCode: filer.filerCode, status: started.status, pendingAction: started.pendingAction, releaseRequested },
  };
}
