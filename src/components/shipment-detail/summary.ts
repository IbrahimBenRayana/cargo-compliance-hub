/**
 * The one sentence at the top of a shipment: what state its ISF is in, and
 * what that asks of the filer. It says only what is stored. The app never
 * sees CBP release a cargo, so nothing here says cleared or released.
 */
import { parseRejectionReason } from '@/components/RejectionDetailsCard';
import type { Tone } from '@/components/dashboard/tones';
import { urgencyOf } from '@/lib/countdown';
import type { Filing } from '@/types/shipment';

export interface Summary {
  tone: Tone;
  title: string;
  detail: string | null;
}

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

/** "Nov 12, 9:15 AM", with the year once it is not this one. */
export function stamp(iso: string): string {
  const d = new Date(iso);
  const sameYear = d.getFullYear() === new Date().getFullYear();
  return d.toLocaleString('en-US', { month: 'short', day: 'numeric', ...(sameYear ? {} : { year: 'numeric' }), hour: 'numeric', minute: '2-digit' });
}

/** "in 2d", "5h ago": only for dates within a month, where the distance is what matters. */
export function relDay(iso: string, now: number): string | null {
  const diff = new Date(iso).getTime() - now;
  const abs = Math.abs(diff);
  if (abs > 30 * DAY) return null;
  if (abs < HOUR) return diff >= 0 ? 'within the hour' : 'just now';
  const text = abs >= DAY ? `${Math.floor(abs / DAY)}d` : `${Math.floor(abs / HOUR)}h`;
  return diff >= 0 ? `in ${text}` : `${text} ago`;
}

/** CBP's first reason in its own words, and how many more there are. A bare "ISF REJECTED" says nothing, so reasons come first. */
function rejectionLine(reason: string | null | undefined): { line: string; many: boolean } | null {
  if (!reason) return null;
  const parsed = parseRejectionReason(reason);
  const first = (parsed.errors[0]?.message || parsed.summary || parsed.fallbackRaw || '').trim().replace(/[.\s]+$/, '');
  if (!first) return null;
  const more = parsed.errors.length - 1;
  const line = first.length > 140 ? `${first.slice(0, 137)}…` : first;
  return { line: more > 0 ? `${line}, and ${more} more` : line, many: more > 0 };
}

const on = (iso: string | null | undefined, verb: string) => (iso ? `${verb} ${stamp(iso)}.` : null);

function draft(f: Filing, now: number): Summary {
  if (!f.cutoff) return { tone: 'calm', title: 'Draft, not sent to CBP yet.', detail: 'Add a sailing or lading date to see the ISF cutoff.' };
  const level = urgencyOf(new Date(f.cutoff.at).getTime() - now);
  if (level === 'overdue') {
    return { tone: 'urgent', title: 'Draft. The ISF cutoff has passed.', detail: `Not sent to CBP yet. The cutoff was ${stamp(f.cutoff.at)}.` };
  }
  const detail = f.cutoff.basis === 'ETD_ESTIMATE'
    ? `The ISF cutoff is about ${stamp(f.cutoff.at)}, estimated from the sailing date.`
    : `The ISF cutoff is ${stamp(f.cutoff.at)}, 24 hours before lading.`;
  return { tone: level === 'calm' ? 'calm' : level, title: 'Draft, not sent to CBP yet.', detail };
}

export function summarize(f: Filing, now: number): Summary {
  switch (f.status) {
    case 'draft':
      return draft(f, now);
    case 'rejected': {
      const why = rejectionLine(f.rejectionReason);
      const fix = why?.many ? 'Fix them and send it again.' : 'Fix it and send it again.';
      return { tone: 'urgent', title: 'CBP rejected this ISF.', detail: why ? `${why.line}. ${fix}` : fix };
    }
    case 'submitted':
    case 'pending_cbp':
      return { tone: 'info', title: 'Sent to CBP. Waiting for the answer.', detail: on(f.submittedAt, 'Sent') };
    case 'accepted': {
      const pending = f.pendingAction === 'REPLACE' ? "An amendment sent since is waiting for CBP's answer."
        : f.pendingAction === 'DELETE' ? "A cancellation sent since is waiting for CBP's answer."
        : null;
      const detail = [on(f.acceptedAt, 'Accepted'), pending].filter(Boolean).join(' ') || null;
      return { tone: 'done', title: 'CBP accepted this ISF.', detail };
    }
    case 'amended':
      return { tone: 'done', title: 'CBP accepted this ISF, as amended.', detail: on(f.amendedAt ?? f.acceptedAt, 'Amended') };
    case 'on_hold':
      return { tone: 'soon', title: 'This ISF is on hold.', detail: null };
    case 'cancelled':
      return { tone: 'calm', title: 'This ISF was cancelled.', detail: on(f.cancelledAt, 'Cancelled') };
    default:
      return { tone: 'calm', title: String(f.status), detail: null };
  }
}
