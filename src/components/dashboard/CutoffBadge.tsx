import { countdownLabel, urgencyOf, type Urgency } from '@/lib/countdown';
import { cn } from '@/lib/utils';
import { TINT, type Tone } from './tones';

export const BADGE = 'inline-flex rounded-md px-2 py-0.5 text-[12px] font-medium tabular-nums';
const URGENCY_TONE: Record<Urgency, Tone> = { overdue: 'urgent', urgent: 'urgent', soon: 'soon', calm: 'calm' };

/** Time left to an ISF cutoff, coloured by how close it is. "Est." when it comes from the sailing date. */
export function CutoffBadge({ at, basis, now }: { at: string; basis: 'LADING' | 'ETD_ESTIMATE'; now: number }) {
  const level = urgencyOf(new Date(at).getTime() - now);
  const date = new Date(at).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' });
  return (
    <time
      dateTime={at}
      className={cn(BADGE, TINT[URGENCY_TONE[level]])}
      title={basis === 'ETD_ESTIMATE' ? `Estimated from the sailing date: ${date}. Add a lading date to make it exact.` : date}
    >
      {countdownLabel(at, basis, now)}
    </time>
  );
}
