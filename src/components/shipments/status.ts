/**
 * The Shipments page names states the way the dashboard does: an ISF that has
 * gone out is "Sent", whatever CBP has or has not answered yet.
 */
import type { LucideIcon } from 'lucide-react';
import { Ban, CheckCircle2, FileCheck2, FilePen, PauseCircle, Send, XCircle } from 'lucide-react';
import type { Filing, ShipmentStatus } from '@/types/shipment';
import type { FilterTab } from '@/components/dashboard/FilterTabs';
import type { Tone } from '@/components/dashboard/tones';

export const STATUS: Record<ShipmentStatus, { word: string; tone: Tone; icon: LucideIcon }> = {
  draft: { word: 'Draft', tone: 'calm', icon: FilePen },
  submitted: { word: 'Sent', tone: 'info', icon: Send },
  pending_cbp: { word: 'Sent', tone: 'info', icon: Send },
  accepted: { word: 'Accepted', tone: 'done', icon: CheckCircle2 },
  amended: { word: 'Amended', tone: 'done', icon: FileCheck2 },
  rejected: { word: 'Rejected', tone: 'urgent', icon: XCircle },
  on_hold: { word: 'On hold', tone: 'soon', icon: PauseCircle },
  cancelled: { word: 'Cancelled', tone: 'calm', icon: Ban },
};

/** Any status the server sends, including one this build has not heard of. */
export const statusOf = (status: string) => STATUS[status as ShipmentStatus] ?? { word: status, tone: 'calm' as Tone, icon: FilePen };

export type Tab = 'all' | 'draft' | 'sent' | 'accepted' | 'rejected' | 'on_hold' | 'cancelled';

export const TABS: { key: Tab; label: string; statuses: ShipmentStatus[]; tone?: Tone }[] = [
  { key: 'all', label: 'All', statuses: [] },
  { key: 'draft', label: 'Drafts', statuses: ['draft'] },
  { key: 'sent', label: 'Sent', statuses: ['submitted', 'pending_cbp'], tone: 'info' },
  { key: 'accepted', label: 'Accepted', statuses: ['accepted', 'amended'], tone: 'done' },
  { key: 'rejected', label: 'Rejected', statuses: ['rejected'], tone: 'urgent' },
  { key: 'on_hold', label: 'On hold', statuses: ['on_hold'], tone: 'soon' },
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
    tone: t.tone,
    count: t.key === 'all' ? all : t.statuses.reduce((n, s) => n + (byStatus?.[s] ?? 0), 0),
  }));
}

/** The shipment's own heading everywhere in the app: house bill, then master bill. */
export const refOf = (f: Filing) => f.houseBol || f.masterBol || f.id.slice(0, 8);
