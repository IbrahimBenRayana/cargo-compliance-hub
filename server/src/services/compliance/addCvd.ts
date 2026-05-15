/**
 * ADD/CVD (Anti-Dumping / Countervailing Duty) order lookup.
 *
 * Given an HTS prefix OR a country code OR a free-text query, returns
 * any active Commerce orders that might apply. Data is curated seed at
 * data/add-cvd-orders.json (~20 high-volume orders); Commerce maintains
 * ~600 orders total. Refresh cadence is "when we feel like it" for v1 —
 * a cron-driven sync from Commerce's ACE export is a future PR.
 *
 * Matching strategy:
 *   • HTS query: longest-prefix wins. "8541.43.00.10" matches "8541.43".
 *   • Country query: exact ISO-2.
 *   • Free text: case-insensitive substring across product / case# /
 *     country / HTS prefix.
 */

import data from '../../data/add-cvd-orders.json' with { type: 'json' };

export type AddCvdType = 'AD' | 'CVD' | 'ADCVD';

export interface AddCvdOrder {
  case: string;
  type: AddCvdType;
  country: string;
  product: string;
  htsPrefixes: string[];
  note: string;
}

interface AddCvdData {
  _meta: { source: string; lastUpdated: string; note: string; termsKey: Record<string, string> };
  orders: AddCvdOrder[];
}

const TABLE = data as AddCvdData;

function normaliseHts(hts: string): string {
  return (hts || '').replace(/\D/g, '');
}

export function lookupAddCvd(query: string): AddCvdOrder[] {
  const q = (query || '').trim();
  if (!q) return [];

  // HTS-numeric query: longest-prefix match across orders.
  if (/^\d/.test(q)) {
    const digits = normaliseHts(q);
    return TABLE.orders.filter((o) =>
      o.htsPrefixes.some((p) => digits.startsWith(normaliseHts(p))),
    );
  }

  // Country code query: 2 chars, alphanumeric.
  if (/^[A-Z]{2}$/i.test(q)) {
    const code = q.toUpperCase();
    return TABLE.orders.filter((o) => o.country === code);
  }

  // Free text: substring search across product, case#, country, HTS list.
  const needle = q.toLowerCase();
  return TABLE.orders.filter((o) =>
    o.product.toLowerCase().includes(needle) ||
    o.case.toLowerCase().includes(needle) ||
    o.country.toLowerCase().includes(needle) ||
    o.htsPrefixes.some((p) => p.toLowerCase().includes(needle)),
  );
}

export function getAddCvdMeta() {
  return TABLE._meta;
}
