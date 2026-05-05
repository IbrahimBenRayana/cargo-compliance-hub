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
  /** Display label, e.g. "SHIP-1A2B3C" */
  label: string;
  /** Deep-link to the source. */
  url: string;
  /** When the source was created — used to flag staleness in the UI. */
  createdAt: string;
  /** Source kind so the banner can read "Pre-filled from ISF SHIP-1234". */
  kind: 'filing';
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
