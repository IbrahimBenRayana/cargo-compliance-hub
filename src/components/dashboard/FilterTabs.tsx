import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { TINT, type Tone } from './tones';

/** `tone` colours the count of a tab that is not open, so a red Rejected count stands out from the row. */
export interface FilterTab<K extends string> { key: K; label: string; count: number; tone?: Tone }

/** Underlined filters with their counts. An empty one is disabled unless it is "all" or open. */
export function FilterTabs<K extends string>({ items, active, onChange, layoutId }: {
  items: FilterTab<K>[]; active: K; onChange: (key: K) => void; layoutId: string;
}) {
  return (
    <div role="group" aria-label="Filter" className="-mb-px flex gap-4 overflow-x-auto px-4 [scrollbar-width:none]">
      {items.map((f) => {
        const on = f.key === active;
        return (
          <button
            key={f.key}
            type="button"
            aria-pressed={on}
            disabled={f.count === 0 && f.key !== 'all' && !on}
            onClick={() => onChange(f.key)}
            className={cn(
              'relative shrink-0 pb-2.5 pt-1 text-[13px] font-medium outline-none transition-colors duration-150 disabled:opacity-45 focus-visible:underline',
              on ? 'text-foreground' : 'text-muted-foreground can-hover:hover:text-foreground',
            )}
          >
            {f.label}
            <span className={cn('ml-1.5 rounded-md px-1.5 py-px text-[11.5px] tabular-nums transition-colors duration-150', on ? 'bg-primary text-primary-foreground' : f.tone && f.count > 0 ? cn(TINT[f.tone], 'font-medium') : 'bg-muted text-muted-foreground')}>
              {f.count.toLocaleString()}
            </span>
            {on && <motion.span layoutId={layoutId} className="absolute inset-x-0 -bottom-px h-0.5 rounded-full bg-primary" transition={{ type: 'spring', bounce: 0, duration: 0.3 }} />}
          </button>
        );
      })}
    </div>
  );
}
