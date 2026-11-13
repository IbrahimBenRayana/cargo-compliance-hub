import { describe, it, expect } from 'vitest';
import { relDay, stamp, summarize } from '../summary';
import type { Filing } from '@/types/shipment';

const HOUR = 3_600_000;
const NOW = Date.parse('2026-11-11T12:00:00.000Z');
const at = (h: number) => new Date(NOW + h * HOUR).toISOString();
const filing = (over: Partial<Filing> = {}) => ({ id: 'f1', status: 'draft', ...over }) as Filing;

describe('summarize', () => {
  it('tells a draft how long it has, in the colour of how close the cutoff is', () => {
    const calm = summarize(filing({ cutoff: { at: at(200), basis: 'LADING' } }), NOW);
    expect(calm).toMatchObject({ tone: 'calm', title: 'Draft, not sent to CBP yet.' });
    expect(calm.detail).toBe(`The ISF cutoff is ${stamp(at(200))}, 24 hours before lading.`);
    expect(summarize(filing({ cutoff: { at: at(50), basis: 'LADING' } }), NOW).tone).toBe('soon');
    expect(summarize(filing({ cutoff: { at: at(5), basis: 'LADING' } }), NOW).tone).toBe('urgent');
  });

  it('says an estimated cutoff is an estimate', () => {
    expect(summarize(filing({ cutoff: { at: at(200), basis: 'ETD_ESTIMATE' } }), NOW).detail)
      .toBe(`The ISF cutoff is about ${stamp(at(200))}, estimated from the sailing date.`);
  });

  it('says plainly when a draft has missed its cutoff', () => {
    const s = summarize(filing({ cutoff: { at: at(-30), basis: 'LADING' } }), NOW);
    expect(s).toMatchObject({ tone: 'urgent', title: 'Draft. The ISF cutoff has passed.' });
    expect(s.detail).toBe(`Not sent to CBP yet. The cutoff was ${stamp(at(-30))}.`);
  });

  it('asks a draft without dates for one', () => {
    expect(summarize(filing(), NOW).detail).toBe('Add a sailing or lading date to see the ISF cutoff.');
  });

  it('says Sent while CBP has not answered', () => {
    expect(summarize(filing({ status: 'submitted', submittedAt: at(-3) }), NOW))
      .toEqual({ tone: 'info', title: 'Sent to CBP. Waiting for the answer.', detail: `Sent ${stamp(at(-3))}.` });
    expect(summarize(filing({ status: 'pending_cbp' }), NOW).title).toBe('Sent to CBP. Waiting for the answer.');
  });

  it('says accepted, and when a later change is still with CBP', () => {
    expect(summarize(filing({ status: 'accepted', acceptedAt: at(-48) }), NOW))
      .toEqual({ tone: 'done', title: 'CBP accepted this ISF.', detail: `Accepted ${stamp(at(-48))}.` });
    expect(summarize(filing({ status: 'accepted', acceptedAt: at(-48), pendingAction: 'REPLACE' }), NOW).detail)
      .toBe(`Accepted ${stamp(at(-48))}. An amendment sent since is waiting for CBP's answer.`);
    expect(summarize(filing({ status: 'accepted', acceptedAt: at(-48), pendingAction: 'DELETE' }), NOW).detail)
      .toBe(`Accepted ${stamp(at(-48))}. A cancellation sent since is waiting for CBP's answer.`);
  });

  it('says an amended ISF is accepted as amended', () => {
    expect(summarize(filing({ status: 'amended', acceptedAt: at(-48), amendedAt: at(-2) }), NOW))
      .toEqual({ tone: 'done', title: 'CBP accepted this ISF, as amended.', detail: `Amended ${stamp(at(-2))}.` });
  });

  it('leads a rejection with the reason and the way out', () => {
    const reason = (codes: [string, string][]) =>
      JSON.stringify({ summary: 'ISF REJECTED', errors: codes.map(([code, narrative]) => ({ code, narrative, blocking: true })) });
    const s = summarize(filing({ status: 'rejected', rejectionReason: reason([['144', 'CONTINUOUS BOND NOT ON FILE']]) }), NOW);
    expect(s).toMatchObject({ tone: 'urgent', title: 'CBP rejected this ISF.' });
    expect(s.detail).toBe('CONTINUOUS BOND NOT ON FILE. Fix it and send it again.');
    const three = reason([['135', 'MISSING BOND TYPE'], ['134', 'MISSING BOND ACTIVITY CODE'], ['121', 'MISSING BOND HOLDER']]);
    expect(summarize(filing({ status: 'rejected', rejectionReason: three }), NOW).detail).toBe('MISSING BOND TYPE, and 2 more. Fix them and send it again.');
    expect(summarize(filing({ status: 'rejected' }), NOW).detail).toBe('Fix it and send it again.');
  });

  it('covers on hold and cancelled without claiming more', () => {
    expect(summarize(filing({ status: 'on_hold' }), NOW)).toEqual({ tone: 'soon', title: 'This ISF is on hold.', detail: null });
    expect(summarize(filing({ status: 'cancelled', cancelledAt: at(-5) }), NOW))
      .toEqual({ tone: 'calm', title: 'This ISF was cancelled.', detail: `Cancelled ${stamp(at(-5))}.` });
  });

  it('never says cleared or released', () => {
    for (const status of ['draft', 'submitted', 'pending_cbp', 'accepted', 'amended', 'rejected', 'on_hold', 'cancelled']) {
      expect(JSON.stringify(summarize(filing({ status: status as Filing['status'] }), NOW))).not.toMatch(/clear|releas/i);
    }
  });
});

describe('relDay', () => {
  it('reads near dates relative to now and leaves far ones alone', () => {
    expect(relDay(at(60), NOW)).toBe('in 2d');
    expect(relDay(at(5), NOW)).toBe('in 5h');
    expect(relDay(at(-30), NOW)).toBe('1d ago');
    expect(relDay(at(-0.2), NOW)).toBe('just now');
    expect(relDay(at(-24 * 90), NOW)).toBeNull();
  });
});
