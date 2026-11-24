/**
 * AI pre-flight review: the parts that must not be left to the model.
 *
 * The drawer used to hand the model raw filing JSON and ask it to write
 * every section, so it invented will-reject issues the validator didn't
 * raise ("estimated departure is required for ISF-10"), echoed raw keys
 * (`voyageNumber`), and asserted PGA forms from a chapter-level hint table
 * (EPA 3520-1 for brake calipers). Now:
 *   • the will-reject and warning sections are rendered here, straight
 *     from validateFiling(), so the review can never disagree with it;
 *   • PGA hints are rendered here too, phrased as checks;
 *   • the model only writes advisory sections, sees labelled fields, and
 *     its output is passed through humanizeFieldKeys() as a backstop.
 */

import type { ValidationError, ValidationResult } from '../validation.js';
import { lookupPgaFlags } from './pgaFlags.js';

// ─── Field labels ─────────────────────────────────────────
// Match the labels on the ISF form (src/pages/ShipmentWizard.tsx), so the
// review points at fields the user can actually find.

const FIELD_LABELS: Record<string, string> = {
  filingType: 'Filing Type',
  bondType: 'Bond Type',
  masterBol: 'Master Bill of Lading',
  houseBol: 'House Bill of Lading',
  importerName: 'Importer Name',
  importerNumber: 'IOR Number (EIN)',
  consigneeName: 'Consignee Name',
  consigneeNumber: 'Consignee Number',
  consigneeAddress: 'Consignee Address',
  scacCode: 'SCAC Code',
  vesselName: 'Vessel Name',
  voyageNumber: 'Voyage Number',
  foreignPortOfUnlading: 'US Port of Arrival',
  placeOfDelivery: 'Place of Delivery',
  estimatedDeparture: 'Est. Departure Date',
  estimatedLading: 'Est. Lading Date',
  estimatedArrival: 'Est. Arrival Date',
  filingDeadline: 'ISF filing deadline',
  manufacturer: 'Manufacturer / Supplier',
  seller: 'Seller',
  buyer: 'Buyer',
  shipToParty: 'Ship-To Party',
  consolidator: 'Consolidator',
  containerStuffingLocation: 'Container Stuffing Location',
  commodities: 'Commodities',
  containers: 'Containers',
  'isf5Data.bookingPartyName': 'Booking Party Name',
  'isf5Data.bookingPartyCountry': 'Booking Party Country',
  'isf5Data.bookingPartyAddress1': 'Booking Party Address Line 1',
  'isf5Data.ISFFilerName': 'Filer Name',
  'isf5Data.ISFFilerNumber': 'Filer EIN Number',
  'isf5Data.USPortOfArrival': 'US Port of Arrival',
  'isf5Data.estimateDateOfArrival': 'Est. Arrival Date',
};

const SUB_LABELS: Record<string, string> = {
  name: 'Name',
  address1: 'Address Line 1',
  address2: 'Address Line 2',
  city: 'City',
  state: 'State',
  zip: 'Postal Code',
  country: 'Country',
  htsCode: 'HTS Code',
  htsNumber: 'HTS Code',
  description: 'Description',
  countryOfOrigin: 'Country of Origin',
  quantity: 'Quantity',
  weight: 'Weight',
  'weight.unit': 'Weight Unit',
  number: 'Number',
};

const ITEM_LABELS: Record<string, string> = { commodities: 'Commodity', containers: 'Container' };

function words(key: string): string {
  const spaced = key.replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

/** Field path from the validator or filing (`commodities[0].description`) → ISF form label. */
export function fieldLabel(path: string): string {
  if (FIELD_LABELS[path]) return FIELD_LABELS[path];
  const m = /^([A-Za-z0-9]+)(?:\[(\d+)\])?(?:\.(.+))?$/.exec(path);
  if (!m) return words(path);
  const [, root, index, rest] = m;
  const item = ITEM_LABELS[root];
  const base = item
    ? index !== undefined ? `${item} ${Number(index) + 1}` : item
    : FIELD_LABELS[root] ?? words(root);
  if (!rest) return base;
  return `${base} ${SUB_LABELS[rest] ?? words(rest.split('.').pop()!)}`;
}

// Raw keys the model tends to echo back: the root keys above plus the
// dotted forms it builds from them (`commodities.description`, `seller[0].name`).
const KEY_PATTERN = new RegExp(
  '`?\\b(' +
    Object.keys(FIELD_LABELS)
      .filter((k) => /[A-Z.]/.test(k))
      .concat(Object.keys(ITEM_LABELS), ['manufacturer', 'seller', 'buyer', 'consolidator'])
      .map((k) => k.replace('.', '\\.'))
      .join('|') +
    ')((?:\\[\\d+\\])?(?:\\.[A-Za-z0-9]+)*)\\b`?',
  'g',
);

/** Replace raw field keys in model output with their labels. Plain words ("seller") stay as written. */
export function humanizeFieldKeys(text: string): string {
  return text.replace(KEY_PATTERN, (match, root: string, tail: string) => {
    const isRawKey = /[A-Z]/.test(root) || tail.length > 0 || match.startsWith('`');
    return isRawKey ? fieldLabel(root + tail) : match;
  });
}

/** Streams arrive in token-sized chunks; buffer to whole lines so a key is never split mid-replace. */
export function createLineHumanizer() {
  let buf = '';
  return {
    push(chunk: string): string {
      buf += chunk;
      const cut = buf.lastIndexOf('\n');
      if (cut === -1) return '';
      const ready = buf.slice(0, cut + 1);
      buf = buf.slice(cut + 1);
      return humanizeFieldKeys(ready);
    },
    flush(): string {
      const rest = humanizeFieldKeys(buf);
      buf = '';
      return rest;
    },
  };
}

// ─── Deterministic sections ───────────────────────────────

function item(e: ValidationError): string {
  return `- **${fieldLabel(e.field)}**: ${e.message}`;
}

/** Sections 1 and 2, straight from the rule-based validator. */
export function renderRuleCheckSection(rule: ValidationResult): string {
  const critical = rule.errors.filter((e) => e.severity === 'critical');
  const warnings = rule.errors.filter((e) => e.severity === 'warning');
  const lines = [
    '**1. Will-reject issues**',
    '',
    critical.length === 0
      ? `None. The rule check found nothing that blocks sending (score ${rule.score}/100).`
      : `The rule check found ${critical.length} blocking issue${critical.length === 1 ? '' : 's'} (score ${rule.score}/100). Fix these before sending:`,
    ...(critical.length ? ['', ...critical.map(item)] : []),
    '',
    '**2. Rule-check warnings**',
    '',
    ...(warnings.length === 0
      ? ['None.']
      : ['These do not block sending, but are worth confirming:', '', ...warnings.map(item)]),
  ];
  return lines.join('\n') + '\n\n';
}

export interface PgaCommodity {
  hts: string | null;
  description: string | null;
}

/** PGA section from the curated HTS-prefix hints, phrased as checks rather than requirements. */
export function renderPgaSection(commodities: PgaCommodity[]): string {
  const rows = commodities
    .filter((c) => c.hts)
    .flatMap((c) =>
      lookupPgaFlags(c.hts!).map(
        (f) => `- **HTS ${c.hts}**${c.description ? ` (${c.description})` : ''}: Check whether ${f.agency} rules apply. ${f.action}.`,
      ),
    );
  if (rows.length === 0) return '';
  return [
    '**PGA items to check**',
    '',
    'Based on the HTS heading only, not on the product itself. Confirm against the agency rules before you send:',
    '',
    ...rows,
  ].join('\n') + '\n';
}

// ─── Model prompt ─────────────────────────────────────────

function present(v: unknown): unknown {
  if (v === null || v === undefined || v === '') return 'is empty';
  if (Array.isArray(v) && v.length === 0) return 'is empty';
  return v;
}

const PROMPT_FIELDS = [
  'filingType', 'bondType', 'masterBol', 'houseBol', 'scacCode', 'vesselName', 'voyageNumber',
  'foreignPortOfUnlading', 'placeOfDelivery', 'estimatedDeparture', 'estimatedArrival',
  'importerName', 'consigneeName', 'consigneeAddress', 'manufacturer', 'seller', 'buyer',
  'shipToParty', 'consolidator', 'containerStuffingLocation',
] as const;

/** Labelled, sanitised view of the filing: no ids, no tax ids, no raw keys. */
function labelledFiling(filing: any): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const k of PROMPT_FIELDS) out[fieldLabel(k)] = present(filing[k]);
  const commodities = Array.isArray(filing.commodities) ? filing.commodities : [];
  commodities.slice(0, 8).forEach((c: any, i: number) => {
    out[`Commodity ${i + 1}`] = {
      'HTS Code': present(c?.htsCode ?? c?.htsNumber),
      Description: present(c?.description),
      'Country of Origin': present(c?.countryOfOrigin),
    };
  });
  const containers = Array.isArray(filing.containers) ? filing.containers : [];
  out.Containers = present(containers.map((c: any) => c?.number ?? c?.containerNumber).filter(Boolean));
  return out;
}

export function buildDraftReviewPrompt(
  filing: any,
  rule: ValidationResult,
  uflpa?: { severity: string; reasons: string[] },
): string {
  const findings = rule.errors.length
    ? rule.errors.map((e) => `- [${e.severity}] ${fieldLabel(e.field)}: ${e.message}`).join('\n')
    : 'none';
  return `
You are pre-flighting a US customs ${filing.filingType ?? ''} filing before the importer sends it to CBP.

The rule-based check has already run and its result is shown to the user above your text. It is the authority on what blocks sending. Score ${rule.score}/100. Its findings:
${findings}

═══ FILING (field labels as on the form) ═══
${JSON.stringify(labelledFiling(filing), null, 2)}

═══ UFLPA SCREEN ═══
Severity: ${uflpa?.severity ?? 'not assessed'}
Reasons: ${uflpa?.reasons.join('; ') || 'none'}

═══ YOUR OUTPUT ═══
Write only these markdown sections (skip a section with nothing useful to say):

**3. Worth a second look**: things a CBP officer might question that the rule check cannot see, such as party names that look inconsistent, a description too vague for the HTS code, an origin that does not fit the supplier.

**4. Improvements**: valid but weak values, like vague descriptions or optional fields that would help.

**5. UFLPA / forced labor exposure**: only if the UFLPA severity is elevated or high; name the supply chain documents to gather.

Rules:
- Do not write a will-reject section and do not say any field is "required" or that CBP "will reject" the filing. The rule check decides that, and you must not contradict it.
- Do not name PGA agencies or forms; a separate PGA section is added after yours.
- The ten ISF-10 importer data elements are: manufacturer/supplier, seller, buyer, ship-to party, container stuffing location, consolidator, importer of record number, consignee number, country of origin, and HTS-6. Dates, vessel and voyage are not ISF data elements.
- Refer to fields by the labels shown above, never by internal keys. Quote the filing's actual values when relevant.
- When a field has no value, say it "is empty".
- Use short bulleted lists, each item starting with the field label in bold. No preamble.
  `.trim();
}
