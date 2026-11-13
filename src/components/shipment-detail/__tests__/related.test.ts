import { describe, it, expect } from 'vitest';
import { relatedItems } from '../related';
import type { Filing } from '@/types/shipment';

const filing = (over: Partial<Filing> = {}) =>
  ({ id: 'f1', status: 'accepted', filingType: 'ISF-10', masterBol: 'MAEU1', ...over }) as Filing;
const entry = (status: string) => ({ id: 'e1', filingId: 'f1', status, updatedAt: '2026-11-02T00:00:00Z' });
const query = (status: string) => ({ id: 'q1', bolNumber: 'MAEU1', status, createdAt: '2026-11-03T00:00:00Z', completedAt: '2026-11-03T00:05:00Z' });
const items = (over: Partial<Parameters<typeof relatedItems>[0]> = {}) =>
  relatedItems({ filing: filing(), linkedAbi: null, linkedMq: null, canFileEntry: true, ...over });
const keys = (list: ReturnType<typeof relatedItems>) => list.map((i) => i.key);

describe('relatedItems', () => {
  it('shows an ISF-only client the manifest and nothing about entries', () => {
    expect(keys(items({ canFileEntry: false }))).toEqual(['manifest']);
  });

  it('offers an entry once the ISF is accepted, to clients who file entries', () => {
    const entryItem = items().find((i) => i.key === 'entry')!;
    expect(entryItem).toMatchObject({ text: 'Not filed yet', action: { label: 'File entry', to: '/abi-documents/new?fromShipment=f1' } });
    expect(keys(items({ filing: filing({ status: 'draft' }) }))).toEqual(['manifest']);
    expect(keys(items({ filing: filing({ filingType: 'ISF-5' }) }))).toEqual(['manifest']);
  });

  it('shows where a linked entry stands, never as cleared or released', () => {
    const text = (status: string) => items({ linkedAbi: entry(status) }).find((i) => i.key === 'entry')!;
    expect(text('DRAFT')).toMatchObject({ text: 'Draft, not sent yet', tone: 'calm', action: { label: 'Open entry', to: '/abi-documents/e1' } });
    expect(text('SENT')).toMatchObject({ text: 'Sent, waiting for CBP', tone: 'info' });
    expect(text('ACCEPTED')).toMatchObject({ text: 'Accepted by CBP', tone: 'done' });
    expect(text('REJECTED')).toMatchObject({ text: 'Rejected by CBP', tone: 'urgent' });
    expect(JSON.stringify(text('ACCEPTED'))).not.toMatch(/clear|releas/i);
  });

  it('still shows a linked entry to a client whose plan no longer files them', () => {
    expect(keys(items({ canFileEntry: false, linkedAbi: entry('SENT') }))).toEqual(['manifest', 'entry']);
  });

  it('says what the last manifest lookup did, without calling the bill verified', () => {
    const manifest = (status?: string) => items({ linkedMq: status ? query(status) : null })[0];
    expect(manifest()).toMatchObject({ text: 'Not checked yet', action: { label: 'Check manifest', to: '/manifest-query?bol=MAEU1' } });
    expect(manifest('completed')).toMatchObject({ text: 'Checked', tone: 'done', action: { label: 'Check again' } });
    expect(manifest('pending')).toMatchObject({ text: 'Lookup running', tone: 'info' });
    expect(manifest('failed')).toMatchObject({ text: 'Lookup failed', tone: 'urgent', action: { label: 'Try again' } });
    expect(manifest('timeout')).toMatchObject({ text: 'Lookup timed out', tone: 'urgent' });
  });

  it('has nothing to relate for a cancelled ISF or one without a master bill', () => {
    expect(items({ filing: filing({ status: 'cancelled' }) })).toEqual([]);
    expect(items({ filing: filing({ masterBol: null }), canFileEntry: false })).toEqual([]);
  });
});
