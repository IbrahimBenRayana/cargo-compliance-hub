/**
 * ABI Entry Summary 7501 — shared enum/constant data.
 *
 * Dropdown option sources for the ABI wizard. Port lookups are NOT duplicated
 * here — use `SCHEDULE_D_PORTS` from `./schedule-d-ports` for port fields.
 *
 * Color tokens follow the app's Tailwind convention used in
 * `src/components/StatusBadge.tsx` (slate / blue / emerald / red / amber).
 */

import type { AbiDocumentStatus } from '../api/client';

export interface EnumOption<T extends string = string> {
  value: T;
  label: string;
}

export interface StatusOption {
  value: AbiDocumentStatus;
  label: string;
  /** Semantic color name (consumers map this to Tailwind classes). */
  color: 'slate' | 'amber' | 'blue' | 'emerald' | 'red' | 'muted';
  /** Pre-composed Tailwind badge classes mirroring StatusBadge.tsx. */
  className: string;
  dot: string;
}

export const ABI_DOCUMENT_STATUSES: StatusOption[] = [
  {
    value: 'DRAFT',
    label: 'Draft',
    color: 'slate',
    dot: 'bg-slate-400',
    className:
      'bg-slate-400/10 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700/40',
  },
  {
    value: 'SENDING',
    label: 'Sending',
    color: 'amber',
    dot: 'bg-amber-500',
    className:
      'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-800/50',
  },
  {
    value: 'SENT',
    label: 'Sent',
    color: 'blue',
    dot: 'bg-blue-500',
    className:
      'bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800/50',
  },
  {
    value: 'ACCEPTED',
    label: 'Accepted',
    color: 'emerald',
    dot: 'bg-emerald-500',
    className:
      'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/50',
  },
  {
    value: 'REJECTED',
    label: 'Rejected',
    color: 'red',
    dot: 'bg-red-500',
    className:
      'bg-red-500/10 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800/50',
  },
  {
    value: 'CANCELLED',
    label: 'Cancelled',
    color: 'muted',
    dot: 'bg-slate-300',
    className:
      'bg-slate-400/8 text-slate-400 dark:text-slate-500 border border-slate-200 dark:border-slate-700/30 opacity-70',
  },
];

/** Quick lookup for a status badge config. */
export const ABI_DOCUMENT_STATUS_MAP: Record<AbiDocumentStatus, StatusOption> =
  ABI_DOCUMENT_STATUSES.reduce(
    (acc, s) => {
      acc[s.value] = s;
      return acc;
    },
    {} as Record<AbiDocumentStatus, StatusOption>,
  );

// ─── Entry Types (Phase 1 scope: "01"; "11" included for UI completeness) ──
export const ENTRY_TYPES: EnumOption[] = [
  { value: '01', label: 'Consumption Entry (Formal)' },
  { value: '11', label: 'Informal Entry' },
];

// ─── CBP Modes of Transport (common codes) ─────────────────────────────────
// Full list is 30+ codes; Phase 1 ships the most common half-dozen.
export const MODES_OF_TRANSPORT: EnumOption[] = [
  { value: '10', label: '10 — Vessel, Non-Container' },
  { value: '11', label: '11 — Vessel, Container' },
  { value: '31', label: '31 — Air' },
  { value: '40', label: '40 — Truck (Rail-Only Border Crossing)' },
  { value: '41', label: '41 — Rail, Containerized' },
  { value: '42', label: '42 — Truck' },
];

// ─── Bond Types ────────────────────────────────────────────────────────────
export const BOND_TYPES: EnumOption[] = [
  { value: '8', label: '8 — Continuous' },
  { value: '9', label: '9 — Single Transaction' },
];

// ─── ABI Payment Type Codes ────────────────────────────────────────────────
export const PAYMENT_TYPE_CODES: EnumOption[] = [
  { value: '1', label: '1 — Cash / Check' },
  { value: '2', label: '2 — Statement' },
  { value: '3', label: '3 — Broker PMS (Periodic Monthly Statement)' },
  { value: '6', label: '6 — Importer ACH Credit' },
  { value: '7', label: '7 — Daily Statement' },
  { value: '8', label: '8 — Periodic Monthly Statement' },
];

// ─── Bill of Lading Types ──────────────────────────────────────────────────
export const BILL_TYPES: EnumOption<'M' | 'H'>[] = [
  { value: 'M', label: 'Master' },
  { value: 'H', label: 'House' },
];

// ─── Weight UOM ────────────────────────────────────────────────────────────
export const WEIGHT_UOM: EnumOption<'K' | 'L'>[] = [
  { value: 'K', label: 'Kilograms' },
  { value: 'L', label: 'Pounds' },
];

// ─── Quantity UOM (common CBP codes) ───────────────────────────────────────
export const QUANTITY_UOM: EnumOption[] = [
  { value: 'NO', label: 'NO — Number' },
  { value: 'PCS', label: 'PCS — Pieces' },
  { value: 'BX', label: 'BX — Boxes' },
  { value: 'CT', label: 'CT — Crate' },
  { value: 'CTN', label: 'CTN — Cartons' },
  { value: 'PK', label: 'PK — Package' },
  { value: 'PLT', label: 'PLT — Pallet' },
  { value: 'DRM', label: 'DRM — Drum' },
  { value: 'BG', label: 'BG — Bag' },
  { value: 'BBL', label: 'BBL — Barrel' },
  { value: 'RL', label: 'RL — Roll' },
  { value: 'SET', label: 'SET — Set' },
  { value: 'DOZ', label: 'DOZ — Dozen' },
  { value: 'AMM', label: 'AMM — Ammonia' },
];

// ─── Yes / No ──────────────────────────────────────────────────────────────
export const YES_NO: EnumOption<'Y' | 'N'>[] = [
  { value: 'Y', label: 'Yes' },
  { value: 'N', label: 'No' },
];

// ─── Party Types ───────────────────────────────────────────────────────────
export type PartyType = 'manufacturer' | 'seller' | 'buyer' | 'shipTo';

export const PARTY_TYPES: EnumOption<PartyType>[] = [
  { value: 'manufacturer', label: 'Manufacturer' },
  { value: 'seller', label: 'Seller' },
  { value: 'buyer', label: 'Buyer' },
  { value: 'shipTo', label: 'Ship To' },
];
