/**
 * Native entry lifecycle (native go-live 4.1; audit BNA-03, FNA-12, UFF-07).
 *
 * An entry has two CBP outcomes: the entry summary (AX) and, when the AE
 * asked CBP to certify it for cargo release, the release (SX). They are
 * tracked separately (entrySummaryStatus / cargoReleaseStatus) and the
 * entry's status is derived from both: ACCEPTED only when everything
 * requested is accepted, REJECTED when either is rejected. A rejected
 * summary is not on file and can be corrected and sent again under the
 * same entry number; a rejected replace keeps the accepted summary.
 */
export type EntryAction = 'ADD' | 'REPLACE' | 'DELETE';
type Verdict = 'ACCEPTED' | 'REJECTED';

export interface EntryLifecycleState {
  status: string;
  cbpState: string;
  pendingAction: string | null;
  entrySummaryStatus: string | null;
  cargoReleaseStatus: string | null;
  releaseRequested: boolean;
}

export function deriveEntryStatus(s: EntryLifecycleState): string {
  if (s.cbpState === 'DELETED') return 'CANCELLED';
  if (s.entrySummaryStatus === 'REJECTED' && s.cbpState === 'NOT_ON_FILE') return 'REJECTED';
  if (s.releaseRequested && s.cargoReleaseStatus === 'REJECTED') return 'REJECTED';
  if (s.entrySummaryStatus === 'ACCEPTED' && (!s.releaseRequested || s.cargoReleaseStatus === 'ACCEPTED')) {
    return s.pendingAction ? 'SENT' : 'ACCEPTED';
  }
  return s.pendingAction || s.entrySummaryStatus ? 'SENT' : s.status;
}

export function canStartEntryAction(s: EntryLifecycleState, action: EntryAction): { ok: true } | { ok: false; reason: string } {
  if (s.pendingAction) return { ok: false, reason: `A ${s.pendingAction.toLowerCase()} is already waiting for CBP's response.` };
  if (action === 'ADD') {
    if (s.cbpState === 'ON_FILE') return { ok: false, reason: 'CBP already has this entry summary on file; replace it instead.' };
    if (s.cbpState === 'DELETED') return { ok: false, reason: 'This entry summary was deleted at CBP.' };
    if (s.status !== 'DRAFT' && s.status !== 'REJECTED') return { ok: false, reason: `An entry in status ${s.status} cannot be sent.` };
    return { ok: true };
  }
  if (s.cbpState !== 'ON_FILE') {
    return { ok: false, reason: `Only an entry summary that CBP holds can be ${action === 'REPLACE' ? 'replaced' : 'deleted'}.` };
  }
  return { ok: true };
}

export function entryStateOnStart(s: EntryLifecycleState, action: EntryAction): EntryLifecycleState {
  const next: EntryLifecycleState = { ...s, pendingAction: action };
  if (action === 'ADD') {
    next.entrySummaryStatus = null;
    next.cargoReleaseStatus = null;
  }
  return { ...next, status: 'SENT' };
}

export function entryStateOnSummaryVerdict(s: EntryLifecycleState, verdict: Verdict): EntryLifecycleState {
  let next: EntryLifecycleState;
  switch (s.pendingAction) {
    case 'ADD':
      next = verdict === 'ACCEPTED'
        ? { ...s, cbpState: 'ON_FILE', entrySummaryStatus: 'ACCEPTED', pendingAction: null }
        : { ...s, cbpState: 'NOT_ON_FILE', entrySummaryStatus: 'REJECTED', pendingAction: null };
      break;
    case 'REPLACE':
      // Accepted or not, a summary stays on file; a rejected replace keeps the accepted one.
      next = { ...s, cbpState: 'ON_FILE', entrySummaryStatus: 'ACCEPTED', pendingAction: null };
      break;
    case 'DELETE':
      next = verdict === 'ACCEPTED'
        ? { ...s, cbpState: 'DELETED', pendingAction: null }
        : { ...s, cbpState: 'ON_FILE', pendingAction: null };
      break;
    default:
      return s;
  }
  return { ...next, status: deriveEntryStatus(next) };
}

export function entryStateOnReleaseVerdict(s: EntryLifecycleState, verdict: Verdict): EntryLifecycleState {
  const next = { ...s, cargoReleaseStatus: verdict };
  return { ...next, status: deriveEntryStatus(next) };
}

/** The action provably never reached CBP: back to the state before it started. */
export function entryStateOnSendFailed(_started: EntryLifecycleState, before: EntryLifecycleState): EntryLifecycleState {
  return { ...before, pendingAction: null };
}
