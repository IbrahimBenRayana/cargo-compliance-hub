/**
 * The one sentence at the top of an entry: its state, and what that asks of
 * the filer. CBP answers the summary and the release request separately, so
 * each is named as CBP answered it. Nothing here says cleared or released.
 */
import type { AbiDocument } from '@/api/client';
import { stamp, type Summary } from '@/components/shipment-detail/summary';

const PART: Record<string, string> = { ACCEPTED: 'accepted', REJECTED: 'rejected' };
const on = (iso: string | null | undefined, verb: string) => (iso ? `${verb} ${stamp(iso)}.` : null);
const join = (...parts: (string | null)[]) => parts.filter(Boolean).join(' ') || null;

export function summarizeEntry(doc: AbiDocument): Summary {
  const pending = doc.pendingAction === 'REPLACE' ? "A replacement sent since is waiting for CBP's answer."
    : doc.pendingAction === 'DELETE' ? "A deletion sent since is waiting for CBP's answer."
    : null;
  switch (doc.status) {
    case 'DRAFT':
      return { tone: 'calm', title: 'Draft, not sent to CBP yet.', detail: null };
    case 'SENDING':
      return { tone: 'info', title: 'Sending to CBP.', detail: null };
    case 'SENT':
      return { tone: 'info', title: 'Sent to CBP. Waiting for the answer.', detail: on(doc.sentAt, 'Sent') };
    case 'ACCEPTED': {
      const parts = [
        doc.entrySummaryStatus && `entry summary ${PART[doc.entrySummaryStatus] ?? doc.entrySummaryStatus.toLowerCase()}`,
        doc.releaseRequested && doc.cargoReleaseStatus && `cargo release ${PART[doc.cargoReleaseStatus] ?? doc.cargoReleaseStatus.toLowerCase()}`,
      ].filter(Boolean).join(', ');
      const answered = parts ? `${parts.charAt(0).toUpperCase()}${parts.slice(1)}.` : null;
      return { tone: 'done', title: 'CBP accepted this entry.', detail: join(on(doc.respondedAt, 'Accepted'), answered, pending) };
    }
    case 'REJECTED':
      return { tone: 'urgent', title: 'CBP rejected this entry.', detail: "CBP's reasons are below. Correct the entry and send it again." };
    case 'CANCELLED':
      return { tone: 'calm', title: 'This entry was cancelled.', detail: null };
    default:
      return { tone: 'calm', title: String(doc.status), detail: null };
  }
}
