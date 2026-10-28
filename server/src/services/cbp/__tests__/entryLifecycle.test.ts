/**
 * Native entry lifecycle (native go-live 4.1; audit BNA-03, FNA-12, UFF-07):
 * the summary (AX) and the certified cargo release (SX) are separate CBP
 * outcomes; the entry is ACCEPTED only when everything requested is, and a
 * rejected summary can be corrected and sent again under its entry number.
 */
import { describe, it, expect } from 'vitest';
import {
  canStartEntryAction, entryStateOnStart, entryStateOnSummaryVerdict, entryStateOnReleaseVerdict,
  entryStateOnSendFailed, deriveEntryStatus,
} from '../entryLifecycle.js';

const draft = { status: 'DRAFT', cbpState: 'NOT_ON_FILE', pendingAction: null, entrySummaryStatus: null, cargoReleaseStatus: null, releaseRequested: true };

describe('canStartEntryAction', () => {
  it('sends a draft, and re-sends a rejected summary under the same entry number', () => {
    expect(canStartEntryAction(draft, 'ADD').ok).toBe(true);
    expect(canStartEntryAction({ ...draft, status: 'REJECTED', entrySummaryStatus: 'REJECTED' }, 'ADD').ok).toBe(true);
  });
  it('replaces or deletes only a summary CBP holds, one action at a time', () => {
    const onFile = { ...draft, status: 'ACCEPTED', cbpState: 'ON_FILE', entrySummaryStatus: 'ACCEPTED', cargoReleaseStatus: 'ACCEPTED' };
    expect(canStartEntryAction(onFile, 'REPLACE').ok).toBe(true);
    expect(canStartEntryAction(onFile, 'DELETE').ok).toBe(true);
    expect(canStartEntryAction(draft, 'REPLACE').ok).toBe(false);
    expect(canStartEntryAction({ ...onFile, pendingAction: 'REPLACE' }, 'DELETE').ok).toBe(false);
  });
});

describe('summary and release outcomes', () => {
  const sent = entryStateOnStart(draft, 'ADD');

  it('is SENT while waiting', () => {
    expect(sent).toMatchObject({ status: 'SENT', pendingAction: 'ADD', entrySummaryStatus: null, cargoReleaseStatus: null });
  });

  it('is not ACCEPTED on the summary alone when release was requested', () => {
    const s = entryStateOnSummaryVerdict(sent, 'ACCEPTED');
    expect(s).toMatchObject({ status: 'SENT', cbpState: 'ON_FILE', entrySummaryStatus: 'ACCEPTED', pendingAction: null });
  });

  it('is ACCEPTED once the summary and the release are both accepted, in either order', () => {
    const a = entryStateOnReleaseVerdict(entryStateOnSummaryVerdict(sent, 'ACCEPTED'), 'ACCEPTED');
    const b = entryStateOnSummaryVerdict(entryStateOnReleaseVerdict(sent, 'ACCEPTED'), 'ACCEPTED');
    expect(a.status).toBe('ACCEPTED');
    expect(b.status).toBe('ACCEPTED');
  });

  it('is ACCEPTED on the summary alone when no release was requested', () => {
    expect(entryStateOnSummaryVerdict({ ...sent, releaseRequested: false }, 'ACCEPTED').status).toBe('ACCEPTED');
  });

  it('a rejected summary is REJECTED and not on file', () => {
    expect(entryStateOnSummaryVerdict(sent, 'REJECTED')).toMatchObject({ status: 'REJECTED', cbpState: 'NOT_ON_FILE', entrySummaryStatus: 'REJECTED' });
  });

  it('a rejected release makes the entry REJECTED even with an accepted summary', () => {
    const s = entryStateOnReleaseVerdict(entryStateOnSummaryVerdict(sent, 'ACCEPTED'), 'REJECTED');
    expect(s).toMatchObject({ status: 'REJECTED', cbpState: 'ON_FILE', cargoReleaseStatus: 'REJECTED' });
  });

  it('a rejected replace keeps the accepted summary on file', () => {
    const onFile = { ...draft, status: 'ACCEPTED', cbpState: 'ON_FILE', entrySummaryStatus: 'ACCEPTED', cargoReleaseStatus: 'ACCEPTED' };
    const s = entryStateOnSummaryVerdict(entryStateOnStart(onFile, 'REPLACE'), 'REJECTED');
    expect(s).toMatchObject({ cbpState: 'ON_FILE', entrySummaryStatus: 'ACCEPTED', pendingAction: null });
  });

  it('an accepted delete removes the summary', () => {
    const onFile = { ...draft, status: 'ACCEPTED', cbpState: 'ON_FILE', entrySummaryStatus: 'ACCEPTED', cargoReleaseStatus: 'ACCEPTED' };
    expect(entryStateOnSummaryVerdict(entryStateOnStart(onFile, 'DELETE'), 'ACCEPTED')).toMatchObject({ status: 'CANCELLED', cbpState: 'DELETED' });
  });

  it('rolls back an add that never left', () => {
    expect(entryStateOnSendFailed(sent, draft)).toMatchObject({ status: 'DRAFT', pendingAction: null });
  });

  it('derives status from the parts', () => {
    expect(deriveEntryStatus({ ...draft, cbpState: 'DELETED' })).toBe('CANCELLED');
  });
});
