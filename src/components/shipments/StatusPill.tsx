import { FILL, TINT } from '@/components/dashboard/tones';
import { cn } from '@/lib/utils';
import { statusOf } from './status';

/** The status in its colour, always with the word: colour alone says nothing to some readers. */
export function StatusPill({ status, className }: { status: string; className?: string }) {
  const s = statusOf(status);
  return (
    <span className={cn('inline-flex items-center gap-1.5 whitespace-nowrap rounded-md px-2 py-0.5 text-[12px] font-medium', TINT[s.tone], className)}>
      <span aria-hidden className={cn('h-1.5 w-1.5 shrink-0 rounded-full', FILL[s.tone])} />
      {s.word}
    </span>
  );
}

/** The status as an icon on its tint, the way the dashboard leads each row. */
export function StatusTile({ status, className }: { status: string; className?: string }) {
  const { icon: Icon, tone } = statusOf(status);
  return (
    <span aria-hidden className={cn('grid h-7 w-7 shrink-0 place-items-center rounded-lg', TINT[tone], className)}>
      <Icon className="h-3.5 w-3.5" />
    </span>
  );
}
