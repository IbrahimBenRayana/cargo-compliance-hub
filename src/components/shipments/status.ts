/**
 * The Shipments page names states the way the dashboard does: an ISF that has
 * gone out is "Sent", whatever CBP has or has not answered yet.
 */
import type { Filing, ShipmentStatus } from '@/types/shipment';
import type { FilterTab } from '@/components/dashboard/FilterTabs';
import type { Tone } from '@/components/dashboard/tones';

export const STATUS: Record<ShipmentStatus, { word: string; tone: Tone }> = {
  draft: { word: 'Draft', tone: 'calm' },
  submitted: { word: 'Sent', tone: 'info' },
  pending_cbp: { word: 'Sent', tone: 'info' },
  accepted: { word: 'Accepted', tone: 'done' },
  amended: { word: 'Amended', tone: 'done' },
  rejected: { word: 'Rejected', tone: 'urgent' },
  on_hold: { word: 'On hold', tone: 'soon' },
  cancelled: { word: 'Cancelled', tone: 'calm' },
};

export type Tab = 'all' | 'draft' | 'sent' | 'accepted' | 'rejected' | 'on_hold' | 'cancelled';

export const TABS: { key: Tab; label: string; statuses: ShipmentStatus[] }[] = [
  { key: 'all', label: 'All', statuses: [] },
  { key: 'draft', label: 'Drafts', statuses: ['draft'] },
  { key: 'sent', label: 'Sent', statuses: ['submitted', 'pending_cbp'] },
  { key: 'accepted', label: 'Accepted', statuses: ['accepted', 'amended'] },
  { key: 'rejected', label: 'Rejected', statuses: ['rejected'] },
  { key: 'on_hold', label: 'On hold', statuses: ['on_hold'] },
  { key: 'cancelled', label: 'Cancelled', statuses: ['cancelled'] },
];

export const isTab = (v: string | null): v is Tab => TABS.some((t) => t.key === v);

/** A cutoff still matters while the ISF has not gone out or has to go again. */
export const cutoffMatters = (status: string) => status === 'draft' || status === 'rejected';

export function tabsWithCounts(byStatus: Record<string, number> | undefined): FilterTab<Tab>[] {
  const all = Object.values(byStatus ?? {}).reduce((a, b) => a + b, 0);
  return TABS.map((t) => ({
    key: t.key,
    label: t.label,
    count: t.key === 'all' ? all : t.statuses.reduce((n, s) => n + (byStatus?.[s] ?? 0), 0),
  }));
}

/** The shipment's own heading everywhere in the app: house bill, then master bill. */
export const refOf = (f: Filing) => f.houseBol || f.masterBol || f.id.slice(0, 8);
