import { describe, it, expect } from 'vitest';
import { computeShipmentLifecycle } from '../LifecycleWidget';
import type { Filing } from '@/types/shipment';

const filing = (over: Partial<Filing> = {}) =>
  ({ id: 'f1', status: 'draft', masterBol: 'MAEU1', updatedAt: '2026-11-01T00:00:00Z', ...over }) as Filing;
const entry = (status: string) =>
  ({ id: 'e1', filingId: 'f1', status, updatedAt: '2026-11-02T00:00:00Z', entrySummaryStatus: null, cargoReleaseStatus: null });
const stages = (f: Filing, abi: ReturnType<typeof entry> | null = null) =>
  computeShipmentLifecycle({ filing: f, linkedAbi: abi, linkedMq: null });

describe('computeShipmentLifecycle', () => {
  it('names the four stages by what is stored, never "Cleared"', () => {
    expect(stages(filing()).map((s) => s.title)).toEqual(['ISF', 'Manifest', 'Entry filed', 'Entry accepted']);
  });

  it('counts an amended ISF as accepted', () => {
    const [isf] = stages(filing({ status: 'amended' }));
    expect(isf).toMatchObject({ state: 'done', detail: 'Accepted by CBP, amended' });
  });

  it('says Sent for an ISF waiting on CBP, as the rest of the app does', () => {
    const [isf, manifest] = stages(filing({ status: 'submitted' }));
    expect(isf).toMatchObject({ state: 'active', detail: 'Sent, waiting for CBP' });
    expect(manifest).toMatchObject({ state: 'pending', detail: 'After the ISF is accepted' });
  });

  it('stops the later stages of a cancelled ISF instead of saying they are awaited', () => {
    const [isf, ...rest] = stages(filing({ status: 'cancelled' }));
    expect(isf).toMatchObject({ state: 'stopped', detail: 'Cancelled' });
    expect(rest.map((s) => [s.state, s.detail])).toEqual([['stopped', 'ISF cancelled'], ['stopped', 'ISF cancelled'], ['stopped', 'ISF cancelled']]);
  });

  it('marks an entry sent to CBP as filed, and its acceptance as awaited', () => {
    const [, , filed, accepted] = stages(filing({ status: 'accepted' }), entry('SENT'));
    expect(filed).toMatchObject({ state: 'done', detail: 'Sent to CBP' });
    expect(accepted).toMatchObject({ state: 'active', detail: 'Waiting for CBP' });
  });

  it('calls an accepted entry accepted, not cleared or released', () => {
    const last = stages(filing({ status: 'accepted' }), entry('ACCEPTED')).at(-1)!;
    expect(last).toMatchObject({ state: 'done', detail: 'Accepted by CBP' });
    expect(JSON.stringify(stages(filing({ status: 'accepted' }), entry('ACCEPTED')))).not.toMatch(/clear|releas/i);
  });

  it('blocks the last stage when CBP rejects the entry', () => {
    const [, , filed, accepted] = stages(filing({ status: 'accepted' }), entry('REJECTED'));
    expect(filed.state).toBe('blocked');
    expect(accepted).toMatchObject({ state: 'blocked', detail: 'Entry rejected' });
  });

  it('says a manifest query was checked, not that the bill was verified', () => {
    const [, manifest] = computeShipmentLifecycle({
      filing: filing({ status: 'accepted' }),
      linkedAbi: null,
      linkedMq: { id: 'q1', bolNumber: 'MAEU1', status: 'completed', createdAt: '2026-11-03T00:00:00Z', completedAt: '2026-11-03T00:05:00Z' },
    });
    expect(manifest).toMatchObject({ state: 'done', detail: 'Manifest checked' });
  });
});
