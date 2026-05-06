/**
 * Pre-fill the Duty Calculator from an ISF Filing.
 *
 * Hand-crafted, opinionated mapping. NOT a generic engine — there are
 * exactly two source kinds we care about (filing today, ABI entry later)
 * and each gets its own small transformer here.
 *
 * Coverage is partial by design: a Filing has shipment metadata + a
 * commodities[] array, but lacks duty-affecting precision (10-digit HTS,
 * special program codes, line-item itemization). Pre-fill lands you the
 * scaffolding; the duty-affecting details still need user attention.
 */

import type { Filing, CommodityInfo } from '@/types/shipment';
import type { AbiDocument, ABIItem } from '@/api/client';

// Mirrors ItemDraft in DutyCalculatorPage.tsx — we keep the shape narrow
// here so this module can be imported without dragging the whole page in.
export interface PrefillItemDraft {
  hts: string;
  description: string;
  totalValue: string;
  quantity1: string;
  quantity2: string;
  spi: string;
  aluminumPercentage: string;
  steelPercentage: string;
  copperPercentage: string;
  isCottonExempt: boolean;
  isAutoPartExempt: boolean;
  kitchenPartNotComplete: boolean;
  isInformationalMaterialExempt: boolean;
}

export interface PrefillBundle {
  countryOfOrigin?: string;
  modeOfTransportation?: 'ocean' | 'air' | 'truck' | 'rail';
  currency?: string;
  items?: PrefillItemDraft[];
  /** Field keys that were filled. Drives provenance chips on the page. */
  filledFields: string[];
}

export interface SourceProvenance {
  /** Display label, e.g. "SHIP-1A2B3C" or "ENTRY-XXX-NNNNNNN-N" */
  label: string;
  /** Deep-link to the source. */
  url: string;
  /** When the source was created — used to flag staleness in the UI. */
  createdAt: string;
  /** Source kind so the banner can read "Pre-filled from ISF SHIP-1234"
   *  or "Pre-filled from CBP Entry XXX-NNNNNNN-N". */
  kind: 'filing' | 'abi';
}

// ─── Filing → Duty Calculator ────────────────────────────────────────

export function filingToDutyCalc(filing: Filing): {
  prefill: PrefillBundle;
  provenance: SourceProvenance;
} {
  const filledFields: string[] = [];
  const prefill: PrefillBundle = { filledFields };

  // Country of origin: take from the first commodity. If the filing has
  // mixed-origin commodities, the user will see the chip and can edit.
  const firstCountry = filing.commodities?.[0]?.countryOfOrigin?.trim();
  if (firstCountry) {
    prefill.countryOfOrigin = firstCountry.toUpperCase();
    filledFields.push('countryOfOrigin');
  }

  // Mode of transport: ISF-10 is vessel-based by definition; ISF-5 is
  // typically air. We use vesselName as a sanity check — present →
  // ocean, absent on ISF-5 → air. Falls through with no prefill on the
  // unusual cases.
  const filingType = filing.filingType;
  const hasVessel = !!filing.vesselName;
  if (filingType === 'ISF-10' || hasVessel) {
    prefill.modeOfTransportation = 'ocean';
    filledFields.push('modeOfTransportation');
  } else if (filingType === 'ISF-5') {
    prefill.modeOfTransportation = 'air';
    filledFields.push('modeOfTransportation');
  }

  // Currency: the first commodity's value.currency, if any.
  const firstCurrency = filing.commodities?.[0]?.value?.currency;
  if (firstCurrency) {
    prefill.currency = firstCurrency.toUpperCase();
    filledFields.push('currency');
  }

  // Items: one PrefillItemDraft per commodity. We fill the obvious bits
  // (hts, description, value, quantity) and leave the duty-affecting
  // exemption flags + special-program codes for the user.
  if (filing.commodities?.length) {
    prefill.items = filing.commodities.map(commodityToItemDraft);
    // Field keys for items use index notation so per-field provenance
    // can be attached cleanly: 'item.0.hts', 'item.1.totalValue', etc.
    prefill.items.forEach((it, i) => {
      if (it.hts) filledFields.push(`item.${i}.hts`);
      if (it.description) filledFields.push(`item.${i}.description`);
      if (it.totalValue) filledFields.push(`item.${i}.totalValue`);
      if (it.quantity1) filledFields.push(`item.${i}.quantity1`);
    });
  }

  const provenance: SourceProvenance = {
    label:     filing.masterBol || filing.houseBol || filing.id.slice(0, 8).toUpperCase(),
    url:       `/shipments/${filing.id}`,
    createdAt: filing.createdAt,
    kind:      'filing',
  };

  return { prefill, provenance };
}

function commodityToItemDraft(c: CommodityInfo): PrefillItemDraft {
  return {
    hts:         c.htsCode ?? '',
    description: c.description ?? '',
    totalValue:  c.value?.amount != null ? String(c.value.amount) : '',
    quantity1:   c.quantity != null ? String(c.quantity) : '',
    quantity2:   '',
    spi:         '',
    aluminumPercentage: '',
    steelPercentage:    '',
    copperPercentage:   '',
    isCottonExempt:                false,
    isAutoPartExempt:              false,
    kitchenPartNotComplete:        false,
    isInformationalMaterialExempt: false,
  };
}

// ─── Staleness ────────────────────────────────────────────────────────

/** Days since the source was created (UTC, day-resolution). */
export function ageInDays(iso: string): number {
  const created = new Date(iso).getTime();
  const now = Date.now();
  return Math.floor((now - created) / (24 * 60 * 60 * 1000));
}

/** True when a source is old enough that the user should re-verify. */
export function isStale(iso: string, thresholdDays = 14): boolean {
  return ageInDays(iso) >= thresholdDays;
}

// ─── ABI Entry → Duty Calculator ─────────────────────────────────────
// ABI entries are the highest-fidelity source for the duty calc — by
// construction they contain every duty-affecting field already.
// Flattening: an entry has `manifest[].invoices[].items[]`. We flatten
// to a single item list ordered as the user authored them in the wizard.

export function abiDocumentToDutyCalc(doc: AbiDocument): {
  prefill: PrefillBundle;
  provenance: SourceProvenance;
} {
  const filledFields: string[] = [];
  const prefill: PrefillBundle = { filledFields };

  // Flatten manifest → invoices → items into a flat array.
  const flatItems: ABIItem[] = [];
  const manifests = doc.payload?.manifest ?? [];
  for (const m of manifests) {
    const invoices = m?.invoices ?? [];
    for (const inv of invoices) {
      const items = inv?.items ?? [];
      for (const it of items) {
        // Skip items that are still pure drafts (no HTS, no description).
        // They wouldn't pre-fill anything useful.
        if (!it?.htsNumber && !it?.description) continue;
        flatItems.push(it as ABIItem);
      }
    }
  }

  // Country of origin: take the first item's origin.country. Mixed-origin
  // entries will lose precision here — the user can edit, the chip shows
  // the source so they can spot-check.
  const firstCountry = flatItems[0]?.origin?.country?.trim();
  if (firstCountry) {
    prefill.countryOfOrigin = firstCountry.toUpperCase();
    filledFields.push('countryOfOrigin');
  }

  // Mode of transport: CBP codes are "40" = vessel/ocean, "41" = air.
  // Anything else stays unfilled (truck/rail are "30"/"32" but we don't
  // see those in ocean import flows today).
  const mot = doc.modeOfTransport;
  if (mot === '40') {
    prefill.modeOfTransportation = 'ocean';
    filledFields.push('modeOfTransportation');
  } else if (mot === '41') {
    prefill.modeOfTransportation = 'air';
    filledFields.push('modeOfTransportation');
  }

  // Currency: from the first invoice that has one.
  const firstCurrency = manifests
    .flatMap(m => m?.invoices ?? [])
    .map(inv => inv?.currency)
    .find(c => !!c);
  if (firstCurrency) {
    prefill.currency = firstCurrency.toUpperCase();
    filledFields.push('currency');
  }

  // Items: per ABIItem → PrefillItemDraft. ABI is rich enough that we
  // copy the trade-compliance flags too (cotton / auto / kitchen /
  // informational / aluminum & steel & copper percentages).
  if (flatItems.length > 0) {
    prefill.items = flatItems.map(itemFromAbiItem);
    prefill.items.forEach((it, i) => {
      if (it.hts) filledFields.push(`item.${i}.hts`);
      if (it.description) filledFields.push(`item.${i}.description`);
      if (it.totalValue) filledFields.push(`item.${i}.totalValue`);
      if (it.quantity1) filledFields.push(`item.${i}.quantity1`);
    });
  }

  // Provenance label: prefer the CBP-canonical entry number, fall back
  // to the master BOL, then a short id slice.
  const label =
    doc.entryNumber ||
    doc.mbolNumber ||
    doc.id.slice(0, 8).toUpperCase();

  return {
    prefill,
    provenance: {
      label,
      url:       `/abi-documents/${doc.id}`,
      createdAt: doc.createdAt,
      kind:      'abi',
    },
  };
}

function itemFromAbiItem(it: ABIItem): PrefillItemDraft {
  const totalValue = it.values?.totalValueOfGoods;
  return {
    hts:         it.htsNumber ?? '',
    description: it.description ?? '',
    totalValue:  totalValue != null ? String(totalValue) : '',
    quantity1:   it.quantity1 ?? '',
    quantity2:   '',
    spi:         '',
    aluminumPercentage: it.aluminumPercentage != null ? String(it.aluminumPercentage) : '',
    steelPercentage:    it.steelPercentage    != null ? String(it.steelPercentage)    : '',
    copperPercentage:   it.copperPercentage   != null ? String(it.copperPercentage)   : '',
    isCottonExempt:                it.cottonFeeExemption === 'Y',
    isAutoPartExempt:              it.autoPartsExemption === 'Y',
    kitchenPartNotComplete:        it.otherThanCompletedKitchenParts === 'Y',
    isInformationalMaterialExempt: it.informationalMaterialsExemption === 'Y',
  };
}
