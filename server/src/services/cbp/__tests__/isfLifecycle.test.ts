/**
 * Native ISF lifecycle (audit BNA-02): local state follows what CBP holds.
 * cbpState = what CBP has (NOT_ON_FILE / ON_FILE / DELETED); pendingAction =
 * the transaction in flight. A rejected replace or delete leaves the
 * accepted version on file; a delete is a CBP transaction, not a local flag.
 */
import { describe, it, expect } from 'vitest';
import { canStartIsfAction, isfStateOnStart, isfStateOnVerdict, isfStateOnSendFailed, isfEditsToRow, invalidIsfDates } from '../isfLifecycle.js';

const draft = { status: 'draft', cbpState: 'NOT_ON_FILE', pendingAction: null };
const onFile = { status: 'accepted', cbpState: 'ON_FILE', pendingAction: null };

describe('canStartIsfAction', () => {
  it('adds a draft or a rejected filing that CBP does not hold', () => {
    expect(canStartIsfAction(draft, 'ADD').ok).toBe(true);
    expect(canStartIsfAction({ ...draft, status: 'rejected' }, 'ADD').ok).toBe(true);
  });

  it('replaces or deletes only what CBP holds', () => {
    expect(canStartIsfAction(onFile, 'REPLACE').ok).toBe(true);
    expect(canStartIsfAction(onFile, 'DELETE').ok).toBe(true);
    expect(canStartIsfAction(draft, 'REPLACE').ok).toBe(false);
    expect(canStartIsfAction(draft, 'DELETE').ok).toBe(false);
  });

  it('never starts a second action while one is in flight', () => {
    expect(canStartIsfAction({ ...onFile, pendingAction: 'REPLACE' }, 'DELETE').ok).toBe(false);
  });

  it('cannot add again once CBP holds it, or after it was deleted', () => {
    expect(canStartIsfAction(onFile, 'ADD').ok).toBe(false);
    expect(canStartIsfAction({ status: 'cancelled', cbpState: 'DELETED', pendingAction: null }, 'ADD').ok).toBe(false);
  });
});

describe('isfStateOnStart', () => {
  it('marks an add submitted and a replace amended', () => {
    expect(isfStateOnStart(draft, 'ADD')).toEqual({ status: 'submitted', cbpState: 'NOT_ON_FILE', pendingAction: 'ADD' });
    expect(isfStateOnStart(onFile, 'REPLACE')).toEqual({ status: 'amended', cbpState: 'ON_FILE', pendingAction: 'REPLACE' });
  });

  it('keeps a filing accepted while its delete is pending', () => {
    expect(isfStateOnStart(onFile, 'DELETE')).toEqual({ status: 'accepted', cbpState: 'ON_FILE', pendingAction: 'DELETE' });
  });
});

describe('isfStateOnVerdict', () => {
  const pending = (s: typeof draft | typeof onFile, a: 'ADD' | 'REPLACE' | 'DELETE') => isfStateOnStart(s, a);

  it('an accepted add puts the ISF on file', () => {
    expect(isfStateOnVerdict(pending(draft, 'ADD'), 'ACCEPTED')).toEqual({ status: 'accepted', cbpState: 'ON_FILE', pendingAction: null });
  });

  it('a rejected add leaves nothing on file', () => {
    expect(isfStateOnVerdict(pending(draft, 'ADD'), 'REJECTED')).toEqual({ status: 'rejected', cbpState: 'NOT_ON_FILE', pendingAction: null });
  });

  it('a rejected replace keeps the accepted version on file', () => {
    expect(isfStateOnVerdict(pending(onFile, 'REPLACE'), 'REJECTED')).toEqual({ status: 'accepted', cbpState: 'ON_FILE', pendingAction: null });
  });

  it('an accepted delete removes it from CBP', () => {
    expect(isfStateOnVerdict(pending(onFile, 'DELETE'), 'ACCEPTED')).toEqual({ status: 'cancelled', cbpState: 'DELETED', pendingAction: null });
  });

  it('a rejected delete leaves it on file', () => {
    expect(isfStateOnVerdict(pending(onFile, 'DELETE'), 'REJECTED')).toEqual({ status: 'accepted', cbpState: 'ON_FILE', pendingAction: null });
  });

  it('ignores a verdict when nothing is pending (duplicate response)', () => {
    expect(isfStateOnVerdict(onFile, 'REJECTED')).toEqual(onFile);
  });
});

describe('isfStateOnSendFailed', () => {
  it('rolls back an action that provably never left', () => {
    expect(isfStateOnSendFailed(isfStateOnStart(draft, 'ADD'))).toEqual(draft);
    expect(isfStateOnSendFailed(isfStateOnStart(onFile, 'REPLACE'))).toEqual(onFile);
  });
});

describe('isfEditsToRow', () => {
  const ON_FILE = { estimatedDeparture: new Date('2026-11-12T06:00:00.000Z'), estimatedLading: null };

  it('turns dates into Dates and moves the deadline with them', () => {
    const row = isfEditsToRow({ vesselName: 'V', estimatedLading: '2026-11-09T06:00:00.000Z' }, ON_FILE);
    expect(row).toMatchObject({ vesselName: 'V', estimatedLading: new Date('2026-11-09T06:00:00.000Z'), filingDeadline: new Date('2026-11-08T06:00:00.000Z') });
  });

  it('keeps the dates it was not given out of the update', () => {
    const row = isfEditsToRow({ vesselName: 'V' }, ON_FILE);
    expect(row).not.toHaveProperty('estimatedDeparture');
    expect(row).not.toHaveProperty('estimatedArrival');
    expect({ ...ON_FILE, ...row }.estimatedDeparture).toEqual(ON_FILE.estimatedDeparture);
  });

  it('treats an empty date as no change', () => {
    const row = isfEditsToRow({ estimatedDeparture: '', estimatedLading: '' }, { ...ON_FILE, estimatedLading: new Date('2026-11-09T06:00:00.000Z') });
    expect(row).not.toHaveProperty('estimatedDeparture');
    expect(row).not.toHaveProperty('estimatedLading');
    expect(row.filingDeadline).toEqual(new Date('2026-11-08T06:00:00.000Z'));
  });

  it('drops a null isf5Data, which the column would refuse once CBP had accepted it', () => {
    expect(isfEditsToRow({ isf5Data: null }, ON_FILE)).not.toHaveProperty('isf5Data');
  });
});

describe('invalidIsfDates', () => {
  it('names dates that cannot be stored', () => {
    expect(invalidIsfDates({ estimatedLading: 'TBD', estimatedArrival: '2026-11-09T06:00:00.000Z', estimatedDeparture: '' })).toEqual(['estimatedLading']);
  });
});
