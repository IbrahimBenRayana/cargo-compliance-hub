import type { LucideIcon } from 'lucide-react';
import { AlertTriangle, Ban, Clock, Hourglass, Lock, XCircle } from 'lucide-react';
import { countdownLabel, urgencyOf, type Urgency } from '@/lib/countdown';
import { cn } from '@/lib/utils';
import type { ActionItem, ActionKind } from '@/types/dashboard';

const TONE: Record<Urgency, string> = {
  overdue: 'text-urgent bg-urgent-tint',
  urgent: 'text-urgent bg-urgent-tint',
  soon: 'text-soon bg-soon-tint',
  calm: 'text-calm bg-muted',
};

/** Items with no clock still say what state they are in, in words. */
const STATE: Partial<Record<ActionKind, { text: string; icon: LucideIcon; tone: Urgency }>> = {
  isf_rejected: { text: 'Rejected', icon: XCircle, tone: 'overdue' },
  entry_rejected: { text: 'Rejected', icon: XCircle, tone: 'overdue' },
  isf_change_rejected: { text: 'Rejected', icon: XCircle, tone: 'overdue' },
  entry_change_rejected: { text: 'Rejected', icon: XCircle, tone: 'overdue' },
  entry_release_rejected: { text: 'Rejected', icon: XCircle, tone: 'overdue' },
  isf_no_date: { text: 'No date', icon: AlertTriangle, tone: 'soon' },
  isf_on_hold: { text: 'On hold', icon: Ban, tone: 'soon' },
  tracking_hold: { text: 'Hold', icon: Lock, tone: 'soon' },
  cbp_no_response: { text: 'No response', icon: Hourglass, tone: 'calm' },
  cbp_outcome_unknown: { text: 'Unknown', icon: Hourglass, tone: 'soon' },
  cbp_conditional: { text: 'Review', icon: Hourglass, tone: 'soon' },
};

const PILL = 'inline-flex h-6 items-center gap-1 whitespace-nowrap rounded-full px-2 font-mono text-[12.5px] font-semibold tabular-nums';

export function DeadlinePill({ item, now }: { item: ActionItem; now: number }) {
  if (item.due) {
    const left = new Date(item.due.at).getTime() - now;
    const level = urgencyOf(left);
    const Icon = level === 'overdue' ? AlertTriangle : Clock;
    const estimated = item.due.basis === 'ETD_ESTIMATE';
    const date = new Date(item.due.at).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' });
    return (
      <time
        dateTime={item.due.at}
        className={cn(PILL, TONE[level])}
        title={estimated ? `Estimated from the sailing date: ${date}. Add a lading date to make it exact.` : date}
      >
        <Icon className="h-3.5 w-3.5" aria-hidden />
        {countdownLabel(item.due.at, item.due.basis, now)}
      </time>
    );
  }
  const state = STATE[item.kind];
  // Holds the grid column, so the action stays aligned on rows with no pill.
  if (!state) return <span aria-hidden />;
  return (
    <span className={cn(PILL, TONE[state.tone])}>
      <state.icon className="h-3.5 w-3.5" aria-hidden />
      {state.text}
    </span>
  );
}
