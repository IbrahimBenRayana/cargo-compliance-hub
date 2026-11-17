/**
 * What hangs off an ISF: the manifest lookup for its master bill, and the
 * entry made from it. Only what applies is listed, so a client that files
 * ISFs alone never sees entry steps it cannot take.
 */
import type { Tone } from '@/components/dashboard/tones';
import type { Filing } from '@/types/shipment';

export interface LinkedEntry { id: string; filingId: string | null; status: string; updatedAt: string }
export interface LinkedQuery { id: string; bolNumber: string; status: string; createdAt: string; completedAt: string | null }

export interface RelatedItem {
  key: 'manifest' | 'entry';
  title: string;
  text: string;
  tone: Tone;
  /** When the state was reached, for a relative time beside it. */
  at: string | null;
  action?: { label: string; to: string };
}

const ENTRY: Record<string, { text: string; tone: Tone }> = {
  DRAFT: { text: 'Draft, not sent yet', tone: 'calm' },
  SENDING: { text: 'Sending to CBP', tone: 'info' },
  SENT: { text: 'Sent, waiting for CBP', tone: 'info' },
  ACCEPTED: { text: 'Accepted by CBP', tone: 'done' },
  REJECTED: { text: 'Rejected by CBP', tone: 'urgent' },
};

function manifest(filing: Filing, q: LinkedQuery | null): RelatedItem {
  const to = `/manifest-query?bol=${encodeURIComponent(filing.masterBol!)}`;
  const base = { key: 'manifest' as const, title: 'Manifest' };
  switch (q?.status) {
    case 'completed': return { ...base, text: 'Checked', tone: 'done', at: q.completedAt ?? q.createdAt, action: { label: 'Check again', to } };
    case 'pending': return { ...base, text: 'Lookup running', tone: 'info', at: q.createdAt, action: { label: 'Open', to } };
    case 'failed': return { ...base, text: 'Lookup failed', tone: 'urgent', at: q.createdAt, action: { label: 'Try again', to } };
    case 'timeout': return { ...base, text: 'Lookup timed out', tone: 'urgent', at: q.createdAt, action: { label: 'Try again', to } };
    default: return { ...base, text: 'Not checked yet', tone: 'calm', at: null, action: { label: 'Check manifest', to } };
  }
}

export function relatedItems({ filing, linkedAbi, linkedMq, canFileEntry }: {
  filing: Filing; linkedAbi: LinkedEntry | null; linkedMq: LinkedQuery | null; canFileEntry: boolean;
}): RelatedItem[] {
  if (filing.status === 'cancelled') return [];
  const items: RelatedItem[] = [];
  if (filing.masterBol) items.push(manifest(filing, linkedMq));

  if (linkedAbi) {
    const state = ENTRY[linkedAbi.status] ?? { text: linkedAbi.status.toLowerCase(), tone: 'calm' as Tone };
    items.push({ key: 'entry', title: 'Entry', ...state, at: linkedAbi.updatedAt, action: { label: 'Open entry', to: `/abi-documents/${linkedAbi.id}` } });
  } else if (canFileEntry && filing.filingType === 'ISF-10' && (filing.status === 'accepted' || filing.status === 'amended')) {
    items.push({ key: 'entry', title: 'Entry', text: 'Not filed yet', tone: 'calm', at: null, action: { label: 'File entry', to: `/abi-documents/new?fromShipment=${filing.id}` } });
  }
  return items;
}

/** The newest entry made from this shipment, and the newest manifest query for its master bill. */
export function latestLinked(filing: Filing, entries: LinkedEntry[], queries: LinkedQuery[]) {
  const newest = <T,>(list: T[], at: (item: T) => string) => [...list].sort((a, b) => new Date(at(b)).getTime() - new Date(at(a)).getTime())[0] ?? null;
  return {
    linkedAbi: newest(entries.filter((e) => e.filingId === filing.id), (e) => e.updatedAt),
    linkedMq: filing.masterBol ? newest(queries.filter((q) => q.bolNumber === filing.masterBol), (q) => q.createdAt) : null,
  };
}
