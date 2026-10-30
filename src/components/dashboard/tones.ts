/** One colour vocabulary for the page: urgent, soon, info, entry, done, calm. */
export type Tone = 'urgent' | 'soon' | 'info' | 'entry' | 'done' | 'calm';

export const TINT: Record<Tone, string> = {
  urgent: 'bg-urgent-tint text-urgent',
  soon: 'bg-soon-tint text-soon',
  info: 'bg-info-tint text-info',
  entry: 'bg-entry-tint text-entry',
  done: 'bg-done-tint text-done',
  calm: 'bg-muted text-muted-foreground',
};

/** Brighter than the text colours: bars and dots need presence, not reading contrast. */
export const FILL: Record<Tone, string> = {
  urgent: 'bg-[hsl(var(--urgent-fill))]',
  soon: 'bg-[hsl(var(--soon-fill))]',
  info: 'bg-[hsl(var(--info-fill))]',
  entry: 'bg-[hsl(var(--entry-fill))]',
  done: 'bg-[hsl(var(--done-fill))]',
  calm: 'bg-muted-foreground',
};
