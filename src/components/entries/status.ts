/**
 * Entry states in the app's words and colours: an entry that has gone out is
 * "Sent" whatever CBP has or has not answered, as with ISFs. An accepted
 * entry is accepted, never cleared or released: the app does not see a release.
 */
import type { LucideIcon } from 'lucide-react';
import { Ban, CheckCircle2, FilePen, Send, XCircle } from 'lucide-react';
import type { Tone } from '@/components/dashboard/tones';
import type { FilterTab } from '@/components/dashboard/FilterTabs';

export const ENTRY_STATUS: Record<string, { word: string; tone: Tone; icon: LucideIcon }> = {
  DRAFT: { word: 'Draft', tone: 'calm', icon: FilePen },
  SENDING: { word: 'Sending', tone: 'info', icon: Send },
  SENT: { word: 'Sent', tone: 'info', icon: Send },
  ACCEPTED: { word: 'Accepted', tone: 'done', icon: CheckCircle2 },
  REJECTED: { word: 'Rejected', tone: 'urgent', icon: XCircle },
  CANCELLED: { word: 'Cancelled', tone: 'calm', icon: Ban },
};

export const entryStatusOf = (status: string) => ENTRY_STATUS[status] ?? { word: status, tone: 'calm' as Tone, icon: FilePen };

export type EntryTab = 'all' | 'draft' | 'sent' | 'accepted' | 'rejected' | 'cancelled';

export const ENTRY_TABS: { key: EntryTab; label: string; statuses: string[]; tone?: Tone }[] = [
  { key: 'all', label: 'All', statuses: [] },
  { key: 'draft', label: 'Drafts', statuses: ['DRAFT'] },
  { key: 'sent', label: 'Sent', statuses: ['SENDING', 'SENT'], tone: 'info' },
  { key: 'accepted', label: 'Accepted', statuses: ['ACCEPTED'], tone: 'done' },
  { key: 'rejected', label: 'Rejected', statuses: ['REJECTED'], tone: 'urgent' },
  { key: 'cancelled', label: 'Cancelled', statuses: ['CANCELLED'] },
];

export const isEntryTab = (v: string | null): v is EntryTab => ENTRY_TABS.some((t) => t.key === v);

export function entryTabsWithCounts(byStatus: Record<string, number> | undefined): FilterTab<EntryTab>[] {
  const all = Object.values(byStatus ?? {}).reduce((a, b) => a + b, 0);
  return ENTRY_TABS.map((t) => ({
    key: t.key, label: t.label, tone: t.tone,
    count: t.key === 'all' ? all : t.statuses.reduce((n, s) => n + (byStatus?.[s] ?? 0), 0),
  }));
}
