/**
 * v1 → v2 payload migrator.
 *
 * v1 (AbiDocumentBody, services/abi/types.ts) mirrors the CustomsCity API:
 * it lacks duty amounts, fee/grand totals, manufacturer MIDs, and most
 * CATAIR conditionals. The migrator maps everything v1 can express and
 * leaves the rest absent — a migrated document validates as v2 but still
 * needs enrichment (duty engine, MID derivation) before it can be built
 * into a native filing. Unmappable values throw rather than degrade
 * silently.
 */
import { RecordCodecError, type CodecIssue } from '../records/codec.js';
import type { AbiDocumentBody, AbiItem, AbiInvoice } from '../../services/abi/types.js';
import { parseAbiPayloadV2, type AbiPayloadV2, type EntrySummaryV2, type LineV2 } from './schemaV2.js';
import { deriveMid } from './mid.js';
import { orderCh99 } from './ch99.js';

function fail(field: string, message: string): never {
  const issue: CodecIssue = { record: 'PayloadV1', field, message };
  throw new RecordCodecError([issue]);
}

/** Split a v1 entry number (ABC-1234567-8 or ABC12345678) into filer + 8-char number. */
export function splitV1EntryNumber(raw: string): { filerCode: string; entryNumber: string } {
  const flat = raw.replace(/-/g, '').toUpperCase();
  if (!/^[A-Z0-9]{3}\d{8}$/.test(flat)) {
    fail('entryNumber', `cannot split '${raw}' into filer code + 8-char entry number`);
  }
  return { filerCode: flat.slice(0, 3), entryNumber: flat.slice(3) };
}

/** Split an over-long v1 bill number into SCAC issuer + identifier when possible. */
function splitBill(number: string): { issuerCode?: string; identifier: string } {
  const flat = number.trim().toUpperCase();
  if (flat.length > 12 && /^[A-Z]{4}/.test(flat) && flat.length <= 16) {
    return { issuerCode: flat.slice(0, 4), identifier: flat.slice(4) };
  }
  if (flat.length > 12) fail('manifest.bill', `bill number '${number}' exceeds 12 chars and has no SCAC prefix`);
  return { identifier: flat };
}

/** Parse a v1 free-form quantity string ("500", "500.5 NO") into hundredths + UOM. */
function parseQuantity(raw: string | undefined): { hundredths?: number; uom?: string } {
  if (!raw) return {};
  const match = raw.trim().toUpperCase().match(/^(\d+(?:\.\d+)?)\s*([A-Z]{1,3})?$/);
  if (!match) return {};
  return { hundredths: Math.round(Number(match[1]) * 100), uom: match[2] };
}

function toKilograms(gross: string, uom: string): number | undefined {
  const value = Number(gross);
  if (!Number.isFinite(value) || value <= 0) return undefined;
  return uom === 'L' ? Math.round(value * 0.453592) : Math.round(value);
}

function migrateItem(item: AbiItem, invoice: AbiInvoice, foreignPortOfLading?: string): LineV2 {
  const quantity = parseQuantity(item.quantity1);
  const parties: LineV2['parties'] = [];
  for (const party of item.parties) {
    if (party.type === 'buyer' && party.taxId) parties.push({ type: 'S', identifier: party.taxId });
    if (party.type === 'shipTo' && party.taxId) parties.push({ type: 'C', identifier: party.taxId });
    // Manufacturer: derive the MID (Directive 3500-13) from name+address.
    // ACE remains the authority — the $I application verifies/corrects a
    // derived MID once connected.
    if (party.type === 'manufacturer' && party.name) {
      parties.push({
        type: 'M',
        identifier: deriveMid({
          name: party.name,
          address: party.address,
          city: party.city,
          countryCode: (party.country || item.origin.country || '').toUpperCase(),
          stateOrProvince: party.state,
        }),
      });
    }
  }
  return {
    sku: item.sku || undefined,
    countryOfOrigin: item.origin.country,
    countryOfExport: invoice.countryOfExport || undefined,
    dateOfExportation: invoice.exportDate || undefined,
    relatedPartyIndicator: invoice.relatedParties,
    // The engine prices the claim from the HTS Special column and applies
    // the program's MPF exemption (duty/engine.ts, fees.ts).
    spiClaimCode: item.spiClaimCode || undefined,
    adCvdCases: item.adCvdCases?.length ? item.adCvdCases.map((c) => adCvdCase(c, item)) : undefined,
    foreignPortOfLading: foreignPortOfLading || undefined,
    grossWeightKg: toKilograms(item.weight.gross, item.weight.uom),
    descriptions: item.description ? [item.description.slice(0, 70)] : undefined,
    parties: parties.length > 0 ? parties : undefined,
    tariffs: buildTariffs(item, quantity),
  };
}

/**
 * An AD/CVD case for the 53-record with its estimated deposit (usage note
 * ff): ad valorem on the line's entered value, specific on the case
 * quantity. CERT 043: $68,707 x 3.80% = 2,610.87.
 */
function adCvdCase(c: NonNullable<AbiItem['adCvdCases']>[number], item: AbiItem): NonNullable<LineV2['adCvdCases']>[number] {
  const valueDollars = Math.round(item.values.totalValueOfGoods);
  const rateHundredths = Math.round(c.rate * 100);
  if (c.rateType === 'S' && c.quantity === undefined) fail('adCvdCases.quantity', 'a specific AD/CVD rate needs the quantity');
  return {
    caseNumber: c.caseNumber.replace(/-/g, '').toUpperCase(),
    bondCashClaimCode: c.bondOrCash,
    depositRateHundredths: rateHundredths,
    rateTypeQualifier: c.rateType,
    valueOfGoodsDollars: valueDollars,
    ...(c.rateType === 'S' && { quantityTenThousandths: Math.round(c.quantity! * 10_000) }),
    dutyCents:
      c.rateType === 'A'
        ? Math.round((valueDollars * rateHundredths) / 100)
        : Math.round(c.quantity! * rateHundredths),
  };
}

/**
 * Build a line's tariff list: ch.99 overlays first, in CBP's program order
 * and deduplicated (ch99.ts), then the base ch.1-97 classification.
 *
 * Value and quantity belong to the base. Each overlay is reported the way
 * CERT accepted it: 8 digits, value 0, and no unit or quantity (a UOM on a
 * zero-reporting-unit tariff draws F441/F442). The duty engine prices each
 * overlay on the base value from its USITC rate text, and zeroes the base
 * when the heading replaces column 1. dutyCents is deliberately absent.
 */
function buildTariffs(
  item: AbiItem,
  quantity: { hundredths?: number; uom?: string }
): LineV2['tariffs'] {
  const base = {
    htsNumber: item.htsNumber.replace(/\./g, ''),
    valueDollars: Math.round(item.values.totalValueOfGoods),
    uomCode1: quantity.uom ?? 'NO',
    quantity1Hundredths: quantity.hundredths,
  };
  const overlays = orderCh99(item.additionalHtsNumbers ?? []).map((htsNumber) => ({ htsNumber, valueDollars: 0 }));
  return [...overlays, base];
}

/** Migrate a v1 CustomsCity-shaped payload to schema v2. Throws on unmappable data. */
export function migrateV1ToV2(v1: AbiDocumentBody): AbiPayloadV2 {
  const { filerCode, entryNumber } = splitV1EntryNumber(v1.entryNumber);
  const firstManifest = v1.manifest[0];

  const lines = v1.manifest.flatMap((m) =>
    m.invoices.flatMap((inv) => inv.items.map((item) => migrateItem(item, inv, m.ports.foreignPortOfLading)))
  );
  if (lines.length === 0) fail('manifest.invoices.items', 'v1 document has no line items to migrate');

  const bondType = v1.bond.type === '8' || v1.bond.type === '9' ? v1.bond.type : undefined;
  if (v1.bond.suretyCode && !bondType) {
    fail('bond.type', `unmappable bond type '${v1.bond.type}' (expected 8 or 9)`);
  }

  const paymentTypeCode = String(v1.payment.typeCode);
  if (!['1', '2', '3', '5', '6', '7', '8'].includes(paymentTypeCode)) {
    fail('payment.typeCode', `unmappable payment type '${v1.payment.typeCode}'`);
  }

  const entrySummary: EntrySummaryV2 = {
    filerCode,
    entryNumber,
    districtPortOfEntry: v1.location.portOfEntry,
    entryTypeCode: v1.entryType,
    motCode: v1.modeOfTransport || undefined,
    dates: {
      estimatedEntry: v1.dates.entryDate || undefined,
      importation: v1.dates.importDate || undefined,
      estimatedArrival: v1.dates.arrivalDate || undefined,
    },
    importerOfRecord: { number: v1.ior.number, name: v1.ior.name || undefined },
    consigneeNumber: v1.entryConsignee.taxId || undefined,
    usStateOfDestination: v1.location.destinationStateUS || undefined,
    bonds: bondType
      ? [
          {
            bondTypeCode: bondType,
            designationTypeCode: 'B',
            suretyCompanyCode: v1.bond.suretyCode,
            ...(bondType === '9' && v1.bond.stbAmount ? { stbAmountDollars: v1.bond.stbAmount } : {}),
          },
        ]
      : undefined,
    payment: {
      typeCode: paymentTypeCode as '1' | '2' | '3' | '5' | '6' | '7' | '8',
      preliminaryStatementPrintDate: v1.payment.preliminaryStatementDate || undefined,
      periodicStatementMonth: v1.payment.periodicStatementMonth || undefined,
    },
    cargo: {
      carrierCode: firstManifest?.carrier.code || undefined,
      districtPortOfUnlading: firstManifest?.ports.portOfUnlading || undefined,
      locationOfGoodsCode: v1.firms || undefined,
    },
    manifests: v1.manifest.map((m) => {
      const quantity = Number(m.quantity);
      if (!Number.isInteger(quantity) || quantity <= 0) {
        fail('manifest.quantity', `unmappable manifested quantity '${m.quantity}'`);
      }
      const bills: NonNullable<EntrySummaryV2['manifests']>[number]['bills'] = [];
      const master = splitBill(m.bill.mBOL);
      bills.push({ type: 'M', ...master });
      if (m.bill.hBOL && m.bill.hBOL !== m.bill.mBOL) {
        bills.push({ type: 'H', ...splitBill(m.bill.hBOL) });
      }
      return { manifestedQuantity: quantity, uomCode: m.quantityUOM || 'PCS', bills };
    }),
    lines,
    // grandTotals / feeTotals deliberately absent — enrichment fills them.
  };

  const payload: AbiPayloadV2 = {
    schemaVersion: 2,
    entrySummary,
    commercial: {
      consignee: {
        name: v1.entryConsignee.name || undefined,
        taxId: v1.entryConsignee.taxId || undefined,
        address: v1.entryConsignee.address || undefined,
        city: v1.entryConsignee.city || undefined,
        state: v1.entryConsignee.state || undefined,
        postalCode: v1.entryConsignee.postalCode || undefined,
        country: v1.entryConsignee.country || undefined,
      },
      invoices: v1.manifest.flatMap((m) =>
        m.invoices.map((inv) => ({
          invoiceNumber: inv.invoiceNumber || undefined,
          purchaseOrder: inv.purchaseOrder || undefined,
          exportDate: inv.exportDate || undefined,
          currency: inv.currency || undefined,
          exchangeRate: inv.exchangeRate,
          relatedParties: inv.relatedParties,
          itemSkus: inv.items.map((i) => i.sku).filter(Boolean),
        }))
      ),
    },
  };

  // Validate the result so a bad migration throws here, not at build time.
  return parseAbiPayloadV2(payload);
}
