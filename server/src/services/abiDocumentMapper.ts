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
/**
 * Pre-fill an ABI draft from an existing ISF Filing record. Pulls IOR,
 * consignee, master/house BOL, carrier (SCAC), bond type, and estimated
 * arrival date. Bond type is translated from the ISF enum
 * ("continuous" | "single") to the ABI enum ("8" | "9"). Fields the user
 * still has to fill: bond.taxId, payment, firms, location.portOfEntry,
 * destinationStateUS, dates.entryDate / importDate, manifest.ports,
 * quantity / quantityUOM, the entire invoices tree, and the filer-assigned
 * entryNumber.
 */
export function prefillFromFiling(filing: any): Partial<ABIDocumentBody> {
  const prefill: Partial<ABIDocumentBody> = {};

  if (filing.importerName || filing.importerNumber) {
    prefill.ior = {
      number: filing.importerNumber ?? '',
      name: filing.importerName ?? '',
    };
  }

  // ISF stores consigneeAddress as JSONB: { street, city, state, zip, country }
  // Some legacy rows may use { address, postalCode } — handle both shapes.
  const ca = filing.consigneeAddress as any;
  if (filing.consigneeName || ca) {
    prefill.entryConsignee = {
      name: filing.consigneeName ?? '',
      taxId: filing.consigneeNumber ?? '',
      address: ca?.street ?? ca?.address ?? '',
      city: ca?.city ?? '',
      state: ca?.state ?? '',
      postalCode: ca?.zip ?? ca?.postalCode ?? '',
      country: ca?.country ?? 'US',
    };
  }

  const manifestEntry: any = {};
  if (filing.masterBol || filing.houseBol) {
    const mBOL = filing.masterBol ?? '';
    // CC requires hBOL non-empty. Convention for non-consolidated
    // shipments: hBOL = mBOL.
    const hBOL = filing.houseBol || mBOL;
    manifestEntry.bill = {
      type: filing.houseBol ? 'H' : 'M',
      mBOL,
      hBOL,
      groupBOL: 'N',
    };
  }
  if (filing.scacCode) {
    manifestEntry.carrier = { code: filing.scacCode };
  }
  if (Object.keys(manifestEntry).length > 0) {
    prefill.manifest = [manifestEntry];
  }

  // ISF bondType uses words; ABI uses CBP codes.
  if (filing.bondType === 'continuous') {
    prefill.bond = { type: '8', taxId: filing.importerNumber ?? '' } as any;
  } else if (filing.bondType === 'single') {
    prefill.bond = { type: '9', taxId: filing.importerNumber ?? '' } as any;
  }

  if (filing.estimatedArrival) {
    const d = new Date(filing.estimatedArrival);
    const ymd = `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, '0')}${String(d.getUTCDate()).padStart(2, '0')}`;
    if (/^\d{8}$/.test(ymd)) {
      prefill.dates = { arrivalDate: ymd } as any;
    }
  }

  return prefill;
}

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
    const masterBol = mBOL ?? '';
    // CC requires hBOL non-empty. For master-only shipments use mBOL.
    const houseBol = hBOL || masterBol;
    manifestEntry.bill = {
      type: hBOL ? 'H' : 'M',
      mBOL: masterBol,
      hBOL: houseBol,
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
