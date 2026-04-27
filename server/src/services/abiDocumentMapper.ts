import type { AbiDocument, Prisma } from '@prisma/client';
import {
  abiDocumentBodySchema,
  type ABIDocumentBody,
} from '../schemas/abiDocument.js';
import type {
  CCABICreateDocumentPayload,
  CCABISendPayload,
} from './customscity.js';

/**
 * Wrap the stored ABI document payload in the CC envelope expected by
 * `POST /api/abi/documents`:
 *   { type: 'abi', version: '2.1', body: [<payload>] }
 *
 * The payload is validated against `abiDocumentBodySchema` — this runs at
 * transmit time (the wizard saves partial drafts, so draft-time writes use
 * the deep-partial schema instead).
 *
 * Throws a ZodError if the payload is not a complete, valid ABI body.
 */
export function mapABIDocumentToCC(
  doc: { payload: Prisma.JsonValue }
): CCABICreateDocumentPayload {
  const body: ABIDocumentBody = abiDocumentBodySchema.parse(doc.payload);

  // CC strips hyphens from entry numbers on its side, but we normalise
  // here too so the value we send matches the value we'll receive back.
  const normalised: ABIDocumentBody = {
    ...body,
    entryNumber: body.entryNumber.replace(/-/g, ''),
  };

  return {
    type: 'abi',
    version: '2.1',
    body: [normalised],
  };
}

/**
 * Build the `POST /api/abi/send` body. Phase 1 only exercises
 * `action: 'add'` + `application: 'entry-summary-cargo-release'`.
 *
 * Requires `doc.mbolNumber` and `doc.entryNumber` — callers must have
 * already denormalised those from the payload before invoking this.
 */
export function buildSendPayload(
  doc: Pick<AbiDocument, 'mbolNumber' | 'entryNumber'>,
  action: CCABISendPayload['action']
): CCABISendPayload {
  if (!doc.mbolNumber) {
    throw new Error('Cannot build ABI send payload: missing MBOL number');
  }
  if (!doc.entryNumber) {
    throw new Error('Cannot build ABI send payload: missing entry number');
  }

  return {
    type: 'abi',
    action,
    application: 'entry-summary-cargo-release',
    MBOLNumber: doc.mbolNumber,
    entryNumber: [doc.entryNumber],
  };
}

/**
 * Extract shipment-level fields from a completed ManifestQuery response
 * into a draft-shaped partial that the wizard can pre-fill.
 *
 * The `response.data.response[0]` item follows the CCManifestResponseItem
 * shape; the first child house (if present) supplies HBOL / port details.
 *
 * Dates from CC come through as YYYYMMDD strings already; we pass them
 * through unchanged (ABI uses YYYYMMDD strings, unlike ISF which uses ints).
 */
export function prefillFromManifestQuery(
  manifestQuery: { response: Prisma.JsonValue }
): Partial<ABIDocumentBody> {
  const resp = manifestQuery.response as any;
  const item = resp?.data?.response?.[0];
  if (!item) return {};

  const firstHouse = Array.isArray(item.houses) ? item.houses[0] : undefined;

  const mBOL: string | undefined =
    item.masterBOLNumber ?? resp?.data?.masterBOLNumber ?? item.awbNumber;
  const hBOL: string | undefined =
    firstHouse?.hawbNumber ?? firstHouse?.awbNumber;
  const carrierCode: string | undefined = item.carrierCode ?? item.importingCarrierCode;
  const portOfUnlading: string | undefined =
    item.manifestedPortOfUnlading ?? firstHouse?.manifestedPort ?? item.actualPortOcean;
  const arrivalDate: string | undefined =
    item.scheduledArrivalDate ?? firstHouse?.scheduledArrivalDate ?? item.wr1DateOfArrival;

  const prefill: Partial<ABIDocumentBody> = {};

  // Shipment-level manifest block (single entry)
  const manifestEntry: any = {};
  if (mBOL || hBOL) {
    manifestEntry.bill = {
      type: hBOL ? 'H' : 'M',
      mBOL: mBOL ?? '',
      hBOL: hBOL ?? '',
      groupBOL: 'N',
    };
  }
  if (carrierCode) {
    manifestEntry.carrier = { code: carrierCode };
  }
  if (portOfUnlading) {
    manifestEntry.ports = { portOfUnlading };
  }

  if (Object.keys(manifestEntry).length > 0) {
    prefill.manifest = [manifestEntry];
  }

  if (arrivalDate && /^\d{8}$/.test(arrivalDate)) {
    prefill.dates = { arrivalDate } as any;
  }

  return prefill;
}
