/**
 * In-Bond (7512) — shared enum/constant data.
 *
 * Status colors, entry-type metadata, lifecycle event actions and unit
 * options for the In-Bond pages. Color tokens follow the same Tailwind
 * convention as `abiEnums.ts` / `StatusBadge.tsx`.
 */

import type {
  InbondEntryType,
  InbondEventAction,
  InbondStatus,
  InbondWeightUnit,
} from '../api/client';

export interface InbondStatusOption {
  value: InbondStatus;
  label: string;
  /** Pre-composed Tailwind badge classes mirroring StatusBadge.tsx. */
  className: string;
  dot: string;
}

export const INBOND_STATUSES: InbondStatusOption[] = [
  {
    value: 'DRAFT',
    label: 'Draft',
    dot: 'bg-slate-400',
    className:
      'bg-slate-400/10 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700/40',
  },
  {
    value: 'READY',
    label: 'Ready',
    dot: 'bg-blue-500',
    className:
      'bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800/50',
  },
  {
    value: 'TRANSMITTED',
    label: 'Transmitted',
    dot: 'bg-indigo-500',
    className:
      'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800/50',
  },
  {
    value: 'AUTHORIZED',
    label: 'Authorized',
    dot: 'bg-teal-500',
    className:
      'bg-teal-500/10 text-teal-600 dark:text-teal-400 border border-teal-200 dark:border-teal-800/50',
  },
  {
    value: 'ARRIVED',
    label: 'Arrived',
    dot: 'bg-emerald-500',
    className:
      'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/50',
  },
  {
    value: 'EXPORTED',
    label: 'Exported',
    dot: 'bg-emerald-500',
    className:
      'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/50',
  },
  {
    value: 'REJECTED',
    label: 'Rejected',
    dot: 'bg-red-500',
    className:
      'bg-red-500/10 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800/50',
  },
  {
    value: 'CANCELLED',
    label: 'Cancelled',
    dot: 'bg-slate-300',
    className:
      'bg-slate-400/8 text-slate-400 dark:text-slate-500 border border-slate-200 dark:border-slate-700/30 opacity-70',
  },
];

export const INBOND_STATUS_MAP: Record<InbondStatus, InbondStatusOption> =
  INBOND_STATUSES.reduce(
    (acc, s) => {
      acc[s.value] = s;
      return acc;
    },
    {} as Record<InbondStatus, InbondStatusOption>,
  );

// ─── Entry types ─────────────────────────────────────────────

export interface InbondEntryTypeMeta {
  value: InbondEntryType;
  /** Short badge label. */
  code: string;
  label: string;
  /** One-line plain-language description (tooltips + radio cards). */
  description: string;
  /** What CBP expects to happen at the end of the move. */
  lifecycle: string;
}

export const INBOND_ENTRY_TYPES: InbondEntryTypeMeta[] = [
  {
    value: '61',
    code: 'IT',
    label: 'Immediate Transportation',
    description: 'Move cargo port to port under bond — entry is filed at the destination port.',
    lifecycle: 'File → move under bond → record the arrival at the destination port. No export event is needed.',
  },
  {
    value: '62',
    code: 'T&E',
    label: 'Transportation & Exportation',
    description: 'Move cargo through the US under bond to a foreign port.',
    lifecycle: 'File → move under bond → record the arrival at the export port → record the export.',
  },
  {
    value: '63',
    code: 'IE',
    label: 'Immediate Exportation',
    description: 'Export cargo immediately from the port where it sits.',
    lifecycle: 'File → record the export. No arrival event is needed.',
  },
];

export const INBOND_ENTRY_TYPE_MAP: Record<InbondEntryType, InbondEntryTypeMeta> =
  INBOND_ENTRY_TYPES.reduce(
    (acc, t) => {
      acc[t.value] = t;
      return acc;
    },
    {} as Record<InbondEntryType, InbondEntryTypeMeta>,
  );

// ─── Lifecycle events (WP actions) ───────────────────────────

export interface InbondEventActionMeta {
  value: InbondEventAction;
  label: string;
  /** Scope shown next to the label in the timeline. */
  scope: 'in-bond' | 'bill' | 'container' | '';
  /** Verb group for filtering/field logic. */
  group: 'arrive' | 'export' | 'transfer' | 'divert';
}

export const INBOND_EVENT_ACTIONS: InbondEventActionMeta[] = [
  { value: '1', label: 'Arrive',             scope: 'in-bond',   group: 'arrive' },
  { value: '2', label: 'Arrive',             scope: 'bill',      group: 'arrive' },
  { value: '3', label: 'Arrive',             scope: 'container', group: 'arrive' },
  { value: '5', label: 'Export',             scope: 'in-bond',   group: 'export' },
  { value: '6', label: 'Export',             scope: 'bill',      group: 'export' },
  { value: '7', label: 'Export',             scope: 'container', group: 'export' },
  { value: 'A', label: 'Transfer liability', scope: '',          group: 'transfer' },
  { value: 'Z', label: 'Divert',             scope: '',          group: 'divert' },
];

export const INBOND_EVENT_ACTION_MAP: Record<InbondEventAction, InbondEventActionMeta> =
  INBOND_EVENT_ACTIONS.reduce(
    (acc, a) => {
      acc[a.value] = a;
      return acc;
    },
    {} as Record<InbondEventAction, InbondEventActionMeta>,
  );

/**
 * Actions offered per entry type (WP10 Note 1 lifecycle): 61 arrive-only,
 * 62 arrive-then-export, 63 export-only; transfer/divert always available.
 */
export function eventActionsForEntryType(entryType: InbondEntryType): InbondEventActionMeta[] {
  return INBOND_EVENT_ACTIONS.filter((a) => {
    if (a.group === 'transfer' || a.group === 'divert') return true;
    if (entryType === '61') return a.group === 'arrive';
    if (entryType === '63') return a.group === 'export';
    return true; // 62: arrive + export
  });
}

// ─── Units & MOT ─────────────────────────────────────────────

export const INBOND_WEIGHT_UNITS: Array<{ value: InbondWeightUnit; label: string }> = [
  { value: 'LB', label: 'LB — Pounds' },
  { value: 'KG', label: 'KG — Kilograms' },
  { value: 'LT', label: 'LT — Long tons' },
  { value: 'ST', label: 'ST — Short tons' },
  { value: 'ET', label: 'ET — Metric tons (ET)' },
  { value: 'MT', label: 'MT — Metric tons' },
];

/** Import MOT codes the In-Bond chapter prints for QP20. */
export const INBOND_MOT_OPTIONS = [
  { value: '30', label: '30 — Truck' },
  { value: '40', label: '40 — Air' },
  { value: '70', label: '70 — Pipeline' },
];
