/** How a cutoff reads on the page. The thresholds match the server's lanes. */
const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

export type Urgency = 'overdue' | 'urgent' | 'soon' | 'calm';

export function urgencyOf(msLeft: number): Urgency {
  if (msLeft < 0) return 'overdue';
  if (msLeft <= DAY) return 'urgent';
  return msLeft <= 3 * DAY ? 'soon' : 'calm';
}

/** "4h 12m", "2d 3h", "45m", "<1m". Always two units at most. */
export function formatDuration(ms: number): string {
  const abs = Math.abs(ms);
  if (abs < MIN) return '<1m';
  const days = Math.floor(abs / DAY);
  const hours = Math.floor((abs % DAY) / HOUR);
  const minutes = Math.floor((abs % HOUR) / MIN);
  if (days > 0) return hours ? `${days}d ${hours}h` : `${days}d`;
  if (hours > 0) return minutes ? `${hours}h ${minutes}m` : `${hours}h`;
  return `${minutes}m`;
}

export function countdownLabel(dueAt: string, basis: 'LADING' | 'ETD_ESTIMATE', now: number): string {
  const left = new Date(dueAt).getTime() - now;
  const text = formatDuration(left);
  return left < 0 ? `${text} over` : basis === 'ETD_ESTIMATE' ? `Est. ${text}` : text;
}
