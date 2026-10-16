/**
 * Native ISF lifecycle (native go-live Phase 3; audit BNA-02).
 *
 * Local state follows what CBP holds, not what the user last typed:
 *   cbpState      NOT_ON_FILE | ON_FILE | DELETED   what CBP has
 *   pendingAction ADD | REPLACE | DELETE | null      the transaction in flight
 *   status        the user-facing label derived from both
 * A rejected replace or delete leaves the previously accepted ISF on file.
 * A delete is a CBP transaction; it is only "cancelled" once CBP accepts it.
 * One action at a time: nothing starts while another is pending.
 */
export type IsfCbpState = 'NOT_ON_FILE' | 'ON_FILE' | 'DELETED';
export type IsfAction = 'ADD' | 'REPLACE' | 'DELETE';

export interface IsfLifecycleState {
  status: string;
  cbpState: string;
  pendingAction: string | null;
}

export function canStartIsfAction(s: IsfLifecycleState, action: IsfAction): { ok: true } | { ok: false; reason: string } {
  if (s.pendingAction) return { ok: false, reason: `A ${s.pendingAction.toLowerCase()} is already waiting for CBP's response.` };
  if (action === 'ADD') {
    if (s.cbpState === 'ON_FILE') return { ok: false, reason: 'CBP already has this ISF on file; amend it instead.' };
    if (s.cbpState === 'DELETED') return { ok: false, reason: 'This ISF was deleted at CBP; create a new filing.' };
    if (s.status !== 'draft' && s.status !== 'rejected') return { ok: false, reason: `An ISF in status ${s.status} cannot be submitted.` };
    return { ok: true };
  }
  if (s.cbpState !== 'ON_FILE') {
    return { ok: false, reason: `Only an ISF that CBP holds on file can be ${action === 'REPLACE' ? 'amended' : 'deleted'}.` };
  }
  return { ok: true };
}

export function isfStateOnStart(s: IsfLifecycleState, action: IsfAction): IsfLifecycleState {
  const status = action === 'ADD' ? 'submitted' : action === 'REPLACE' ? 'amended' : s.status;
  return { status, cbpState: s.cbpState, pendingAction: action };
}

export function isfStateOnVerdict(s: IsfLifecycleState, verdict: 'ACCEPTED' | 'REJECTED'): IsfLifecycleState {
  switch (s.pendingAction) {
    case 'ADD':
      return verdict === 'ACCEPTED'
        ? { status: 'accepted', cbpState: 'ON_FILE', pendingAction: null }
        : { status: 'rejected', cbpState: 'NOT_ON_FILE', pendingAction: null };
    case 'REPLACE':
      // Accepted or not, an ISF stays on file; a rejected replace keeps the old version.
      return { status: 'accepted', cbpState: 'ON_FILE', pendingAction: null };
    case 'DELETE':
      return verdict === 'ACCEPTED'
        ? { status: 'cancelled', cbpState: 'DELETED', pendingAction: null }
        : { status: 'accepted', cbpState: 'ON_FILE', pendingAction: null };
    default:
      return s; // nothing in flight: a duplicate or late response changes nothing
  }
}

/** The action provably never reached CBP (transmission FAILED): undo the start. */
export function isfStateOnSendFailed(s: IsfLifecycleState): IsfLifecycleState {
  if (s.pendingAction === 'ADD') return { status: 'draft', cbpState: 'NOT_ON_FILE', pendingAction: null };
  if (s.pendingAction === 'REPLACE' || s.pendingAction === 'DELETE') return { status: 'accepted', cbpState: 'ON_FILE', pendingAction: null };
  return s;
}
