/**
 * Per-step validators for the ABI wizard. Each takes the current draft
 * and returns a flat dot-keyed map of `{ fieldPath: errorMessage }`. The
 * wizard parent calls the active step's validator on every draft change,
 * passes the result to the step component, and uses an empty map to
 * decide whether the user can advance to the next step.
 *
 * Field path conventions:
 *   • Top-level scalar:        `entryType`, `firms`
 *   • Nested object scalar:    `dates.entryDate`, `bond.suretyCode`
 *   • Array element scalar:    `invoices.0.exportDate`
 *   • Doubly-nested array:     `invoices.0.items.3.htsNumber`
 *
 * These keys are stable so individual Step components can pull errors
 * by name without each step needing its own bespoke shape.
 *
 * Logic mirrors the server-side Zod schema at
 * server/src/schemas/abiDocument.ts. If you add or change a constraint
 * there, update the matching validator here so the user sees the gap
 * before they hit Transmit.
 */
import type { ABIDocumentDraft } from '@/api/client';

export type FieldErrors = Record<string, string>;

const TAXID_RE =
  /^(?:[A-Z0-9]{2}-[A-Z0-9]{9}|[A-Z0-9]{3}-[A-Z0-9]{2}-[A-Z0-9]{4}|[A-Z0-9]{6}-[A-Z0-9]{5})$/;
const ENTRY_NUMBER_RE = /^[A-Z0-9-]{9,13}$/;
const HTS_RE = /^\d{10}$/;
const TAXID_HINT =
  'EIN (12-3456789) / SSN (123-45-6789) / CBP-assigned (ABCDEF-12345)';

// ─── Step 1 — Entry & Shipment Info ───────────────────────────
export function validateStep1(d: ABIDocumentDraft): FieldErrors {
  const e: FieldErrors = {};
  if (!d.entryType) e.entryType = 'Required';
  if (!d.modeOfTransport) e.modeOfTransport = 'Required';
  if (!d.entryNumber) {
    e.entryNumber = 'Required';
  } else if (!ENTRY_NUMBER_RE.test(d.entryNumber)) {
    e.entryNumber = '9–13 chars (letters, digits, hyphens)';
  }
  if (!d.dates?.entryDate) e['dates.entryDate'] = 'Required';
  if (!d.dates?.importDate) e['dates.importDate'] = 'Required';
  if (!d.dates?.arrivalDate) e['dates.arrivalDate'] = 'Required';
  if (!d.location?.portOfEntry) {
    e['location.portOfEntry'] = 'Required';
  } else if (d.location.portOfEntry.length > 4) {
    e['location.portOfEntry'] = 'Max 4 characters';
  }
  if (!d.location?.destinationStateUS) e['location.destinationStateUS'] = 'Required';
  if (!d.firms) e.firms = 'Required';
  return e;
}

// ─── Step 2 — Importer of Record + Bond + Payment ────────────
export function validateStep2(d: ABIDocumentDraft): FieldErrors {
  const e: FieldErrors = {};
  if (!d.ior?.number) e['ior.number'] = 'Required';
  if (!d.ior?.name) e['ior.name'] = 'Required';

  if (!d.bond?.type) e['bond.type'] = 'Required';
  if (!d.bond?.suretyCode) e['bond.suretyCode'] = 'Required';
  if (!d.bond?.taxId) e['bond.taxId'] = 'Required';

  if (d.payment?.typeCode === undefined || d.payment?.typeCode === null) {
    e['payment.typeCode'] = 'Required';
  }
  if (!d.payment?.preliminaryStatementDate) {
    e['payment.preliminaryStatementDate'] = 'Required';
  } else if (
    d.dates?.entryDate &&
    d.payment.preliminaryStatementDate < d.dates.entryDate
  ) {
    e['payment.preliminaryStatementDate'] =
      'Must be on or after the Entry Date (Step 1)';
  }
  return e;
}

// ─── Step 3 — Consignee ──────────────────────────────────────
export function validateStep3(d: ABIDocumentDraft): FieldErrors {
  const e: FieldErrors = {};
  const c = d.entryConsignee;
  if (!c?.name) e['entryConsignee.name'] = 'Required';
  if (!c?.taxId) {
    e['entryConsignee.taxId'] = 'Required';
  } else if (!TAXID_RE.test(c.taxId)) {
    e['entryConsignee.taxId'] = TAXID_HINT;
  }
  if (!c?.address) e['entryConsignee.address'] = 'Required';
  if (!c?.city) e['entryConsignee.city'] = 'Required';
  if (!c?.state) e['entryConsignee.state'] = 'Required';
  if (!c?.postalCode) e['entryConsignee.postalCode'] = 'Required';
  if (!c?.country) e['entryConsignee.country'] = 'Required';
  return e;
}

// ─── Step 4 — Manifest (Bill + Carrier + Ports) ──────────────
export function validateStep4(d: ABIDocumentDraft): FieldErrors {
  const e: FieldErrors = {};
  const m = d.manifest?.[0];
  if (!m?.bill?.type) e['bill.type'] = 'Required';
  if (!m?.bill?.mBOL) e['bill.mBOL'] = 'Required';
  if (!m?.bill?.hBOL) e['bill.hBOL'] = 'Required (use Master BOL if no separate house bill)';
  if (!m?.carrier?.code) e['carrier.code'] = 'Required';
  if (!m?.ports?.portOfUnlading) e['ports.portOfUnlading'] = 'Required';
  if (!m?.quantity) e.quantity = 'Required';
  if (!m?.quantityUOM) {
    e.quantityUOM = 'Required';
  } else if (m.quantityUOM.length < 3) {
    e.quantityUOM = 'Must be at least 3 characters';
  }
  return e;
}

// ─── Step 5 — Invoices & Items ───────────────────────────────
export function validateStep5(d: ABIDocumentDraft): FieldErrors {
  const e: FieldErrors = {};
  const m = d.manifest?.[0];
  const invoices = m?.invoices ?? [];

  if (invoices.length === 0) {
    e.invoices = 'Add at least one invoice';
    return e;
  }

  invoices.forEach((inv, i) => {
    const p = `invoices.${i}`;
    if (!inv?.purchaseOrder) e[`${p}.purchaseOrder`] = 'Required';
    if (!inv?.invoiceNumber) e[`${p}.invoiceNumber`] = 'Required';
    if (!inv?.exportDate) e[`${p}.exportDate`] = 'Required';
    if (!inv?.countryOfExport) e[`${p}.countryOfExport`] = 'Required';
    if (!inv?.currency) e[`${p}.currency`] = 'Required';
    if (inv?.exchangeRate === undefined) {
      e[`${p}.exchangeRate`] = 'Required';
    } else if (inv.exchangeRate <= 0) {
      e[`${p}.exchangeRate`] = 'Must be > 0';
    } else if (inv.exchangeRate > 8) {
      e[`${p}.exchangeRate`] = 'Must be ≤ 8';
    }

    const items = inv?.items ?? [];
    if (items.length === 0) {
      e[`${p}.items`] = 'Add at least one item';
    } else {
      items.forEach((it, j) => {
        const ip = `${p}.items.${j}`;
        if (!it?.sku) e[`${ip}.sku`] = 'Required';
        if (!it?.htsNumber) {
          e[`${ip}.htsNumber`] = 'Required';
        } else if (!HTS_RE.test(it.htsNumber)) {
          e[`${ip}.htsNumber`] = 'Must be 10 digits';
        }
        if (!it?.description) e[`${ip}.description`] = 'Required';
        if (!it?.origin?.country) e[`${ip}.origin.country`] = 'Required';
        if (it?.values?.totalValueOfGoods === undefined) {
          e[`${ip}.values.totalValueOfGoods`] = 'Required';
        }
        if (it?.values?.exchangeRate !== undefined && it.values.exchangeRate > 8) {
          e[`${ip}.values.exchangeRate`] = 'Must be ≤ 8';
        }
        if (!it?.quantity1) e[`${ip}.quantity1`] = 'Required';
        if (!it?.weight?.gross) e[`${ip}.weight.gross`] = 'Required';
        if (!(it?.parties?.length)) {
          e[`${ip}.parties`] = 'Add at least one party';
        }
      });
    }
  });

  return e;
}

// ─── Step 6 is the review screen — uses validateAbiDraft from
//     ./Step6Review.tsx for its summary; nothing extra to gate Next on
//     since Step 6 already controls the Transmit button itself.
export function validateStep6(_d: ABIDocumentDraft): FieldErrors {
  return {};
}

export const STEP_VALIDATORS: Array<(d: ABIDocumentDraft) => FieldErrors> = [
  validateStep1,
  validateStep2,
  validateStep3,
  validateStep4,
  validateStep5,
  validateStep6,
];
