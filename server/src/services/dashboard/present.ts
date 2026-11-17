/** Words and links for a queue row. Fixed templates: stored text never passes through raw. */
import { parseRejectionReason } from '../errorTranslator.js';
import type { ActionKind, Classification } from './rules.js';

export interface ShipmentRef { filingId: string | null; entryId: string | null; trackingId?: string }

/** CBP-facing rejection text can carry internal system names; those fall back to the plain title. */
const UNSAFE = /customs\s*city|gateway|\bcc\b/i;
const MAX_REASON = 90;

export function safeRejectionSummary(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const parsed = parseRejectionReason(raw);
  const text = (parsed.summary || parsed.errors[0]?.message || parsed.fallbackRaw || '').trim();
  if (!text || UNSAFE.test(text)) return null;
  return text.length > MAX_REASON ? `${text.slice(0, MAX_REASON - 1)}…` : text;
}

const CHANGE_REJECTED = 'Change rejected. Earlier version on file.';

export function titleFor(c: Classification, reason: string | null, arrived: boolean): string {
  switch (c.kind) {
    case 'isf_rejected': return reason ? `Rejected: ${reason}` : 'ISF rejected';
    case 'entry_rejected': return reason ? `Entry rejected: ${reason}` : 'Entry rejected';
    case 'isf_change_rejected':
    case 'entry_change_rejected': return CHANGE_REJECTED;
    case 'entry_release_rejected': return 'Cargo release rejected';
    case 'isf_overdue': return 'ISF cutoff passed';
    case 'isf_due': return 'ISF due';
    case 'isf_draft': return 'ISF draft';
    case 'isf_no_date': return 'Sailing date missing, no cutoff can run';
    case 'isf_on_hold': return 'ISF on hold';
    case 'entry_draft': return 'Entry draft';
    case 'entry_needed': return arrived ? 'Arrived, no entry yet' : 'Ready for entry';
    case 'cbp_no_response': return 'No response yet';
    case 'cbp_outcome_unknown': return 'Outcome unknown';
    case 'cbp_conditional': return 'Conditional response to review';
    case 'tracking_hold': return 'Terminal hold';
  }
}

const LABEL: Record<ActionKind, string> = {
  isf_overdue: 'Finish ISF', isf_due: 'Finish ISF', isf_draft: 'Finish ISF', isf_no_date: 'Add date',
  isf_rejected: 'Fix ISF', isf_change_rejected: 'Review change', isf_on_hold: 'Review hold',
  entry_rejected: 'Fix entry', entry_change_rejected: 'Review change', entry_release_rejected: 'Replace entry',
  entry_draft: 'Finish entry', entry_needed: 'Start entry',
  cbp_no_response: 'Open', cbp_outcome_unknown: 'Open', cbp_conditional: 'Open', tracking_hold: 'View hold',
};
const EDITS_DRAFT = new Set<ActionKind>(['isf_overdue', 'isf_due', 'isf_draft', 'isf_no_date']);

export function primaryFor(c: Classification, ref: ShipmentRef, canAct: boolean) {
  const record = ref.trackingId ? `/tracking/${ref.trackingId}`
    : ref.entryId ? `/abi-documents/${ref.entryId}`
    : `/shipments/${ref.filingId}`;
  const agedOut = c.lane === 'later' && (c.kind === 'isf_overdue' || c.kind === 'isf_rejected');
  if (!canAct || agedOut) return { label: 'Open', href: record, enabled: true, disabledReason: null };
  const href = c.kind === 'entry_needed' ? `/abi-documents/new?fromShipment=${ref.filingId}`
    : EDITS_DRAFT.has(c.kind) ? `/shipments/${ref.filingId}/edit`
    : record;
  return { label: LABEL[c.kind], href, enabled: true, disabledReason: null };
}
