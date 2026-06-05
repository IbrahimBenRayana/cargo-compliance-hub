/**
 * Shared US-state and country pick-lists used across the ABI wizard,
 * duty calculator, and shipment wizard.
 *
 * COUNTRIES is the complete ISO 3166-1 alpha-2 list (~250 entries),
 * derived at module-init from the `world-countries` npm package. Each
 * option carries a flag emoji (e.g. 🇺🇸), the common English name,
 * and a `keywords` array (alt spellings + ISO code) so the searchable
 * combobox matches "USA", "U.S.A.", "America" → United States, etc.
 *
 * `value` is the ISO 3166-1 alpha-2 code — that's what CustomsCity
 * expects and what we persist in filings.
 */

import worldCountries from 'world-countries';

/** Convert an ISO alpha-2 code (e.g. "US") into its flag emoji. */
function flagFromIso2(code: string): string {
  return code
    .toUpperCase()
    .split('')
    .map((c) => String.fromCodePoint(127397 + c.charCodeAt(0)))
    .join('');
}

export interface CountryOption {
  value: string;
  label: string;
  /** Extra strings the combobox should match against (ISO code, alt spellings). */
  keywords?: string[];
}

export const COUNTRIES: CountryOption[] = (worldCountries as Array<{
  cca2: string;
  name: { common: string };
  altSpellings: string[];
  flag?: string;
}>)
  .filter((c) => c.cca2 && c.cca2.length === 2)
  .map((c) => {
    const code = c.cca2.toUpperCase();
    const name = c.name.common;
    // Use the country's own .flag when present, else derive from the
    // ISO code. world-countries already provides .flag for every entry,
    // but the derivation is a safe fallback if a record is missing it.
    const flag = c.flag || flagFromIso2(code);
    return {
      value: code,
      label: `${flag}  ${name}`,
      // altSpellings often contains the ISO code as the first entry —
      // dedupe + include common name so cmdk substring matching finds
      // the country regardless of which alias the user types.
      keywords: Array.from(new Set([code, name, ...c.altSpellings])),
    };
  })
  .sort((a, b) => a.label.localeCompare(b.label, 'en', { sensitivity: 'base' }));

/** US states (50 + DC + PR). Stable, hardcoded — no package dependency. */
export const US_STATES: { value: string; label: string }[] = (
  [
    ['AL', 'Alabama'], ['AK', 'Alaska'], ['AZ', 'Arizona'], ['AR', 'Arkansas'],
    ['CA', 'California'], ['CO', 'Colorado'], ['CT', 'Connecticut'], ['DE', 'Delaware'],
    ['DC', 'District of Columbia'], ['FL', 'Florida'], ['GA', 'Georgia'], ['HI', 'Hawaii'],
    ['ID', 'Idaho'], ['IL', 'Illinois'], ['IN', 'Indiana'], ['IA', 'Iowa'],
    ['KS', 'Kansas'], ['KY', 'Kentucky'], ['LA', 'Louisiana'], ['ME', 'Maine'],
    ['MD', 'Maryland'], ['MA', 'Massachusetts'], ['MI', 'Michigan'], ['MN', 'Minnesota'],
    ['MS', 'Mississippi'], ['MO', 'Missouri'], ['MT', 'Montana'], ['NE', 'Nebraska'],
    ['NV', 'Nevada'], ['NH', 'New Hampshire'], ['NJ', 'New Jersey'], ['NM', 'New Mexico'],
    ['NY', 'New York'], ['NC', 'North Carolina'], ['ND', 'North Dakota'], ['OH', 'Ohio'],
    ['OK', 'Oklahoma'], ['OR', 'Oregon'], ['PA', 'Pennsylvania'], ['RI', 'Rhode Island'],
    ['SC', 'South Carolina'], ['SD', 'South Dakota'], ['TN', 'Tennessee'], ['TX', 'Texas'],
    ['UT', 'Utah'], ['VT', 'Vermont'], ['VA', 'Virginia'], ['WA', 'Washington'],
    ['WV', 'West Virginia'], ['WI', 'Wisconsin'], ['WY', 'Wyoming'], ['PR', 'Puerto Rico'],
  ] as const
).map(([value, label]) => ({ value, label: `${value} — ${label}` }));

export const CURRENCIES: { value: string; label: string }[] = [
  { value: 'USD', label: 'USD' },
  { value: 'EUR', label: 'EUR' },
  { value: 'GBP', label: 'GBP' },
  { value: 'JPY', label: 'JPY' },
  { value: 'CNY', label: 'CNY' },
  { value: 'CAD', label: 'CAD' },
  { value: 'MXN', label: 'MXN' },
  { value: 'KRW', label: 'KRW' },
  { value: 'INR', label: 'INR' },
  { value: 'AUD', label: 'AUD' },
];
