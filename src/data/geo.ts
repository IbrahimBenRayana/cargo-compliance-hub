/**
 * Shared US-state and country pick-lists used across the ABI wizard,
 * duty calculator, and shipment wizard.
 *
 * Lifted out of `components/abi-wizard/shared.tsx` so non-wizard pages
 * (DutyCalculatorPage, etc.) don't have to reach into a UI module for
 * static data.
 */

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

/** Common countries reused across invoice / item / consignee selectors. */
export const COUNTRIES: { value: string; label: string }[] = [
  { value: 'US', label: 'US — United States' },
  { value: 'CN', label: 'CN — China' },
  { value: 'IN', label: 'IN — India' },
  { value: 'DE', label: 'DE — Germany' },
  { value: 'JP', label: 'JP — Japan' },
  { value: 'KR', label: 'KR — South Korea' },
  { value: 'TW', label: 'TW — Taiwan' },
  { value: 'VN', label: 'VN — Vietnam' },
  { value: 'TH', label: 'TH — Thailand' },
  { value: 'MX', label: 'MX — Mexico' },
  { value: 'CA', label: 'CA — Canada' },
  { value: 'GB', label: 'GB — United Kingdom' },
  { value: 'FR', label: 'FR — France' },
  { value: 'IT', label: 'IT — Italy' },
  { value: 'BR', label: 'BR — Brazil' },
  { value: 'BD', label: 'BD — Bangladesh' },
  { value: 'ID', label: 'ID — Indonesia' },
  { value: 'PK', label: 'PK — Pakistan' },
  { value: 'TR', label: 'TR — Turkey' },
  { value: 'MY', label: 'MY — Malaysia' },
  { value: 'SG', label: 'SG — Singapore' },
  { value: 'HK', label: 'HK — Hong Kong' },
  { value: 'AE', label: 'AE — UAE' },
  { value: 'NL', label: 'NL — Netherlands' },
  { value: 'ES', label: 'ES — Spain' },
  { value: 'AU', label: 'AU — Australia' },
  { value: 'PH', label: 'PH — Philippines' },
];

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
