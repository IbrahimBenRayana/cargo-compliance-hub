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

// ─── Entry Types ──────────────────────────────────────────────────────────
// 86 (de minimis) is listed but disabled: CBP suspended it on 2025-08-29 and
// made the suspension indefinite on 2026-06-24. 11 opens with native entries.
export const ENTRY_TYPES: EnumOption[] = [
  { value: '01', label: 'Consumption Entry (Formal)' },
  { value: '11', label: 'Informal Entry' },
  { value: '86', label: 'De Minimis (Type 86), suspended by CBP' },
];

// ─── CBP Modes of Transportation (CATAIR AE Table 3, ESF-215) ───────────────
// Mirrors server/src/abi-engine/ae/tables.ts MOT_CODES; the code is
// transmitted as-is, so labels must match CBP exactly.
export const MODES_OF_TRANSPORT: EnumOption[] = [
  { value: '10', label: '10 — Vessel, non-containerized' },
  { value: '11', label: '11 — Vessel, containerized' },
  { value: '12', label: '12 — Border water borne' },
  { value: '20', label: '20 — Rail, non-containerized' },
  { value: '21', label: '21 — Rail, containerized' },
  { value: '30', label: '30 — Truck, non-containerized' },
  { value: '31', label: '31 — Truck, containerized' },
  { value: '32', label: '32 — Auto' },
  { value: '33', label: '33 — Pedestrian' },
  { value: '34', label: '34 — Road, other' },
  { value: '40', label: '40 — Air, non-containerized' },
  { value: '41', label: '41 — Air, containerized' },
  { value: '50', label: '50 — Mail' },
  { value: '60', label: '60 — Passenger, hand carried' },
  { value: '70', label: '70 — Fixed transport (pipeline, power)' },
];

// ─── Bond Types ────────────────────────────────────────────────────────────
export const BOND_TYPES: EnumOption[] = [
  { value: '8', label: '8 — Continuous' },
  { value: '9', label: '9 — Single Transaction' },
];

// ─── ABI Payment Type Codes (CATAIR AE 10-record, ESF-31) ──────────────────
// 2/3/5 batch into the daily statement and 6/7/8 into the periodic monthly
// statement (by filer, full IOR number, IOR without suffix respectively).
export const PAYMENT_TYPE_CODES: EnumOption[] = [
  { value: '1', label: '1 — Individual payment' },
  { value: '2', label: '2 — Daily statement, by filer' },
  { value: '3', label: '3 — Daily statement, by importer of record' },
  { value: '5', label: '5 — Daily statement, by importer (no suffix)' },
  { value: '6', label: '6 — Periodic monthly statement, by filer' },
  { value: '7', label: '7 — Periodic monthly statement, by importer of record' },
  { value: '8', label: '8 — Periodic monthly statement, by importer (no suffix)' },
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
