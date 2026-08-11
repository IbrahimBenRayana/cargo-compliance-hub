/**
 * Platform Filing → native ISF builder input.
 *
 * Bridges the platform's Prisma `Filing` row (the shape that
 * services/customscity/isfMappers.ts reads today) to the typed `IsfInput`
 * consumed by buildIsf(). The abi-engine must not depend on
 * services/customscity (see index.ts header), so the tolerant party-access
 * and sanitisation helpers are re-implemented here with the same semantics
 * as customscity/helpers.ts (partyField / sanitizeName / sanitizeAddress).
 *
 * Mapping summary (source field → ISF record/element):
 *
 *   filingType ('ISF-5' vs rest)     → SF10 submission type ('2' vs '1')
 *   importerNumber                   → SF10 ISF importer (EI) + IM SF30 identifier
 *   bondType/bondActivityCode/
 *   bondHolderID                     → SF10 bond holder / activity / type
 *   suretyCode/bondReferenceNumber   → SF20 V1 + SBN (single-transaction bonds)
 *   scacCode ?? carrierCode          → SF10 SCAC + SF15 bill issuer prefix
 *   houseBol (+ masterBol)           → SF15 BM (+ SF20 MB reference)
 *   masterBol (no house)             → SF15 OB
 *   containers[]                     → SF25 (initial/serial/check digit split)
 *   consigneeNumber ?? importerNumber→ CN SF30 identifier (EI)
 *   seller / buyer / shipToParty /
 *   containerStuffingLocation /
 *   consolidator                     → SE / BY / ST / LG / CS SF30+SF35+SF36
 *   manufacturer[]                   → MF loops; tariffs from each mfr's own
 *                                      items[] else filing.commodities[]
 *   commodities[].htsCode /
 *   countryOfOrigin                  → SF40 (digits-only HTS, 6-10)
 *   isf5Data.bookingParty* /
 *   shipToParty                      → ISF-5 BKP + ST entities
 *   foreignPortOfUnlading /
 *   placeOfDelivery                  → ISF-5 SF50 (UN qualifiers)
 *
 * Unusable regulated data (missing importer number, no bills, no
 * commodities, missing party names) throws RecordCodecError with the source
 * field path — the mapper never fabricates identifiers, names or origins.
 * Purely cosmetic fallbacks that mirror the legacy CustomsCity mapper
 * (street 'NA', city 'UNKNOWN', country 'US') are kept and marked as
 * legacy-parity choices.
 */
import { RecordCodecError, type CodecIssue } from '../records/codec.js';
import type {
  IsfBill,
  IsfBond,
  IsfContainer,
  IsfEntity,
  IsfEntityBase,
  IsfImporter,
  IsfInput,
  IsfManufacturer,
  IsfReference,
  IsfTariff,
  IsfActionReasonCode,
} from './builder.js';

// ── Source (platform) types ────────────────────────────────

/**
 * Structural view of a Prisma `Filing` row (plus its JSONB columns) as the
 * ISF mapper needs it. Deliberately tolerant: party columns are JSONB and
 * may arrive as objects, JSON strings, or plain name strings (mirroring the
 * legacy partyField behaviour); array columns may be a single object.
 */
export interface PlatformIsfFiling {
  /** 'ISF' | 'ISF-10' | 'ISF-5' — anything but 'ISF-5' maps as an ISF-10. */
  filingType?: string | null;
  importerName?: string | null;
  /** IOR EIN — mandatory; becomes the SF10 importer and the IM entity. */
  importerNumber?: string | null;
  consigneeName?: string | null;
  consigneeNumber?: string | null;
  /** Party-shaped JSONB (object or JSON string). */
  consigneeAddress?: unknown;
  seller?: unknown;
  buyer?: unknown;
  shipToParty?: unknown;
  consolidator?: unknown;
  containerStuffingLocation?: unknown;
  /** JSONB: array of manufacturers, a single object, or a JSON string. */
  manufacturer?: unknown;
  /** JSONB array of { htsCode, countryOfOrigin, ... }. */
  commodities?: unknown;
  /** JSONB array of { number | containerNumber, type }. */
  containers?: unknown;
  masterBol?: string | null;
  houseBol?: string | null;
  scacCode?: string | null;
  carrierCode?: string | null;
  /** 'continuous' | 'single' (platform) or already '8' | '9'. */
  bondType?: string | null;
  bondActivityCode?: string | null;
  bondHolderID?: string | null;
  /** Needed only for single-transaction (type 9) ISF bonds. */
  suretyCode?: string | null;
  bondReferenceNumber?: string | null;
  /** JSONB blob backing the ISF-5 form (bookingParty*, ISFFiler*, ports). */
  isf5Data?: unknown;
  foreignPortOfUnlading?: string | null;
  placeOfDelivery?: string | null;
  estimatedArrival?: unknown;
}

export interface MapFilingToIsfOptions {
  action: 'A' | 'D' | 'R';
  /** CBP-assigned FFF-NNNNNNNNNNN — mandatory for 'D', optional for 'R'. */
  isfTransactionNumber?: string;
  /** Defaults to 'CT' (complete transaction) on A/R, like the legacy mapper. */
  actionReasonCode?: IsfActionReasonCode;
}

// ── Helpers ────────────────────────────────────────────────

function fail(field: string, message: string): never {
  const issue: CodecIssue = { record: 'PlatformIsfFiling', field, message };
  throw new RecordCodecError([issue]);
}

function str(value: unknown): string {
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return '';
}

/** Parse JSONB that arrived as a serialized string; pass everything else through. */
function parseJsonish(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) return value;
  try {
    return JSON.parse(trimmed);
  } catch {
    return value;
  }
}

/** JSONB array column: array, single object (wrap), or nothing. */
function asArray(value: unknown): unknown[] {
  const parsed = parseJsonish(value);
  if (Array.isArray(parsed)) return parsed;
  if (parsed == null || parsed === '') return [];
  return [parsed];
}

/**
 * Tolerant party accessor — same semantics as the legacy
 * services/customscity/helpers.ts partyField (object, JSON string, or plain
 * name string; flat and nested address shapes). Re-implemented here because
 * the abi-engine must not import from services/customscity.
 */
function partyField(party: unknown, field: string): string {
  if (party == null) return '';
  if (typeof party === 'string') {
    const parsed = parseJsonish(party);
    if (parsed !== party && typeof parsed === 'object') return partyField(parsed, field);
    return field === 'name' ? party.trim() : '';
  }
  if (typeof party !== 'object') return '';
  const p = party as Record<string, any>;
  const first = (...values: unknown[]): string => {
    for (const v of values) {
      const s = str(v);
      if (s) return s;
    }
    return '';
  };
  switch (field) {
    case 'address1':
      return first(p.address1, p.street, p.address?.street, typeof p.address === 'string' ? p.address : '');
    case 'address2':
      return first(p.address2, p.address?.street2, p.address?.line2);
    case 'city':
      return first(p.city, p.address?.city);
    case 'state':
      return first(p.state, p.stateOrProvince, p.address?.state);
    case 'zip':
      return first(p.zip, p.postalCode, p.address?.zip);
    case 'country':
      return first(p.country, p.address?.country);
    default:
      return str(p[field]);
  }
}

/** Uppercase and keep the name charset the legacy mapper allowed (letters, digits, space, &, -). */
function cleanName(raw: string): string {
  return raw
    .toUpperCase()
    .replace(/[^A-Z0-9 &\-]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 35);
}

/** Address line for SF35 pair 1 (class X): keep the legacy address charset. */
function cleanAddress(raw: string): string {
  const cleaned = raw
    .toUpperCase()
    .replace(/[^A-Z0-9 .,#&/\-]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  // Punctuation-only leftovers count as absent (legacy sanitizeAddress parity).
  if (!/[A-Z0-9]/.test(cleaned)) return '';
  return cleaned.slice(0, 35);
}

/** Class-AN cleanup (SF36 city/postal, SF35 pair 2 which is printed 35AN). */
function cleanAn(raw: string, max: number): string {
  return raw
    .toUpperCase()
    .replace(/[^A-Z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

/** ISO alpha-2 country code, or undefined when the value isn't one. */
function iso2(raw: string): string | undefined {
  const cleaned = raw.toUpperCase().replace(/[^A-Z]/g, '');
  return cleaned.length === 2 ? cleaned : undefined;
}

/**
 * Normalise an EIN to the chapter's EI format NN-NNNNNNNXX (ISF-29): a
 * plain 9-digit EIN gets its 2-position suffix zero filled.
 */
function normalizeEin(raw: string, field: string): string {
  const cleaned = raw.trim().toUpperCase();
  if (/^[0-9]{2}-[0-9]{7}[A-Z0-9]{2}$/.test(cleaned)) return cleaned;
  const flat = cleaned.replace(/[^A-Z0-9]/g, '');
  if (/^[0-9]{9}$/.test(flat)) return `${flat.slice(0, 2)}-${flat.slice(2)}00`;
  if (/^[0-9]{9}[A-Z0-9]{2}$/.test(flat)) return `${flat.slice(0, 2)}-${flat.slice(2, 9)}${flat.slice(9)}`;
  fail(field, `cannot normalise '${raw}' into an EI identifier (NN-NNNNNNNXX, ISF-29)`);
}

/** Digits-only HTS, left 6-10 (SF40 takes 10N left-justified, min 6 mandatory). */
function htsDigits(raw: string, field: string): string {
  const digits = raw.replace(/[^0-9]/g, '');
  if (digits.length < 6) fail(field, `HTS number must have at least 6 digits, got '${raw}' (SF40, ISF-36)`);
  return digits.slice(0, 10);
}

function validateTransactionNumber(raw: string): string {
  const cleaned = raw.trim().toUpperCase();
  if (!/^[A-Z0-9]{3}-[0-9]{11}$/.test(cleaned)) {
    fail('isfTransactionNumber', `'${raw}' is not a CBP ISF transaction number (FFF-NNNNNNNNNNN, ISF-19)`);
  }
  return cleaned;
}

// ── Piece builders ─────────────────────────────────────────

function scacOf(filing: PlatformIsfFiling): string {
  const raw = str(filing.scacCode) || str(filing.carrierCode);
  const cleaned = raw.toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (!/^[A-Z]{2,4}$/.test(cleaned)) {
    fail('scacCode', `a carrier SCAC is required to report bills of lading (SF15, ISF-23); got '${raw}'`);
  }
  return cleaned;
}

/** Strip bill-number specials (SF15 forbids them) and de-duplicate a stored SCAC prefix. */
function billNumberOf(raw: string | null | undefined, scac: string): string {
  let cleaned = str(raw).toUpperCase().replace(/[^A-Z0-9]/g, '');
  // Some rows store the bill WITH its SCAC prefix; SF15 concatenates
  // SCAC + number itself, so peel a matching prefix to avoid 'MAEUMAEU…'.
  if (cleaned.startsWith(scac) && cleaned.length > scac.length) cleaned = cleaned.slice(scac.length);
  return cleaned;
}

/**
 * houseBol → BM house bill (plus an MB master-bill reference when the
 * master is also on file); otherwise masterBol → OB straight bill.
 */
function buildBills(filing: PlatformIsfFiling, scac: string, references: IsfReference[]): IsfBill[] {
  const master = billNumberOf(filing.masterBol, scac);
  const house = billNumberOf(filing.houseBol, scac);
  if (house) {
    if (master && master !== house) references.push({ qualifier: 'MB', value: `${scac}${master}` });
    return [{ qualifier: 'BM', scac, billNumber: house }];
  }
  if (!master) fail('masterBol', 'a master or house bill of lading number is required (SF15, ISF-7/9)');
  return [{ qualifier: 'OB', scac, billNumber: master }];
}

/**
 * SF10 bond from the platform's ISF bond fields. Bond holder falls back to
 * the importer number — on this platform bondHolderID is the IOR tax ID
 * when present at all. Continuous ('8') with activity '01' is the default;
 * an explicit bondActivityCode/bondHolderID is honoured. A single-transaction
 * bond (type 9) must ride with activity 16 plus V1/SBN references (ISF-19
 * Note 7) — regulated data we refuse to fabricate.
 */
function buildBond(filing: PlatformIsfFiling, importerEin: string, references: IsfReference[]): IsfBond {
  const rawType = str(filing.bondType).toLowerCase();
  const type: IsfBond['type'] = rawType === 'single' || rawType === '9' ? '9' : '8';
  const holderRaw = str(filing.bondHolderID);
  const holder = holderRaw ? normalizeEin(holderRaw, 'bondHolderID') : importerEin;
  const activityCode = str(filing.bondActivityCode) || (type === '9' ? '16' : '01');
  if (type === '9') {
    const surety = str(filing.suretyCode).toUpperCase();
    const sbn = cleanAn(str(filing.bondReferenceNumber), 50);
    if (!surety || !sbn) {
      fail(
        'bondType',
        'a single-transaction ISF bond requires a surety code (SF20 V1) and bond reference number (SF20 SBN) — neither is on this filing (ISF-19 Note 7)',
      );
    }
    references.push({ qualifier: 'V1', value: surety }, { qualifier: 'SBN', value: sbn });
  }
  return { holder, activityCode, type };
}

/**
 * Container type → Appendix B equipment description code. Same ISO-type
 * collapse table the legacy CustomsCity mapper used; unknown long codes
 * fall back to the generic 'CN' (container) like the legacy mapper.
 */
const CONTAINER_DESCRIPTION_CODES: Record<string, string> = {
  '20GP': '20', '20DV': '20', '20ST': '20', '20OT': '20', '20FR': '20', '20RF': 'R0',
  '40GP': '40', '40DV': '40', '40ST': '40', '40OT': '40', '40FR': '40', '40RF': 'R0',
  '40HC': '40', '40HQ': '40', '45HC': '40', '45HQ': '40', '40RH': 'R0',
  '20FL': '20', '20TK': 'TW', '40FL': '40', '40TK': 'TW',
  NC: 'NC', CN: 'CN', CL: 'CL', CX: 'CX', CW: 'CW', CZ: 'CZ', RC: 'RC', TW: 'TW',
  '20': '20', '2B': '2B', '40': '40', '4B': '4B', R0: 'R0',
};

function buildContainers(filing: PlatformIsfFiling): IsfContainer[] {
  const out: IsfContainer[] = [];
  asArray(filing.containers).forEach((c, i) => {
    const rec = (c ?? {}) as Record<string, unknown>;
    const raw = str(rec.number) || str(rec.containerNumber);
    if (!raw) return; // rows without a number are ignored — SF25 is optional (0-999)
    const cleaned = raw.toUpperCase().replace(/[^A-Z0-9]/g, '');
    const match = cleaned.match(/^([A-Z]{1,4})([0-9]{1,16})$/);
    if (!match) {
      fail(`containers[${i}].number`, `cannot split '${raw}' into an equipment initial + serial (SF25, ISF-27)`);
    }
    let digits = match[2];
    let checkDigit: string | undefined;
    // ISO 6346 numbers are 4 letters + 6 serial digits + 1 check digit;
    // peel the check digit into its own SF25 position when present.
    if (digits.length === 7) {
      checkDigit = digits.slice(6);
      digits = digits.slice(0, 6);
    }
    const type = str(rec.type).toUpperCase();
    out.push({
      descriptionCode: CONTAINER_DESCRIPTION_CODES[type] ?? (type.length === 2 ? type : 'CN'),
      initial: match[1],
      number: digits,
      checkDigit,
    });
  });
  return out;
}

/**
 * Name+address entity (SE/BY/ST/LG/CS/BKP + MF): SF30 name, SF35 with
 * qualifier '15' (unstructured street address) lines, SF36 geography.
 * A missing party name is unusable regulated data → throw. The street/city
 * fallbacks ('NA' / 'UNKNOWN' / country 'US') are cosmetic legacy-parity
 * choices carried over from the CustomsCity mapper.
 */
function nameAddressBase(
  party: unknown,
  label: string,
  fallback: { name?: string; party?: unknown } = {},
): IsfEntityBase {
  const name = cleanName(partyField(party, 'name') || fallback.name || '');
  if (!name) fail(label, 'party name is missing — every named ISF entity requires one (SF30, ISF-28)');
  const fb = fallback.party;
  // Legacy parity: street 'NA' when no address line survives sanitisation.
  const address1 = cleanAddress(partyField(party, 'address1') || partyField(fb, 'address1')) || 'NA';
  // SF35 pair 2 is printed 35AN (recordDefs.ts) — sanitise line 2 to AN.
  const address2 = cleanAn(partyField(party, 'address2'), 35);
  const addressComponents = [{ qualifier: '15', information: address1 }];
  if (address2) addressComponents.push({ qualifier: '15', information: address2 });
  const city = cleanAn(partyField(party, 'city') || partyField(fb, 'city'), 35) || 'UNKNOWN'; // legacy parity
  const state = cleanAn(partyField(party, 'state') || partyField(fb, 'state'), 8).replace(/ /g, '').slice(0, 3);
  const postal = cleanAn(partyField(party, 'zip') || partyField(fb, 'zip'), 20).replace(/ /g, '').slice(0, 15);
  const countryRaw = partyField(party, 'country') || partyField(fb, 'country');
  let countryCode: string;
  if (!countryRaw) {
    countryCode = 'US'; // legacy parity — the CC mapper defaulted every party country to US
  } else {
    const code = iso2(countryRaw);
    if (!code) fail(label, `'${countryRaw}' is not an ISO country code (SF36, ISF-35)`);
    countryCode = code;
  }
  return {
    name,
    addressComponents,
    geography: {
      city,
      countrySubEntityCode: state || undefined,
      postalCode: postal || undefined,
      countryCode,
    },
  };
}

function nameAddressEntity(
  code: IsfEntity['code'],
  party: unknown,
  label: string,
  fallback: { name?: string; party?: unknown } = {},
): IsfEntity {
  return { code, ...nameAddressBase(party, label, fallback) };
}

/** SF40 tariffs for one manufacturer: its own items[] when present, else filing.commodities. */
function manufacturerTariffs(mfr: unknown, mfrIndex: number, commodities: unknown[]): IsfTariff[] {
  const items = asArray((mfr as Record<string, unknown> | null)?.items);
  const source = items.length > 0 ? items : commodities;
  const sourceLabel = items.length > 0 ? `manufacturer[${mfrIndex}].items` : 'commodities';
  if (source.length === 0) {
    fail('commodities', 'at least one commodity (HTS) line is required to file an ISF (SF40, ISF-8)');
  }
  return source.map((c, i) => {
    const rec = (c ?? {}) as Record<string, unknown>;
    const htsRaw = str(rec.htsCode) || str(rec.htsNumber) || str(rec['commodityHTS-6Number']);
    const htsNumber = htsDigits(htsRaw, `${sourceLabel}[${i}].htsCode`);
    // Country of origin is a mandatory ISF-10 element (ISF-36); fall back to
    // the manufacturer's own country before giving up — never fabricate one.
    const origin = iso2(str(rec.countryOfOrigin)) ?? iso2(partyField(mfr, 'country'));
    if (!origin) {
      fail(`${sourceLabel}[${i}].countryOfOrigin`, 'country of origin is mandatory on ISF-10 tariff lines (SF40, ISF-36)');
    }
    return { htsNumber, countryOfOrigin: origin };
  });
}

// ── Importer resolution ────────────────────────────────────

function isf10Importer(filing: PlatformIsfFiling): IsfImporter {
  const raw = str(filing.importerNumber);
  if (!raw) fail('importerNumber', 'the ISF importer (IOR) number is missing — an ISF-10 cannot be filed without it (SF10, ISF-18)');
  return { qualifier: 'EI', number: normalizeEin(raw, 'importerNumber') };
}

function isf5Importer(filing: PlatformIsfFiling, isf5: Record<string, unknown>): IsfImporter {
  // ISF-5 filer: the platform stores the carrier/NVOCC EIN in
  // isf5Data.ISFFilerNumber (falling back to importerNumber, like the
  // legacy mapper); a SCAC-identified importer ('2') is the ISF-5-only
  // alternative when no EIN is on file (ISF-18 Note 4).
  const raw = str(isf5.ISFFilerNumber) || str(filing.importerNumber);
  if (raw) return { qualifier: 'EI', number: normalizeEin(raw, 'isf5Data.ISFFilerNumber') };
  const scac = (str(filing.scacCode) || str(filing.carrierCode)).toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (/^[A-Z]{4}$/.test(scac)) return { qualifier: '2', number: scac };
  fail('importerNumber', 'an ISF-5 needs the filer EIN (isf5Data.ISFFilerNumber / importerNumber) or a 4-char SCAC (SF10, ISF-18)');
}

// ── Mapper ─────────────────────────────────────────────────

/**
 * Map a platform ISF filing to a native `IsfInput` ready for buildIsf().
 * `action` 'A'/'R' produces a full ISF-10 or ISF-5 grouping; 'D' produces
 * the minimal SF10-only delete (requires the CBP transaction number).
 */
export function mapFilingToIsfInput(filing: PlatformIsfFiling, options: MapFilingToIsfOptions): IsfInput {
  const isIsf5 = filing.filingType === 'ISF-5';
  const isf5 = (parseJsonish(filing.isf5Data) ?? {}) as Record<string, unknown>;
  const submissionType = isIsf5 ? '2' : '1';
  const importer = isIsf5 ? isf5Importer(filing, isf5) : isf10Importer(filing);

  if (options.action === 'D') {
    // Delete transmits only the SF10 with the CBP-assigned number (ISF-4).
    const raw = str(options.isfTransactionNumber);
    if (!raw) fail('isfTransactionNumber', 'a Delete requires the CBP-assigned ISF transaction number (ISF-17 Note 3)');
    return {
      submissionType,
      shipmentTypeCode: '01',
      action: 'D',
      importer,
      isfTransactionNumber: validateTransactionNumber(raw),
      bills: [],
      entities: [],
    };
  }

  const isfTransactionNumber = str(options.isfTransactionNumber)
    ? validateTransactionNumber(str(options.isfTransactionNumber))
    : undefined;
  const actionReasonCode = options.actionReasonCode ?? 'CT'; // legacy parity: amendmentCode 'CT'
  const references: IsfReference[] = [];
  const scac = scacOf(filing);
  const bills = buildBills(filing, scac, references);
  const containers = buildContainers(filing);
  const commodities = asArray(filing.commodities);

  const common = {
    shipmentTypeCode: '01' as const, // the platform files standard/regular ISFs only
    action: options.action,
    actionReasonCode,
    importer,
    // Containerised ocean freight when the filing lists equipment; MOT is
    // optional, so it is simply omitted otherwise.
    modeOfTransportationCode: containers.length > 0 ? ('11' as const) : undefined,
    isfTransactionNumber,
    scac,
    bills,
    containers: containers.length > 0 ? containers : undefined,
  };

  if (isIsf5) {
    if (commodities.length === 0) {
      fail('commodities', 'an ISF-5 requires 1-999 commodity (HTS) lines (SF40, ISF-9 Note 2)');
    }
    const tariffs: IsfTariff[] = commodities.map((c, i) => {
      const rec = (c ?? {}) as Record<string, unknown>;
      const htsRaw = str(rec.htsCode) || str(rec.htsNumber) || str(rec['commodityHTS-6Number']);
      return {
        htsNumber: htsDigits(htsRaw, `commodities[${i}].htsCode`),
        // Not required for ISF-5 (FROB/IE/TE, ISF-36) — include only when clean.
        countryOfOrigin: iso2(str(rec.countryOfOrigin)),
      };
    });

    const bookingParty = {
      name: str(isf5.bookingPartyName),
      address1: str(isf5.bookingPartyAddress1),
      address2: str(isf5.bookingPartyAddress2),
      city: str(isf5.bookingPartyCity),
      state: str(isf5.bookingPartyStateOrProvince),
      zip: str(isf5.bookingPartyPostalCode),
      country: str(isf5.bookingPartyCountry),
    };
    const shipTo = filing.shipToParty ?? {
      name: str(isf5.shipToName),
      address1: str(isf5.shipToAddress1),
      address2: str(isf5.shipToAddress2),
      city: str(isf5.shipToCity),
      state: str(isf5.shipToStateOrProvince),
      zip: str(isf5.shipToPostalCode),
      country: str(isf5.shipToCountry),
    };

    // SF50 FROB routing — only when both ports are on file; the chapter
    // has no fabricable default for either (ISF-37). The platform stores
    // UN/locode-style port strings, reported with the UN qualifier.
    const portOfUnlading = cleanAn(str(filing.foreignPortOfUnlading) || str(isf5.foreignPortOfUnlading), 20).replace(/ /g, '').slice(0, 15);
    const placeOfDelivery = cleanAn(str(isf5.placeOfDelivery) || str(filing.placeOfDelivery), 20).replace(/ /g, '').slice(0, 15);

    return {
      ...common,
      submissionType: '2',
      entities: [
        nameAddressEntity('BKP', bookingParty, 'isf5Data.bookingParty'),
        nameAddressEntity('ST', shipTo, 'shipToParty'),
      ],
      tariffs,
      frob:
        portOfUnlading && placeOfDelivery
          ? {
              portOfUnladingQualifier: 'UN',
              foreignPortOfUnlading: portOfUnlading,
              placeOfDeliveryQualifier: 'UN',
              placeOfDelivery,
            }
          : undefined,
    };
  }

  // ── ISF-10 ───────────────────────────────────────────────
  const bond = buildBond(filing, importer.number, references);

  // Judgment call: when no consignee number is on file, report the IOR as
  // the consignee (CN falls back to the importer's EIN) — the legacy mapper
  // fabricated '00-000000000' here, which we refuse to transmit.
  const consigneeRaw = str(filing.consigneeNumber);
  const consigneeEin = consigneeRaw ? normalizeEin(consigneeRaw, 'consigneeNumber') : importer.number;

  const entities: IsfEntity[] = [
    // CN/IM are SF30-only, identifier mandatory (ISF-28).
    { code: 'IM', identifier: { qualifier: 'EI', value: importer.number } },
    { code: 'CN', identifier: { qualifier: 'EI', value: consigneeEin } },
    nameAddressEntity('SE', filing.seller, 'seller'),
    // Legacy parity: buyer/ship-to fall back to the importer's name and the
    // consignee address when their own party is sparse.
    nameAddressEntity('BY', filing.buyer, 'buyer', { name: str(filing.importerName), party: filing.consigneeAddress }),
    nameAddressEntity('ST', filing.shipToParty, 'shipToParty', {
      name: str(filing.importerName),
      party: filing.consigneeAddress,
    }),
    nameAddressEntity('LG', filing.containerStuffingLocation, 'containerStuffingLocation'),
    nameAddressEntity('CS', filing.consolidator, 'consolidator'),
  ];

  const rawManufacturers = asArray(filing.manufacturer);
  if (rawManufacturers.length === 0) {
    // The legacy mapper fabricated an 'Unknown Manufacturer' here; a
    // manufacturer is a mandatory ISF-10 party (ISF-15), so we throw instead.
    fail('manufacturer', 'ISF-10 requires at least one manufacturer/supplier (SF10 Note 1, ISF-15)');
  }
  const manufacturers: IsfManufacturer[] = rawManufacturers.map((m, i) => ({
    ...nameAddressBase(m, `manufacturer[${i}]`),
    tariffs: manufacturerTariffs(m, i, commodities),
  }));

  return {
    ...common,
    submissionType: '1',
    bond,
    references: references.length > 0 ? references : undefined,
    entities,
    manufacturers,
  };
}
