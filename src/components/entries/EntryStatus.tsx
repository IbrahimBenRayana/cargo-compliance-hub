import { FILL, TINT } from '@/components/dashboard/tones';
import { cn } from '@/lib/utils';
import { entryStatusOf } from './status';

export function EntryStatusPill({ status, className }: { status: string; className?: string }) {
  const s = entryStatusOf(status);
  return (
    <span className={cn('inline-flex items-center gap-1.5 whitespace-nowrap rounded-md px-2 py-0.5 text-[12px] font-medium', TINT[s.tone], className)}>
      <span aria-hidden className={cn('h-1.5 w-1.5 shrink-0 rounded-full', FILL[s.tone])} />
      {s.word}
    </span>
  );
}

export function EntryStatusTile({ status, className }: { status: string; className?: string }) {
  const { icon: Icon, tone } = entryStatusOf(status);
  return (
    <span aria-hidden className={cn('grid h-7 w-7 shrink-0 place-items-center rounded-lg', TINT[tone], className)}>
      <Icon weight="duotone" className="h-4 w-4" />
    </span>
  );
}
