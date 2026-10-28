/**
 * Step 3 (Trade Parties) checks for an ISF-10. Every party CBP gets needs a
 * name, street, city and country (SF30/35/36). In a consolidation the vendor
 * cards move into per-house-bill tabs, so the hidden shared cards are not
 * checked; each house bill's own card is, falling back to the shared value.
 */
export interface TradeParty {
  name: string; address1: string; address2: string;
  city: string; state: string; zip: string; country: string;
}

type PerHblKey = 'buyer' | 'seller' | 'shipToParty' | 'manufacturer';

export interface TradePartyInput {
  buyer: TradeParty; seller: TradeParty; shipToParty: TradeParty; manufacturer: TradeParty;
  consolidator: TradeParty; containerStuffingLocation: TradeParty;
  additionalManufacturers: TradeParty[];
  /** null = a single filing. */
  consolidationMode: 'buyer' | 'lcl' | null;
  perHblOverrides: Array<Partial<Record<PerHblKey, TradeParty>>>;
  houseBillCount: number;
}

/** The party cards that live in the per-house-bill tabs for a mode. */
export function perHblPartyKeys(mode: TradePartyInput['consolidationMode']): readonly PerHblKey[] {
  if (mode === 'lcl') return ['buyer', 'seller', 'shipToParty', 'manufacturer'];
  if (mode === 'buyer') return ['seller', 'manufacturer'];
  return [];
}

const PARTY_LABEL: Record<PerHblKey, string> = {
  buyer: 'Buyer', seller: 'Seller', shipToParty: 'Ship-To Party', manufacturer: 'Manufacturer',
};

function partyFieldErrors(key: string, p: TradeParty, e: Record<string, string>) {
  if (!p.name.trim()) e[`${key}.name`] = 'Name is required';
  if (!p.address1.trim()) e[`${key}.address1`] = 'Street address is required';
  if (!p.city.trim()) e[`${key}.city`] = 'City is required';
  if (!p.country) e[`${key}.country`] = 'Country is required';
}

const isBlank = (p: TradeParty) => !p.name.trim() && !p.address1.trim() && !p.city.trim() && !p.country;

export function tradePartyErrors(f: TradePartyInput): Record<string, string> {
  const e: Record<string, string> = {};
  const perHbl = perHblPartyKeys(f.consolidationMode);

  const shared = [
    ['buyer', f.buyer], ['seller', f.seller], ['shipToParty', f.shipToParty],
    ['manufacturer', f.manufacturer], ['consolidator', f.consolidator],
    ['containerStuffingLocation', f.containerStuffingLocation],
  ] as const;
  for (const [key, p] of shared) {
    if (!(perHbl as readonly string[]).includes(key)) partyFieldErrors(key, p, e);
  }
  // Extra manufacturers only show on a single filing.
  if (!f.consolidationMode) f.additionalManufacturers.forEach((m, i) => partyFieldErrors(`additionalManufacturers.${i}`, m, e));

  for (let idx = 0; idx < f.houseBillCount; idx++) {
    for (const key of perHbl) {
      const own = f.perHblOverrides[idx]?.[key];
      const effective = own ?? f[key];
      // Nothing here and nothing to inherit: flag the whole card.
      if (!own && isBlank(effective)) { e[`perHbl.${idx}.${key}`] = `${PARTY_LABEL[key]} is required for this house bill`; continue; }
      partyFieldErrors(`perHbl.${idx}.${key}`, effective, e);
    }
  }
  return e;
}
